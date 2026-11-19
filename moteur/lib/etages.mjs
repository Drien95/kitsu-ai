// Meilleur trio PAR COMBAT (Campagne et Cauchemar), apres la course globale de cauchemar3.mjs.
// La course classe les trios sur un score global : un trio qui serait le seul a faire 3 etoiles sur un combat precis y est
// ecarte tot. Ici, chaque combat est regarde seul, en trois temps :
//   1) candidats (meilleurs trios de la course + trios que le script Tampermonkey essaie + ton equipe) : chaque combat, 2 tirages ;
//   2) confirmation : sur chaque combat, les 8 meilleurs candidats (et le meilleur trio deja au 99) jouent `conf` tirages de plus ;
//   3) specialistes : sur les combats encore sous le seuil, TOUS les trios jouent le combat seul (1 tirage, puis 2 de plus pour
//      ceux qui font 3 etoiles, puis `conf` de plus pour les 20 meilleurs), par priorite (Campagne puis Cauchemar Normal,
//      Difficile, Extreme) dans un budget de temps (`budget` minutes) ; le journal garde chaque combat fini : la nuit suivante reprend.
// Le hasard d'un combat est tire a chaque essai par le jeu (fightStart) : un resultat est une probabilite de 3 etoiles par essai.
// Plan minimal : le moins de trios possible pour couvrir tous les combats, a un tirage pres du meilleur trio de chaque combat.
import { h53 } from './journal.mjs';

const ORDRE = ['campNormal', 'campDifficile', 'campExtreme', 'normal', 'difficile', 'extreme'];

