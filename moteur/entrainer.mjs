// Entrainement local de l'IA (entropie croisee) avec le moteur du jeu, sur tes meilleures equipes.
// Objectif (17/11/2026, demande d'Adrien) : les 3 etoiles (0 K.O., 8 cycles au plus) sur des combats disputes ;
// --objectif 2etoiles reprend l'ancien score (2 etoiles ou plus + moitie des 3 etoiles). Resultat : data/poids.json,
// que le script KitsuAI recupere tout seul quand le serveur local tourne.
//   node entrainer.mjs [--types nm,boss,norm] [--generations 40] [--fils 10] [--objectif 3etoiles|2etoiles] [--par-equipe 3] [--trios plan]
import { archiverPoids } from './lib/historique.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { W_DEFAUT } from './lib/sim.mjs';
import { dir as D } from './lib/chemins.mjs';
import { identite } from './lib/partage.mjs';
import { spawnSync } from 'node:child_process';
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
const mkT = t => t.map(id => ({ id, lv: lv(id), stars: st(id), ...(SAVE.lk?.[id] ? { lk: SAVE.lk[id] } : {}) })); // avec les collectifs choisis
// Equipes : les meilleures de la derniere analyse complete, sinon l'equipe actuelle.
const dp = D('resultats', 'dernier.json');
const DER = existsSync(dp) ? JSON.parse(readFileSync(dp, 'utf8')) : null;
const teamsFor = cats => { const m = DER?.modes?.actuel || DER?.modes?.['99'] || {}; const out = new Map(); for (const c of cats) for (const x of (m[c]?.top || []).slice(0, 3)) out.set(x.ids.slice().sort().join(), x.ids); if (!out.size && SAVE.team?.length === 3) out.set('a', SAVE.team.map(Number)); return [...out.values()].slice(0, 4); };
const shuffle = (a, s = 11) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const all = [], bosses = []; for (const w of G.ALL_WORLDS) for (const f of w.fights) { all.push(f.id); if (f.boss) bosses.push(f.id); }
const TYPES = { nm: { fights: all.map(f => f + '@xn'), cats: ['cauchemar', 'cauchemar_multi', 'cauchemar_boss'] }, boss: { fights: bosses.map(f => f + '@x'), cats: ['boss_extreme'] }, norm: { fights: all.filter(f => !bosses.includes(f)).map(f => f + '@x'), cats: ['campagne_extreme'] } };
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const GENS = +arg('generations', 40), POP = 16, ELITE = 4, TROIS = arg('objectif', '3etoiles') !== '2etoiles';
const rn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const gains = {};
log(`moteur ${version}, ${pool.n} fils, ${GENS} generations max`);
// Entrainement d'un jeu de reglages (CEM) pour des equipes donnees, sur leurs combats disputes.
async function entrainer(kind, teams, fightsAll, gens, etiquette, nPremiers = 0) {
  // nPremiers : les premiers combats de la liste (ceux du trio) passent avant les autres, deja melanges.
  const cand = [...fightsAll.slice(0, nPremiers), ...shuffle(fightsAll.slice(nPremiers))].slice(0, 600);
  const probe = await pool.runAll(cand.map(f => ({ team: teams[0], fights: [f], seeds: [1, 2] })), W, {}, 20);
  let tr, ho;
  if (!nPremiers) { const hard = cand.filter((f, i) => probe[i].s3 < 2).slice(0, 120); tr = hard.slice(0, 80); ho = hard.slice(80); }
  else { // combats du trio : un sur deux en entrainement, l'autre en controle (le gain se mesure aussi sur ses combats)
    const own = cand.filter((f, i) => i < nPremiers && probe[i].s3 < 2), aut = cand.filter((f, i) => i >= nPremiers && probe[i].s3 < 2);
    const oT = own.filter((_, k) => k % 2 === 0), oH = own.filter((_, k) => k % 2 === 1), nA = Math.max(0, 80 - oT.length);
    tr = [...oT, ...aut.slice(0, nA)].slice(0, 80); ho = [...oH, ...aut.slice(nA)].slice(0, 40);
  }
  if (tr.length < 10) { log(etiquette, ': trop peu de combats disputes, rien a apprendre'); return null; }
  const fit = async (w, fl, seeds) => { const Wt = { ...W, [kind]: w }; const r = await pool.runAll(teams.flatMap(t => fl.map(f => ({ team: t, fights: [f], seeds }))), Wt, TROIS ? { stop3: true } : { stop2: true }, 16); const n = r.reduce((a, x) => a + x.n, 0); return r.reduce((a, x) => a + (TROIS ? x.s3 : x.s2 + 0.5 * x.s3), 0) / n; };
  let mu = W[kind].slice(), sd = Array(mu.length).fill(0.35), best = mu.slice(), bestHo = await fit(best, ho.length >= 10 ? ho : tr, [901, 902, 903]), stale = 0;
  const start = bestHo; log(`${etiquette} : ${teams.length} equipe(s), ${tr.length} combats d'entrainement, ${ho.length} de controle ; depart ${(100 * start).toFixed(1)}`);
  for (let g = 0; g < gens && stale < 8; g++) {
    const seeds = [g * 2 + 11, g * 2 + 12], pop = [];
    // Paires opposees (mu + e, mu - e) : moins de bruit pour le meme nombre de combats.
    const eps = Array.from({ length: POP / 2 }, () => mu.map((_, j) => sd[j] * rn()));
    const ws = [best.slice(), ...eps.flatMap(e => [mu.map((m, j) => m + e[j]), mu.map((m, j) => m - e[j])])].slice(0, POP);
    const fs = await Promise.all(ws.map(w => fit(w, tr, seeds))); ws.forEach((w, i) => pop.push({ w, f: fs[i] }));
    pop.sort((a, b) => b.f - a.f); const el = pop.slice(0, ELITE);
    for (let j = 0; j < mu.length; j++) { const m = el.reduce((a, p) => a + p.w[j], 0) / ELITE; mu[j] = m; sd[j] = Math.max(0.05, Math.sqrt(el.reduce((a, p) => a + (p.w[j] - m) ** 2, 0) / ELITE) * 0.9 + 0.02); }
    let imp = false; for (const w of [pop[0].w, mu]) { const h = await fit(w, ho.length >= 10 ? ho : tr, [901, 902, 903]); if (h > bestHo + 0.005) { bestHo = h; best = w.slice(); imp = true; } }
    stale = imp ? 0 : stale + 1;
    log(`${etiquette} generation ${g + 1} : meilleur ${(100 * pop[0].f).toFixed(1)} (entrainement), controle ${(100 * bestHo).toFixed(1)}${imp ? ' (amelioration)' : ''}`);
  }
  return { w: best.map(x => +x.toFixed(4)), depart: +(100 * start).toFixed(1), fin: +(100 * bestHo).toFixed(1), ho: ho.length >= 10 ? ho : tr };
}
// Reglages d'une equipe contre les reglages generaux, sur ses combats de controle avec 6 tirages jamais utilises (apparies).
async function verifier(team, fl, w) {
  const seeds = [7001, 7002, 7003, 7004, 7005, 7006], jobs = fl.flatMap(f => seeds.map(sd => ({ team, fights: [f], seeds: [sd] })));
  const [a, b] = await Promise.all([W, { ...W, nm: w, equipes: undefined }].map(Wx => pool.runAll(jobs, Wx, { stop3: true }, 16)));
  const d = a.map((x, i) => b[i].s3 - x.s3), n = d.length, m = d.reduce((p, q) => p + q, 0) / n, se = Math.sqrt(d.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, n - 1) / n), z = se ? m / se : 0;
  const pc = r => +(100 * r.reduce((p, x) => p + x.s3, 0) / n).toFixed(1);
  return { n, avant: pc(a), apres: pc(b), z: +z.toFixed(1), garde: z >= 2 };
}
// Tour de l'infini : reglages appris sur l'etage atteint (montees completes, PV reportes), pas sur les etoiles.
// Gardes seulement s'ils battent les reglages actuels sur des montees jamais vues (z >= 2).
async function entrainerTour(teams, gens) {
  const climbs = async (w, seeds) => { const r = await pool.runAll(teams.map(team => ({ type: 'tower', team, seeds, maxFl: 400 })), { ...W, tower: w }, {}, 1); return r.flatMap(x => x.fl); };
  const moy = a => a.reduce((x, y) => x + y, 0) / a.length, CTRL = Array.from({ length: 30 }, (_, i) => 9001 + i);
  let mu = W.tower.slice(), sd = Array(mu.length).fill(0.35), best = mu.slice(), bestHo = moy(await climbs(best, CTRL)), stale = 0;
  const start = bestHo; log(`tour : ${teams.length} equipe(s), depart etage moyen ${start.toFixed(1)} (controle ${CTRL.length} montees par equipe)`);
  for (let g = 0; g < gens && stale < 8; g++) {
    const seeds = Array.from({ length: 6 }, (_, i) => 100 * g + 11 + i);
    const eps = Array.from({ length: POP / 2 }, () => mu.map((_, j) => sd[j] * rn()));
    const ws = [best.slice(), ...eps.flatMap(e => [mu.map((m, j) => m + e[j]), mu.map((m, j) => m - e[j])])].slice(0, POP);
    const fs = await Promise.all(ws.map(w => climbs(w, seeds).then(moy)));
    const pop = ws.map((w, i) => ({ w, f: fs[i] })).sort((a, b) => b.f - a.f), el = pop.slice(0, ELITE);
    for (let j = 0; j < mu.length; j++) { const m = el.reduce((a, p) => a + p.w[j], 0) / ELITE; mu[j] = m; sd[j] = Math.max(0.05, Math.sqrt(el.reduce((a, p) => a + (p.w[j] - m) ** 2, 0) / ELITE) * 0.9 + 0.02); }
    let imp = false; for (const w of [pop[0].w, mu]) { const h = moy(await climbs(w, CTRL)); if (h > bestHo + 0.5) { bestHo = h; best = w.slice(); imp = true; } }
    stale = imp ? 0 : stale + 1;
    log(`tour generation ${g + 1} : meilleur ${pop[0].f.toFixed(1)} (entrainement), controle ${bestHo.toFixed(1)}${imp ? ' (amelioration)' : ''}`);
  }
  // Verification finale sur des montees jamais vues : reglages actuels contre reglages appris, memes tirages.
  const FIN = Array.from({ length: 100 }, (_, i) => 70001 + i), a = await climbs(W.tower, FIN), b = await climbs(best, FIN);
  const d = b.map((x, i) => x - a[i]), md = moy(d), se = Math.sqrt(d.reduce((x, y) => x + (y - md) ** 2, 0) / (d.length - 1) / d.length), z = se ? md / se : 0;
  log(`tour : verification sur ${FIN.length} montees jamais vues par equipe : ${moy(a).toFixed(1)} -> ${moy(b).toFixed(1)} (ecart ${md.toFixed(1)} +/- ${(2 * se).toFixed(1)}, z = ${z.toFixed(1)})`);
  return { w: best.map(x => +x.toFixed(4)), depart: +moy(a).toFixed(1), fin: +moy(b).toFixed(1), z: +z.toFixed(1), garde: z >= 2 };
}
const sauver = patch => { mkdirSync(D('data'), { recursive: true }); archiverPoids('entrainement'); const old = existsSync(pp) ? JSON.parse(readFileSync(pp, 'utf8')) : {}; writeFileSync(pp, JSON.stringify({ ...old, ...patch, restaure: undefined, t: Date.now(), version }, null, 1)); };
for (const kind of String(arg('types', 'nm,boss,norm')).split(',').filter(Boolean)) {
  if (kind === 'tour') {
    const tops = (DER?.modes?.actuel || DER?.modes?.['99'] || {}).tour?.top?.slice(0, 2).map(x => x.ids) || (SAVE.team?.length ? [SAVE.team.map(Number)] : []);
    if (!tops.length) { log('tour : aucune equipe (lance d abord l analyse de la Tour)'); continue; }
    const r = await entrainerTour(tops.map(mkT), GENS);
    gains.tour = { depart: r.depart, fin: r.fin, z: r.z, unite: 'etage moyen' };
    if (r.garde) { W.tower = r.w; log(`tour : reglages appris gardes (${r.depart} -> ${r.fin})`); } else log('tour : pas de gain net sur les montees jamais vues, reglages actuels gardes');
    sauver({ W, gains }); continue;
  }
  const T = TYPES[kind]; if (!T) continue;
  const teams = teamsFor(T.cats).map(mkT);
  if (!teams.length) { log(kind, ': aucune equipe'); continue; }
  const r = await entrainer(kind, teams, T.fights, GENS, kind); if (!r) continue;
  W[kind] = r.w; gains[kind] = { depart: r.depart, fin: r.fin, objectif: TROIS ? '3etoiles' : '2etoiles' };
  sauver({ W, gains });
  log(`${kind} : ${r.depart} -> ${r.fin} (score de controle : ${TROIS ? '% de 3 etoiles' : '2+ etoiles + moitie des 3 etoiles'})`);
}
// Entrainement par equipe : des reglages Cauchemar propres a chacune de tes meilleures equipes,
// gardes seulement s'ils battent les reglages generaux sur ses combats de controle.
// 5.30 (--trios plan) : les trios du plan du calcul Campagne (cauchemar3.json, etages.plan), chacun sur SES combats Cauchemar
// (ceux que le plan lui donne et ceux dont il est le meilleur trio), aux niveaux du calcul ; completes par les autres combats
// Cauchemar Extreme s'il y en a trop peu de disputes. Sans plan : les meilleures equipes de la derniere analyse, comme avant.
const NE = +arg('par-equipe', 0), PLAN = arg('trios') === 'plan';
function triosPlan() {
  const c3 = (() => { try { return JSON.parse(readFileSync(D('resultats', 'cauchemar3.json'), 'utf8')); } catch { return null; } })(), e = c3?.etages;
  if (!e?.plan?.length) return null;
  const lvC = id => c3.niveaux === '99' ? 99 : lv(id), mk = t => t.map(id => ({ id, lv: lvC(id), stars: st(id), ...(SAVE.lk?.[id] ? { lk: SAVE.lk[id] } : {}) }));
  return e.plan.map(p => ({ ids: e.trios[p.trio], team: mk(e.trios[p.trio]), fights: e.combats.filter(c => c[1] < 3 && (c[4] === p.trio || c[2] === p.trio)).map(c => c[0]) })).filter(x => x.ids?.length === 3);
}
if (NE > 0 || PLAN) {
  const old = existsSync(pp) ? JSON.parse(readFileSync(pp, 'utf8')) : {}, equipes = old.equipes || {};
  const tp = PLAN ? triosPlan() : null; if (PLAN && !tp) log('trios du plan : pas de calcul Campagne avec un plan, meilleures equipes de la derniere analyse a la place');
  const liste = tp || teamsFor(['cauchemar_multi', 'cauchemar_boss', 'cauchemar']).slice(0, NE || 3).map(ids => ({ ids, team: mkT(ids), fights: [] }));
  if (tp) log(`trios du plan : ${tp.length} trios, ${tp.map(x => x.fights.length).join(' / ')} combats Cauchemar chacun`);
  for (const x of liste) {
    const t = x.ids, key = t.slice().sort((a, b) => a - b).join('-'), nom = t.map(id => (CH[id]?.n || id)).join(' / ');
    const propres = shuffle(x.fights, 3), fl = propres.length >= 40 ? propres : [...propres, ...shuffle(TYPES.nm.fights.filter(f => !propres.includes(f)), 5)];
    const r = await entrainer('nm', [x.team], fl, Math.round(GENS * 0.6), 'equipe ' + nom, propres.length);
    // 5.30 : verification sur des tirages jamais vus (memes combats, memes graines pour les deux reglages) : gardes si z >= 2.
    const v = r && r.fin > r.depart + 0.5 ? await verifier(x.team, r.ho, r.w) : null;
    if (v) log(`equipe ${nom} : verification sur ${v.n} combats jamais joues : ${v.avant} -> ${v.apres} % de 3 etoiles (z = ${v.z})`);
    if (v?.garde) { equipes[key] = { nom, nm: r.w, depart: r.depart, fin: r.fin, verif: v, t: Date.now() }; log(`equipe ${nom} : ${r.depart} -> ${r.fin}, reglages propres gardes`); }
    else if (v) log(`equipe ${nom} : gain pas confirme sur les tirages jamais vus, reglages generaux gardes`);
    else if (r) log(`equipe ${nom} : pas de gain net (${r.depart} -> ${r.fin}), reglages generaux gardes`);
  }
  sauver({ equipes });
}
log('termine, poids enregistres dans data/poids.json'); await pool.close();
// PC validateur : ta nouvelle IA est comparee a l'IA commune (Reglages, cadre validateur : « Publier comme IA commune »).
if (identite().admin && !arg('sans-comparaison')) { log('comparaison avec l IA commune ...'); spawnSync(process.execPath, [path.join(here, 'comparer-ia.mjs'), ...(arg('fils') ? ['--fils', arg('fils')] : [])], { stdio: 'inherit', env: process.env }); }
process.exit(0);
