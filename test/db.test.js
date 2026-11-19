import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocStore } from '../src/db.js';
import { canRead, canWrite, roleOf, makeToken, readToken } from '../src/auth.js';

// A tiny fake of Neon's HTTPS SQL endpoint, enough for the four statements the store uses.
function fakeNeon() {
  const rows = new Map(); const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, conn: init.headers['Neon-Connection-String'] });
    const { query, params } = JSON.parse(init.body);
    if (/^CREATE TABLE/.test(query)) return new Response('{"rows":[]}');
    if (/^SELECT/.test(query)) return new Response(JSON.stringify({ rows: [...rows.values()].map(([coll, id, data]) => ({ coll, id, data })) }));
    if (/^INSERT/.test(query)) { rows.set(params[0] + '/' + params[1], [params[0], params[1], params[2]]); return new Response('{"rows":[]}'); }
    if (/^DELETE/.test(query)) { rows.delete(params[0] + '/' + params[1]); return new Response('{"rows":[]}'); }
    return new Response('{"message":"bad"}', { status: 400 });
  };
  return { fetchImpl, rows, seen };
}

test('saves to Neon and loads it back after a restart', async () => {
  const n = fakeNeon(); const url = 'postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require';
  const a = await new DocStore({ databaseUrl: url, fetchImpl: n.fetchImpl }).init();
  const events = []; a.on((e) => events.push(e));
  await a.put('orders', 'o1', { ticket: '1117-1', id: 'ignored', payments: [{ amount: 5000 }] });
  await a.put('orders', 'o2', { ticket: '1117-2' }); await a.del('orders', 'o2');
  assert.equal(n.seen[0].url, 'https://ep-cool-1.eu-central-1.aws.neon.tech/sql');
  assert.equal(n.seen[0].conn, url);
  assert.deepEqual(events.map((e) => [e.id, !!e.data]), [['o1', true], ['o2', true], ['o2', false]]);
  const b = await new DocStore({ databaseUrl: url, fetchImpl: n.fetchImpl }).init();
  assert.deepEqual(b.list('orders'), [{ ticket: '1117-1', payments: [{ amount: 5000 }], id: 'o1' }]);
});

test('accepts the pooled connection string and a pasted psql command', async () => {
  const n = fakeNeon();
  await new DocStore({ databaseUrl: "psql 'postgresql://u:p@ep-cool-1-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'", fetchImpl: n.fetchImpl }).init();
  assert.equal(n.seen[0].url, 'https://ep-cool-1.eu-central-1.aws.neon.tech/sql');
  assert.equal(n.seen[0].conn, 'postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require');
});

test('database errors are reported, not hidden', async () => {
  const s = new DocStore({ databaseUrl: 'postgresql://u:p@h.neon.tech/db', fetchImpl: async () => new Response('{"message":"password authentication failed"}', { status: 400 }) });
  await assert.rejects(() => s.init(), /password authentication failed/);
});

test('access rules match the old Claude rules', async () => {
  const d = await new DocStore().init();
  await d.put('staff', 's1', { name: 'Rebecca', email: 'rebecca@gmail.com', active: true });
  await d.put('staff', 's2', { name: 'Old', email: 'old@gmail.com', active: false });
  const env = { ADMIN_EMAILS: 'Owner@Gmail.com' };
  assert.equal(roleOf(env, d, { uid: 'g_1', email: 'owner@gmail.com' }), 'admin');
  assert.equal(roleOf(env, d, { uid: 'g_2', email: 'rebecca@gmail.com' }), 'staff');
  assert.equal(roleOf(env, d, { uid: 'g_3', email: 'old@gmail.com' }), null);
  assert.equal(roleOf(env, d, { uid: 'g_4', email: 'random@gmail.com' }), null);
  const env3 = { ADMIN_EMAILS: ' "Paul.Ollomy@Gmail.com" ; second@shop.co.tz' };
  assert.equal(roleOf(env3, d, { uid: 'g_5', email: 'paulollomy@gmail.com' }), 'admin');
  assert.equal(roleOf(env3, d, { uid: 'g_6', email: 'Second@Shop.co.tz' }), 'admin');
  assert.equal(roleOf(env3, d, { uid: 'g_7', email: 'paul.ollomy@yahoo.com' }), null);
  await d.put('staff', 's3', { name: 'Manager', email: 'manager@gmail.com', active: true, admin: true });
  assert.equal(roleOf({ ADMIN_EMAILS: '' }, d, { uid: 'g_8', email: 'manager@gmail.com' }), 'admin');
  await d.put('staff', 's3', { name: 'Manager', email: 'manager@gmail.com', active: false, admin: true });
  assert.equal(roleOf({ ADMIN_EMAILS: '' }, d, { uid: 'g_8', email: 'manager@gmail.com' }), null);
  assert.equal(canWrite('staff', 'g_2', 'orders', 'x'), true);
  assert.equal(canWrite('staff', 'g_2', 'settings', 'shop'), false);
  assert.equal(canWrite('staff', 'g_2', 'links', 'g_2'), true);
  assert.equal(canWrite('staff', 'g_2', 'links', 'g_9'), false);
  assert.equal(canRead('staff', 'g_2', 'expenses', 'e1'), false);
  assert.equal(canRead('staff', 'g_2', 'reportlog', 'g_2'), true);
  assert.equal(canRead('admin', 'g_1', '_users', 'x'), false);
  const env2 = { SESSION_SECRET: 'x'.repeat(32) };
  const t = makeToken(env2, { id: 'g_1', email: 'a@b.c' });
  assert.equal(readToken(env2, t).uid, 'g_1');
  assert.equal(readToken(env2, t.slice(0, -2) + 'xx'), null);
  assert.equal(readToken({ SESSION_SECRET: 'y'.repeat(32) }, t), null);
});
