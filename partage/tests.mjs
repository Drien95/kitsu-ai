// Tests du serveur de la base commune et de son client, sans Cloudflare : D1 imite par node:sqlite, cache par rien,
// fetch du client branche directement sur le serveur.
//   node partage/tests.mjs
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const DATA = mkdtempSync(path.join(tmpdir(), 'kitsu-partage-')); process.env.KITSU_DATA = DATA;
const worker = (await import('./src/index.js')).default;
const { verifierLot, ecarts, cleTrioDe, cartesDuLot, decoderCartes, fusionner, VERSION_SERVEUR } = await import('../moteur/lib/partage-format.mjs');
const P = await import('../moteur/lib/partage.mjs');
const { envTest } = await import('./imitation.mjs');

const env = envTest(), ctx = { waitUntil() {} };
globalThis.fetch = async (url, o = {}) => worker.fetch(new Request(url, { method: o.method, headers: o.headers, body: o.body }), env, ctx);
const REG = { url: 'https://x', utiliser: true, envoyer: true, verifier: true };
// Le client lit son identite dans data/partage.json : on change de joueur en reecrivant ce fichier.
const comme = (cle, admin) => { mkdirSync(path.join(DATA, 'data'), { recursive: true }); writeFileSync(path.join(DATA, 'data', 'partage.json'), JSON.stringify({ cle, ...(admin ? { admin } : {}) })); };
const lireLotTest = async id => JSON.parse(gunzipSync(Buffer.from(await (await worker.fetch(new Request('https://x/v1/lots/' + id), env, ctx)).arrayBuffer())));
const blocs = () => env.DB._db.prepare('SELECT COUNT(*) AS n FROM blocs').get().n;
const statut = id => env.DB._db.prepare('SELECT statut FROM lots WHERE id = ?').get(id)?.statut;
const appel = async (methode, chemin, { cle, admin, corps, gz, meta, entetes = {} } = {}) => {
  const h = { ...entetes }; if (cle) h['x-kitsu-cle'] = cle; if (admin) h['x-kitsu-admin'] = admin; if (meta) h['x-kitsu-meta'] = JSON.stringify(meta);
  const body = corps === undefined ? undefined : gz ? corps : JSON.stringify(corps);
  if (body) h['content-length'] = String(body.length);
  const r = await worker.fetch(new Request('https://x' + chemin, { method: methode, headers: h, body }), env, ctx);
  const t = r.headers.get('content-type') || ''; return { s: r.status, j: t.includes('json') ? await r.json() : null, r };
};
const envoyer = (cle, lot, meta = P.metaDe(lot)) => appel('POST', '/v1/lots', { cle, corps: gzipSync(JSON.stringify(lot)), gz: true, meta });

// ---------- donnees ----------
const V = { sigG: 'abc123', wKey: 'w9', moteur: 'DwQhSrQR' };
const carte = (id, st = 0) => [id, 99, st, [], 's' + id];
const items = (n, c0 = 10) => Array.from({ length: n }, (_, i) => ({ cartes: [carte(c0 + (i % 7)), carte(c0 + 20 + (i % 5)), carte(c0 + 40)], di: i % 3, pi: i % 9, clePaquet: 'p' + (i % 3) + 'x' + (i % 9), graine: 1 + (i % 3), n: 16, s3: i % 17 }));
// Les items generes plus haut se repetent (trio, paquet, graine) : on dedoublonne comme le ferait le calcul.
const uniques = l => { const v = new Set(); return l.filter(x => { const k = cleTrioDe(x.cartes) + x.di + x.pi + x.graine; if (v.has(k)) return false; v.add(k); return true; }); };
// Rejeu honnete : rend ce que dit le lot (les lots de test sont justes, sauf le lot truque).
const honnete = async (lot, lignes) => lignes.map(l => [l[3], l[4]]);
const A = randomBytes(32).toString('hex'), B = randomBytes(32).toString('hex'), C = randomBytes(32).toString('hex'), ADM = env.ADMIN_JETON;
let ok = 0; const test = async (nom, f) => { await f(); ok++; console.log('ok  ' + nom); };

