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
  let plan = null; try { if (campagne || tour) { const p = planXp({ G, S, campagne: campagne ? c3 : null, tour: tour ? tw : null, raid: null, conseils, jeu, prive: n === reel ? prive : null }); plan = p?.err ? null : { score: p.score, cartes: (p.cartes || []).slice(0, 6) }; } } catch {}
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
  const manque = [...(campagne ? [] : ['campagne']), ...(tour ? [] : ['tour']), ...(souvenirs || n === 0 ? [] : ['souvenirs'])];
  return { palier: n, reel, plafond: L.plafond, paliers: PALIERS, compositions: compositions(G, L), trios: { autorises: cpt.ok, total: cpt.total, cartes: ids.length },
    campagne, tour, plan, souvenirs, suivant, transcendance: { niveauCompte: S?.acct?.lv ?? null, gemmesRendues: refund, eveil: S?.eveil || null, regles }, manque };
}
