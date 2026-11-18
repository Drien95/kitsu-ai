// Tests du serveur de la base commune, sans Cloudflare : D1 imite par node:sqlite, R2 par une Map, cache par rien.
//   node partage/tests.mjs
import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import worker from './src/index.js';
import { verifierLot, ecarts, cleTrioDe } from '../moteur/lib/partage-format.mjs';
import { construireLot } from '../moteur/lib/partage.mjs';

import { d1, r2, envTest } from './imitation.mjs';
const env = envTest();
const ctx = { waitUntil() {} };
const appel = async (methode, chemin, { cle, admin, corps, gz } = {}) => {
  const h = {}; if (cle) h['x-kitsu-cle'] = cle; if (admin) h['x-kitsu-admin'] = admin;
  const body = corps === undefined ? undefined : gz ? corps : JSON.stringify(corps);
  if (body) h['content-length'] = String(body.length);
  const r = await worker.fetch(new Request('https://x' + chemin, { method: methode, headers: h, body }), env, ctx);
  const t = r.headers.get('content-type') || ''; return { s: r.status, j: t.includes('json') ? await r.json() : null, r };
};

// ---------- donnees ----------
const V = { sigG: 'abc123', wKey: 'w9', moteur: 'DwQhSrQR' };
const carte = (id, st = 0) => [id, 99, st, [], 's' + id];
const items = n => Array.from({ length: n }, (_, i) => ({ cartes: [carte(10 + (i % 7)), carte(30 + (i % 5)), carte(50)], di: i % 3, pi: i % 9, clePaquet: 'p' + (i % 3) + 'x' + (i % 9), graine: 1 + (i % 3), n: 16, s3: i % 17 }));
// Les items generes plus haut se repetent (trio, paquet, graine) : on dedoublonne comme le ferait le calcul.
const uniques = l => { const v = new Set(); return l.filter(x => { const k = cleTrioDe(x.cartes) + x.di + x.pi + x.graine; if (v.has(k)) return false; v.add(k); return true; }); };
const vrai = it => [it.n, it.s3];
const A = randomBytes(32).toString('hex'), B = randomBytes(32).toString('hex'), C = randomBytes(32).toString('hex');
let ok = 0; const test = async (nom, f) => { await f(); ok++; console.log('ok  ' + nom); };

await test('format : lot construit valide, lot trafique refuse', async () => {
  const lot = construireLot(V, uniques(items(300)));
  assert.equal(verifierLot(lot), null);
  assert.ok(verifierLot({ ...lot, paq: 8 }));
  assert.ok(verifierLot({ ...lot, l: [[0, 0, 4, 16, 3]] }), 'graine hors de 1..3');
  assert.ok(verifierLot({ ...lot, l: [[0, 0, 1, 16, 17]] }), '3 etoiles > combats');
  assert.ok(verifierLot({ ...lot, l: [...lot.l, lot.l[0]] }), 'ligne en double');
  assert.ok(verifierLot({ ...lot, t: [[carte(1), carte(1), carte(2)]], l: [[0, 0, 1, 1, 1]] }), 'trio en double');
  assert.ok(verifierLot({ ...lot, t: [[[1, 99, 0, ['x'.repeat(65)], 'a'], carte(2), carte(3)]], l: [[0, 0, 1, 1, 1]] }), 'collectif trop long');
  assert.ok(verifierLot(JSON.parse('{"__proto__":{"f":1}}')));
});

let idA, idA2, lotA;
await test('envoi : accepte, puis meme lot reconnu, quota des nouveaux IDs', async () => {
  const its = uniques(items(400)); lotA = construireLot(V, its);
  const z = gzipSync(JSON.stringify(lotA));
  let r = await appel('POST', '/v1/lots', { cle: A, corps: z, gz: true }); assert.equal(r.s, 200, JSON.stringify(r.j)); idA = r.j.id;
  r = await appel('POST', '/v1/lots', { cle: A, corps: z, gz: true }); assert.equal(r.j.deja, true);
  r = await appel('POST', '/v1/lots', { cle: A, corps: gzipSync(JSON.stringify(construireLot(V, its.slice(1)))), gz: true }); idA2 = r.j.id; assert.equal(r.s, 200);
  await appel('POST', '/v1/lots', { cle: A, corps: gzipSync(JSON.stringify(construireLot(V, its.slice(2)))), gz: true });
  r = await appel('POST', '/v1/lots', { cle: A, corps: gzipSync(JSON.stringify(construireLot(V, its.slice(3)))), gz: true }); assert.equal(r.s, 429);
});