await test('format : lot construit valide, lot trafique refuse', async () => {
  const lot = P.construireLot(V, uniques(items(300)));
  assert.equal(verifierLot(lot), null);
  assert.ok(verifierLot({ ...lot, paq: 8 }));
  assert.ok(verifierLot({ ...lot, l: [[0, 0, 4, 16, 3]] }), 'graine hors de 1..3');
  assert.ok(verifierLot({ ...lot, l: [[0, 0, 1, 16, 17]] }), '3 etoiles > combats');
  assert.ok(verifierLot({ ...lot, l: [...lot.l, lot.l[0]] }), 'ligne en double');
  assert.ok(verifierLot({ ...lot, t: [[carte(1), carte(1), carte(2)]], l: [[0, 0, 1, 1, 1]] }), 'trio en double');
  assert.ok(verifierLot({ ...lot, t: [[[1, 99, 0, ['x'.repeat(65)], 'a'], carte(2), carte(3)]], l: [[0, 0, 1, 1, 1]] }), 'collectif trop long');
  assert.ok(verifierLot(JSON.parse('{"__proto__":{"f":1}}')));
});

await test('format : cartes d un lot, fusion sans doublon', async () => {
  const lot = P.construireLot(V, uniques(items(300)));
  assert.deepEqual(decoderCartes(cartesDuLot(lot)), [...new Set(lot.t.flat().map(c => c[0]))].sort((a, b) => a - b));
  const its = uniques(items(300)), a = P.construireLot(V, its.slice(0, 200)), b = P.construireLot(V, its.slice(100));
  const f = fusionner([a, b]); assert.equal(verifierLot(f), null); assert.equal(f.l.length, its.length);
  assert.throws(() => fusionner([a, { ...b, wKey: 'autre' }]));
});

let idA, lotA;
await test('envoi : accepte, puis meme lot reconnu, quota des nouveaux IDs', async () => {
  const its = uniques(items(400)); lotA = P.construireLot(V, its);
  let r = await envoyer(A, lotA); assert.equal(r.s, 200, JSON.stringify(r.j)); idA = r.j.id;
  r = await envoyer(A, lotA); assert.equal(r.j.deja, true);
  comme(A); assert.equal((await P.envoyerLot(REG, P.construireLot(V, its.slice(1)))).lignes, its.length - 1, 'envoi par le client');
  await envoyer(A, P.construireLot(V, its.slice(2)));
  r = await envoyer(A, P.construireLot(V, its.slice(3))); assert.equal(r.s, 429);
});

await test('envoi : sans cle, pas du gzip, sans description, description invalide, trop gros', async () => {
  assert.equal((await envoyer(undefined, lotA)).s, 401);
  assert.equal((await appel('POST', '/v1/lots', { cle: B, corps: Buffer.from('pas du gzip'), gz: true, meta: P.metaDe(lotA) })).s, 400);
  assert.equal((await appel('POST', '/v1/lots', { cle: B, corps: gzipSync(JSON.stringify(lotA)), gz: true })).s, 400);
  const r = await envoyer(B, lotA, { ...P.metaDe(lotA), wKey: 'MAJ' }); assert.equal(r.s, 400); assert.match(r.j.err, /Meta/);
  assert.equal((await envoyer(B, lotA, { ...P.metaDe(lotA), lignes: 70000 })).s, 400);
  assert.equal((await envoyer(B, lotA, { ...P.metaDe(lotA), cartes: 'a..b' })).s, 400);
  assert.equal((await appel('POST', '/v1/lots', { cle: B, corps: Buffer.concat([gzipSync('x'), randomBytes(2e6)]), gz: true, meta: P.metaDe(lotA) })).s, 400);
  assert.equal((await appel('GET', '/v1/moi', { cle: B })).j.connu, false, 'un envoi refuse ne cree pas d ID');
  assert.equal((await appel('GET', '/v1/etat')).j.joueurs, 1, 'seuls les IDs qui ont envoye comptent');
});

