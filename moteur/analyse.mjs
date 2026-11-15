// Analyse rapide des equipes avec le moteur du jeu, en local et en multithread.
// Objectif par defaut : 2 etoiles minimum (victoire avec au plus 1 K.O.), departage par les 3 etoiles.
//   node analyse.mjs --mode boss              boss en Cauchemar Extreme
//   node analyse.mjs --mode nm3               combats a 3 ennemis en Cauchemar Extreme
//   node analyse.mjs --mode ext               boss en Extreme
//   options : --save sauvegarde.json (tes cartes et niveaux), --lv99 (tout au niveau 99), --top 30, --fils 11
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { W_DEFAUT } from './lib/sim.mjs';
import { dir as D } from './lib/chemins.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const MODE = arg('mode', 'boss'), TOP = +arg('top', 30), LV99 = !!arg('lv99', false);
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s]`, ...a);
const { G, B, version } = await loadEngine();
const CH = G.CHAR_BY_ID, R = { M: 'LR', L: 'UR', E: 'SSR' };
// Cartes : ta sauvegarde (export du script) ou toutes les SSR/UR/LR du jeu.
let save = null; const sp = arg('save', existsSync(D('data', 'sauvegarde.json')) ? D('data', 'sauvegarde.json') : null);
if (sp && sp !== true) save = JSON.parse(readFileSync(sp, 'utf8'));
const W = save?.W && save.W.nm ? save.W : W_DEFAUT;
const ids = (save ? Object.keys(save.owned || {}).map(Number) : Object.keys(CH).map(Number)).filter(i => ['M', 'L', 'E'].includes(CH[i]?.r));
const lvOf = id => LV99 || !save ? 99 : (save.lv?.[id]?.l || 1), stOf = id => save?.stars?.[id] || 0;
const team = t => t.map(id => ({ id, lv: lvOf(id), stars: stOf(id) }));
// Combats de reference
const fights = [];
for (const w of G.ALL_WORLDS) for (const f of w.fights) {
  if (MODE === 'boss' && f.boss) fights.push(f.id + '@xn');
  else if (MODE === 'ext' && f.boss) fights.push(f.id + '@x');
  else if (MODE === 'nm3') { const st = G.setupBattle(G.findFight(f.id + '@xn'), [{ id: ids[0], lv: 99, stars: 0 }], 1).st; if (B.enemies(st).length === 3) fights.push(f.id + '@xn'); }
}
const sample = (n, off = 0) => fights.filter((_, i) => i % Math.max(1, Math.round(fights.length / n)) === off % Math.max(1, Math.round(fights.length / n))).slice(0, n);
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
log(`moteur ${version}, mode ${MODE}, ${fights.length} combats, ${ids.length} cartes ${save ? '(ta collection' + (LV99 ? ', niveau 99)' : ', tes niveaux)') : '(tout le jeu, niveau 99)'}, ${pool.n} fils`);
const score = r => r.s2 * 1000 + r.s3; // 2 etoiles minimum d'abord, puis 3 etoiles
const evalTeams = async (teams, fl, seeds) => (await pool.runAll(teams.map(t => ({ team: team(t), fights: fl, seeds })), W, { stop2: true }, 4)).map((r, i) => ({ t: teams[i], ...r }));
// 1. Cartes seules (la carte x3) sur un echantillon
const s1 = await evalTeams(ids.map(id => [id, id, id]), sample(48), [1]);
s1.sort((a, b) => score(b) - score(a));
log(`etape 1 : ${ids.length} cartes testees seules`);
const top = s1.slice(0, TOP).map(x => x.t[0]);
// 2. Trios, elimination par tours (memes combats et memes tirages pour tous)
let cand = []; for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) for (let c = b + 1; c < top.length; c++) cand.push([top[a], top[b], top[c]]);
const rounds = [[sample(24, 1), [1], 0.15], [sample(64, 2), [1, 2], 0.25], [fights, [1, 2, 3], 1]];
let res = [];
for (const [fl, seeds, keep] of rounds) {
  res = await evalTeams(cand, fl, seeds); res.sort((a, b) => score(b) - score(a));
  log(`tour : ${cand.length} trios x ${fl.length} combats x ${seeds.length} tirages`);
  cand = res.slice(0, Math.max(20, Math.ceil(res.length * keep))).map(r => r.t);
}
const nom = id => `${CH[id].n} [${R[CH[id].r]}${save && !LV99 ? ' niv ' + lvOf(id) : ''}]`;
const pct = (x, n) => (100 * x / n).toFixed(1) + ' %';
console.log(`\nMeilleures cartes seules (${MODE}) :`); s1.slice(0, 10).forEach((x, i) => console.log(`${String(i + 1).padStart(2)}. ${nom(x.t[0])} : 2+ etoiles ${pct(x.s2, x.n)}`));
console.log(`\nMeilleurs trios (${MODE}, ${fights.length} combats x 3 tirages) :`);
res.slice(0, 10).forEach((x, i) => console.log(`${String(i + 1).padStart(2)}. ${x.t.map(nom).join(' / ')} : 2+ etoiles ${pct(x.s2, x.n)}, 3 etoiles ${pct(x.s3, x.n)}, victoire ${pct(x.win, x.n)}`));
mkdirSync(D('resultats'), { recursive: true });
const f = D('resultats', `${MODE}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`);
writeFileSync(f, 'rang;carte 1;carte 2;carte 3;2+ etoiles;3 etoiles;victoire\n' + res.slice(0, 50).map((x, i) => [i + 1, ...x.t.map(id => CH[id].n), pct(x.s2, x.n), pct(x.s3, x.n), pct(x.win, x.n)].join(';')).join('\n'));
log(`termine, resultats dans ${f}`);
await pool.close(); process.exit(0);
