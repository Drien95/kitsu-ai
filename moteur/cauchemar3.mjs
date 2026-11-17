// Meilleur trio pour les 3 etoiles en Campagne et en Cauchemar (Normal, Difficile, Extreme) : TOUS les trios de tes SSR/UR/LR.
// Methode (course avec elimination) : chaque trio joue les memes paquets de combats avec les memes tirages ;
// apres chaque tour (des le premier), un trio n'est abandonne que s'il est nettement derriere (borne haute sous la borne basse du
// Ke meilleur, z = 3) pour CHAQUE objectif Cauchemar (Normal, Difficile, Extreme, moyenne des trois ; les 4 premiers tours : moyenne et Normal).
// La Campagne (Normal, Difficile, Extreme) est jouee aussi mais n'elimine pas : beaucoup de trios y font 100 %, ils resteraient tous en course.
// Son classement est donc celui des finalistes du Cauchemar. Les survivants jouent
// tous les combats, puis 2 tirages de plus. Combat arrete des que les 3 etoiles sont perdues (verifie : memes 3 etoiles).
// Journal (cache/cauchemar3-*.jsonl) : rien n'est recalcule tant que le combat, la carte, son niveau, ses etoiles,
// ses collectifs, les combats et l'IA sont les memes ; il sert aussi de point de reprise apres une coupure.
//   node cauchemar3.mjs [--niveaux 99|actuel] [--difficultes toutes|cauchemar] [--garder 30] [--z 3] [--paquet 16] [--fils 11]
//   tests : --max-trios 2000 (trios au hasard)  --max-combats 160 (par difficulte)  --sans-collectifs
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { makeSim } from './lib/sim.mjs';
import { arg, log, SAVE, WA, shuffle } from './lib/commun.mjs';
import { dir as D } from './lib/chemins.mjs';
import { h53, signatureCombat, makeSigCarte, ouvrirJournal } from './lib/journal.mjs';
import { garderEveille } from './lib/eveil.mjs';

const { G, B, version } = await loadEngine(); const CH = G.CHAR_BY_ID, SIM = makeSim(G, B);
const NIV = String(arg('niveaux', '99')), K = +arg('garder', 30), Z = +arg('z', 3), PAQ = +arg('paquet', 16);
// Ordre fixe : les 3 Cauchemar d'abord (cles du journal et resultats inchanges), puis la Campagne si demandee.
const TOUTES = String(arg('difficultes', 'toutes')) !== 'cauchemar';
const DIFF = [['normal', '@n'], ['difficile', '@hn'], ['extreme', '@xn'], ...(TOUTES ? [['campNormal', ''], ['campDifficile', '@h'], ['campExtreme', '@x']] : [])], ND = DIFF.length;
// Objectifs : { nom, difficultes moyennees, elimine }. Les noms Normal/Difficile/Extreme/Moyenne restent ceux du Cauchemar.
const OBJS = [{ k: 'Normal', d: [0], e: 1 }, { k: 'Difficile', d: [1], e: 1 }, { k: 'Extreme', d: [2], e: 1 }, { k: 'Moyenne', d: [0, 1, 2], e: 1 },
  ...(TOUTES ? [{ k: 'CampNormal', d: [3] }, { k: 'CampDifficile', d: [4] }, { k: 'CampExtreme', d: [5] }, { k: 'Les6', d: [0, 1, 2, 3, 4, 5] }] : [])], OBJ = OBJS.map(o => o.k), IMOY = 3;
const LV = id => NIV === '99' ? 99 : (SAVE.lv?.[id]?.l || 1), ET = id => SAVE.stars?.[id] || 0, LK = id => SAVE.lk?.[id] || null;
const nom = id => CH[id]?.n || String(id), noms = t => t.map(nom).join(' / ');
const IDS = Object.keys(SAVE.owned || {}).map(Number).filter(id => ['M', 'L', 'E'].includes(CH[id]?.r)).sort((a, b) => a - b);
if (IDS.length < 3) { console.log('Il faut au moins 3 cartes SSR/UR/LR dans la sauvegarde exportee.'); process.exit(1); }

