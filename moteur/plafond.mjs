// Mesure du plafond : IA actuelle contre IA qui anticipe, memes combats, memes tirages.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { loadEngine } from './lib/charger.mjs';
import { makeSim, W_DEFAUT } from './lib/sim.mjs';
import { makeAnticipe } from './lib/anticipe.mjs';
import { dir as D } from './lib/chemins.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const { G, B } = await loadEngine(); const S = makeSim(G, B);
const SAVE = existsSync(D('data', 'sauvegarde.json')) ? JSON.parse(readFileSync(D('data', 'sauvegarde.json'), 'utf8')) : {};
const W = SAVE.W?.nm ? SAVE.W : W_DEFAUT, CH = G.CHAR_BY_ID;
const id = n => +Object.keys(CH).find(k => CH[k].n === n);
const teams = (arg('une') ? [['Kanki', 'Pain (Akatsuki)', 'Pain']] : [['Kanki', 'Pain (Akatsuki)', 'Pain'], ['Kanki', 'Tobi (Akatsuki)', 'Pain (Akatsuki)']]).map(t => t.map(id));
const N = +arg('n', 12), K = +arg('k', 3), R = +arg('r', 3);
const shuffle = (a, s = 7) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const boss = [], multi = []; for (const w of G.ALL_WORLDS) for (const f of w.fights) { const fid = f.id + '@xn'; if (f.boss) boss.push(fid); else { try { if (B.enemies(G.setupBattle(G.findFight(fid), [{ id: teams[0][0], lv: 99, stars: 0 }], 1).st).length >= 2) multi.push(fid); } catch {} } }
const run = (fid, team, sd, pol) => { const st = G.setupBattle(G.findFight(fid), team, sd).st; for (let i = 0; i < 400; i++) { const u = S.step(st); if (!u) break; S.doAct(st, u, pol(st, u)); } const win = B.outcome(st) === 'win'; let ko = 0; for (const x of B.allies(st)) if (!x.alive) ko++; const stars = win ? Math.min(st.cycle > 8 ? 2 : 3, Math.max(1, 3 - ko)) : 0; return stars; };
const polB = S.smartPol(W), polA = makeAnticipe(G, B, S, W, { K, R });
const lv = i => SAVE.lv?.[i]?.l || 99;
// Combats « disputes » : ceux ou l'IA actuelle ne fait pas 3 etoiles a coup sur avec l'une des deux equipes.
const hard = fl => { const o = []; for (const fid of shuffle(fl)) { if (o.length >= N) break; const bad = teams.some(t => { const tm = t.map(i => ({ id: i, lv: lv(i), stars: SAVE.stars?.[i] || 0 })); return [1, 2].some(sd => run(fid, tm, sd, polB) < 3); }); if (bad) o.push(fid); } return o; };
const sets = arg('multi') ? { 'Cauchemar 2 ennemis ou +': hard(multi) } : arg('boss') ? { 'Cauchemar boss': hard(boss) } : { 'Cauchemar boss': hard(boss), 'Cauchemar 2 ennemis ou +': hard(multi) };
const out = []; const t0 = Date.now();
for (const t of teams) for (const [nom, fl] of Object.entries(sets)) {
  const team = t.map(i => ({ id: i, lv: lv(i), stars: SAVE.stars?.[i] || 0 }));
  const a = { b2: 0, b3: 0, a2: 0, a3: 0, n: 0 };
  for (const fid of fl) for (const sd of [1, 2]) { const sb = run(fid, team, sd, polB), sa = run(fid, team, sd, polA); a.n++; a.b2 += sb >= 2; a.b3 += sb === 3; a.a2 += sa >= 2; a.a3 += sa === 3; }
  const p = x => (100 * x / a.n).toFixed(0) + ' %';
  const line = `${t.map(i => CH[i].n).join(' / ')} | ${nom} | IA actuelle : 2+ ${p(a.b2)}, 3 ${p(a.b3)} | IA qui anticipe : 2+ ${p(a.a2)}, 3 ${p(a.a3)} | ${a.n} combats`;
  console.log(line); out.push(line); mkdirSync(D('resultats'), { recursive: true }); writeFileSync(D('resultats', 'plafond.txt'), out.join('\n') + `\n(${Math.round((Date.now() - t0) / 1000)} s, K=${K}, R=${R})\n`);
}
console.log('fini en', Math.round((Date.now() - t0) / 1000), 's'); process.exit(0);
