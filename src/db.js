/**
 * Document store for the shop app.
 * Every record is a JSON document in a collection (orders, customers, settings …), the same shape the
 * app used inside Claude. All documents are kept in memory for speed and live updates, and every write
 * is saved to Neon Postgres (DATABASE_URL) over Neon's HTTPS SQL endpoint — no driver package needed.
 * Without DATABASE_URL (local testing) it uses DATA_DIR/docs.json, or memory only.
 */
import fs from 'node:fs';
import path from 'node:path';

export function neonClient(databaseUrl, fetchImpl = (...a) => globalThis.fetch(...a)) {
  const u = new URL(databaseUrl);
  const endpoint = `https://${u.hostname}/sql`;
  return async function query(sql, params = []) {
    const r = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Neon-Connection-String': databaseUrl },
      body: JSON.stringify({ query: sql, params })
    });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = { message: text }; }
    if (!r.ok) throw new Error(`Database error (${r.status}): ${j.message || text}`.slice(0, 300));
    return j.rows || [];
  };
}

export class DocStore {
  constructor({ databaseUrl = '', dataDir = '', fetchImpl } = {}) {
    this.colls = new Map(); // coll -> Map(id -> data)
    this.listeners = new Set();
    this.query = databaseUrl ? neonClient(databaseUrl, fetchImpl) : null;
    this.file = !databaseUrl && dataDir ? path.join(dataDir, 'docs.json') : '';
    this.ready = false;
  }

  get kind() { return this.query ? 'neon' : this.file ? 'file' : 'memory'; }

  async init() {
    if (this.query) {
      await this.query(`CREATE TABLE IF NOT EXISTS ft_docs (
        coll text NOT NULL, id text NOT NULL, data jsonb NOT NULL, updated_at bigint NOT NULL,
        PRIMARY KEY (coll, id))`);
      const rows = await this.query('SELECT coll, id, data::text AS data FROM ft_docs');
      for (const r of rows) this.#set(r.coll, r.id, typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
    } else if (this.file && fs.existsSync(this.file)) {
      const all = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const [c, docs] of Object.entries(all)) for (const [id, d] of Object.entries(docs)) this.#set(c, id, d);
    }
    this.ready = true;
    return this;
  }

  #set(coll, id, data) { if (!this.colls.has(coll)) this.colls.set(coll, new Map()); this.colls.get(coll).set(id, data); }
  #saveFile() {
    if (!this.file) return;
    const out = {}; for (const [c, m] of this.colls) out[c] = Object.fromEntries(m);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(out)); fs.renameSync(this.file + '.tmp', this.file);
  }

  get(coll, id) { const d = this.colls.get(coll)?.get(id); return d === undefined ? null : structuredClone(d); }
  list(coll) { return [...(this.colls.get(coll) || new Map())].map(([id, d]) => ({ ...structuredClone(d), id })); }
  collections() { return [...this.colls.keys()]; }

  async put(coll, id, data) {
    const clean = JSON.parse(JSON.stringify(data ?? {}));
    delete clean.id;
    if (this.query) await this.query(
      `INSERT INTO ft_docs (coll, id, data, updated_at) VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (coll, id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [coll, id, JSON.stringify(clean), Date.now()]);
    this.#set(coll, id, clean); this.#saveFile();
    this.#emit({ coll, id, data: clean });
    return clean;
  }

  async del(coll, id) {
    if (this.query) await this.query('DELETE FROM ft_docs WHERE coll = $1 AND id = $2', [coll, id]);
    this.colls.get(coll)?.delete(id); this.#saveFile();
    this.#emit({ coll, id, data: null });
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  #emit(ev) { for (const fn of this.listeners) { try { fn(ev); } catch (e) { console.error(e); } } }
}

/* short-lived locks so two open devices don't send the same alert twice */
const leases = new Map();
export function acquireLease(key, holder, ttlMs = 20000) {
  const now = Date.now(); const l = leases.get(key);
  if (l && l.until > now && l.holder !== holder) return { acquired: false };
  leases.set(key, { holder, until: now + Math.min(Math.max(+ttlMs || 20000, 1000), 120000) });
  if (leases.size > 5000) for (const [k, v] of leases) if (v.until < now) leases.delete(k);
  return { acquired: true };
}
