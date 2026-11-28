// Plan d'XP et de banniere unique (5.21) : quelle carte monter au niveau 99, et quelle banniere vaut tes gemmes,
// en pesant TOUS les modes selon l'objectif « modele parfait » : 3 etoiles partout en Campagne Cauchemar N/D/E,
// etage max en Tour, Arene a 100 %, Raid en bonus.
// Aucun combat simule ici : tout vient des resultats deja calcules (cauchemar3.json, tour.json, raid.json, conseils-ia.json)
// et, si le script prive est installe, de sa part (Tour exacte, Arene). Quelques millisecondes.
//
// Chaque mode donne un « % du parfait » :
//   Campagne : combats Cauchemar N/D/E surs a 3 etoiles (seuil du calcul) avec des trios dont les 3 cartes sont deja au 99 ;
//   Tour, Raid (et Arene en prive) : score du meilleur trio deja tout au 99, divise par le meilleur trio possible de ta collection.
// Score = moyenne ponderee (Campagne 1, Tour 1, Arene 1, Raid 1/2) des modes disponibles.
// Une « montee » = une carte (ou les 2-3 cartes qui ne servent qu'ensemble) a mettre au 99 ; points gagnes / XP = classement.

import { limitePuissance } from './puissance.mjs';
export const POIDS = { campagne: 1, tour: 1, arene: 1, raid: 0.5 };
const CAUCHEMAR = ['normal', 'difficile', 'extreme'];

const r1 = x => Math.round(10 * x) / 10;
const cle = ids => [...ids].sort((a, b) => a - b).join('-');

// Mode a partir d'une liste de trios notes ({ ids, v }), v plus grand = mieux.
export function modeTrios({ cle: k, nom, unite, source = 'public', trios, niveaux = '99', poids }, C) {
  const ok = (trios || []).filter(t => t.ids?.length === 3 && t.ids.every(C.possede) && C.accepte(t.ids) && Number.isFinite(t.v));
  if (!ok.length) return null;
  const max = Math.max(...ok.map(t => t.v));
  const tous99 = niveaux !== '99'; // calcul fait a tes niveaux : pas de gain de niveau a lire
  const dispo = M => ok.filter(t => t.ids.every(id => tous99 || C.au99(id) || M.has(id)));
  const meilleur = M => dispo(M).sort((a, b) => b.v - a.v)[0] || null;
  const b0 = meilleur(new Set()), now = b0 ? b0.v : 0;
  return {
    cle: k, nom, unite, source, poids: poids ?? POIDS[k] ?? 1, max: r1(max), now: r1(now), pct: max > 0 ? r1(100 * now / max) : 0,
    trio: b0?.ids || null,
    manques: tous99 ? [] : ok.map(t => t.ids.filter(id => !C.au99(id))).filter(m => m.length),
    gain(M) { const b = meilleur(M); const v = b ? Math.max(0, b.v - now) : 0; return { v: r1(v), pct: max > 0 ? 100 * v / max : 0, trio: v > 0 ? b.ids : null }; },
  };
}

// Campagne Cauchemar N/D/E : combat par combat (etages de cauchemar3.json).
export function modeCampagne(c3, C) {
  const e = c3?.etages; if (!e?.combats?.length) return null;
  const seuil = e.seuil ?? 60, tous99 = c3.niveaux !== '99';
  const diffs = (e.resume || []).map(r => r.difficulte);
  const viseDi = new Set(diffs.map((d, i) => CAUCHEMAR.includes(d) ? i : -1).filter(i => i >= 0));
  // Trios essayes sur chaque combat : colonne « autres » (5.21) ; avant, seulement le meilleur et celui du plan (approximatif).
  const iA = (e.colonnes || []).indexOf('autres'), approx = iA < 0;
  // Ancien format : le trio du script (tes 10 cartes les plus fortes, deja au 99 en general) sert de base « deja sur ».
  const iS = (e.colonnes || []).indexOf('script3e');
  const L = e.combats.filter(c => viseDi.has(c[1])).map(c => ({ di: c[1], base: approx && iS >= 0 && c[iS] >= seuil, l: (approx ? [[c[2], c[3]], [c[4], c[5]]] : c[iA] || []).filter(([t, p]) => t >= 0 && p >= seuil).map(([t]) => e.trios[t]).filter(t => t?.every(C.possede) && C.accepte(t)) }));
  if (!L.length) return null;
  const surAvec = M => L.map(f => f.base || f.l.some(t => t.every(id => tous99 || C.au99(id) || M.has(id))));
  const s0 = surAvec(new Set()), n0 = s0.filter(Boolean).length, total = L.length;
  const parDiff = M => { const s = surAvec(M); return CAUCHEMAR.map(d => { const di = diffs.indexOf(d); const idx = L.map((f, i) => f.di === di ? i : -1).filter(i => i >= 0); return { d, sur: idx.filter(i => s[i]).length, total: idx.length }; }); };
  const manques = []; if (!tous99) for (const f of L) for (const t of f.l) { const m = t.filter(id => !C.au99(id)); if (m.length) manques.push(m); }
  return {
    cle: 'campagne', nom: 'Campagne Cauchemar 3★', unite: 'combats', source: 'public', poids: POIDS.campagne, approx,
    max: total, now: n0, pct: r1(100 * n0 / total), detail: parDiff(new Set()), manques,
    gain(M) {
      const s = surAvec(M); let d = 0; for (let i = 0; i < s.length; i++) if (s[i] && !s0[i]) d++;
      if (!d) return { v: 0, pct: 0, trio: null };
      const avant = parDiff(new Set()), apres = parDiff(M);
      return { v: d, pct: 100 * d / total, trio: null, parDiff: apres.map((x, i) => ({ d: x.d, plus: x.sur - avant[i].sur })).filter(x => x.plus > 0) };
    },
  };
}

