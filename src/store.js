/**
 * Notification devices + recent alerts, kept in the shop database (collections "_push" and "_alerts"),
 * so they survive restarts on Render's free plan. The app may also send its own copy of the device list.
 */
import crypto from 'node:crypto';
import { DocStore } from './db.js';

let docs = new DocStore(); // memory until the server hands over the real store
export function useDocs(d) { docs = d; }

const key = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
const valid = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth;
const save = (p) => p.catch((e) => console.error('Could not save:', e.message));

export function listDevices(d = docs) {
  return d.list('_push').map(({ id, ...d }) => d).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
}

export function addDevice(sub, label, d = docs) {
  if (!valid(sub)) throw new Error('Invalid push subscription');
  const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, label: String(label || 'Device').slice(0, 60), addedAt: Date.now() };
  save(d.put('_push', key(sub.endpoint), clean));
  return clean;
}

/** Merge devices the app sends along (its backup copy) into the store. */
export function mergeDevices(list, d = docs) {
  for (const s of Array.isArray(list) ? list : []) {
    if (valid(s) && !d.get('_push', key(s.endpoint))) {
      save(d.put('_push', key(s.endpoint), { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, label: String(s.label || 'Device').slice(0, 60), addedAt: s.addedAt || Date.now() }));
    }
  }
}

export function removeDevice(endpoint, d = docs) { if (d.get('_push', key(endpoint))) save(d.del('_push', key(endpoint))); }

export function addAlert(a, d = docs) {
  const list = [{ ...a, at: Date.now() }, ...((d.get('_alerts', 'recent') || {}).list || [])].slice(0, 60);
  save(d.put('_alerts', 'recent', { list }));
}
export function recentAlerts(d = docs) { return ((d.get('_alerts', 'recent') || {}).list || []).slice(0, 60); }
