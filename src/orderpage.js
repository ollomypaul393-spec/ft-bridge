/**
 * Ticket numbers (FT0001, FT0002 … never repeated) and the public order page a QR code opens.
 * Anyone with the QR link sees that one order (no phone number, first name only).
 * Staff who are signed in on that phone are sent straight to the order inside the app.
 */
import { dayStr } from './report.js';

/* ---------- ticket numbers ---------- */
export const fmtTicket = (n, short = 'FT') => short + String(n).padStart(4, '0');
/** Hands out the next ticket number. Runs without awaiting before the number is reserved, so two
 *  phones saving at the same moment can never get the same number. */
export function nextTicket(docs, short = 'FT') {
  const meta = docs.get('_meta', 'ticket') || {};
  let n = +meta.n || 0;
  const used = new Set(docs.list('orders').map((o) => o.ticket));
  do { n++; } while (used.has(fmtTicket(n, short)));
  const t = fmtTicket(n, short);
  return { ticket: t, save: docs.put('_meta', 'ticket', { n, at: Date.now() }) };
}

/* ---------- finding an order by its QR token ---------- */
export function pubIndex(docs) {
  const idx = new Map();
  for (const o of docs.list('orders')) if (o.pub) idx.set(o.pub, o.id);
  docs.on((ev) => {
    if (ev.coll !== 'orders') return;
    for (const [k, v] of idx) if (v === ev.id) idx.delete(k);
    if (ev.data && ev.data.pub) idx.set(ev.data.pub, ev.id);
  });
  return {
    find(pub) { const id = idx.get(String(pub || '')); return id ? { ...docs.get('orders', id), id } : null; }
  };
}
export const validPub = (p) => /^[A-Za-z0-9]{10,40}$/.test(String(p || ''));

