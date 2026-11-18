// Met a jour le serveur de la base commune (Cloudflare) : migrations D1 pas encore passees, deploiement, nettoyage.
// Reserve au PC validateur (jeton admin dans data/partage.json) et lance depuis le launcher (Reglages, cadre validateur).
// Utilise wrangler deja connecte sur ce PC (npx wrangler@4 login, une fois). N'ajoute jamais de moyen de paiement :
// l'offre gratuite refuse au-dela des quotas, elle ne facture rien.
// Code du serveur : le dossier partage/ du depot si on est en mode developpeur, sinon celui de la version installee,
// telecharge depuis GitHub dans un dossier temporaire efface a la fin.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { CODE, dir as D } from './lib/chemins.mjs';
import { identite, reglagesPartage } from './lib/partage.mjs';
import { VERSION_SERVEUR } from './lib/partage-format.mjs';

const log = m => console.log(m), stop = m => { console.log('ARRET : ' + m); process.exit(1); };
if (!identite().admin) stop('reserve au PC validateur (pas de jeton admin dans data/partage.json)');
const WIN = process.platform === 'win32';
const npx = (args, cwd) => spawnSync(WIN ? 'npx.cmd' : 'npx', ['--yes', 'wrangler@4', ...args], { cwd, encoding: 'utf8', shell: WIN, env: { ...process.env, CI: '1' }, timeout: 300000 });
const sortie = r => `${r.stdout || ''}${r.stderr || ''}`.split(/\r?\n/).filter(l => l.trim()).slice(-25).join('\n');

// ---------- 1. code du serveur ----------
let dossier = path.join(CODE, '..', 'partage'), tmp = null;
if (!existsSync(path.join(dossier, 'wrangler.toml'))) {
  // La version installee (tag vX.Y.Z), sinon main ; on verifie ensuite que c'est bien le serveur que cette appli attend.
  const v = process.env.KITSU_APP_VERSION, get = ref => fetch(`https://codeload.github.com/Drien95/kitsu-ai/tar.gz/${ref}`, { signal: AbortSignal.timeout(60000) });
  let r = v ? await get(`refs/tags/v${v}`) : null; if (!r?.ok) r = await get('refs/heads/main');
  if (!r.ok) stop(`telechargement impossible (${r.status})`);
  log(`code du serveur : ${r.url.includes('/tags/') ? 'version ' + v : 'branche main'} depuis GitHub`);
  tmp = path.join(os.tmpdir(), 'kitsu-deploy-' + Date.now()); mkdirSync(tmp, { recursive: true });
  writeFileSync(path.join(tmp, 'code.tgz'), Buffer.from(await r.arrayBuffer()));
  const t = spawnSync('tar', ['-xzf', 'code.tgz'], { cwd: tmp, encoding: 'utf8' }); if (t.status !== 0) stop('archive illisible : ' + sortie(t));
  const racine = readdirSync(tmp).find(f => f.startsWith('kitsu-ai')); if (!racine) stop('archive inattendue');
  dossier = path.join(tmp, racine, 'partage');
  const vs = +(/VERSION_SERVEUR = (\d+)/.exec(readFileSync(path.join(tmp, racine, 'moteur', 'lib', 'partage-format.mjs'), 'utf8'))?.[1] || 0);
  if (vs !== VERSION_SERVEUR) { log(`le code telecharge est le serveur ${vs}, cette appli attend le ${VERSION_SERVEUR} : mets d'abord l'appli a jour`); rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
} else log('code du serveur : dossier partage/ du depot');
const fin = code => { if (tmp) try { rmSync(tmp, { recursive: true, force: true }); log('dossier temporaire efface'); } catch {} process.exit(code); };

// ---------- 2. migrations pas encore passees (retenues dans data/partage.json) ----------
const fId = D('data', 'partage.json'), id = JSON.parse(readFileSync(fId, 'utf8')), faites = new Set(id.migrations || []);
const migs = readdirSync(dossier).map(f => /^migration-(\d+)\.sql$/.exec(f)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b);
for (const n of migs) {
  if (faites.has(n)) continue;
  log(`migration ${n} ...`);
  const r = npx(['d1', 'execute', 'kitsu-partage', '--remote', '--file', `migration-${n}.sql`], dossier), txt = sortie(r);
  // Deja passee a la main (avant ce bouton) : la base repond que la colonne existe deja.
  if (r.status !== 0 && !/duplicate column|already exists/i.test(txt)) { log(txt); log(`migration ${n} : echec, rien n'est deploye`); fin(1); }
  log(r.status === 0 ? `migration ${n} : faite` : `migration ${n} : deja faite`);
  faites.add(n); writeFileSync(fId, JSON.stringify({ ...JSON.parse(readFileSync(fId, 'utf8')), migrations: [...faites].sort((a, b) => a - b) }, null, 1));
}

// ---------- 3. deploiement ----------
log('deploiement ...');
const d = npx(['deploy'], dossier); log(sortie(d));
if (d.status !== 0) { log('deploiement : echec (wrangler connecte ? sinon : npx wrangler@4 login)'); fin(1); }

// ---------- 4. verification ----------
try {
  const e = await (await fetch(reglagesPartage().url.replace(/\/$/, '') + '/v1/etat', { signal: AbortSignal.timeout(20000) })).json();
  log(`serveur en ligne : version ${e.serveur ?? 1} (attendue ${VERSION_SERVEUR}), ${e.joueurs} joueurs`);
  if ((e.serveur ?? 1) !== VERSION_SERVEUR) log('la nouvelle version peut mettre une minute a etre servie partout : rouvre Reglages pour verifier');
} catch (e) { log('verification impossible : ' + e.message); }
fin(0);
