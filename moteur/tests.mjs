// Tests automatiques du moteur local (lances par la verification GitHub et a la main : node tests.mjs).
import { spawn } from 'node:child_process';
import { loadEngine } from './lib/charger.mjs';
import { makeSim, W_DEFAUT } from './lib/sim.mjs';
import { makePool } from './lib/pool.mjs';
import { resumer, comparer } from './lib/resume.mjs';
let ok = 0, ko = 0; const t = (nom, cond, info = '') => { if (cond) { ok++; console.log('  OK   ' + nom); } else { ko++; console.log('  ECHEC ' + nom + (info ? ' : ' + info : '')); } };
const { G, B, version } = await loadEngine(); const S = makeSim(G, B), pol = S.smartPol(W_DEFAUT);
console.log(`Moteur ${version}`);
t('moteur charge', G.ALL_WORLDS.length > 5 && Object.keys(G.CHAR_BY_ID).length > 1000, `${G.ALL_WORLDS.length} mondes`);
const ids = Object.values(G.CHAR_BY_ID).filter(c => c.r === 'M').slice(0, 3).map(c => c.id), team = ids.map(id => ({ id, lv: 99, stars: 0 }));
const fights = []; for (const w of G.ALL_WORLDS) w.fights.forEach((f, i) => { if (i % 25 === 0) fights.push(f.id + '@xn'); });
const a = fights.map(f => S.fight(f, team, 7, pol)), b = fights.map(f => S.fight(f, team, 7, pol));
// 5.45 : la fiche de carte lit les stats d'une unite apres setupBattle (PV, ATK, DEF, VIT, critique) et les liens actifs d'un trio.
{ const u = B.allies(G.setupBattle(G.findFight(fights[0]), [{ id: ids[0], lv: 99, stars: 0 }], 1).st)[0], u1 = B.allies(G.setupBattle(G.findFight(fights[0]), [{ id: ids[0], lv: 1, stars: 0 }], 1).st)[0];
  t('fiche : stats d une unite lisibles (PV, ATK, DEF, VIT, crit)', ['maxHp', 'atk', 'def', 'spd'].every(k => +u[k] > 0) && typeof u.crit === 'number' && u.maxHp > u1.maxHp, JSON.stringify({ maxHp: u?.maxHp, atk: u?.atk, def: u?.def, spd: u?.spd, crit: u?.crit, pv1: u1?.maxHp }));
  const L = G.activeLinks(ids), P = G.linkPlan(ids, {});
  t('fiche : liens actifs du trio (nom, stat, %, cartes) et liens gardes', Array.isArray(L) && L.every(l => l.name && l.stat && l.pct > 0 && Array.isArray(l.ids)) && P && typeof P.kept === 'object', `${L?.length} liens`); }