/* ---------- the customer page ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (a, f) => a.reduce((t, x) => t + (+f(x) || 0), 0);
export function orderTotals(o) {
  const items = o.items || [];
  const sub = sum(items, (i) => (+i.qty || 0) * (+i.price || 0));
  const exp = o.express ? Math.round(sub * (+o.expressPct || 0) / 100) : 0;
  const disc = (+o.discount || 0) + (+o.acctDisc || 0) + (+o.promoDisc || 0) + (+o.loyaltyDisc || 0);
  const total = Math.max(0, sub + exp - disc), paid = sum(o.payments || [], (p) => p.amount);
  return { total, paid, bal: total - paid };
}
const DEF_SVC = { dry: 'Dry clean', wash: 'Wash', iron: 'Iron', fee: 'Service fee' };
const niceDate = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch { return d; } };

export function orderPage(o, s = {}, { qrSrc = '' } = {}) {
  const cur = s.currency || 'TSh';
  const money = (n) => `${cur} ${Math.round(+n || 0).toLocaleString('en-US')}`;
  const svcName = (k) => ((s.services || []).find((x) => x.k === k) || {}).label || DEF_SVC[k] || k;
  const t = orderTotals(o), today = dayStr(Date.now());
  const first = String(o.customerName || '').split(' ')[0] || 'Customer';
  let state, tone;
  if (o.status === 'collected') { state = `Collected${o.statusAt && o.statusAt.collected ? ' on ' + new Date(o.statusAt.collected).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}. Thank you!`; tone = 'done'; }
  else if (o.status === 'cancelled') { state = 'This order was cancelled.'; tone = 'off'; }
  else if (o.status === 'ready' && s.trackStages) { state = 'Ready for pickup 🎉'; tone = 'ready'; }
  else if (o.dueDate && o.dueDate <= today) { state = 'Should be ready — you can come to pick it up.'; tone = 'ready'; }
  else { state = `In the shop. Ready by ${niceDate(o.dueDate)}.`; tone = 'wait'; }
  const items = (o.items || []).filter((i) => i.service !== 'fee');
  const shop = s.shopName || 'Fast Technology Dry Cleaner';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.ticket)} · ${esc(shop)}</title><meta name="robots" content="noindex"><link rel="icon" href="/icon.svg"><meta name="theme-color" content="#0e0e0e">
<style>*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f4ee;color:#111}
.top{background:#0e0e0e;color:#fff;padding:22px 18px 46px;text-align:center}.logo{width:54px;height:54px;border-radius:14px;margin:0 auto 8px;background:linear-gradient(135deg,#e6c65c,#b8921f);color:#111;font-weight:800;font-size:22px;display:grid;place-items:center}
.top b{color:#d4af37}.card{max-width:460px;margin:-30px auto 18px;background:#fff;border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.08);padding:20px;border-top:4px solid #c9a227}
.tk{font-size:30px;font-weight:800;letter-spacing:1px;text-align:center;margin:4px 0}.hi{text-align:center;color:#666;margin:0 0 14px}
.st{border-radius:12px;padding:12px 14px;font-weight:600;text-align:center;margin-bottom:14px}.st.wait{background:#fff6dc;color:#7a5b00}.st.ready{background:#e6f6ea;color:#1c6b33}.st.done{background:#eef0f3;color:#333}.st.off{background:#fdeaea;color:#a12}
table{width:100%;border-collapse:collapse;font-size:15px}td{padding:7px 0;border-bottom:1px solid #f0ece0}td.r{text-align:right}.tot td{border:0;padding:4px 0}.bal td{font-weight:800;font-size:17px}
.qr{display:block;width:150px;height:150px;margin:16px auto 4px}.small{color:#888;font-size:13px;text-align:center;line-height:1.45}.btn{display:block;text-align:center;background:#0e0e0e;color:#fff;border-radius:12px;padding:13px;text-decoration:none;font-weight:700;margin-top:14px}</style></head><body>
<div class="top"><div class="logo">FT</div><div><b>${esc(shop.replace(/ Dry Cleaner$/, ''))}</b>${/ Dry Cleaner$/.test(shop) ? ' Dry Cleaner' : ''}</div></div>
<div class="card"><div class="tk">${esc(o.ticket)}</div><p class="hi">Hello ${esc(first)} 👋</p><div class="st ${tone}">${esc(state)}</div>
<table>${items.map((i) => `<tr><td>${esc(i.qty)} × ${esc(i.garment)} <span style="color:#999">· ${esc(svcName(i.service))}</span></td><td class="r">${money((+i.qty || 0) * (+i.price || 0))}</td></tr>`).join('')}</table>
<table style="margin-top:8px"><tr class="tot"><td>Total</td><td class="r">${money(t.total)}</td></tr><tr class="tot"><td>Paid</td><td class="r">${money(t.paid)}</td></tr>${o.accountId ? '<tr class="bal"><td>Balance</td><td class="r">On account</td></tr>' : `<tr class="bal"><td>Balance</td><td class="r">${money(Math.max(0, t.bal))}</td></tr>`}</table>
${qrSrc ? `<img class="qr" src="${esc(qrSrc)}" alt="QR code for ${esc(o.ticket)}"><p class="small">Show this code or your ticket number <b>${esc(o.ticket)}</b> when you collect.</p>` : ''}
${s.phone || s.address ? `<p class="small" style="margin-top:14px">${s.address ? esc(s.address) + '<br>' : ''}${s.phone ? `Questions? <a href="tel:${esc(String(s.phone).replace(/\s/g, ''))}">${esc(s.phone)}</a>` : ''}</p>` : ''}
<a class="btn" id="staffBtn" href="/#scan/${esc(o.pub)}" hidden>Open this order in the shop app</a></div>
<script>try{if(localStorage.getItem('ft-session')){document.getElementById('staffBtn').hidden=false;location.replace('/#scan/${esc(o.pub)}')}}catch(e){}</script>
</body></html>`;
}
