// Charge le moteur du jeu dans Node, avec le minimum d'objets du navigateur simules.
import { readFileSync, existsSync } from 'node:fs';
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
export async function loadEngine(ver) {
  shim();
  const dir = engineDir(ver), man = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const m = await import(pathToFileURL(path.join(dir, 'assets', man.dom)).href);
  const G = m.g, B = globalThis.BattleCore || Object.values(m).find(v => v && typeof v === 'object' && 'act' in v && 'enemyAct' in v);
  if (!G || !B) throw new Error('moteur introuvable dans ' + man.dom);
  return { G, B, version: man.version, mod: m };
}