t('meme tirage = meme resultat', JSON.stringify(a) === JSON.stringify(b));
t('regle des etoiles', a.every(r => !r.win ? r.stars === 0 : r.stars === Math.min(r.cycle > 8 ? 2 : 3, Math.max(1, 3 - r.ko))));
const tw = [1, 2].map(() => S.tower(team, 3, pol, 60));
t('Tour : meme tirage = meme etage', tw[0] === tw[1] && tw[0] > 0, String(tw));
const c = fights.map(f => S.fight(f, team, 7, pol, { stop2: true }));
t('arret a 2 K.O. : memes 2 etoiles', a.filter(r => r.stars >= 2).length === c.filter(r => r.stars >= 2).length);
// Arret des que les 3 etoiles sont perdues : memes 3 etoiles combat par combat, y compris avec une carte qui ranime.
const rev = Object.values(G.CHAR_BY_ID).find(x => /ranimer/.test(JSON.stringify(B.KITS?.[x.id] || {})));
const teams3 = [team, ...(rev ? [[rev.id, ids[0], ids[1]].map(id => ({ id, lv: 99, stars: 0 }))] : [])];
const eq3 = teams3.every(tm => fights.every(f => (S.fight(f, tm, 7, pol).stars === 3) === (S.fight(f, tm, 7, pol, { stop3: true }).stars === 3)));
t('arret des 3 etoiles perdues : memes 3 etoiles', eq3 && !!rev);
// Diagnostic de la 3e etoile (5.26) : memes etoiles que le simulateur, cause coherente avec la regle.
const { jouer } = await import('./lib/diagnostic.mjs');
const dj = fights.map(f => jouer(G, B, S, pol, f, team, 7));
t('diagnostic : memes etoiles que le simulateur, cause juste', dj.every((r, i) => r.stars === a[i].stars && (r.stars === 3) === (r.cause == null) && (r.cause !== 'cycle' || (r.win && r.ko === 0 && r.cycle > 8)) && (r.cause !== 'ko' || (r.win && r.ko > 0 && r.cycle <= 8))));
// Collectifs calcules une fois par trio (5.33) : memes combats que le moteur du jeu sans copie, et repli si fonction absente.
{
  const { memoriserCollectifs } = await import('./lib/charger.mjs');
  const code = `import { loadEngine } from './lib/charger.mjs'; import { makeSim, W_DEFAUT } from './lib/sim.mjs';
const { G, B, memoCollectifs } = await loadEngine(); const S = makeSim(G, B), pol = S.smartPol(W_DEFAUT);
const C = Object.values(G.CHAR_BY_ID).filter(c => c.r === 'M' || c.r === 'L'); let r = 7; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
const fl = []; for (const w of G.ALL_WORLDS) w.fights.forEach((f, i) => { if (i % 40 === 0) fl.push(f.id + '@xn'); });
let out = ''; for (let k = 0; k < 40; k++) { const t = [0, 1, 2].map(() => C[Math.floor(rnd() * C.length)].id); if (new Set(t).size < 3) continue;
  const team = t.map(id => ({ id, lv: 99, stars: 0 })); for (const f of fl) for (const o of [{}, { stop3: true }]) { const x = S.fight(f, team, 11, pol, o); out += x.stars + '' + x.ko + x.cycle + ','; } }
console.log(JSON.stringify({ memo: memoCollectifs || null, out })); process.kill(process.pid, 'SIGKILL');`;
  const lancer = env => new Promise(res => { const p = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, ...env } }); let o = ''; p.stdout.on('data', d => o += d); p.on('close', () => { try { res(JSON.parse(o.trim().split('\n').pop())); } catch { res(null); } }); });
  const [avec, sans] = await Promise.all([lancer({}), lancer({ KITSU_SANS_MEMO: '1' })]);
  t('collectifs memorises : copie du moteur active', !!avec?.memo, JSON.stringify(avec?.memo));
  t('collectifs memorises : combats identiques au moteur du jeu', !!avec && !!sans && !sans.memo && avec.out === sans.out && avec.out.length > 1000, `${avec?.out.length} / ${sans?.out.length}`);
  t('collectifs memorises : repli si la fonction est absente', memoriserCollectifs('function a(b){return 1}') === null);
}
const { h53 } = await import('./lib/journal.mjs');
t('journal : cle stable et distincte', h53('abc') === h53('abc') && h53('abc') !== h53('abd'));
// 5.60.1 : signature d'une carte insensible a la renumerotation des collectifs (champ `i`), sensible a leur contenu et a leur ordre.
{
  const { makeSigCarte } = await import('./lib/journal.mjs');
  const c = (G.LINKS || []).flatMap(l => l.ids).find(id => (G.LINKS || []).filter(l => l.ids.includes(id)).length >= 2), sig = L => makeSigCarte({ ...G, LINKS: L }, B)(c);
  const L0 = G.LINKS || [], mien = L0.filter(l => l.ids.includes(c)), [x, y] = mien;
  const renum = L0.map(l => ({ ...l, i: (l.i ?? 0) + 1000 })), pct = L0.map(l => l === x ? { ...l, pct: l.pct + 1 } : l), inv = L0.map(l => l === x ? { ...x, i: y.i } : l === y ? { ...y, i: x.i } : l);
  t('journal : collectifs renumerotes = meme signature de carte, contenu ou ordre change = autre signature', c != null && sig(L0) === sig(renum) && sig(L0) !== sig(pct) && sig(L0) !== sig(inv), String(c));
}
// 5.42 : generations du journal ; compacter() garde les lignes servies par l'un des 2 derniers calculs complets.
{
  const { ouvrirJournal, nettoyerAnciens } = await import('./lib/journal.mjs'), fsm = await import('node:fs'), os = await import('node:os'), pth = await import('node:path');
  const dos = fsm.mkdtempSync(pth.join(os.tmpdir(), 'kj-')), f = pth.join(dos, 'cauchemar3-x-y.jsonl');
  fsm.writeFileSync(f, 'a 1\nb 2\nc 3\n'); // ancien format, sans generation
  let J = ouvrirJournal(f); J.get('a'); J.set('d', '4'); const c1 = J.compacter(2);
  J = ouvrirJournal(f); const g2 = J.generation; J.get('d'); const c2 = J.compacter(2);
  J = ouvrirJournal(f);
  t('journal : ancien format lu, rien retire au 1er calcul', c1.avant === 4 && c1.apres === 4 && c1.generation === 1, JSON.stringify(c1));
  t('journal : lignes inutilisees par les 2 derniers calculs retirees', g2 === 2 && c2.apres === 2 && J.get('a') === '1' && J.get('d') === '4' && J.get('b') === undefined && J.get('c') === undefined, JSON.stringify(c2));
  const vieux = pth.join(dos, 'cauchemar3-vieux.jsonl'); fsm.writeFileSync(vieux, 'z 1\n'); fsm.utimesSync(vieux, new Date(0), new Date(0));
  const sup = nettoyerAnciens(dos, 'cauchemar3-', f);
  t('journal : ancien journal inutilise depuis 30 jours supprime, journal en service garde', sup.length === 1 && !fsm.existsSync(vieux) && fsm.existsSync(f), JSON.stringify(sup));
  fsm.rmSync(dos, { recursive: true, force: true });
}
const pool = await makePool(2), jobs = fights.slice(0, 12).map(f => ({ team, fights: [f], seeds: [7] }));
const pr = await pool.runAll(jobs, W_DEFAUT, {}, 3); await pool.close();
t('multithread = fil unique', pr.every((r, i) => r.s2 === (a[i].stars >= 2 ? 1 : 0) && r.win === (a[i].win ? 1 : 0)));
// Liens actifs (5.41, lib/liens.mjs) : memes totaux de stats = memes combats ; front de Pareto ; recherche sur quelques combats.
{
  const L = await import('./lib/liens.mjs'), cap = G.LINK_CAP || 6;
  let tr = [9902707, 9637855, 3180].every(id => G.CHAR_BY_ID[id]) ? [9902707, 9637855, 3180] : null;
  if (!tr) { const M = Object.values(G.CHAR_BY_ID).filter(c => ['M', 'L', 'E'].includes(c.r)).map(c => c.id); for (let x = 0; x < M.length && !tr; x++) for (let y = x + 1; y < M.length && !tr; y++) { const t3 = [M[x], M[y], M.find(z => z !== M[x] && z !== M[y])]; if (G.activeLinks(t3).filter(l => l.ids.includes(M[x])).length > cap) tr = t3; } }
  const id = tr?.find(i => G.activeLinks(tr).filter(l => l.ids.includes(i)).length > cap), P = id ? L.profilsLiens(G, tr, id) : null;
  t('liens : une carte a plus de 6 liens trouvee', !!P && P.actifs > cap, tr && tr.join('/'));
  const dom = (p, q) => L.STATS.every((s2, j) => s2 === 'spd' ? q.v[j] === p.v[j] : q.v[j] >= p.v[j]) && L.STATS.some((_, j) => q.v[j] > p.v[j]);
  t('liens : totaux distincts puis front de Pareto', !!P && P.gardes.length >= 1 && P.gardes.length <= P.distincts.length && P.distincts.length <= P.tous && P.gardes.every(p => !P.distincts.some(q => q !== p && dom(p, q))), P && `${P.tous} / ${P.distincts.length} / ${P.gardes.length}`);
  // deux choix differents avec les memes totaux : memes combats (la base de la recherche)
  let pair = null; if (P) { const n = P.liens.length, v = P.liens.map(l => L.STATS.map(s2 => s2 === l.stat ? l.pct : 0)), vus = new Map();
    const rec = (i, k, acc, pris) => { if (pair) return; if (k === 0) { const c = acc.join(','), cl = pris.map(j => G.linkKey(P.liens[j])); if (vus.has(c)) pair = [vus.get(c), cl]; else vus.set(c, cl); return; } if (n - i < k) return; pris.push(i); rec(i + 1, k - 1, acc.map((x, j) => x + v[i][j]), pris); pris.pop(); rec(i + 1, k, acc, pris); };
    rec(0, cap, L.STATS.map(() => 0), []); }
  const eqLk = lk => tr.map(x => ({ id: x, lv: 99, stars: 0, ...(x === id ? { lk } : {}) }));
  t('liens : memes totaux = memes combats', !!pair && fights.slice(0, 10).every(f => JSON.stringify(S.fight(f, eqLk(pair[0]), 7, pol)) === JSON.stringify(S.fight(f, eqLk(pair[1]), 7, pol))), pair ? '' : 'aucune paire');
  const pl = await makePool(2), R = await L.chercherLiens({ G, pool: pl, WA: W_DEFAUT, cibles: [{ trio: tr, fights: fights.slice(0, 4) }], carte: (x, lk) => ({ id: x, lv: 99, stars: 0, ...(lk ? { lk } : {}) }), lkDe: () => null, nom: x => G.CHAR_BY_ID[x]?.n, conf: 1, controle: 2, log: () => {} });
  await pl.close();
  const c0 = R.cartes[0];
  t('liens : recherche sur quelques combats', !!c0 && c0.cles.length === cap && c0.combats === 4 && c0.tirages === 2 && c0.apres >= c0.avant && R.simules > 0, JSON.stringify(c0 && { avant: c0.avant, apres: c0.apres, utile: c0.utile }));
}
// Raid : meme graine = meme raid, actions acceptees par le jeu, la coordination fait mieux que frapper seulement.
const RA = await import('./lib/raid.mjs'), LG = Object.values(G.CHAR_BY_ID).filter(c => c.r === 'M' && !c.raidExclusive).slice(0, 9).map(c => ({ id: c.id, lv: 99 }));
const rr = RA.roster(LG.slice(0, 3), LG.slice(3)), j1 = RA.jouer(G, rr, 11), j2 = RA.jouer(G, rr, 11);
t('Raid : meme graine = meme raid', JSON.stringify(j1) === JSON.stringify(j2), j1.outcome);
let valide = true, sr = G.createRaidCombat(rr, 11, 0);
for (let k = 0; k < 12 && !sr.outcome; k++) { const P = RA.planTour(G, sr); for (const [seat, A] of Object.entries(P.par)) try { G.validateRaidActions(sr, +seat, A.map(({ why, degats, ...x }) => x)); } catch (e) { valide = false; } sr = RA.jouerTour(G, sr, Object.values(P.par).flat(), 0); if (!sr.outcome) G.prepareRaidTurn(sr, 0); }
t('Raid : conseils acceptes par le jeu', valide);
const graines = [1, 2, 3, 4], coord = graines.map(g => RA.jouer(G, rr, g)), naif = graines.map(g => RA.jouer(G, rr, g, { naif: [0, 1, 2] }));
const sc = L => L.reduce((a, r) => a + (r.gagne ? 3 : r.stage), 0);
t('Raid : coordination meilleure que frapper seulement', sc(coord) > sc(naif), sc(coord) + ' contre ' + sc(naif));
const r1 = resumer(G, B, version); t('patch : une version comparee a elle-meme est vide', comparer(r1, r1).vide);
// Plan d'XP et de banniere : la carte la plus rentable passe devant, la suivante est comptee une fois la 1re faite.
{ const { plan } = await import('./lib/plan.mjs');
  const S0 = { owned: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, lv: { 1: { l: 99 }, 2: { l: 99 }, 3: { l: 99 }, 4: { l: 30 }, 5: { l: 1 } } };
  const camp = { niveaux: '99', etages: { seuil: 60, resume: [{ difficulte: 'normal' }], trios: [[1, 2, 3], [1, 4, 5]], colonnes: ['combat', 'difficulte', 'meilleurTrio', 'meilleur3e', 'trioDuPlan', 'plan3e', 'specialiste', 'script3e', 'combatDeBase', 'autres'],
    combats: [['a', 0, 0, 90, 0, 90, 0, 0, 'a', [[0, 90]]], ['c', 0, 0, 90, 0, 90, 0, 0, 'c', [[0, 90]]], ['d', 0, 0, 90, 0, 90, 0, 0, 'd', [[0, 90]]], ['b', 0, 1, 80, 1, 80, 0, 0, 'b', [[1, 80]]]] } };
  const P = plan({ G, S: S0, campagne: camp, tour: { niveaux: '99', classement: [{ ids: [1, 2, 3], etageMoyen: 100 }, { ids: [1, 2, 4], etageMoyen: 150 }] } });
  const tour = P.modes.find(m => m.cle === 'tour'), cp = P.modes.find(m => m.cle === 'campagne');
  t("plan d'XP : modes lus", tour?.now === 100 && tour?.max === 150 && cp?.now === 3 && cp?.max === 4, JSON.stringify(P.modes));
  t("plan d'XP : Tour en tete, puis la carte qui reste (sans recompter la 1re)", P.cible?.id === 4 && P.cartes[1]?.ids.join() === '5' && P.cartes[1].gains.campagne?.v === 1 && !P.cartes[1].gains.tour, JSON.stringify(P.cartes.map(c => [c.ids, c.points]))); }