// ---------- trios, combats, cles du journal ----------
const sigCarte = makeSigCarte(G, B), sigG = signatureCombat(G, B, SIM, WA), wKey = h53(JSON.stringify(WA));
const carte = (id, lk = LK(id)) => ({ id, lv: LV(id), stars: ET(id), ...(lk ? { lk } : {}) });
const cleCarte = (id, lk = LK(id)) => `${id}:${LV(id)}:${ET(id)}:${(lk || []).join('+')}:${sigCarte(id)}`;
let trios = []; for (let a = 0; a < IDS.length; a++) for (let b = a + 1; b < IDS.length; b++) for (let c = b + 1; c < IDS.length; c++) trios.push([IDS[a], IDS[b], IDS[c]]);
if (arg('max-trios')) trios = shuffle(trios, 5).slice(0, +arg('max-trios'));
const T = trios.length, cleTrio = trios.map(t => t.map(id => cleCarte(id)).sort().join(','));
// Signature d'un combat : les ennemis tels que le jeu les met en place (stats, niveau, boss).
const sigCombat = f => { try { return f + JSON.stringify(B.enemies(G.setupBattle(G.findFight(f), [{ id: IDS[0], lv: 1, stars: 0 }], 1).st).map(e => [e.id, e.name, e.lv, e.atk, e.def, e.maxHp, e.spd, e.boss ? 1 : 0])); } catch { return f; } };
const camp = G.ALL_WORLDS.filter(w => w.id !== 'halloween').flatMap(w => w.fights.map(f => f.id));
const paquets = DIFF.map(([d, suf], di) => {
  let fl = shuffle(camp.map(f => f + suf).filter(f => { try { return !!G.findFight(f); } catch { return false; } }), 101 + di);
  if (arg('max-combats')) fl = fl.slice(0, +arg('max-combats'));
  const out = []; for (let i = 0; i < fl.length; i += PAQ) { const f = fl.slice(i, i + PAQ); out.push({ f, cle: h53(d + '#' + f.map(sigCombat).join('|')) }); }
  return out;
});
const NCOMB = paquets.map(p => p.reduce((s, x) => s + x.f.length, 0)), TOURS = Math.max(...paquets.map(p => p.length));
const J = ouvrirJournal(D('cache', `cauchemar3-${sigG}-${wKey}.jsonl`));
const cle = (di, pi, seed, ck) => h53(`${sigG}|${wKey}|${paquets[di][pi].cle}|${seed}|${ck}`);

// ---------- calcul d'un lot (journal d'abord, combats manquants en parallele) ----------
const pool = await makePool(arg('fils') ? +arg('fils') : undefined, version);
let simules = 0, repris = 0;
async function jouer(items) { // items : { di, pi, seed, team, ck } -> [n, s3]
  const out = new Array(items.length), todo = [];
  items.forEach((x, i) => { const k = cle(x.di, x.pi, x.seed, x.ck), v = J.get(k); if (v) { out[i] = v.split(',').map(Number); repris++; } else todo.push([i, k]); });
  for (let a = 0; a < todo.length; a += 24000) {
    const part = todo.slice(a, a + 24000);
    const r = await pool.runAll(part.map(([i]) => ({ team: items[i].team, fights: paquets[items[i].di][items[i].pi].f, seeds: [items[i].seed] })), WA, { stop3: true }, 40);
    r.forEach((x, j) => { out[part[j][0]] = [x.n, x.s3]; J.set(part[j][1], x.n + ',' + x.s3); simules += x.n; });
    J.flush();
  }
  return out;
}