await test('envoi : sans cle, illisible, bombe de decompression, lot invalide', async () => {
  assert.equal((await appel('POST', '/v1/lots', { corps: gzipSync('{}'), gz: true })).s, 401);
  assert.equal((await appel('POST', '/v1/lots', { cle: B, corps: Buffer.from('pas du gzip'), gz: true })).s, 400);
  assert.equal((await appel('POST', '/v1/lots', { cle: B, corps: gzipSync(' '.repeat(2e7)), gz: true })).s, 400);
  const r = await appel('POST', '/v1/lots', { cle: B, corps: gzipSync(JSON.stringify({ ...lotA, wKey: 'MAJ' })), gz: true }); assert.equal(r.s, 400); assert.match(r.j.err, /signature/);
});

await test('manifeste et telechargement : lot en attente visible, marque comme tel', async () => {
  const r = await appel('GET', `/v1/manifeste?sigG=${V.sigG}&wKey=${V.wKey}`); assert.equal(r.j.lots.length, 3); assert.ok(r.j.lots.every(x => x.statut === 'attente'));
  const l = await appel('GET', '/v1/lots/' + idA); assert.equal(l.s, 200);
  assert.equal((await appel('GET', '/v1/lots/zz')).s, 400);
});

await test('controle honnete par un joueur ordinaire : compte, mais ne suffit pas (validateur admin seul)', async () => {
  const m = (await appel('POST', '/v1/missions', { cle: B, corps: V })).j; assert.ok(m.mission); assert.equal(m.indices.length, 24);
  const lot = m.lot === idA ? lotA : null; const L = lot || JSON.parse((await import('node:zlib')).gunzipSync(env.LOTS.m.get('lots/' + m.lot)));
  const res = m.indices.map(i => [L.l[i][3], L.l[i][4]]);
  const r = (await appel('POST', '/v1/missions/' + m.mission, { cle: B, corps: { resultats: res } })).j; assert.equal(r.ecarts, 0); assert.equal(r.decision, 'controle compte');
  assert.equal((await appel('POST', '/v1/missions/' + m.mission, { cle: B, corps: { resultats: res } })).s, 404, 'mission a usage unique');
});

await test('on ne controle jamais son propre lot ; mission d un autre refusee', async () => {
  const m = (await appel('POST', '/v1/missions', { cle: A, corps: V })).j; assert.equal(m.mission, null);
  const m2 = (await appel('POST', '/v1/missions', { cle: B, corps: V })).j;
  assert.ok([401, 404].includes((await appel('POST', '/v1/missions/' + m2.mission, { cle: C, corps: { resultats: [] } })).s));
});

await test('controle admin juste : le lot passe a verifie, l envoyeur gagne en credit', async () => {
  const m = (await appel('POST', '/v1/missions', { admin: env.ADMIN_JETON, corps: V })).j;
  const L = JSON.parse((await import('node:zlib')).gunzipSync(env.LOTS.m.get('lots/' + m.lot)));
  const r = (await appel('POST', '/v1/missions/' + m.mission, { admin: env.ADMIN_JETON, corps: { resultats: m.indices.map(i => [L.l[i][3], L.l[i][4]]) } })).j;
  assert.equal(r.decision, 'verifie');
  const moi = (await appel('GET', '/v1/moi', { cle: A })).j; assert.equal(moi.cred, 1);
});

