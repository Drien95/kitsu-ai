// L'IA rapide apprend a imiter l'IA qui anticipe (apprentissage par imitation).
// 1. Sur des combats disputes de tes meilleures equipes, l'IA qui anticipe joue et chaque decision est enregistree.
// 2. On ajuste les 19 criteres de l'IA rapide pour qu'elle fasse les memes choix (regression softmax).
// 3. On garde les nouveaux reglages seulement s'ils font mieux sur des combats de controle.
//   node distiller.mjs [--combats 160] [--k 6] [--r 12] [--fils 10]
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { arg, log, W0, team, topTeams, fightSets, shuffle, disputes, score, majPoids, ecrire } from './lib/commun.mjs';
const { G, B, version } = await loadEngine();
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const N = +arg('combats', 160), K = +arg('k', 6), R = +arg('r', 12);
const sets = fightSets(G, B);
const teams = topTeams(['cauchemar_multi', 'cauchemar_boss', 'cauchemar'], 3).map(t => team(t));
log(`moteur ${version}, ${pool.n} fils, ${teams.length} equipes, professeur K=${K} R=${R}`);
const W = JSON.parse(JSON.stringify(W0)), rapport = { date: new Date().toISOString(), version, modes: {} };
for (const [mode, fl] of [['nm', shuffle([...sets.nmMulti, ...sets.nmBoss], 5)], ['boss', shuffle(sets.extBoss, 6)]]) {
  // Combats disputes, separes en apprentissage et controle.
  const hard = []; for (const t of teams) hard.push(...await disputes(pool, W, t, fl.slice(0, 500), Math.ceil(N / teams.length) + 20));
  const uniq = [...new Set(hard)], tr = uniq.slice(0, Math.ceil(uniq.length * 0.7)), ho = uniq.slice(tr.length);
  if (tr.length < 10 || ho.length < 6) { log(`${mode} : trop peu de combats disputes`); continue; }
  log(`${mode} : ${tr.length} combats d'apprentissage, ${ho.length} de controle ; le professeur joue...`);
  const jobs = []; for (const t of teams) for (const f of tr.slice(0, Math.ceil(N / teams.length))) jobs.push({ type: 'teach', fid: f, team: t, seed: jobs.length + 1, opt: { K, R } });
  const res = await pool.runAll(jobs, W, {}, 1);
  const data = res.flatMap(r => r.samples).filter(x => x.mode === mode || mode === 'boss' && x.mode === 'boss');
  log(`${mode} : ${data.length} decisions enregistrees`);
  if (data.length < 200) { log(`${mode} : pas assez de decisions`); continue; }
  // Regression softmax (Adam), regularisee vers les reglages actuels.
  const w = W[mode].slice(), w0 = W[mode].slice(), m = w.map(() => 0), v = w.map(() => 0), lr = 0.01, lam = 0.002;
  const acc = ww => data.reduce((a, x) => { let bi = 0, bv = -1e9; x.fs.forEach((f, i) => { const s = f.reduce((q, fi, j) => q + fi * ww[j], 0); if (s > bv) { bv = s; bi = i; } }); return a + (bi === x.pick); }, 0) / data.length;
  const acc0 = acc(w); let best = w.slice(), bestAcc = acc0;
  for (let ep = 0; ep < 150; ep++) {
    const g = w.map((wi, j) => 2 * lam * (wi - w0[j]));
    for (const x of data) { const sc = x.fs.map(f => f.reduce((q, fi, j) => q + fi * w[j], 0)), mx = Math.max(...sc), ex = sc.map(s => Math.exp(s - mx)), Z = ex.reduce((a, b) => a + b, 0); x.fs.forEach((f, i) => { const p = ex[i] / Z - (i === x.pick ? 1 : 0); for (let j = 0; j < w.length; j++) g[j] += p * f[j] / data.length; }); }
    for (let j = 0; j < w.length; j++) { m[j] = 0.9 * m[j] + 0.1 * g[j]; v[j] = 0.999 * v[j] + 0.001 * g[j] * g[j]; w[j] -= lr * (m[j] / (1 - 0.9 ** (ep + 1))) / (Math.sqrt(v[j] / (1 - 0.999 ** (ep + 1))) + 1e-8); }
    if (ep % 5 === 4) { const a = acc(w); if (a > bestAcc) { bestAcc = a; best = w.slice(); } }
  }
  w.splice(0, w.length, ...best); const acc1 = bestAcc;
  // Controle : memes combats et tirages pour l'ancienne et la nouvelle IA.
  const seeds = [901, 902, 903, 904], before = await score(pool, W, teams, ho, seeds), after = await score(pool, { ...W, [mode]: w }, teams, ho, seeds);
  const gain = (after.s2 + 0.5 * after.s3) - (before.s2 + 0.5 * before.s3);
  rapport.modes[mode] = { decisions: data.length, accordAvant: +(100 * acc0).toFixed(1), accordApres: +(100 * acc1).toFixed(1), deuxEtoilesAvant: +(100 * before.s2).toFixed(1), deuxEtoilesApres: +(100 * after.s2).toFixed(1), troisAvant: +(100 * before.s3).toFixed(1), troisApres: +(100 * after.s3).toFixed(1), garde: gain > 0.005 };
  log(`${mode} : accord avec le professeur ${(100 * acc0).toFixed(1)} % puis ${(100 * acc1).toFixed(1)} % ; controle 2+ etoiles ${(100 * before.s2).toFixed(1)} puis ${(100 * after.s2).toFixed(1)} %, 3 etoiles ${(100 * before.s3).toFixed(1)} puis ${(100 * after.s3).toFixed(1)} % : ${gain > 0.005 ? 'garde' : 'pas mieux, reglages actuels gardes'}`);
  if (gain > 0.005) W[mode] = w.map(x => +x.toFixed(4));
}
const kept = Object.values(rapport.modes).some(x => x.garde);
if (kept) majPoids({ W, distillation: rapport, gains: Object.fromEntries(Object.entries(rapport.modes).map(([k, x]) => [k, { depart: x.deuxEtoilesAvant, fin: x.deuxEtoilesApres }])) });
ecrire('ia-imitation.json', rapport);
log(kept ? 'termine : nouveaux reglages enregistres (data/poids.json)' : 'termine : aucun gain, reglages inchanges');
await pool.close(); process.exit(0);
