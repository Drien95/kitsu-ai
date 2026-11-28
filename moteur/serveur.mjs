// KitsuAI, panneau local et serveur du conseil en combat.
// - http://127.0.0.1:47123/        panneau (etat, analyses, entrainement, resultats, sauvegarde, journal)
// - POST /conseil                  conseil en combat demande par le script (anticipation sur tous les coeurs)
// - GET  /ping, GET /poids         etat et reglages de l'IA entrainee ici, pour le script
// Ecoute seulement sur cette machine. Les actions du panneau exigent le jeton de la page (aucun autre site ne peut les lancer).
import http from 'node:http';
import os from 'node:os';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { spawn, exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEngine } from './lib/charger.mjs';
import { fiche } from './lib/fiche.mjs';
import { makePool, baisserPriorite } from './lib/pool.mjs';
import { dir as D, DATA, CODE } from './lib/chemins.mjs';
import { listerPoids, restaurerPoids, reglagesAnalyse } from './lib/historique.mjs';
import { W_DEFAUT } from './lib/sim.mjs';
import { h53, makeSigCarte } from './lib/journal.mjs';
import { cleCarteTour } from './lib/tour.mjs';
import { planTour, planNaif, finir as finirRaid, sieges as siegesRaid } from './lib/raid.mjs';
import { plan as planXp } from './lib/plan.mjs';
import * as MODELE from './lib/modele.mjs';
import * as PARTAGE from './lib/partage.mjs';
import { VERSION_SERVEUR } from './lib/partage-format.mjs';
import { construireWC, cleIA } from './lib/ia-commune.mjs';
import { limitePuissance, eveilDe, PALIERS } from './lib/puissance.mjs';
import { guidePalier } from './lib/guide.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.KITSU_PORT || 47123), TOKEN = randomBytes(16).toString('hex');
let FICHE = { v: null };
// Moteur du jeu charge au premier appel du panneau seulement (5.18) : le script (ping, conseil, equipes) n'a besoin que de la version
// et du manifeste, les calculs ont leur propre copie dans les fils. Serveur seul : ~45 Mo au lieu de ~145 Mo (mesure du 17/11).
let VER = readFileSync(D('engine', 'current.txt'), 'utf8').trim(), MAN = JSON.parse(readFileSync(D('engine', VER, 'manifest.json'), 'utf8')), ENG = null;
const moteur = async () => ENG ||= await loadEngine(VER);
const NCPU = os.availableParallelism?.() || os.cpus().length;
// Fils du conseil en combat crees a la demande et fermes apres 3 min sans conseil (5.18) : au repos, le serveur ne garde plus
// 11 copies du moteur du jeu en memoire (~300 Mo). Quand ils servent : meme nombre de fils et memes paquets, donc memes conseils.
const NPOOL = Math.max(1, NCPU - 1), POOL_REPOS = 3 * 60 * 1000;
baisserPriorite(os.constants.priority.PRIORITY_BELOW_NORMAL); // avant : fixee par la creation des fils au demarrage
let poolP = null, poolUtil = 0, poolActifs = 0;
const getPool = () => { poolUtil = Date.now(); return poolP ||= makePool(NPOOL, undefined, os.constants.priority.PRIORITY_BELOW_NORMAL).catch(e => { poolP = null; throw e; }); };
const avecPool = async f => { const p = await getPool(); poolActifs++; try { return await f(p); } finally { poolActifs--; poolUtil = Date.now(); } };
const fermerPool = async () => { const p = poolP; poolP = null; if (p) try { await (await p).close(); } catch {} };
setInterval(() => { if (poolP && !poolActifs && Date.now() - poolUtil > POOL_REPOS) fermerPool(); }, 30000).unref();
const T0 = Date.now(); let nConseil = 0, lastConseil = null;
const readJ = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
// Lecture gardee en memoire tant que le fichier ne change pas (5.18) : le panneau demande l'etat toutes les 1,5 s et relisait/reparsait
// chaque fois sauvegarde, poids, patchs, dernier resultat... Seulement pour etat(), qui ne modifie pas ces objets (copie JSON a l'envoi).
const jCache = new Map();
const readJc = f => { let st; try { st = statSync(f); } catch { jCache.delete(f); return null; } const c = jCache.get(f), k = st.mtimeMs + ':' + st.size; if (c && c.k === k) return c.v; const v = readJ(f); jCache.set(f, { k, v }); return v; };
let scriptVu = null, jeu = null;
// ---------- plan d'XP et de banniere (5.21) : tous les modes, a partir des resultats deja calcules, sans simulation ----------
// Le script prive (extension) peut ajouter sa part : Tour exacte, Arene, cartes a guetter (EXT.planPrive). Sans lui : public seul.
const planCalcule = async G => {
  const S = readJc(D('data', 'sauvegarde.json')); if (!S?.owned) return { err: 'aucune sauvegarde : ouvre le jeu avec le script, ou importe-la' };
  let prive = null; if (EXT?.planPrive) { try { prive = await EXT.planPrive({ D, readJ: readJc, S }); } catch (e) { say('plan prive : ' + e.message); } }
  const R = f => readJc(D('resultats', f));
  return planXp({ G, S, campagne: R('cauchemar3.json'), tour: R('tour.json'), raid: R('raid.json'), conseils: R('conseils-ia.json'), jeu, prive });
};
// Le modele vivant (5.28) : instantane apres chaque calcul et a l'ouverture de la page, ajoute seulement si quelque chose a change.
let MODELE_EN_COURS = null;
async function noterModele() {
  if (MODELE.aJour()) return false; // rien n'a change depuis le dernier instantane : pas de plan a recalculer
  if (MODELE_EN_COURS) return MODELE_EN_COURS;
  return MODELE_EN_COURS = (async () => {
    try {
      const sig = MODELE.signature(), plan = await planCalcule(ENG?.G || null), R = f => readJc(D('resultats', f));
      return MODELE.noter({ ...MODELE.instantane({ plan: plan.err ? null : plan, campagne: R('cauchemar3.json'), tour: R('tour.json'), raid: R('raid.json'), poids: readJc(D('data', 'poids.json')), t: MODELE.dateResultats() }), sig });
    } finally { MODELE_EN_COURS = null; }
  })();
}
// ---------- campagne : ce que coutera le calcul des 3 etoiles (affiche avant le lancement) ----------
// Memes regles que cauchemar3.mjs : cartes SSR/UR/LR possedees, combats de la campagne (sans halloween) par difficulte.
let COMBATS_DIFF = null;
// 5.44 : cartes par rarete (codes du jeu M = LR, L = UR, E = SSR) et ce que chaque rarete pese dans le dernier resultat, pour le
// choix des raretes avant le lancement. Campagne : trios du plan par combat qui en ont une et part des combats qu'ils couvrent.
// Tour : finalistes qui en ont une, et le meilleur.
const RAR_NOM = { M: 'LR', L: 'UR', E: 'SSR' };
function parRarete(G, ids) { const n = { LR: 0, UR: 0, SSR: 0 }; for (const id of ids) { const r = RAR_NOM[G.CHAR_BY_ID[id]?.r]; if (r) n[r]++; } return n; }
function poidsRaretes(G, d, tour) {
  const rar = id => RAR_NOM[G.CHAR_BY_ID[id]?.r], nom = id => G.CHAR_BY_ID[id]?.n || String(id), out = {};
  for (const r of ['LR', 'UR', 'SSR']) {
    if (tour) { const L = d?.trios || []; if (!L.length) continue; const avec = L.filter(x => x.ids.some(id => rar(id) === r));
      out[r] = { finalistes: avec.length, sur: L.length, meilleur: L[0].ids.some(id => rar(id) === r), ex: avec[0] ? { equipe: avec[0].ids.map(nom), etage: avec[0].etageMoyen } : null }; continue; }
    const e = d?.etages; if (!e?.plan?.length) continue;
    const total = e.combats?.length || e.plan.reduce((a, x) => a + x.combats, 0), avec = e.plan.filter(x => (e.trios[x.trio] || []).some(id => rar(id) === r));
    out[r] = { trios: avec.length, sur: e.plan.length, part: total ? +(100 * avec.reduce((a, x) => a + x.combats, 0) / total).toFixed(1) : 0, ex: avec[0] ? e.trios[avec[0].trio].filter(id => rar(id) === r).map(nom) : null };
  }
  return out;
}
function prevision() {
  const G = ENG.G, sv = readJ(D('data', 'sauvegarde.json')), cartes = Object.keys(sv?.owned || {}).filter(id => ['M', 'L', 'E'].includes(G.CHAR_BY_ID[id]?.r)).length;
  if (COMBATS_DIFF?.v !== VER) {
    const camp = G.ALL_WORLDS.filter(w => w.id !== 'halloween').flatMap(w => w.fights.map(f => f.id));
    const n = suf => camp.filter(f => { try { return !!G.findFight(f + suf); } catch { return false; } }).length;
    // 5.43 : carte des mondes et combats du jeu (meme ordre de difficultes que cauchemar3.json), pour que l'onglet Campagne
    // montre les mondes et combats arrives depuis le dernier calcul. Masque : bit k = le combat existe dans la difficulte k.
    const SUF = ['@n', '@hn', '@xn', '', '@h', '@x'], existe = f => { try { return !!G.findFight(f); } catch { return false; } };
    const carte = G.ALL_WORLDS.filter(w => w.id !== 'halloween').map(w => ({ id: w.id, nom: w.name || w.title || w.id, f: w.fights.map((f, i) => [f.id, f.idx ?? i, f.t || f.id, f.boss ? 1 : 0, SUF.reduce((m, s, k) => m | (existe(f.id + s) ? 1 << k : 0), 0)]) }));
    COMBATS_DIFF = { v: VER, c: { normal: n('@n'), difficile: n('@hn'), extreme: n('@xn'), campNormal: n(''), campDifficile: n('@h'), campExtreme: n('@x') }, carte };
  }
  let journal = 0; try { const f = readdirSync(D('cache')).filter(x => /^cauchemar3-.*\.jsonl$/.test(x)).map(x => D('cache', x)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]; if (f) journal = statSync(f).size; } catch {}
  const d = readJ(D('resultats', 'cauchemar3.json'));
  const ids = Object.keys(sv?.owned || {}).map(Number).filter(id => RAR_NOM[G.CHAR_BY_ID[id]?.r]);
  // 5.51 : combats deja a 3 etoiles dans ta partie (pve.stars), par difficulte : cauchemar3 ne les rejoue pas.
  const SUFK = { normal: '@n', difficile: '@hn', extreme: '@xn', campNormal: '', campDifficile: '@h', campExtreme: '@x' }, valides = {};
  for (const k of Object.keys(SUFK)) valides[k] = 0;
  for (const [f, v] of Object.entries(sv?.pve?.stars || {})) if (v >= 3) { const m = /(@xn|@hn|@n|@x|@h)?$/.exec(f)[0] || '', k = Object.keys(SUFK).find(x => SUFK[x] === m); if (k) valides[k]++; }
  return { valides, cartes, puissance: puissanceTable(G, sv, ids), parRarete: parRarete(G, ids), poidsRaretes: poidsRaretes(G, d, false), raretesDernier: d?.raretes || null, trios: cartes * (cartes - 1) * (cartes - 2) / 6, combats: COMBATS_DIFF.c, carte: COMBATS_DIFF.carte, fils: Math.max(1, NCPU - Math.max(1, reglages().filsReserves)), journalOctets: journal,
    dernier: d ? { date: d.date, vitesse: d.vitesse, duree: d.duree, trios: d.trios, combatsSimules: d.combatsSimules, cartes: d.cartes, entonnoir: d.entonnoir || null, combats: d.combats || null,
      campSous100: d.etages?.specialistes?.campagneSous100 ?? null, minParCombat: d.etages?.specialistes?.minutesParCombat ?? null, dureeParCombat: d.etages?.duree ?? null } : null };
}
// Tour : meme principe (cartes SSR/UR/LR possedees, tous leurs trios), journal cache/tour-*.jsonl.
// 5.42.1 : montees de 1re manche deja dans le journal, comptees comme tour.mjs les reprendra. Le journal ne sert que si le moteur
// du jeu et l'IA n'ont pas change depuis (cache/tour-etat.json, ecrit par tour.mjs) ; un trio n'est repris que si ses 3 cartes ont
// la meme cle (niveau, etoiles, liens, stats de la carte).
let SIGC = { v: null, f: null };
function previsionTour(niv) {
  const G = ENG.G, sv = readJ(D('data', 'sauvegarde.json')), ids = Object.keys(sv?.owned || {}).map(Number).filter(id => ['M', 'L', 'E'].includes(G.CHAR_BY_ID[id]?.r)), cartes = ids.length;
  const C3 = k => k * (k - 1) * (k - 2) / 6, trios = C3(cartes), mode = niv === '99' ? '99' : 'actuel';
  let journal = 0, reprises = 0, etat = 'vide', repRarete = null;
  try {
    const e = readJ(D('cache', 'tour-etat.json')), fj = e?.fichier && D('cache', path.basename(e.fichier));
    if (fj && existsSync(fj)) {
      journal = statSync(fj).size;
      const wKey = h53(JSON.stringify(reglagesAnalyse(sv, W_DEFAUT).W));
      if (e.version !== VER) etat = 'patch'; else if (e.wKey !== wKey) etat = 'ia'; else if (!e[mode]) etat = 'autreMode';
      else {
        if (SIGC.v !== VER) SIGC = { v: VER, f: makeSigCarte(G, ENG.B) };
        const EV = eveilDe(sv), vu = new Set(e[mode].cles), lv = id => mode === '99' ? EV.niveauMax(id) : sv.lv?.[id]?.l || 1; // 5.62 : memes cles que tour.mjs (Eveil)
        const dans = ids.filter(id => { const l = sv.lk?.[id]; return vu.has(cleCarteTour({ id, lv: lv(id), stars: sv.stars?.[id] || 0, ...(l ? { lk: l } : {}), ...EV.champs(id) }, SIGC.f)); }), k = dans.length;
        repRarete = parRarete(G, dans); // 5.44 : cartes reprises par rarete, pour recompter les reprises selon les raretes cochees
        reprises = C3(k); etat = 'ok';
      }
    }
  } catch {}
  const d = readJ(D('resultats', 'tour.json'));
  return { cartes, puissance: puissanceTable(G, sv, ids), parRarete: parRarete(G, ids), poidsRaretes: poidsRaretes(G, d?.methode === 'course' ? d : null, true), raretesDernier: d?.raretes || null, repRarete, trios, aSimuler: trios - reprises, reprises, etatJournal: etat, fils: Math.max(1, NCPU - Math.max(1, reglages().filsReserves)), journalOctets: journal, record: sv?.tower?.best ?? null,
    dernier: d?.methode === 'course' ? { date: d.date, vitesse: d.vitesse, duree: d.duree, trios: d.triosEssayes, montees: d.monteesSimulees, entonnoir: d.entonnoir } : null };
}
// ---------- reglages (onglet Reglages du panneau) ----------
const REG_DEF = { conseilMs: 700, filsReserves: 2, objectif: 's2', partage: { utiliser: false, envoyer: false, verifier: false, controler: true }, alertes: { energie: true, guilde: true, evenements: true, bannieres: true, patch: true, calcul: true, calculConseille: true } };
const reglages = () => { const r = readJ(D('data', 'reglages.json')) || {}; return { ...REG_DEF, ...r, alertes: { ...REG_DEF.alertes, ...(r.alertes || {}) } }; };
// ---------- alertes : file lue par l'application (notifications Windows) et par le panneau ----------
const alertes = []; const vues = new Set(readJ(D('data', 'alertes-vues.json')) || []);
function alerter(type, cle, titre, texte) {
  if (!reglages().alertes[type] || vues.has(cle)) return; vues.add(cle);
  try { writeFileSync(D('data', 'alertes-vues.json'), JSON.stringify([...vues].slice(-400))); } catch {}
  alertes.push({ id: Date.now() + Math.random(), type, titre, texte, t: Date.now() }); if (alertes.length > 50) alertes.shift(); say(`alerte : ${titre}`);
}
function verifierAlertes() {
  const now = Date.now(), J = jeu && now - jeu.t < 15 * 60000 ? jeu : null, jour = new Date().toISOString().slice(0, 10);
  if (J?.energie) { const e = J.energie; if (e.v >= e.max) alerter('energie', 'en-' + Math.floor((e.pleineA || now) / 600000), 'Energie pleine', `${e.v}/${e.max} : ton energie ne se recharge plus.`); }
  if (J?.guilde?.boss > 0 && new Date().getHours() >= 20) alerter('guilde', 'gw-' + jour, 'Boss de guilde', `${J.guilde.boss} essai(s) restant(s) avant minuit.`);
  for (const ev of J?.evenements || []) if (ev.fin && ev.fin - now < 24 * 3600000 && ev.fin > now && ev.reste > 0) alerter('evenements', 'ev-' + ev.titre + '-' + ev.fin, `Fin d'evenement : ${ev.titre}`, `Se termine dans ${Math.round((ev.fin - now) / 3600000)} h, ${ev.reste} premiere(s) victoire(s) a prendre.`);
  for (const b of J?.bannieres || []) alerter('bannieres', 'ban-' + b.serie + '-' + b.fin, `Banniere ${b.serie}`, b.fin ? `Ouverte jusqu'au ${new Date(b.fin).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : 'Nouvelle banniere.');
  const pt = (readJ(D('data', 'patchs.json')) || [])[0]; if (pt && !pt.vide) alerter('patch', 'patch-' + pt.vers, 'Patch KITSU detecte', `${pt.nouvellesCartes.length} nouvelles cartes, ${pt.cartesModifiees.length} modifiees${pt.tesCartes.length ? `, dont ${pt.tesCartes.length} des tiennes` : ''}.`);
  const cc = calculConseille(); if (cc.length) alerter('calculConseille', 'cc-' + cc.join('|'), 'Calcul conseille', cc.join(' ; '));
}
setInterval(verifierAlertes, 30000);
// Pourquoi relancer « Mettre a jour l'IA » : patch du jeu ou collection changee depuis la derniere analyse.
// 5.40.3 : les liens choisis (lk) comptent aussi ; sans lk, meme empreinte qu'avant (pas de fausse alerte « collection changee »).
const hashSave = sv => sv ? JSON.stringify([Object.keys(sv.owned || {}).sort(), Object.entries(sv.lv || {}).map(([k, v]) => k + ':' + (v?.l || v)).sort(), Object.entries(sv.stars || {}).sort(), ...(sv.lk && Object.keys(sv.lk).length ? [Object.entries(sv.lk).map(([k, v]) => k + ':' + [].concat(v || []).join('+')).sort()] : [])]).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0) : 0;
// 5.45 : etoiles gagnees par combat et record de la Tour. Hors de hashSave : elles ne changent pas les calculs, seulement l'affichage.
// 5.62 : Transcendances et Eveil (V2) comptent aussi : un changement reecrit la sauvegarde.
const hashJeu = sv => JSON.stringify([sv?.pve?.stars || {}, sv?.tower?.best ?? null, ...(sv?.rb || sv?.eveil ? [sv?.rb || null, sv?.eveil || null] : [])]);
// 5.45 : fiche de carte. Stats d'une carte seule (sans collectif) a son niveau et au 99, lues dans le moteur du jeu via
// setupBattle, echelle = meilleure valeur de chaque stat parmi les cartes SSR, UR et LR au niveau 99 (calculee une fois par
// version du jeu), et liens actifs du trio donne (G.activeLinks, 6 gardes par carte selon tes choix lk).
let ECHELLE = { v: null, e: null };
const STAT_U = [['hp', 'maxHp'], ['atk', 'atk'], ['def', 'def'], ['spd', 'spd'], ['crit', 'crit']];
function statsUnite(G, B, id, lv, stars) {
  const st = G.setupBattle(G.findFight(G.ALL_WORLDS[0].fights[0].id + '@xn'), [{ id: +id, lv, stars }], 1).st, u = B.allies(st)[0];
  return Object.fromEntries(STAT_U.map(([k, f]) => [k, +u?.[f] || 0]));
}
function carteStats(id, trio) {
  const G = ENG.G, B = ENG.B, c = G.CHAR_BY_ID[id]; if (!c) return { err: 'carte inconnue' };
  const sv = readJ(D('data', 'sauvegarde.json')), lv = sv?.owned?.[id] ? (sv.lv?.[id]?.l || sv.lv?.[id] || 1) : 1, stars = sv?.stars?.[id] || 0, out = { id: +id, lv, stars, possedee: !!sv?.owned?.[id] };
  try {
    out.actuel = statsUnite(G, B, id, lv, stars); out.max = statsUnite(G, B, id, 99, stars);
    if (ECHELLE.v !== VER) { const e = {}; for (const x of Object.values(G.CHAR_BY_ID)) if (['M', 'L', 'E'].includes(x.r)) try { const s = statsUnite(G, B, x.id, 99, 0); for (const k in s) e[k] = Math.max(e[k] || 0, s[k]); } catch {} ECHELLE = { v: VER, e }; }
    out.echelle = ECHELLE.e;
  } catch (e) { out.err = 'stats illisibles dans le moteur du jeu (' + e.message + ')'; }
  const t = String(trio || '').split(',').map(Number).filter(x => G.CHAR_BY_ID[x]);
  if (t.length === 3 && t.includes(+id)) try {
    const kept = G.linkPlan(t, sv?.lk || {}).kept || {}, garde = new Set(Object.values(kept).flat().map(l => G.linkKey(l)));
    out.trio = t; out.liens = G.activeLinks(t).map(l => ({ nom: l.name, stat: l.stat, pct: l.pct, ids: l.ids.filter(x => t.includes(x)), garde: garde.has(G.linkKey(l)) && l.ids.filter(x => t.includes(x)).every(x => (kept[x] || []).some(k => G.linkKey(k) === G.linkKey(l))) }));
  } catch {}
  return out;
}
function calculConseille() {
  const d = readJ(D('resultats', 'dernier.json')), sv = readJ(D('data', 'sauvegarde.json')), out = [];
  if (!d) { if (sv) out.push('aucune analyse complete pour ta collection'); return out; }
  if (d.version && d.version !== VER) out.push('le jeu a change depuis la derniere analyse');
  if (sv && d.saveHash != null && d.saveHash !== hashSave(sv)) out.push('ta collection a change (cartes, niveaux, etoiles ou liens)');
  const pw = readJ(D('data', 'poids.json')); if (pw?.t && Date.parse(d.date) < pw.t) out.push("l'IA a ete reentrainee depuis");
  return out;
}
const scriptFile = () => [path.join(CODE, '..', 'kitsu_ai.user.js'), path.join(CODE, 'kitsu_ai.user.js')].find(f => existsSync(f));
function scriptInfo() { const f = scriptFile(); if (!f) return { trouve: false, vu: scriptVu }; const t = readFileSync(f, 'utf8'); return { trouve: true, version: (t.match(/@version\s+(\S+)/) || [])[1], taille: t.length, lignes: t.split('\n').length, vu: scriptVu, url: 'https://github.com/Drien95/kitsu-ai/releases/latest/download/kitsu_ai.user.js' }; }

// ---------- Raid (5.20) : conseil du tour et meilleur trio au salon, demandes par le script ----------
// Tour : l'etat du combat lu par le script (celui que la page affiche), son siege, les actions deja prevues par les partenaires.
// On renvoie les actions de tes cartes et une estimation : raids finis par la strategie depuis cet etat (6 tirages).
const RAID_SALON = new Map();
async function raidConseil(q) {
  const { G } = await moteur(), t0 = Date.now();
  if (q.tour) {
    const s0 = q.tour.combat, me = +q.tour.siege; if (!s0?.battle?.units || !s0.forecast) return { err: 'etat du raid incomplet' };
    const base = () => { const s = JSON.parse(JSON.stringify(s0)); s.config = { ...G.RAID, ...(s.config || {}) }; if (s.seed == null) s.seed = 7919; s.log = []; return s; };
    const intents = {}; for (const [k, v] of Object.entries(q.tour.intents || {})) if (+k !== me && Array.isArray(v) && v.length) intents[k] = v;
    const s = base(), plan = planTour(G, s, intents), mes = plan.par[me] || [];
    // Estimation : les partenaires font ce qu'ils ont prevu (sinon la strategie), toi le conseil, ou toi qui frappes seulement.
    const actions = mien => siegesRaid(s).flatMap(p => p === me ? mien : (intents[p] || plan.par[p] || []).map(a => ({ unit: a.unit, kind: a.kind, ...(a.target ? { target: a.target } : {}) })));
    const estimer = mien => { let w = 0; const n = 6; for (let k = 0; k < n; k++) { const x = base(); x.seed = (x.seed + k * 104729) >>> 0; try { w += finirRaid(G, x, actions(mien)).gagne ? 1 : 0; } catch {} } return Math.round(100 * w / n); };
    const avec = estimer(mes), sans = estimer(planNaif(G, s, me));
    return { ms: Date.now() - t0, tour: s0.turn, forecast: s0.forecast, ruptures: [...plan.R], actions: mes, victoire: avec, sansConseil: sans, revives: s0.revives };
  }
  if (q.salon) {
    // Meilleur trio avec CES partenaires (cartes vues dans le salon, supposees niveau 99) : tes trios candidats, 6 raids chacun.
    const part = (q.salon.partenaires || []).filter(a => Array.isArray(a) && a.length).slice(0, 2), cle = JSON.stringify(part);
    if (RAID_SALON.has(cle) && Date.now() - RAID_SALON.get(cle).t < 10 * 60000) return RAID_SALON.get(cle).r;
    const sv = readJ(D('data', 'sauvegarde.json')) || {}, lv = id => sv.lv?.[id]?.l || 1, st = id => sv.stars?.[id] || 0, R = readJ(D('resultats', 'raid.json'));
    let cand = R ? [...(R.classement || []).map(x => x.ids), ...(R.premierTour || []).map(x => x.ids)] : [];
    if (!cand.length) { const ids = Object.keys(sv.owned || {}).map(Number).filter(id => ['M', 'L', 'E'].includes(G.CHAR_BY_ID[id]?.r) && lv(id) >= 60).sort((a, b) => lv(b) - lv(a)).slice(0, 10); for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) cand.push([ids[a], ids[b], ids[c]]); }
    const L = limitePuissance(G, sv, { transcendance: null, sansLimite: false }), EV = eveilDe(sv); // 5.62 : limite de puissance et Eveil (V2)
    const vus = new Set(); cand = cand.filter(t => { const k = t.slice().sort().join(); if (vus.has(k)) return false; vus.add(k); return t.every(id => sv.owned?.[id]) && L.ok(t); }).slice(0, 60);
    if (!cand.length) return { trios: [], ms: 0 };
    const autres = part.flat().slice(0, 6).map(id => ({ id: +id, lv: 99, stars: 0 })), N = 6;
    const r = await avecPool(pool => pool.runAll(cand.map(t => ({ type: 'raid', moi: t.map(id => ({ id, lv: lv(id), stars: st(id), ...EV.champs(id) })), autres: Array.from({ length: N }, () => autres), graine: 7919 })), {}, {}, 2));
    const trios = cand.map((t, i) => ({ ids: t, equipe: t.map(id => G.CHAR_BY_ID[id]?.n || String(id)), victoire: Math.round(100 * r[i].win / r[i].n), part: Math.round(100 * r[i].part / r[i].n) })).sort((a, b) => b.victoire - a.victoire || b.part - a.part).slice(0, 5);
    const out = { ms: Date.now() - t0, joueurs: part.length + 1, trios, raids: cand.length * N }; RAID_SALON.set(cle, { t: Date.now(), r: out }); if (RAID_SALON.size > 20) RAID_SALON.delete(RAID_SALON.keys().next().value);
    return out;
  }
  if (q.fin) { // raid termine : garde pour l'onglet Raids (50 derniers)
    const f = D('data', 'raids.json'), all = readJ(f) || [], x = q.fin; if (!x?.id || all.some(r => r.id === x.id)) return { ok: true };
    all.unshift({ id: String(x.id).slice(0, 60), t: Date.now(), gagne: !!x.gagne, etape: x.etape | 0, phase: x.phase | 0, tour: x.tour | 0, trio: (x.trio || []).slice(0, 3).map(Number), partenaires: (x.partenaires || []).slice(0, 6).map(Number), joueurs: x.joueurs | 0, suivis: x.suivis | 0, conseils: x.conseils | 0 });
    mkdirSync(D('data'), { recursive: true }); writeFileSync(f, JSON.stringify(all.slice(0, 50))); say(`raid ${x.gagne ? 'gagne' : 'perdu'} enregistre`); return { ok: true };
  }
  return { err: 'demande inconnue' };
}
// IA commune en service et derniere comparaison avec ton IA (cadre validateur).
async function infoIA() {
  const c = await PARTAGE.iaCommune(PARTAGE.reglagesPartage()).catch(() => null), W = c ? construireWC(c.p) : construireWC(readJ(path.join(here, 'poids-communs.json')));
  const cmp = readJ(D('resultats', 'comparaison-ia.json')), poids = readJ(D('data', 'poids.json'));
  return { ia: { source: c?.source || 'appli', t: c?.p?.t || null, cle: cleIA(W) }, comparaison: cmp ? { ...cmp, aJour: cmp.commune === cleIA(W) && (cmp.poidsT || null) === (poids?.t || null) } : null };
}
// 5.63 : trios acceptes par la limite de puissance, pour chaque choix de raretes (LR, UR, SSR et leurs combinaisons) et chaque
// palier (« reel » = ton palier, puis 0 a 5 et 9), compte par classes de cartes (instantane meme pour 7 M trios).
function puissanceTable(G, sv, ids) {
  try {
    if (!G || !sv?.owned) return null; const L0 = limitePuissance(G, sv, { transcendance: null, sansLimite: false }); if (!L0.actif) return null;
    const code = { LR: 'M', UR: 'L', SSR: 'E' }, subs = [['LR'], ['UR'], ['SSR'], ['LR', 'UR'], ['LR', 'SSR'], ['UR', 'SSR'], ['LR', 'UR', 'SSR']];
    const ligne = L => Object.fromEntries(subs.map(sb => [sb.join(','), L.compter(ids.filter(id => sb.some(r => code[r] === G.CHAR_BY_ID[id]?.r))).ok]));
    const paliers = {}; for (const n of [...new Set([...PALIERS, L0.reel])]) { const L = limitePuissance(G, sv, { transcendance: n, sansLimite: false }); paliers[n] = { plafond: L.plafond, ok: ligne(L) }; }
    return { palier: L0.reel, plafond: L0.plafond, paliers };
  } catch { return null; }
}
function puissanceInfo(raretes) {
  const G = ENG?.G, sv = readJ(D('data', 'sauvegarde.json')); if (!G || !sv?.owned) return { err: 'moteur ou sauvegarde absents' };
  const codes = String(raretes || 'LR,UR,SSR').split(',').map(r => ({ LR: 'M', UR: 'L', SSR: 'E' })[r]).filter(Boolean);
  const ids = Object.keys(sv.owned).map(Number).filter(id => codes.includes(G.CHAR_BY_ID[id]?.r));
  const L0 = limitePuissance(G, sv, { transcendance: null, sansLimite: false }), c0 = L0.compter(ids);
  const paliers = PALIERS.map(n => { const L = limitePuissance(G, sv, { transcendance: n, sansLimite: false }), c = L.compter(ids); return { palier: n, plafond: L.actif ? L.plafond : null, trios: c.ok }; });
  return { actif: L0.actif, palier: L0.reel, plafond: L0.actif ? L0.plafond : null, cartes: ids.length, triosTotal: c0.total, triosAcceptes: c0.ok, paliers };
}
const logs = []; const say = m => { const l = `[${new Date().toLocaleTimeString('fr-FR')}] ${m}`; logs.push(l); if (logs.length > 300) logs.shift(); console.log(l); };
// ---------- taches (une a la fois : elles utilisent tout le processeur) ----------
// 5.44 : choix avant le lancement (Campagne et Tour) : raretes essayees et pause au bout d'un temps de travail (0 = jusqu'au bout).
const choixCalcul = o => { const r = String(o.raretes || '').split(',').filter(x => ['LR', 'UR', 'SSR'].includes(x)), p = Math.max(0, Math.min(10080, Math.round(+o.pause) || 0));
  // 5.63 : palier de Transcendance du calcul (vide : ton palier reel, lu dans la sauvegarde).
  const pal = o.palier === '' || o.palier == null ? null : Math.round(+o.palier);
  return [...(r.length && r.length < 3 ? ['--raretes', r.join(',')] : []), ...(p ? ['--pause-apres', String(p)] : []), ...(Number.isInteger(pal) && pal >= 0 && pal <= 20 ? ['--transcendance', String(pal)] : [])]; };
const ACTIONS = {
  telecharger: { nom: 'Mettre a jour le moteur du jeu', cmd: ['telecharger.mjs'] },
  tout: { nom: 'Analyse complete', cmd: ['tout.mjs'], opts: o => [...(o.niveaux ? ['--niveaux', o.niveaux] : []), ...(o.tirages ? ['--tirages', String(o.tirages)] : []), ...(o.cartes ? ['--cartes', String(o.cartes)] : []), ...(o.max ? ['--max', String(o.max)] : [])] },
  mode: { nom: 'Analyse par mode', cmd: ['analyse.mjs'], opts: o => ['--mode', o.mode || 'boss', ...(o.lv99 ? ['--lv99'] : []), '--top', String(o.top || 30)] },
  entrainer: { nom: "Entrainement de l'IA", cmd: ['entrainer.mjs'], opts: o => ['--types', o.types || 'nm,boss,norm', '--generations', String(o.generations || 40)] },
  plafond: { nom: 'Mesure du plafond', cmd: ['plafond.mjs'], opts: o => ['--n', String(o.n || 10), '--k', String(o.k || 6), '--r', String(o.r || 20)] },
  bench: { nom: 'Mesure de vitesse', cmd: ['bench.mjs'] },
  imitation: { nom: "IA par imitation", cmd: ['distiller.mjs'], opts: o => ['--types', o.types || 'nm,boss', '--combats', String(o.combats || 160)] },
  // 5.30 : les trios du plan du calcul Campagne s'il existe (--trios plan), sinon les n meilleures equipes de la derniere analyse.
  equipes: { nom: 'Entrainement par equipe', cmd: ['entrainer.mjs'], opts: o => ['--types', 'aucun', '--par-equipe', String(o.n || 3), '--trios', 'plan', '--generations', String(o.generations || 25)] },
  tour: { nom: "Tour de l'infini", cmd: ['tour.mjs'], opts: o => ['--niveaux', o.niveaux === '99' ? '99' : 'actuel', ...choixCalcul(o)] },
  cauchemar3: { nom: 'Campagne : 3 etoiles', cmd: ['cauchemar3.mjs'], opts: o => ['--niveaux', o.niveaux === 'actuel' ? 'actuel' : '99', '--difficultes', o.difficultes === 'cauchemar' ? 'cauchemar' : 'toutes', '--budget-specialistes', String(o.specialistes == null ? 60 : Math.max(0, Math.min(1440, Math.round(+o.specialistes) || 0))), ...choixCalcul(o)] },
  diagnostic3: { nom: 'Campagne : pourquoi la 3e etoile saute', cmd: ['diagnostic3.mjs'] },
  raid: { nom: 'Raid : meilleur trio', cmd: ['raid.mjs'], opts: o => ['--niveaux', o.niveaux === '99' ? '99' : 'actuel', '--tirages', String(Math.max(2, Math.min(40, +o.tirages || 8)))] },
  comparerIA: { nom: "Comparer ton IA a l'IA commune", cmd: ['comparer-ia.mjs'], admin: true },
  deployerPartage: { nom: 'Mettre a jour le serveur de la base commune', cmd: ['partage-deployer.mjs'], admin: true },
  conseils: { nom: 'Conseils de cartes', cmd: ['conseils.mjs'], opts: o => ['--parties', o.parties || 'collectifs,xp,tirage,duos,marche'] },
  // 5.63 : MR des Souvenirs (7 jours apres une Transcendance) mesurees au palier vise (1 par defaut : apres ta 1re Transcendance).
  souvenirs: { nom: 'Souvenirs : MR a viser', cmd: ['conseils.mjs'], opts: o => ['--parties', 'souvenirs', '--transcendance', String(Number.isInteger(+o.palier) && +o.palier >= 0 ? +o.palier : 1)] },
};
// Chaine complete : moteur a jour, entrainement de l'IA, puis analyse complete avec les nouveaux reglages.
const CHAINES = { complet: { nom: "Mettre a jour l'IA", etapes: [['telecharger', {}], ['entrainer', { types: 'nm,boss,norm', generations: 40 }], ['tout', { niveaux: 'actuel,99' }], ['entrainer', { types: 'tour', generations: 20 }], ['equipes', { n: 3 }], ['conseils', {}]] } };
let job = null; const history = []; let CARTES = {};
function lancer(action, o = {}) {
  if (job && !job.fin) throw new Error('une tache tourne deja : ' + job.nom);
  if (CHAINES[action]) return lancerChaine(action, o);
  return lancerEtape(action, o);
}
function lancerChaine(action, o) {
  const C = CHAINES[action], etapes = C.etapes.map(([a, d]) => [a, { ...d, ...(o[a] || {}) }]);
  const chaine = { nom: C.nom, etapes: etapes.map(([a]) => ACTIONS[a].nom), i: 0, debut: Date.now(), lignes: [], arretee: false };
  const suivante = () => {
    if (chaine.arretee || chaine.i >= etapes.length) { chaine.fin = Date.now(); job = { ...job, nom: C.nom, fin: chaine.fin, code: chaine.arretee ? 1 : 0, chaine }; noterModele().catch(() => {}); say(`${C.nom} : ${chaine.arretee ? 'arretee' : 'terminee'} (${Math.round((chaine.fin - chaine.debut) / 1000)} s)`); return; }
    const [a, d] = etapes[chaine.i];
    lancerEtape(a, d, code => { if (code !== 0) chaine.arretee = true; chaine.i++; suivante(); }, chaine);
  };
  say(`${C.nom} : ${chaine.etapes.join(', puis ')}`);
  suivante(); return job.id;
}
function lancerEtape(action, o = {}, apres = null, chaine = null) {
  const A = ACTIONS[action]; if (!A) throw new Error('action inconnue');
  if (A.admin && !PARTAGE.identite().admin) throw new Error('reserve au PC validateur');
  const fils = Math.max(1, NCPU - Math.max(1, reglages().filsReserves)); // des fils restent libres pour le conseil en combat
  const args = [...A.cmd, ...(A.opts ? A.opts(o) : []), ...(['tout', 'mode', 'entrainer', 'imitation', 'equipes', 'conseils', 'souvenirs', 'tour', 'cauchemar3', 'tourExact', 'comparerIA'].includes(action) ? ['--fils', String(fils)] : [])];
  const p = spawn(process.execPath, args, { cwd: here, env: { ...process.env, KITSU_MOTEUR: here } });
  // Priorite « inactive » pour tout calcul (prive compris) : YouTube, le jeu et le conseil en combat passent devant, sans perte quand le PC est libre.
  try { os.setPriority(p.pid, os.constants.priority.PRIORITY_LOW); } catch {}
  const prev = chaine && job ? job.lignes : [];
  job = { id: Date.now(), action, nom: chaine ? `${chaine.nom} (${chaine.i + 1}/${chaine.etapes.length} : ${A.nom})` : A.nom, args: args.join(' '), debut: chaine ? chaine.debut : Date.now(), lignes: chaine ? [...prev, `=== ${A.nom} ===`] : [], fin: null, code: null, proc: p, chaine };
  const add = d => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) { job.lignes.push(l); if (job.lignes.length > 2000) job.lignes.shift(); } };
  p.stdout.on('data', add); p.stderr.on('data', add);
  p.on('close', async code => { if (apres && !(chaine && chaine.arretee)) { history.unshift({ nom: A.nom, debut: Date.now(), fin: Date.now(), code }); return apres(code); } job.fin = Date.now(); job.code = code; job.pause = code === 0 && job.lignes.slice(-20).some(l => /pause apres \d+ min/.test(l)); noterModele().catch(() => {}); history.unshift({ nom: job.nom, debut: job.debut, fin: job.fin, code }); history.length = Math.min(history.length, 20); alerter('calcul', 'job-' + job.id, code === 0 ? `${job.nom} : termine` : `${job.nom} : arrete`, `En ${Math.round((job.fin - job.debut) / 60000)} min.`); say(`${job.nom} : termine (${Math.round((job.fin - job.debut) / 1000)} s, code ${code})`);
    if (action === 'telecharger') { try { const v = readFileSync(D('engine', 'current.txt'), 'utf8').trim(); if (v !== VER) { say(`nouveau moteur ${v} : redemarre le panneau (KitsuAI.bat) pour l'utiliser dans le conseil en combat`); } } catch {} } });
  say(`${A.nom} : lance (${args.join(' ')})`);
  return job.id;
}
// ---------- conseil en combat ----------
async function conseil(q) { return avecPool(pool => conseil0(pool, q)); }
async function conseil0(pool, { st, key, cands, W, budget }) {
  budget = budget || reglages().conseilMs;
  const t0 = Date.now(), stats = cands.map((c, i) => ({ ...c, i, n: 0, s2: 0, s3: 0, win: 0, hp: 0 }));
  // Tour de l'infini : les etoiles ne comptent pas, seuls la victoire et les PV gardes pour les etages suivants (12 % de soin seulement).
  const tour = typeof st === 'string' && st.includes('"__tower":1');
  const val = tour ? r => (r.win + 0.5 * r.hp) / Math.max(1, r.n) : r => (r.s2 + 0.5 * r.s3 + 0.2 * r.win) / Math.max(1, r.n);
  let alive = stats.slice(), seed = (Math.random() * 1e9) >>> 0, round = 0;
  const parts = job && !job.fin ? 1 : Math.max(1, Math.min(pool.n, 8));
  while (alive.length) {
    const per = round === 0 ? 24 : 16;
    const jobs = []; for (let p = 0; p < parts; p++) jobs.push({ type: 'roll', st, key, cands: alive.map(c => ({ i: c.i, kind: c.kind, tgt: c.tgt })), n: Math.ceil(per / parts), seed: seed + p * 1000003 + round * 7 });
    const res = await pool.runAll(jobs, W, {}, 1);
    for (const part of res) for (const r of part) { const a = stats[r.i]; a.n += r.n; a.s2 += r.s2; a.s3 += r.s3; a.win += r.win; a.hp += r.hp || 0; }
    round++;
    if (Date.now() - t0 > budget || round >= 12) break;
    const best = Math.max(...alive.map(val)); alive = alive.filter(r => best - val(r) < 0.12 + 0.6 / Math.sqrt(r.n));
    if (alive.length < 2) break;
  }
  const out = stats.map(r => ({ kind: r.kind, tgt: r.tgt, n: r.n, s2: r.s2 / Math.max(1, r.n), s3: r.s3 / Math.max(1, r.n), win: r.win / Math.max(1, r.n), hp: r.hp / Math.max(1, r.n), v: val(r) })).sort((a, b) => b.v - a.v);
  return { ms: Date.now() - t0, sims: stats.reduce((a, r) => a + r.n, 0), res: out };
}
// ---------- etat ----------
function etat() {
  const sv = readJc(D('data', 'sauvegarde.json')), pw = readJc(D('data', 'poids.json'));
  const CH = ENG.G.CHAR_BY_ID, own = Object.keys(sv?.owned || {}).map(Number);
  const res = existsSync(D('resultats')) ? readdirSync(D('resultats')).filter(f => /\.(csv|json|txt)$/.test(f) && f !== 'dernier.json').map(f => { const x = statSync(D('resultats', f)); return { f, t: x.mtimeMs, o: x.size }; }).sort((a, b) => b.t - a.t) : [];
  let disque = null; try { disque = readFileSync(D('engine', 'current.txt'), 'utf8').trim(); } catch {}
  return {
    moteur: VER, moteurDisque: disque, mondes: ENG.G.ALL_WORLDS.map(w => `${w.id} (${w.fights.length})`), cartes: Object.keys(CH).length,
    cpu: os.cpus()[0]?.model, coeurs: NCPU, fils: NPOOL, memoire: Math.round(os.totalmem() / 2 ** 30), uptime: Math.round((Date.now() - T0) / 1000),
    conseil: { n: nConseil, dernier: lastConseil }, port: PORT,
    sauvegarde: sv ? { t: sv.t, script: sv.script, cartes: own.length, lr: own.filter(i => CH[i]?.r === 'M').length, ur: own.filter(i => CH[i]?.r === 'L').length, ssr: own.filter(i => CH[i]?.r === 'E').length, equipe: (sv.team || []).map(i => CH[i]?.n), guilde: sv.guild?.boss ? `${sv.guild.boss.name} niv ${sv.guild.boss.lv}` : null, compte: sv.acct?.lv } : null,
    poids: pw ? { t: pw.t, gains: pw.gains } : null,
    job: job ? { id: job.id, nom: job.nom, args: job.args, debut: job.debut, fin: job.fin, code: job.code, pause: !!job.pause, lignes: job.lignes.slice(-400), chaine: job.chaine ? { etapes: job.chaine.etapes, i: job.chaine.i } : null } : null,
    script: scriptInfo(), appVersion: process.env.KITSU_APP_VERSION || null, reglages: reglages(), alertes: alertes.slice(-20), calculConseille: calculConseille(), patchs: (readJc(D('data', 'patchs.json')) || []).slice(0, 10), jeu, sauvegardeAuto: sv?.auto || false,
    historique: history, resultats: res.slice(0, 40), journal: logs.slice(-60),
    dernier: readJc(D('resultats', 'dernier.json')),
    conseils: readJc(D('resultats', 'conseils-ia.json')), imitation: readJc(D('resultats', 'ia-imitation.json')),
  };
}
// ---------- serveur HTTP ----------
const body = req => new Promise((res, rej) => { let b = ''; req.on('data', d => { b += d; if (b.length > 8e6) { req.destroy(); rej(new Error('trop gros')); } }); req.on('end', () => res(b)); });
const send = (res, code, obj, type = 'application/json', extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra }); res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)); };
const CORS = { 'Access-Control-Allow-Origin': 'https://kitsu.games', 'Access-Control-Allow-Headers': 'Content-Type' };
const own = req => req.headers['x-kitsu-token'] === TOKEN && (!req.headers.origin || req.headers.origin === `http://127.0.0.1:${PORT}`);
// Extension locale facultative (dossier prive/, jamais publie) : routes en plus, chargees seulement si le fichier existe.
let EXT = null; const extF = [D('prive', 'serveur.mjs'), path.join(here, 'prive', 'serveur.mjs')].find(f => existsSync(f)); if (extF) { try { EXT = await import(pathToFileURL(extF).href); if (EXT.actions) Object.assign(ACTIONS, EXT.actions); say('extension locale chargee'); } catch (e) { say('extension locale : ' + e.message); } }
http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain', CORS);
    if (EXT?.route && await EXT.route({ req, res, u, send, body, ENG, CORS, own, say, D })) return;
    // Pour le script du jeu
    if (u.pathname === '/ping') { if (u.searchParams.get('v')) scriptVu = { v: u.searchParams.get('v'), t: Date.now() }; } if (u.pathname === '/ping') return send(res, 200, { ok: true, version: VER, dom: MAN.dom, fils: NPOOL, poidsT: readJ(D('data', 'poids.json'))?.t || 0 }, 'application/json', CORS);
    if (u.pathname === '/poids') { const p = readJ(D('data', 'poids.json')); return send(res, p ? 200 : 404, p || {}, 'application/json', CORS); }
    const duScript = req.headers['x-kitsu-script'] === '1';
    if (['/sauvegarde', '/equipes', '/jeu', '/raid'].includes(u.pathname) && req.method === 'POST' && !duScript) return send(res, 403, { err: 'reserve au script KitsuAI' }, 'application/json', CORS);
    if (u.pathname === '/sauvegarde' && req.method === 'POST') {
      const j = JSON.parse(await body(req)); if (!j.owned || !j.lv) return send(res, 400, { err: 'export invalide' }, 'application/json', CORS);
      const old = readJ(D('data', 'sauvegarde.json')); mkdirSync(D('data'), { recursive: true });
      if (hashSave(old) !== hashSave(j) || hashJeu(old) !== hashJeu(j) || !old?.guild && j.guild) { writeFileSync(D('data', 'sauvegarde.json'), JSON.stringify({ ...j, auto: true })); say(`sauvegarde mise a jour par le script (${Object.keys(j.owned).length} cartes)`); }
      return send(res, 200, { ok: true }, 'application/json', CORS);
    }
    if (u.pathname === '/jeu' && req.method === 'POST') { jeu = { ...JSON.parse(await body(req)), t: Date.now() }; verifierAlertes(); return send(res, 200, { ok: true }, 'application/json', CORS); }
    if (u.pathname === '/equipes' && req.method === 'POST') {
      // Classement des trios pour un combat, demande par le guide : 24 tirages par trio sur tous les coeurs.
      const q = JSON.parse(await body(req));
      if (q.conseil) { // trios du calcul Campagne pour ce combat (meilleur et trio du plan), lecture seule
        const c3 = readJ(D('resultats', 'cauchemar3.json')), e = c3?.etages, row = e?.combats?.find(c => c[0] === String(q.fid));
        // 5.28 : avec l'extension privee, trio du calcul Campagne exact pour ce combat (sinon null : public seul).
        let exact = null; try { exact = EXT?.trioExact ? EXT.trioExact({ D, readJ, fid: String(q.fid) }) : null; } catch {}
        // 5.62 : un calcul fait avant la V2 peut proposer un trio que la limite de puissance refuse : on ne le renvoie pas.
        let L = null; try { L = ENG?.G ? limitePuissance(ENG.G, readJ(D('data', 'sauvegarde.json')) || {}, { transcendance: null, sansLimite: false }) : null; } catch {}
        const okT = t => !L || L.ok(t);
        if (exact?.ids && !okT(exact.ids)) exact = null;
        return send(res, 200, { trios: row ? [...new Set([row[2], row[4]])].filter(i => i >= 0).map(i => e.trios[i]).filter(t => Array.isArray(t) && okT(t)) : [], niveaux: c3?.niveaux ?? null, exact, plafond: L?.actif ? L.plafond : null }, 'application/json', CORS);
      }
      if (q.dom && q.dom !== MAN.dom) return send(res, 409, { err: 'version' }, 'application/json', CORS);
      const t0 = Date.now(), seeds = Array.from({ length: q.seeds || 24 }, (_, i) => i + 1);
      const r = await avecPool(pool => pool.runAll(q.equipes.map(team => ({ team, fights: [q.fid], seeds })), q.W, {}, 4));
      return send(res, 200, { ms: Date.now() - t0, res: r }, 'application/json', CORS);
    }
    // Carte qui recoit les parchemins d'XP, pour le script (le moteur du jeu n'est pas charge pour ca : noms lus dans la page).
    // suite (5.37) : 6 premieres montees du plan global (Campagne, Tour, Raid, Arene en prive), dans son ordre : poids d'XP du farm.
    if (u.pathname === '/plan' && req.method === 'GET') { const p = await planCalcule(ENG?.G || null); return send(res, 200, p.err ? p : { t: p.t, score: p.score, cible: p.cible && { id: p.cible.id, niveau: p.cible.niveau, xp: p.cible.xp, raison: p.cible.raison }, suite: (p.cartes || []).slice(0, 6).map(c => c.ids) }, 'application/json', CORS); }
    if (u.pathname === '/raid' && req.method === 'POST') return send(res, 200, await raidConseil(JSON.parse(await body(req))), 'application/json', CORS);
    if (u.pathname === '/conseil' && req.method === 'POST') {
      const q = JSON.parse(await body(req));
      if (q.dom && q.dom !== MAN.dom) return send(res, 409, { err: 'version', attendu: q.dom, moteur: MAN.dom }, 'application/json', CORS);
      const r = await conseil(q); nConseil++; lastConseil = { t: Date.now(), ms: r.ms, sims: r.sims };
      return send(res, 200, r, 'application/json', CORS);
    }
    // Application (notifications Windows) : secret partage au demarrage
    if (u.pathname === '/app/alertes' && process.env.KITSU_APP_SECRET && req.headers['x-kitsu-app'] === process.env.KITSU_APP_SECRET) { const depuis = +(u.searchParams.get('depuis') || 0); return send(res, 200, alertes.filter(a => a.id > depuis)); }
    // Panneau
    if (u.pathname === '/' || u.pathname === '/index.html') return send(res, 200, readFileSync(path.join(here, 'panneau', 'index.html'), 'utf8').replace('__TOKEN__', TOKEN).replace('<!--EXT-->', EXT?.panneau?.() || ''), 'text/html; charset=utf-8');
    if (u.pathname.startsWith('/api/')) {
      await moteur();
      if (!own(req)) return send(res, 403, { err: 'jeton invalide (recharge le panneau)' });
      if (u.pathname === '/api/etat') return send(res, 200, etat());
      if (u.pathname === '/api/lancer' && req.method === 'POST') { const q = JSON.parse(await body(req)); return send(res, 200, { id: lancer(q.action, q.options || {}) }); }
      if (u.pathname === '/api/arreter' && req.method === 'POST') { if (job && !job.fin) { if (job.chaine) job.chaine.arretee = true; job.proc.kill(); say(job.nom + ' : arrete'); } return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/script') return send(res, 200, scriptInfo(false));
      if (u.pathname === '/api/reglages' && req.method === 'POST') { const r = { ...reglages(), ...JSON.parse(await body(req)) }; mkdirSync(D('data'), { recursive: true }); writeFileSync(D('data', 'reglages.json'), JSON.stringify(r, null, 1)); say('reglages enregistres'); return send(res, 200, r); }
      // Fiches des cartes pour l'affichage (nom, rarete, serie, adresse du portrait). Les portraits ne sont pas copies :
      // le panneau les affiche depuis leur adresse d'origine, comme le jeu.
      // 5.63 : limite de puissance (V2) : trios acceptes sur le total, pour ton palier et pour chaque palier du guide.
      // 5.63 : guide d'un palier de Transcendance (resultats deja calcules, sans simulation).
      if (u.pathname === '/api/guide') { const S = readJc(D('data', 'sauvegarde.json')); if (!S?.owned) return send(res, 404, { err: 'aucune sauvegarde' });
        let prive = null; if (EXT?.planPrive) { try { prive = await EXT.planPrive({ D, readJ: readJc, S }); } catch {} }
        const reel = Number.isInteger(S?.rb?.n) && S.rb.n > 0 ? S.rb.n : 0, n = u.searchParams.get('palier'), p = n == null || n === '' ? reel : Math.max(0, Math.min(20, Math.round(+n) || 0));
        return send(res, 200, guidePalier({ G: ENG.G, S, n: p, R: f => readJc(D('resultats', f)), jeu, prive })); }
      if (u.pathname === '/api/puissance') return send(res, 200, puissanceInfo(u.searchParams.get('raretes')));
      if (u.pathname === '/api/collection') { const sv = readJ(D('data', 'sauvegarde.json')); if (!sv?.owned) return send(res, 404, { err: 'aucune sauvegarde' }); return send(res, 200, { t: sv.t || null, owned: sv.owned, lv: Object.fromEntries(Object.entries(sv.lv || {}).map(([k, v]) => [k, v?.l || 1])), stars: sv.stars || {}, team: sv.team || [], pve: sv.pve?.stars || null, tour: sv.tower?.best ?? null }); }
      if (u.pathname === '/api/campagne/prevision') return send(res, 200, prevision());
      if (u.pathname === '/api/tour/prevision') return send(res, 200, previsionTour(u.searchParams.get('niveaux')));
      if (u.pathname === '/api/plan') return send(res, 200, await planCalcule(ENG.G));
      // Repond tout de suite avec l'historique ; s'il manque un instantane, il est pris apres la reponse (le panneau redemande ensuite).
      if (u.pathname === '/api/modele') { const enCours = !MODELE.aJour(); send(res, 200, { historique: MODELE.historique(), adn: MODELE.adn(), enCours }); if (enCours) setImmediate(() => noterModele().catch(e => say('modele : ' + e.message))); return; }
      // Base commune (partage des calculs Campagne) : etat de mon ID, supprimer mes envois, changer d'ID. Les interrupteurs passent par /api/reglages.
      if (u.pathname === '/api/partage') { const reg = PARTAGE.reglagesPartage(), id = PARTAGE.identite(); let base = null, etat = null; try { [base, etat] = await Promise.all([PARTAGE.moi(reg), PARTAGE.etatBase(reg)]); } catch (e) { base = { err: e.message }; } return send(res, 200, { reglages: { utiliser: reg.utiliser, envoyer: reg.envoyer, verifier: reg.verifier, controler: reg.controler }, id: id.id.slice(0, 8), admin: !!id.admin, base, etat, enFile: PARTAGE.enFile(), serveurAttendu: VERSION_SERVEUR, cfJeton: !!(id.admin && readJ(D('data', 'partage.json'))?.cloudflare), journal: PARTAGE.journalPartage().slice(0, 12), ...(id.admin ? await infoIA() : {}) }); }
      if (u.pathname === '/api/partage/supprimer' && req.method === 'POST') { try { return send(res, 200, await PARTAGE.supprimerMesEnvois(PARTAGE.reglagesPartage())); } catch (e) { return send(res, 502, { err: e.message }); } }
      // PC validateur : publier ton IA (data/poids.json) comme IA commune de tous les calculs partages.
      if (u.pathname === '/api/partage/publier-ia' && req.method === 'POST') { if (!PARTAGE.identite().admin) return send(res, 403, { err: 'reserve au PC validateur' }); const p = readJ(D('data', 'poids.json')); if (!p?.W?.nm) return send(res, 400, { err: 'pas d IA entrainee sur ce PC' }); try { return send(res, 200, await PARTAGE.publierIA(PARTAGE.reglagesPartage(), { W: p.W, equipes: p.equipes || {}, version: p.version || '' })); } catch (e) { return send(res, 502, { err: e.message }); } }
      // PC validateur : jeton d'API Cloudflare pour « Mettre a jour le serveur » (garde dans data/partage.json, jamais renvoye).
      if (u.pathname === '/api/partage/cf-jeton' && req.method === 'POST') { if (!PARTAGE.identite().admin) return send(res, 403, { err: 'reserve au PC validateur' }); const j = String(JSON.parse(await body(req)).jeton || '').trim(); if (j && !/^[A-Za-z0-9_-]{30,200}$/.test(j)) return send(res, 400, { err: 'jeton illisible' }); const f = D('data', 'partage.json'), o = readJ(f) || {}; if (j) o.cloudflare = j; else delete o.cloudflare; writeFileSync(f, JSON.stringify(o, null, 1)); return send(res, 200, { ok: true, enregistre: !!j }); }
      if (u.pathname === '/api/partage/changer-id' && req.method === 'POST') return send(res, 200, { id: PARTAGE.changerIdentite().id.slice(0, 8) });
      if (u.pathname === '/api/raids') return send(res, 200, readJ(D('data', 'raids.json')) || []);
      if (u.pathname === '/api/carte-stats') return send(res, 200, carteStats(u.searchParams.get('id'), u.searchParams.get('trio')));
      if (u.pathname === '/api/fiche') { if (FICHE.v !== VER) FICHE = { v: VER, j: fiche(ENG.G, ENG.B) }; return send(res, 200, { version: VER, ...FICHE.j }); }
      if (u.pathname === '/api/cartes') { if (CARTES.v !== VER) { const RL = { C: 'N', U: 'R', R: 'SR', E: 'SSR', L: 'UR', M: 'LR' }; CARTES = { v: VER, c: Object.fromEntries(Object.values(ENG.G.CHAR_BY_ID).map(x => [x.id, [x.n, RL[x.r] || x.r, x.img ? (/^https:\/\//.test(x.img) ? x.img : 'https://kitsu.games/' + x.img.replace(/^\/+/, '')) : '', x.series?.name || '', x.series?.id || 0, x.pw || 0, x.atk || 0, x.def || 0, x.spd0 || 0, x.crit0 || 0]])), s: Object.fromEntries(Object.values(ENG.G.CHAR_BY_ID).filter(x => x.series?.id).map(x => [x.series.id, [x.series.name || '', /^https:\/\//.test(x.series.banner || '') ? x.series.banner : '', x.series.color || '']])) }; } return send(res, 200, CARTES, 'application/json', { 'Cache-Control': 'max-age=3600' }); }
      if (u.pathname === '/api/poids-historique') { const p = readJ(D('data', 'poids.json')); return send(res, 200, { actuel: p ? { regles: p.t || null, gains: p.gains || {}, equipes: Object.keys(p.equipes || {}).length, imitation: !!p.distillation, restaure: p.restaure || null } : null, copies: listerPoids() }); }
      if (u.pathname === '/api/poids-restaurer' && req.method === 'POST') { if (job && !job.fin) return send(res, 409, { err: 'attends la fin du calcul en cours' }); const { f } = JSON.parse(await body(req)); try { restaurerPoids(f); } catch (e) { return send(res, 400, { err: e.message }); } say('reglages de l\'IA restaures (' + f + ')'); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/patch-vu' && req.method === 'POST') { const f = D('data', 'patchs.json'), all = readJ(f) || []; all.forEach(p => p.vu = true); writeFileSync(f, JSON.stringify(all)); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/alertes-test' && req.method === 'POST') { alertes.push({ id: Date.now(), type: 'test', titre: 'Alerte de test', texte: 'Les notifications KitsuAI fonctionnent.', t: Date.now() }); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/script/code') { const f = scriptFile(); return send(res, f ? 200 : 404, f ? readFileSync(f, 'utf8') : 'introuvable', 'text/plain; charset=utf-8'); }
      if (u.pathname === '/api/ouvrir' && req.method === 'POST') { const url = JSON.parse(await body(req)).url; if (/^https:\/\/(github\.com\/Drien95\/kitsu-ai|kitsu\.games|www\.tampermonkey\.net)\b/.test(url)) exec(process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/resultat') { const f = path.basename(u.searchParams.get('f') || ''); const p = D('resultats', f); if (!existsSync(p)) return send(res, 404, { err: 'introuvable' }); return send(res, 200, readFileSync(p), /\.json$/.test(f) ? 'application/json' : 'text/plain; charset=utf-8'); }
      if (u.pathname === '/api/sauvegarde' && req.method === 'POST') { const b = await body(req); const j = JSON.parse(b); if (!j.owned || !j.lv) return send(res, 400, { err: "ce n'est pas un export KitsuAI" }); mkdirSync(D('data'), { recursive: true }); writeFileSync(D('data', 'sauvegarde.json'), b); say(`sauvegarde importee (${Object.keys(j.owned).length} cartes)`); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/dossier' && req.method === 'POST') { const d = { resultats: 'resultats', data: 'data', moteur: '.' }[JSON.parse(await body(req)).d] || '.'; const p = D(d); mkdirSync(p, { recursive: true }); exec(process.platform === 'win32' ? `explorer "${p}"` : `xdg-open "${p}"`); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/redemarrer-pool' && req.method === 'POST') { await fermerPool(); ENG = await loadEngine(); VER = ENG.version; MAN = JSON.parse(readFileSync(D('engine', VER, 'manifest.json'), 'utf8')); say(`moteur recharge : ${VER}`); return send(res, 200, { ok: true, version: VER }); }
    }
    send(res, 404, { err: 'introuvable' });
  } catch (e) { send(res, 500, { err: String(e.message || e) }); }
}).on('error', e => { // un serveur KitsuAI tourne deja sur ce port (application + KitsuAI.bat) : on s'arrete au lieu de garder ~500 Mo pour rien
  if (e.code === 'EADDRINUSE') { say(`le port ${PORT} est deja pris (KitsuAI deja lance ?) : ce serveur s'arrete.`); process.exit(0); } throw e;
}).listen(PORT, '127.0.0.1', () => {
  say(`panneau KitsuAI : http://127.0.0.1:${PORT}  (moteur ${VER}, ${NPOOL} fils pour le conseil, crees a la demande)`);
  if (process.argv.includes('--ouvrir')) exec(process.platform === 'win32' ? `start "" http://127.0.0.1:${PORT}/` : `xdg-open http://127.0.0.1:${PORT}/`);
});
