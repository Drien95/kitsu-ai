// Conseils de choix de cartes, calcules avec le moteur du jeu sur tes cartes :
//   collectifs (les 6 a cocher), plan d'XP (quelle carte monter, jusqu'ou), valeur des cartes des bannieres ouvertes,
//   duos qui marchent le mieux ensemble. Objectif : 2 etoiles minimum, puis 3, en Cauchemar Extreme.
//   node conseils.mjs [--parties collectifs,xp,tirage,duos] [--fils 10]
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { dir as D } from './lib/chemins.mjs';
import { readJ, arg, log, SAVE, POIDS, W0, WA, DERNIER, lvOf, stOf, topTeams, fightSets, shuffle, ecrire } from './lib/commun.mjs';
const { G, B, version } = await loadEngine(); const CH = G.CHAR_BY_ID, R = { M: 'LR', L: 'UR', E: 'SSR' };
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const PARTS = String(arg('parties', 'collectifs,xp,tirage,duos')).split(',');
const sets = fightSets(G, B), BENCH = [...shuffle(sets.nmMulti, 3).slice(0, 70), ...shuffle(sets.nmBoss, 4).slice(0, 50)], QUICK = BENCH.filter((_, i) => i % 3 === 0);
const nom = id => CH[id]?.n || String(id), noms = t => t.map(nom).join(' / ');
const mk = (ids, o = {}) => ids.map(id => ({ id, lv: o.lv?.[id] ?? lvOf(id), stars: o.stars?.[id] ?? stOf(id), ...((o.lk?.[id] || SAVE.lk?.[id]) ? { lk: o.lk?.[id] || SAVE.lk[id] } : {}) }));
const W = WA;
const evalTeams = async (teams, fl = BENCH, seeds = [1, 2]) => { const r = await pool.runAll(teams.flatMap(t => fl.map(f => ({ team: t, fights: [f], seeds }))), W, { stop2: true }, 12); const per = fl.length; return teams.map((_, k) => { const x = r.slice(k * per, (k + 1) * per), n = x.reduce((a, y) => a + y.n, 0); const s2 = x.reduce((a, y) => a + y.s2, 0) / n, s3 = x.reduce((a, y) => a + y.s3, 0) / n; return { s2, s3, v: s2 + 0.5 * s3 }; }); };
const pct = x => +(100 * x).toFixed(1);
const out = { version, date: new Date().toISOString(), combats: BENCH.length };
const TEAMS = topTeams(['cauchemar_multi', 'cauchemar_boss', 'cauchemar'], 3);
const own = Object.keys(SAVE.owned || {}).map(Number).filter(id => ['M', 'L', 'E'].includes(CH[id]?.r));
log(`moteur ${version}, ${pool.n} fils, ${BENCH.length} combats de reference (Cauchemar Extreme : plusieurs ennemis et boss)`);

