// Charge le moteur du jeu dans Node, avec le minimum d'objets du navigateur simules.
import { readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dir as D } from './chemins.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
export const engineDir = ver => D('engine', ver || readFileSync(D('engine', 'current.txt'), 'utf8').trim());
function shim() {
  const g = globalThis; if (g.__kitsuShim) return; g.__kitsuShim = 1;
  const store = new Map();
  const ls = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear(), key: i => [...store.keys()][i] ?? null, get length() { return store.size; } };
  const el = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'style' || k === 'dataset' || k === 'classList' ? new Proxy({}, { get: () => () => {} }) : el(), apply: () => el(), set: () => true });
  const doc = { hidden: true, head: el(), body: el(), documentElement: el(), querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, getElementsByTagName: () => [], createElement: () => el(), createTreeWalker: () => ({ nextNode: () => null }), addEventListener() {}, removeEventListener() {}, createTextNode: () => el() };
  g.window = g; g.self = g; g.document = doc; g.localStorage = ls; g.sessionStorage = ls;
  try { Object.defineProperty(g, 'navigator', { value: { language: 'fr-FR', languages: ['fr-FR'], vibrate() {}, userAgent: 'node' }, configurable: true }); } catch {}
  g.location = { href: 'https://kitsu.games/', search: '', pathname: '/', hash: '', origin: 'https://kitsu.games', replace() {}, reload() {} };
  g.addEventListener = () => {}; g.removeEventListener = () => {}; g.dispatchEvent = () => true;
  g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  g.requestAnimationFrame = f => setTimeout(f, 16); g.cancelAnimationFrame = clearTimeout;
  g.Image = function () { return el(); }; g.Audio = function () { return el(); };
  g.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
}
// 5.33 : collectifs du trio calcules une fois. A chaque combat, setupBattle recalcule les collectifs actifs du trio en
// parcourant toute la liste des collectifs du jeu (21 a 30 % du temps d'un combat coupe tot). Le resultat ne depend que des
// cartes (dans l'ordre de l'equipe) et des collectifs choisis (lk) : on charge une copie du fichier du moteur ou cette
// fonction garde ses resultats deja calcules. Meme entree, meme objet rendu, lu sans etre modifie : combats identiques
// (verifie par tests.mjs contre le moteur sans copie). Si la fonction n'est plus reconnue (patch du jeu), moteur normal.
// KITSU_SANS_MEMO=1 : moteur normal.
const MEMO_V = '/*kitsuai-memo-collectifs v1*/';
export function memoriserCollectifs(src) {
  const fin = src.search(/return\{active:\w+,kept:\w+,dropped:\w+\}\}/), debut = fin < 0 ? -1 : src.lastIndexOf('function ', fin);
  const sig = debut < 0 ? null : src.slice(debut).match(/^function (\w+)\((\w+),(\w+)=\{\}\)\{/);
  if (!sig || src.indexOf('return{active:', fin + 1) >= 0) return null; // introuvable, ou plusieurs candidates : on ne touche a rien
  const corps = src.slice(debut, src.indexOf('}}', fin) + 2), nom = sig[1];
  if (corps.slice(9).includes('function ')) return null;
  const memo = `function ${nom}(a,b={}){const k=a.join(',')+'|'+JSON.stringify(b);let r=${nom}.__m.get(k);if(r===undefined){r=${nom}__orig(a,b);if(${nom}.__m.size>20000)${nom}.__m.clear();${nom}.__m.set(k,r)}return r}${nom}.__m=new Map();`;
  return { nom, code: MEMO_V + src.slice(0, debut) + memo + corps.replace('function ' + nom + '(', 'function ' + nom + '__orig(') + src.slice(debut + corps.length) };
}
function fichierMemo(dir, dom) {
  if (process.env.KITSU_SANS_MEMO === '1') return null;
  try {
    const f = path.join(dir, 'assets', dom.replace(/\.js$/, '') + '.memo.js');
    if (existsSync(f) && readFileSync(f, 'utf8').startsWith(MEMO_V)) return path.basename(f);
    const m = memoriserCollectifs(readFileSync(path.join(dir, 'assets', dom), 'utf8')); if (!m) return null;
    const tmp = f + '.' + Math.random().toString(36).slice(2) + '.tmp'; writeFileSync(tmp, m.code); renameSync(tmp, f); return path.basename(f);
  } catch { return null; }
}
export async function loadEngine(ver) {
  shim();
  const dir = engineDir(ver), man = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const memo = fichierMemo(dir, man.dom); let m = null, avecMemo = null;
  if (memo) try { m = await import(pathToFileURL(path.join(dir, 'assets', memo)).href); avecMemo = memo; } catch { m = null; }
  if (!m) m = await import(pathToFileURL(path.join(dir, 'assets', man.dom)).href);
  // 5.61 : depuis la maj du 28/11, le moteur n'exporte plus G sous le nom « g » (noms minifies) : on prend l'objet qui a setupBattle et ALL_WORLDS.
  const vals = Object.values(m), estG = v => !!v && typeof v === 'object' && typeof v.setupBattle === 'function' && Array.isArray(v.ALL_WORLDS);
  const G = estG(m.g) ? m.g : vals.find(estG), B = globalThis.BattleCore || vals.find(v => v && typeof v === 'object' && 'act' in v && 'enemyAct' in v);
  if (!G || !B) throw new Error('moteur introuvable dans ' + man.dom);
  return { G, B, version: man.version, mod: m, memoCollectifs: avecMemo };
}
