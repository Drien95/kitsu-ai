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
//   par combat (lib/etages.mjs) : [--budget-specialistes 60] (minutes) [--candidats-etages 120] [--candidats-prets 40] [--seuil 60] [--sans-etages] [--sans-diagnostic]
//   tests : --max-trios 2000 (trios au hasard)  --max-combats 160 (par difficulte)  --sans-collectifs  --sans-liens
//   journal : --garder-journal (pas de nettoyage a la fin)  --journal-calculs 2 (lignes gardees si servies par l'un des N derniers calculs)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { makeSim } from './lib/sim.mjs';
import { arg, log, SAVE, WA as WA_PC, WC, shuffle } from './lib/commun.mjs';
import * as PARTAGE from './lib/partage.mjs';
import { dir as D } from './lib/chemins.mjs';
import { h53, signatureCombat, makeSigCarte, ouvrirJournal, nettoyerAnciens } from './lib/journal.mjs';
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
// 5.44 : raretes essayees (--raretes LR,UR,SSR, toutes par defaut ; codes du jeu M = LR, L = UR, E = SSR) et pause au bout d'un temps
// de travail (--pause-apres minutes, 0 = jusqu'au bout) : le travail fait reste dans le journal, la relance reprend sans rien refaire.
const RAR = { LR: 'M', UR: 'L', SSR: 'E' }, RARETES = String(arg('raretes', 'LR,UR,SSR')).split(',').filter(r => RAR[r]), CODES = RARETES.map(r => RAR[r]);
const PAUSE = Math.max(0, +arg('pause-apres', 0) || 0);
const IDS = Object.keys(SAVE.owned || {}).map(Number).filter(id => CODES.includes(CH[id]?.r)).sort((a, b) => a - b);
if (IDS.length < 3) { console.log('Il faut au moins 3 cartes SSR/UR/LR dans la sauvegarde exportee.'); process.exit(1); }

