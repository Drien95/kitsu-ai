// KitsuAI, panneau local et serveur du conseil en combat.
// - http://127.0.0.1:47123/        panneau (etat, analyses, entrainement, resultats, sauvegarde, journal)
// - POST /conseil                  conseil en combat demande par le script (anticipation sur tous les coeurs)
// - GET  /ping, GET /poids         etat et reglages de l'IA entrainee ici, pour le script
// Ecoute seulement sur cette machine. Les actions du panneau exigent le jeton de la page (aucun autre site ne peut les lancer).
import http from 'node:http';
import os from 'node:os';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { spawn, exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { dir as D, DATA, CODE } from './lib/chemins.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.KITSU_PORT || 47123), TOKEN = randomBytes(16).toString('hex');
let ENG = await loadEngine(), MAN = JSON.parse(readFileSync(D('engine', ENG.version, 'manifest.json'), 'utf8'));
const NCPU = os.availableParallelism?.() || os.cpus().length;
let pool = await makePool(Math.max(1, NCPU - 1));
const T0 = Date.now(); let nConseil = 0, lastConseil = null;
let scriptVu = null;
const scriptFile = () => [path.join(CODE, '..', 'kitsu_ai.user.js'), path.join(CODE, 'kitsu_ai.user.js')].find(f => existsSync(f));
function scriptInfo() { const f = scriptFile(); if (!f) return { trouve: false, vu: scriptVu }; const t = readFileSync(f, 'utf8'); return { trouve: true, version: (t.match(/@version\s+(\S+)/) || [])[1], taille: t.length, lignes: t.split('\n').length, vu: scriptVu, url: 'https://github.com/Drien95/kitsu-ai/releases/latest/download/kitsu_ai.user.js' }; }
const logs = []; const say = m => { const l = `[${new Date().toLocaleTimeString('fr-FR')}] ${m}`; logs.push(l); if (logs.length > 300) logs.shift(); console.log(l); };
// ---------- taches (une a la fois : elles utilisent tout le processeur) ----------
const ACTIONS = {
  telecharger: { nom: 'Mettre a jour le moteur du jeu', cmd: ['telecharger.mjs'] },
  tout: { nom: 'Analyse complete', cmd: ['tout.mjs'], opts: o => [...(o.niveaux ? ['--niveaux', o.niveaux] : []), ...(o.tirages ? ['--tirages', String(o.tirages)] : []), ...(o.cartes ? ['--cartes', String(o.cartes)] : []), ...(o.max ? ['--max', String(o.max)] : [])] },
  mode: { nom: 'Analyse par mode', cmd: ['analyse.mjs'], opts: o => ['--mode', o.mode || 'boss', ...(o.lv99 ? ['--lv99'] : []), '--top', String(o.top || 30)] },
  entrainer: { nom: "Entrainement de l'IA", cmd: ['entrainer.mjs'], opts: o => ['--types', o.types || 'nm,boss,norm', '--generations', String(o.generations || 40)] },
  plafond: { nom: 'Mesure du plafond', cmd: ['plafond.mjs'], opts: o => ['--n', String(o.n || 10), '--k', String(o.k || 6), '--r', String(o.r || 20)] },
  bench: { nom: 'Mesure de vitesse', cmd: ['bench.mjs'] },
};
// Chaine complete : moteur a jour, entrainement de l'IA, puis analyse complete avec les nouveaux reglages.
const CHAINES = { complet: { nom: 'Tout lancer', etapes: [['telecharger', {}], ['entrainer', { types: 'nm,boss,norm', generations: 40 }], ['tout', { niveaux: 'actuel,99' }]] } };
let job = null; const history = [];
function lancer(action, o = {}) {
  if (job && !job.fin) throw new Error('une tache tourne deja : ' + job.nom);
  if (CHAINES[action]) return lancerChaine(action, o);
  return lancerEtape(action, o);
}
function lancerChaine(action, o) {
  const C = CHAINES[action], etapes = C.etapes.map(([a, d]) => [a, { ...d, ...(o[a] || {}) }]);
  const chaine = { nom: C.nom, etapes: etapes.map(([a]) => ACTIONS[a].nom), i: 0, debut: Date.now(), lignes: [], arretee: false };
  const suivante = () => {
    if (chaine.arretee || chaine.i >= etapes.length) { chaine.fin = Date.now(); job = { ...job, nom: C.nom, fin: chaine.fin, code: chaine.arretee ? 1 : 0, chaine }; say(`${C.nom} : ${chaine.arretee ? 'arretee' : 'terminee'} (${Math.round((chaine.fin - chaine.debut) / 1000)} s)`); return; }
    const [a, d] = etapes[chaine.i];
    lancerEtape(a, d, code => { if (code !== 0) chaine.arretee = true; chaine.i++; suivante(); }, chaine);
  };
  say(`${C.nom} : ${chaine.etapes.join(', puis ')}`);
  suivante(); return job.id;
}
function lancerEtape(action, o = {}, apres = null, chaine = null) {
  const A = ACTIONS[action]; if (!A) throw new Error('action inconnue');
  const fils = Math.max(1, NCPU - 2); // un fil reste libre pour le conseil en combat
  const args = [...A.cmd, ...(A.opts ? A.opts(o) : []), ...(['tout', 'mode', 'entrainer'].includes(action) ? ['--fils', String(fils)] : [])];
  const p = spawn(process.execPath, args, { cwd: here });
  const prev = chaine && job ? job.lignes : [];
  job = { id: Date.now(), action, nom: chaine ? `${chaine.nom} (${chaine.i + 1}/${chaine.etapes.length} : ${A.nom})` : A.nom, args: args.join(' '), debut: chaine ? chaine.debut : Date.now(), lignes: chaine ? [...prev, `=== ${A.nom} ===`] : [], fin: null, code: null, proc: p, chaine };
  const add = d => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) { job.lignes.push(l); if (job.lignes.length > 2000) job.lignes.shift(); } };
  p.stdout.on('data', add); p.stderr.on('data', add);
  p.on('close', async code => { if (apres && !(chaine && chaine.arretee)) { history.unshift({ nom: A.nom, debut: Date.now(), fin: Date.now(), code }); return apres(code); } job.fin = Date.now(); job.code = code; history.unshift({ nom: job.nom, debut: job.debut, fin: job.fin, code }); history.length = Math.min(history.length, 20); say(`${job.nom} : termine (${Math.round((job.fin - job.debut) / 1000)} s, code ${code})`);
    if (action === 'telecharger') { try { const v = readFileSync(D('engine', 'current.txt'), 'utf8').trim(); if (v !== ENG.version) { say(`nouveau moteur ${v} : redemarre le panneau (KitsuAI.bat) pour l'utiliser dans le conseil en combat`); } } catch {} } });
  say(`${A.nom} : lance (${args.join(' ')})`);
  return job.id;
}
// ---------- conseil en combat ----------
async function conseil({ st, key, cands, W, budget = 700 }) {
  const t0 = Date.now(), stats = cands.map((c, i) => ({ ...c, i, n: 0, s2: 0, s3: 0, win: 0 }));
  const val = r => (r.s2 + 0.5 * r.s3 + 0.2 * r.win) / Math.max(1, r.n);
  let alive = stats.slice(), seed = (Math.random() * 1e9) >>> 0, round = 0;
  const parts = job && !job.fin ? 1 : Math.max(1, Math.min(pool.n, 8));
  while (alive.length) {
    const per = round === 0 ? 24 : 16;
    const jobs = []; for (let p = 0; p < parts; p++) jobs.push({ type: 'roll', st, key, cands: alive.map(c => ({ i: c.i, kind: c.kind, tgt: c.tgt })), n: Math.ceil(per / parts), seed: seed + p * 1000003 + round * 7 });
    const res = await pool.runAll(jobs, W, {}, 1);
    for (const part of res) for (const r of part) { const a = stats[r.i]; a.n += r.n; a.s2 += r.s2; a.s3 += r.s3; a.win += r.win; }
    round++;
    if (Date.now() - t0 > budget || round >= 12) break;
    const best = Math.max(...alive.map(val)); alive = alive.filter(r => best - val(r) < 0.12 + 0.6 / Math.sqrt(r.n));
    if (alive.length < 2) break;
  }
  const out = stats.map(r => ({ kind: r.kind, tgt: r.tgt, n: r.n, s2: r.s2 / Math.max(1, r.n), s3: r.s3 / Math.max(1, r.n), win: r.win / Math.max(1, r.n), v: val(r) })).sort((a, b) => b.v - a.v);
  return { ms: Date.now() - t0, sims: stats.reduce((a, r) => a + r.n, 0), res: out };
}
// ---------- etat ----------
const readJ = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
function etat() {
  const sv = readJ(D('data', 'sauvegarde.json')), pw = readJ(D('data', 'poids.json'));
  const CH = ENG.G.CHAR_BY_ID, own = Object.keys(sv?.owned || {}).map(Number);
  const res = existsSync(D('resultats')) ? readdirSync(D('resultats')).filter(f => /\.(csv|json|txt)$/.test(f) && f !== 'dernier.json').map(f => ({ f, t: statSync(D('resultats', f)).mtimeMs, o: statSync(D('resultats', f)).size })).sort((a, b) => b.t - a.t) : [];
  let disque = null; try { disque = readFileSync(D('engine', 'current.txt'), 'utf8').trim(); } catch {}
  return {
    moteur: ENG.version, moteurDisque: disque, mondes: ENG.G.ALL_WORLDS.map(w => `${w.id} (${w.fights.length})`), cartes: Object.keys(CH).length,
    cpu: os.cpus()[0]?.model, coeurs: NCPU, fils: pool.n, memoire: Math.round(os.totalmem() / 2 ** 30), uptime: Math.round((Date.now() - T0) / 1000),
    conseil: { n: nConseil, dernier: lastConseil }, port: PORT,
    sauvegarde: sv ? { t: sv.t, script: sv.script, cartes: own.length, lr: own.filter(i => CH[i]?.r === 'M').length, ur: own.filter(i => CH[i]?.r === 'L').length, ssr: own.filter(i => CH[i]?.r === 'E').length, equipe: (sv.team || []).map(i => CH[i]?.n), guilde: sv.guild?.boss ? `${sv.guild.boss.name} niv ${sv.guild.boss.lv}` : null, compte: sv.acct?.lv } : null,
    poids: pw ? { t: pw.t, gains: pw.gains } : null,
    job: job ? { id: job.id, nom: job.nom, args: job.args, debut: job.debut, fin: job.fin, code: job.code, lignes: job.lignes.slice(-400), chaine: job.chaine ? { etapes: job.chaine.etapes, i: job.chaine.i } : null } : null,
    script: scriptInfo(), appVersion: process.env.KITSU_APP_VERSION || null,
    historique: history, resultats: res.slice(0, 40), journal: logs.slice(-60),
    dernier: readJ(D('resultats', 'dernier.json')),
  };
}
// ---------- serveur HTTP ----------
const body = req => new Promise((res, rej) => { let b = ''; req.on('data', d => { b += d; if (b.length > 8e6) { req.destroy(); rej(new Error('trop gros')); } }); req.on('end', () => res(b)); });
const send = (res, code, obj, type = 'application/json', extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra }); res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)); };
const CORS = { 'Access-Control-Allow-Origin': 'https://kitsu.games', 'Access-Control-Allow-Headers': 'Content-Type' };
const own = req => req.headers['x-kitsu-token'] === TOKEN && (!req.headers.origin || req.headers.origin === `http://127.0.0.1:${PORT}`);
http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain', CORS);
    // Pour le script du jeu
    if (u.pathname === '/ping') { if (u.searchParams.get('v')) scriptVu = { v: u.searchParams.get('v'), t: Date.now() }; } if (u.pathname === '/ping') return send(res, 200, { ok: true, version: ENG.version, dom: MAN.dom, fils: pool.n, poidsT: readJ(D('data', 'poids.json'))?.t || 0 }, 'application/json', CORS);
    if (u.pathname === '/poids') { const p = readJ(D('data', 'poids.json')); return send(res, p ? 200 : 404, p || {}, 'application/json', CORS); }
    if (u.pathname === '/conseil' && req.method === 'POST') {
      const q = JSON.parse(await body(req));
      if (q.dom && q.dom !== MAN.dom) return send(res, 409, { err: 'version', attendu: q.dom, moteur: MAN.dom }, 'application/json', CORS);
      const r = await conseil(q); nConseil++; lastConseil = { t: Date.now(), ms: r.ms, sims: r.sims };
      return send(res, 200, r, 'application/json', CORS);
    }
    // Panneau
    if (u.pathname === '/' || u.pathname === '/index.html') return send(res, 200, readFileSync(path.join(here, 'panneau', 'index.html'), 'utf8').replace('__TOKEN__', TOKEN), 'text/html; charset=utf-8');
    if (u.pathname.startsWith('/api/')) {
      if (!own(req)) return send(res, 403, { err: 'jeton invalide (recharge le panneau)' });
      if (u.pathname === '/api/etat') return send(res, 200, etat());
      if (u.pathname === '/api/lancer' && req.method === 'POST') { const q = JSON.parse(await body(req)); return send(res, 200, { id: lancer(q.action, q.options || {}) }); }
      if (u.pathname === '/api/arreter' && req.method === 'POST') { if (job && !job.fin) { if (job.chaine) job.chaine.arretee = true; job.proc.kill(); say(job.nom + ' : arrete'); } return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/script') return send(res, 200, scriptInfo(false));
      if (u.pathname === '/api/script/code') { const f = scriptFile(); return send(res, f ? 200 : 404, f ? readFileSync(f, 'utf8') : 'introuvable', 'text/plain; charset=utf-8'); }
      if (u.pathname === '/api/ouvrir' && req.method === 'POST') { const url = JSON.parse(await body(req)).url; if (/^https:\/\/(github\.com\/Drien95\/kitsu-ai|kitsu\.games|www\.tampermonkey\.net)\b/.test(url)) exec(process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/resultat') { const f = path.basename(u.searchParams.get('f') || ''); const p = D('resultats', f); if (!existsSync(p)) return send(res, 404, { err: 'introuvable' }); return send(res, 200, readFileSync(p), /\.json$/.test(f) ? 'application/json' : 'text/plain; charset=utf-8'); }
      if (u.pathname === '/api/sauvegarde' && req.method === 'POST') { const b = await body(req); const j = JSON.parse(b); if (!j.owned || !j.lv) return send(res, 400, { err: "ce n'est pas un export KitsuAI" }); mkdirSync(D('data'), { recursive: true }); writeFileSync(D('data', 'sauvegarde.json'), b); say(`sauvegarde importee (${Object.keys(j.owned).length} cartes)`); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/dossier' && req.method === 'POST') { const d = { resultats: 'resultats', data: 'data', moteur: '.' }[JSON.parse(await body(req)).d] || '.'; const p = D(d); mkdirSync(p, { recursive: true }); exec(process.platform === 'win32' ? `explorer "${p}"` : `xdg-open "${p}"`); return send(res, 200, { ok: true }); }
      if (u.pathname === '/api/redemarrer-pool' && req.method === 'POST') { await pool.close(); ENG = await loadEngine(); MAN = JSON.parse(readFileSync(D('engine', ENG.version, 'manifest.json'), 'utf8')); pool = await makePool(Math.max(1, NCPU - 1), ENG.version); say(`moteur recharge : ${ENG.version}`); return send(res, 200, { ok: true, version: ENG.version }); }
    }
    send(res, 404, { err: 'introuvable' });
  } catch (e) { send(res, 500, { err: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => {
  say(`panneau KitsuAI : http://127.0.0.1:${PORT}  (moteur ${ENG.version}, ${pool.n} fils)`);
  if (process.argv.includes('--ouvrir')) exec(process.platform === 'win32' ? `start "" http://127.0.0.1:${PORT}/` : `xdg-open http://127.0.0.1:${PORT}/`);
});
