import { loadEngine } from './lib/charger.mjs';
const t0 = Date.now();
setTimeout(() => { console.log('TIMEOUT import non resolu apres', Date.now() - t0, 'ms'); process.exit(2); }, 40000);
const origFetch = globalThis.fetch; globalThis.fetch = async (u, o) => { console.log('fetch', String(u).slice(0, 100)); throw new Error('offline'); };
try {
  const { G, B, version } = await loadEngine();
  console.log('version', version, 'charge en', Date.now() - t0, 'ms');
  console.log('mondes', G.ALL_WORLDS?.map(w => w.id + ':' + w.fights.length).join(' '));
  console.log('CHAR_BY_ID', Object.keys(globalThis.CHAR_BY_ID || {}).length, 'B', Object.keys(B).length);
} catch (e) { console.log('ERREUR', e.stack?.slice(0, 600)); }
process.exit(0);
