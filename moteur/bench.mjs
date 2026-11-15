// Mesure de vitesse : combats par seconde avec 1 fil puis tous les fils.
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { W_DEFAUT } from './lib/sim.mjs';
const { G, B } = await loadEngine();
const fights = []; for (const w of G.ALL_WORLDS) w.fights.forEach(f => { if (f.boss) fights.push(f.id + '@xn'); });
const team = [9902709, 9902707, 3180].map(id => ({ id, lv: 99, stars: 0 }));
const jobs = Array.from({ length: 16 }, (_, i) => ({ team, fights: fights.slice(0, 40), seeds: [i + 1] }));
for (const n of [1, Math.max(1, (await import('node:os')).default.availableParallelism() - 1)]) {
  const p = await makePool(n); const t0 = Date.now();
  const r = await p.runAll(jobs, W_DEFAUT, {}, 2); const dt = (Date.now() - t0) / 1000, tot = r.reduce((a, x) => a + x.n, 0);
  console.log(`${n} fil(s) : ${tot} combats en ${dt.toFixed(1)} s = ${Math.round(tot / dt)} combats/s ; victoires ${r.reduce((a,x)=>a+x.win,0)}, 2 etoiles+ ${r.reduce((a,x)=>a+x.s2,0)}, 3 etoiles ${r.reduce((a,x)=>a+x.s3,0)}`);
  const t1 = Date.now(); const r2 = await p.runAll(jobs, W_DEFAUT, { stop2: true }, 2); const d2 = (Date.now() - t1) / 1000;
  console.log(`   avec arret a 2 K.O. : ${d2.toFixed(1)} s (x${(dt / d2).toFixed(2)}), 2 etoiles+ ${r2.reduce((a,x)=>a+x.s2,0)} (doit etre identique)`);
  await p.close();
}
process.exit(0);
