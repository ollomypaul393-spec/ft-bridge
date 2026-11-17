import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptPayload, vapidAuthHeader, generateVapidKeys, b64u, unb64u } from '../src/push.js';
import { handleRpc } from '../src/mcp.js';

// Acts as the phone's browser: makes a subscription and decrypts what the bridge sends.
function makeBrowser() {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ua, auth, sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } } };
}
function decrypt(browser, body) {
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const secret = browser.ua.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), browser.ua.getPublicKey(), asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, browser.auth, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const out = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(out[out.length - 1], 2, 'last-record delimiter');
  return out.subarray(0, -1).toString();
}

test('payload encrypts so the browser can decrypt it (RFC 8291)', () => {
  const br = makeBrowser();
  const msg = JSON.stringify({ title: '💵 TSh 15,000 · M-Pesa', body: 'Ticket 1117-280 · Asha' });
  assert.equal(decrypt(br, encryptPayload(br.sub, msg)), msg);
});

test('VAPID header is a valid ES256 JWT for the push service', () => {
  const k = generateVapidKeys();
  const h = vapidAuthHeader('https://fcm.googleapis.com/fcm/send/abc', { ...k, subject: 'mailto:owner@shop.co.tz' });
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h); assert.ok(m);
  const claims = JSON.parse(unb64u(m[2]).toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  const pub = unb64u(k.publicKey);
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(m[1] + '.' + m[2]), { key, dsaEncoding: 'ieee-p1363' }, unb64u(m[3])));
});

test('notify_owner delivers to devices and drops dead ones', async () => {
  const k = generateVapidKeys();
  const env = { VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey };
  const live = makeBrowser(), dead = makeBrowser();
  dead.sub.endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/dead';
  const got = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('dead')) return new Response('', { status: 410 });
    got.push(JSON.parse(decrypt(live, Buffer.from(init.body)))); return new Response('', { status: 201 });
  };
  const r = await handleRpc(env, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'notify_owner', arguments: { title: '💵 TSh 15,000 · M-Pesa', body: 'Ticket 1117-280', subscriptions: [live.sub, dead.sub] } } });
  assert.equal(r.result.isError, false);
  assert.equal(r.result.structuredContent.sent, 1);
  assert.equal(r.result.structuredContent.removed.length, 1);
  assert.equal(got[0].title, '💵 TSh 15,000 · M-Pesa');
  const l = await handleRpc(env, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_devices', arguments: {} } });
  assert.equal(l.result.structuredContent.devices.length, 1);
});
