// Fil de calcul : charge le moteur une fois, puis traite des paquets de travail.
//   type 'fights' : combats -> { n, win, s2, s3 }   type 'tower' : etages atteints   type 'gw' : degats au boss de guilde
import { parentPort, workerData } from 'node:worker_threads';
import { loadEngine } from './charger.mjs';
import { makeSim } from './sim.mjs';
const { G, B } = await loadEngine(workerData?.version);
const S = makeSim(G, B);
let polKey = '', pol = null;
// Suites de combat a partir d'un etat reel (envoye par le script) : pour chaque action candidate,
// n simulations de la suite avec l'IA de base -> taux de 2 etoiles ou plus, 3 etoiles, victoire.
function roll(j) {
  return j.cands.map(c => {
    let n = 0, s2 = 0, s3 = 0, win = 0;
    for (let r = 0; r < j.n; r++) {
      const st = JSON.parse(j.st); st.rng = B.seeded((j.seed + r * 7919 + c.i * 104729) >>> 0);
      const u = st.units.find(x => x.key === j.key); if (!u) break;
      S.doAct(st, u, { kind: c.kind, target: c.tgt != null ? st.units.find(x => x.key === c.tgt) : undefined });
      for (let i = 0; i < 400; i++) { const v = S.step(st); if (!v) break; S.doAct(st, v, pol(st, v)); }
      const w = B.outcome(st) === 'win'; let ko = 0; for (const x of B.allies(st)) if (!x.alive) ko++;
      const stars = w ? Math.min(st.cycle > 8 ? 2 : 3, Math.max(1, 3 - ko)) : 0;
      n++; win += w; s2 += stars >= 2; s3 += stars === 3;
    }
    return { i: c.i, n, s2, s3, win };
  });
}
parentPort.on('message', ({ id, W, jobs, opt }) => {
  globalThis.__W = W;
  try {
    const k = JSON.stringify(W); if (k !== polKey) { polKey = k; pol = S.smartPol(W); }
    const out = jobs.map(j => {
      if (j.type === 'tower') return { fl: j.seeds.map(sd => S.tower(j.team, sd, pol, j.maxFl)) };
      if (j.type === 'roll') return roll(j);
      if (j.type === 'teach') return { samples: S.teach(j.fid, j.team, j.seed, globalThis.__W, j.opt || {}) };
      if (j.type === 'gw') return { dmg: j.seeds.map(sd => S.gw(j.team, sd, pol, j.boss)) };
      let n = 0, win = 0, s2 = 0, s3 = 0;
      for (const sd of j.seeds) for (const fid of j.fights) { const r = S.fight(fid, j.team, sd, pol, opt); n++; win += r.win; s2 += r.stars >= 2; s3 += r.stars === 3; }
      return { n, win, s2, s3 };
    });
    parentPort.postMessage({ id, out });
  } catch (e) { parentPort.postMessage({ id, err: String(e.stack || e) }); }
});
parentPort.postMessage({ ready: true });
