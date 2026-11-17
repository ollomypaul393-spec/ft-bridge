/**
 * Notification devices + recent alerts. Saved to DATA_DIR/store.json when DATA_DIR is set
 * (a Render disk); otherwise kept in memory. The app also keeps a copy of the device list and
 * sends it with every notify_owner call, so alerts keep working after a restart either way.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.DATA_DIR || '';
const file = dir ? path.join(dir, 'store.json') : '';
let data = { devices: [], alerts: [] };

try { if (file && fs.existsSync(file)) data = { devices: [], alerts: [], ...JSON.parse(fs.readFileSync(file, 'utf8')) }; }
catch (e) { console.error('Could not read store:', e.message); }

function save() {
  if (!file) return;
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file); }
  catch (e) { console.error('Could not save store:', e.message); }
}

const valid = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth;

export function listDevices() { return data.devices.map((d) => ({ ...d })); }

export function addDevice(sub, label) {
  if (!valid(sub)) throw new Error('Invalid push subscription');
  const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, label: String(label || 'Device').slice(0, 60), addedAt: Date.now() };
  data.devices = [...data.devices.filter((d) => d.endpoint !== sub.endpoint), clean].slice(-30);
  save();
  return clean;
}

/** Merge devices the app sends along (its backup copy) into the store. */
export function mergeDevices(list) {
  let changed = false;
  for (const s of Array.isArray(list) ? list : []) {
    if (valid(s) && !data.devices.some((d) => d.endpoint === s.endpoint)) {
      data.devices.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, label: String(s.label || 'Device').slice(0, 60), addedAt: s.addedAt || Date.now() });
      changed = true;
    }
  }
  if (changed) { data.devices = data.devices.slice(-30); save(); }
}

export function removeDevice(endpoint) { const n = data.devices.length; data.devices = data.devices.filter((d) => d.endpoint !== endpoint); if (n !== data.devices.length) save(); }

export function addAlert(a) { data.alerts = [{ ...a, at: Date.now() }, ...data.alerts].slice(0, 60); save(); }
export function recentAlerts() { return data.alerts.slice(0, 60); }