await test('manifeste et telechargement : lots en attente visibles avec leurs cartes', async () => {
  const r = await appel('GET', `/v1/manifeste?sigG=${V.sigG}&wKey=${V.wKey}`); assert.equal(r.j.lots.length, 3); assert.ok(r.j.lots.every(x => x.statut === 'attente'));
  assert.equal(r.j.lots.find(x => x.id === idA).cartes, cartesDuLot(lotA));
  assert.equal((await appel('GET', '/v1/lots/' + idA)).s, 200);
  assert.equal((await appel('GET', '/v1/lots/zz')).s, 400);
});

await test('controle honnete par un joueur ordinaire (client) : compte, mais ne suffit pas', async () => {
  const logs = []; comme(B);
  assert.equal(await P.controler(REG, V, honnete, { max: 1, log: m => logs.push(m) }), 1);
  assert.match(logs[0], /identique, controle compte/);
  const m = (await appel('POST', '/v1/missions', { cle: B, corps: V })).j; assert.equal(m.indices.length, 24); assert.ok(m.lignes > 0 && m.cartes);
  assert.equal((await appel('POST', '/v1/missions/' + m.mission, { cle: B, corps: { ecarts: 0 } })).j.decision, 'controle compte');
  assert.equal((await appel('POST', '/v1/missions/' + m.mission, { cle: B, corps: { ecarts: 0 } })).s, 404, 'mission a usage unique');
  const m2 = (await appel('POST', '/v1/missions', { cle: B, corps: V })).j;
  assert.equal((await appel('POST', '/v1/missions/' + m2.mission, { cle: B, corps: { ecarts: 99 } })).s, 400, 'ecarts hors limites');
});

await test('on ne controle jamais son propre lot ; mission d un autre refusee', async () => {
  const m = (await appel('POST', '/v1/missions', { cle: A, corps: V })).j; assert.equal(m.mission, null);
  const m2 = (await appel('POST', '/v1/missions', { cle: B, corps: V })).j;
  assert.ok([401, 404].includes((await appel('POST', '/v1/missions/' + m2.mission, { cle: C, corps: { ecarts: 0 } })).s));
});

await test('controle admin juste (client) : le lot passe a verifie, l envoyeur gagne en credit', async () => {
  const logs = []; comme(randomBytes(32).toString('hex'), ADM);
  await P.controler(REG, V, honnete, { max: 1, log: m => logs.push(m) }); assert.match(logs[0], /identique, verifie/);
  assert.equal((await appel('GET', '/v1/moi', { cle: A })).j.cred, 1);
});

await test('faux controle d un joueur, puis l admin tranche : le menteur est ecarte', async () => {
  const m = (await appel('POST', '/v1/missions', { cle: C, corps: V })).j;
  const r = (await appel('POST', '/v1/missions/' + m.mission, { cle: C, corps: { ecarts: 24 } })).j; assert.equal(r.decision, 'conteste, en attente du controle admin');
  const ma = (await appel('POST', '/v1/missions', { admin: ADM, corps: V })).j; assert.equal(ma.lot, m.lot, 'le lot conteste passe en premier');
  await appel('POST', '/v1/missions/' + ma.mission, { admin: ADM, corps: { ecarts: 0 } });
  assert.equal((await appel('GET', '/v1/moi', { cle: C })).j.ecarte, true);
  assert.equal((await envoyer(C, lotA)).s, 403);
});

// Verifie tous les lots en attente avec le client admin (rejeu honnete), sauf ceux pour lesquels stop(id) est vrai.
const toutVerifier = async () => { comme(randomBytes(32).toString('hex'), ADM); while (await P.controler(REG, V, honnete, { max: 1 })); };