// ---------- trios, combats, cles du journal ----------
const sigCarte = makeSigCarte(G, B), sigG = signatureCombat(G, B, SIM, WA), wKey = h53(JSON.stringify(WA));
const carte = (id, lk = LK(id)) => ({ id, lv: LV(id), stars: ET(id), ...(lk ? { lk } : {}) });
const cleCarte = (id, lk = LK(id)) => `${id}:${LV(id)}:${ET(id)}:${(lk || []).join('+')}:${sigCarte(id)}`;
// 5.42.1 : trios ranges en tableau compact (3 x 16 bits par trio : place des cartes dans IDS) au lieu de 7 M petits tableaux, et
// cles de journal calculees a la demande depuis la cle de chaque carte (avant : 7 M chaines gardees en memoire).
// trios[t] et cleTrio[t] s'utilisent comme avant (meme ordre, memes valeurs).
const NI = IDS.length, POS = new Map(IDS.map((id, i) => [id, i]));
const C2 = k => k * (k - 1) / 2, debutA = new Float64Array(NI + 1); for (let a = 0; a < NI; a++) debutA[a + 1] = debutA[a] + C2(NI - 1 - a);
const rangDe = (a, b, c) => debutA[a] + (b - a - 1) * (NI - 2 - a) - C2(b - a - 1) + (c - b - 1); // trio a < b < c dans l'ordre lexicographique
let TRI = new Uint16Array(3 * debutA[NI]); { let k = 0; for (let a = 0; a < NI; a++) for (let b = a + 1; b < NI; b++) for (let c = b + 1; c < NI; c++) { TRI[k++] = a; TRI[k++] = b; TRI[k++] = c; } }
let rangMelange = null; // --max-trios : trios tires au hasard (tests), retrouves par une table
if (arg('max-trios')) {
  const tous = [...Array(debutA[NI]).keys()], pris = shuffle(tous, 5).slice(0, +arg('max-trios')), t2 = new Uint16Array(3 * pris.length);
  pris.forEach((r, i) => t2.set(TRI.subarray(3 * r, 3 * r + 3), 3 * i)); TRI = t2; rangMelange = new Map(pris.map((r, i) => [r, i]));
}
const T = TRI.length / 3;
const trios = new Proxy([], { get: (o, k) => { if (k === 'length') return T; if (typeof k === 'string' && k.length && k.charCodeAt(0) >= 48 && k.charCodeAt(0) <= 57) { const t = +k; return t < T ? [IDS[TRI[3 * t]], IDS[TRI[3 * t + 1]], IDS[TRI[3 * t + 2]]] : undefined; } return undefined; } });
// Index d'un trio a partir de ses cartes (dans n'importe quel ordre), ou undefined.
const indexDe = ids => { const p = ids.map(id => POS.get(id)); if (p.length !== 3 || p.some(x => x === undefined)) return undefined; p.sort((x, y) => x - y); if (p[0] === p[1] || p[1] === p[2]) return undefined; const r = rangDe(p[0], p[1], p[2]); return rangMelange ? rangMelange.get(r) : r; };
const CLEC = IDS.map(id => cleCarte(id));
const cleTrio = new Proxy([], { get: (o, k) => { if (k === 'length') return T; if (typeof k === 'string' && k.length && k.charCodeAt(0) >= 48 && k.charCodeAt(0) <= 57) { const t = +k; return [CLEC[TRI[3 * t]], CLEC[TRI[3 * t + 1]], CLEC[TRI[3 * t + 2]]].sort().join(','); } return undefined; } });
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
const FJ = D('cache', `cauchemar3-${sigG}-${wKey}.jsonl`), J = ouvrirJournal(FJ);
// 5.42 : journaux d'un ancien code de combat ou d'une ancienne IA, inutilises depuis 30 jours, supprimes.
const ANCIENS = nettoyerAnciens(D('cache'), 'cauchemar3-', FJ);
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
// graine (resultat identique, le simulateur est deterministe). Tirage 1 : un mot de 32 bits par trio et par paquet joue (bit k = 3 etoiles
// au combat k, bit 30 = paquet joue) ; tirages 2 et 3 : seulement les trios qui les jouent (finalistes).
// 5.42.1 : avant, 1 octet par trio et par combat, joue ou non (6,96 M trios x 11 874 combats = 83 Go : plantage des grosses collections).
// Maintenant seuls les paquets joues comptent : d'abord une table (trio -> mot), puis un tableau de T mots (4 octets par trio)
// quand plus d'un trio sur 16 a joue le paquet (en pratique le 1er tour, ou tous les trios jouent).
const OFF = DIFF.map(() => []); let NFT = 0; paquets.forEach((ps, di) => ps.forEach((p, pi) => { OFF[di][pi] = NFT; NFT += p.f.length; }));
const FDI = new Uint8Array(NFT), FPI = new Uint16Array(NFT), FK = new Uint16Array(NFT); // combat global -> difficulte, paquet, place
paquets.forEach((ps, di) => ps.forEach((p, pi) => p.f.forEach((_, k) => { const fi = OFF[di][pi] + k; FDI[fi] = di; FPI[fi] = pi; FK[fi] = k; })));
const JOUE = 1 << 30, BITS = PAQ <= 30 && paquets.every(ps => ps.every(p => p.f.length <= 30));
const VU1 = DIFF.map(() => []), VU23 = new Map(), DENSE = Math.max(1024, T >> 4);
const lire1 = (t, di, pi) => { const v = VU1[di][pi]; return !v ? 0 : v instanceof Map ? v.get(t) || 0 : v[t]; };
function ecrire1(t, di, pi, mot) {
  let v = VU1[di][pi]; if (!v) v = VU1[di][pi] = new Map();
  if (v instanceof Map) { v.set(t, mot); if (v.size > DENSE) { const d = new Uint32Array(T); for (const [k, x] of v) d[k] = x; VU1[di][pi] = d; } } else v[t] = mot;
}
let vusReutilises = 0;
function noter(t, di, pi, seed, st) {
  if (t == null || typeof st !== 'string' || st.length !== paquets[di][pi].f.length) return;
  if (seed === 1) { if (BITS) { let m = JOUE; for (let k = 0; k < st.length; k++) if (st[k] === '3') m |= 1 << k; ecrire1(t, di, pi, m); } else VU23.set(`${t}|${di}|${pi}|1`, st); }
  else if (seed === 2 || seed === 3) VU23.set(`${t}|${di}|${pi}|${seed}`, st);
}
// Etoiles d'un trio sur un paquet pour une graine (chaine '3'/'0' par combat), ou null si pas encore joue.
function connu(t, di, pi, seed) {
  if (seed === 1 && BITS) { const m = lire1(t, di, pi), n = paquets[di][pi].f.length; if (!m) return null; let st = ''; for (let k = 0; k < n; k++) st += m >> k & 1 ? '3' : '0'; vusReutilises += n; return st; }
  const st = VU23.get(`${t}|${di}|${pi}|${seed}`); if (st) vusReutilises += st.length; return st || null;
}
// Tirage 1 d'un trio sur un combat (index global, meme ordre que lib/etages.mjs) : 0 inconnu, 1 pas 3 etoiles, 2 trois etoiles.
const connu1 = (t, fi) => {
  let v; if (BITS) { const m = lire1(t, FDI[fi], FPI[fi]); v = m ? (m >> FK[fi] & 1 ? 2 : 1) : 0; }
  else { const st = VU23.get(`${t}|${FDI[fi]}|${FPI[fi]}|1`); v = st ? (st[FK[fi]] === '3' ? 2 : 1) : 0; }
  if (v) vusReutilises++; return v;
};