// Combats Campagne gagnes par difficulte en ajoutant `ids` a l'ensemble B (deja fait avant).
const diffPlus = (m, B, ids) => { const avant = new Set([...B].filter(id => !ids.includes(id))), a = m.gain(avant).parDiff || [], b = m.gain(B).parDiff || [];
  return b.map(x => ({ d: x.d, plus: x.plus - (a.find(y => y.d === x.d)?.plus || 0) })).filter(x => x.plus > 0); };

// Contexte : ta sauvegarde (cartes possedees, niveaux) et la courbe d'XP du jeu.
export function contexte(G, S) {
  const need = k => { try { const x = G?.XP_NEED?.(k); if (Number.isFinite(x)) return x; } catch {} return Math.floor(30 * k ** 1.35); };
  const lv = id => S?.lv?.[id]?.l || 1;
  const C = {
    possede: id => !!S?.owned?.[id], lv, au99: id => lv(id) >= 99,
    // 5.62 : trio accepte par la limite de puissance de la V2 (tes Transcendances) ; un calcul d'avant la V2 peut en proposer d'autres.
    accepte: (() => { try { const L = G ? limitePuissance(G, S, { transcendance: null }) : null; return L ? L.ok : () => true; } catch { return () => true; } })(),
    nom: id => G?.CHAR_BY_ID?.[id]?.n || String(id), rarete: id => ({ M: 'LR', L: 'UR', E: 'SSR', R: 'SR', U: 'R', C: 'N' })[G?.CHAR_BY_ID?.[id]?.r] || '',
    xpNeuve: 0,
    xp99: id => { let x = 0; for (let k = lv(id); k < 99; k++) x += need(k); return Math.max(0, x - (S?.lv?.[id]?.xp || 0)); },
  };
  C.xpNeuve = C.xp99(-1); // carte neuve : niveau 1 vers 99
  return C;
}

