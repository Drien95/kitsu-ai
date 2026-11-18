// Pourquoi la 3e etoile saute (5.26) : sur les combats sous le seuil du calcul Campagne, on rejoue les meilleurs trios
// sans arret anticipe et on note ce qui fait perdre la 3e etoile (regle du jeu : aucun K.O. ET cycle <= 8).
//   cycle   : victoire sans K.O., mais apres le cycle 8 (il faut frapper plus fort ou plus tot) ;
//   ko      : victoire avant la fin du cycle 8, mais au moins un allie K.O. (il faut proteger ou soigner) ;
//   les2    : victoire apres le cycle 8 ET avec un K.O. ;
//   defaite : combat perdu.
// Calcul leger, dans un seul fil : quelques trios x 8 tirages par combat dur (de l'ordre de la minute).
export const CAUSES = ['cycle', 'ko', 'les2', 'defaite'];

// Un combat joue jusqu'au bout. pv9 : part des PV ennemis encore debout au moment ou le cycle 9 commence
// (ce qu'il aurait fallu faire tomber en plus) ; premierKO : carte et cycle du premier allie K.O.
export function jouer(G, B, SIM, pol, fid, team, seed) {
  const st = G.setupBattle(G.EVENT_FIGHTS?.[fid] || G.findFight(fid), team, seed).st;
  const pvEnnemis = () => { let a = 0, b = 0; for (const e of B.enemies(st)) { b += e.maxHp || 0; a += e.alive ? Math.max(0, e.hp) : 0; } return b ? a / b : 0; };
  let pv9 = null, premierKO = null;
  const voirKO = () => { if (premierKO) return; const d = B.allies(st).find(x => !x.alive); if (d) premierKO = { id: d.id, cycle: st.cycle }; };
  for (let i = 0; i < 400; i++) {
    const u = SIM.step(st); voirKO();
    if (pv9 == null && st.cycle > 8) pv9 = pvEnnemis();
    if (!u) break;
    SIM.doAct(st, u, pol(st, u)); voirKO();
  }
  const win = B.outcome(st) === 'win';
  let ko = 0; for (const x of B.allies(st)) if (!x.alive) ko++;
  const tard = st.cycle > 8, stars = win ? Math.min(tard ? 2 : 3, Math.max(1, 3 - ko)) : 0;
  const cause = stars === 3 ? null : !win ? 'defaite' : ko && tard ? 'les2' : ko ? 'ko' : 'cycle';
  return { win, ko, cycle: st.cycle, stars, cause, pv9: pv9 == null ? null : +pv9.toFixed(3), premierKO };
}

