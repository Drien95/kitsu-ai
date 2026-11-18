// Serveur d'essai sur 127.0.0.1 (base en memoire, perdue a l'arret) : pour tester le partage sans Cloudflare.
//   node partage/serveur-local.mjs [port]     puis KITSU_PARTAGE_URL=http://127.0.0.1:<port> pour le moteur
import http from 'node:http';
import worker from './src/index.js';
import { envTest } from './imitation.mjs';
const env = envTest({ LOTS_PAR_JOUR_NOUVEAU: '1000' }), PORT = +(process.argv[2] || 47200);
http.createServer(async (q, s) => {
  const parts = []; for await (const c of q) parts.push(c); const b = Buffer.concat(parts);
  const r = await worker.fetch(new Request('http://x' + q.url, { method: q.method, headers: q.headers, body: b.length ? b : undefined }), env, { waitUntil() {} });
  s.writeHead(r.status, Object.fromEntries(r.headers)); s.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log('base commune d essai sur http://127.0.0.1:' + PORT));