// Le modele vivant : instantane lu dans le plan et les resultats, sans simulation.
{ const { plan } = await import('./lib/plan.mjs'), M = await import('./lib/modele.mjs');
  const camp = { niveaux: '99', etages: { seuil: 0.6, resume: [{ difficulte: 'normal' }], trios: [[1, 2, 3], [1, 4, 5]], colonnes: ['combat', 'difficulte', 'meilleurTrio', 'meilleur3e'], combats: [['a', 0, 0, 90], ['b', 0, 1, 40], ['c', 0, 1, 10], ['d', 0, 0, 0]] } };
  const tour = { niveaux: '99', classement: [{ ids: [1, 2, 3], etageMoyen: 100 }] };
  const S0 = { owned: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, lv: { 1: { l: 99 }, 2: { l: 99 }, 3: { l: 99 } } };
  const s = M.instantane({ plan: plan({ G, S: S0, campagne: camp, tour }), campagne: camp, tour, t: 1 });
  t('modele : un chiffre par combat, trios comptes', s.c.normal === '3210' && s.tour?.now === 100 && s.tr.some(x => x[0] === 'c' && x[4] === 2) && s.tr.some(x => x[0] === 't'), JSON.stringify(s)); }
// Trio par combat (5.43) : le meilleur trio deja pret (3 cartes au 99) est garde pour chaque combat, confirme s'il a fait 3 etoiles.
{ const { parCombat } = await import('./lib/etages.mjs');
  const trios = [[1, 2, 3], [4, 5, 6], [1, 4, 5]], taux = { a: [1, 0.5, 0], b: [1, 0, 0] }; // 0.5 : 3 etoiles sur les tirages pairs
  const pool = { runAll: async jobs => jobs.map(j => ({ st: j.fights.flatMap(f => j.seeds.map(sd => { const r = taux[f][j.team]; return r === 1 || (r === 0.5 && sd % 2 === 0) ? '3' : '2'; })).join('') })) };
  const J = new Map(); J.flush = () => {};
  const e = await parCombat({ pool, J, WA: null, paquets: [[{ f: ['a', 'b'], cle: 'p' }]], DIFF: [['normal']], trios, cleTrio: trios.map(x => x.join('-')), equipeDe: x => x, cands: [0, 1, 2], scriptSet: new Set(), sigG: 'g', wKey: 'w', sigColl: 'c', sigCombat: f => f, log: () => {}, dejaAu99: id => id >= 4 && id <= 6 });
  const ligne = f => e.combats.find(c => c[0] === f), tri = r => r && e.trios[r[0]].join('-');
  t('trio par combat : colonne pret', e.colonnes[10] === 'pret' && tri(ligne('a')[10]) === '4-5-6' && ligne('a')[10][1] === 50 && tri(ligne('b')[10]) === '4-5-6' && ligne('b')[10][1] === 0 && e.trios[ligne('a')[2]].join('-') === '1-2-3', JSON.stringify(e.combats));
  const e2 = await parCombat({ pool, J: Object.assign(new Map(), { flush() {} }), WA: null, paquets: [[{ f: ['a', 'b'], cle: 'p' }]], DIFF: [['normal']], trios, cleTrio: trios.map(x => x.join('-')), equipeDe: x => x, cands: [0, 2], scriptSet: new Set(), sigG: 'g', wKey: 'w', sigColl: 'c', sigCombat: f => f, log: () => {}, dejaAu99: id => id >= 4 && id <= 6 });
  t('trio par combat : aucun trio pret joue, pret vide', e2.combats.every(c => c[10] === null), JSON.stringify(e2.combats)); }
