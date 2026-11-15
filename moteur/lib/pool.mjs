// Pool de fils : un par coeur logique moins un (11 sur un Ryzen 5 5600X), priorite basse.
import { Worker } from 'node:worker_threads';
import os from 'node:os';
export async function makePool(n = Math.max(1, (os.availableParallelism?.() || os.cpus().length) - 1), version) {
  try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  const ws = await Promise.all(Array.from({ length: n }, () => new Promise((res, rej) => { const w = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { version } }); w.once('message', m => m.ready ? res(w) : rej(m)); w.once('error', rej); })));
  let seq = 0; const wait = {}; const idle = [...ws]; const queue = [];
  for (const w of ws) w.on('message', m => { const r = wait[m.id]; delete wait[m.id]; idle.push(w); pump(); m.err ? r.rej(new Error(m.err)) : r.res(m.out); });
  const pump = () => { while (idle.length && queue.length) { const w = idle.pop(), t = queue.shift(); wait[t.id] = t; w.postMessage({ id: t.id, W: t.W, jobs: t.jobs, opt: t.opt }); } };
  const run = (jobs, W, opt) => new Promise((res, rej) => { queue.push({ id: ++seq, jobs, W, opt, res, rej }); pump(); });
  // Decoupe en paquets pour equilibrer la charge entre les fils.
  const runAll = async (jobs, W, opt, size = 8) => { const parts = []; for (let i = 0; i < jobs.length; i += size) parts.push(run(jobs.slice(i, i + size), W, opt)); return (await Promise.all(parts)).flat(); };
  return { n, runAll, close: () => Promise.all(ws.map(w => w.terminate())) };
}
