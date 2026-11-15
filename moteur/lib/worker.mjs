// Fil de calcul : charge le moteur une fois, puis traite des paquets de travail.
//   type 'fights' : combats -> { n, win, s2, s3 }   type 'tower' : etages atteints   type 'gw' : degats au boss de guilde
import { parentPort, workerData } from 'node:worker_threads';
import { loadEngine } from './charger.mjs';
import { makeSim } from './sim.mjs';
const { G, B } = await loadEngine(workerData?.version);
const S = makeSim(G, B);
let polKey = '', pol = null;
parentPort.on('message', ({ id, W, jobs, opt }) => {
  try {
    const k = JSON.stringify(W); if (k !== polKey) { polKey = k; pol = S.smartPol(W); }
    const out = jobs.map(j => {
      if (j.type === 'tower') return { fl: j.seeds.map(sd => S.tower(j.team, sd, pol, j.maxFl)) };
      if (j.type === 'gw') return { dmg: j.seeds.map(sd => S.gw(j.team, sd, pol, j.boss)) };
      let n = 0, win = 0, s2 = 0, s3 = 0;
      for (const sd of j.seeds) for (const fid of j.fights) { const r = S.fight(fid, j.team, sd, pol, opt); n++; win += r.win; s2 += r.stars >= 2; s3 += r.stars === 3; }
      return { n, win, s2, s3 };
    });
    parentPort.postMessage({ id, out });
  } catch (e) { parentPort.postMessage({ id, err: String(e.stack || e) }); }
});
parentPort.postMessage({ ready: true });
