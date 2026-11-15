// Entrainement local de l'IA (entropie croisee) avec le moteur du jeu, sur tes meilleures equipes.
// Objectif : 2 etoiles ou plus, puis 3 etoiles, sur des combats disputes. Resultat : data/poids.json,
// que le script KitsuAI recupere tout seul quand le serveur local tourne.
//   node entrainer.mjs [--types nm,boss,norm] [--generations 40] [--fils 10]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { W_DEFAUT } from './lib/sim.mjs';
import { dir as D } from './lib/chemins.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const T0 = Date.now(), log = (...a) => console.log(`[${String(Math.round((Date.now() - T0) / 1000)).padStart(5)} s]`, ...a);
const { G, B, version } = await loadEngine(); const CH = G.CHAR_BY_ID;
const sp = D('data', 'sauvegarde.json');
const SAVE = existsSync(sp) ? JSON.parse(readFileSync(sp, 'utf8')) : {};
const pp = D('data', 'poids.json');
let W = existsSync(pp) ? JSON.parse(readFileSync(pp, 'utf8')).W : (SAVE.W?.nm ? SAVE.W : W_DEFAUT);
W = { ...W_DEFAUT, ...W };
const lv = id => SAVE.lv?.[id]?.l || 99, st = id => SAVE.stars?.[id] || 0;
// Equipes : les meilleures de la derniere analyse complete, sinon l'equipe actuelle.
const dp = D('resultats', 'dernier.json');
const DER = existsSync(dp) ? JSON.parse(readFileSync(dp, 'utf8')) : null;
const teamsFor = cats => { const m = DER?.modes?.actuel || DER?.modes?.['99'] || {}; const out = new Map(); for (const c of cats) for (const x of (m[c]?.top || []).slice(0, 3)) out.set(x.ids.slice().sort().join(), x.ids); if (!out.size && SAVE.team?.length === 3) out.set('a', SAVE.team.map(Number)); return [...out.values()].slice(0, 4); };
const shuffle = (a, s = 11) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const all = [], bosses = []; for (const w of G.ALL_WORLDS) for (const f of w.fights) { all.push(f.id); if (f.boss) bosses.push(f.id); }
const TYPES = { nm: { fights: all.map(f => f + '@xn'), cats: ['cauchemar', 'cauchemar_multi', 'cauchemar_boss'] }, boss: { fights: bosses.map(f => f + '@x'), cats: ['boss_extreme'] }, norm: { fights: all.filter(f => !bosses.includes(f)).map(f => f + '@x'), cats: ['campagne_extreme'] } };
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const GENS = +arg('generations', 40), POP = 16, ELITE = 4;
const rn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const gains = {};
log(`moteur ${version}, ${pool.n} fils, ${GENS} generations max`);
for (const kind of String(arg('types', 'nm,boss,norm')).split(',')) {
  const T = TYPES[kind]; if (!T) continue;
  const teams = teamsFor(T.cats).map(t => t.map(id => ({ id, lv: lv(id), stars: st(id) })));
  if (!teams.length) { log(kind, ': aucune equipe'); continue; }
  // Combats disputes : ceux ou l'IA actuelle ne fait pas 3 etoiles a coup sur.
  const cand = shuffle(T.fights).slice(0, 600);
  const probe = await pool.runAll(cand.map(f => ({ team: teams[0], fights: [f], seeds: [1, 2] })), W, {}, 20);
  const hard = cand.filter((f, i) => probe[i].s3 < 2).slice(0, 120); const tr = hard.slice(0, 80), ho = hard.slice(80);
  if (tr.length < 10) { log(kind, ': trop peu de combats disputes, rien a apprendre'); continue; }
  const fit = async (w, fl, seeds) => { const Wt = { ...W, [kind]: w }; const r = await pool.runAll(teams.flatMap(t => fl.map(f => ({ team: t, fights: [f], seeds }))), Wt, { stop2: true }, 16); const n = r.reduce((a, x) => a + x.n, 0); return r.reduce((a, x) => a + x.s2 + 0.5 * x.s3, 0) / n; };
  let mu = W[kind].slice(), sd = Array(mu.length).fill(0.35), best = mu.slice(), bestHo = await fit(best, ho.length >= 10 ? ho : tr, [901, 902, 903]), stale = 0;
  const start = bestHo; log(`${kind} : ${teams.length} equipes, ${tr.length} combats d'entrainement, ${ho.length} de controle ; depart ${(100 * start).toFixed(1)}`);
  for (let g = 0; g < GENS && stale < 8; g++) {
    const seeds = [g * 2 + 11, g * 2 + 12], pop = [];
    // Paires opposees (mu + e, mu - e) : moins de bruit pour le meme nombre de combats.
    const eps = Array.from({ length: POP / 2 }, () => mu.map((_, j) => sd[j] * rn()));
    const ws = [best.slice(), ...eps.flatMap(e => [mu.map((m, j) => m + e[j]), mu.map((m, j) => m - e[j])])].slice(0, POP);
    const fs = await Promise.all(ws.map(w => fit(w, tr, seeds))); ws.forEach((w, i) => pop.push({ w, f: fs[i] }));
    pop.sort((a, b) => b.f - a.f); const el = pop.slice(0, ELITE);
    for (let j = 0; j < mu.length; j++) { const m = el.reduce((a, p) => a + p.w[j], 0) / ELITE; mu[j] = m; sd[j] = Math.max(0.05, Math.sqrt(el.reduce((a, p) => a + (p.w[j] - m) ** 2, 0) / ELITE) * 0.9 + 0.02); }
    let imp = false; for (const w of [pop[0].w, mu]) { const h = await fit(w, ho.length >= 10 ? ho : tr, [901, 902, 903]); if (h > bestHo + 0.005) { bestHo = h; best = w.slice(); imp = true; } }
    stale = imp ? 0 : stale + 1;
    log(`${kind} generation ${g + 1} : meilleur ${(100 * pop[0].f).toFixed(1)} (entrainement), controle ${(100 * bestHo).toFixed(1)}${imp ? ' (amelioration)' : ''}`);
  }
  W[kind] = best.map(x => +x.toFixed(4)); gains[kind] = { depart: +(100 * start).toFixed(1), fin: +(100 * bestHo).toFixed(1) };
  mkdirSync(D('data'), { recursive: true });
  writeFileSync(pp, JSON.stringify({ t: Date.now(), version, W, gains }, null, 1));
  log(`${kind} : ${gains[kind].depart} -> ${gains[kind].fin} (score de controle : 2+ etoiles + moitie des 3 etoiles)`);
}
log('termine, poids enregistres dans data/poids.json'); await pool.close(); process.exit(0);
