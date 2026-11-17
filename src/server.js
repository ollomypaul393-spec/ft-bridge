import http from 'node:http';
import { handleRpc, notifyAll } from './mcp.js';
import { addDevice, recentAlerts } from './store.js';
import { page, serviceWorker, manifest, ICON_SVG } from './alerts-app.js';

const env = process.env;
const PORT = Number(env.PORT) || 10000;
const MAX_BODY = 1024 * 1024; // 1 MB
if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) console.warn('VAPID keys not set — push notifications are off. Run "npm run keys" and add them in Render.');
if (!env.ALERTS_KEY) console.warn('ALERTS_KEY not set — the FT Alerts app link is off.');

if (!env.BRIDGE_KEY || env.BRIDGE_KEY.length < 16) {
  console.error('BRIDGE_KEY must be set to a long random value (16+ characters). Refusing to start.');
  process.exit(1);
}

function send(res, status, body, headers = {}) {
  const isJson = body && typeof body === 'object';
  res.writeHead(status, { 'content-type': isJson ? 'application/json' : 'text/plain; charset=utf-8', ...headers });
  res.end(isJson ? JSON.stringify(body) : body ?? '');
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Render health check
  if (url.pathname === '/healthz') return send(res, 200, 'ok');

  // FT Alerts app (owner's phones / computers)
  const A = env.ALERTS_KEY && env.ALERTS_KEY.length >= 16 ? `/alerts/${env.ALERTS_KEY}` : null;
  if (A && (url.pathname === A || url.pathname.startsWith(A + '/'))) {
    const sub = url.pathname.slice(A.length) || '/';
    if (req.method === 'GET' && sub === '/') return send(res, 200, page(A, env.VAPID_PUBLIC_KEY || '', env.APP_URL || ''), { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    if (req.method === 'GET' && sub === '/sw.js') return send(res, 200, serviceWorker(A, env.APP_URL || ''), { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
    if (req.method === 'GET' && sub === '/manifest.webmanifest') return send(res, 200, manifest(A), { 'content-type': 'application/manifest+json' });
    if (req.method === 'GET' && sub === '/icon.svg') return send(res, 200, ICON_SVG, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=86400' });
    if (req.method === 'GET' && sub === '/feed') return send(res, 200, recentAlerts(), { 'cache-control': 'no-store' });
    if (req.method === 'POST' && (sub === '/register' || sub === '/test')) {
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 20000) return send(res, 413, 'Too large'); }
      try {
        if (sub === '/register') { const b = JSON.parse(raw || '{}'); const d = addDevice(b.subscription, b.label); return send(res, 200, { ok: true, label: d.label }); }
        const r = await notifyAll(env, { title: '🔔 FT Alerts test', body: 'Notifications are working on your devices.', tag: 'test' });
        return send(res, 200, r);
      } catch (e) { return send(res, 400, e.message); }
    }
    return send(res, 404, 'Not found');
  }

  if (url.pathname !== `/mcp/${env.BRIDGE_KEY}`) return send(res, 404, 'Not found');
  if (req.method === 'GET') return send(res, 405, 'FT Bridge is running. Use POST (MCP).', { Allow: 'POST' });
  if (req.method === 'DELETE') return send(res, 204, '');
  if (req.method !== 'POST') return send(res, 405, 'Method not allowed');

  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) return send(res, 413, 'Request too large');
    chunks.push(c);
  }
  let msg;
  try { msg = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  if (Array.isArray(msg)) return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch requests are not supported' } });

  try {
    const out = await handleRpc(env, msg);
    if (out === null) return send(res, 202, '');
    return send(res, 200, out);
  } catch (e) {
    console.error(e);
    return send(res, 500, { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32603, message: 'Internal error' } });
  }
});

server.listen(PORT, () => console.log(`FT Bridge listening on :${PORT}`));