await test('lot non conforme a sa description : le client admin le voit, l envoyeur est ecarte', async () => {
  await toutVerifier();
  const E = randomBytes(32).toString('hex'), lot = P.construireLot(V, uniques(items(200, 300)));
  const id = (await envoyer(E, lot, { ...P.metaDe(lot), cartes: '1.1' })).j.id; assert.ok(id);
  const logs = []; comme(randomBytes(32).toString('hex'), ADM);
  await P.controler(REG, V, honnete, { max: 1, log: m => logs.push(m) });
  assert.match(logs[0], /non conforme.*envoyeur ecarte/); assert.equal(statut(id), 'rejete');
  assert.equal((await appel('GET', '/v1/moi', { cle: E })).j.ecarte, true);
});

await test('lot truque : l admin le voit, TOUT le travail de l envoyeur est retire', async () => {
  const D = randomBytes(32).toString('hex'), its = uniques(items(400).map(x => ({ ...x, cartes: [carte(70), carte(71), carte(72 + (x.pi % 2))] })));
  const faux = P.construireLot(V, its), juste = JSON.parse(JSON.stringify(faux)); faux.l.forEach(l => { l[4] = l[3]; }); // 3 etoiles partout
  const id1 = (await envoyer(D, juste)).j.id, id2 = (await envoyer(D, faux)).j.id; assert.ok(id1 && id2);
  // Le PC admin rejoue vraiment : il trouve les resultats du lot juste.
  const vraiRejeu = async (lot, lignes) => lignes.map(l => { const k = juste.l.find(x => x[0] === l[0] && x[1] === l[1] && x[2] === l[2]); return [k[3], k[4]]; });
  comme(randomBytes(32).toString('hex'), ADM); const logs = [];
  while (await P.controler(REG, V, vraiRejeu, { max: 1, log: m => logs.push(m) }) && !logs.some(x => /ecarte/.test(x)));
  assert.ok(logs.some(x => /ecarts, envoyeur ecarte/.test(x)));
  const man = (await appel('GET', `/v1/manifeste?sigG=${V.sigG}&wKey=${V.wKey}`)).j.lots.map(x => x.id);
  assert.ok(!man.includes(id1) && !man.includes(id2), 'meme son lot juste est retire');
  assert.equal((await appel('GET', '/v1/lots/' + id1)).s, 404);
  assert.equal(env.DB._db.prepare('SELECT COUNT(*) AS n FROM blocs WHERE id IN (?, ?)').get(id1, id2).n, 0, 'place liberee');
});

await test('telechargement (client) : seulement tes cartes, lots sans tes cartes ignores, cache nettoye', async () => {
  const F = randomBytes(32).toString('hex'), its = uniques(items(300, 500)), lot = P.construireLot(V, its);
  await envoyer(F, lot); await toutVerifier();
  mkdirSync(path.join(DATA, 'cache', 'partage', 'lots'), { recursive: true }); writeFileSync(path.join(DATA, 'cache', 'partage', 'lots', 'f'.repeat(64) + '.json.gz'), 'vieux');
  const mien = new Map(lot.t[0].map(c => [c[0], `${c[0]}:${c[1]}:${c[2]}:${c[3].join('+')}:${c[4]}`])), recus = [], logs = [];
  const n = await P.telecharger(REG, V, { cleCarteLocale: id => mien.get(id) || null, onLigne: x => recus.push(x), log: m => logs.push(m) });
  const attendu = lot.l.filter(l => l[0] === 0).length; assert.ok(attendu > 0); assert.equal(n, attendu); assert.equal(recus.length, attendu);
  assert.ok(recus.every(x => x.ck === cleTrioDe(lot.t[0])));
  assert.match(logs[0], /sans tes cartes ignores/);
  assert.ok(!existsSync(path.join(DATA, 'cache', 'partage', 'lots', 'f'.repeat(64) + '.json.gz')), 'vieux lot efface');
});

