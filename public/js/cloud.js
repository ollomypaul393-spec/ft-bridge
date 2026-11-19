'use strict';
/* =====================================================================================
   Fast Technology — standalone connection to your own server (Render + Neon).
   Gives the app the same data / user / messaging features it had inside Claude:
   live-synced shared database, who is signed in (Google), and sending (push, WhatsApp, email).
   ===================================================================================== */
(function () {
  const CFG = window.FT_CONFIG || {};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TK = 'ft-session';
  let token = ''; try { token = localStorage.getItem(TK) || ''; } catch (e) {}
  let me = null, authResolve;
  /* ---------------- which company (Fast Technology / High Technology) ---------------- */
  const COS = CFG.companies && CFG.companies.length ? CFG.companies : [{ id: 'ft', short: 'FT', name: 'Fast Technology Dry Cleaner', theme: {} }];
  let coId = ''; try { coId = localStorage.getItem('ft-company') || ''; } catch (e) {}
  const coOf = (id) => COS.find((c) => c.id === id);
  // opened through a company's own link (/ht, /ft) or own web address: that company, no picker
  const linkCo = (/^\/(ft|ht)\/?$/i.exec(location.pathname) || [])[1];
  const LOCK = (CFG.lockCompany || (linkCo && coOf(linkCo.toLowerCase()) ? linkCo.toLowerCase() : '')) || '';
  if (LOCK) { coId = LOCK; try { localStorage.setItem('ft-company', coId); } catch (e) {} }
  function applyTheme(c) {
    if (!c) return; window.FT_CO = c; const t = c.theme || {}, r = document.documentElement.style; document.documentElement.dataset.co = c.id;
    if (c.id !== 'ft') {
      const v = { '--nav': t.nav, '--accent': t.accent, '--accent-lt': t.accentLt, '--accent-dk2': t.accentDk, '--gold': t.gold, '--accent-soft': t.soft, '--accent-dk': t.link, '--accent-ink': t.ink, '--bg': t.bg, '--line': t.line, '--nav-2': t.nav2 || t.nav, '--nav-3': t.nav3 || t.nav };
      for (const [k, val] of Object.entries(v)) if (val) r.setProperty(k, val);
    } else for (const k of ['--nav', '--accent', '--accent-lt', '--accent-dk2', '--gold', '--accent-soft', '--accent-dk', '--accent-ink', '--bg', '--line', '--nav-2', '--nav-3']) r.removeProperty(k);
    document.title = c.name;
    const m = document.querySelector('meta[name=theme-color]'); if (m && t.nav) m.content = t.nav;
    // home-screen icon, tab icon and install name follow the company
    const setHref = (sel, v) => { const l = document.querySelector(sel); if (l && v) l.href = v; };
    setHref('link[rel=apple-touch-icon]', c.icon || '/icon.svg'); setHref('link[rel=manifest]', c.id === 'ft' ? '/manifest.webmanifest' : `/manifest-${c.id}.webmanifest`);
    let fav = document.querySelector('link[rel=icon]'); if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); } fav.href = c.icon || '/icon.svg';
  }
  applyTheme(coOf(coId) || COS[0]);
  const brandHtml = (c) => { const n = c.brand || c.name; return `<b>${esc(n)}</b>${c.name.startsWith(n) ? esc(c.name.slice(n.length)) : ''}`; };
  const cardHead = (c) => c.logoFull ? `<img class="ftauth-full" src="${esc(c.logoFull)}" alt="${esc(c.name)}">` : `<div class="ftauth-logo">${esc(c.short)}</div><h1>${brandHtml(c)}</h1>`;
  const authed = new Promise((r) => (authResolve = r));
  window.FT_STANDALONE = true;

  /* ---------------- sign-in screen ---------------- */
  const box = document.createElement('div');
  box.id = 'ftAuth';
  /* laundry icons floating in the background */
  const ICONS = {
    hanger: '<path d="M12 4a2 2 0 0 1 2 2c0 .9-.6 1.4-1.2 1.8-.5.3-.8.6-.8 1.2v.5l8.4 5.1c.9.6.5 1.9-.6 1.9H4.2c-1.1 0-1.5-1.3-.6-1.9L12 9.5"/>',
    shirt: '<path d="M8 3 4 5.5 2.5 9.5l3 1.5V21h13V11l3-1.5L20 5.5 16 3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z"/>',
    drop: '<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z"/>',
    spark: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6Z"/>',
    bubble: '<circle cx="12" cy="12" r="7"/><circle cx="9.5" cy="9.5" r="1.6"/>'
  };
  const ico = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
  const floaters = [['hanger', 8, 14, 46, 0], ['shirt', 82, 10, 40, 3], ['drop', 14, 72, 28, 6], ['bubble', 88, 64, 34, 1.5], ['spark', 48, 6, 22, 4.5], ['shirt', 6, 40, 30, 7], ['hanger', 76, 86, 38, 2], ['bubble', 30, 90, 22, 5], ['spark', 92, 36, 26, 8], ['drop', 60, 92, 24, 3.5]]
    .map(([k, x, y, s, d]) => `<span class="ftfloat" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:-${d}s">${ico(k)}</span>`).join('');
  const sideHtml = (c) => `<div class="ftauth-side">${c.logoFull ? `<img class="ftside-logo" src="${esc(c.logoFull)}" alt="">` : `<div class="ftside-mark">${esc(c.short)}</div>`}
    <h2>${brandHtml(c)}</h2><p class="ftside-tag">${esc(c.tagline || 'Dry cleaning, washing and ironing.')}</p>
    <ul><li>${ico('shirt')}<span>Orders, tickets and QR receipts</span></li><li>${ico('spark')}<span>Payments and daily reports</span></li><li>${ico('hanger')}<span>Staff sign in once, then use a PIN</span></li></ul></div>`;
  const footHtml = (c) => `<div class="ftauth-foot">🔒 Secure sign-in with Google · ${esc(c.name)} · Dodoma</div>`;
  box.innerHTML = `<div class="ftauth-bg">${floaters}</div><div class="ftauth-wrap"><div id="ftAuthSide">${sideHtml(window.FT_CO)}</div><div class="ftauth-card"><div id="ftAuthHead">${cardHead(window.FT_CO)}</div><div id="ftAuthBody"><div class="ftauth-wait"><span class="ftauth-spin"></span>Loading…</div></div></div></div><div id="ftAuthFoot">${footHtml(window.FT_CO)}</div>`;
  const mount = () => { if (!box.isConnected) document.body.appendChild(box); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  const body = (h) => { mount(); box.classList.remove('gone'); document.getElementById('ftAuthBody').innerHTML = h; };

  function showSignIn(note) {
    body(`<h2 class="ftauth-h">Welcome 👋</h2><p class="ftauth-msg">Sign in to open the shop</p>${note ? `<p class="ftauth-err">${esc(note)}</p>` : ''}<div id="gbtn"></div>
      <div class="ftauth-steps"><div><b>1</b><span>Sign in with Google<small>once on this device</small></span></div><div><b>2</b><span>Enter your PIN<small>every time after</small></span></div></div>`);
    renderGoogle();
  }
  function showDenied(email) {
    body(`<h2 class="ftauth-h">Not on the staff list</h2><p class="ftauth-email">${esc(email || '')}</p><p class="ftauth-msg">Ask the owner to add this Gmail to your staff profile, then sign in again.</p><div id="gbtn"></div>`);
    renderGoogle();
  }
  function showWaking(n) {
    body(`<div class="ftauth-wait"><span class="ftauth-spin"></span>${n > 2 ? 'Waking up — this can take up to a minute…' : 'Loading…'}</div>`);
  }
  let gTries = 0;
  function renderGoogle() {
    const el = document.getElementById('gbtn'); if (!el) return;
    const clientId = (CFG.googleClientIds || {})[coId || (window.FT_CO || {}).id] || CFG.googleClientId;
    if (!clientId) { el.innerHTML = '<p class="ftauth-err">Google sign-in is not set up on the server yet (GOOGLE_CLIENT_ID).</p>'; return; }
    if (!(window.google && google.accounts && google.accounts.id)) { if (gTries++ < 100) setTimeout(renderGoogle, 150); else el.innerHTML = '<p class="ftauth-err">Could not load Google sign-in. Check the internet and reload.</p>'; return; }
    google.accounts.id.initialize({ client_id: clientId, callback: onCredential, auto_select: false, ux_mode: 'popup' });
    el.innerHTML = ''; google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center', width: Math.min(300, el.clientWidth || 300) });
  }
  async function onCredential(resp) {
    body('<div class="ftauth-wait"><span class="ftauth-spin"></span>Signing in…</div>');
    try {
      const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403 && j.error === 'not_allowed') return showDenied(j.email);
      if (!r.ok) return showSignIn(j.error || 'Sign-in failed. Please try again.');
      token = j.token; try { localStorage.setItem(TK, token); } catch (e) {}
      start();
    } catch (e) { showSignIn('No internet connection. Please try again.'); }
  }

  /* ---------------- talking to the server ---------------- */
  async function api(path, opts = {}) {
    let r;
    try { r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'x-company': coId } }); }
    catch (e) { throw { code: 'unavailable', message: 'No connection to the shop server. Check the internet.' }; }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { signOut('Please sign in again.'); throw { code: 'unauthenticated', message: j.error }; }
    if (r.status === 409 && j.error === 'company_changed') { try { localStorage.removeItem('ft-company'); } catch (e) {} location.reload(); throw { code: 'revoked', message: 'company changed' }; }
    if (r.status === 403 && j.error === 'not_allowed') { showDenied(j.email); throw { code: 'revoked', message: 'not allowed' }; }
    if (!r.ok) throw { code: r.status === 403 ? 'invalid_argument' : r.status === 503 ? 'unavailable' : 'server_error', message: j.error || 'HTTP ' + r.status, status: r.status };
    return j;
  }
  function signOut(note) {
    token = ''; try { localStorage.removeItem(TK); } catch (e) {}
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
    if (me) { location.reload(); return; }
    showSignIn(note);
  }
  window.ftApi = api;
  window.ftNextTicket = async () => (await api('/api/ticket', { method: 'POST' })).ticket;
  async function pickCompany() {
    let list = []; try { list = (await (await fetch('/api/me', { headers: { authorization: 'Bearer ' + token } })).json()).companies || []; } catch (e) {}
    body(`<h2 class="ftauth-h">Choose a shop</h2><div class="copick">${list.map((c) => `<button class="coopt" data-co="${esc(c.id)}" style="--c1:${esc(c.theme.nav)};--c2:${esc(c.theme.accent)}"><span class="cologo${c.logo ? ' img' : ''}">${c.logo ? `<img src="${esc(c.logo)}" alt="">` : esc(c.short)}</span><span><b>${esc(c.name)}</b><small>${c.role === 'admin' ? 'Admin' : 'Staff'}</small></span></button>`).join('')}</div>`);
    document.querySelectorAll('.coopt').forEach((b) => (b.onclick = () => { coId = b.dataset.co; try { localStorage.setItem('ft-company', coId); } catch (e) {} applyTheme(coOf(coId)); const h = document.getElementById('ftAuthHead'); if (h) h.innerHTML = cardHead(coOf(coId)); const sd = document.getElementById('ftAuthSide'); if (sd) sd.innerHTML = sideHtml(coOf(coId)); const ft = document.getElementById('ftAuthFoot'); if (ft) ft.innerHTML = footHtml(coOf(coId)); start(); }));
  }
  window.ftSwitchCompany = (id) => { try { localStorage.setItem('ft-company', id); } catch (e) {} if (CFG.lockCompany) return; location.href = '/' + id; };
  window.ftSignOutNow = () => signOut();
  window.ftSignOut = () => { if (confirm('Sign out of this device? You will need to sign in with Google again.')) signOut(); };

  async function start() {
    if (!token) return showSignIn();
    for (let n = 0; ; n++) {
      try {
        me = await api('/api/me');
        let chosen = ''; try { chosen = localStorage.getItem('ft-company') || ''; } catch (e) {}
        if (LOCK && me.company.id !== LOCK) { const want = coOf(LOCK); me = null; return body(`<p class="ftauth-msg"><span class="ftauth-err">This Google account is not on ${esc(want ? want.name : 'this shop')}'s staff list.</span></p><p class="ftauth-small">Ask the owner to add your Gmail to your staff profile in that shop.</p><button class="coopt" onclick="ftSignOutNow()" style="justify-content:center">Use another Google account</button>`); }
        if (!LOCK && me.companies.length > 1 && !me.companies.some((c) => c.id === chosen)) { me = null; return pickCompany(); }
        coId = me.company.id; try { localStorage.setItem('ft-company', coId); } catch (e) {}
        applyTheme(me.company); window.FT_ME = me;
        if (typeof DEF !== 'undefined') { DEF.shopName = me.company.name; if (DEF.branches && DEF.branches[0]) DEF.branches[0] = { ...DEF.branches[0], name: me.company.name.replace(/ Dry Cleaner$/, '') + ' HQ' }; }
        box.classList.add('gone'); openStream(); authResolve(); return;
      } catch (e) {
        if (e.code === 'unavailable' || e.status === 503 || e.status === 502) { showWaking(n); await new Promise((r) => setTimeout(r, 3000)); continue; }
        return; // sign-in / denied screens already shown
      }
    }
  }

  /* ---------------- live data ---------------- */
  const store = {}; let settingsDoc = null, ready = false; const subs = new Set();
  const mapOf = (c) => (store[c] || (store[c] = new Map()));
  function fire(s) {
    if (s.kind === 'doc') { const d = settingsDoc; s.cb({ exists: !!d, data: () => (d ? JSON.parse(JSON.stringify(d)) : undefined), metadata: { fromCache: false } }); return; }
    let list = [...mapOf(s.coll)].map(([id, d]) => ({ id, d }));
    for (const [f, dir] of [...s.ord].reverse()) {
      const k = dir === 'desc' ? -1 : 1;
      list.sort((a, b) => { const x = a.d[f], y = b.d[f]; if (x === y) return 0; if (x === undefined || x === null) return 1; if (y === undefined || y === null) return -1; return (x < y ? -1 : 1) * k; });
    }
    if (s.lim) list = list.slice(0, s.lim);
    s.cb({ docs: list.map((x) => ({ id: x.id, data: () => x.d })), metadata: { fromCache: false } });
  }
  const fireColl = (c) => { if (ready) for (const s of subs) if (s.coll === c) fire(s); };
  const fireAll = () => { for (const s of subs) fire(s); };
  let es = null;
  function openStream() {
    if (es) es.close();
    es = new EventSource('/api/stream?t=' + encodeURIComponent(token) + '&co=' + encodeURIComponent(coId));
    es.addEventListener('init', (ev) => {
      const j = JSON.parse(ev.data);
      for (const k of Object.keys(store)) delete store[k];
      for (const [c, list] of Object.entries(j.colls || {})) { const m = mapOf(c); for (const d of list) { const { id, ...rest } = d; m.set(id, rest); } }
      settingsDoc = j.settings || null; ready = true; fireAll();
    });
    es.addEventListener('change', (ev) => { const j = JSON.parse(ev.data); if (j.data) mapOf(j.coll).set(j.id, j.data); else mapOf(j.coll).delete(j.id); fireColl(j.coll); });
    es.addEventListener('settings', (ev) => { settingsDoc = JSON.parse(ev.data); for (const s of subs) if (s.kind === 'doc') fire(s); });
    es.addEventListener('revoked', () => { es.close(); api('/api/me').catch(() => {}); });
    es.onerror = () => { if (es.readyState === 2) setTimeout(() => api('/api/me').then(openStream).catch(() => setTimeout(openStream, 5000)), 3000); };
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && me && es && es.readyState === 2) openStream(); });

  function docRef(coll, id) {
    const path = `/api/doc/${encodeURIComponent(coll)}/${encodeURIComponent(id)}`;
    const local = (data) => { if (coll === 'settings' && id === 'shop') { settingsDoc = data; for (const s of subs) if (s.kind === 'doc') fire(s); } else { if (data) mapOf(coll).set(id, data); else mapOf(coll).delete(id); fireColl(coll); } };
    const prev = () => (coll === 'settings' && id === 'shop' ? settingsDoc : mapOf(coll).get(id));
    return {
      async set(data) { const old = prev(); local(JSON.parse(JSON.stringify(data))); try { await api(path, { method: 'PUT', body: JSON.stringify({ data }) }); } catch (e) { local(old || null); throw e; } },
      async delete() { const old = prev(); local(null); try { await api(path, { method: 'DELETE' }); } catch (e) { if (old) local(old); throw e; } },
      acquire: ({ holder, ttlMs } = {}) => api('/api/lease', { method: 'POST', body: JSON.stringify({ coll, id, holder, ttlMs }) }),
      onSnapshot(cb, err) { const s = { kind: 'doc', cb, err }; subs.add(s); if (ready) fire(s); return () => subs.delete(s); }
    };
  }
  function query(coll, ord = [], lim = 0) {
    return {
      orderBy: (f, dir = 'asc') => query(coll, [...ord, [f, dir]], lim),
      limit: (n) => query(coll, ord, n),
      doc: (id) => docRef(coll, id),
      onSnapshot(cb, err) { const s = { kind: 'coll', coll, ord, lim, cb, err }; subs.add(s); if (ready) fire(s); return () => subs.delete(s); }
    };
  }
  const db = { collection: (c) => query(c), doc: (p) => { const [c, id] = String(p).split('/'); return docRef(c, id); } };

  const user = {
    id: async () => me.user.id,
    me: async () => ({ name: me.user.name, avatarUrl: me.user.picture, email: me.user.email }),
    canEdit: async () => me.role === 'admin',
    can: async () => true,
    profiles: (ids) => api('/api/profiles', { method: 'POST', body: JSON.stringify({ ids }) })
  };
  const mcp = {
    async callTool(server, tool, args) {
      try { const j = await api('/api/tool', { method: 'POST', body: JSON.stringify({ tool, args }) }); return { payload: j.payload }; }
      catch (e) { throw { code: e.code === 'unavailable' ? 'server_unavailable' : 'failed', message: e.message }; }
    }
  };

  window.claude = { use: async (name) => { await authed; return name === 'db' ? db : name === 'user' ? user : name === 'mcp' ? mcp : null; } };
  document.addEventListener('DOMContentLoaded', () => { if (typeof ACT !== 'undefined') ACT.ftSignOut = () => window.ftSignOut(); });
  start();
})();
