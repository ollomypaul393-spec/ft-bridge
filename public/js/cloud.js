'use strict';
/* =====================================================================================
   Fast Technology — standalone connection to your own server (Render + Neon).
   Gives the app the same data / user / messaging features it had inside Claude:
   live-synced shared database, who is signed in (Google), and sending (push, WhatsApp, email).
   ===================================================================================== */
(function () {
  const CFG = window.FT_CONFIG || {};
  const TK = 'ft-session';
  let token = ''; try { token = localStorage.getItem(TK) || ''; } catch (e) {}
  let me = null, authResolve;
  const authed = new Promise((r) => (authResolve = r));
  window.FT_STANDALONE = true;

  /* ---------------- sign-in screen ---------------- */
  const box = document.createElement('div');
  box.id = 'ftAuth';
  box.innerHTML = `<div class="ftauth-card"><div class="ftauth-logo">FT</div><h1><b>Fast Technology</b> Dry Cleaner</h1><div id="ftAuthBody"><p class="ftauth-msg">Loading…</p></div></div>`;
  const mount = () => { if (!box.isConnected) document.body.appendChild(box); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  const body = (h) => { mount(); box.classList.remove('gone'); document.getElementById('ftAuthBody').innerHTML = h; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    if (!CFG.googleClientId) { el.innerHTML = '<p class="ftauth-err">Google sign-in is not set up on the server yet (GOOGLE_CLIENT_ID).</p>'; return; }
    if (!(window.google && google.accounts && google.accounts.id)) { if (gTries++ < 100) setTimeout(renderGoogle, 150); else el.innerHTML = '<p class="ftauth-err">Could not load Google sign-in. Check the internet and reload.</p>'; return; }
    google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: onCredential, auto_select: false, ux_mode: 'popup' });
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
    try { r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token } }); }
    catch (e) { throw { code: 'unavailable', message: 'No connection to the shop server. Check the internet.' }; }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { signOut('Please sign in again.'); throw { code: 'unauthenticated', message: j.error }; }
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
  window.ftSignOut = () => { if (confirm('Sign out of this device? You will need to sign in with Google again.')) signOut(); };

  async function start() {
    if (!token) return showSignIn();
    for (let n = 0; ; n++) {
      try {
        me = await api('/api/me'); window.FT_ME = me;
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
    es = new EventSource('/api/stream?t=' + encodeURIComponent(token));
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