const mediane = L => { if (!L.length) return null; const a = L.slice().sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

// Un combat, plusieurs trios : resume par combat (cause dominante sur le meilleur trio essaye).
export function diagnostiquerCombat(G, B, SIM, pol, fid, equipes, seeds) {
  const parTrio = equipes.map(({ ids, team }) => {
    const R = seeds.map(s => jouer(G, B, SIM, pol, fid, team, s));
    const n = { trois: 0, cycle: 0, ko: 0, les2: 0, defaite: 0 }; for (const r of R) n[r.cause || 'trois']++;
    const kos = new Map(); for (const r of R) if (r.premierKO) kos.set(r.premierKO.id, (kos.get(r.premierKO.id) || 0) + 1);
    const victimes = [...kos].sort((a, b) => b[1] - a[1]);
    return { ids, n, essais: R.length, cycleMed: mediane(R.filter(r => r.win).map(r => r.cycle)),
      pv9: mediane(R.filter(r => r.pv9 != null && r.cause && r.cause !== 'ko').map(r => r.pv9)),
      koCycle: mediane(R.filter(r => r.premierKO).map(r => r.premierKO.cycle)), victime: victimes[0] ? victimes[0][0] : null };
  });
  // Trio de reference : le plus de 3 etoiles, puis le plus de victoires, puis le moins de defaites.
  const ref = parTrio.slice().sort((a, b) => b.n.trois - a.n.trois || (b.essais - b.n.defaite) - (a.essais - a.n.defaite))[0];
  const rates = CAUSES.map(c => [c, ref.n[c]]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  return { cause: rates[0] ? rates[0][0] : null, ref, trios: parTrio };
}

// Tous les combats sous le seuil d'un resultat cauchemar3.json (etages). equipeDe(ids) -> equipe du calcul.
// Trios essayes sur chaque combat : son meilleur trio, le trio du plan, ses 2 premiers « autres » et le meilleur trio global
// de sa difficulte (pour les combats sans aucun 3 etoiles). maxTrios par combat, `tirages` tirages chacun.
export function diagnostiquer(G, B, SIM, pol, c3, equipeDe, { tirages = 8, maxTrios = 3, log = () => {} } = {}) {
  const e = c3?.etages; if (!e?.combats?.length) return null;
  const OBJ = { normal: 'Normal', difficile: 'Difficile', extreme: 'Extreme', campNormal: 'CampNormal', campDifficile: 'CampDifficile', campExtreme: 'CampExtreme' };
  const diffs = c3.difficultes || [], seuil = e.seuil ?? 60, seeds = Array.from({ length: tirages }, (_, i) => 1 + i);
  const durs = e.combats.filter(c => c[3] < seuil), T0 = Date.now(), combats = [];
  log(`diagnostic : ${durs.length} combats sous ${seuil} % de 3 etoiles, ${maxTrios} trios x ${tirages} tirages au plus`);
  for (const c of durs) {
    const d = diffs[c[1]], vus = new Set(), L = [];
    const add = ids => { if (!ids || ids.length !== 3) return; const k = ids.slice().sort((a, b) => a - b).join('-'); if (vus.has(k) || L.length >= maxTrios) return; vus.add(k); L.push(ids); };
    if (c[2] >= 0) add(e.trios[c[2]]); if (c[4] >= 0) add(e.trios[c[4]]);
    for (const [ti] of c[9] || []) add(e.trios[ti]);
    for (const x of c3.meilleurs?.[OBJ[d]] || []) add(x.ids);
    if (!L.length) continue;
    let r; try { r = diagnostiquerCombat(G, B, SIM, pol, c[0], L.map(ids => ({ ids, team: equipeDe(ids) })), seeds); } catch (err) { log(`  ${c[0]} : ignore (${err.message})`); continue; }
    combats.push([c[0], c[1], r.cause, r.ref.ids, r.ref.n.trois, r.ref.essais, r.ref.n.cycle, r.ref.n.ko, r.ref.n.les2, r.ref.n.defaite, r.ref.cycleMed, r.ref.pv9, r.ref.koCycle, r.ref.victime]);
    if (combats.length % 10 === 0) log(`  diagnostic : ${combats.length} / ${durs.length} combats`);
  }
  const resume = diffs.map((d, di) => { const L = combats.filter(x => x[1] === di), o = { difficulte: d, combats: L.length }; for (const k of CAUSES) o[k] = L.filter(x => x[2] === k).length; o.aucune = L.filter(x => !x[2]).length;
    const p = L.filter(x => x[2] === 'cycle' && x[11] != null).map(x => x[11]); o.pv9Med = p.length ? +mediane(p).toFixed(3) : null; return o; });
  const kos = new Map(); for (const x of combats) if (x[13] != null && (x[2] === 'ko' || x[2] === 'les2')) kos.set(x[13], (kos.get(x[13]) || 0) + 1);
  return { date: new Date().toISOString(), duree: Math.round((Date.now() - T0) / 1000), tirages, maxTrios, seuil, resume,
    victimes: [...kos].sort((a, b) => b[1] - a[1]).slice(0, 6),
    colonnes: ['combat', 'difficulte', 'cause', 'trio', 'trois', 'essais', 'cycle', 'ko', 'les2', 'defaite', 'cycleMedian', 'pvEnnemisAuCycle9', 'cyclePremierKO', 'premiereVictime'],
    combats };
}
