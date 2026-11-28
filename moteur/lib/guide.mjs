// 5.63 : guide d'un palier de Transcendance (V2), a partir des resultats deja calcules, sans simulation.
// Pour le palier n : equipes possibles (regle du jeu), trios autorises parmi tes cartes, Campagne (cauchemar3 du palier),
// Tour (tour du palier), plan d'XP sur ces resultats, Souvenirs (conseils-ia.json, partie souvenirs), et comparaison avec le
// palier suivant quand ses calculs existent. Un chiffre absent = calcul pas encore fait : le guide dit lequel lancer.
import { limitePuissance, fichierDuPalier, PALIERS } from './puissance.mjs';
import { plan as planXp } from './plan.mjs';

// Classes de cartes du jeu (cout en points) : SSR, UR, LR, MR, et leurs versions X, avec une carte representative chacune.
function classesDuJeu(G) {
  const m = new Map();
  for (const c of Object.values(G.CHAR_BY_ID || {})) {
    if (!['M', 'L', 'E'].includes(c.r)) continue;
    const nom = c.appearanceRarity === 'MR' ? 'MR' : c.appearanceRarity === 'LR-X' ? 'LR-X' : ({ M: 'LR', L: 'UR', E: 'SSR' })[c.r] + (c.awakenX ? '-X' : '');
    const r = m.get(nom) || []; if (r.length < 3) r.push(c.id); m.set(nom, r);
  }
  return m;
}
// Toutes les compositions de 3 classes, leur cout et leur verdict au plafond du palier.
export function compositions(G, L) {
  const m = classesDuJeu(G), ks = [...m.keys()], out = [];
  for (let i = 0; i < ks.length; i++) for (let j = i; j < ks.length; j++) for (let k = j; k < ks.length; k++) {
    const vus = new Map(), ids = [ks[i], ks[j], ks[k]].map(x => { const v = vus.get(x) || 0; vus.set(x, v + 1); return m.get(x)[v]; });
    if (ids.some(x => x === undefined)) continue;
    const cout = G.teamPowerSum(ids); out.push({ cartes: [ks[k], ks[j], ks[i]], cout, ok: cout <= L.plafond });
  }
  return out.sort((a, b) => b.cout - a.cout);
}
const campagneDe = c3 => {
  const e = c3?.etages; if (!e) return null;
  return { date: c3.date, niveaux: c3.niveaux, trios: c3.trios, triosTotal: c3.puissance?.triosTotal ?? null,
    difficultes: (e.resume || []).map(r => ({ difficulte: r.difficulte, surs: r.troisEtoilesSur, combats: r.combats })),
    plan: (e.plan || []).slice(0, 6).map(p => ({ ids: e.trios?.[p.trio] || null, combats: Array.isArray(p.combats) ? p.combats.length : p.combats })).filter(x => x.ids) };
};
const tourDe = t => t ? { date: t.date, niveaux: t.niveaux, trios: t.triosEssayes, triosTotal: t.puissance?.triosTotal ?? null, meilleur: t.trios?.[0] ? { ids: t.trios[0].ids, etageMoyen: t.trios[0].etageMoyen, min: t.min ?? t.trios[0].min, max: t.trios[0].max } : null, murs: (t.murs || []).slice(0, 3) } : null;
const somme = c => c ? c.difficultes.reduce((a, d) => a + d.surs, 0) : null;

