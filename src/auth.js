/**
 * Sign-in for the standalone app.
 *  - Everyone signs in once with Google; the app then keeps a 1-year session on that device
 *    (workers unlock it with their PIN each time, inside the app).
 *  - Admins: Google emails listed in ADMIN_EMAILS.
 *  - Workers: allowed when their Gmail is saved on their staff profile (and the staff member is active),
 *    or when that Google account is already linked to an active staff member.
 * Access rules match the ones the app had inside Claude.
 */
import crypto from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64url');
const YEAR = 365 * 864e5;

/** Same inbox = same person: case, Gmail dots and +tags don't matter. */
export function sameEmail(e) {
  let x = String(e || '').trim().toLowerCase().replace(/^mailto:/, '').replace(/^["'<]+|["'>.,;]+$/g, '');
  const at = x.lastIndexOf('@'); if (at < 1) return x;
  let local = x.slice(0, at), dom = x.slice(at + 1);
  if (dom === 'gmail.com' || dom === 'googlemail.com') { local = local.split('+')[0].replace(/\./g, ''); dom = 'gmail.com'; }
  return local + '@' + dom;
}
export function adminEmails(env) {
  return String(env.ADMIN_EMAILS || '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase().replace(/^["']|["']$/g, '')).filter((x) => x.includes('@'));
}

export function makeToken(env, user, now = Date.now()) {
  const body = b64u(JSON.stringify({ uid: user.id, email: user.email, iat: now, exp: now + YEAR }));
  const sig = crypto.createHmac('sha256', env.SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readToken(env, token, now = Date.now()) {
  if (!token || typeof token !== 'string' || !env.SESSION_SECRET) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', env.SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > now ? p : null; } catch { return null; }
}

/** Checks a Google sign-in credential (ID token) with Google. */
export async function verifyGoogle(env, credential, fetchImpl = (...a) => globalThis.fetch(...a)) {
  if (!env.GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not set up on the server (GOOGLE_CLIENT_ID).');
  const r = await fetchImpl('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(credential || '')));
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.sub) throw new Error('Google sign-in failed. Please try again.');
  if (t.aud !== env.GOOGLE_CLIENT_ID) throw new Error('This sign-in was not made for this app.');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(t.iss)) throw new Error('Unknown sign-in issuer.');
  if (!(t.email_verified === true || t.email_verified === 'true')) throw new Error('Your Google email is not verified.');
  if (+t.exp * 1000 < Date.now()) throw new Error('Sign-in expired. Please try again.');
  return { id: 'g_' + t.sub, email: String(t.email).toLowerCase(), name: t.name || t.email, picture: t.picture || '' };
}

/** Works out what a signed-in Google account may do right now: 'admin', 'staff' or null. */
export function roleOf(env, docs, user) {
  if (!user) return null;
  const email = sameEmail(user.email);
  if (email.includes('@') && adminEmails(env).some((a) => sameEmail(a) === email)) return 'admin';
  const staff = docs.list('staff').filter((s) => s.active !== false);
  if (email.includes('@') && staff.some((s) => s.email && sameEmail(s.email) === email)) return 'staff';
  const link = docs.get('links', user.uid || user.id);
  if (link && staff.some((s) => s.id === link.staffId)) return 'staff';
  return null;
}

/* ---- rules (same as the app had in Claude) ---- */
const ADMIN_READ = new Set(['staffpay', 'expenses', 'invoices', 'reportlog']);
const ADMIN_WRITE = new Set(['settings', 'staff', 'staffpay', 'expenses', 'invoices', 'accounts', 'promos', 'suppliers', 'links', 'reportlog']);
const OWN_DOC = new Set(['links', 'reportlog']); // a worker may write their own document here

export const validColl = (c) => typeof c === 'string' && /^[a-z][a-z0-9_-]{0,40}$/i.test(c);
export const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 200 && !/[\/\\]/.test(id);

export function canRead(role, uid, coll, id) {
  if (!role || !validColl(coll) || coll.startsWith('_')) return false;
  if (role === 'admin') return true;
  if (coll === 'reportlog') return id === uid;
  return !ADMIN_READ.has(coll);
}
export function canReadColl(role, coll) {
  if (!role || coll.startsWith('_')) return false;
  return role === 'admin' || !ADMIN_READ.has(coll);
}
export function canWrite(role, uid, coll, id) {
  if (!role || !validColl(coll) || coll.startsWith('_')) return false;
  if (role === 'admin') return true;
  if (OWN_DOC.has(coll)) return id === uid;
  return !ADMIN_WRITE.has(coll);
}

const STAFF_TOOLS = new Set(['send_template', 'notify_owner', 'list_devices', 'check_setup']);
export const canUseTool = (role, tool) => role === 'admin' || (role === 'staff' && STAFF_TOOLS.has(tool));