// Serveur : demarre sur un autre port, verifie les protections.
const PORT = 47199, srv = spawn(process.execPath, ['serveur.mjs'], { env: { ...process.env, KITSU_PORT: String(PORT) } });
let up = false; for (let i = 0; i < 60 && !up; i++) { await new Promise(r => setTimeout(r, 250)); try { up = (await fetch(`http://127.0.0.1:${PORT}/ping`)).ok; } catch {} }
t('serveur demarre', up);
if (up) {
  t('panneau protege par jeton', (await fetch(`http://127.0.0.1:${PORT}/api/etat`)).status === 403);
  t('conseil de raid reserve au script', (await fetch(`http://127.0.0.1:${PORT}/raid`, { method: 'POST', body: '{}' })).status === 403);
  t("plan d'XP lisible par le script", (await fetch(`http://127.0.0.1:${PORT}/plan`)).status === 200);
  t('modele reserve au panneau', (await fetch(`http://127.0.0.1:${PORT}/api/modele`)).status === 403);
  t('sauvegarde reservee au script', (await fetch(`http://127.0.0.1:${PORT}/sauvegarde`, { method: 'POST', body: '{}' })).status === 403);
  // 5.45 : fiche de carte (stats lues dans le moteur, echelle des cartes SSR/UR/LR au 99, liens du trio)
  const tok = ((await (await fetch(`http://127.0.0.1:${PORT}/`)).text()).match(/const TOKEN = '([^']+)'/) || [])[1];
  const cs = await (await fetch(`http://127.0.0.1:${PORT}/api/carte-stats?id=${ids[0]}&trio=${ids.join(',')}`, { headers: { 'X-Kitsu-Token': tok } })).json();
  t('fiche : /api/carte-stats (actuel, 99, echelle, liens)', !cs.err && cs.actuel?.hp > 0 && cs.max?.hp >= cs.actuel.hp && cs.echelle?.hp >= cs.max.hp && Array.isArray(cs.liens), JSON.stringify(cs).slice(0, 300));
}
srv.kill();
console.log(`\n${ok} reussi(s), ${ko} echec(s)`); process.exit(ko ? 1 : 0);
