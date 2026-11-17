/** The 21:20 daily report email, built on the server from the shop database. */

export const TZ = process.env.SHOP_TZ || 'Africa/Dar_es_Salaam';
export function dayStr(ms, tz = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
export function localHM(ms, tz = TZ) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
  const [h, m] = p.split(':').map(Number); return h * 60 + m;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (a, f) => a.reduce((t, x) => t + (+f(x) || 0), 0);

export function buildDailyReport(docs, now = Date.now()) {
  const T = dayStr(now);
  const s = docs.get('settings', 'shop') || {};
  const cur = s.currency || 'TSh';
  const money = (n) => `${cur} ${Math.round(+n || 0).toLocaleString('en-US')}`;
  const branches = (s.branches && s.branches.length ? s.branches : [{ id: 'main', name: 'Main' }]);
  const bName = (id) => (branches.find((b) => b.id === id) || branches[0] || {}).name || 'Main';
  const orders = docs.list('orders');
  const pays = [];
  for (const coll of ['orders', 'homejobs', 'invoices']) for (const d of docs.list(coll)) for (const p of d.payments || []) {
    if (p && p.at && dayStr(p.at) === T) pays.push({ ...p, branch: bName(d.branchId) });
  }
  const newO = orders.filter((o) => o.createdAt && dayStr(o.createdAt) === T && o.status !== 'cancelled');
  const pieces = (o) => sum((o.items || []).filter((i) => i.service !== 'fee'), (i) => i.qty);
  const collected = orders.filter((o) => o.status === 'collected' && o.statusAt && o.statusAt.collected && dayStr(o.statusAt.collected) === T);
  const cancelled = orders.filter((o) => o.status === 'cancelled' && o.createdAt && dayStr(o.createdAt) === T);
  const expenses = docs.list('expenses').filter((e) => e.date === T);
  const refunds = docs.list('refunds').filter((r) => r.paidAt && dayStr(r.paidAt) === T);
  const closings = docs.list('closings').filter((c) => c.date === T);
  const spots = docs.list('spotchecks').filter((x) => x.doneAt && dayStr(x.doneAt) === T);
  const low = docs.list('supplies').filter((x) => (+x.qty || 0) <= (+x.reorder || 0));
  const overdue = orders.filter((o) => ['received', 'processing', 'ready'].includes(o.status) && o.dueDate && o.dueDate < T);
  const byMethod = {}; for (const p of pays) byMethod[p.method || 'Cash'] = (byMethod[p.method || 'Cash'] || 0) + (+p.amount || 0);
  const totalIn = sum(pays, (p) => p.amount);

  const per = branches.map((b) => {
    const isB = (x) => bName(x.branchId) === b.name;
    const cl = closings.filter((c) => c.branchId === b.id);
    return { name: b.name, orders: newO.filter(isB).length, pieces: sum(newO.filter(isB), pieces), collected: collected.filter(isB).length,
      money: sum(pays.filter((p) => p.branch === b.name), (p) => p.amount),
      closed: cl.length ? cl.map((c) => (+c.diff || 0) === 0 ? 'Closed, balanced' : `Closed, ${+c.diff > 0 ? 'over' : 'SHORT'} ${money(Math.abs(c.diff))}`).join('; ') : 'Not closed' };
  });

  const attention = [];
  for (const c of closings) if (+c.diff < 0) attention.push(`Cash short ${money(-c.diff)} at ${c.branchName || bName(c.branchId)} (closed by ${c.by || 'staff'})`);
  for (const x of spots) if (x.status === 'failed') attention.push(`Spot check FAILED: ${x.type} at ${x.branchName || ''} — ${x.doneBy || ''}${x.note ? ` (“${x.note}”)` : ''}`);
  for (const p of per) if (p.closed === 'Not closed' && (p.orders || p.money)) attention.push(`${p.name} has not closed the day`);
  if (overdue.length) attention.push(`${overdue.length} order(s) past their ready date and not collected`);
  if (low.length) attention.push(`Low stock: ${low.slice(0, 8).map((x) => `${x.name} (${x.qty} ${x.unit || ''})`).join(', ')}`);

  const nice = new Date(now).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shop = s.shopName || 'Fast Technology Dry Cleaner';
  const kpi = (l, v) => `<td style="padding:10px;border:1px solid #eee;border-radius:8px"><div style="font-size:12px;color:#777">${l}</div><div style="font-size:18px;font-weight:700">${v}</div></td>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#111">
<div style="background:#0e0e0e;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0"><span style="display:inline-block;background:#c9a227;color:#111;font-weight:800;border-radius:8px;padding:4px 8px;margin-right:8px">FT</span><b>${esc(shop)}</b><div style="color:#d4af37;margin-top:6px">Daily report · ${esc(nice)}</div></div>
<div style="border:1px solid #eee;border-top:3px solid #c9a227;padding:16px 20px;border-radius:0 0 12px 12px">
<table style="width:100%;border-spacing:6px"><tr>${kpi('Money received', money(totalIn))}${kpi('New orders', `${newO.length} (${sum(newO, pieces)} pcs)`)}</tr><tr>${kpi('Collected', collected.length)}${kpi('Expenses', money(sum(expenses, (e) => e.amount)))}</tr></table>
<p style="margin:12px 0 4px"><b>By payment method:</b> ${Object.entries(byMethod).map(([k, v]) => `${esc(k)} ${money(v)}`).join(' · ') || 'none'}</p>
${refunds.length ? `<p style="margin:4px 0"><b>Refunds paid:</b> ${money(sum(refunds, (r) => r.amount))}</p>` : ''}
${cancelled.length ? `<p style="margin:4px 0"><b>Cancelled today:</b> ${cancelled.length}</p>` : ''}
<h3 style="margin:16px 0 6px">Branches</h3>
<table style="width:100%;border-collapse:collapse;font-size:14px"><tr style="background:#faf7ec"><th align="left" style="padding:6px">Branch</th><th align="right">Orders</th><th align="right">Collected</th><th align="right">Money</th><th align="left" style="padding-left:8px">Cash drawer</th></tr>
${per.map((p) => `<tr style="border-top:1px solid #eee"><td style="padding:6px">${esc(p.name)}</td><td align="right">${p.orders}</td><td align="right">${p.collected}</td><td align="right">${money(p.money)}</td><td style="padding-left:8px">${esc(p.closed)}</td></tr>`).join('')}</table>
<h3 style="margin:16px 0 6px">Needs attention</h3>
${attention.length ? `<ul style="padding-left:18px;margin:0">${attention.map((a) => `<li style="margin:4px 0">${esc(a)}</li>`).join('')}</ul>` : '<p style="color:#2e7d32;margin:0">Nothing — all good today. ✓</p>'}
${spots.length ? `<p style="margin:12px 0 0;font-size:13px;color:#555">Spot checks today: ${spots.filter((x) => x.status === 'passed').length} passed, ${spots.filter((x) => x.status === 'failed').length} failed.</p>` : ''}
<p style="font-size:12px;color:#999;margin-top:18px">Sent automatically at 21:20 by your Fast Technology app.</p></div></div>`;
  const text = `${shop} — Daily report ${T}\nMoney received: ${money(totalIn)}\nNew orders: ${newO.length}\nCollected: ${collected.length}\nExpenses: ${money(sum(expenses, (e) => e.amount))}\n` +
    per.map((p) => `${p.name}: ${p.orders} orders, ${money(p.money)}, ${p.closed}`).join('\n') + (attention.length ? `\nNeeds attention:\n- ${attention.join('\n- ')}` : '\nNothing needs attention.');
  return { date: T, subject: `FT Daily report — ${nice}`, html, text, totals: { money: totalIn, orders: newO.length, collected: collected.length } };
}
