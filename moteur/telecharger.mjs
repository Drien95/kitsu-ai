// Telecharge le moteur du jeu (fichiers JS du site) dans moteur/engine/<version>/.
// Ces fichiers appartiennent au jeu : ils restent sur ton PC et ne vont JAMAIS dans le depot (.gitignore).
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dir as D } from './lib/chemins.mjs';
const ROOT = 'https://kitsu.games';
const here = path.dirname(fileURLToPath(import.meta.url));
// Reessais (erreurs passageres du serveur, ex. 525 de Cloudflare) avec delai croissant, et 30 s max par fichier.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => {
  for (let k = 1; k <= 6; k++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'KitsuAI-moteur-local' }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return r.text();
      if (r.status === 404) throw new Error(`404 ${u}`);
      console.log(`  ${r.status} sur ${path.basename(u)}, nouvel essai ${k}/6`);
    } catch (e) { if (String(e.message).startsWith('404')) throw e; console.log(`  ${e.message} sur ${path.basename(u)}, nouvel essai ${k}/6`); }
    await sleep(1500 * k);
  }
  throw new Error(`Echec apres 6 essais : ${u} (relance le .bat, les fichiers deja recus sont gardes)`);
};
let html;
try { html = await get(ROOT + '/'); }
catch (e) {
  // Pas de connexion : on garde le moteur deja telecharge, s'il existe.
  if (existsSync(D('engine', 'current.txt'))) { console.log(`kitsu.games injoignable (${e.message}) : moteur actuel garde (${readFileSync(D('engine', 'current.txt'), 'utf8').trim()}).`); process.exit(0); }
  throw e;
}
const start = new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]));
const dom = [...start].find(p => /\/dom-[^/]+\.js$/.test(p)) || '';
const ver = (dom.match(/dom-([^/.]+)\.js/) || [, 'inconnue'])[1];
const out = D('engine', ver);
if (existsSync(path.join(out, 'manifest.json'))) { console.log(`Moteur ${ver} deja present.`); if (!existsSync(path.join(out, 'resume.json'))) { try { const { loadEngine } = await import('./lib/charger.mjs'), { enregistrer } = await import('./lib/resume.mjs'); const { G, B } = await loadEngine(ver); enregistrer(G, B, ver, null); } catch {} } process.exit(0); }
await mkdir(path.join(out, 'assets'), { recursive: true });
await writeFile(path.join(out, 'index.html'), html);
const seen = new Set(), queue = [...start];
while (queue.length) {
  const p = queue.shift(); if (seen.has(p)) continue; seen.add(p);
  const f = path.join(out, 'assets', path.basename(p));
  const code = existsSync(f) ? await readFile(f, 'utf8') : await get(ROOT + p);
  if (!existsSync(f)) { await writeFile(f, code); console.log(`  ${path.basename(p)} (${Math.round(code.length / 1024)} Ko)`); }
  const dir = path.posix.dirname(p);
  for (const m of code.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'`]([^"'`]+\.js)["'`]/g)) {
    const s = m[1]; const abs = s.startsWith('/') ? s : path.posix.normalize(path.posix.join(dir, s));
    if (abs.startsWith('/assets/') && !seen.has(abs)) queue.push(abs);
  }
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ version: ver, dom: path.basename(dom), files: [...seen].map(p => path.basename(p)), date: new Date().toISOString() }, null, 2));
const avant = existsSync(D('engine', 'current.txt')) ? readFileSync(D('engine', 'current.txt'), 'utf8').trim() : null;
await writeFile(D('engine', 'current.txt'), ver);
// Patch KITSU : resume de la nouvelle version et comparaison avec la precedente.
try {
  const { loadEngine } = await import('./lib/charger.mjs'), { enregistrer } = await import('./lib/resume.mjs');
  const { G, B } = await loadEngine(ver); const d = enregistrer(G, B, ver, avant);
  if (d) console.log(`Patch KITSU : ${d.nouvellesCartes.length} nouvelles cartes, ${d.cartesModifiees.length} cartes modifiees, ${d.nouveauxMondes.length} nouveaux mondes.`);
} catch (e) { console.log('resume du patch impossible : ' + e.message); }
console.log(`Moteur ${ver} telecharge : ${seen.size} fichiers dans ${out}`);
// 5.42 : on garde le nouveau moteur et le precedent (comparaison du patch) ; les plus anciens (~23 Mo chacun) sont supprimes.
if (avant && avant !== ver) try {
  const { readdirSync, rmSync, statSync } = await import('node:fs'); let n = 0, o = 0;
  const taille = d => { let t = 0; for (const f of readdirSync(d, { withFileTypes: true })) t += f.isDirectory() ? taille(path.join(d, f.name)) : statSync(path.join(d, f.name)).size; return t; };
  for (const d of readdirSync(D('engine'), { withFileTypes: true })) if (d.isDirectory() && d.name !== ver && d.name !== avant && existsSync(D('engine', d.name, 'manifest.json'))) { o += taille(D('engine', d.name)); rmSync(D('engine', d.name), { recursive: true, force: true }); n++; }
  if (n) console.log(`${n} ancien(s) moteur(s) supprime(s) (${(o / 1048576).toFixed(0)} Mo), ${avant} garde pour la comparaison`);
} catch (e) { console.log('anciens moteurs gardes (' + e.message + ')'); }
