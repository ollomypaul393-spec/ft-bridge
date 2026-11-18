import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQR, qrPng, qrSvg } from '../src/qr.js';
import { DocStore } from '../src/db.js';
import { nextTicket, fmtTicket, orderPage, pubIndex } from '../src/orderpage.js';

test('ticket numbers: FT0001 upwards, never repeated, skip ones already used', async () => {
  const d = await new DocStore().init();
  await d.put('orders', 'a', { ticket: 'FT0002' });
  const got = []; for (let i = 0; i < 4; i++) { const t = nextTicket(d); got.push(t.ticket); await t.save; }
  assert.deepEqual(got, ['FT0001', 'FT0003', 'FT0004', 'FT0005']);
  assert.equal(fmtTicket(10000), 'FT10000');
});

test('QR codes: right size, PNG and SVG come out', () => {
  assert.equal(encodeQR('FT0001').size, 21);
  assert.equal(encodeQR('https://ft-bridge.onrender.com/o/k3J9xQ2mP7aWr5Tz').version, 4);
  const png = qrPng('hello'); assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.match(qrSvg('hello'), /^<svg/);
  assert.throws(() => encodeQR('x'.repeat(400)), /too long/);
});

test('order page shows the order, never the phone number; staff button hidden', async () => {
  const d = await new DocStore().init();
  await d.put('orders', 'o1', { ticket: 'FT0427', pub: 'k3J9xQ2mP7aWr5Tz', customerName: 'Asha Mwinyi', phone: '0712345678', status: 'received', dueDate: '2099-01-01', items: [{ qty: 2, garment: 'Shirt', service: 'dry', price: 3000 }], payments: [{ amount: 1000 }] });
  const idx = pubIndex(d); const o = idx.find('k3J9xQ2mP7aWr5Tz');
  const html = orderPage(o, { currency: 'TSh' });
  assert.match(html, /FT0427/); assert.match(html, /Hello Asha/); assert.match(html, /TSh 5,000/);
  assert.doesNotMatch(html, /0712345678|Mwinyi/);
  assert.equal(idx.find('nope'), null);
  await d.put('orders', 'o1', { ...o, pub: 'newKey123456' }); assert.equal(idx.find('k3J9xQ2mP7aWr5Tz'), null); assert.equal(idx.find('newKey123456').ticket, 'FT0427');
});
