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
//   par combat (lib/etages.mjs) : [--budget-specialistes 60] (minutes) [--candidats-etages 120] [--seuil 60] [--sans-etages] [--sans-diagnostic]
//   tests : --max-trios 2000 (trios au hasard)  --max-combats 160 (par difficulte)  --sans-collectifs  --sans-liens
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { makeSim } from './lib/sim.mjs';
import { arg, log, SAVE, WA as WA_PC, WC, shuffle } from './lib/commun.mjs';
import * as PARTAGE from './lib/partage.mjs';
import { dir as D } from './lib/chemins.mjs';
import { h53, signatureCombat, makeSigCarte, ouvrirJournal } from './lib/journal.mjs';
import { cleTrioDe } from './lib/partage-format.mjs';
import { construireWC, iaPersoMeilleure } from './lib/ia-commune.mjs';
import { garderEveille } from './lib/eveil.mjs';
import { parCombat } from './lib/etages.mjs';
import { diagnostiquer } from './lib/diagnostic.mjs';
import { chercherLiens, ciblesDuPlan } from './lib/liens.mjs';

const { G, B, version } = await loadEngine(); const CH = G.CHAR_BY_ID, SIM = makeSim(G, B);
const NIV = String(arg('niveaux', '99')), K = +arg('garder', 30), Z = +arg('z', 3), PAQ = +arg('paquet', 16);
// Ordre fixe : les 3 Cauchemar d'abord (cles du journal et resultats inchanges), puis la Campagne si demandee.
const TOUTES = String(arg('difficultes', 'toutes')) !== 'cauchemar';
const DIFF = [['normal', '@n'], ['difficile', '@hn'], ['extreme', '@xn'], ...(TOUTES ? [['campNormal', ''], ['campDifficile', '@h'], ['campExtreme', '@x']] : [])], ND = DIFF.length;
// Objectifs : { nom, difficultes moyennees, elimine }. Les noms Normal/Difficile/Extreme/Moyenne restent ceux du Cauchemar.
const OBJS = [{ k: 'Normal', d: [0], e: 1 }, { k: 'Difficile', d: [1], e: 1 }, { k: 'Extreme', d: [2], e: 1 }, { k: 'Moyenne', d: [0, 1, 2], e: 1 },
  ...(TOUTES ? [{ k: 'CampNormal', d: [3] }, { k: 'CampDifficile', d: [4] }, { k: 'CampExtreme', d: [5] }, { k: 'Les6', d: [0, 1, 2, 3, 4, 5] }] : [])], OBJ = OBJS.map(o => o.k), IMOY = 3;
const DIS_TOUTES = DIFF.map((_, i) => i), DIS_ELIM = DIS_TOUTES.filter(i => i < 3), DIS_CAMP = DIS_TOUTES.filter(i => i >= 3);
const LV = id => NIV === '99' ? 99 : (SAVE.lv?.[id]?.l || 1), ET = id => SAVE.stars?.[id] || 0, LK = id => SAVE.lk?.[id] || null;
const nom = id => CH[id]?.n || String(id), noms = t => t.map(nom).join(' / ');
// Partage des calculs (Reglages > Partage, coupe par defaut) : seulement avec les reglages standard du calcul,
// et toujours avec l'IA commune (poids-communs.json), sinon les resultats ne se recoupent pas d'un PC a l'autre.
const PART = PARTAGE.reglagesPartage();
// IA commune : celle publiee sur le serveur (cache si pas d'internet), sinon celle livree avec l'appli.
const PART_ON = !arg('sans-partage') && (PART.utiliser || PART.envoyer || PART.verifier);
const IAC = PART_ON ? await PARTAGE.iaCommune(PART) : null, WCX = IAC ? construireWC(IAC.p) : WC;
// Ton IA nettement meilleure que l'IA commune (derniere comparaison, memes IA) : la Campagne tourne avec la tienne et
// ce calcul ne partage rien (ses resultats ne se recoupent pas avec la base). Le partage reprend quand tu la publies.
const MIENNE = PART_ON && !!WCX && iaPersoMeilleure((() => { try { return JSON.parse(readFileSync(D('resultats', 'comparaison-ia.json'), 'utf8')); } catch { return null; } })(), WA_PC, WCX);
const PARTAGE_OK = PART_ON && !!WCX && !MIENNE && (PAQ === 16 && !arg('max-combats') && !arg('max-trios') || !!arg('partage-test'));
const WA = PARTAGE_OK ? WCX : WA_PC;
// 5.41.2 : pourquoi ce calcul ne partage pas (affiche dans la Base commune, Campagne), null s'il partage.
const COUPE = PARTAGE_OK ? null : arg('sans-partage') ? 'lance sans partage' : !PART_ON ? 'base commune coupee au lancement du calcul (Reglages)' : MIENNE ? 'ton IA est nettement meilleure que l IA commune : calcul avec la tienne' : !WCX ? 'IA commune absente' : 'reglages de test ou paquet non standard';
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
const sigCombat0 = f => { try { return f + JSON.stringify(B.enemies(G.setupBattle(G.findFight(f), [{ id: IDS[0], lv: 1, stars: 0 }], 1).st).map(e => [e.id, e.name, e.lv, e.atk, e.def, e.maxHp, e.spd, e.boss ? 1 : 0])); } catch { return f; } };
const sigCache = new Map(), sigCombat = f => sigCache.get(f) ?? sigCache.set(f, sigCombat0(f)).get(f);
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

