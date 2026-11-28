// Tests sans le moteur du jeu (lances par la verification GitHub) : limite de puissance et Eveil (lib/puissance.mjs, 5.62).
// Faux moteur qui suit la regle lue dans le jeu le 28/11/2026 : SSR 5, UR 8, LR 12, MR 16, X : SSR 7, UR 11, LR 15 ;
// +4 par LR des la 3e, +12 par MR en plus ; plafond 28, puis +8, +8, +4, +4, +4, puis +2, max 64.
import { limitePuissance, eveilDe, transcendancesDe } from './lib/puissance.mjs';
let ok = 0, ko = 0; const t = (nom, c, info = '') => { if (c) { ok++; console.log('  OK   ' + nom); } else { ko++; console.log('  ECHEC ' + nom + (info ? ' : ' + info : '')); } };
const CH = {}; let id = 1; const ajoute = (r, o = {}, n = 6) => Array.from({ length: n }, () => { CH[id] = { id, r, ...o }; return id++; });
const SSR = ajoute('E'), UR = ajoute('L'), LR = ajoute('M'), MR = ajoute('M', { appearanceRarity: 'MR' }), LRX = ajoute('M', { appearanceRarity: 'LR-X' }), URX = ajoute('L', { awakenX: true });
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
console.log(`\n${ok} reussi(s), ${ko} echec(s)`); process.exit(ko ? 1 : 0);
