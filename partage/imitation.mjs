// Imitation de Cloudflare (D1 par node:sqlite, R2 par une Map, cache inactif) pour les tests et le serveur local d'essai.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function d1() {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const st = (sql, args = []) => ({
    bind: (...a) => st(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
  });
  return { prepare: sql => st(sql), batch: async l => { db.exec('BEGIN'); try { for (const s of l) await s.run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } }, _db: db };
}
export function r2() {
  const m = new Map();
  return { m, put: async (k, v) => m.set(k, Buffer.from(v)), get: async k => m.has(k) ? { body: new Blob([m.get(k)]).stream(), arrayBuffer: async () => m.get(k).buffer.slice(m.get(k).byteOffset, m.get(k).byteOffset + m.get(k).length) } : null, delete: async ks => [].concat(ks).forEach(k => m.delete(k)) };
}
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
export const envTest = (o = {}) => ({ DB: d1(), LOTS: r2(), ADMIN_JETON: 'jeton-admin-test', VERIF_ADMIN_SEULE: 'true', LOTS_PAR_JOUR_NOUVEAU: '3', LOTS_PAR_JOUR: '80', LOTS_PAR_JOUR_TOTAL: '4000', ...o });