// ---------- course avec elimination ----------
const N = new Uint32Array(T * ND), S3 = new Uint32Array(T * ND);
const score = (t, o) => { // proportion de 3 etoiles et erreur type, par difficulte ou en moyenne
  const ps = OBJS[o].d; let p = 0, v = 0;
  for (const d of ps) { const n = N[t * ND + d], q = n ? S3[t * ND + d] / n : 0, qq = (S3[t * ND + d] + 1) / (n + 2); p += q; v += qq * (1 - qq) / Math.max(1, n); }
  return { p: p / ps.length, se: Math.sqrt(v) / ps.length };
};
// Les 4 premiers tours, seuls la moyenne et le Normal eliminent : en Extreme, les 3 etoiles sont si rares au debut
// que personne ne peut etre ecarte, et presque tous les trios resteraient en course pour rien.
function eliminer(alive, pi) {
  if (alive.length <= K) return alive;
  const garde = new Uint8Array(T);
  for (const o of pi < 4 ? [IMOY, 0] : OBJS.map((x, i) => x.e ? i : -1).filter(i => i >= 0)) {
    const sc = alive.map(t => ({ t, ...score(t, o) })); const lo = sc.map(x => x.p - Z * x.se).sort((a, b) => b - a), bar = lo[Math.min(K, lo.length) - 1];
    for (const x of sc) if (x.p + Z * x.se >= bar) garde[x.t] = 1;
  }
  return alive.filter(t => garde[t]);
}
async function tour(alive, pi, seed) {
  const items = [], idx = [];
  for (const t of alive) for (let di = 0; di < ND; di++) if (paquets[di][pi]) { items.push({ di, pi, seed, team: trios[t].map(id => carte(id)), ck: cleTrio[t] }); idx.push(t * ND + di); }
  for (let a = 0; a < items.length; a += 60000) {
    const r = await jouer(items.slice(a, a + 60000));
    r.forEach(([n, s3], j) => { N[idx[a + j]] += n; S3[idx[a + j]] += s3; });
    if (Date.now() - dernierLog > 60000 && items.length > 60000) { dernierLog = Date.now(); log(`  tour ${pi + 1} : ${Math.min(items.length, a + 60000)} / ${items.length} paquets, ${Math.round(simules / ((Date.now() - T0) / 1000))} combats/s`); }
  }
}

const eveil = garderEveille(), T0 = Date.now(); let dernierLog = Date.now();
log(`moteur ${version} (signature combat ${sigG}), ${IDS.length} cartes, ${T} trios, niveaux ${NIV === '99' ? '99' : 'actuels'}, combats ${NCOMB.join(' / ')} (${DIFF.map(d => d[0]).join(' / ')}), ${pool.n} fils, journal ${J.taille()} paquets${eveil.ok ? ', PC garde eveille' : ''}`);
let alive = [...Array(T).keys()]; const entonnoir = [];
for (let pi = 0; pi < TOURS; pi++) {
  await tour(alive, pi, 1);
  const avant = alive.length; alive = eliminer(alive, pi); entonnoir.push(alive.length);
  const ecoule = (Date.now() - T0) / 1000, vit = simules / Math.max(1, ecoule);
  log(`tour ${pi + 1}/${TOURS} : ${avant} -> ${alive.length} trios en course, ${simules} combats simules (${Math.round(vit)}/s), ${repris} paquets repris du journal`);
}
// Finale : 2 tirages de plus sur tous les combats pour les survivants (le hasard du combat compte).
for (const seed of [2, 3]) for (let pi = 0; pi < TOURS; pi++) await tour(alive, pi, seed);
log(`finale : ${alive.length} trios, ${simules} combats simules au total`);

