/**
 * FT Bridge — MCP tools that send WhatsApp messages (Meta WhatsApp Cloud API)
 * and emails (Brevo) for the Fast Technology Dry Cleaner app.
 *
 * Environment (set in Render → Environment):
 *   BRIDGE_KEY      long random password; part of the connector URL (/mcp/<BRIDGE_KEY>)
 *   BREVO_API_KEY   Brevo → SMTP & API → API keys
 *   MAIL_FROM       a sender email verified in Brevo (e.g. alerts@yourshop.co.tz)
 *   MAIL_FROM_NAME  optional, default "Fast Technology Dry Cleaner"
 *   WA_TOKEN        Meta permanent System User token (whatsapp_business_messaging)
 *   WA_PHONE_ID     Meta "Phone number ID"
 *   GRAPH_VERSION   optional, default v23.0
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   push notification keys (npm run keys)
 *   ALERTS_KEY      long random password for the FT Alerts app link (/alerts/<ALERTS_KEY>)
 *   APP_URL         optional: the shop app link to open when a notification is tapped
 *   DATA_DIR        optional: folder on a Render disk to remember devices across restarts
 * WhatsApp and email are independent: leave a service's variables empty to switch it off.
 */

import { sendPush } from './push.js';
import { listDevices, mergeDevices, removeDevice, addAlert } from './store.js';

export const TOOLS = [
  {
    name: 'send_template',
    description: 'Send an approved WhatsApp template message (receipts, ready messages, reminders, owner alerts).',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Phone in international format, digits only, e.g. 255712345678' },
        template: { type: 'string', description: 'Approved template name' },
        language: { type: 'string', description: 'Template language code, e.g. en or sw', default: 'en' },
        params: { type: 'array', items: { type: 'string' }, description: 'Values for {{1}}, {{2}}, … in order' }
      },
      required: ['to', 'template']
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'send_text',
    description: 'Send a free-text WhatsApp message (Meta only delivers it within 24 h of the recipient last messaging you).',
    inputSchema: {
      type: 'object',
      properties: { to: { type: 'string' }, text: { type: 'string' } },
      required: ['to', 'text']
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'send_email',
    description: 'Send an email through Brevo.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email; several can be separated by commas' },
        subject: { type: 'string' },
        html: { type: 'string', description: 'HTML body' },
        text: { type: 'string', description: 'Plain-text body (used if html is empty)' }
      },
      required: ['to', 'subject']
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'notify_owner',
    description: 'Send a push notification to every phone/computer that turned on FT Alerts (payments, failed spot checks).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        url: { type: 'string', description: 'Page to open when the notification is tapped' },
        tag: { type: 'string', description: 'Notifications with the same tag replace each other' },
        urgent: { type: 'boolean', description: 'Keep the notification on screen until tapped' },
        subscriptions: { type: 'array', items: { type: 'object' }, description: 'Backup copy of the device list kept by the app' }
      },
      required: ['title']
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'list_devices',
    description: 'List the devices that turned on FT Alerts notifications.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'check_setup',
    description: 'Check which services are configured and reachable (WhatsApp sending number, Brevo account).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true }
  }
];

const cleanParam = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 1000) || '-';
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 9 || d.length > 15) throw new Error('Invalid phone number: use international format like 255712345678');
  return d;
}

async function readJson(res) { try { return await res.json(); } catch { return {}; } }

async function graph(env, path, init = {}) {
  if (!env.WA_TOKEN || !env.WA_PHONE_ID) throw new Error('WhatsApp is not configured on the bridge (WA_TOKEN / WA_PHONE_ID)');
  const v = env.GRAPH_VERSION || 'v23.0';
  const res = await fetch(`https://graph.facebook.com/${v}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) }
  });
  const body = await readJson(res);
  if (!res.ok || body.error) {
    const e = body.error || {};
    const err = new Error(e.error_user_msg || e.message || `Meta returned HTTP ${res.status}`);
    err.meta = { code: e.code, subcode: e.error_subcode };
    throw err;
  }
  return body;
}

async function brevo(env, path, init = {}) {
  if (!env.BREVO_API_KEY) throw new Error('Email is not configured on the bridge (BREVO_API_KEY)');
  const res = await fetch(`https://api.brevo.com/v3/${path}`, {
    ...init,
    headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json', ...(init.headers || {}) }
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(body.message || `Brevo returned HTTP ${res.status}`);
  return body;
}

const vapidOf = (env) => ({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || (env.MAIL_FROM ? 'mailto:' + env.MAIL_FROM : 'mailto:admin@example.com') });

export async function notifyAll(env, { title, body = '', url = '', tag = '', urgent = false, subscriptions = [] }) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error('Notifications are not configured on the bridge (VAPID keys)');
  mergeDevices(subscriptions);
  const devices = listDevices();
  if (!devices.length) throw new Error('No phone or computer has turned on FT Alerts yet');
  const payload = { title: String(title).slice(0, 120), body: String(body).slice(0, 400), url: url || env.APP_URL || '', tag: tag || undefined, urgent: !!urgent };
  let sent = 0; const removed = []; const errors = [];
  await Promise.all(devices.map(async (d) => {
    try {
      const r = await sendPush(d, payload, vapidOf(env));
      if (r.ok) sent++;
      else if (r.gone) { removeDevice(d.endpoint); removed.push(d.endpoint); }
      else errors.push(`${d.label}: HTTP ${r.status}`);
    } catch (e) { errors.push(`${d.label}: ${e.message}`); }
  }));
  addAlert({ title: payload.title, body: payload.body });
  if (!sent) throw new Error(errors[0] || 'No device accepted the notification');
  return { ok: true, channel: 'push', sent, failed: errors.length, removed, devices: devices.length - removed.length, list: listDevices() };
}