// ---------- base commune : recuperer, envoyer, controler ----------
const carteLot = (c) => [c.id, c.lv, c.stars, c.lk || [], sigCarte(c.id)];
let aEnvoyer = [], envoyes = 0, recus = 0;
const versionPartage = { sigG, wKey, moteur: String(version) };
function versFile(tout = false) {
  if (!PARTAGE_OK || !PART.envoyer) { aEnvoyer = []; return; }
  while (aEnvoyer.length >= 20000 || (tout && aEnvoyer.length)) { const part = aEnvoyer.splice(0, 20000); PARTAGE.mettreEnFile(PARTAGE.construireLot(versionPartage, part)); envoyes += part.length; }
}
// Rejoue des lignes du lot d'un autre joueur (controle). null si ce PC ne peut pas : carte ou combats differents (autre version).
async function rejouerLignes(lot, lignes) {
  const jobs = [];
  for (const [ti, pj, g] of lignes) {
    const tr = lot.t[ti], [di, pi, cp] = lot.p[pj];
    if (paquets[di]?.[pi]?.cle !== cp || !tr.every(c => CH[c[0]] && sigCarte(c[0]) === c[4])) return null;
    jobs.push({ team: tr.map(([id, lv, stars, lk]) => ({ id, lv, stars, ...(lk.length ? { lk } : {}) })), fights: paquets[di][pi].f, seeds: [g] });
  }
  return (await pool.runAll(jobs, WA, { stop3: true }, 8)).map(x => [x.n, x.s3]);
}

// ---------- etoiles combat par combat deja jouees (5.27) ----------
// La course joue deja chaque trio sur chaque combat (tirage 1 ; tirages 2 et 3 pour les finalistes). On garde l'etoile de chaque
// combat : les etapes par combat (lib/etages.mjs) la reprennent au lieu de rejouer le meme trio sur le meme combat avec la meme
// graine (resultat identique, le simulateur est deterministe). Tirage 1 : 1 octet par trio et par combat ; tirages 2 et 3 :
// seulement les trios qui les jouent (finalistes).
const OFF = DIFF.map(() => []); let NFT = 0; paquets.forEach((ps, di) => ps.forEach((p, pi) => { OFF[di][pi] = NFT; NFT += p.f.length; }));
const VU1 = new Uint8Array(T * NFT), VU23 = new Map();
let vusReutilises = 0;
function noter(t, di, pi, seed, st) {
  if (t == null || typeof st !== 'string' || st.length !== paquets[di][pi].f.length) return;
  if (seed === 1) { const b = t * NFT + OFF[di][pi]; for (let k = 0; k < st.length; k++) VU1[b + k] = st[k] === '3' ? 2 : 1; }
  else if (seed === 2 || seed === 3) VU23.set(`${t}|${di}|${pi}|${seed}`, st);
}
// Etoiles d'un trio sur un paquet pour une graine (chaine '3'/'0' par combat), ou null si pas encore joue.
function connu(t, di, pi, seed) {
  if (seed === 1) { const b = t * NFT + OFF[di][pi], n = paquets[di][pi].f.length; let st = ''; for (let k = 0; k < n; k++) { const v = VU1[b + k]; if (!v) return null; st += v === 2 ? '3' : '0'; } vusReutilises += n; return st; }
  const st = VU23.get(`${t}|${di}|${pi}|${seed}`); if (st) vusReutilises += st.length; return st || null;
}
// Tirage 1 d'un trio sur un combat (index global, meme ordre que lib/etages.mjs) : 0 inconnu, 1 pas 3 etoiles, 2 trois etoiles.
const connu1 = (t, fi) => { const v = VU1[t * NFT + fi]; if (v) vusReutilises++; return v; };

