// Outils communs aux calculs IA : sauvegarde, reglages de l'IA, equipes de la derniere analyse, combats.
import { archiverPoids, reglagesAnalyse } from './historique.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dir as D } from './chemins.mjs';
import { W_DEFAUT } from './sim.mjs';
export const readJ = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
export const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
export const T0 = Date.now();
export const log = (...a) => console.log(`[${String(Math.round((Date.now() - T0) / 1000)).padStart(5)} s]`, ...a);
export const SAVE = readJ(D('data', 'sauvegarde.json')) || {};
export const POIDS = readJ(D('data', 'poids.json')) || {};
export const W0 = { ...W_DEFAUT, ...(POIDS.W || (SAVE.W?.nm ? SAVE.W : {})) }; delete W0.equipes;
// Pour les conseils et analyses : avec les reglages propres a chaque equipe.
export const WA = reglagesAnalyse(SAVE, W_DEFAUT).W;
export const DERNIER = readJ(D('resultats', 'dernier.json'));
export const lvOf = id => SAVE.lv?.[id]?.l || (SAVE.owned ? 1 : 99), stOf = id => SAVE.stars?.[id] || 0;
export const team = (t, lv = lvOf) => t.map(id => ({ id, lv: typeof lv === 'function' ? lv(id) : lv, stars: stOf(id), ...(SAVE.lk?.[id] ? { lk: SAVE.lk[id] } : {}) }));
export const shuffle = (a, s = 11) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function topTeams(cats, n = 4) {
  const m = DERNIER?.modes?.actuel || DERNIER?.modes?.['99'] || {}, out = new Map();
  for (const c of cats) for (const x of (m[c]?.top || []).slice(0, 3)) out.set(x.ids.slice().sort().join(), x.ids);
  if (!out.size && SAVE.team?.length === 3) out.set('a', SAVE.team.map(Number));
  return [...out.values()].slice(0, n);
}
export function fightSets(G, B) {
  const all = [], boss = [], multi = [];
  for (const w of G.ALL_WORLDS) for (const f of w.fights) { all.push(f.id); if (f.boss) boss.push(f.id); }
  for (const f of all) { if (boss.includes(f)) continue; try { if (B.enemies(G.setupBattle(G.findFight(f + '@xn'), [{ id: 3180, lv: 99, stars: 0 }], 1).st).length >= 2) multi.push(f); } catch {} }
  return { nmBoss: boss.map(f => f + '@xn'), nmMulti: multi.map(f => f + '@xn'), extBoss: boss.map(f => f + '@x'), camp: all.map(f => f + '@x') };
}
export function ecrire(nom, data) { mkdirSync(D('resultats'), { recursive: true }); writeFileSync(D('resultats', nom), JSON.stringify(data, null, 1)); }
export function majPoids(patch, raison = 'imitation') { mkdirSync(D('data'), { recursive: true }); archiverPoids(raison); const p = { ...(readJ(D('data', 'poids.json')) || {}), ...patch, restaure: undefined, t: Date.now() }; writeFileSync(D('data', 'poids.json'), JSON.stringify(p, null, 1)); return p; }
// Combats disputes : ceux ou l'equipe ne fait pas 3 etoiles a coup sur (les autres n'apprennent rien).
export async function disputes(pool, W, tm, fights, n, seeds = [1, 2]) {
  const r = await pool.runAll(fights.map(f => ({ team: tm, fights: [f], seeds })), W, {}, 20);
  return fights.filter((f, i) => r[i].s3 < seeds.length && r[i].win > 0).slice(0, n);
}
export async function score(pool, W, teams, fights, seeds) {
  const r = await pool.runAll(teams.flatMap(t => fights.map(f => ({ team: t, fights: [f], seeds }))), W, { stop2: true }, 16);
  const n = r.reduce((a, x) => a + x.n, 0); return { s2: r.reduce((a, x) => a + x.s2, 0) / n, s3: r.reduce((a, x) => a + x.s3, 0) / n, n };
}