// Plan complet. prive (facultatif, fourni par le script prive installe) : { modes: [...], bannieres: { serie: [{ id, arene }] }, guetter: [...] }.
// Un mode prive de meme cle remplace le mode public (ex. Tour exacte a la place de tour.json).
export function plan({ G, S, campagne, tour, raid, conseils, jeu, prive }) {
  const C = contexte(G, S), modes = {};
  const mc = modeCampagne(campagne, C); if (mc) modes.campagne = mc;
  const mt = tour && modeTrios({ cle: 'tour', nom: 'Tour', unite: 'étages', niveaux: tour.niveaux, trios: (tour.classement?.length ? tour.classement : tour.trios || []).map(t => ({ ids: t.ids, v: t.etageMoyen })) }, C); if (mt) modes.tour = mt;
  const mr = raid && modeTrios({ cle: 'raid', nom: 'Raid', unite: '%', niveaux: raid.niveaux, trios: [...(raid.classement || []), ...(raid.premierTour || [])].map(t => ({ ids: t.ids, v: t.note })) }, C); if (mr) modes.raid = mr;
  for (const m of prive?.modes || []) { const x = m.gain ? m : modeTrios(m, C); if (x) modes[x.cle] = x; }
  const L = Object.values(modes), W = L.reduce((a, m) => a + m.poids, 0) || 1;
  const score = r1(L.reduce((a, m) => a + m.poids * m.pct, 0) / W);

  // Montees candidates : cartes qui manquent au 99 dans un trio utile, groupees comme elles servent.
  // Classement glouton : la meilleure montee (points / XP), puis les suivantes en supposant les precedentes faites
  // (une paire ne recompte pas le gain d'une carte deja proposee seule).
  const sets = new Map(); for (const m of L) for (const x of m.manques || []) if (x.length <= 3) sets.set(cle(x), x);
  const cands = [...sets.values()], B = new Set(), base = {};
  for (const m of L) base[m.cle] = { v: 0, pct: 0 };
  const cartes = [];
  while (cartes.length < 8) {
    let best = null;
    for (const ids0 of cands) {
      const ids = ids0.filter(id => !B.has(id)); if (!ids.length) continue;
      const M = new Set([...B, ...ids]), gains = {}; let pts = 0;
      for (const m of L) { const g = m.gain(M), d = g.v - base[m.cle].v; if (d > 0.05) { gains[m.cle] = { v: r1(d), unite: m.unite, trio: g.trio, parDiff: g.parDiff, source: m.source, _g: g }; pts += m.poids * (g.pct - base[m.cle].pct) / W; } }
      const xp = ids.reduce((a, id) => a + C.xp99(id), 0), parCent = xp ? pts / (xp / 1e5) : 0;
      if (pts >= 0.05 && (!best || parCent > best.parCent + 1e-9 || (Math.abs(parCent - best.parCent) <= 1e-9 && ids.length < best.ids.length))) best = { ids, xp, gains, points: pts, parCent };
    }
    if (!best) break;
    for (const id of best.ids) B.add(id);
    for (const [k, g] of Object.entries(best.gains)) { base[k] = { v: g._g.v, pct: g._g.pct }; delete g._g; }
    // Detail Campagne par difficulte : ce que cette montee ajoute en plus des precedentes.
    if (best.gains.campagne) best.gains.campagne.parDiff = diffPlus(modes.campagne, B, best.ids);
    cartes.push({ ids: best.ids, noms: best.ids.map(C.nom), raretes: best.ids.map(C.rarete), niveaux: best.ids.map(C.lv), xp: best.xp, gains: best.gains, points: r1(best.points), parCent: +best.parCent.toFixed(2) });
  }

  const raison = c => Object.entries(c.gains).map(([k, g]) => `${modes[k].nom.split(' ')[0]} +${String(g.v).replace('.', ',')} ${g.unite}`).join(', ');
  const n1 = cartes[0], idC = n1 ? n1.ids.slice().sort((a, b) => C.lv(a) - C.lv(b))[0] : null;
  const cible = n1 ? { id: idC, nom: C.nom(idC), niveau: C.lv(idC), xp: n1.xp, avec: n1.ids.filter(id => id !== idC).map(C.nom), raison: raison(n1) + ' au niveau 99' } : null;

  // Bannieres ouvertes (envoyees par le script) : valeur de leurs cartes pour tes modes.
  const now = Date.now(), tir = new Map((conseils?.tirage || []).map(b => [b.banniere, b]));
  const bannieres = (jeu?.bannieres || []).filter(b => !b.fin || b.fin > now).map(b => {
    const t = tir.get(b.serie), pv = prive?.bannieres?.[b.serie] || [], ids = new Set([...(t?.cartes || []).map(c => c.id), ...pv.map(c => c.id)]);
    const cs = [...ids].filter(Boolean).map(id => { const c = t?.cartes?.find(x => x.id === id), p = pv.find(x => x.id === id);
      return { id, nom: C.nom(id), rarete: C.rarete(id) || c?.rarete || '', possedee: C.possede(id), campagne: c?.gain ?? null, arene: p?.arene ?? null, tour: p?.tour ?? null }; });
    const utile = cs.filter(c => (c.campagne ?? 0) > 0.5 || (c.arene ?? 0) > 0.5 || (c.tour ?? 0) > 0.5);
    cs.sort((a, b) => Math.max(b.campagne ?? -99, b.arene ?? -99, b.tour ?? -99) - Math.max(a.campagne ?? -99, a.arene ?? -99, a.tour ?? -99));
    return { serie: b.serie, fin: b.fin || null, pity: b.pity || null, cartes: cs.slice(0, 6), calcule: !!t || pv.length > 0, verdict: !t && !pv.length ? 'inconnu' : utile.length ? 'tirer' : 'garder', utiles: utile.map(c => c.nom), xpDerriere: utile.filter(c => !c.possedee).length ? C.xpNeuve : 0 };
  });

  return {
    t: now, score, poids: Object.fromEntries(L.map(m => [m.cle, m.poids])),
    modes: L.map(({ gain, manques, ...m }) => m), cartes, cible, bannieres, guetter: prive?.guetter || [],
    manque: ['campagne', 'tour', 'raid'].filter(k => !modes[k]),
  };
}