await test('faux controle d un joueur, puis l admin tranche : le menteur est ecarte', async () => {
  const m = (await appel('POST', '/v1/missions', { cle: C, corps: V })).j;
  const r = (await appel('POST', '/v1/missions/' + m.mission, { cle: C, corps: { resultats: m.indices.map(() => [16, 0]) } })).j; assert.equal(r.decision, 'conteste, en attente du controle admin');
  const ma = (await appel('POST', '/v1/missions', { admin: env.ADMIN_JETON, corps: V })).j; assert.equal(ma.lot, m.lot, 'le lot conteste passe en premier');
  const L = JSON.parse((await import('node:zlib')).gunzipSync(env.LOTS.m.get('lots/' + ma.lot)));
  await appel('POST', '/v1/missions/' + ma.mission, { admin: env.ADMIN_JETON, corps: { resultats: ma.indices.map(i => [L.l[i][3], L.l[i][4]]) } });
  assert.equal((await appel('GET', '/v1/moi', { cle: C })).j.ecarte, true);
  assert.equal((await appel('POST', '/v1/lots', { cle: C, corps: gzipSync(JSON.stringify(lotA)), gz: true })).s, 403);
});

await test('lot truque : l admin le voit, TOUT le travail de l envoyeur est retire', async () => {
  const D = randomBytes(32).toString('hex'), its = uniques(items(400).map(x => ({ ...x, cartes: [carte(70), carte(71), carte(72 + (x.pi % 2))] })));
  const faux = construireLot(V, its), juste = JSON.parse(JSON.stringify(faux)); faux.l.forEach(l => { l[4] = l[3]; }); // 3 etoiles partout
  const id1 = (await appel('POST', '/v1/lots', { cle: D, corps: gzipSync(JSON.stringify(juste)), gz: true })).j.id;
  const r2_ = await appel('POST', '/v1/lots', { cle: D, corps: gzipSync(JSON.stringify(faux)), gz: true }); const id2 = r2_.j.id; assert.ok(id1 && id2, JSON.stringify(r2_.j));
  let m; do { m = (await appel('POST', '/v1/missions', { admin: env.ADMIN_JETON, corps: V })).j; if (m.lot !== id2) { const L = JSON.parse((await import('node:zlib')).gunzipSync(env.LOTS.m.get('lots/' + m.lot))); await appel('POST', '/v1/missions/' + m.mission, { admin: env.ADMIN_JETON, corps: { resultats: m.indices.map(i => [L.l[i][3], L.l[i][4]]) } }); } } while (m.lot !== id2);
  const r = (await appel('POST', '/v1/missions/' + m.mission, { admin: env.ADMIN_JETON, corps: { resultats: m.indices.map(i => [juste.l[i][3], juste.l[i][4]]) } })).j;
  assert.ok(r.ecarts > 0); assert.equal(r.decision, 'envoyeur ecarte');
  const man = (await appel('GET', `/v1/manifeste?sigG=${V.sigG}&wKey=${V.wKey}`)).j.lots.map(x => x.id);
  assert.ok(!man.includes(id1) && !man.includes(id2), 'meme son lot juste est retire');
  assert.equal((await appel('GET', '/v1/lots/' + id1)).s, 404);
});

await test('supprimer mes envois : lots, fichiers et ID effaces', async () => {
  const avant = env.LOTS.m.size, r = (await appel('DELETE', '/v1/moi', { cle: A })).j; assert.equal(r.supprime, 3);
  assert.equal(env.LOTS.m.size, avant - 3); assert.equal((await appel('GET', '/v1/moi', { cle: A })).j.connu, false);
});

await test('comparaison des controles', async () => {
  const lot = { l: [[0, 0, 1, 16, 4], [0, 0, 2, 16, 5]] };
  assert.equal(ecarts(lot, [0, 1], [[16, 4], [16, 5]]), 0); assert.equal(ecarts(lot, [0, 1], [[16, 4], [16, 6]]), 1); assert.equal(ecarts(lot, [0, 1], [[16, 4]]), 2); assert.equal(ecarts(lot, [0, 1], 'x'), 2);
});
console.log(`${ok} tests passes`);