await test('regroupement admin (client) : lots verifies fusionnes en un paquet, memes resultats', async () => {
  const G = randomBytes(32).toString('hex'), its = uniques(items(600, 800)), parts = [its.slice(0, 100), its.slice(100, 200), its.slice(200)];
  const ids = []; for (const p of parts) ids.push((await envoyer(G, P.construireLot(V, p))).j.id);
  await toutVerifier();
  const avant = (await appel('GET', '/v1/moi', { cle: G })).j.lots.find(x => x.statut === 'verifie');
  assert.equal(avant.n, 3);
  const logs = []; comme(randomBytes(32).toString('hex'), ADM); assert.ok(await P.regrouper(REG, { log: m => logs.push(m) }) >= 1);
  assert.ok(ids.every(id => statut(id) === 'regroupe')); assert.equal((await appel('GET', '/v1/lots/' + ids[0])).s, 404);
  const apres = (await appel('GET', '/v1/moi', { cle: G })).j.lots; assert.deepEqual(apres, [{ statut: 'verifie', n: 1, lignes: its.length }]);
  const man = (await appel('GET', `/v1/manifeste?sigG=${V.sigG}&wKey=${V.wKey}`)).j.lots, pq = man.find(x => decoderCartes(x.cartes).includes(800));
  const L = await lireLotTest(pq.id); assert.equal(verifierLot(L), null); assert.equal(cartesDuLot(L), pq.cartes);
  const k = (ck, di, pi, g, n, s3) => [ck, di, pi, g, n, s3].join('|');
  assert.deepEqual(L.l.map(([ti, pj, g, n, s3]) => k(cleTrioDe(L.t[ti]), L.p[pj][0], L.p[pj][1], g, n, s3)).sort(), its.map(x => k(cleTrioDe(x.cartes), x.di, x.pi, x.graine, x.n, x.s3)).sort(), 'memes resultats');
  // Refus : pas admin, lots d un autre joueur ou deja regroupes.
  assert.equal((await appel('GET', '/v1/admin/a-regrouper', { cle: G })).s, 403);
  const z = gzipSync(JSON.stringify(L));
  assert.equal((await appel('POST', '/v1/admin/paquets', { admin: ADM, corps: z, gz: true, meta: P.metaDe(L), entetes: { 'x-kitsu-remplace': ids.slice(0, 2).join(',') } })).s, 409);
  // Supprimer mes envois : le paquet compte pour un lot, les lots regroupes ne sont pas comptes.
  assert.equal((await appel('DELETE', '/v1/moi', { cle: G })).j.supprime, 1);
});

await test('supprimer mes envois : lots, fichiers et ID effaces', async () => {
  // Les 3 lots de A, verifies, ont ete regroupes en un paquet au test precedent.
  const avant = blocs(), r = (await appel('DELETE', '/v1/moi', { cle: A })).j; assert.equal(r.supprime, 1);
  assert.equal(blocs(), avant - 1); assert.equal(env.DB._db.prepare('SELECT COUNT(*) AS n FROM lots WHERE id = ?').get(idA).n, 0); assert.equal((await appel('GET', '/v1/moi', { cle: A })).j.connu, false);
});

await test('etat public : version du serveur annoncee', async () => {
  const e = (await appel('GET', '/v1/etat')).j; assert.equal(e.serveur, VERSION_SERVEUR); assert.ok(Number.isInteger(e.joueurs));
});

