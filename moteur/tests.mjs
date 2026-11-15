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
const c = fights.map(f => S.fight(f, team, 7, pol, { stop2: true }));
t('arret a 2 K.O. : memes 2 etoiles', a.filter(r => r.stars >= 2).length === c.filter(r => r.stars >= 2).length);
const pool = await makePool(2), jobs = fights.slice(0, 12).map(f => ({ team, fights: [f], seeds: [7] }));
const pr = await pool.runAll(jobs, W_DEFAUT, {}, 3); await pool.close();
t('multithread = fil unique', pr.every((r, i) => r.s2 === (a[i].stars >= 2 ? 1 : 0) && r.win === (a[i].win ? 1 : 0)));
const r1 = resumer(G, B, version); t('patch : une version comparee a elle-meme est vide', comparer(r1, r1).vide);
// Serveur : demarre sur un autre port, verifie les protections.
const PORT = 47199, srv = spawn(process.execPath, ['serveur.mjs'], { env: { ...process.env, KITSU_PORT: String(PORT) } });
let up = false; for (let i = 0; i < 60 && !up; i++) { await new Promise(r => setTimeout(r, 250)); try { up = (await fetch(`http://127.0.0.1:${PORT}/ping`)).ok; } catch {} }
t('serveur demarre', up);
if (up) {
  t('panneau protege par jeton', (await fetch(`http://127.0.0.1:${PORT}/api/etat`)).status === 403);
  t('sauvegarde reservee au script', (await fetch(`http://127.0.0.1:${PORT}/sauvegarde`, { method: 'POST', body: '{}' })).status === 403);
}
srv.kill();
console.log(`\n${ok} reussi(s), ${ko} echec(s)`); process.exit(ko ? 1 : 0);