// ---------- calcul d'un lot (journal d'abord, combats manquants en parallele) ----------
const pool = await makePool(arg('fils') ? +arg('fils') : undefined, version);
let simules = 0, repris = 0;
// Paquet complet joue : journal, etoiles par combat, base commune.
function enregistrer(it, k, st) {
  const n = st.length; let s3 = 0; for (let c = 0; c < n; c++) if (st[c] === '3') s3++;
  J.set(k, n + ',' + s3 + ',' + st); noter(it.t, it.di, it.pi, it.seed, st);
  if (PARTAGE_OK && PART.envoyer && it.seed <= 3) { const cartes = it.team.map(carteLot); if (cleTrioDe(cartes) === it.ck) aEnvoyer.push({ cartes, di: it.di, pi: it.pi, clePaquet: paquets[it.di][it.pi].cle, graine: it.seed, n, s3 }); }
}
async function jouer(items) { // items : { di, pi, seed, team, ck, t? } -> [n, s3]
  const out = new Array(items.length), todo = [];
  items.forEach((x, i) => { const k = cle(x.di, x.pi, x.seed, x.ck), v = J.get(k); if (v) { const a = v.split(','); out[i] = [+a[0], +a[1]]; noter(x.t, x.di, x.pi, x.seed, a[2]); repris++; } else todo.push([i, k]); });
  for (let a = 0; a < todo.length; a += 24000) {
    const part = todo.slice(a, a + 24000);
    // Type 'etoiles' : meme simulation, mais l'etoile de chaque combat revient aussi (n = combats, s3 = combats a 3 etoiles).
    const r = (await pool.runAll(part.map(([i]) => ({ type: 'etoiles', team: items[i].team, fights: paquets[items[i].di][items[i].pi].f, seeds: [items[i].seed] })), WA, { stop3: true }, 40))
      .map(y => ({ n: y.st.length, s3: [...y.st].filter(c => c === '3').length, st: y.st }));
    r.forEach((x, j) => { out[part[j][0]] = [x.n, x.s3]; simules += x.n; enregistrer(items[part[j][0]], part[j][1], x.st); });
    J.flush(); versFile();
    if (PAUSE && Date.now() - T0 > PAUSE * 60000) await pause();
  }
  return out;
}

async function pause() {
  log(`pause apres ${PAUSE} min de travail : ${simules} combats simules gardes dans le journal, relance le calcul pour finir (rien n est refait)`);
  eveil.fin(); await pool.close(); process.exit(0);
}