export async function callTool(env, name, args = {}) {
  if (name === 'notify_owner') return notifyAll(env, args);
  if (name === 'list_devices') return { ok: true, devices: listDevices() };
  if (name === 'send_template') {
    const to = cleanPhone(args.to);
    if (!args.template) throw new Error('template is required');
    const params = Array.isArray(args.params) ? args.params : [];
    const r = await graph(env, `${env.WA_PHONE_ID}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: String(args.template), language: { code: String(args.language || 'en') },
          ...(params.length ? { components: [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: cleanParam(t) })) }] } : {})
        }
      })
    });
    return { ok: true, channel: 'whatsapp', id: r.messages?.[0]?.id || null, to };
  }
  if (name === 'send_text') {
    const to = cleanPhone(args.to);
    const text = String(args.text || '').slice(0, 4096);
    if (!text) throw new Error('text is required');
    const r = await graph(env, `${env.WA_PHONE_ID}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } })
    });
    return { ok: true, channel: 'whatsapp', id: r.messages?.[0]?.id || null, to };
  }
  if (name === 'send_email') {
    const to = String(args.to || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    if (!to.length || !to.every((x) => emailRe.test(x))) throw new Error('Invalid recipient email');
    if (!args.subject) throw new Error('subject is required');
    if (!env.MAIL_FROM) throw new Error('MAIL_FROM (a Brevo-verified sender) is not set on the bridge');
    const html = String(args.html || '');
    const text = String(args.text || '');
    if (!html && !text) throw new Error('html or text is required');
    const r = await brevo(env, 'smtp/email', {
      method: 'POST',
      body: JSON.stringify({
        sender: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME || 'Fast Technology Dry Cleaner' },
        to: to.map((email) => ({ email })),
        subject: String(args.subject).slice(0, 250),
        ...(html ? { htmlContent: html } : {}),
        ...(text ? { textContent: text } : {})
      })
    });
    return { ok: true, channel: 'email', id: r.messageId || null, to: to.join(', ') };
  }
  if (name === 'check_setup') {
    const out = { ok: true, whatsapp: null, email: null };
    try {
      const r = await graph(env, `${env.WA_PHONE_ID}?fields=display_phone_number,verified_name,quality_rating`, { method: 'GET' });
      out.whatsapp = { ok: true, phone: r.display_phone_number, name: r.verified_name, quality: r.quality_rating };
    } catch (e) { out.whatsapp = { ok: false, error: e.message }; }
    try {
      const r = await brevo(env, 'account', { method: 'GET' });
      out.email = { ok: !!env.MAIL_FROM, from: env.MAIL_FROM || null, account: r.email || r.companyName || 'connected', ...(env.MAIL_FROM ? {} : { error: 'MAIL_FROM not set' }) };
    } catch (e) { out.email = { ok: false, error: e.message }; }
    out.push = { ok: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY), devices: listDevices().length };
    out.ok = !!(out.whatsapp?.ok || out.email?.ok || out.push.ok);
    // Keep the older flat fields for the app's "Check connection" display
    if (out.whatsapp?.ok) Object.assign(out, { phone: out.whatsapp.phone, name: out.whatsapp.name, quality: out.whatsapp.quality });
    return out;
  }
  throw new Error(`Unknown tool: ${name}`);
}

const toolResult = (data, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError });

/** Handle one JSON-RPC message. Returns null for notifications (no response body). */
export async function handleRpc(env, msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } };
  const { id, method, params } = msg;
  if (id === undefined || id === null) return null;
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ft-bridge', version: '2.1.0' },
        instructions: 'Sends push notifications (FT Alerts), WhatsApp (Meta Cloud API) and email (Brevo) for Fast Technology Dry Cleaner.'
      });
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS });
    case 'tools/call':
      try { return ok(toolResult(await callTool(env, params?.name, params?.arguments || {}))); }
      catch (e) { return ok(toolResult({ ok: false, error: e.message, meta: e.meta || null }, true)); }
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}