await test('IA commune : rien au depart, publiee par l admin seulement, lue et verifiee par le client', async () => {
  const { iaValide, construireWC, cleIA } = await import('../moteur/lib/ia-commune.mjs');
  const { readFileSync } = await import('node:fs');
  assert.equal((await appel('GET', '/v1/ia')).s, 404); comme(A); assert.equal(await P.iaCommune(REG), null, 'sans IA publiee : celle de l appli');
  const pc = JSON.parse(readFileSync(new URL('../moteur/poids-communs.json', import.meta.url))), p = { ...pc, W: { ...pc.W, nm: pc.W.nm.map(x => x + 0.01) } };
  assert.equal((await appel('POST', '/v1/admin/ia', { cle: A, corps: p })).s, 403);
  comme(A, ADM); await P.publierIA(REG, p);
  comme(B); const r = await P.iaCommune(REG); assert.equal(r.source, 'serveur');
  assert.equal(cleIA(construireWC(r.p)), cleIA(construireWC(iaValide(p))), 'meme empreinte que l IA publiee');
  assert.notEqual(cleIA(construireWC(r.p)), cleIA(construireWC(iaValide(pc))));
  assert.equal(iaValide({ W: { nm: [1, 2] } }), null); assert.equal(iaValide({ W: { nm: pc.W.nm.map(() => 'x') } }), null); assert.equal(iaValide({ W: { ...pc.W, boss: pc.W.boss.map(() => 1e9) } }), null);
  // Serveur injoignable : la copie locale sert.
  const f = globalThis.fetch; globalThis.fetch = async () => { throw new Error('hors ligne'); };
  try { assert.equal((await P.iaCommune(REG)).source, 'cache'); } finally { globalThis.fetch = f; }
});

await test('Campagne : ton IA seulement si la derniere comparaison la dit nettement meilleure', async () => {
  const { iaPersoMeilleure, cleIA } = await import('../moteur/lib/ia-commune.mjs');
  const m = { nm: [1] }, c = { nm: [2] }, cmp = v => ({ verdict: v, mienne: cleIA(m), commune: cleIA(c) });
  assert.equal(iaPersoMeilleure(cmp('meilleure'), m, c), true);
  for (const v of ['pareille', 'moins bonne', 'identique']) assert.equal(iaPersoMeilleure(cmp(v), m, c), false, v);
  assert.equal(iaPersoMeilleure(null, m, c), false, 'pas de comparaison');
  assert.equal(iaPersoMeilleure(cmp('meilleure'), { nm: [3] }, c), false, 'ton IA a change depuis');
  assert.equal(iaPersoMeilleure(cmp('meilleure'), m, { nm: [4] }), false, 'IA commune changee (publiee) depuis');
});

await test('file d envoi : lots d une ancienne version effaces, quota atteint dit une seule fois, apres le compte', async () => {
  const E = randomBytes(32).toString('hex'); comme(E); const its = uniques(items(400, 300)), logs = [];
  P.mettreEnFile(P.construireLot({ ...V, sigG: 'ancien1' }, its.slice(0, 50))); // jeu mis a jour depuis : plus lisible par personne
  for (let k = 0; k < 5; k++) P.mettreEnFile(P.construireLot(V, its.slice(k * 10, k * 10 + 60)));
  assert.equal(P.enFile(), 6);
  await envoyer(E, P.construireLot(V, its.slice(200, 210))); await envoyer(E, P.construireLot(V, its.slice(210, 220))); // 2 lots sur 3 du quota des nouveaux IDs (test)
  const b = await P.viderFile(REG, V, m => logs.push(m));
  assert.deepEqual([b.perimes, b.regroupes, b.apres, b.envoyes, b.lignes, b.attente], [1, 5, 1, 1, 100, 0], JSON.stringify(b));
  assert.equal(logs.length, 3, logs.join(' | ')); assert.match(logs[1], /1 lots d une ancienne version/); assert.match(logs[2], /^partage : 1 lots envoyes \(100 resultats\)$/);
  assert.equal(P.journalPartage()[0].perimes, 1);
  // Quota atteint : rien n est envoye, un seul message de bilan, ecrit apres le compte, avec l heure du prochain essai.
  logs.length = 0; P.mettreEnFile(P.construireLot(V, its.slice(110, 130))); P.mettreEnFile(P.construireLot(V, its.slice(130, 150)));
  const c = await P.viderFile(REG, V, m => logs.push(m)); assert.deepEqual([c.envoyes, c.attente], [0, 1]); assert.match(c.raison, /^429/);
  assert.match(logs.at(-1), /^partage : 0 lots envoyes \(0 resultats\), 1 gardes en file : quota du jour atteint pour cet ID, nouvel essai au prochain calcul lance apres \d\d h \d\d$/);
  assert.ok(!logs.some(x => /reporte/.test(x)));
  assert.equal(P.prochainJourQuota(Date.UTC(2026, 10, 20, 17, 46)).getTime(), Date.UTC(2026, 10, 21), 'le quota repart a minuit UTC');
});