export async function parCombat(o) {
  const { pool, J, WA, paquets, DIFF, trios, cleTrio, equipeDe, cands, scriptSet, sigG, wKey, sigColl, sigCombat, log } = o;
  // 5.27 : etoiles deja jouees pendant la course (meme trio, meme combat, meme graine : meme resultat), reprises sans rejouer.
  const connu = o.connu || (() => null), connu1 = o.connu1 || (() => 0);
  const seuil = o.seuil ?? 0.6, budget = (o.budget ?? 60) * 60e3, conf = o.conf ?? 6, garde = 8, T0 = Date.now();
  let simules = 0, repris = 0, dernier = Date.now();
  const tic = m => { if (Date.now() - dernier > 60000) { dernier = Date.now(); log(m()); } };
  // Combats : index global, difficulte, paquet, place dans le paquet.
  const F = []; paquets.forEach((ps, di) => ps.forEach((p, pi) => p.f.forEach((f, k) => F.push({ f, di, pi, k }))));
  const NF = F.length, NC = cands.length, idxF = new Map(F.map((x, i) => [x.di + '|' + x.pi + '|' + x.k, i]));
  const n = new Uint8Array(NC * NF), s = new Uint8Array(NC * NF);
  const run = async (jobs, taille) => { const r = await pool.runAll(jobs, WA, { stop3: true }, taille); simules += jobs.reduce((a, j) => a + j.fights.length * j.seeds.length, 0); return r; };

  // 1) candidats, paquet par paquet (journal : une ligne par trio, paquet et tirage, etoiles de chaque combat)
  log(`par combat : ${NC} trios candidats sur ${NF} combats, 2 tirages`);
  const items = []; for (let ci = 0; ci < NC; ci++) paquets.forEach((ps, di) => ps.forEach((p, pi) => { for (const seed of [1, 2]) items.push({ ci, di, pi, seed }); }));
  for (let a = 0; a < items.length; a += 20000) {
    const part = items.slice(a, a + 20000), todo = [];
    const cle = x => h53(`E|${sigG}|${wKey}|${paquets[x.di][x.pi].cle}|${x.seed}|${cleTrio[cands[x.ci]]}`);
    const poser = (x, st) => { for (let k = 0; k < st.length; k++) { const i = x.ci * NF + idxF.get(x.di + '|' + x.pi + '|' + k); n[i]++; if (st[k] === '3') s[i]++; } };
    for (const x of part) { const v = J.get(cle(x)) || connu(cands[x.ci], x.di, x.pi, x.seed); if (v) { poser(x, v); repris++; } else todo.push(x); }
    if (todo.length) {
      const r = await run(todo.map(x => ({ type: 'etoiles', team: equipeDe(cands[x.ci]), fights: paquets[x.di][x.pi].f, seeds: [x.seed] })), 8);
      r.forEach((y, j) => { poser(todo[j], y.st); J.set(cle(todo[j]), y.st); }); J.flush();
    }
    tic(() => `  par combat, candidats : ${Math.min(items.length, a + 20000)} / ${items.length} paquets, ${Math.round(simules / ((Date.now() - T0) / 1000))} combats/s`);
  }

  // 2) confirmation : les 8 meilleurs candidats de chaque combat (au moins une fois 3 etoiles) jouent `conf` tirages de plus
  const seeds2 = Array.from({ length: conf }, (_, i) => 3 + i), conf2 = [];
  const pretT = o.dejaAu99 ? t => t >= 0 && trios[t].every(o.dejaAu99) : null, pretCi = pretT && cands.map(pretT);
  for (let fi = 0; fi < NF; fi++) {
    const L = []; for (let ci = 0; ci < NC; ci++) if (s[ci * NF + fi]) L.push(ci);
    L.sort((a, b) => s[b * NF + fi] - s[a * NF + fi] || a - b); for (const ci of L.slice(0, garde)) conf2.push({ ci, fi });
    // 5.43 : le meilleur trio deja pret (3 cartes au niveau 99, o.dejaAu99) est confirme aussi, meme hors des 8 premiers :
    // l'onglet Campagne montre ainsi, combat par combat, ce que tu peux jouer tout de suite.
    const pr = pretCi && L.find(ci => pretCi[ci]); if (pr != null && !L.slice(0, garde).includes(pr)) conf2.push({ ci: pr, fi });
  }
  log(`par combat : confirmation de ${conf2.length} paires trio / combat (${conf} tirages de plus)`);
  for (let a = 0; a < conf2.length; a += 20000) {
    const part = conf2.slice(a, a + 20000), todo = [];
    const cle = x => h53(`E2|${sigG}|${wKey}|${sigCombat(F[x.fi].f)}|${conf}|${cleTrio[cands[x.ci]]}`);
    const poser = (x, st) => { const i = x.ci * NF + x.fi; for (const c of st) { n[i]++; if (c === '3') s[i]++; } };
    for (const x of part) { const v = J.get(cle(x)); if (v) { poser(x, v); repris++; } else todo.push(x); }
    if (todo.length) {
      const r = await run(todo.map(x => ({ type: 'etoiles', team: equipeDe(cands[x.ci]), fights: [F[x.fi].f], seeds: seeds2 })), 16);
      r.forEach((y, j) => { poser(todo[j], y.st); J.set(cle(todo[j]), y.st); }); J.flush();
    }
    tic(() => `  par combat, confirmation : ${Math.min(conf2.length, a + 20000)} / ${conf2.length}`);
  }
  const P = (ci, fi) => { const i = ci * NF + fi; return n[i] ? s[i] / n[i] : 0; }, plein = 2 + conf;
  // Meilleur trio de chaque combat (seulement les trios confirmes : `plein` tirages)
  const meilleur = F.map((_, fi) => { let b = -1, bp = 0; for (let ci = 0; ci < NC; ci++) if (n[ci * NF + fi] >= plein && P(ci, fi) > bp) { bp = P(ci, fi); b = ci; } return { t: b >= 0 ? cands[b] : -1, p: bp, n: b >= 0 ? n[b * NF + fi] : 0, spec: false }; });
  // 5.48 : plancher (o.essais : combat -> { t, p, n }, meilleur trio du dernier calcul rejoue 64 tirages) : il remplace le meilleur
  // s'il fait mieux. Combats a 3 etoiles dans ta partie (o.acquisJeu) : pas de specialistes.
  const ESS = o.essais || new Map(), AJ = o.acquisJeu || new Set(), essF = F.map(x => ESS.get(x.f) || null); let planchers = 0;
  F.forEach((x, fi) => { const e = essF[fi]; if (e && e.p > meilleur[fi].p) { meilleur[fi] = { t: e.t, p: e.p, n: e.n, spec: false }; planchers++; } });

  // 3) specialistes sur les combats sous le seuil
  // 5.27 : la Campagne N/D/E n'est plus jouee par tous les trios pendant la course. Pour que son meilleur trio reste cherche
  // combat par combat parmi TOUS les trios, chaque combat de Campagne qui n'est pas a 100 % chez les candidats passe aussi
  // par les specialistes (hors budget : c'est le calcul que la course faisait avant, en plus court).
  const camp = fi => DIFF[F[fi].di][0].startsWith('camp'), seuilCamp = o.seuilCamp ?? 1;
  // 5.41.1 : la Campagne d'abord (hors budget), puis les combats de Cauchemar ou un candidat a deja fait 3 etoiles au moins une fois,
  // toutes difficultes, et seulement ensuite ceux a 0 % (avant : difficulte par difficulte, les 0 % du Normal passaient avant le
  // Difficile et l'Extreme ; journal du 19/11 : 9 combats a 0 % sur 52, aucun 3 etoiles trouve, environ 5 min de budget).
  // 5.51 : o.tous (recherche directe, sans course) : chaque combat sous 100 % est cherche sur tous les trios, sans budget.
  const TOUS = !!o.tous;
  const rang = fi => camp(fi) ? 0 : meilleur[fi].p > 0 ? 1 : 2;
  const durs = F.map((x, fi) => fi).filter(fi => !AJ.has(F[fi].f)).filter(fi => TOUS ? meilleur[fi].p < 1 : meilleur[fi].p < (camp(fi) ? Math.max(seuil, seuilCamp) : seuil)).sort((a, b) => rang(a) - rang(b) || ORDRE.indexOf(DIFF[F[a].di][0]) - ORDRE.indexOf(DIFF[F[b].di][0]) || a - b);
  const sousSeuil = durs.filter(fi => meilleur[fi].p < seuil).length, campPlus = durs.length - sousSeuil;
  const T = trios.length, seedsS = Array.from({ length: conf }, (_, i) => 4 + i), specs = new Map();
  const cleS = fi => h53(`S|${sigG}|${wKey}|${sigCombat(F[fi].f)}|${sigColl}|${conf}`);
  for (const fi of durs) { const v = J.get(cleS(fi)); if (v) { specs.set(fi, JSON.parse(v)); repris++; } }
  const reste = durs.filter(fi => !specs.has(fi)), msCombat = []; let debutS = Date.now(), campFini = false;
  log(`par combat : ${sousSeuil} combats sous ${Math.round(seuil * 100)} % de 3 etoiles${campPlus ? ` et ${campPlus} combats ${TOUS ? 'entre ' + Math.round(seuil * 100) + ' et 100 %' : 'de Campagne sous 100 %'}` : ''}, ${specs.size} deja cherches (journal), ${reste.length} a chercher sur tous les ${T} trios, ${TOUS ? 'sans budget (recherche directe)' : `budget ${Math.round(budget / 60e3)} min`}`);
  // 5.47 : combats cherches par groupes de GS (8) : une seule tache par trio joue tous les combats du groupe qu'il n'a pas deja joues
  // dans la course (memes combats, memes graines, memes etoiles). Mesure : 1 combat par tache 7 400 a 8 100 combats/s, 8 par tache
  // 12 500 a 18 300 combats/s (4 fils), etoiles identiques. Le budget est verifie avant chaque groupe.
  const GS = Math.max(1, o.groupe ?? 8), nb3 = (st, len, q, ns) => { let c = 0; for (let si = 0; si < ns; si++) if (st[si * len + q] === '3') c++; return c; };
  // taches regroupees par trio : paires { t, g } -> une tache par trio avec ses combats ; retourne le nombre de 3 etoiles de chaque paire
  const parTrio = async (paires, fs, seeds, taille) => {
    const m = new Map(); paires.forEach((x, i) => (m.get(x.t) || m.set(x.t, []).get(x.t)).push(i));
    const ts = [...m.keys()], r = await run(ts.map(t => ({ type: 'etoiles', team: equipeDe(t), fights: m.get(t).map(i => fs[paires[i].g]), seeds })), taille);
    const out = new Array(paires.length); ts.forEach((t, j) => { const L = m.get(t); L.forEach((i, q) => { out[i] = nb3(r[j].st, L.length, q, seeds.length); }); }); return out;
  };
  let k = 0;
  for (let i0 = 0; i0 < reste.length;) {
    const fi0 = reste[i0];
    if (!camp(fi0) && !campFini) { campFini = true; debutS = Date.now(); } // le budget compte a partir du Cauchemar
    if (!TOUS && !camp(fi0) && Date.now() - debutS >= budget) break;
    const grp = []; for (let i = i0; i < reste.length && grp.length < GS && camp(reste[i]) === camp(fi0); i++) grp.push(reste[i]);
    i0 += grp.length;
    const t0 = Date.now(), NG = grp.length, fs = grp.map(fi => F[fi].f), ok1 = grp.map(() => []);
    for (let a = 0; a < T; a += 50000) {
      const ts = [], gs = [];
      for (let t = a; t < Math.min(T, a + 50000); t++) { const L = []; for (let g = 0; g < NG; g++) { const v = connu1(t, grp[g]); if (v === 2) ok1[g].push(t); else if (!v) L.push(g); } if (L.length) { ts.push(t); gs.push(L); } }
      const r = await run(ts.map((t, j) => ({ type: 'etoiles', team: equipeDe(t), fights: gs[j].map(g => fs[g]), seeds: [1] })), Math.max(8, 256 / NG | 0));
      r.forEach((y, j) => gs[j].forEach((g, q) => { if (y.st[q] === '3') ok1[g].push(ts[j]); }));
    }
    // meme ordre qu'avant (trios dans l'ordre), pour garder les memes 20 000 premiers
    const L1 = ok1.map(L => L.sort((x, y) => x - y).slice(0, 20000)), p1 = L1.flatMap((L, g) => L.map(t => ({ t, g })));
    const s2 = await parTrio(p1, fs, [2, 3], Math.max(8, 64 / NG | 0));
    const L2 = grp.map(() => []); p1.forEach((x, i) => L2[x.g].push({ t: x.t, s: 1 + s2[i] }));
    L2.forEach((L, g) => { L2[g] = L.sort((a, b) => b.s - a.s || a.t - b.t).slice(0, 20); });
    const p2 = L2.flatMap((L, g) => L.map(x => ({ t: x.t, g, s: x.s }))), s3 = await parTrio(p2, fs, seedsS, 4);
    const L3 = grp.map(() => []); p2.forEach((x, i) => L3[x.g].push({ ids: trios[x.t], s: x.s + s3[i], n: 3 + conf }));
    const ms = (Date.now() - t0) / NG;
    grp.forEach((fi, g) => {
      const L = L3[g].sort((a, b) => b.s - a.s).slice(0, 10); k++;
      specs.set(fi, L); J.set(cleS(fi), JSON.stringify(L)); msCombat.push(ms);
      log(`  specialistes ${k}/${reste.length} : ${F[fi].f} (${DIFF[F[fi].di][0]}), ${ok1[g].length} trios a 3 etoiles au 1er tirage, meilleur ${L[0] ? Math.round(100 * L[0].s / L[0].n) + ' %' : 'aucun'} (avant ${Math.round(100 * meilleur[fi].p)} %), ${Math.round((Date.now() - t0) / 1000)} s`);
    });
    J.flush();
  }
  const restants = durs.filter(fi => !specs.has(fi)).length, msMoy = msCombat.length ? msCombat.reduce((a, b) => a + b, 0) / msCombat.length : simules ? 1.05 * T / (simules / ((Date.now() - T0) / 1000)) * 1000 : null; // sinon : estime a la vitesse de ce calcul
  const indexTrio = o.indexDe ? { get: k => o.indexDe(k.split('-').map(Number)) } : new Map(trios.map((t, i) => [t.join('-'), i])); // 5.42.1 : sans table de 7 M cles
  let trouves = 0;
  for (const [fi, L] of specs) { const x = L[0]; if (x && x.s / x.n > meilleur[fi].p) { meilleur[fi] = { t: indexTrio.get(x.ids.join('-')), p: x.s / x.n, n: x.n, spec: true }; trouves++; } }

  // Plan minimal : trio qui couvre le plus de combats encore non couverts (a un tirage pres du meilleur), puis le suivant.
  const tol = 1 / plein + 1e-9, couvert = new Uint8Array(NF), plan = [], planDe = new Int32Array(NF).fill(-1);
  const ciDe = new Map(cands.map((t, i) => [t, i])), pDe = (t, fi) => { if (essF[fi]?.t === t) return essF[fi].p; const ci = ciDe.get(t) ?? -1; if (ci >= 0 && n[ci * NF + fi] >= plein) return P(ci, fi); const L = specs.get(fi), x = L?.find(y => y.ids.join('-') === trios[t].join('-')); return x ? x.s / x.n : -1; };
  const vise = F.map((_, fi) => meilleur[fi].p > 0);
  const pool2 = [...new Set([...cands, ...meilleur.filter(m => m.spec).map(m => m.t), ...essF.filter(Boolean).map(e => e.t)])];
  while (plan.length < 15) {
    let best = -1, bc = 0;
    for (const t of pool2) { let c = 0; for (let fi = 0; fi < NF; fi++) if (vise[fi] && !couvert[fi] && pDe(t, fi) >= meilleur[fi].p - tol) c++; if (c > bc) { bc = c; best = t; } }
    if (best < 0 || bc === 0) break;
    for (let fi = 0; fi < NF; fi++) if (vise[fi] && !couvert[fi] && pDe(best, fi) >= meilleur[fi].p - tol) { couvert[fi] = 1; planDe[fi] = best; }
    plan.push({ t: best, combats: bc });
  }

  // Comparaison avec le script Tampermonkey (trios de tes 10 cartes les plus fortes) : meilleur trio du script sur chaque combat.
  const pScript = F.map((_, fi) => { let b = 0; for (let ci = 0; ci < NC; ci++) if (scriptSet.has(cands[ci]) && n[ci * NF + fi]) b = Math.max(b, P(ci, fi)); return b; });
  const table = [], ti = new Map(), refT = t => { if (t < 0) return -1; if (!ti.has(t)) { ti.set(t, table.length); table.push(trios[t]); } return ti.get(t); };
  plan.forEach(x => refT(x.t));
  const r1 = x => Math.round(100 * x);
  // Autres trios surs de chaque combat (5.21, pour le plan d'XP) : les 6 meilleurs au-dessus du seuil, plus le meilleur dont les
  // 3 cartes sont deja au niveau 99 (o.dejaAu99). Le plan sait ainsi ce qu'une carte montee au 99 debloque vraiment.
  const autres = F.map((_, fi) => {
    const m = new Map(), add = (t, p) => { if (t != null && t >= 0 && p >= seuil && !(m.get(t) >= p)) m.set(t, p); };
    for (let ci = 0; ci < NC; ci++) if (n[ci * NF + fi] >= plein) add(cands[ci], P(ci, fi));
    for (const x of specs.get(fi) || []) add(indexTrio.get(x.ids.join('-')), x.s / x.n);
    const L = [...m].sort((a, b) => b[1] - a[1] || a[0] - b[0]), top = L.slice(0, 6), d = o.dejaAu99 && L.find(([t]) => trios[t].every(o.dejaAu99));
    if (d && !top.includes(d)) top.push(d);
    return top.map(([t, p]) => [refT(t), r1(p)]);
  });
  // 5.43 : meilleur trio deja pret de chaque combat (3 cartes au 99), quel que soit son taux : [trio, %] ; null si aucun trio
  // pret n'a ete joue sur ce combat (aucune carte au 99, ou aucun trio pret parmi les candidats et les specialistes).
  const pret = F.map((_, fi) => {
    if (!pretT) return null; let b = -1, bp = -1, bc = -1; // un trio confirme (`plein` tirages) passe devant un trio joue 2 fois
    const voir = (t, p, c) => { if (c > bc || (c === bc && p > bp)) { b = t; bp = p; bc = c; } };
    for (let ci = 0; ci < NC; ci++) if (pretCi[ci] && n[ci * NF + fi]) voir(cands[ci], P(ci, fi), n[ci * NF + fi] >= plein ? 1 : 0);
    for (const x of specs.get(fi) || []) { const t = indexTrio.get(x.ids.join('-')); if (pretT(t)) voir(t, x.s / x.n, 1); }
    return b >= 0 ? [refT(b), r1(bp)] : null;
  });
  const combats = F.map((x, fi) => { const m = meilleur[fi], fd = x.f.split('@')[0]; return [x.f, x.di, refT(m.t), r1(m.p), refT(planDe[fi]), planDe[fi] >= 0 ? r1(pDe(planDe[fi], fi)) : 0, m.spec ? 1 : 0, r1(pScript[fi]), fd, autres[fi], pret[fi], AJ.has(x.f) ? 1 : 0]; });
  const resume = DIFF.map(([d], di) => { const L = combats.filter(c => c[1] === di); return { difficulte: d, combats: L.length, troisEtoilesSur: L.filter(c => c[3] >= Math.round(seuil * 100)).length, script: L.filter(c => c[7] >= Math.round(seuil * 100)).length, specialistes: L.filter(c => c[6]).length, impossibles: L.filter(c => c[3] === 0).length }; });
  const duree = Math.round((Date.now() - T0) / 1000);
  log(`par combat termine en ${duree} s : ${trouves} combats ameliores par un specialiste, plan de ${plan.length} trios ; ${resume.map(r => `${r.difficulte} ${r.troisEtoilesSur}/${r.combats} (script ${r.script})`).join(', ')}`);
  return { date: new Date().toISOString(), duree, candidats: NC, tirages: plein, seuil: r1(seuil), simules, repris,
    specialistes: { sousSeuil, campagneSous100: campPlus, cherches: specs.size, cetteFois: msCombat.length, restants, minutesParCombat: msMoy ? +(msMoy / 60e3).toFixed(2) : null, minutesRestantes: msMoy ? Math.round(restants * msMoy / 60e3) : null, budget: Math.round(budget / 60e3), ameliores: trouves },
    colonnes: ['combat', 'difficulte', 'meilleurTrio', 'meilleur3e', 'trioDuPlan', 'plan3e', 'specialiste', 'script3e', 'combatDeBase', 'autres', 'pret', 'acquisJeu'],
    trios: table, plan: plan.map(x => ({ trio: ti.get(x.t), combats: x.combats })), resume, combats,
    plancher: ESS.size ? { rejoues: ESS.size, ameliores: planchers } : null, acquisJeu: AJ.size };
}
