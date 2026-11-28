// Telecharge le moteur du jeu (fichiers JS du site) dans moteur/engine/<version>/.
// Ces fichiers appartiennent au jeu : ils restent sur ton PC et ne vont JAMAIS dans le depot (.gitignore).
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
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
const domPage = [...start].find(p => /\/dom-[^/]+\.js$/.test(p)) || '';
// 5.61 : depuis la maj du jeu du 28/11, dom-*.js n'est plus le moteur (petit module graphique) : le moteur est dans un autre fichier
// (clock-*.js ce jour-la), au nom imprevisible. On le reconnait a son CONTENU : le fichier charge au demarrage qui definit
// setupBattle, ALL_WORLDS et enemyAct (dom-*.js d'abord, app-*.js en dernier car il ne fait que s'en servir). La version du moteur
// devient l'empreinte de CE fichier (8 caracteres a la fin du nom) : elle change a chaque patch des regles, pas a chaque retouche
// graphique. Les moteurs deja telecharges (manifeste avec dom-*.js) restent lisibles tels quels.
const estMoteur = code => /\bsetupBattle\b/.test(code) && /\bALL_WORLDS\b/.test(code) && /\benemyAct\b/.test(code) && code.length > 200000;
const empreinte = f => path.basename(f, '.js').slice(-8);
const cleDepart = [...start].sort().join('|');
// Deja telecharge ? meme liste de fichiers de depart (nouveau manifeste), ou ancien dossier nomme d'apres dom-*.js.
for (const v of existsSync(D('engine')) ? readdirSync(D('engine')) : []) {
  let man = null; try { man = JSON.parse(readFileSync(D('engine', v, 'manifest.json'), 'utf8')); } catch { continue; }
  const ancien = !man.depart && domPage && man.dom === path.basename(domPage) && estMoteurFichier(D('engine', v, 'assets', man.dom));
  if (man.depart === cleDepart || ancien) {
    console.log(`Moteur ${v} deja present.`);
    if (!existsSync(D('engine', v, 'resume.json'))) { try { const { loadEngine } = await import('./lib/charger.mjs'), { enregistrer } = await import('./lib/resume.mjs'); const { G, B } = await loadEngine(v); enregistrer(G, B, v, null); } catch {} }
    process.exit(0);
  }
}
function estMoteurFichier(f) { try { return estMoteur(readFileSync(f, 'utf8')); } catch { return false; } }
// Telechargement dans un dossier provisoire, renomme quand le moteur est reconnu.
const tmp = D('engine', '_telechargement');
await mkdir(path.join(tmp, 'assets'), { recursive: true });
await writeFile(path.join(tmp, 'index.html'), html);
const seen = new Set(), queue = [...start], codes = new Map();
while (queue.length) {
  const p = queue.shift(); if (seen.has(p)) continue; seen.add(p);
  const f = path.join(tmp, 'assets', path.basename(p));
  const code = existsSync(f) ? await readFile(f, 'utf8') : await get(ROOT + p);
  if (!existsSync(f)) { await writeFile(f, code); console.log(`  ${path.basename(p)} (${Math.round(code.length / 1024)} Ko)`); }
  if (start.has(p)) codes.set(p, code);
  const dir = path.posix.dirname(p);
  for (const m of code.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'`]([^"'`]+\.js)["'`]/g)) {
    const s = m[1]; const abs = s.startsWith('/') ? s : path.posix.normalize(path.posix.join(dir, s));
    if (abs.startsWith('/assets/') && !seen.has(abs)) queue.push(abs);
  }
}
const candidats = [...codes.keys()].filter(p => estMoteur(codes.get(p)));
const rang = p => /\/dom-[^/]+\.js$/.test(p) ? 0 : /\/app-[^/]+\.js$/.test(p) ? 2 : 1;
const moteur = candidats.sort((a, b) => rang(a) - rang(b) || codes.get(b).length - codes.get(a).length)[0] || domPage;
if (!moteur) throw new Error('moteur du jeu introuvable dans les fichiers de depart de kitsu.games');
const ver = empreinte(moteur), out = D('engine', ver), dom = moteur;
if (existsSync(out)) {
  // Meme moteur, autres fichiers autour (maj graphique) : on complete le dossier existant.
  await mkdir(path.join(out, 'assets'), { recursive: true });
  for (const f of readdirSync(path.join(tmp, 'assets'))) if (!existsSync(path.join(out, 'assets', f))) renameSync(path.join(tmp, 'assets', f), path.join(out, 'assets', f));
  renameSync(path.join(tmp, 'index.html'), path.join(out, 'index.html')); rmSync(tmp, { recursive: true, force: true });
} else renameSync(tmp, out);
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ version: ver, dom: path.basename(dom), domPage: path.basename(domPage), depart: cleDepart, files: [...seen].map(p => path.basename(p)), date: new Date().toISOString() }, null, 2));
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
