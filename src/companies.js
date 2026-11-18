/**
 * The companies this one server runs. Each has its own data, staff, tickets, colours, WhatsApp number,
 * notification devices and daily report — kept apart in the same database by a name prefix.
 * Fast Technology keeps the original (unprefixed) data so nothing already saved has to move.
 *
 * Per-company settings on Render (High Technology falls back to Fast Technology's when not set):
 *   ADMIN_EMAILS / ADMIN_EMAILS_HT     who opens that company as Admin
 *   WA_PHONE_ID  / WA_PHONE_ID_HT      the WhatsApp number receipts come from
 *   WA_TOKEN     / WA_TOKEN_HT         only if High Technology uses a different Meta business
 */
import { DocStore } from './db.js';

export const COMPANIES = [
  {
    id: 'ft', short: 'FT', name: 'Fast Technology Dry Cleaner', brand: 'Fast Technology', tagline: '', prefix: '', alerts: 'FT Alerts', logo: '', logoFull: '', icon: '',
    theme: { nav: '#0e0e0e', accent: '#c9a227', accentLt: '#e6c65c', accentDk: '#b8921f', gold: '#d4af37', soft: '#f8f0d8', link: '#8a6a12', ink: '#111111', bg: '#f7f6f2', line: '#e8e4da' }
  },
  {
    id: 'ht', short: 'HT', name: 'High Technology Laundry & Dry Cleaners', brand: 'High Technology', tagline: 'Your clothes, Our Care.', prefix: 'ht__', alerts: 'HT Alerts',
    logo: '/brand/ht-mark.png', logoFull: '/brand/ht-logo.png', icon: '/brand/ht-icon.png',
    // colours taken from the logo: blue #0368BA, orange #EE7C23
    theme: { nav: '#02508f', nav2: '#0368ba', nav3: '#1c7fd0', accent: '#ee7c23', accentLt: '#ff9d4d', accentDk: '#c9620f', gold: '#ffa65c', soft: '#fff1e5', link: '#0368ba', ink: '#ffffff', bg: '#f3f7fc', line: '#dde7f3' }
  }
];
export const byId = (id) => COMPANIES.find((c) => c.id === id) || null;
export const publicInfo = (c) => ({ id: c.id, short: c.short, name: c.name, brand: c.brand, tagline: c.tagline, logo: c.logo, logoFull: c.logoFull, icon: c.icon, theme: c.theme });

/** Settings for one company: its own values where given, otherwise the shared ones. */
export function envFor(env, c) {
  if (!c.prefix) return env;
  const S = '_' + c.id.toUpperCase();
  const pick = (k) => (env[k + S] !== undefined && env[k + S] !== '' ? env[k + S] : env[k]);
  return { ...env, ADMIN_EMAILS: pick('ADMIN_EMAILS'), WA_PHONE_ID: env['WA_PHONE_ID' + S] || '', WA_TOKEN: pick('WA_TOKEN'), MAIL_FROM_NAME: env['MAIL_FROM_NAME' + S] || c.name };
}

/** One company's view of the shared database: same API as DocStore, names prefixed underneath. */
export class Scoped {
  constructor(base, c) { this.base = base; this.c = c; this.pre = c.prefix; }
  mine(coll) {
    if (this.pre) return coll.startsWith(this.pre);
    return !COMPANIES.some((x) => x.prefix && coll.startsWith(x.prefix));
  }
  get kind() { return this.base.kind; }
  get(coll, id) { return this.base.get(this.pre + coll, id); }
  list(coll) { return this.base.list(this.pre + coll); }
  put(coll, id, data) { return this.base.put(this.pre + coll, id, data); }
  del(coll, id) { return this.base.del(this.pre + coll, id); }
  collections() { return this.base.collections().filter((x) => this.mine(x)).map((x) => x.slice(this.pre.length)); }
  on(fn) { return this.base.on((ev) => { if (this.mine(ev.coll)) fn({ ...ev, coll: ev.coll.slice(this.pre.length) }); }); }
}
export const scopeAll = (base) => new Map(COMPANIES.map((c) => [c.id, new Scoped(base, c)]));
export { DocStore };

/** Re-colours and re-names a page written in Fast Technology's look for another company. */
export function brandify(html, c) {
  if (!c || c.id === 'ft') return html;
  const t = c.theme, F = COMPANIES[0].theme, base = c.brand || c.name;
  let out = String(html);
  if (c.logo) { // real logo picture instead of the letters
    out = out.split('<div class="logo">FT</div>').join(`<div class="logo logo-img"><img src="${c.logo}" alt="${c.short}"></div>`)
      .replace('</style>', '.logo-img{background:#fff!important;padding:3px}.logo-img img{width:100%;height:100%;object-fit:contain;display:block}</style>');
  }
  if (c.icon) out = out.replace(/[^"'`\s(]*\/icon\.svg/g, c.icon).split("type: 'image/svg+xml'").join("type: 'image/png'").split('"image/svg+xml"').join('"image/png"');
  const pairs = [['Fast Technology Dry Cleaner', c.name], [F.nav, t.nav], [F.accentLt, t.accentLt], [F.accentDk, t.accentDk], [F.accent, t.accent], [F.gold, t.gold], [F.soft, t.soft], [F.link, t.link], ['#faf7ec', t.soft], ['#2a2414', t.nav2 || t.nav], ['#3a3220', t.nav3 || t.nav], ['#6b5520', t.accentDk], ['#f1dfa4', t.accentLt],
    ['FT Alerts', c.alerts], ['Fast Technology', base], ['>FT<', `>${c.short}<`], ["'FT'", `'${c.short}'`]];
  for (const [a, b] of pairs) out = out.split(a).join(b).split(a.toUpperCase()).join(b.toUpperCase ? b.toUpperCase() : b);
  return out;
}
