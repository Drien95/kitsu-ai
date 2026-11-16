// Analyse complete de tes LR, UR et SSR : campagne, Cauchemar, boss, combats a plusieurs ennemis,
// evenements, Salle, Tour de l'infini et boss de guilde. Objectif : 2 etoiles minimum, departage par les 3 etoiles.
//   node tout.mjs                    tes niveaux actuels puis tout au niveau 99
//   options : --niveaux actuel|99|actuel,99   --fils 11   --tirages 3   --cartes 22
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { W_DEFAUT } from './lib/sim.mjs';
import { dir as D } from './lib/chemins.mjs';
import { reglagesAnalyse } from './lib/historique.mjs';
import { makeTour } from './lib/tour.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const T0 = Date.now(), log = (...a) => console.log(`[${String(Math.round((Date.now() - T0) / 1000)).padStart(5)} s]`, ...a);
const { G, B, version } = await loadEngine();
const CH = G.CHAR_BY_ID, R = { M: 'LR', L: 'UR', E: 'SSR' };
const sp = D('data', 'sauvegarde.json');
if (!existsSync(sp)) { console.log('Il manque moteur\\data\\sauvegarde.json : onglet Sante du panneau KitsuAI, « Exporter pour le moteur local ».'); process.exit(1); }
const SAVE = JSON.parse(readFileSync(sp, 'utf8'));
const { W, info: WINFO } = reglagesAnalyse(SAVE, W_DEFAUT);
const IDS = Object.keys(SAVE.owned || {}).map(Number).filter(i => ['M', 'L', 'E'].includes(CH[i]?.r));
const SEEDS = +arg('tirages', 3), NCARDS = +arg('cartes', 22), KEEP = 10;
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const short = id => (CH[id]?.n || String(id));
// ---------- cache disque (version du jeu + reglages de l'IA) ----------
mkdirSync(D('cache'), { recursive: true });
const wKey = JSON.stringify(W).length + ':' + JSON.stringify(W).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
const cacheFile = D('cache', `${version}-${wKey}.json`);
const cache = existsSync(cacheFile) ? new Map(Object.entries(JSON.parse(readFileSync(cacheFile, 'utf8')))) : new Map();
let cacheHits = 0, sims = 0;
const saveCache = () => writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(cache)));
// ---------- melange deterministe ----------
const shuffle = (a, s = 7) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// ---------- evaluation avec cache ----------
let LVF = null; // fonction niveau (actuel ou 99)
const mkTeam = (t, lk = {}) => t.map(id => { const l = lk[id] || SAVE.lk?.[id]; return { id, lv: LVF(id), stars: SAVE.stars?.[id] || 0, ...(l ? { lk: l } : {}) }; }); // avec les collectifs choisis
const tkey = t => t.map(id => id + ':' + LVF(id) + ':' + (SAVE.stars?.[id] || 0) + ':' + (SAVE.lk?.[id] || []).join('+')).sort().join(',');
async function evalUnit(cat, teams, chunkIdx, fl, seed) {
  const out = new Array(teams.length), todo = [];
  teams.forEach((t, i) => { const k = `${cat}|${chunkIdx}|${seed}|${tkey(t)}`; const c = cache.get(k); if (c) { out[i] = c; cacheHits++; } else todo.push([i, k]); });
  if (todo.length) {
    const r = await pool.runAll(todo.map(([i]) => ({ team: mkTeam(teams[i]), fights: fl, seeds: [seed] })), W, { stop2: true }, 6);
    r.forEach((x, j) => { const v = [x.n, x.win, x.s2, x.s3]; out[todo[j][0]] = v; cache.set(todo[j][1], v); sims += x.n; });
  }
  return out;
}
// Course avec elimination adaptative : memes combats et memes tirages pour tous ; un trio est abandonne
// des que sa borne haute passe sous la borne basse du 10e meilleur.
async function race(cat, cands, fights, { chunk = 16, seeds = SEEDS } = {}) {
  const fl = shuffle(fights), chunks = []; for (let i = 0; i < fl.length; i += chunk) chunks.push(fl.slice(i, i + chunk));
  const units = []; for (let sd = 1; sd <= seeds; sd++) chunks.forEach((c, i) => units.push([i, c, sd]));
  const st = new Map(cands.map(t => [t, [0, 0, 0, 0]])); let alive = cands.slice();
  for (let u = 0; u < units.length; u++) {
    const [ci, c, sd] = units[u]; const r = await evalUnit(cat, alive, ci, c, sd);
    alive.forEach((t, i) => { const a = st.get(t); for (let k = 0; k < 4; k++) a[k] += r[i][k]; });
    if (u >= 1 && alive.length > KEEP) {
      const sc = alive.map(t => { const [n, , s2, s3] = st.get(t); const p = (s2 + 0.25 * s3) / n / 1.25, se = Math.sqrt(Math.max(p * (1 - p), 0.01) / n); return { t, p, lo: p - 2.2 * se, hi: p + 2.2 * se }; }).sort((a, b) => b.p - a.p);
      const bar = sc[KEEP - 1].lo; alive = sc.filter(x => x.hi >= bar).map(x => x.t);
    }
  }
  return [...st.entries()].filter(([t]) => alive.includes(t)).map(([t, [n, win, s2, s3]]) => ({ t, n, win: win / n, s2: s2 / n, s3: s3 / n })).sort((a, b) => b.s2 - a.s2 || b.s3 - a.s3);
}
// Cartes candidates : la carte seule (x3) et la carte avec les deux meilleures, puis trios de ces cartes.
async function candidates(cat, fights) {
  const smp = shuffle(fights).slice(0, 48);
  const soloAll = new Map(), rs = await evalUnit(cat + ':solo', IDS.map(id => [id, id, id]), 0, smp, 1);
  IDS.forEach((id, i) => soloAll.set(id, rs[i][2] + 0.25 * rs[i][3] + 0.01 * rs[i][1]));
  const bySolo = IDS.slice().sort((a, b) => soloAll.get(b) - soloAll.get(a));
  const [b1, b2] = bySolo; const rep = new Map();
  const rr = await evalUnit(cat + ':rep', IDS.filter(id => id !== b1 && id !== b2).map(id => [id, b1, b2]), 0, smp, 1);
  IDS.filter(id => id !== b1 && id !== b2).forEach((id, i) => rep.set(id, rr[i][2] + 0.25 * rr[i][3]));
  const byRep = [...rep.keys()].sort((a, b) => rep.get(b) - rep.get(a));
  const pick = [...new Set([...bySolo.slice(0, NCARDS - 6), b1, b2, ...byRep.slice(0, 6), ...(SAVE.team || []).map(Number).filter(id => IDS.includes(id))])];
  const tr = []; for (let a = 0; a < pick.length; a++) for (let b = a + 1; b < pick.length; b++) for (let c = b + 1; c < pick.length; c++) tr.push([pick[a], pick[b], pick[c]]);
  return { tr, solo: bySolo.slice(0, 10) };
}
// ---------- categories de combats ----------
const W_ = G.ALL_WORLDS, enemies3 = new Map();
const nEnemies = fid => { if (!enemies3.has(fid)) { try { enemies3.set(fid, B.enemies(G.setupBattle(G.findFight(fid), [{ id: IDS[0], lv: 99, stars: 0 }], 1).st).length); } catch { enemies3.set(fid, 0); } } return enemies3.get(fid); };
const camp = [], boss = []; for (const w of W_) for (const f of w.fights) { camp.push(f.id); if (f.boss) boss.push(f.id); }
const evs = (G.EVENTS || []).filter(e => { try { return G.eventOpen(e, Date.now()); } catch { return false; } });
const evFights = ['ev-salle-boss-0', 'ev-salle-farm-0']; for (const e of evs) for (const kind of ['farm', 'boss']) for (let d = 0; d < 4; d++) { const id = `${e.id}-${kind}-${d}`; try { if (G.EVENT_FIGHTS?.[id] || G.findFight(id)) evFights.push(id); } catch {} }
const CATS = [
  ['campagne_extreme', 'Campagne, tous les combats en Extreme', camp.map(f => f + '@x')],
  ['boss_extreme', 'Boss en Extreme', boss.map(f => f + '@x')],
  ['cauchemar', 'Cauchemar Extreme, tous les combats', camp.map(f => f + '@xn')],
  ['cauchemar_multi', 'Cauchemar Extreme, 2 ennemis ou plus', camp.map(f => f + '@xn').filter(f => nEnemies(f) >= 2)],
  ['cauchemar_boss', 'Cauchemar Extreme, boss', boss.map(f => f + '@xn')],
  ['evenements', `Evenements ouverts et Salle (${evs.map(e => e.title || e.id).join(', ') || 'aucun'})`, evFights],
];
// ---------- boucle principale ----------
const hashSave = sv => sv ? JSON.stringify([Object.keys(sv.owned || {}).sort(), Object.entries(sv.lv || {}).map(([k, v]) => k + ':' + (v?.l || v)).sort(), Object.entries(sv.stars || {}).sort()]).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0) : 0;
// Analyse precedente : pour afficher l'evolution (meme categorie, meilleure equipe).
let PREC = null; try { PREC = JSON.parse(readFileSync(D('resultats', 'dernier.json'), 'utf8')); } catch {}
const report = { version, date: new Date().toISOString(), saveHash: hashSave(SAVE), reglages: WINFO, precedent: PREC ? { date: PREC.date, reglages: PREC.reglages || null, modes: Object.fromEntries(Object.entries(PREC.modes || {}).map(([n, M]) => [n, Object.fromEntries(Object.entries(M).map(([k, c]) => [k, c.top?.[0] ? { equipe: c.top[0].equipe, deuxEtoiles: c.top[0].deuxEtoiles, troisEtoiles: c.top[0].troisEtoiles, etageMoyen: c.top[0].etageMoyen, degats: c.top[0].degats } : null]))])) } : null, modes: {} };
const pct = x => (100 * x).toFixed(1) + ' %';
const niveaux = String(arg('niveaux', 'actuel,99')).split(',');
log(`moteur ${version}, ${IDS.length} cartes LR/UR/SSR, ${pool.n} fils, ${SEEDS} tirages, cache ${cache.size} resultats`);
for (const nv of niveaux) {
  LVF = nv === '99' ? () => 99 : id => SAVE.lv?.[id]?.l || 1;
  const R0 = report.modes[nv] = {};
  console.log(`\n================ Niveaux : ${nv === '99' ? 'tout au niveau 99' : 'tes niveaux actuels'} ================`);
  for (const [cat, titre, fights0] of CATS) {
    if (!fights0.length) continue;
    const fights = arg('max') ? shuffle(fights0).slice(0, +arg('max')) : fights0; // --max : test rapide
    const t1 = Date.now(), s0 = sims;
    const { tr, solo } = await candidates(cat + nv, fights);
    const res = await race(cat + nv, tr, fights);
    R0[cat] = { titre, combats: fights.length, solo: solo.map(short), top: res.slice(0, KEEP).map(r => ({ equipe: r.t.map(short), ids: r.t, deuxEtoiles: +(100 * r.s2).toFixed(1), troisEtoiles: +(100 * r.s3).toFixed(1), victoire: +(100 * r.win).toFixed(1), combatsSimules: r.n })) };
    console.log(`\n${titre} (${fights.length} combats, ${tr.length} trios testes, ${((Date.now() - t1) / 1000).toFixed(0)} s, ${sims - s0} combats simules)`);
    res.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${r.t.map(short).join(' / ')} : 2+ etoiles ${pct(r.s2)}, 3 etoiles ${pct(r.s3)}, victoire ${pct(r.win)}`));
    saveCache();
  }
  // Tour de l'infini : trio cherche pour la Tour (lib/tour.mjs), montees completes sur plusieurs tirages.
  if ((SAVE.acct?.lv || 25) >= 25 && G.setupTower) {
    const t1 = Date.now(), T = makeTour({ G, B, pool, W, ids: IDS, mk: mkTeam, actuelle: (SAVE.team || []).map(Number).filter(id => IDS.includes(id)) });
    const { fin, essais } = await T.trios({ cartes: 22, tirages: Math.max(20, SEEDS * 5) });
    R0.tour = { titre: "Tour de l'infini", trios: essais, top: fin.slice(0, 5).map(x => ({ equipe: x.t.map(short), ids: x.t, etageMoyen: +x.moy.toFixed(1), etageMin: x.min, p10: x.p10, max: x.max })), murs: T.murs(fin[0]) };
    console.log(`
Tour de l'infini (${essais} trios, ${((Date.now() - t1) / 1000).toFixed(0)} s)`);
    fin.slice(0, 5).forEach((x, i) => console.log(`  ${i + 1}. ${x.t.map(short).join(' / ')} : etage moyen ${x.moy.toFixed(1)} (min ${x.min}, max ${x.max})`));
  }
  // Boss de guilde de la semaine et Pain (evenement de guilde) : trios qui font le plus de degats en N cycles.
  const bossGuilde = async (cle, titre, gb, minLv) => {
    const t1 = Date.now(), el = IDS.filter(id => LVF(id) >= minLv), tr = []; const pick = el.slice().sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def)).slice(0, 20);
    for (let a = 0; a < pick.length; a++) for (let b = a + 1; b < pick.length; b++) for (let c = b + 1; c < pick.length; c++) tr.push([pick[a], pick[b], pick[c]]);
    if (!tr.length) return;
    const r1 = await pool.runAll(tr.map(t => ({ type: 'gw', team: mkTeam(t), seeds: [1, 2], boss: gb })), W, {}, 8);
    const s1 = tr.map((t, i) => ({ t, d: r1[i].dmg.reduce((a, b) => a + b, 0) / 2 })).sort((a, b) => b.d - a.d).slice(0, 15);
    const r2 = await pool.runAll(s1.map(x => ({ type: 'gw', team: mkTeam(x.t), seeds: Array.from({ length: 20 }, (_, i) => 100 + i), boss: gb })), W, {}, 1);
    const g = s1.map((x, i) => ({ t: x.t, d: r2[i].dmg.reduce((a, b) => a + b, 0) / 20 })).sort((a, b) => b.d - a.d);
    R0[cle] = { titre, top: g.slice(0, 5).map(x => ({ equipe: x.t.map(short), ids: x.t, degats: Math.round(x.d) })) };
    console.log(`
${titre} (${tr.length} trios, ${((Date.now() - t1) / 1000).toFixed(0)} s)`);
    g.slice(0, 5).forEach((x, i) => console.log(`  ${i + 1}. ${x.t.map(short).join(' / ')} : ${Math.round(x.d)} degats`));
  };
  if (SAVE.guild?.boss && G.setupGwBoss) await bossGuilde('guilde', `Boss de guilde ${SAVE.guild.boss.name || ''} niv ${SAVE.guild.boss.lv}`, { ...SAVE.guild.boss, turns: SAVE.guild.boss.turns || 12, cap: 300000 }, SAVE.guild.minLv || 15);
  // Pain : pendant l'evenement ; niveau exporte par le script (sinon 1). Degats sur un Pain a PV pleins, plafonnes a ses PV.
  const P = G.PAIN; if (P && G.setupPain && Date.now() >= P.FROM && Date.now() < P.UNTIL) { const lv = SAVE.pain?.lv || 1; await bossGuilde('pain', `${P.NAME} (evenement de guilde) niv ${lv}`, { pain: true, lv, hp: P.HP, turns: P.TURNS, cap: P.HP }, P.MIN_LV || 15); }
}
saveCache();
mkdirSync(D('resultats'), { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
writeFileSync(D('resultats', `tout-${stamp}.json`), JSON.stringify(report, null, 1));
writeFileSync(D('resultats', 'dernier.json'), JSON.stringify(report));
const rows = ['niveaux;categorie;rang;carte 1;carte 2;carte 3;2+ etoiles;3 etoiles;victoire;etage tour;degats guilde'];
for (const [nv, m] of Object.entries(report.modes)) for (const [cat, c] of Object.entries(m)) c.top.forEach((x, i) => rows.push([nv, cat, i + 1, ...x.equipe, x.deuxEtoiles ?? '', x.troisEtoiles ?? '', x.victoire ?? '', x.etageMoyen ?? '', x.degats ?? ''].join(';')));
writeFileSync(D('resultats', `tout-${stamp}.csv`), rows.join('\n'));
log(`termine : ${sims} combats simules, ${cacheHits} repris du cache. Resultats : resultats\\tout-${stamp}.csv et .json`);
await pool.close(); process.exit(0);
