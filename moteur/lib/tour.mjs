// Tour de l'infini : recherche du meilleur trio POUR la Tour, etages ou les montees s'arretent, collectifs.
// Regles lues dans le code du jeu : ennemis fixes par etage, PV reportes (+12 %, +30 % apres un boss),
// 1 a 3 cartes choisies au depart, une defaite termine la montee.
// Utilise par tour.mjs (analyse detaillee) et tout.mjs (categorie « tour » de l'analyse complete).
const MAXFL = 400;
const range = (n, from = 1) => Array.from({ length: n }, (_, i) => from + i);
export const statsEtages = fl => {
  const s = fl.slice().sort((a, b) => a - b), moy = s.reduce((a, b) => a + b, 0) / s.length;
  const se = Math.sqrt(s.reduce((a, b) => a + (b - moy) ** 2, 0) / Math.max(1, s.length - 1) / s.length);
  return { moy, se, min: s[0], p10: s[Math.floor(s.length * 0.1)], med: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
};
const comb = (arr, k) => { const r = []; const f = (s, c) => { if (c.length === k) { r.push(c); return; } for (let i = s; i < arr.length; i++) f(i + 1, [...c, arr[i]]); }; f(0, []); return r; };
const memeTrio = (a, b) => a.slice().sort().join() === b.slice().sort().join();

// ctx : { G, B, pool, W, ids (cartes candidates), mk(ids, lk) -> equipe, actuelle (trio joue), log }
export function makeTour({ G, B, pool, W, ids, mk, actuelle = [], log = () => {} }) {
  const climb = async (teams, seeds, size = 4) => (await pool.runAll(teams.map(team => ({ type: 'tower', team, seeds, maxFl: MAXFL })), W, {}, size)).map(r => r.fl);

  // 1. chaque carte seule (la Tour accepte 1 carte), 2. tous les trios des meilleures, 3. les 20 meilleurs sur beaucoup de tirages.
  async function trios({ cartes = 26, tirages = 30, garder = 20 } = {}) {
    const solo = await climb(ids.map(id => mk([id])), range(2), 16);
    const bySolo = ids.map((id, i) => ({ id, etage: (solo[i][0] + solo[i][1]) / 2 })).sort((a, b) => b.etage - a.etage);
    const pick = [...new Set([...bySolo.slice(0, cartes).map(x => x.id), ...actuelle.filter(id => ids.includes(id))])];
    const tr = []; for (let a = 0; a < pick.length; a++) for (let b = a + 1; b < pick.length; b++) for (let c = b + 1; c < pick.length; c++) tr.push([pick[a], pick[b], pick[c]]);
    const r1 = await climb(tr.map(t => mk(t)), range(2));
    const top = tr.map((t, i) => ({ t, v: r1[i][0] + r1[i][1] })).sort((a, b) => b.v - a.v).slice(0, garder).map(x => x.t);
    if (actuelle.length && !top.some(t => memeTrio(t, actuelle))) top.push(actuelle);
    log(`Tour : ${tr.length} trios essayes, ${top.length} gardes pour ${tirages} tirages`);
    const r2 = await climb(top.map(t => mk(t)), range(tirages, 101), 1);
    const fin = top.map((t, i) => ({ t, fl: r2[i], ...statsEtages(r2[i]) })).sort((a, b) => b.moy - a.moy);
    return { solo: bySolo, essais: tr.length, fin, actuelle: actuelle.length ? fin.find(x => memeTrio(x.t, actuelle)) || null : null };
  }

  // Etages ou les montees du trio s'arretent, et les ennemis qui y sont (toujours les memes pour un etage).
  function murs(best, n = 6) {
    const m = new Map(); for (const f of best.fl) m.set(f + 1, (m.get(f + 1) || 0) + 1);
    const enFace = fl => { try { const { st } = G.setupTower(fl, mk(best.t), 1); return B.enemies(st).map(e => e.name + (e.boss ? ' (boss)' : '')); } catch { return []; } };
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([etage, k]) => ({ etage, part: Math.round(100 * k / best.fl.length), boss: !!G.isBossFloor?.(etage), ennemis: enFace(etage) }));
  }

  // Collectifs du trio : pour chaque carte qui a plus de G.LINK_CAP collectifs possibles, carte par carte.
  async function collectifs(t, { tirages = 30 } = {}) {
    const act = G.activeLinks(t), choix = {}, lignes = [];
    for (const id of t) {
      const mine = act.filter(l => l.ids.includes(id)); if (mine.length <= G.LINK_CAP) continue;
      const cs = comb(mine.map(l => G.linkKey(l)), G.LINK_CAP).slice(0, 252);
      const q = await climb(cs.map(c => mk(t, { ...choix, [id]: c })), range(4, 501));
      const cand = cs.map((c, i) => ({ c, v: q[i].reduce((a, b) => a + b, 0) })).sort((a, b) => b.v - a.v).slice(0, 4).map(x => x.c);
      const r = await climb([mk(t, choix), ...cand.map(c => mk(t, { ...choix, [id]: c }))], range(tirages, 101), 1);
      const base = statsEtages(r[0]), alt = cand.map((c, i) => ({ c, ...statsEtages(r[i + 1]) })).sort((a, b) => b.moy - a.moy)[0];
      const utile = alt.moy - base.moy > 2 * Math.hypot(alt.se, base.se);
      const label = k => { const l = mine.find(x => G.linkKey(x) === k); return `${l.name} (+${l.pct} % ${({ atk: 'ATK', def: 'DEF', hp: 'PV', crit: 'critique', spd: 'VIT' })[l.stat] || l.stat})`; };
      if (utile) choix[id] = alt.c;
      lignes.push({ id, possibles: mine.length, conseil: alt.c.map(label), cles: alt.c, avant: +base.moy.toFixed(1), apres: +alt.moy.toFixed(1), utile });
    }
    return lignes;
  }
  return { climb, trios, murs, collectifs };
}
