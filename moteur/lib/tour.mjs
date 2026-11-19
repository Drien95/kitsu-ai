// Tour de l'infini : recherche du meilleur trio POUR la Tour, etages ou les montees s'arretent, collectifs.
// Regles lues dans le code du jeu : ennemis fixes par etage, PV reportes (+12 %, +30 % apres un boss),
// 1 a 3 cartes choisies au depart, une defaite termine la montee.
// Utilise par tour.mjs (analyse detaillee) et tout.mjs (categorie « tour » de l'analyse complete).
import { h53 as h53j } from './journal.mjs';
const MAXFL = 400;
const range = (n, from = 1) => Array.from({ length: n }, (_, i) => from + i);
export const statsEtages = fl => {
  const s = fl.slice().sort((a, b) => a - b), moy = s.reduce((a, b) => a + b, 0) / s.length;
  const se = Math.sqrt(s.reduce((a, b) => a + (b - moy) ** 2, 0) / Math.max(1, s.length - 1) / s.length);
  return { moy, se, min: s[0], p10: s[Math.floor(s.length * 0.1)], med: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
};
const comb = (arr, k) => { const r = []; const f = (s, c) => { if (c.length === k) { r.push(c); return; } for (let i = s; i < arr.length; i++) f(i + 1, [...c, arr[i]]); }; f(0, []); return r; };
// Cle d'une carte dans le journal de la Tour (tour.mjs et la prevision du serveur doivent donner la meme).
export const cleCarteTour = (c, sigCarte) => `${c.id}:${c.lv}:${c.stars}:${(c.lk || []).join('+')}:${sigCarte(c.id)}`;
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
  // Course avec elimination sur TOUS les trios (comme la Campagne) : a chaque manche, chaque trio encore en course fait une montee
  // (meme graine pour tous). Un trio est abandonne quand sa borne haute passe sous la borne basse du Ke meilleur.
  // Ecart type d'une montee pris au moins egal a SD0 etages (prudent avec peu de montees). Journal : montee deja faite = reprise.
  // ctx : { trios, cle(t) -> cle du trio, J (journal), garder, z, manches, onManche(log) }
  async function course({ trios: tr, cle, J, arret = async () => {}, garder = 200, z = 3, manches = 10, sd0 = 4, largeur = 1500, onManche = () => {} }) {
    const T = tr.length, n = new Uint16Array(T), s1 = new Float64Array(T), s2 = new Float64Array(T);
    let alive = [...Array(T).keys()], montees = 0, repris = 0; const entonnoir = [], t0 = Date.now();
    const borne = t => { const m = s1[t] / n[t], v = n[t] > 1 ? Math.max(0, (s2[t] - n[t] * m * m) / (n[t] - 1)) : 0; const se = Math.sqrt(Math.max(v, sd0 * sd0) / n[t]); return { m, lo: m - z * se, hi: m + z * se }; };
    for (let r = 1; r <= manches; r++) {
      // 5.42.1 : journal lu sans garder une liste d'objets ; les montees a simuler sont jouees par lots de 20 000 trios.
      const todo = new Int32Array(alive.length); let nt = 0;
      for (const t of alive) { const v = J.get(h53j(cle(t) + '|' + r)); if (v != null) { const f = +v; n[t]++; s1[t] += f; s2[t] += f * f; repris++; } else todo[nt++] = t; }
      // 5.42.1 : le travail reel de la manche (montees a simuler, reprises du journal) avant de la lancer.
      onManche({ debut: true, r, manches, aFaire: nt, reprises: alive.length - nt, montees });
      for (let a = 0; a < nt; a += 20000) {
        const part = todo.subarray(a, Math.min(nt, a + 20000)), res = await climb(Array.from(part, t => mk(tr[t])), [r], 16);
        part.forEach((t, j) => { const f = res[j][0]; n[t]++; s1[t] += f; s2[t] += f * f; J.set(h53j(cle(t) + '|' + r), String(f)); montees++; });
        J.flush(); await arret(); onManche({ r, manches, fait: Math.min(nt, a + 20000), total: nt, montees, vitesse: montees / Math.max(1, (Date.now() - t0) / 1000) });
      }
      const avant = alive.length;
      if (alive.length > garder) { const lo = new Float64Array(alive.length), hi = new Float64Array(alive.length); alive.forEach((t, j) => { const x = borne(t); lo[j] = x.lo; hi[j] = x.hi; }); const bar = lo.slice().sort()[alive.length - garder]; alive = alive.filter((t, j) => hi[j] >= bar); } // 5.42.1 : sans un objet par trio
      entonnoir.push(alive.length);
      // 5.45 : top 10 provisoire (etage moyen des trios encore en course), pour le suivi en direct du panneau. Un seul passage.
      const top = []; for (const t of alive) { const m = s1[t] / n[t]; if (top.length < 10 || m > top[top.length - 1].m) { top.push({ t, m }); top.sort((a, b) => b.m - a.m); if (top.length > 10) top.pop(); } }
      onManche({ r, manches, avant, apres: alive.length, montees, repris, vitesse: montees / Math.max(1, (Date.now() - t0) / 1000), fin: true, top: top.map(x => ({ ids: tr[x.t], v: x.m })) });
    }
    const classement = alive.map(t => ({ t: tr[t], moy: s1[t] / n[t], n: n[t] })).sort((a, b) => b.moy - a.moy);
    // Ecartes les mieux places (souvent une seule montee) : prefiltre du departage exact, qui juge autrement que la regle apprise.
    const enCourse = new Set(alive), ecartes = [];
    for (let t = 0; t < tr.length; t++) if (n[t] && !enCourse.has(t)) ecartes.push(t);
    ecartes.sort((a, b) => s1[b] / n[b] - s1[a] / n[a]);
    const ecartesTop = ecartes.slice(0, largeur).map(t => ({ t: tr[t], moy: s1[t] / n[t], n: n[t] }));
    return { classement, ecartes: ecartesTop, entonnoir, montees, repris, duree: Math.round((Date.now() - t0) / 1000) };
  }
  return { climb, trios, murs, collectifs, course };
}
