/**
 * Fast Technology Dry Cleaner — the whole system on one Render service:
 *   /               the shop app (public/)
 *   /api/...        sign-in, live data sync, saving, alerts, WhatsApp, email
 *   /alerts/<key>   FT Alerts, the notification app for the owner's phones and computers
 *   /cron/daily     sends the 21:20 daily report email (also checked every minute while awake)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool, notifyAll, handleRpc } from './mcp.js';
import { addDevice, recentAlerts, useDocs } from './store.js';
import { page, serviceWorker, manifest, ICON_SVG } from './alerts-app.js';
import { DocStore, acquireLease } from './db.js';
import { COMPANIES, SINGLE, byId, publicInfo, envFor, scopeAll, brandify } from './companies.js';
import { adminEmails, makeToken, readToken, verifyGoogle, roleOf, canRead, canReadColl, canWrite, canUseTool, validColl, validId } from './auth.js';
import { buildDailyReport, dayStr, localHM } from './report.js';
import { nextTicket, pubIndex, validPub, orderPage } from './orderpage.js';
import { qrPng, qrSvg } from './qr.js';

const env = process.env;
const PORT = Number(env.PORT) || 10000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const MAX_BODY = 3 * 1024 * 1024;
if (!env.APP_URL && env.RENDER_EXTERNAL_URL) env.APP_URL = env.RENDER_EXTERNAL_URL;
/* setup mistakes are shown on the web page instead of crashing, so they are easy to see */
const setupProblems = [];
for (const k of Object.keys(env)) if (/^(DATABASE_URL|GOOGLE_CLIENT_ID|ADMIN_EMAILS|SESSION_SECRET|ALERTS_KEY|VAPID_[A-Z_]+|ONLY_COMPANY)$/.test(k)) env[k] = String(env[k]).trim().replace(/^["']|["']$/g, '').replace(/\s*←.*$/, '').trim();
if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) setupProblems.push('SESSION_SECRET is missing or too short (it must be a long random value, at least 16 letters/numbers).');
if (env.RENDER && !env.DATABASE_URL) setupProblems.push('DATABASE_URL is missing — paste your Neon connection string (it starts with postgresql://).');
if (env.RENDER && !env.ADMIN_EMAILS) setupProblems.push('ADMIN_EMAILS is missing — put your Gmail address.');
if (env.RENDER && !env.GOOGLE_CLIENT_ID) setupProblems.push('GOOGLE_CLIENT_ID is missing — copy it from Google Cloud → Clients.');
if (env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL.replace(/^psql\s+/, '').replace(/^['"]/, ''))) setupProblems.push('DATABASE_URL does not look right — it must start with postgresql:// (copy it from Neon → Connect).');
for (const [k, why] of [['DATABASE_URL', 'data is NOT saved permanently (set your Neon connection string)'], ['GOOGLE_CLIENT_ID', 'nobody can sign in'], ['ADMIN_EMAILS', 'there is no admin'], ['VAPID_PUBLIC_KEY', 'push notifications are off'], ['ALERTS_KEY', 'the FT Alerts link is off'], ['BREVO_API_KEY', 'the daily report email is off']]) if (!env[k]) console.warn(`${k} is not set — ${why}.`);

/* ---------------- database (one store, each company sees only its own part) ---------------- */
let docsTmp;
try { docsTmp = new DocStore({ databaseUrl: setupProblems.some((x) => x.startsWith('DATABASE_URL')) ? '' : env.DATABASE_URL || '', dataDir: env.DATA_DIR || '' }); }
catch (e) { setupProblems.push('DATABASE_URL could not be read: ' + e.message); docsTmp = new DocStore({}); }
export const docs = docsTmp;
const scopes = scopeAll(docs);                 // company id -> its view of the database
useDocs(scopes.get('ft'));
const ENV = new Map(COMPANIES.map((c) => [c.id, { ...envFor(env, c), __docs: scopes.get(c.id), __alertsName: c.alerts }]));
let dbError = 'Starting up…';
let pubIdx = new Map();
async function initDb() {
  if (setupProblems.length) { dbError = 'Setup problem: ' + setupProblems.join(' '); console.error(dbError); return; }
  try {
    await docs.init();
    pubIdx = new Map(COMPANIES.map((c) => [c.id, pubIndex(scopes.get(c.id))]));
    dbError = ''; console.log(`Database ready (${docs.kind}), ${docs.collections().length} collections`);
  } catch (e) { dbError = e.message; console.error('Database not reachable:', e.message, '— retrying in 15 s'); setTimeout(initDb, 15000); }
}

/* ---------------- helpers ---------------- */
function send(res, status, body, headers = {}) {
  const isJson = body !== null && typeof body === 'object';
  res.writeHead(status, { 'content-type': isJson ? 'application/json' : 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers });
  res.end(isJson ? JSON.stringify(body) : body ?? '');
}
async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw Object.assign(new Error('Too large'), { status: 413 }); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('Bad JSON'), { status: 400 }); }
}
const roleIn = (c, user) => roleOf(ENV.get(c.id), scopes.get(c.id), user);
const rolesFor = (user) => COMPANIES.map((c) => ({ c, role: roleIn(c, user) })).filter((x) => x.role);
function who(req, url) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('t');
  const p = readToken(env, t);
  if (!p) return null;
  const u = docs.get('_users', p.uid) || {};
  const user = { id: p.uid, uid: p.uid, email: p.email, name: u.name || p.email, picture: u.picture || '' };
  const mine = rolesFor(user);
  const want = String(req.headers['x-company'] || url.searchParams.get('co') || '');
  const sel = mine.find((x) => x.c.id === want) || mine[0] || null;
  return { user, mine, co: sel ? sel.c : null, role: sel ? sel.role : null };
}
const site = (req) => (env.APP_URL || 'https://' + req.headers.host).replace(/\/$/, '');
/* optional own web addresses, e.g. COMPANY_DOMAINS="hightechnology.co.tz=ht, fasttechnology.co.tz=ft" */
const domainCo = (host) => {
  const h = String(host || '').toLowerCase().split(':')[0].replace(/^www\./, '');
  for (const pair of String(env.COMPANY_DOMAINS || '').split(/[,;\s]+/)) {
    const [d, id] = pair.split('=');
    if (d && id && h === d.toLowerCase().replace(/^www\./, '')) return byId(id.trim());
  }
  return null;
};
const siteFor = (co, req) => (env['APP_URL_' + co.id.toUpperCase()] || env.APP_URL || 'https://' + req.headers.host).replace(/\/$/, '');
const alertsPath = (c) => (env.ALERTS_KEY && env.ALERTS_KEY.length >= 16 ? `/alerts/${env.ALERTS_KEY}${c.prefix && !SINGLE ? '-' + c.id : ''}` : null);
const alertsLink = (c) => (alertsPath(c) && env.APP_URL ? env.APP_URL.replace(/\/$/, '') + alertsPath(c) : '');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
/* the app page, already in the right company's name, logo and colours (for home-screen installs and link previews) */
function serveIndex(res, co) {
  let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  if (co && co.id !== 'ft') {
    const t = co.theme;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${co.name}</title>`)
      .replace(/<link rel="icon" href="[^"]*">/, `<link rel="icon" href="${co.icon}">`)
      .replace('href="manifest.webmanifest"', `href="/manifest-${co.id}.webmanifest"`)
      .replace('<link rel="apple-touch-icon" href="icon.svg">', `<link rel="apple-touch-icon" href="${co.icon}">`)
      .replace('<meta name="theme-color" content="#0e0e0e">', `<meta name="theme-color" content="${t.nav}">`)
      .replace('content="Fast Technology">', `content="${co.brand}">`)
      .replace('content="Fast Technology Dry Cleaner">', `content="${co.name}">`)
      .replace('<meta property="og:image" content="/icon.svg">', `<meta property="og:image" content="${co.icon}">`)
      .replace('<html lang="en">', `<html lang="en" data-co="${co.id}">`);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
  res.end(html); return true;
}
function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname); if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
  fs.createReadStream(file).pipe(res); return true;
}

/* ---------------- live sync (Server-Sent Events) ---------------- */
const clients = new Set();
function snapshotFor(c) {
  const D = scopes.get(c.co.id); const colls = {};
  for (const coll of D.collections()) {
    if (coll === 'settings' || coll.startsWith('_')) continue;
    if (canReadColl(c.role, coll)) colls[coll] = D.list(coll);
    else if (coll === 'reportlog') colls[coll] = D.list(coll).filter((d) => d.id === c.user.id);
  }
  return { settings: D.get('settings', 'shop'), colls, role: c.role, company: c.co.id };
}
const sse = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
for (const co of COMPANIES) scopes.get(co.id).on((ev) => {
  for (const c of clients) {
    if (c.co.id !== co.id) continue;
    if (ev.coll === 'staff' || ev.coll === 'links') {
      const role = roleIn(co, c.user);
      if (role !== c.role) { c.role = role; if (!role) { sse(c.res, 'revoked', {}); c.res.end(); clients.delete(c); continue; } sse(c.res, 'init', snapshotFor(c)); continue; }
    }
    if (ev.coll === 'settings' && ev.id === 'shop') { sse(c.res, 'settings', ev.data); continue; }
    if (canRead(c.role, c.user.id, ev.coll, ev.id)) sse(c.res, 'change', { coll: ev.coll, id: ev.id, data: ev.data });
  }
});
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 20000).unref();

/* ---------------- daily report (each company separately) ---------------- */
const dailyBusy = new Set();
/** Who gets the daily report: the addresses in Settings, or every admin Gmail of that company when that box is empty. */
export function reportRecipients(s, e = env) {
  const list = String(s.reportEmail || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  return [...new Set(list.length ? list : adminEmails(e))].slice(0, 20);
}
export async function runDaily({ force = false, now = Date.now(), co = COMPANIES[0] } = {}) {
  if (dailyBusy.has(co.id)) return { ok: false, skipped: 'busy' };
  const D = scopes.get(co.id), E = ENV.get(co.id);
  const s = D.get('settings', 'shop') || {};
  if (!force) {
    if (!s.dailyEmail) return { ok: true, skipped: 'daily email is off in Settings' };
    if (localHM(now) < 21 * 60) return { ok: true, skipped: 'too early (sent at 21:20)' };
    if ((D.get('_meta', 'daily') || {}).last === dayStr(now)) return { ok: true, skipped: 'already sent today' };
  }
  const to = reportRecipients(s, E);
  if (!to.length) return { ok: false, error: 'No report email addresses in Settings (and no admin emails)' };
  dailyBusy.add(co.id);
  try {
    const r = buildDailyReport(D, now);
    let html0 = r.html;
    if (co.logo) html0 = html0.replace(/<span style="display:inline-block;background:#c9a227[^>]*>FT<\/span>/, `<img src="${(env.APP_URL || '').replace(/\/$/, '')}${co.logo}" width="44" height="44" alt="${co.short}" style="vertical-align:middle;background:#fff;border-radius:10px;padding:2px;margin-right:10px">`);
    const html = brandify(html0, co), text = brandify(r.text, co), subject = brandify(r.subject, co).replace(/^FT /, co.short + ' ');
    const sent = [], failed = [];
    for (const email of to) { // one email per person, so a wrong address never blocks the others
      try { await callTool(E, 'send_email', { to: email, subject, html, text }); sent.push(email); }
      catch (e) { failed.push(`${email}: ${e.message}`); }
    }
    if (!sent.length) throw new Error(failed[0] || 'Not sent');
    if (!force) await D.put('_meta', 'daily', { last: r.date, at: Date.now(), sent, failed });
    return { ok: true, sent: r.date, to: sent.join(', '), count: sent.length, failed };
  } finally { dailyBusy.delete(co.id); }
}
async function runDailyAll() {
  const out = {};
  for (const co of COMPANIES) { try { out[co.id] = await runDaily({ co }); } catch (e) { out[co.id] = { ok: false, error: e.message }; } }
  return { ok: Object.values(out).every((r) => r.ok !== false), companies: out };
}
setInterval(() => { if (!dbError) docs.pruneBlobs(120 * 864e5).catch(() => {}); }, 6 * 3600e3).unref(); // receipt pictures kept 4 months
setInterval(() => { if (!dbError) runDailyAll().then((r) => { for (const [k, v] of Object.entries(r.companies)) if (v.sent) console.log('Daily report sent', k, v.sent); }); }, 60000).unref();

/* ---------------- routes ---------------- */
export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p === '/healthz') return send(res, 200, setupProblems.length ? 'setup problem: ' + setupProblems.join(' ') : dbError ? 'starting' : 'ok');
    if (setupProblems.length && !p.startsWith('/api/')) return send(res, 503, `This app needs a fix in Render → Environment:\n\n- ${setupProblems.join('\n- ')}\n\nAfter fixing, click Save Changes and wait for the app to restart.`);

    // FT Alerts / HT Alerts — the owner's notification app, one per company
    for (const co of [...COMPANIES].sort((a, b) => b.prefix.length - a.prefix.length)) {
      const A = alertsPath(co);
      if (!A || !(p === A || p.startsWith(A + '/'))) continue;
      if (dbError) return send(res, 503, 'Starting up — refresh in a minute.');
      const sub = p.slice(A.length) || '/', D = scopes.get(co.id), E = ENV.get(co.id), app = env.APP_URL || '';
      if (req.method === 'GET' && sub === '/') return send(res, 200, brandify(page(A, env.VAPID_PUBLIC_KEY || '', app), co), { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      if (req.method === 'GET' && sub === '/sw.js') return send(res, 200, brandify(serviceWorker(A, app), co), { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
      if (req.method === 'GET' && sub === '/manifest.webmanifest') return send(res, 200, brandify(manifest(A), co), { 'content-type': 'application/manifest+json' });
      if (req.method === 'GET' && sub === '/icon.svg') return send(res, 200, brandify(ICON_SVG, co), { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=86400' });
      if (req.method === 'GET' && sub === '/feed') return send(res, 200, recentAlerts(D), { 'cache-control': 'no-store' });
      if (req.method === 'POST' && sub === '/register') { const b = await readJson(req); const d = addDevice(b.subscription, b.label, D); return send(res, 200, { ok: true, label: d.label }); }
      if (req.method === 'POST' && sub === '/test') return send(res, 200, await notifyAll(E, { title: `🔔 ${co.alerts} test`, body: 'Notifications are working on your devices.', tag: 'test' }));
      return send(res, 404, 'Not found');
    }

    if (p === '/cron/daily') { if (dbError) return send(res, 503, dbError); return send(res, 200, await runDailyAll()); }

    if (p === '/qr/sample.png' || p === '/qr/sample.svg') { // sample picture for Meta's template review / the preview
      const link = `${site(req)}/o/sample`;
      if (p.endsWith('.png')) { res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }); return res.end(qrPng(link)); }
      return send(res, 200, qrSvg(link), { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' });
    }
    // the receipt picture WhatsApp shows (made by the phone that saved the order)
    const rm = /^\/r\/([A-Za-z0-9]{10,40})\.jpg$/.exec(p);
    if (rm && req.method === 'GET') {
      if (dbError) return send(res, 503, 'Starting up');
      const b = await docs.getBlob('rc:' + rm[1]);
      if (b) { res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' }); return res.end(Buffer.from(b, 'base64')); }
      let found = null; for (const c of COMPANIES) { found = pubIdx.get(c.id) && pubIdx.get(c.id).find(rm[1]); if (found) break; }
      if (!found) return send(res, 404, 'Not found');
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-cache' }); return res.end(qrPng(`${site(req)}/o/${rm[1]}`));
    }

    // QR codes and the customer's order page (public — the long random key is the password)
    const qm = /^\/(o|qr)\/([A-Za-z0-9]+)(\.png|\.svg)?$/.exec(p);
    if (qm && req.method === 'GET') {
      if (dbError) return send(res, 503, 'The shop server is starting — please refresh in a minute.', { 'retry-after': '20' });
      let o = null, co = null;
      if (validPub(qm[2])) for (const c of COMPANIES) { const f = pubIdx.get(c.id) && pubIdx.get(c.id).find(qm[2]); if (f) { o = f; co = c; break; } }
      if (!o) return send(res, 404, 'Order not found. Please check with the shop.');
      const link = `${siteFor(co, req)}/o/${o.pub}`;
      if (qm[1] === 'qr' && qm[3] === '.png') { res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' }); return res.end(qrPng(link)); }
      if (qm[1] === 'qr') return send(res, 200, qrSvg(link), { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=604800' });
      if (!qm[3]) return send(res, 200, brandify(orderPage(o, { shopName: co.name, ...(scopes.get(co.id).get('settings', 'shop') || {}) }, { qrSrc: `/qr/${o.pub}.svg`, tagline: co.tagline, appPath: SINGLE ? '/' : '/' + co.id }), co), { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
      return send(res, 404, 'Not found');
    }

    // each company's own link: /ht and /ft open that shop directly
    const entry = /^\/(ft|ht)\/?$/i.exec(p);
    if (entry && req.method === 'GET') {
      if (!byId(entry[1].toLowerCase())) return send(res, 302, '', { location: '/' + url.search }); // that shop is a separate app
      if (p.endsWith('/')) return send(res, 301, '', { location: p.replace(/\/+$/, '') + url.search });
      return serveIndex(res, domainCo(req.headers.host) || byId(entry[1].toLowerCase()));
    }
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveIndex(res, domainCo(req.headers.host) || (SINGLE ? COMPANIES[0] : null));

    if (p === '/config.js') { const dc = domainCo(req.headers.host) || (SINGLE ? COMPANIES[0] : null); return send(res, 200, `window.FT_CONFIG=${JSON.stringify({ googleClientId: env.GOOGLE_CLIENT_ID || '', googleClientIds: Object.fromEntries(COMPANIES.map((c) => [c.id, env['GOOGLE_CLIENT_ID_' + c.id.toUpperCase()] || env.GOOGLE_CLIENT_ID || ''])), companies: COMPANIES.map(publicInfo), lockCompany: dc ? dc.id : '' })};`, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' }); }

    // optional: keep the Claude connector working if BRIDGE_KEY is set (Fast Technology)
    if (env.BRIDGE_KEY && env.BRIDGE_KEY.length >= 16 && p === `/mcp/${env.BRIDGE_KEY}`) {
      if (req.method !== 'POST') return send(res, 405, 'Use POST (MCP).');
      const out = await handleRpc(ENV.get('ft'), await readJson(req));
      return out === null ? send(res, 202, '') : send(res, 200, out);
    }

    if (p.startsWith('/api/')) {
      if (dbError) return send(res, 503, { error: 'The server is starting up — try again in a moment. ' + (dbError === 'Starting up…' ? '' : dbError) });

      if (p === '/api/auth/google' && req.method === 'POST') {
        const b = await readJson(req);
        let g; try { g = await verifyGoogle(env, b.credential); } catch (e) { return send(res, 401, { error: e.message }); }
        const prev = docs.get('_users', g.id) || {};
        await docs.put('_users', g.id, { ...prev, email: g.email, name: g.name, picture: g.picture, lastSignIn: Date.now(), firstSeen: prev.firstSeen || Date.now() });
        const mine = rolesFor({ ...g, uid: g.id });
        if (!mine.length) return send(res, 403, { error: 'not_allowed', email: g.email, name: g.name });
        return send(res, 200, { token: makeToken(env, g), companies: mine.map((x) => x.c.id) });
      }

      const w = who(req, url);
      if (!w) return send(res, 401, { error: 'Please sign in again.' });
      const askedCo = String(req.headers['x-company'] || url.searchParams.get('co') || '');
      if (askedCo && w.co && askedCo !== w.co.id && p !== '/api/me') return send(res, 409, { error: 'company_changed' });
      if (!w.role) return send(res, 403, { error: 'not_allowed', email: w.user.email });
      const { user, role, co } = w;
      const D = scopes.get(co.id), E = ENV.get(co.id);

      if (p === '/api/me') return send(res, 200, { user: { id: user.id, email: user.email, name: user.name, picture: user.picture }, role, company: publicInfo(co), companies: w.mine.map((x) => ({ ...publicInfo(x.c), role: x.role })), alertsLink: role === 'admin' ? alertsLink(co) : '', db: docs.kind });

      if (p === '/api/stream') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        const c = { res, user, role, co };
        clients.add(c); sse(res, 'init', snapshotFor(c));
        req.on('close', () => clients.delete(c));
        return;
      }

      const m = /^\/api\/doc\/([^/]+)\/([^/]+)$/.exec(p);
      if (m) {
        const coll = decodeURIComponent(m[1]), id = decodeURIComponent(m[2]);
        if (!validColl(coll) || !validId(id)) return send(res, 400, { error: 'Bad document path' });
        if (req.method === 'GET') return canRead(role, user.id, coll, id) ? send(res, 200, { data: D.get(coll, id) }) : send(res, 403, { error: 'forbidden' });
        if (!canWrite(role, user.id, coll, id)) return send(res, 403, { error: 'forbidden', code: 'invalid_argument' });
        if (req.method === 'PUT') { const b = await readJson(req); await D.put(coll, id, b.data); return send(res, 200, { ok: true }); }
        if (req.method === 'DELETE') { await D.del(coll, id); return send(res, 200, { ok: true }); }
        return send(res, 405, { error: 'Method not allowed' });
      }

      if (p === '/api/receipt-image' && req.method === 'POST') {
        const b = await readJson(req);
        if (!validPub(b.pub) || !pubIdx.get(co.id).find(b.pub)) return send(res, 404, { error: 'Order not found' });
        const mm = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
        if (!mm || mm[1].length > 1600000) return send(res, 400, { error: 'Bad picture' });
        await docs.putBlob('rc:' + b.pub, mm[1]);
        return send(res, 200, { ok: true, url: `${siteFor(co, req)}/r/${b.pub}.jpg?v=${Date.now().toString(36)}` });
      }

      if (p === '/api/ticket' && req.method === 'POST') { const t = nextTicket(D, co.short); await t.save; return send(res, 200, { ticket: t.ticket }); }

      if (p === '/api/lease' && req.method === 'POST') { const b = await readJson(req); return send(res, 200, acquireLease(`${co.id}/${b.coll}/${b.id}`, String(b.holder || user.id), b.ttlMs)); }

      if (p === '/api/profiles' && req.method === 'POST') {
        const b = await readJson(req); const out = {};
        for (const id of (Array.isArray(b.ids) ? b.ids : []).slice(0, 300)) { const u = docs.get('_users', String(id)); if (u) out[id] = { name: u.name, avatarUrl: u.picture || '' }; }
        return send(res, 200, out);
      }

      if (p === '/api/tool' && req.method === 'POST') {
        const b = await readJson(req); const tool = String(b.tool || '');
        if (tool === 'send_daily_report') {
          if (role !== 'admin') return send(res, 403, { error: 'Only the admin can do this' });
          try { return send(res, 200, { payload: await runDaily({ force: true, co }) }); } catch (e) { return send(res, 400, { error: e.message }); }
        }
        if (!canUseTool(role, tool)) return send(res, 403, { error: 'This account may not use ' + tool });
        if (tool === 'send_template' && !E.WA_PHONE_ID) return send(res, 400, { error: `WhatsApp is not set up for ${co.name} yet (WA_PHONE_ID${co.prefix ? '_' + co.id.toUpperCase() : ''} on Render).` });
        try { return send(res, 200, { payload: await callTool(E, tool, b.args || {}) }); }
        catch (e) { return send(res, 400, { error: e.message }); }
      }

      return send(res, 404, { error: 'Not found' });
    }

    if (req.method === 'GET' && serveStatic(res, p)) return;
    if (req.method === 'GET' && !path.extname(p)) return serveIndex(res, domainCo(req.headers.host) || (SINGLE ? COMPANIES[0] : null));
    return send(res, 404, 'Not found');
  } catch (e) {
    if (!res.headersSent) return send(res, e.status || 500, { error: e.status ? e.message : 'Server error' });
    console.error(e);
  }
});

if (process.env.NODE_ENV !== 'test') { initDb(); server.listen(PORT, () => console.log(`Fast Technology / High Technology listening on :${PORT}`)); }
