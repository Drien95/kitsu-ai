// Tests sans le moteur du jeu (lances par la verification GitHub) : limite de puissance et Eveil (lib/puissance.mjs, 5.62).
// Faux moteur qui suit la regle lue dans le jeu le 28/11/2026 : SSR 5, UR 8, LR 12, MR 16, X : SSR 7, UR 11, LR 15 ;
// +4 par LR des la 3e, +12 par MR en plus ; plafond 28, puis +8, +8, +4, +4, +4, puis +2, max 64.
import { limitePuissance, eveilDe, transcendancesDe, classeRarete, raretesChoisies, RARETES_V2 } from './lib/puissance.mjs';
let ok = 0, ko = 0; const t = (nom, c, info = '') => { if (c) { ok++; console.log('  OK   ' + nom); } else { ko++; console.log('  ECHEC ' + nom + (info ? ' : ' + info : '')); } };
const CH = {}; let id = 1; const ajoute = (r, o = {}, n = 6) => Array.from({ length: n }, () => { CH[id] = { id, r, ...o }; return id++; });
const SSR = ajoute('E'), UR = ajoute('L'), LR = ajoute('M'), MR = ajoute('M', { appearanceRarity: 'MR' }), LRX = ajoute('M', { appearanceRarity: 'LR-X' }), URX = ajoute('L', { awakenX: true }), SSRX = ajoute('E', { awakenX: true });
const base = { E: 5, L: 8, M: 12 }, X = { E: 7, L: 11, M: 15 };
const cardPower = i => { const c = CH[i]; return !c ? 0 : c.appearanceRarity === 'MR' ? 16 : c.appearanceRarity === 'LR-X' || c.awakenX ? X[c.r] : base[c.r]; };
let appels = 0;
const teamPowerSum = ids => { appels++; const u = [...new Set(ids)], lr = u.filter(i => CH[i].r === 'M' && CH[i].appearanceRarity !== 'MR').length, mr = u.filter(i => CH[i].appearanceRarity === 'MR').length; return u.reduce((a, i) => a + cardPower(i), 0) + 4 * Math.max(0, lr - 2) + 12 * Math.max(0, mr - 1); };
const gains = [8, 8, 4, 4, 4], cap = n => { let c = 28; for (let k = 1; k <= n; k++) c += gains[k - 1] ?? 2; return Math.min(64, c); };
const G = { CHAR_BY_ID: CH, cardPower, teamPowerSum, powerCap: S => cap(transcendancesDe(S)), POWER_LIMIT: { on: true } };

const L0 = limitePuissance(G, {}, { sansLimite: false, transcendance: null });
t('plafond 28 sans Transcendance', L0.actif && L0.plafond === 28 && L0.rb === 0);
t('plafonds 36, 44, 48, 52, 56, 58, 64 max', [1, 2, 3, 4, 5, 6, 30].map(n => limitePuissance(G, { rb: { n } }, { sansLimite: false, transcendance: null }).plafond).join() === '36,44,48,52,56,58,64');
t('palier choisi (--transcendance) remplace la sauvegarde', limitePuissance(G, { rb: { n: 0 } }, { sansLimite: false, transcendance: 3 }).plafond === 48);
t('LR + UR + UR = 28 accepte', L0.cout([LR[0], UR[0], UR[1]]) === 28 && L0.ok([LR[0], UR[0], UR[1]]));
t('LR + LR + SSR = 29 refuse', L0.cout([LR[0], LR[1], SSR[0]]) === 29 && !L0.ok([LR[0], LR[1], SSR[0]]));
t('3 LR = 40 (+4 des la 3e LR)', L0.cout(LR.slice(0, 3)) === 40);
t('2 MR = 44 (+12 par MR en plus)', L0.cout([MR[0], MR[1]]) === 44);
t('LR-X compte comme LR (3e LR : +4)', L0.cout([LR[0], LR[1], LRX[0]]) === 12 + 12 + 15 + 4);
// Raccourci par classes : meme resultat que le calcul direct sur toutes les combinaisons, en peu d'appels au jeu.
const P = Object.keys(CH).map(Number); let ecarts = 0, n = 0; appels = 0;
for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) for (let c = b + 1; c < P.length; c++) { n++; const tr = [P[a], P[b], P[c]]; const v = L0.cout(tr); const d = (() => { const k = appels; const r = teamPowerSum(tr); appels = k; return r; })(); if (v !== d) ecarts++; }
t(`meme cout que le jeu sur les ${n} trios`, ecarts === 0, `${ecarts} ecarts`);
t('raccourci : peu d appels au calcul du jeu', appels < 100, `${appels} appels`);
{ const okP = L0.okPositions(P); let e2 = 0; for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) for (let c = b + 1; c < P.length; c++) if (okP(a, b, c) !== (teamPowerSum([P[a], P[b], P[c]]) <= 28)) e2++;
  t('verdict par positions (grosses enumerations) = verdict du jeu', e2 === 0, `${e2} ecarts`);}