// ---------- course avec elimination ----------
const N = new Uint16Array(T * ND), S3 = new Uint16Array(T * ND); // 5.42.1 : 16 bits suffisent (au plus 3 tirages x 1 979 combats = 5 937 par difficulte)
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
    // 5.42.1 : bornes dans des tableaux de nombres (avant : un objet par trio, 7 M au 1er tour d'une grosse collection)
    const n = alive.length, lo = new Float64Array(n), hi = new Float64Array(n);
    for (let j = 0; j < n; j++) { const x = score(alive[j], o); lo[j] = x.p - Z * x.se; hi[j] = x.p + Z * x.se; }
    const bar = lo.slice().sort()[n - Math.min(K, n)]; // Ke plus grande borne basse
    for (let j = 0; j < n; j++) if (hi[j] >= bar) garde[alive[j]] = 1;
  }
  return alive.filter(t => garde[t]);
}
// 5.42.1 : lots de 60 000 paquets construits au fur et a mesure (avant : tous les paquets du tour d'un coup, soit 21 M objets
// pour 7 M trios, plusieurs Go de memoire).
// 5.46 : tour de course en deux moities (gros tours seulement). Tous les trios jouent la 1re moitie de leurs paquets N/D/E ;
// les mieux places a mi-chemin jouent la 2e moitie et donnent la barre de chaque objectif (Ke meilleure borne basse, paquets
// complets : elle ne depasse jamais la barre que le tour complet aurait). Un trio dont la borne haute a mi-chemin (memes regles,
// moitie des combats) est sous cette barre pour tous les objectifs qui eliminent est ecarte sans jouer la 2e moitie.
// Les autres jouent la 2e moitie : leurs paquets complets sont identiques (graine par combat), journal et base commune inchanges.
// Moitie jouee gardee au journal (cle du paquet + '|1/2') pour la reprise. Etat dans des tableaux de nombres (pas d'objet par
// trio : 7 M trios = 21 M moities). --sans-demi : tour complet pour tous (avant 5.46).
const DEMI = !arg('sans-demi'), DEMI_MIN = +arg('demi-min', 3000), DEMI_BARRE = +arg('demi-barre', 2000);
const objsTour = pi => pi < 4 ? [IMOY, 0] : OBJS.map((x, i) => x.e ? i : -1).filter(i => i >= 0);
let demiEcartes = 0, demiEconomie = 0;
const nb3 = st => { let s = 0; for (let c = 0; c < st.length; c++) if (st[c] === '3') s++; return s; };
async function tourDemi(alive, pi, dis) {
  const ds = dis.filter(di => paquets[di][pi]), nd = ds.length, nA = alive.length, h = ds.map(di => Math.ceil(paquets[di][pi].f.length / 2));
  const cleP = (j, d) => cle(ds[d], pi, 1, cleTrio[alive[j]]), cleH = (j, d) => h53(`${sigG}|${wKey}|${paquets[ds[d]][pi].cle}|1|${cleTrio[alive[j]]}|1/2`);
  // par (trio j, difficulte d) : paquet complet (fN combats, fS a 3 etoiles ; fN = 0 si pas fini) et 1re moitie (hS, hM = etoiles en bits)
  const fN = new Uint8Array(nA * nd), fS = new Uint8Array(nA * nd), hS = new Uint8Array(nA * nd), hM = new Uint32Array(nA * nd), hJ = new Uint8Array(nA * nd);
  const item = (j, d) => ({ di: ds[d], pi, seed: 1, team: trios[alive[j]].map(id => carte(id)), ck: cleTrio[alive[j]], t: alive[j] });
  const moitie = (j, d) => { let st = ''; const m = hM[j * nd + d]; for (let c = 0; c < h[d]; c++) st += m >> c & 1 ? '3' : '0'; return st; };
  const poseH = (x, st) => { let m = 0; for (let c = 0; c < st.length; c++) if (st[c] === '3') m |= 1 << c; hM[x] = m; hS[x] = nb3(st); hJ[x] = 1; };
  // a) journal (paquet complet, ou moitie deja jouee), b) 1re moitie des autres, par lots de 20 000 trios
  for (let a = 0; a < nA;) {
    const todo = [];
    for (; a < nA && todo.length < 60000; a++) for (let d = 0; d < nd; d++) {
      const x = a * nd + d, v = J.get(cleP(a, d));
      if (v) { const z = v.split(','); fN[x] = +z[0]; fS[x] = +z[1]; noter(alive[a], ds[d], pi, 1, z[2]); repris++; continue; }
      const m = J.get(cleH(a, d)); if (m) { poseH(x, m); repris++; } else todo.push(x);
    }
    const r = await pool.runAll(todo.map(x => ({ type: 'etoiles', team: trios[alive[x / nd | 0]].map(id => carte(id)), fights: paquets[ds[x % nd]][pi].f.slice(0, h[x % nd]), seeds: [1] })), WA, { stop3: true }, 40);
    r.forEach((y, i) => { const x = todo[i]; poseH(x, y.st); J.set(cleH(x / nd | 0, x % nd), y.st); simules += y.st.length; });
    J.flush(); if (PAUSE && Date.now() - T0 > PAUSE * 60000) await pause();
    if (Date.now() - dernierLog > 60000) { dernierLog = Date.now(); log(`  tour ${pi + 1}, 1re moitie : ${a} / ${nA} trios, ${Math.round(simules / ((Date.now() - T0) / 1000))} combats/s`); }
  }
  // score d'un trio avec ce tour : paquets complets, sinon 1re moitie
  const complet = j => { for (let d = 0; d < nd; d++) if (!fN[j * nd + d]) return false; return true; };
  const borne = (j, o, haut) => { const t = alive[j], ps = OBJS[o].d; let p = 0, v = 0;
    for (const dd of ps) { const d = ds.indexOf(dd), x = j * nd + d; let n = N[t * ND + dd], s = S3[t * ND + dd];
      if (d >= 0) { if (fN[x]) { n += fN[x]; s += fS[x]; } else if (hJ[x]) { n += h[d]; s += hS[x]; } }
      const q = n ? s / n : 0, qq = (s + 1) / (n + 2); p += q; v += qq * (1 - qq) / Math.max(1, n); }
    p /= ps.length; const se = Math.sqrt(v) / ps.length; return haut ? p + Z * se : p - Z * se; };
  // c) 2e moitie pour une liste de trios (index dans alive)
  const finir = async js => {
    const xs = []; for (const j of js) for (let d = 0; d < nd; d++) if (!fN[j * nd + d]) xs.push(j * nd + d);
    for (let a = 0; a < xs.length; a += 60000) {
      const part = xs.slice(a, a + 60000);
      const r = await pool.runAll(part.map(x => ({ type: 'etoiles', team: trios[alive[x / nd | 0]].map(id => carte(id)), fights: paquets[ds[x % nd]][pi].f.slice(h[x % nd]), seeds: [1] })), WA, { stop3: true }, 40);
      r.forEach((y, i) => { const x = part[i], j = x / nd | 0, d = x % nd, st = moitie(j, d) + y.st; simules += y.st.length; enregistrer(item(j, d), cleP(j, d), st); fN[x] = st.length; fS[x] = nb3(st); });
      J.flush(); versFile(); if (PAUSE && Date.now() - T0 > PAUSE * 60000) await pause();
    }
  };
  // d) barre : les DEMI_BARRE meilleurs a mi-chemin (borne basse, chaque objectif) finissent leurs paquets
  const objs = objsTour(pi), meilleurs = new Uint8Array(nA), lo = new Float64Array(nA);
  for (const o of objs) {
    for (let j = 0; j < nA; j++) lo[j] = borne(j, o, false);
    // les k plus grandes bornes basses, a egalite les premiers trios (sans trier 7 M objets : seuil puis parcours)
    const k = Math.min(DEMI_BARRE, nA), seuil = lo.slice().sort()[nA - k]; let pris = 0;
    for (let j = 0; j < nA; j++) if (lo[j] > seuil) { meilleurs[j] = 1; pris++; }
    for (let j = 0; j < nA && pris < k; j++) if (lo[j] === seuil) { meilleurs[j] = 1; pris++; }
  }
  await finir(Array.from({ length: nA }, (_, j) => j).filter(j => meilleurs[j]));
  const bars = objs.map(o => { const L = []; for (let j = 0; j < nA; j++) if (complet(j)) L.push(borne(j, o, false)); L.sort((a, b) => b - a); return L.length >= K ? L[K - 1] : -Infinity; });
  // e) ecartes a mi-chemin, les autres finissent
  const ecarte = new Uint8Array(nA); let ne = 0, eco = 0;
  for (let j = 0; j < nA; j++) if (!complet(j) && objs.every((o, i) => borne(j, o, true) < bars[i])) { ecarte[j] = 1; ne++; for (let d = 0; d < nd; d++) if (!fN[j * nd + d]) eco += paquets[ds[d]][pi].f.length - h[d]; }
  await finir(Array.from({ length: nA }, (_, j) => j).filter(j => !ecarte[j] && !complet(j)));
  for (let j = 0; j < nA; j++) for (let d = 0; d < nd; d++) { const x = j * nd + d, k = alive[j] * ND + ds[d]; if (fN[x]) { N[k] += fN[x]; S3[k] += fS[x]; } else if (hJ[x]) { N[k] += h[d]; S3[k] += hS[x]; } }
  demiEcartes += ne; demiEconomie += eco;
  log(`  tour ${pi + 1} en deux moities : ${ne} trios ecartes a mi-chemin (barres ${bars.map(b => b.toFixed(3)).join(' / ')})`);
  return alive.filter((_, j) => !ecarte[j]);
}
async function tour(alive, pi, seed, dis = DIS_TOUTES) {
  if (DEMI && seed === 1 && dis === DIS_ELIM && alive.length >= DEMI_MIN) return tourDemi(alive, pi, dis);
  const ds = dis.filter(di => paquets[di][pi]), total = alive.length * ds.length;
  for (let a = 0, fait = 0; a < alive.length;) {
    const items = [], idx = [];
    for (; a < alive.length && items.length < 60000; a++) { const t = alive[a]; for (const di of ds) { items.push({ di, pi, seed, team: trios[t].map(id => carte(id)), ck: cleTrio[t], t }); idx.push(t * ND + di); } }
    const r = await jouer(items); fait += items.length;
    r.forEach(([n, s3], j) => { N[idx[j]] += n; S3[idx[j]] += s3; });
    if (Date.now() - dernierLog > 60000 && total > 60000) { dernierLog = Date.now(); log(`  tour ${pi + 1} : ${fait} / ${total} paquets, ${Math.round(simules / ((Date.now() - T0) / 1000))} combats/s`); }
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
  const avant = alive.length, garde = await tour(alive, pi, 1, DIS_ELIM); if (garde) alive = garde; // 5.46 : sans les ecartes a mi-paquet
  alive = eliminer(alive, pi); entonnoir.push(alive.length);
  const ecoule = (Date.now() - T0) / 1000, vit = simules / Math.max(1, ecoule);
  log(`tour ${pi + 1}/${TOURS} : ${avant} -> ${alive.length} trios en course, ${simules} combats simules (${Math.round(vit)}/s), ${repris} paquets repris du journal`);
  { // 5.45 : top 10 provisoire (3 etoiles en moyenne sur les Cauchemar), pour le suivi en direct du panneau. Un seul passage.
    const top = []; for (const t of alive) { const p = score(t, IMOY).p; if (top.length < 10 || p > top[top.length - 1].p) { top.push({ t, p }); top.sort((a, b) => b.p - a.p); if (top.length > 10) top.pop(); } }
    if (top.length) log(`top 10 tour ${pi + 1} : ${top.map(x => trios[x.t].join(',') + '=' + (100 * x.p).toFixed(1)).join(' | ')}`); }
}
if (DIS_CAMP.length) { for (let pi = 0; pi < TOURS; pi++) await tour(alive, pi, 1, DIS_CAMP); log(`Campagne : ${alive.length} finalistes, tirage 1`); }
// Finale : 2 tirages de plus sur tous les combats pour les survivants (le hasard du combat compte).
for (const seed of [2, 3]) for (let pi = 0; pi < TOURS; pi++) await tour(alive, pi, seed);
log(`finale : ${alive.length} trios, ${simules} combats simules au total${demiEcartes ? `, ${demiEcartes} trios ecartes a mi-paquet (${demiEconomie} combats evites)` : ''}`);

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
const dix = new Set(IDS.slice().sort((a, b) => force(b) - force(a)).slice(0, 10)), indexTrio = { get: k => indexDe(String(k).split('-').map(Number)) };
const scriptSet = new Set((() => { const d = [...dix], L = []; for (let a = 0; a < d.length; a++) for (let b = a + 1; b < d.length; b++) for (let c = b + 1; c < d.length; c++) { const t = indexDe([d[a], d[b], d[c]]); if (t !== undefined) L.push(t); } return L.sort((x, y) => x - y); })()); // ordre des trios, comme avant (departage des egalites par combat)
let etages = null;
if (!arg('sans-etages')) {
  const objE = TOUTES ? OBJ.indexOf('Les6') : IMOY, enCourse = new Set(alive), NCE = +arg('candidats-etages', 120);
  // 5.42.1 : en course d'abord, puis les meilleurs ecartes ; seuls les NCE premiers servent (avant : les 7 M trios tries).
  const lo = t => { const x = score(t, objE); return x.p - Z * x.se; }, parLo = (x, y) => y.lo - x.lo || x.t - y.t;
  // Meilleurs ecartes (hors course) qui verifient f : les k premiers par borne basse, sans trier tous les trios.
  const ecartesTop = (k, f) => { const L = []; if (k <= 0) return L; for (let t = 0; t < T; t++) { if (!N[t * ND] || enCourse.has(t) || !f(t)) continue; const v = lo(t); if (L.length < k || parLo({ t, lo: v }, L[L.length - 1]) < 0) { L.push({ t, lo: v }); L.sort(parLo); if (L.length > k) L.pop(); } } return L; };
  const vivants = alive.map(t => ({ t, lo: lo(t) })).sort(parLo), classes = vivants.slice(0, NCE);
  if (classes.length < NCE) classes.push(...ecartesTop(NCE - classes.length, () => true));
  const cur = indexTrio.get(equipe.slice().sort((a, b) => a - b).join('-'));
  // 5.43 : plus les meilleurs trios deja prets (3 cartes au niveau 99), pour que chaque combat ait un trio jouable tout de suite.
  const au99 = id => (SAVE.lv?.[id]?.l || 1) >= 99, NPRET = +arg('candidats-prets', 40);
  // 5.43.2 : comme la 5.43.0, les NPRET premiers trios prets de tout le classement (en course d'abord, puis les ecartes).
  const prets = NIV !== '99' ? [] : (() => { const L = vivants.filter(x => trios[x.t].every(au99)).slice(0, NPRET); return [...L, ...ecartesTop(NPRET - L.length, t => trios[t].every(au99))].map(x => x.t); })();
  const cands = [...new Set([...classes.slice(0, NCE).map(x => x.t), ...prets, ...scriptSet, ...(cur != null ? [cur] : [])])];
  const sigColl = h53(IDS.map(id => cleCarte(id)).join(','));
  // 5.48 : plancher. Le meilleur trio de chaque combat au dernier calcul est rejoue 64 tirages sur ce combat (memes niveaux que ce
  // calcul) : son taux sert de plancher au meilleur trio par combat, pour qu'un trio deja trouve ne soit jamais perdu d'un calcul a
  // l'autre (8 tirages sur 8 ne garantissent que 69 % a 95 % de confiance, 64 sur 64 garantissent 95,4 %). --sans-plancher : avant 5.48.
  // Combats a 3 etoiles dans ta partie (pve.stars de la sauvegarde, envoye par le script depuis la 5.45) : pas de specialistes.
  // --sans-acquis-jeu : specialistes aussi sur ces combats.
  const NPL = 64, essais = new Map(), tousF = new Set(paquets.flatMap(ps => ps.flatMap(p => p.f)));
  const pst = arg('sans-acquis-jeu') ? {} : SAVE.pve?.stars || {}, acquisJeu = new Set(Object.keys(pst).filter(f => pst[f] >= 3 && tousF.has(f)));
  if (!arg('sans-plancher')) {
    let prec = null; try { prec = JSON.parse(readFileSync(D('resultats', 'cauchemar3.json'), 'utf8')).etages; } catch {}
    const aTester = []; for (const c of prec?.combats || []) { const ids = prec.trios?.[c[2]], t = ids ? indexDe(ids) : undefined; if (tousF.has(c[0]) && t != null) aTester.push({ f: c[0], t }); }
    const cleA = x => h53(`P${NPL}|${sigG}|${wKey}|${sigCombat(x.f)}|${cleTrio[x.t]}`), seeds = Array.from({ length: NPL }, (_, i) => 1 + i), t0 = Date.now();
    const poser = (x, st) => { let k = 0; for (let c = 0; c < st.length; c++) if (st[c] === '3') k++; essais.set(x.f, { t: x.t, p: k / st.length, n: st.length }); };
    const todo = []; for (const x of aTester) { const v = J.get(cleA(x)); if (v) poser(x, v); else todo.push(x); }
    for (let a = 0; a < todo.length; a += 4000) {
      const part = todo.slice(a, a + 4000), r = await pool.runAll(part.map(x => ({ type: 'etoiles', team: trios[x.t].map(id => carte(id)), fights: [x.f], seeds })), WA, { stop3: true }, 8);
      r.forEach((y, j) => { J.set(cleA(part[j]), y.st); poser(part[j], y.st); simules += y.st.length; }); J.flush();
    }
    const plein = [...essais.values()].filter(e => e.p === 1).length;
    if (aTester.length) log(`plancher : ${aTester.length} meilleurs trios du dernier calcul rejoues ${NPL} tirages (${aTester.length - todo.length} repris du journal, ${Math.round((Date.now() - t0) / 1000)} s), ${plein} a ${NPL}/${NPL}`);
  }
  if (acquisJeu.size) log(`acquis en jeu : ${acquisJeu.size} combats a 3 etoiles dans ta partie, sans specialistes`);
  etages = await parCombat({ pool, J, WA, paquets, DIFF, trios, cleTrio, indexDe, equipeDe: t => trios[t].map(id => carte(id)), cands, scriptSet, sigG, wKey, sigColl, sigCombat, log,
    seuil: +arg('seuil', 60) / 100, budget: +arg('budget-specialistes', 60), connu, connu1, dejaAu99: au99, essais, acquisJeu });
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
const out = { version, signatureCombat: sigG, date: new Date().toISOString(), niveaux: NIV, cartes: IDS.length, raretes: RARETES, trios: T, combats: Object.fromEntries(DIFF.map(([d], i) => [d, NCOMB[i]])), difficultes: DIFF.map(d => d[0]),
  finalistes: alive.length, combatsSimules: simules, paquetsRepris: repris, duree: Math.round((Date.now() - T0) / 1000),
  vitesse: Math.round(simules / Math.max(1, (Date.now() - T0) / 1000)), entonnoir, demiPaquet: DEMI ? { ecartes: demiEcartes, combatsEvites: demiEconomie } : null, mondes: MONDES, repartition,
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
// 5.42 : calcul complet fini, le journal ne garde que les lignes servies par ce calcul ou le precedent (lib/journal.mjs).
if (!arg('max-trios') && !arg('max-combats') && !arg('garder-journal')) try {
  const c = J.compacter(+arg('journal-calculs', 2)), Mo = o => (o / 1048576).toFixed(1);
  out.journal = { ...c, anciens: ANCIENS };
  log(`journal : ${c.avant} -> ${c.apres} lignes (${Mo(c.octetsAvant)} -> ${Mo(c.octetsApres)} Mo), ${c.apres < c.avant ? 'lignes inutilisees par les 2 derniers calculs retirees' : 'rien a retirer'}${ANCIENS.length ? ` ; ${ANCIENS.length} ancien(s) journal(aux) supprime(s), ${Mo(ANCIENS.reduce((a, x) => a + x.octets, 0))} Mo` : ''}`);
} catch (e) { log('journal : nettoyage reporte (' + e.message + ')'); }
mkdirSync(D('resultats'), { recursive: true }); writeFileSync(D('resultats', 'cauchemar3.json'), JSON.stringify(out, null, 1));
for (const [o, l] of Object.entries(out.meilleurs)) { log(`== 3 etoiles, ${o} ==`); l.slice(0, 5).forEach((x, i) => log(`  ${i + 1}. ${x.equipe.join(' / ')} : ${x.troisEtoiles} % (+/- ${x.marge}) | ${x.parDifficulte.map(d => `${d.difficulte} ${d.troisEtoiles} / 2* ${d.deuxEtoiles}`).join(', ')}`)); }
for (const c of collectifs) for (const l of c.cartes) log(`collectifs ${c.equipe.join(' / ')}, ${l.carte} : 3 etoiles ${l.avant} -> ${l.apres} %${l.utile ? ' : ' + l.conseil.join(', ') : ' (pas mieux que les tiens)'}`);
log(`termine en ${out.duree} s : resultats\\cauchemar3.json`);
eveil.fin(); await pool.close(); process.exit(0);