// ---------- classement et detail complet des meilleurs (combat complet : 3 et 2 etoiles, victoires, par monde, boss) ----------
const top = (o, n = 10) => alive.map(t => ({ t, ...score(t, o) })).sort((a, b) => b.p - a.p).slice(0, n);
const tops = OBJ.map((_, o) => top(o));
const MONDES = G.ALL_WORLDS.filter(w => w.id !== 'halloween').map(w => ({ id: w.id, nom: w.name || w.title || w.id }));
const mondeDe = new Map(), bossDe = new Set();
for (const w of G.ALL_WORLDS) for (const f of w.fights) { for (const [, suf] of DIFF) { mondeDe.set(f.id + suf, w.id); if (f.boss) bossDe.add(f.id + suf); } }
const pc1 = (a, n) => n ? +(100 * a / n).toFixed(1) : null;
// Un trio joue tous les combats (tirage 1) ; resultats regroupes par difficulte, par monde et boss / autres.
async function complet(tr, lvf = LV) {
  const team = tr.map(id => ({ id, lv: lvf(id), stars: ET(id), ...(LK(id) ? { lk: LK(id) } : {}) })), groupes = [];
  DIFF.forEach((_, di) => { const fl = paquets[di].flatMap(p => p.f), g = new Map(); for (const f of fl) { const k = mondeDe.get(f) + '|' + (bossDe.has(f) ? 1 : 0); (g.get(k) || g.set(k, []).get(k)).push(f); } for (const [k, f] of g) groupes.push({ di, monde: k.split('|')[0], boss: k.endsWith('|1'), f }); });
  const r = await pool.runAll(groupes.map(g => ({ team, fights: g.f, seeds: [1] })), WA, {}, 2);
  return DIFF.map(([d], di) => {
    const acc = (filt) => { let n = 0, s3 = 0, s2 = 0, win = 0; groupes.forEach((g, i) => { if (g.di === di && filt(g)) { n += r[i].n; s3 += r[i].s3; s2 += r[i].s2; win += r[i].win; } }); return { n, troisEtoiles: pc1(s3, n), deuxEtoiles: pc1(s2, n), victoire: pc1(win, n) }; };
    return { difficulte: d, ...acc(() => true), boss: acc(g => g.boss), autres: acc(g => !g.boss), mondes: Object.fromEntries(MONDES.map(m => [m.id, acc(g => g.monde === m.id)])) };
  });
}
const details = new Map();
for (const t of new Set(tops.flatMap(x => x.map(y => y.t)))) details.set(t, await complet(trios[t]));
const LVA = id => SAVE.lv?.[id]?.l || 1;
const ligne = (x, o) => ({ equipe: trios[x.t].map(nom), ids: trios[x.t], niveaux: trios[x.t].map(LVA), etoiles: trios[x.t].map(ET), troisEtoiles: +(100 * x.p).toFixed(1), marge: +(200 * x.se).toFixed(1), objectif: OBJ[o], parDifficulte: details.get(x.t) });
log(`detail complet : ${details.size} trios`);
// Ton equipe (niveaux actuels et niveau 99) et les 5 meilleurs trios a tes niveaux actuels : ce qui est faisable tout de suite.
const equipe = (SAVE.team || []).map(Number).filter(id => CH[id]);
const equipeActuelle = equipe.length === 3 ? { equipe: equipe.map(nom), ids: equipe, niveaux: equipe.map(LVA), actuel: await complet(equipe, LVA), niveau99: await complet(equipe, () => 99) } : null;
const maintenant = []; for (const x of tops[IMOY].slice(0, 5)) maintenant.push({ equipe: trios[x.t].map(nom), ids: trios[x.t], niveaux: trios[x.t].map(LVA), parDifficulte: await complet(trios[x.t], LVA) });
// Cartes qui reviennent le plus dans les 50 meilleurs trios de chaque objectif.
const cartesCles = Object.fromEntries(OBJ.map((o, i) => { const c = new Map(); for (const x of top(i, 50)) for (const id of trios[x.t]) c.set(id, (c.get(id) || 0) + 1); return [o, [...c].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, k]) => ({ id, carte: nom(id), rarete: CH[id].r, niveau: LVA(id), dans: k }))]; }));
// Repartition des 3 etoiles (moyenne) chez les finalistes.
const repartition = Array(20).fill(0); for (const t of alive) repartition[Math.min(19, Math.floor(score(t, IMOY).p * 20))]++;