t('moteur sans limite (avant la V2) : tout accepte', !limitePuissance({ CHAR_BY_ID: CH }, {}).actif && limitePuissance({ CHAR_BY_ID: CH }, {}).ok(LR.slice(0, 3)));
t('POWER_LIMIT.on = false : tout accepte', !limitePuissance({ ...G, POWER_LIMIT: { on: false } }, {}, { sansLimite: false, transcendance: null }).actif);
t('--sans-limite : tout accepte', !limitePuissance(G, {}, { sansLimite: true }).actif);
const E = eveilDe({ eveil: { aw: 2, cartes: [LR[0]] } }), E0 = eveilDe({});
t('Eveil : aw et awakened sur une carte eveillee, niveau 100', JSON.stringify(E.champs(LR[0])) === '{"aw":2,"awakened":true}' && E.niveauMax(LR[0]) === 100 && E.niveauMax(LR[1]) === 99);
t('Eveil : rien sans Eveil (cles de journal inchangees)', JSON.stringify(E0.champs(LR[0])) === '{}' && E0.cle(LR[0]) === '' && E0.niveauMax(LR[0]) === 99);
{ const c = L0.compter(P); let k = 0; for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) for (let d = b + 1; d < P.length; d++) if (teamPowerSum([P[a], P[b], P[d]]) <= 28) k++;
  t('compteur : trios acceptes et total exacts sans enumeration', c.total === n && c.ok === k, `${c.ok}/${c.total} attendu ${k}/${n}`); }
// 5.63 : guide d'un palier (sans simulation) : compositions, trios autorises, resultats du bon palier seulement.
{ const { guidePalier } = await import('./lib/guide.mjs');
  const S = { owned: Object.fromEntries(P.map(i => [i, 1])), rb: { n: 0 }, kiSpent: 4000 };
  const fic = { 'cauchemar3.json': { puissance: { transcendances: 0, triosTotal: 7140 }, trios: 10, etages: { resume: [{ difficulte: 'normal', combats: 10, troisEtoilesSur: 4 }], plan: [], trios: [] } },
    'cauchemar3-p1.json': { puissance: { transcendances: 1, triosTotal: 7140 }, trios: 20, etages: { resume: [{ difficulte: 'normal', combats: 10, troisEtoilesSur: 7 }], plan: [], trios: [] } },
    'tour.json': { trios: [{ ids: [1, 2, 3], etageMoyen: 50 }] } };
  const g0 = guidePalier({ G, S, n: 0, R: f => fic[f] || null }), g1 = guidePalier({ G, S, n: 1, R: f => fic[f] || null });
  t('guide : plafond et compositions du palier', g0.plafond === 28 && g0.compositions.filter(c => c.ok).length === 29 && g0.compositions.length === 84, `${g0.compositions.filter(c => c.ok).length}/${g0.compositions.length}`);
  t('guide : trios autorises = compteur', g0.trios.autorises === L0.compter(P).ok && g0.trios.total === n);
  t('guide : Tour d avant la V2 ignoree, Campagne du palier lue', g0.tour === null && g0.campagne?.difficultes[0].surs === 4 && g0.manque.includes('tour'));
  t('guide : palier suivant compare (+3 combats surs)', g0.suivant?.palier === 1 && g0.suivant.campagne?.plus === 3 && g1.campagne?.difficultes[0].surs === 7);
  t('guide : remboursement 25 % des Ki depenses', g0.transcendance.gemmesRendues === 1000);
}
// 5.63 : base commune, cartes eveillees (6e champ de la carte d'un lot).
{ const { verifierLot, cleCarteDe, eveilDeCarte, avecEveil } = await import('./lib/partage-format.mjs');
  const lot = c => ({ f: 1, sigG: 'abc', wKey: 'def', moteur: 'Cd_T-y95', paq: 16, t: [c], p: [[0, 0, 'k1']], l: [[0, 0, 1, 16, 9]] });
  const c5 = [[1, 99, 0, [], 's1'], [2, 99, 0, [], 's2'], [3, 99, 0, [], 's3']], c6 = [[1, 100, 0, [], 's1', 'a2e'], [2, 99, 0, [], 's2', 'a2'], [3, 99, 0, [], 's3']];
  t('lot sans Eveil toujours accepte', verifierLot(lot(c5)) === null);
  t('lot avec cartes eveillees (niveau 100) accepte', verifierLot(lot(c6)) === null, verifierLot(lot(c6)));
  t('Eveil mal forme refuse', verifierLot(lot([[1, 99, 0, [], 's1', 'x'], ...c5.slice(1)])) === 'eveil' && verifierLot(lot([[1, 100, 0, [], 's1'], ...c5.slice(1)])) === 'carte');
  const E2 = eveilDe({ eveil: { aw: 2, cartes: [1] } });
  t('cle de carte du lot = cle du calcul (Eveil compris)', cleCarteDe([1, 100, 0, [], 's1', E2.cle(1)]) === '1:100:0::s1:a2e' && cleCarteDe(c5[0]) === '1:99:0::s1');
  t('Eveil du lot rendu a l equipe', JSON.stringify(eveilDeCarte('a2e')) === '{"aw":2,"awakened":true}' && JSON.stringify(eveilDeCarte(undefined)) === '{}' && avecEveil(c6) && !avecEveil(c5));
}
// 5.64 : raretes du choix des calculs (7 classes de cout).
t('classes MR, LR-X, LR, UR-X, UR, SSR-X, SSR', [{ r: 'M', appearanceRarity: 'MR' }, { r: 'M', appearanceRarity: 'LR-X' }, { r: 'M' }, { r: 'L', awakenX: 1 }, { r: 'L' }, { r: 'E', awakenX: 1 }, { r: 'E' }, { r: 'R' }].map(classeRarete).join() === 'MR,LR-X,LR,UR-X,UR,SSR-X,SSR,');
t('--raretes : noms V2, ancien LR,UR,SSR et vide', raretesChoisies('SSR,MR').join() === 'MR,SSR' && raretesChoisies('LR').join() === 'MR,LR-X,LR' && raretesChoisies('').length === RARETES_V2.length && raretesChoisies('UR,SSR').join() === 'UR-X,UR,SSR-X,SSR');
console.log(`\n${ok} reussi(s), ${ko} echec(s)`); process.exit(ko ? 1 : 0);