// ---------- calcul d'un lot (journal d'abord, combats manquants en parallele) ----------
const pool = await makePool(arg('fils') ? +arg('fils') : undefined, version);
let simules = 0, repris = 0;
async function jouer(items) { // items : { di, pi, seed, team, ck, t? } -> [n, s3]
  const out = new Array(items.length), todo = [];
  items.forEach((x, i) => { const k = cle(x.di, x.pi, x.seed, x.ck), v = J.get(k); if (v) { const a = v.split(','); out[i] = [+a[0], +a[1]]; noter(x.t, x.di, x.pi, x.seed, a[2]); repris++; } else todo.push([i, k]); });
  for (let a = 0; a < todo.length; a += 24000) {
    const part = todo.slice(a, a + 24000);
    // Type 'etoiles' : meme simulation, mais l'etoile de chaque combat revient aussi (n = combats, s3 = combats a 3 etoiles).
    const r = (await pool.runAll(part.map(([i]) => ({ type: 'etoiles', team: items[i].team, fights: paquets[items[i].di][items[i].pi].f, seeds: [items[i].seed] })), WA, { stop3: true }, 40))
      .map(y => ({ n: y.st.length, s3: [...y.st].filter(c => c === '3').length, st: y.st }));
    r.forEach((x, j) => { out[part[j][0]] = [x.n, x.s3]; J.set(part[j][1], x.n + ',' + x.s3 + ',' + x.st); simules += x.n; noter(items[part[j][0]].t, items[part[j][0]].di, items[part[j][0]].pi, items[part[j][0]].seed, x.st);
      const it = items[part[j][0]]; if (PARTAGE_OK && PART.envoyer && it.seed <= 3) { const cartes = it.team.map(carteLot); if (cleTrioDe(cartes) === it.ck) aEnvoyer.push({ cartes, di: it.di, pi: it.pi, clePaquet: paquets[it.di][it.pi].cle, graine: it.seed, n: x.n, s3: x.s3 }); } });
    J.flush(); versFile();
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
async function tour(alive, pi, seed, dis = DIS_TOUTES) {
  const items = [], idx = [];
  for (const t of alive) for (const di of dis) if (paquets[di][pi]) { items.push({ di, pi, seed, team: trios[t].map(id => carte(id)), ck: cleTrio[t], t }); idx.push(t * ND + di); }
  for (let a = 0; a < items.length; a += 60000) {
    const r = await jouer(items.slice(a, a + 60000));
    r.forEach(([n, s3], j) => { N[idx[a + j]] += n; S3[idx[a + j]] += s3; });
    if (Date.now() - dernierLog > 60000 && items.length > 60000) { dernierLog = Date.now(); log(`  tour ${pi + 1} : ${Math.min(items.length, a + 60000)} / ${items.length} paquets, ${Math.round(simules / ((Date.now() - T0) / 1000))} combats/s`); }
  }
}

const eveil = garderEveille(), T0 = Date.now(); let dernierLog = Date.now();
log(`moteur ${version} (signature combat ${sigG}), ${IDS.length} cartes, ${T} trios, niveaux ${NIV === '99' ? '99' : 'actuels'}, combats ${NCOMB.join(' / ')} (${DIFF.map(d => d[0]).join(' / ')}), ${pool.n} fils, journal ${J.taille()} paquets${eveil.ok ? ', PC garde eveille' : ''}`);
if (PARTAGE_OK) {
  log(`partage : IA commune ${IAC ? (IAC.source === 'serveur' ? 'du serveur' : 'du serveur (copie locale)') : 'livree avec l appli'}${JSON.stringify(WCX) === JSON.stringify(WA_PC) ? ' (la tienne)' : ' (differente de la tienne pour ce calcul)'}, ${PART.utiliser ? 'base utilisee' : 'base non utilisee'}, ${PART.envoyer ? 'envoi actif' : 'pas d envoi'}`);
  try { const n = await PARTAGE.viderFile(PART, log); if (n) log(`partage : ${n} lots en attente envoyes`); } catch (e) { log('partage : envoi impossible (' + e.message + ')'); }
  if (PART.utiliser) try {
    const mien = new Map(IDS.map(id => [id, cleCarte(id)]));
    await PARTAGE.telecharger(PART, versionPartage, { cleCarteLocale: id => mien.get(id) || null, log,
      onLigne: x => { if (paquets[x.di]?.[x.pi]?.cle !== x.clePaquet) return; const k = cle(x.di, x.pi, x.graine, x.ck); if (!J.get(k)) { J.set(k, x.n + ',' + x.s3); recus++; } } });
    J.flush(); log(`partage : ${recus} resultats ajoutes au journal depuis la base commune`);
  } catch (e) { PARTAGE.noter('erreur', { quoi: 'base injoignable au debut du calcul' }); log('partage : base injoignable, calcul local seul (' + e.message + ')'); }
} else { log(`partage : coupe pour ce calcul (${COUPE})`); if (PART_ON) PARTAGE.noter('coupe', { quoi: COUPE }); }
// 5.27 : la Campagne (Normal, Difficile, Extreme) n'elimine personne : pendant la course, seuls les Cauchemar sont joues ;
// les finalistes jouent ensuite la Campagne avec les memes graines (memes resultats pour eux, moitie moins de combats pour les autres).
let alive = [...Array(T).keys()]; const entonnoir = [];
for (let pi = 0; pi < TOURS; pi++) {
  await tour(alive, pi, 1, DIS_ELIM);
  const avant = alive.length; alive = eliminer(alive, pi); entonnoir.push(alive.length);
  const ecoule = (Date.now() - T0) / 1000, vit = simules / Math.max(1, ecoule);
  log(`tour ${pi + 1}/${TOURS} : ${avant} -> ${alive.length} trios en course, ${simules} combats simules (${Math.round(vit)}/s), ${repris} paquets repris du journal`);
}
if (DIS_CAMP.length) { for (let pi = 0; pi < TOURS; pi++) await tour(alive, pi, 1, DIS_CAMP); log(`Campagne : ${alive.length} finalistes, tirage 1`); }
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

// ---------- meilleur trio par combat (lib/etages.mjs) ----------
// Trios que le script Tampermonkey essaie sur l'ecran d'equipe : ceux de tes 10 cartes les plus fortes (meme formule que pool(10)).
const force = id => { const c = CH[id]; let st; try { st = G.statsAt(c, LVA(id), ET(id)); } catch { st = { atk: c.atk, def: c.def }; } return (st.atk + st.def) * (c.hpK || 1.1) * ({ M: 1.25, L: 1.15, E: 1.1 }[c.r] || 1); };
const dix = new Set(IDS.slice().sort((a, b) => force(b) - force(a)).slice(0, 10)), indexTrio = new Map(trios.map((t, i) => [t.join('-'), i]));
const scriptSet = new Set(trios.map((t, i) => t.every(id => dix.has(id)) ? i : -1).filter(i => i >= 0));
let etages = null;
if (!arg('sans-etages')) {
  const objE = TOUTES ? OBJ.indexOf('Les6') : IMOY, enCourse = new Set(alive), NCE = +arg('candidats-etages', 120);
  const classes = [...Array(T).keys()].filter(t => N[t * ND]).map(t => ({ t, a: enCourse.has(t) ? 1 : 0, ...score(t, objE) })).sort((x, y) => y.a - x.a || (y.p - Z * y.se) - (x.p - Z * x.se));
  const cur = indexTrio.get(equipe.slice().sort((a, b) => a - b).join('-'));
  const cands = [...new Set([...classes.slice(0, NCE).map(x => x.t), ...scriptSet, ...(cur != null ? [cur] : [])])];
  const sigColl = h53(IDS.map(id => cleCarte(id)).join(','));
  etages = await parCombat({ pool, J, WA, paquets, DIFF, trios, cleTrio, equipeDe: t => trios[t].map(id => carte(id)), cands, scriptSet, sigG, wKey, sigColl, sigCombat, log,
    seuil: +arg('seuil', 60) / 100, budget: +arg('budget-specialistes', 60), connu, connu1, dejaAu99: id => (SAVE.lv?.[id]?.l || 1) >= 99 });
  etages.scriptCartes = [...dix].map(nom); etages.reprisCourse = vusReutilises;
  log(`par combat : ${vusReutilises} combats repris de la course au lieu d'etre rejoues`);
  // 5.41 : liens actifs a cocher pour les trios du plan dont une carte a plus de 6 liens (lib/liens.mjs), sur leurs combats.
  if (!arg('sans-liens') && G.activeLinks && G.linkPlan) try {
    const cibles = ciblesDuPlan(G, etages);
    if (cibles.length) { log(`liens : ${cibles.length} trio(s) du plan avec une carte a plus de ${G.LINK_CAP || 6} liens actifs`); etages.liens = await chercherLiens({ G, pool, WA, cibles, carte, lkDe: LK, nom, seuil: +arg('seuil', 60) / 100, log }); }
  } catch (e) { log('liens reportes (' + e.message + ')'); }
  // Nom, monde et place de chaque combat de base, pour l'affichage par etage.
  etages.infos = {}; const vus = new Set(etages.combats.map(c => c[8])); for (const w of G.ALL_WORLDS) for (const f of w.fights) if (vus.has(f.id)) etages.infos[f.id] = [w.id, f.idx ?? w.fights.indexOf(f), f.t || f.id, f.boss ? 1 : 0];
}

// ---------- resultats ----------
const out = { version, signatureCombat: sigG, date: new Date().toISOString(), niveaux: NIV, cartes: IDS.length, trios: T, combats: Object.fromEntries(DIFF.map(([d], i) => [d, NCOMB[i]])), difficultes: DIFF.map(d => d[0]),
  finalistes: alive.length, combatsSimules: simules, paquetsRepris: repris, duree: Math.round((Date.now() - T0) / 1000),
  vitesse: Math.round(simules / Math.max(1, (Date.now() - T0) / 1000)), entonnoir, mondes: MONDES, repartition,
  meilleurs: Object.fromEntries(OBJ.map((o, i) => [o, tops[i].map(x => ligne(x, i))])), equipeActuelle, maintenant, cartesCles, collectifs, etages };
// Base commune : envoi de ce qui reste, puis quelques controles du travail des autres.
if (PARTAGE_OK) {
  versFile(true);
  if (PART.envoyer) try { const n = await PARTAGE.viderFile(PART, log); log(`partage : ${envoyes} resultats mis en file, ${n} lots envoyes`); } catch (e) { log('partage : envoi reporte (' + e.message + ')'); }
  if (PART.verifier) try { await PARTAGE.controler(PART, versionPartage, rejouerLignes, { max: PARTAGE.identite().admin && PART.controler ? 40 : 2, log }); } catch (e) { log('partage : controles reportes (' + e.message + ')'); }
  if (PARTAGE.identite().admin && PART.controler) try { await PARTAGE.regrouper(PART, { log }); } catch (e) { log('partage : regroupement reporte (' + e.message + ')'); }
}
out.partage = PARTAGE_OK ? { recus, envoyes, ia: 'commune' } : { coupe: COUPE };
// Pourquoi la 3e etoile saute sur les combats sous le seuil (lib/diagnostic.mjs, un seul fil, de l'ordre de la minute).
if (etages && !arg('sans-diagnostic')) try { etages.diagnostic = diagnostiquer(G, B, SIM, SIM.smartPol(WA), out, ids => ids.map(id => carte(id)), { log }); if (etages.diagnostic) etages.diagnostic.ia = PARTAGE_OK ? 'commune' : 'pc'; } catch (e) { log('diagnostic reporte (' + e.message + ')'); }
mkdirSync(D('resultats'), { recursive: true }); writeFileSync(D('resultats', 'cauchemar3.json'), JSON.stringify(out, null, 1));
for (const [o, l] of Object.entries(out.meilleurs)) { log(`== 3 etoiles, ${o} ==`); l.slice(0, 5).forEach((x, i) => log(`  ${i + 1}. ${x.equipe.join(' / ')} : ${x.troisEtoiles} % (+/- ${x.marge}) | ${x.parDifficulte.map(d => `${d.difficulte} ${d.troisEtoiles} / 2* ${d.deuxEtoiles}`).join(', ')}`)); }
for (const c of collectifs) for (const l of c.cartes) log(`collectifs ${c.equipe.join(' / ')}, ${l.carte} : 3 etoiles ${l.avant} -> ${l.apres} %${l.utile ? ' : ' + l.conseil.join(', ') : ' (pas mieux que les tiens)'}`);
log(`termine en ${out.duree} s : resultats\\cauchemar3.json`);
eveil.fin(); await pool.close(); process.exit(0);