// ---------- 1. Collectifs : les 6 a cocher quand une carte en a plus ----------
if (PARTS.includes('collectifs')) {
  out.collectifs = [];
  const comb = (arr, k) => { const r = []; const f = (s, c) => { if (c.length === k) { r.push(c); return; } for (let i = s; i < arr.length; i++) f(i + 1, [...c, arr[i]]); }; f(0, []); return r; };
  for (const t of TEAMS) {
    const plan = G.linkPlan(t, SAVE.lk || {}), act = G.activeLinks(t), lignes = [];
    for (const id of t) {
      const mine = act.filter(l => l.ids.includes(id)); if (mine.length <= G.LINK_CAP) continue;
      const keys = mine.map(l => G.linkKey(l)), defaut = (SAVE.lk?.[id]?.length ? SAVE.lk[id] : mine.slice().sort(G.linkOrder).slice(0, G.LINK_CAP).map(l => G.linkKey(l)));
      const cs = comb(keys, G.LINK_CAP).slice(0, 252);
      const q = await evalTeams(cs.map(c => mk(t, { lk: { [id]: c } })), QUICK, [1]);
      const top = cs.map((c, i) => ({ c, v: q[i].v })).sort((a, b) => b.v - a.v).slice(0, 4).map(x => x.c);
      const fin = await evalTeams([mk(t, { lk: { [id]: defaut } }), ...top.map(c => mk(t, { lk: { [id]: c } }))]);
      const best = fin.slice(1).map((r, i) => ({ c: top[i], ...r })).sort((a, b) => b.v - a.v)[0], base = fin[0];
      const label = k => { const l = mine.find(x => G.linkKey(x) === k); return `${l.name} (+${l.pct} % ${({ atk: 'ATK', def: 'DEF', hp: 'PV', crit: 'critique', spd: 'VIT' })[l.stat] || l.stat})`; };
      lignes.push({ carte: nom(id), id, actifs: mine.length, conseil: best.c.map(label), cles: best.c, retirer: keys.filter(k => !best.c.includes(k)).map(label), avant: { s2: pct(base.s2), s3: pct(base.s3) }, apres: { s2: pct(best.s2), s3: pct(best.s3) }, utile: best.v - base.v > 0.01 });
      log(`collectifs ${nom(id)} (${noms(t)}) : 2+ etoiles ${pct(base.s2)} puis ${pct(best.s2)} %`);
    }
    // Les choix ci-dessus sont faits carte par carte : on verifie qu'ensemble ils restent meilleurs.
    const ut = lignes.filter(l => l.utile); let ensemble = null;
    if (ut.length > 1) { const [b0, b1] = await evalTeams([mk(t), mk(t, { lk: Object.fromEntries(ut.map(l => [l.id, l.cles])) })]); const seul = ut.slice().sort((a, b) => (b.apres.s2 + b.apres.s3 / 2) - (a.apres.s2 + a.apres.s3 / 2))[0]; ensemble = { avant: { s2: pct(b0.s2), s3: pct(b0.s3) }, apres: { s2: pct(b1.s2), s3: pct(b1.s3) }, utile: 100 * b1.v > seul.apres.s2 + seul.apres.s3 / 2 + 1, seul: seul.carte }; log(`collectifs ensemble (${noms(t)}) : ${ensemble.avant.s2} puis ${ensemble.apres.s2} %`); }
    out.collectifs.push({ equipe: noms(t), ids: t, cartes: lignes, ensemble });
  }
}
// ---------- 2. Plan d'XP : quelle carte monter, jusqu'ou, gain par tranche de 10 000 XP ----------
// Pour chaque carte pas encore au niveau 99, on cherche le trio ou elle sert le mieux (avec tes meilleures equipes),
// puis on compare ce trio a ta meilleure equipe actuelle a plusieurs niveaux.
if (PARTS.includes('xp')) {
  const cum = l => { let c = 0; for (let k = 1; k < l; k++) c += G.XP_NEED(k) || 0; return c; };
  const ref = TEAMS[0], refR = ref ? (await evalTeams([mk(ref)]))[0] : { v: 0, s2: 0, s3: 0 };
  const cands = own.filter(id => lvOf(id) < 99).sort((a, b) => ('MLE'.indexOf(CH[a].r) - 'MLE'.indexOf(CH[b].r)) || (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def)).slice(0, 8);
  const rows = [];
  for (const id of cands) {
    const trios = []; for (const t of TEAMS) for (let k = 0; k < 3; k++) if (!t.includes(id)) { const x = t.slice(); x[k] = id; trios.push(x); }
    if (!trios.length) continue;
    const q = await evalTeams(trios.map(t => mk(t, { lv: { [id]: 99 } })), QUICK, [1]), t = trios[q.map((r, i) => [r.v, i]).sort((x, y) => y[0] - x[0])[0][1]];
    const l0 = lvOf(id), paliers = [...new Set([l0, ...[l0 + 10, l0 + 25, 60, 80, 99].filter(x => x > l0 && x <= 99)])].sort((x, y) => x - y);
    const r = await evalTeams(paliers.map(L => mk(t, { lv: { [id]: L } })));
    const pts = paliers.map((L, i) => ({ niveau: L, xp: cum(L) - cum(l0), s2: pct(r[i].s2), s3: pct(r[i].s3), v: r[i].v }));
    const best = pts.slice(1).map(p => ({ ...p, parDixMille: Math.max(0, p.v - Math.max(pts[0].v, refR.v)) * 100 / Math.max(1, p.xp / 10000) })).sort((x, y) => y.parDixMille - x.parDixMille)[0];
    const fin = pts.at(-1), depasse = fin.v > refR.v + 0.01;
    rows.push({ carte: nom(id), id, ids: t, rarete: R[CH[id].r], niveau: l0, equipe: noms(t), paliers: pts.map(({ v, ...p }) => p), depasse, conseil: depasse && best ? { jusqua: best.niveau, xp: best.xp, gainParDixMille: +best.parDixMille.toFixed(2), s2: best.s2, s3: best.s3 } : null });
    log(`xp ${nom(id)} niv ${l0} dans ${noms(t)} : ${pts.map(p => `${p.niveau}:${p.s2}%`).join(' ')} (ref ${pct(refR.s2)}%)`);
  }
  out.xp = { reference: ref ? { ids: ref, equipe: noms(ref), s2: pct(refR.s2), s3: pct(refR.s3) } : null, cartes: rows.sort((a, b) => (b.conseil?.gainParDixMille || 0) - (a.conseil?.gainParDixMille || 0) || b.paliers.at(-1).s2 - a.paliers.at(-1).s2) };
}
// ---------- 3. Valeur des cartes des bannieres ouvertes ----------
if (PARTS.includes('tirage')) {
  const now = Date.now(), bans = (G.BANNERS || []).filter(b => b.until > now && (b.opens || b.from || 0) <= now);
  const byName = n => Object.values(CH).find(c => c.n === n)?.id;
  const baseTeam = TEAMS[0], base = baseTeam ? (await evalTeams([mk(baseTeam)]))[0] : { v: 0, s2: 0, s3: 0 };
  const top8 = [...new Set(TEAMS.flat())].concat(own.sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def))).filter((x, i, a) => a.indexOf(x) === i).slice(0, 8);
  const pairs = []; for (let a = 0; a < top8.length; a++) for (let b = a + 1; b < top8.length; b++) pairs.push([top8[a], top8[b]]);
  out.tirage = [];
  for (const b of bans) {
    const cartes = [...(b.pool?.M || []).map(n => [n, 'LR']), ...(b.pool?.L || []).map(n => [n, 'UR'])].map(([n, r]) => ({ id: byName(n), n, r })).filter(x => x.id);
    const lignes = [];
    for (const c of cartes) {
      const deja = !!SAVE.owned?.[c.id];
      const cand = deja ? [] : pairs.map(p => [c.id, ...p]);
      let best = null;
      if (deja) { const t = TEAMS.find(t => t.includes(c.id)); if (t) { const r = (await evalTeams([mk(t, { stars: { [c.id]: stOf(c.id) + 1 } })]))[0]; best = { t, ...r }; } }
      else { const q = await evalTeams(cand.map(t => mk(t, { lv: { [c.id]: 99 } })), QUICK, [1]); const k = q.map((r, i) => ({ i, v: r.v })).sort((a, b2) => b2.v - a.v)[0]; const t = cand[k.i]; const r = (await evalTeams([mk(t, { lv: { [c.id]: 99 } })]))[0]; best = { t, ...r }; }
      lignes.push({ carte: c.n, id: c.id, ids: best ? best.t : null, rarete: c.r, possedee: deja, equipe: best ? noms(best.t) : null, s2: best ? pct(best.s2) : null, s3: best ? pct(best.s3) : null, gain: best ? +(100 * (best.v - base.v)).toFixed(1) : null });
    }
    lignes.sort((a, b2) => (b2.gain ?? -99) - (a.gain ?? -99));
    const lr = lignes.filter(x => x.rarete === 'LR' && x.gain != null);
    out.tirage.push({ banniere: b.series, fin: b.until, cartes: lignes, gainMoyenLR: lr.length ? +(lr.reduce((a, x) => a + Math.max(0, x.gain), 0) / lr.length).toFixed(1) : null, reference: { ids: baseTeam || null, equipe: baseTeam ? noms(baseTeam) : null, s2: pct(base.s2), s3: pct(base.s3) } });
    log(`banniere ${b.series} : meilleure carte ${lignes[0]?.carte} (+${lignes[0]?.gain}), gain moyen d'une LR ${out.tirage.at(-1).gainMoyenLR}`);
  }
}
// ---------- 4. Duos ----------
if (PARTS.includes('duos')) {
  const m = DERNIER?.modes?.actuel || {}, freq = {};
  for (const c of Object.values(m)) for (const x of c.top || []) for (const id of x.ids) freq[id] = (freq[id] || 0) + 1;
  const pick = [...new Set([...Object.keys(freq).map(Number).sort((a, b) => freq[b] - freq[a]), ...own.sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def))])].filter(id => SAVE.owned?.[id] || !SAVE.owned).slice(0, 14);
  const tr = []; for (let a = 0; a < pick.length; a++) for (let b = a + 1; b < pick.length; b++) for (let c = b + 1; c < pick.length; c++) tr.push([pick[a], pick[b], pick[c]]);
  const r = await evalTeams(tr.map(t => mk(t)), QUICK, [1]);
  const sc = tr.map((t, i) => ({ t, v: r[i].v })), moy = sc.reduce((a, x) => a + x.v, 0) / sc.length, pairs = {};
  for (const x of sc) for (const [a, b] of [[x.t[0], x.t[1]], [x.t[0], x.t[2]], [x.t[1], x.t[2]]]) { const k = a + '-' + b; (pairs[k] ||= { a, b, vs: [] }).vs.push(x.v); }
  const solo = {}; for (const id of pick) { const v = sc.filter(x => x.t.includes(id)).map(x => x.v); solo[id] = v.reduce((a, b) => a + b, 0) / v.length; }
  out.duos = Object.values(pairs).map(p => { const s = p.vs.sort((a, b) => b - a), meilleur = s[0], m2 = s.reduce((a, b) => a + b, 0) / s.length; return { duo: `${nom(p.a)} + ${nom(p.b)}`, ids: [p.a, p.b], moyenne: pct(m2 / 1.5), meilleur: pct(meilleur / 1.5), synergie: +(100 * (m2 - (solo[p.a] + solo[p.b]) / 2) / 1.5).toFixed(1), troisieme: nom(sc.filter(x => x.t.includes(p.a) && x.t.includes(p.b)).sort((a, b) => b.v - a.v)[0].t.find(id => id !== p.a && id !== p.b)), troisiemeId: sc.filter(x => x.t.includes(p.a) && x.t.includes(p.b)).sort((a, b) => b.v - a.v)[0].t.find(id => id !== p.a && id !== p.b) }; }).sort((a, b) => b.synergie - a.synergie).slice(0, 15);
  log(`duos : ${tr.length} trios de ${pick.length} cartes, meilleure synergie ${out.duos[0]?.duo} (+${out.duos[0]?.synergie})`);
}
let ancien = {}; try { ancien = readJ(D('resultats', 'conseils-ia.json')) || {}; } catch {}
ecrire('conseils-ia.json', { ...ancien, ...out });
log('termine, resultats dans resultats/conseils-ia.json'); await pool.close(); process.exit(0);
