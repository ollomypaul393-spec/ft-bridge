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
  // opened through a company's own link (/ht, /ft) or own web address: that company, no picker
  const linkCo = (/^\/(ft|ht)\/?$/i.exec(location.pathname) || [])[1];
  const LOCK = (CFG.lockCompany || (linkCo ? linkCo.toLowerCase() : '')) || '';
  if (LOCK) { coId = LOCK; try { localStorage.setItem('ft-company', coId); } catch (e) {} }
  const coOf = (id) => COS.find((c) => c.id === id);
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
  box.innerHTML = `<div class="ftauth-card"><div id="ftAuthHead">${cardHead(window.FT_CO)}</div><div id="ftAuthBody"><p class="ftauth-msg">Loading…</p></div></div>`;
  const mount = () => { if (!box.isConnected) document.body.appendChild(box); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  const body = (h) => { mount(); box.classList.remove('gone'); document.getElementById('ftAuthBody').innerHTML = h; };

  function showSignIn(note) {
    body(`<p class="ftauth-msg">${note ? `<span class="ftauth-err">${esc(note)}</span><br>` : ''}Sign in with your Google account. You only do this once on each phone or computer — after that, workers open the app with their PIN.</p><div id="gbtn"></div><p class="ftauth-small">Workers: the owner must first add your Gmail to your staff profile.</p>`);
    renderGoogle();
  }
  function showDenied(email) {
    body(`<p class="ftauth-msg"><span class="ftauth-err">This Google account is not on the staff list yet.</span><br><b>${esc(email || '')}</b></p><p class="ftauth-small">Ask the owner to open <b>Staff</b> → your name → <b>Google email</b>, save this Gmail address there, then tap Try again.</p><div id="gbtn"></div>`);
    renderGoogle();
  }
  function showWaking(n) {
    body(`<p class="ftauth-msg"><span class="ftauth-spin"></span> Starting the shop server… ${n > 2 ? '<br><span class="ftauth-small">It sleeps when nobody has used it for a while — this takes up to a minute.</span>' : ''}</p>`);
  }
  let gTries = 0;
  function renderGoogle() {
    const el = document.getElementById('gbtn'); if (!el) return;
    const clientId = (CFG.googleClientIds || {})[coId || (window.FT_CO || {}).id] || CFG.googleClientId;
    if (!clientId) { el.innerHTML = '<p class="ftauth-err">Google sign-in is not set up on the server yet (GOOGLE_CLIENT_ID).</p>'; return; }
    if (!(window.google && google.accounts && google.accounts.id)) { if (gTries++ < 100) setTimeout(renderGoogle, 150); else el.innerHTML = '<p class="ftauth-err">Could not load Google sign-in. Check the internet and reload.</p>'; return; }
    google.accounts.id.initialize({ client_id: clientId, callback: onCredential, auto_select: false, ux_mode: 'popup' });
    el.innerHTML = ''; google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 260 });
  }
  async function onCredential(resp) {
    body('<p class="ftauth-msg"><span class="ftauth-spin"></span> Signing in…</p>');
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
  window.ftNextTicket = async () => (await api('/api/ticket', { method: 'POST' })).ticket;
  async function pickCompany() {
    let list = []; try { list = (await (await fetch('/api/me', { headers: { authorization: 'Bearer ' + token } })).json()).companies || []; } catch (e) {}
    body(`<p class="ftauth-msg">Which shop do you want to open?</p><div class="copick">${list.map((c) => `<button class="coopt" data-co="${esc(c.id)}" style="--c1:${esc(c.theme.nav)};--c2:${esc(c.theme.accent)}"><span class="cologo${c.logo ? ' img' : ''}">${c.logo ? `<img src="${esc(c.logo)}" alt="">` : esc(c.short)}</span><span><b>${esc(c.name)}</b><small>${c.role === 'admin' ? 'Admin' : 'Staff'}</small></span></button>`).join('')}</div><p class="ftauth-small">You can switch later from your profile picture menu.</p>`);
    document.querySelectorAll('.coopt').forEach((b) => (b.onclick = () => { coId = b.dataset.co; try { localStorage.setItem('ft-company', coId); } catch (e) {} applyTheme(coOf(coId)); const h = document.getElementById('ftAuthHead'); if (h) h.innerHTML = cardHead(coOf(coId)); start(); }));
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
