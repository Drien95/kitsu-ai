// Conseils de choix de cartes, calcules avec le moteur du jeu sur tes cartes :
//   collectifs (les 6 a cocher), plan d'XP (quelle carte monter, jusqu'ou), valeur des cartes des bannieres ouvertes,
//   duos qui marchent le mieux ensemble. Objectif : 3 etoiles (note = 3 etoiles + 2 etoiles / 4), en Cauchemar Extreme.
//   marche : lots du marche qui valent une offre d'echange, offres recues a accepter ou non.
//   node conseils.mjs [--parties collectifs,xp,tirage,duos,marche] [--fils 10]
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { dir as D } from './lib/chemins.mjs';
import { readJ, arg, log, SAVE, POIDS, W0, WA, DERNIER, lvOf, stOf, topTeams, fightSets, shuffle, ecrire } from './lib/commun.mjs';
import { limitePuissance, decrireLimite, eveilDe } from './lib/puissance.mjs';
const { G, B, version } = await loadEngine(); const CH = G.CHAR_BY_ID, R = { M: 'LR', L: 'UR', E: 'SSR' };
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const PARTS = String(arg('parties', 'collectifs,xp,tirage,duos,marche')).split(',');
const sets = fightSets(G, B), BENCH = [...shuffle(sets.nmMulti, 3).slice(0, 70), ...shuffle(sets.nmBoss, 4).slice(0, 50)], QUICK = BENCH.filter((_, i) => i % 3 === 0);
const nom = id => CH[id]?.n || String(id), noms = t => t.map(nom).join(' / ');
// 5.62 : limite de puissance (V2) sur tous les trios essayes, Eveil (aw / awakened) sur chaque carte.
const LIM = limitePuissance(G, SAVE), EV = eveilDe(SAVE, G, LIM), okT = t => LIM.ok(t);
const mk = (ids, o = {}) => ids.map(id => ({ id, lv: o.lv?.[id] ?? lvOf(id), stars: o.stars?.[id] ?? stOf(id), ...((o.lk?.[id] || SAVE.lk?.[id]) ? { lk: o.lk?.[id] || SAVE.lk[id] } : {}), ...EV.champs(id) }));
const W = WA;
const evalTeams = async (teams, fl = BENCH, seeds = [1, 2]) => { const r = await pool.runAll(teams.flatMap(t => fl.map(f => ({ team: t, fights: [f], seeds }))), W, { stop2: true }, 12); const per = fl.length; return teams.map((_, k) => { const x = r.slice(k * per, (k + 1) * per), n = x.reduce((a, y) => a + y.n, 0); const s2 = x.reduce((a, y) => a + y.s2, 0) / n, s3 = x.reduce((a, y) => a + y.s3, 0) / n; return { s2, s3, v: s3 + 0.25 * s2 }; }); };
const pct = x => +(100 * x).toFixed(1);
const out = { version, date: new Date().toISOString(), combats: BENCH.length, puissance: LIM.actif ? { plafond: LIM.plafond, transcendances: LIM.rb } : null };
const TEAMS = topTeams(['cauchemar_multi', 'cauchemar_boss', 'cauchemar'], 3).filter(okT);
log(decrireLimite(LIM));
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
    if (ut.length > 1) { const [b0, b1] = await evalTeams([mk(t), mk(t, { lk: Object.fromEntries(ut.map(l => [l.id, l.cles])) })]); const seul = ut.slice().sort((a, b) => (b.apres.s3 + b.apres.s2 / 4) - (a.apres.s3 + a.apres.s2 / 4))[0]; ensemble = { avant: { s2: pct(b0.s2), s3: pct(b0.s3) }, apres: { s2: pct(b1.s2), s3: pct(b1.s3) }, utile: 100 * b1.v > seul.apres.s3 + seul.apres.s2 / 4 + 1, seul: seul.carte }; log(`collectifs ensemble (${noms(t)}) : ${ensemble.avant.s2} puis ${ensemble.apres.s2} %`); }
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
  // Cout en combats (estimation) : XP du combat le plus payant des combats de reference, gagne a 3 etoiles
  // (recompense = fightXp x (0,6 + 0,2 x etoiles) x multiplicateur de difficulte, ce dernier n'est pas expose : compte 1).
  const xpCombat = Math.max(1, ...BENCH.map(f => { try { return (G.fightXp?.(G.findFight(f)) || 0) * 1.2; } catch { return 0; } }));
  const combatsPour = xp => Math.ceil(xp / xpCombat);
  const rows = [];
  for (const id of cands) {
    const trios = []; for (const t of TEAMS) for (let k = 0; k < 3; k++) if (!t.includes(id)) { const x = t.slice(); x[k] = id; if (okT(x)) trios.push(x); }
    if (!trios.length) continue;
    const q = await evalTeams(trios.map(t => mk(t, { lv: { [id]: 99 } })), QUICK, [1]), t = trios[q.map((r, i) => [r.v, i]).sort((x, y) => y[0] - x[0])[0][1]];
    const l0 = lvOf(id), paliers = [...new Set([l0, ...[l0 + 10, l0 + 25, 60, 80, 99].filter(x => x > l0 && x <= 99)])].sort((x, y) => x - y);
    const r = await evalTeams(paliers.map(L => mk(t, { lv: { [id]: L } })));
    const pts = paliers.map((L, i) => ({ niveau: L, xp: cum(L) - cum(l0), s2: pct(r[i].s2), s3: pct(r[i].s3), v: r[i].v }));
    const best = pts.slice(1).map(p => ({ ...p, parDixMille: Math.max(0, p.v - Math.max(pts[0].v, refR.v)) * 100 / Math.max(1, p.xp / 10000) })).sort((x, y) => y.parDixMille - x.parDixMille)[0];
    const fin = pts.at(-1), depasse = fin.v > refR.v + 0.01;
    rows.push({ carte: nom(id), id, ids: t, rarete: R[CH[id].r], niveau: l0, equipe: noms(t), paliers: pts.map(({ v, ...p }) => ({ ...p, combats: combatsPour(p.xp) })), depasse, conseil: depasse && best ? { jusqua: best.niveau, xp: best.xp, combats: combatsPour(best.xp), gainParDixMille: +best.parDixMille.toFixed(2), s2: best.s2, s3: best.s3 } : null });
    log(`xp ${nom(id)} niv ${l0} dans ${noms(t)} : ${pts.map(p => `${p.niveau}:${p.s2}%`).join(' ')} (ref ${pct(refR.s2)}%)`);
  }
  out.xp = { xpParCombat: Math.round(xpCombat), reference: ref ? { ids: ref, equipe: noms(ref), s2: pct(refR.s2), s3: pct(refR.s3) } : null, cartes: rows.sort((a, b) => (b.conseil?.gainParDixMille || 0) - (a.conseil?.gainParDixMille || 0) || b.paliers.at(-1).s3 - a.paliers.at(-1).s3) };
}
// ---------- 3. Valeur des cartes des bannieres ouvertes ----------
if (PARTS.includes('tirage')) {
  const now = Date.now(), bans = (G.BANNERS || []).filter(b => b.until > now && (b.opens || b.from || 0) <= now);
  const byName = n => Object.values(CH).find(c => c.n === n)?.id;
  const baseTeam = TEAMS[0], base = baseTeam ? (await evalTeams([mk(baseTeam)]))[0] : { v: 0, s2: 0, s3: 0 };
  const top8 = [...new Set(TEAMS.flat())].concat(own.sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def))).filter((x, i, a) => a.indexOf(x) === i).slice(0, 8)
  // 5.62 : avec la limite de puissance, une LR ne va plus avec deux LR : on ajoute tes 4 meilleures UR / SSR pour les paires.
  if (LIM.actif) top8.push(...own.filter(id => CH[id].r !== 'M' && !top8.includes(id)).sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def)).slice(0, 4));
  const pairs = []; for (let a = 0; a < top8.length; a++) for (let b = a + 1; b < top8.length; b++) pairs.push([top8[a], top8[b]]);
  out.tirage = [];
  for (const b of bans) {
    const cartes = [...(b.pool?.M || []).map(n => [n, 'LR']), ...(b.pool?.L || []).map(n => [n, 'UR'])].map(([n, r]) => ({ id: byName(n), n, r })).filter(x => x.id);
    const lignes = [];
    for (const c of cartes) {
      const deja = !!SAVE.owned?.[c.id];
      const cand = deja ? [] : pairs.map(p => [c.id, ...p]).filter(okT);
      let best = null;
      if (deja) { const t = TEAMS.find(t => t.includes(c.id)); if (t) { const r = (await evalTeams([mk(t, { stars: { [c.id]: stOf(c.id) + 1 } })]))[0]; best = { t, ...r }; } }
      else if (cand.length) { const q = await evalTeams(cand.map(t => mk(t, { lv: { [c.id]: 99 } })), QUICK, [1]); const k = q.map((r, i) => ({ i, v: r.v })).sort((a, b2) => b2.v - a.v)[0]; const t = cand[k.i]; const r = (await evalTeams([mk(t, { lv: { [c.id]: 99 } })]))[0]; best = { t, ...r }; }
      lignes.push({ carte: c.n, id: c.id, ids: best ? best.t : null, rarete: c.r, possedee: deja, equipe: best ? noms(best.t) : null, s2: best ? pct(best.s2) : null, s3: best ? pct(best.s3) : null, gain: best ? +(100 * (best.v - base.v)).toFixed(1) : null });
    }
    lignes.sort((a, b2) => (b2.gain ?? -99) - (a.gain ?? -99));
    const lr = lignes.filter(x => x.rarete === 'LR' && x.gain != null);
    out.tirage.push({ banniere: b.series, fin: b.until, cartes: lignes, gainMoyenLR: lr.length ? +(lr.reduce((a, x) => a + Math.max(0, x.gain), 0) / lr.length).toFixed(1) : null, reference: { ids: baseTeam || null, equipe: baseTeam ? noms(baseTeam) : null, s2: pct(base.s2), s3: pct(base.s3) } });
    log(`banniere ${b.series} : meilleure carte ${lignes[0]?.carte} (+${lignes[0]?.gain}), gain moyen d'une LR ${out.tirage.at(-1).gainMoyenLR}`);
  }
}
// ---------- 5. Marche (echanges carte contre carte) : lots qui valent une offre, offres recues ----------
// Valeur d'une carte pour toi : gain de ton meilleur trio quand elle y entre (a son niveau), sur les combats de reference.
if (PARTS.includes('marche') && SAVE.market) {
  const baseTeam = TEAMS[0], base = baseTeam ? (await evalTeams([mk(baseTeam)]))[0] : { v: 0, s2: 0, s3: 0 };
  const top8 = [...new Set(TEAMS.flat())].concat(own.slice().sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def))).filter((x, i, a) => a.indexOf(x) === i).slice(0, 8)
  // 5.62 : avec la limite de puissance, une LR ne va plus avec deux LR : on ajoute tes 4 meilleures UR / SSR pour les paires.
  if (LIM.actif) top8.push(...own.filter(id => CH[id].r !== 'M' && !top8.includes(id)).sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def)).slice(0, 4));
  const pairs = []; for (let a = 0; a < top8.length; a++) for (let b = a + 1; b < top8.length; b++) pairs.push([top8[a], top8[b]]);
  const memo = new Map();
  const valeur = async (id, lv) => {
    const k = id + ':' + lv; if (memo.has(k)) return memo.get(k);
    const cand = pairs.filter(p => !p.includes(id)).map(p => [id, ...p]).filter(okT), o = { lv: { [id]: lv }, stars: { [id]: 0 } };
    if (!cand.length) { const v = { ids: null, gain: null, s2: null, horsLimite: true }; memo.set(k, v); return v; }
    const q = await evalTeams(cand.map(t => mk(t, o)), QUICK, [1]), i = q.map((r, j) => [r.v, j]).sort((x, y) => y[0] - x[0])[0][1];
    const r = (await evalTeams([mk(cand[i], o)]))[0], v = { ids: cand[i], gain: +(100 * (r.v - base.v)).toFixed(1), s2: pct(r.s2) }; memo.set(k, v); return v;
  };
  const utiles = new Set(TEAMS.flat()), M = SAVE.market;
  const vus = new Map(); for (const l of M.lots || []) { const c = CH[l.card]; if (!c || !['M', 'L', 'E'].includes(c.r) || SAVE.owned?.[l.card]) continue; const lv = l.lv || 1; if (!vus.has(l.card) || vus.get(l.card) < lv) vus.set(l.card, lv); }
  const cand = [...vus.keys()].sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def)).slice(0, 25);
  const lots = []; for (const id of cand) { const v = await valeur(id, vus.get(id)); lots.push({ carte: nom(id), id, rarete: R[CH[id].r], niveau: vus.get(id), ...v }); }
  lots.sort((a, b) => b.gain - a.gain);
  // A proposer en echange : tes cartes de meme rarete qui ne sont dans aucune de tes meilleures equipes.
  const aDonner = r => own.filter(id => CH[id].r === r && !utiles.has(id)).sort((a, b) => (CH[a].atk + CH[a].def) - (CH[b].atk + CH[b].def)).slice(0, 3).map(nom);
  const offres = [];
  for (const lot of M.mine || []) for (const f of lot.offers || []) {
    if (!CH[f.card]) continue; const v = await valeur(f.card, f.lv || 1), garde = utiles.has(lot.card);
    offres.push({ donnes: nom(lot.card), donnesId: lot.card, recois: nom(f.card), recoisId: f.card, niveau: f.lv || 1, gain: v.gain, ids: v.ids, verdict: garde ? 'refuser : ta carte est dans une de tes meilleures equipes' : v.gain > 0.5 ? 'accepter' : 'sans interet pour tes equipes' });
  }
  out.marche = { reference: { ids: baseTeam || null, equipe: baseTeam ? noms(baseTeam) : null, s2: pct(base.s2) }, lots: lots.map(l => ({ ...l, proposer: aDonner(CH[l.id].r) })), offres, total: (M.lots || []).length };
  log(`marche : ${(M.lots || []).length} lots, ${lots.length} cartes evaluees, meilleure ${lots[0]?.carte} (${lots[0]?.gain > 0 ? "+" : ""}${lots[0]?.gain}), ${offres.length} offre(s) recue(s)`);
}
// ---------- 4. Duos ----------
if (PARTS.includes('duos')) {
  const m = DERNIER?.modes?.actuel || {}, freq = {};
  for (const c of Object.values(m)) for (const x of c.top || []) for (const id of x.ids) freq[id] = (freq[id] || 0) + 1;
  const pick = [...new Set([...Object.keys(freq).map(Number).sort((a, b) => freq[b] - freq[a]), ...own.sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def))])].filter(id => SAVE.owned?.[id] || !SAVE.owned).slice(0, 14);
  const tr = []; for (let a = 0; a < pick.length; a++) for (let b = a + 1; b < pick.length; b++) for (let c = b + 1; c < pick.length; c++) if (okT([pick[a], pick[b], pick[c]])) tr.push([pick[a], pick[b], pick[c]]);
  const r = await evalTeams(tr.map(t => mk(t)), QUICK, [1]);
  const sc = tr.map((t, i) => ({ t, v: r[i].v })), moy = sc.reduce((a, x) => a + x.v, 0) / sc.length, pairs = {};
  for (const x of sc) for (const [a, b] of [[x.t[0], x.t[1]], [x.t[0], x.t[2]], [x.t[1], x.t[2]]]) { const k = a + '-' + b; (pairs[k] ||= { a, b, vs: [] }).vs.push(x.v); }
  const solo = {}; for (const id of pick) { const v = sc.filter(x => x.t.includes(id)).map(x => x.v); solo[id] = v.reduce((a, b) => a + b, 0) / v.length; }
  out.duos = Object.values(pairs).map(p => { const s = p.vs.sort((a, b) => b - a), meilleur = s[0], m2 = s.reduce((a, b) => a + b, 0) / s.length; return { duo: `${nom(p.a)} + ${nom(p.b)}`, ids: [p.a, p.b], moyenne: pct(m2 / 1.5), meilleur: pct(meilleur / 1.5), synergie: +(100 * (m2 - (solo[p.a] + solo[p.b]) / 2) / 1.5).toFixed(1), troisieme: nom(sc.filter(x => x.t.includes(p.a) && x.t.includes(p.b)).sort((a, b) => b.v - a.v)[0].t.find(id => id !== p.a && id !== p.b)), troisiemeId: sc.filter(x => x.t.includes(p.a) && x.t.includes(p.b)).sort((a, b) => b.v - a.v)[0].t.find(id => id !== p.a && id !== p.b) }; }).sort((a, b) => b.synergie - a.synergie).slice(0, 15);
  log(`duos : ${tr.length} trios de ${pick.length} cartes, meilleure synergie ${out.duos[0]?.duo} (+${out.duos[0]?.synergie})`);
}
// ---------- 5. Souvenirs (5.63) ----------
// Apres une Transcendance, 7 jours de bannieres Souvenirs (G.MEMORY_BANNERS). Regle du jeu : la MR sort a 0,01 % par carte
// (MEMORY_MR_RATE est en pourcent), une LR, UR ou SSR sur deux vient du pool de la banniere, pity 50 (+1 par x10, x10 = 50 Ki)
// donne une LR du pool, jamais la MR. Les bannieres sont donc classees par la meilleure LR du pool, la MR est montree a part.
// Chaque carte des bannieres (MR, LR, UR) est mesuree comme pour les bannieres ouvertes : meilleur trio avec elle au niveau 99
// (ou une etoile de plus si tu l'as deja), sous le plafond du palier vise (--transcendance, 1 par defaut depuis le panneau).
if (PARTS.includes('souvenirs')) {
  const MB = Array.isArray(G.MEMORY_BANNERS) ? G.MEMORY_BANNERS : [];
  const byName = n => Object.values(CH).find(c => c.n === n)?.id;
  const baseTeam = TEAMS[0], base = baseTeam ? (await evalTeams([mk(baseTeam)]))[0] : { v: 0, s2: 0, s3: 0 };
  const top8 = [...new Set(TEAMS.flat())].concat(own.slice().sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def))).filter((x, i, a) => a.indexOf(x) === i).slice(0, 8);
  if (LIM.actif) top8.push(...own.filter(id => CH[id].r !== 'M' && !top8.includes(id)).sort((a, b) => (CH[b].atk + CH[b].def) - (CH[a].atk + CH[a].def)).slice(0, 4));
  const pairs = []; for (let a = 0; a < top8.length; a++) for (let b = a + 1; b < top8.length; b++) pairs.push([top8[a], top8[b]]);
  const rar = c => c.appearanceRarity === 'MR' ? 'MR' : c.appearanceRarity === 'LR-X' ? 'LR-X' : R[c.r] || c.r;
  const bannieres = [];
  for (const b of MB) {
    const noms0 = [...new Set([...(b.pool?.MR || []), ...(b.pool?.M || []), ...(b.pool?.L || [])])];
    const cartes = noms0.map(n => ({ n, id: byName(n) })).filter(x => x.id && CH[x.id]);
    const lignes = [];
    for (const c of cartes) {
      const deja = !!SAVE.owned?.[c.id]; let best = null;
      if (deja) { const t = TEAMS.find(t => t.includes(c.id)); if (t) { const r = (await evalTeams([mk(t, { stars: { [c.id]: stOf(c.id) + 1 } })]))[0]; best = { t, ...r }; } }
      else { const cand = pairs.filter(p => !p.includes(c.id)).map(p => [c.id, ...p]).filter(okT); if (cand.length) { const q = await evalTeams(cand.map(t => mk(t, { lv: { [c.id]: 99 } })), QUICK, [1]); const k = q.map((r, i) => ({ i, v: r.v })).sort((x, y) => y.v - x.v)[0]; const t = cand[k.i]; const r = (await evalTeams([mk(t, { lv: { [c.id]: 99 } })]))[0]; best = { t, ...r }; } }
      lignes.push({ carte: c.n, id: c.id, rarete: rar(CH[c.id]), cout: LIM.actif ? LIM.cout([c.id]) : null, possedee: deja, ids: best?.t || null, equipe: best ? noms(best.t) : null, s3: best ? pct(best.s3) : null, gain: best ? +(100 * (best.v - base.v)).toFixed(1) : null });
    }
    lignes.sort((x, y) => (y.gain ?? -1e9) - (x.gain ?? -1e9));
    const mr = lignes.filter(l => l.rarete === 'MR');
    const lr = lignes.filter(l => l.rarete !== 'MR' && CH[l.id]?.r === 'M');
    bannieres.push({ serie: b.series, mr: mr.map(l => l.carte), meilleure: lignes[0] || null, meilleureLR: lr[0] || null, meilleureMR: mr[0] || null, cartes: lignes });
    log(`souvenirs ${b.series} : MR ${mr.map(l => `${l.carte} ${l.gain ?? 'hors limite'}`).join(', ') || 'aucune trouvee'} ; meilleure carte ${lignes[0]?.carte} (${lignes[0]?.gain})`);
  }
  bannieres.sort((x, y) => (y.meilleureLR?.gain ?? -1e9) - (x.meilleureLR?.gain ?? -1e9));
  out.souvenirs = { palier: LIM.rb, plafond: LIM.actif ? LIM.plafond : null, date: new Date().toISOString(), reference: baseTeam ? { ids: baseTeam, equipe: noms(baseTeam), s3: pct(base.s3) } : null, combats: BENCH.length, tauxMR: G.MEMORY_MR_RATE ?? 0.01, pity: 50, coutX10: 50, jours: G.MEMORY_DURATION ? Math.round(G.MEMORY_DURATION / 86400000) || 7 : 7, bannieres };
  if (!MB.length) log('souvenirs : aucune banniere Souvenirs dans ce moteur du jeu');
}
let ancien = {}; try { ancien = readJ(D('resultats', 'conseils-ia.json')) || {}; } catch {}
ecrire('conseils-ia.json', { ...ancien, ...out });
log('termine, resultats dans resultats/conseils-ia.json'); await pool.close(); process.exit(0);