// ---------- collectifs des 5 meilleurs trios (moyenne) : cartes qui ont plus de 6 collectifs possibles ----------
const comb = (a, k) => { const r = []; const f = (s, c) => { if (c.length === k) { r.push(c); return; } for (let i = s; i < a.length && r.length < 252; i++) f(i + 1, [...c, a[i]]); }; f(0, []); return r; };
async function note3(tr, lk, nPaq = TOURS) { // 3 etoiles moyennes sur les 3 difficultes du Cauchemar, tirage 1
  const items = []; for (let pi = 0; pi < nPaq; pi++) for (let di = 0; di < 3; di++) if (paquets[di][pi]) items.push({ di, pi, seed: 1, team: tr.map(id => carte(id, lk[id] || LK(id))), ck: tr.map(id => cleCarte(id, lk[id] || LK(id))).sort().join(',') });
  const r = await jouer(items); const n = [0, 0, 0], s = [0, 0, 0]; r.forEach(([a, b], i) => { n[items[i].di] += a; s[items[i].di] += b; });
  const ps = [0, 1, 2].map(d => s[d] / Math.max(1, n[d])), se = Math.sqrt([0, 1, 2].reduce((v, d) => v + ps[d] * (1 - ps[d]) / Math.max(1, n[d]), 0)) / 3;
  return { p: (ps[0] + ps[1] + ps[2]) / 3, se };
}
const collectifs = [];
if (!arg('sans-collectifs') && G.activeLinks && G.linkKey) for (const x of tops[IMOY].slice(0, 5)) {
  const tr = trios[x.t], choix = {}, lignes = [];
  for (const id of tr) {
    const mine = G.activeLinks(tr).filter(l => l.ids.includes(id)); if (mine.length <= (G.LINK_CAP || 6)) continue;
    const cs = comb(mine.map(l => G.linkKey(l)), G.LINK_CAP || 6), crible = [];
    for (const c of cs) crible.push({ c, ...(await note3(tr, { ...choix, [id]: c }, 2)) });
    crible.sort((a, b) => b.p - a.p);
    const base = await note3(tr, choix), alt = []; for (const y of crible.slice(0, 4)) alt.push({ c: y.c, ...(await note3(tr, { ...choix, [id]: y.c })) });
    alt.sort((a, b) => b.p - a.p); const best = alt[0], utile = best && best.p - base.p > 2 * Math.hypot(best.se, base.se);
    if (utile) choix[id] = best.c;
    const label = k => { const l = mine.find(m => G.linkKey(m) === k); return l ? `${l.name} (+${l.pct} % ${l.stat})` : k; };
    lignes.push({ carte: nom(id), possibles: mine.length, avant: +(100 * base.p).toFixed(1), apres: +(100 * (best?.p ?? base.p)).toFixed(1), utile: !!utile, conseil: (best?.c || []).map(label) });
  }
  if (lignes.length) collectifs.push({ equipe: tr.map(nom), cartes: lignes });
}

// ---------- resultats ----------
const out = { version, signatureCombat: sigG, date: new Date().toISOString(), niveaux: NIV, cartes: IDS.length, trios: T, combats: Object.fromEntries(DIFF.map(([d], i) => [d, NCOMB[i]])), difficultes: DIFF.map(d => d[0]),
  finalistes: alive.length, combatsSimules: simules, paquetsRepris: repris, duree: Math.round((Date.now() - T0) / 1000),
  vitesse: Math.round(simules / Math.max(1, (Date.now() - T0) / 1000)), entonnoir, mondes: MONDES, repartition,
  meilleurs: Object.fromEntries(OBJ.map((o, i) => [o, tops[i].map(x => ligne(x, i))])), equipeActuelle, maintenant, cartesCles, collectifs };
mkdirSync(D('resultats'), { recursive: true }); writeFileSync(D('resultats', 'cauchemar3.json'), JSON.stringify(out, null, 1));
for (const [o, l] of Object.entries(out.meilleurs)) { log(`== 3 etoiles, ${o} ==`); l.slice(0, 5).forEach((x, i) => log(`  ${i + 1}. ${x.equipe.join(' / ')} : ${x.troisEtoiles} % (+/- ${x.marge}) | ${x.parDifficulte.map(d => `${d.difficulte} ${d.troisEtoiles} / 2* ${d.deuxEtoiles}`).join(', ')}`)); }
for (const c of collectifs) for (const l of c.cartes) log(`collectifs ${c.equipe.join(' / ')}, ${l.carte} : 3 etoiles ${l.avant} -> ${l.apres} %${l.utile ? ' : ' + l.conseil.join(', ') : ' (pas mieux que les tiens)'}`);
log(`termine en ${out.duree} s : resultats\\cauchemar3.json`);
eveil.fin(); await pool.close(); process.exit(0);
