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
t('meme tirage = meme resultat', JSON.stringify(a) === JSON.stringify(b));
t('regle des etoiles', a.every(r => !r.win ? r.stars === 0 : r.stars === Math.min(r.cycle > 8 ? 2 : 3, Math.max(1, 3 - r.ko))));
const tw = [1, 2].map(() => S.tower(team, 3, pol, 60));
t('Tour : meme tirage = meme etage', tw[0] === tw[1] && tw[0] > 0, String(tw));
// Bouton Auto du jeu (5.37) : W.auto simule exactement le choix du jeu (autoChoice), combat par combat.
{ const jeu = (st, u) => B.autoChoice(st, u), pa = S.smartPol({ ...W_DEFAUT, auto: 1 });
  t('mode Auto : memes combats que le choix du jeu', typeof B.autoChoice === 'function' && JSON.stringify(fights.map(f => S.fight(f, team, 7, pa))) === JSON.stringify(fights.map(f => S.fight(f, team, 7, jeu)))); }
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
const pool = await makePool(2), jobs = fights.slice(0, 12).map(f => ({ team, fights: [f], seeds: [7] }));
const pr = await pool.runAll(jobs, W_DEFAUT, {}, 3); await pool.close();
t('multithread = fil unique', pr.every((r, i) => r.s2 === (a[i].stars >= 2 ? 1 : 0) && r.win === (a[i].win ? 1 : 0)));
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
}
srv.kill();
console.log(`\n${ok} reussi(s), ${ko} echec(s)`); process.exit(ko ? 1 : 0);