// R(fichier) -> resultat lu (ou null). S : sauvegarde. Le palier reel est celui de la sauvegarde.
export function guidePalier({ G, S, n, R, jeu = null, prive = null }) {
  if (!G?.teamPowerSum) return { err: 'moteur du jeu sans limite de puissance (avant la V2)' };
  const L = limitePuissance(G, S, { transcendance: n, sansLimite: false }), reel = L.reel;
  const ids = Object.keys(S?.owned || {}).map(Number).filter(id => ['M', 'L', 'E'].includes(G.CHAR_BY_ID[id]?.r)), cpt = L.compter(ids);
  const F = (base, p) => fichierDuPalier(base, p, reel);
  const c3 = R(F('cauchemar3', n)), tw = R(F('tour', n)), conseils = R('conseils-ia.json');
  // Un fichier d'un autre palier n'est pris que s'il a bien ete calcule a ce palier (sinon : ancien calcul d'avant la V2).
  const bon = x => !!x?.puissance && x.puissance.transcendances === n;
  const campagne = bon(c3) ? campagneDe(c3) : null, tour = bon(tw) ? tourDe(tw) : null;
  let plan = null; try { if (campagne || tour) { const p = planXp({ G, S, campagne: campagne ? c3 : null, tour: tour ? tw : null, raid: null, conseils, jeu, prive: n === reel ? prive : null }); plan = p?.err ? null : { score: p.score, multXp: 1 + 0.5 * n, cartes: (p.cartes || []).slice(0, 6).map(c => ({ ...c, xpCombat: Number.isFinite(c.xp) ? Math.round(c.xp / (1 + 0.5 * n)) : null })) }; } } catch {}
  // Palier suivant : ce qu'il rapporte, s'il est calcule. Souvenirs : mesures au palier n, ou au suivant (ils s'ouvrent apres la Transcendance).
  const suiv = PALIERS.find(x => x > n) ?? null; let suivant = null;
  const sv = conseils?.souvenirs, souvenirs = sv && (sv.palier === n || sv.palier === suiv) ? sv : null;
  if (suiv != null) {
    const L2 = limitePuissance(G, S, { transcendance: suiv, sansLimite: false }), c3b = R(F('cauchemar3', suiv)), twb = R(F('tour', suiv));
    const cb = c3b?.puissance?.transcendances === suiv ? campagneDe(c3b) : null, tb = twb?.puissance?.transcendances === suiv ? tourDe(twb) : null;
    suivant = { palier: suiv, plafond: L2.plafond, trios: L2.compter(ids).ok, campagne: cb ? { surs: somme(cb), plus: campagne ? somme(cb) - somme(campagne) : null } : null,
      tour: tb?.meilleur ? { etage: tb.meilleur.etageMoyen, plus: tour?.meilleur ? +(tb.meilleur.etageMoyen - tour.meilleur.etageMoyen).toFixed(1) : null } : null };
  }
  const rb = S?.rb || {}, refund = Number.isFinite(+S?.kiSpent) ? Math.max(0, Math.floor(0.25 * (+S.kiSpent - (+rb.spent || 0)))) : null;
  // Regles de la Transcendance lues dans le moteur V2 (rebirth) : niveau de compte 100, Ki en reserve perdus (ki = min(ki, 0) +
  // remboursement), etoiles de Campagne et record de Tour remis a zero, cartes gardees : MR et LR-X d'office, 5 au choix + 1 UR/SSR.
  const CH = G.CHAR_BY_ID || {}, office = ids.filter(id => CH[id]?.appearanceRarity === 'MR' || CH[id]?.appearanceRarity === 'LR-X' || (CH[id]?.r === 'M' && CH[id]?.awakenX));
  const xpCompte = t => { let a = 0; for (let lv = 1; lv < 100; lv++) a += Math.round(Math.min(2000, 150 + 75 * (lv - 1)) * Math.min(3, 1 + 0.5 * t)); return a; };
  const ki = Number.isFinite(+S?.ki) ? +S.ki : null, apres = n + 1;
  const regles = { niveauRequis: 100, kiReserve: ki, kiPerdus: ki == null ? null : Math.max(0, ki), gardeesOffice: office.length, auChoix: 6, perdues: Math.max(0, ids.length - office.length - 6),
    xpCartes: { avant: 1 + 0.5 * n, apres: 1 + 0.5 * apres }, xpCompte100: xpCompte(apres), energie: 5, remiseAZero: ['étoiles de Campagne', 'record de Tour', 'quêtes (sauf pass)'] };
  // 5.65 : rush niveau 100 (regles du moteur : acctNeed, XP des combats et de la Tour, energie +1 / 10 min). Calcul, pas une mesure.
  const besoin = (lv, t) => Math.round(Math.min(2000, 150 + 75 * (lv - 1)) * Math.min(3, 1 + 0.5 * t));
  const lvC = +S?.acct?.lv || null, xpC = +S?.acct?.xp || 0;
  const restant = lvC == null ? null : lvC >= 100 ? 0 : Math.max(0, Array.from({ length: 100 - lvC }, (_, i) => besoin(lvC + i, reel)).reduce((a, b) => a + b, 0) - xpC);
  const etage = tour?.meilleur?.etageMoyen ?? (+S?.tower?.best || null), xpTour = etage ? Math.round(6 * etage + 24 * Math.floor(etage / 10)) : null;
  const sources = [{ source: 'Cauchemar gagné', xp: 35, energie: 1 }, { source: 'Campagne gagnée', xp: 30, energie: 1 }, ...(xpTour ? [{ source: `Montée de Tour jusqu'à l'étage ${Math.floor(etage)}`, xp: xpTour, energie: 4 }] : [])]
    .map(x => ({ ...x, parEnergie: +(x.xp / x.energie).toFixed(1) })).sort((a, b) => b.parEnergie - a.parEnergie);
  const meilleure = sources[0], parJour = 144; // +1 energie toutes les 10 min
  const jours = xp => xp == null || !meilleure ? null : +(xp / (meilleure.parEnergie * parJour)).toFixed(1);
  const rush = { niveau: lvC, restant, joursRestant: jours(restant), apresTranscendance: Array.from({ length: 99 }, (_, i) => besoin(i + 1, reel + 1)).reduce((a, b) => a + b, 0), sources, energieParJour: parJour,
    boutique: { energie: 25, ki: 30, xp: meilleure ? Math.round(25 * meilleure.parEnergie) : null }, quetes: 'quêtes du jour : 25 XP chacune, +60 quand toutes sont faites' };
  rush.joursApres = jours(rush.apresTranscendance);
  // 5.65 : quoi booster. Eveil de carte (apres une Transcendance, 7 etoiles et niveau 99), cout en essences (130 par semaine au plus).
  const COUT = { MR: 300, 'LR-X': 100, LR: 100, 'UR-X': 60, UR: 60, 'SSR-X': 40, SSR: 40 };
  const classe = c => c?.appearanceRarity === 'MR' ? 'MR' : c?.appearanceRarity === 'LR-X' ? 'LR-X' : ({ M: 'LR', L: 'UR', E: 'SSR' })[c?.r] + (c?.awakenX ? '-X' : '');
  const evs = new Set((S?.eveil?.cartes || []).map(Number)), vus = new Map();
  const ajoute = (l, raison) => { for (const id of l || []) { if (!S?.owned?.[id]) continue; const v = vus.get(+id) || { id: +id, raisons: new Set(), n: 0 }; v.n++; v.raisons.add(raison); vus.set(+id, v); } };
  for (const x of campagne?.plan || []) ajoute(x.ids, 'Campagne'); if (tour?.meilleur?.ids) ajoute(tour.meilleur.ids, 'Tour'); for (const x of plan?.cartes || []) ajoute(x.ids, 'plan d’XP');
  const boost = [...vus.values()].map(v => { const c = CH[v.id], cl = classe(c), st = +S?.stars?.[v.id] || 0, lv = +S?.lv?.[v.id]?.l || 1, ev = evs.has(v.id);
    const manque = [...(st < 7 ? [`${7 - st} étoile${7 - st > 1 ? 's' : ''} (doublons)`] : []), ...(lv < 99 ? [`niveau ${lv} sur 99`] : [])];
    return { id: v.id, carte: c?.n || String(v.id), classe: cl, etoiles: st, niveau: lv, eveillee: ev, essences: COUT[cl] ?? null, pret: !ev && !manque.length, manque, dans: [...v.raisons], poids: v.n }; })
    .filter(x => !x.eveillee).sort((a, b) => (b.pret - a.pret) || (b.poids - a.poids) || (a.manque.length - b.manque.length)).slice(0, 12);
  const boostInfo = { cartes: boost, essencesParSemaine: 130, debloque: n > 0, regle: 'Éveil : 7 étoiles et niveau 99, après une Transcendance. Une carte normale passe en X (ATK et DEF x1,2, étoiles remises à 0, une LR devient LR-X avec un 2e passif) ; édition, raid ou MR : +10 % et niveau 100.' };
  const manque = [...(campagne ? [] : ['campagne']), ...(tour ? [] : ['tour']), ...(souvenirs || n === 0 ? [] : ['souvenirs'])];
  return { palier: n, reel, plafond: L.plafond, paliers: PALIERS, compositions: compositions(G, L), trios: { autorises: cpt.ok, total: cpt.total, cartes: ids.length },
    campagne, tour, plan, souvenirs, suivant, rush, boost: boostInfo, transcendance: { niveauCompte: S?.acct?.lv ?? null, gemmesRendues: refund, eveil: S?.eveil || null, regles }, manque };
}