await test('file d envoi : petits lots de la meme version regroupes en lots de 60 000 avant l envoi', async () => {
  const E = randomBytes(32).toString('hex'); comme(E); const logs = [];
  for (const f of (existsSync(path.join(DATA, 'cache', 'partage', 'a-envoyer')) ? readdirSync(path.join(DATA, 'cache', 'partage', 'a-envoyer')) : [])) (await import('node:fs')).unlinkSync(path.join(DATA, 'cache', 'partage', 'a-envoyer', f));
  // 7 lots de 20 000 resultats (taille d avant la 5.56) : 140 000 resultats, soit 3 lots de 60 000 au plus.
  const its = Array.from({ length: 140000 }, (_, i) => ({ cartes: [carte(1 + (i % 150)), carte(152 + (i % 3)), carte(160)], di: i % 3, pi: Math.floor(i / 450) % 2000, clePaquet: 'k' + (i % 3) + 'x' + (Math.floor(i / 450) % 2000), graine: 1 + (Math.floor(i / 150) % 3), n: 16, s3: i % 17 }));
  for (let k = 0; k < 7; k++) P.mettreEnFile(P.construireLot(V, its.slice(k * 20000, (k + 1) * 20000)));
  assert.equal(P.enFile(), 7);
  const b = await P.viderFile(REG, V, m => logs.push(m));
  assert.deepEqual([b.regroupes, b.apres, b.envoyes, b.lignes, b.attente], [6, 2, 3, 140000, 0], JSON.stringify(b) + logs.join(' | '));
  assert.match(logs[0], /6 petits lots de la file regroupes en 2 lots/);
});

await test('lot de 60 000 resultats (taille d envoi du calcul) accepte par la base, sous 1,9 Mo', async () => {
  assert.equal(P.LIGNES_PAR_LOT, 60000);
  const trios = []; for (let a = 1; a <= 161 && trios.length < P.LIGNES_PAR_LOT; a++) for (let b = a + 1; b <= 161 && trios.length < P.LIGNES_PAR_LOT; b++) for (let c = b + 1; c <= 161 && trios.length < P.LIGNES_PAR_LOT; c++) trios.push([a, b, c]); // 161 cartes comme le PC d Adrien
  const its = trios.map(([a, b, c], i) => ({ cartes: [carte(a), carte(b), carte(c)], di: i % 3, pi: i % 50, clePaquet: 'p' + (i % 3) + 'x' + (i % 50), graine: 1, n: 16, s3: i % 17 }));
  const lot = P.construireLot(V, its); assert.equal(verifierLot(lot), null); assert.equal(lot.l.length, 60000);
  const r = await envoyer(randomBytes(32).toString('hex'), lot); assert.equal(r.s, 200, JSON.stringify(r.j));
  assert.ok(gzipSync(JSON.stringify(lot)).length < 1.9e6);
});

await test('comparaison des controles', async () => {
  const lot = { l: [[0, 0, 1, 16, 4], [0, 0, 2, 16, 5]] };
  assert.equal(ecarts(lot, [0, 1], [[16, 4], [16, 5]]), 0); assert.equal(ecarts(lot, [0, 1], [[16, 4], [16, 6]]), 1); assert.equal(ecarts(lot, [0, 1], [[16, 4]]), 2); assert.equal(ecarts(lot, [0, 1], 'x'), 2);
});
console.log(`${ok} tests passes`);
