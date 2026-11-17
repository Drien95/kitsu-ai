// Fiche des regles du jeu (page « Regles et effets » du panneau) : lue dans le moteur du jeu A CHAQUE VERSION, rien n'est recopie
// dans le depot. Statuts (parametres et multiplicateurs par defaut), passifs, constantes de combat, types, collectifs, series.
// Les explications en francais sont dans le panneau (cles = identifiants des statuts) ; un statut nouveau apparait avec ses seuls
// parametres, marque « nouveau ».
const MULS = ['atkMul', 'defMul', 'spdMul', 'takenMul', 'dealtMul', 'healMul'];

export function fiche(G, B) {
  const statuts = Object.entries(B.STATUS || {}).map(([id, s]) => {
    const mul = {};
    for (const m of MULS) if (typeof s[m] === 'function') { try { const v = s[m](undefined, { stacks: 1 }); if (Number.isFinite(v)) mul[m] = +v.toFixed(3); } catch { /* multiplicateur sans valeur par defaut */ } }
    return { id, nom: s.name || id, kanji: s.k || '', couleur: s.c || '', malus: !!s.malus, dot: s.dot ?? null, saute: !!s.skip, reveilParCoup: !!s.wakeOnHit,
      sansEnergie: !!s.noEnergy, sansUltime: !!s.noUlt, nonPurgeable: !!s.noPurge, nonDissipable: !!s.noDispel, cumulable: !!s.stack, valeurReglable: !!s.pct, mul };
  });
  const passifs = Object.entries(G.PASSIVES || {}).map(([k, p]) => ({ id: k, nom: p.name || k, desc: p.desc || '', fx: p.fx || null }));
  const series = new Map(); for (const l of G.LINKS || []) series.set(l.series, (series.get(l.series) || 0) + 1);
  const avantage = {}; for (const a of B.TYPES || []) avantage[a] = (B.TYPES || []).filter(b => B.advantage(a, b) > 0);
  return {
    statuts, passifs,
    types: (B.TYPES || []).map(t => ({ id: t, nom: B.TYPE_INFO?.[t]?.name || t, couleur: B.TYPE_INFO?.[t]?.color || '', bat: avantage[t] })),
    combat: { avBase: B.AV_BASE, cout: B.COST, enduranceMax: B.MAX_END, enduranceParTour: B.END_REGEN, energieMax: B.MAX_EN, reposEndurance: B.REST_GAIN, provocationRecharge: B.TAUNT_CD, rageCauchemar: B.NM_RAGE },
    progression: { niveauMax: G.LV_MAX, etoilesMax: G.STAR_MAX, collectifsMax: G.LINK_CAP, synergieSerie: G.SERIES_SYN, synergieMax: G.SERIES_SYN_MAX },
    rarete: Object.entries(G.RINFO || {}).map(([k, r]) => ({ code: k, nom: r.name, couleur: r.color, etoiles: r.stars })),
    tour: G.TOWER || null,
    collectifs: { total: (G.LINKS || []).length, parSerie: [...series].sort((a, b) => b[1] - a[1]).map(([s, n]) => ({ serie: s, n })) },
    operations: Object.keys(B.OPS || {}),
  };
}
