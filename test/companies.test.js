import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocStore } from '../src/db.js';
import { scopeAll, envFor, COMPANIES, brandify } from '../src/companies.js';
import { roleOf } from '../src/auth.js';
import { nextTicket } from '../src/orderpage.js';

test('each company only sees its own data', async () => {
  const base = await new DocStore().init(); const S = scopeAll(base); const ft = S.get('ft'), ht = S.get('ht');
  await ft.put('orders', 'a', { ticket: 'FT0001' }); await ht.put('orders', 'b', { ticket: 'HT0001' });
  assert.deepEqual(ft.list('orders').map((o) => o.ticket), ['FT0001']);
  assert.deepEqual(ht.list('orders').map((o) => o.ticket), ['HT0001']);
  assert.deepEqual(ft.collections(), ['orders']); assert.deepEqual(ht.collections(), ['orders']);
  const seen = []; ht.on((e) => seen.push(e.coll + '/' + e.id)); await ft.put('orders', 'c', {}); await ht.put('staff', 's', {});
  assert.deepEqual(seen, ['staff/s']);
  assert.equal(nextTicket(ht, 'HT').ticket, 'HT0002'); assert.equal(nextTicket(ft, 'FT').ticket, 'FT0002');
});

test('admins and staff are per company', async () => {
  const base = await new DocStore().init(); const S = scopeAll(base);
  await S.get('ht').put('staff', 's1', { name: 'Neema', email: 'neema@gmail.com', active: true });
  const env = { ADMIN_EMAILS: 'owner@gmail.com', ADMIN_EMAILS_HT: 'owner@gmail.com, ht.boss@gmail.com' };
  const [F, H] = COMPANIES.map((c) => envFor(env, c));
  assert.equal(roleOf(H, S.get('ht'), { uid: 'g1', email: 'htboss@gmail.com' }), 'admin');
  assert.equal(roleOf(F, S.get('ft'), { uid: 'g1', email: 'htboss@gmail.com' }), null);
  assert.equal(roleOf(H, S.get('ht'), { uid: 'g2', email: 'neema@gmail.com' }), 'staff');
  assert.equal(roleOf(F, S.get('ft'), { uid: 'g2', email: 'neema@gmail.com' }), null);
  assert.equal(roleOf(F, S.get('ft'), { uid: 'g3', email: 'owner@gmail.com' }), 'admin');
});

test('High Technology pages get its own name and colours', () => {
  const out = brandify('<b style="color:#d4af37">Fast Technology</b> <div>FT</div><i>>FT<</i> FT Alerts', COMPANIES[1]);
  assert.match(out, /High Technology/); assert.match(out, /#ffa65c/); assert.match(out, /<img src="\/brand\/ht-mark.png"|>HT</); assert.match(out, /HT Alerts/);
  assert.doesNotMatch(out, /Fast Technology|#d4af37/);
  const page = brandify('<style>.x{}</style><link rel="icon" href="/alerts/KEY-ht/icon.svg"><div class="logo">FT</div>', COMPANIES[1]);
  assert.match(page, /href="\/brand\/ht-icon.png"/); assert.match(page, /<img src="\/brand\/ht-mark.png"/);
  assert.equal(brandify('Fast Technology Dry Cleaner', COMPANIES[1]), 'High Technology Laundry & Dry Cleaners');
});
