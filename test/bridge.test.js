import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc, TOOLS } from '../src/mcp.js';

const env = { WA_TOKEN: 't', WA_PHONE_ID: '123', BREVO_API_KEY: 'k', MAIL_FROM: 'alerts@shop.co.tz', BRIDGE_KEY: 'x'.repeat(20) };
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
  const u = String(url);
  if (u.includes('graph.facebook.com') && u.includes('?fields')) return new Response(JSON.stringify({ display_phone_number: '+255 700 111 222', verified_name: 'Fast Technology', quality_rating: 'GREEN' }));
  if (u.includes('graph.facebook.com')) {
    const b = JSON.parse(init.body);
    if (b.template && b.template.name === 'bad') return new Response(JSON.stringify({ error: { message: 'Template name does not exist in the translation', code: 132001 } }), { status: 400 });
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }));
  }
  if (u.endsWith('/v3/account')) return new Response(JSON.stringify({ email: 'owner@shop.co.tz' }));
  if (u.endsWith('/v3/smtp/email')) return new Response(JSON.stringify({ messageId: '<m1@brevo>' }), { status: 201 });
  return new Response('{}', { status: 404 });
};
const call = (name, args) => handleRpc(env, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

test('initialize and list tools', async () => {
  const r = await handleRpc(env, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(r.result.serverInfo.name, 'ft-bridge');
  const l = await handleRpc(env, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(l.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  assert.equal(await handleRpc(env, { jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('send_template cleans phone and params', async () => {
  const r = await call('send_template', { to: '+255 712 345 678', template: 'order_receipt', params: ['Asha', 'Fast\nTechnology'] });
  assert.equal(r.result.isError, false);
  const b = calls.at(-1).body;
  assert.equal(b.to, '255712345678');
  assert.equal(b.template.components[0].parameters[1].text, 'Fast Technology');
});

test('Meta errors come back as tool errors', async () => {
  const r = await call('send_template', { to: '255712345678', template: 'bad' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.structuredContent.error, /Template name/);
});

test('send_email through Brevo', async () => {
  const r = await call('send_email', { to: 'owner@shop.co.tz, boss@shop.co.tz', subject: 'Payment', html: '<b>TSh 15,000</b>' });
  assert.equal(r.result.isError, false);
  const c = calls.at(-1);
  assert.equal(c.init.headers['api-key'], 'k');
  assert.equal(c.body.sender.email, 'alerts@shop.co.tz');
  assert.equal(c.body.to.length, 2);
});

test('send_email rejects bad addresses', async () => {
  const r = await call('send_email', { to: 'not-an-email', subject: 'x', text: 'y' });
  assert.equal(r.result.isError, true);
});

test('check_setup reports both channels', async () => {
  const r = await call('check_setup', {});
  assert.equal(r.result.structuredContent.whatsapp.ok, true);
  assert.equal(r.result.structuredContent.email.ok, true);
});

test('services can be switched off independently', async () => {
  const r = await handleRpc({ ...env, WA_TOKEN: '' }, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'send_template', arguments: { to: '255712345678', template: 'x' } } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.structuredContent.error, /WhatsApp is not configured/);
});
