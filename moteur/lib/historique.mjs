// Copies des reglages de l'IA (data/poids.json) : une copie avant chaque changement, les 15 dernieres sont gardees.
// Permet de revenir aux reglages precedents depuis le panneau (Reglages).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { dir as D } from './chemins.mjs';
const H = () => D('data', 'poids-historique'), P = () => D('data', 'poids.json'), GARDER = 15;
const lire = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
let fait = false;
// A appeler avant d'ecrire poids.json. Une seule copie par calcul (le premier etat avant la run).
export function archiverPoids(raison = 'calcul') {
  if (fait || !existsSync(P())) return null; fait = true;
  const p = lire(P()); if (!p) return null;
  mkdirSync(H(), { recursive: true });
  const f = `poids-${Date.now()}.json`; writeFileSync(D('data', 'poids-historique', f), JSON.stringify({ ...p, archive: { t: Date.now(), raison } }, null, 1));
  const tous = readdirSync(H()).filter(x => /^poids-\d+\.json$/.test(x)).sort();
  for (const x of tous.slice(0, Math.max(0, tous.length - GARDER))) { try { unlinkSync(D('data', 'poids-historique', x)); } catch {} }
  return f;
}
export function listerPoids() {
  if (!existsSync(H())) return [];
  return readdirSync(H()).filter(x => /^poids-\d+\.json$/.test(x)).sort().reverse().map(f => {
    const p = lire(D('data', 'poids-historique', f)) || {};
    return { f, archive: p.archive?.t || +f.match(/\d+/)[0], raison: p.archive?.raison || '', regles: p.t || null, gains: p.gains || {}, equipes: Object.keys(p.equipes || {}).length, imitation: !!p.distillation, restaure: !!p.restaure };
  });
}
// Remet une copie en service. L'etat actuel est copie avant, pour pouvoir annuler l'annulation.
export function restaurerPoids(f) {
  if (!/^poids-\d+\.json$/.test(f || '')) throw new Error('fichier invalide');
  const src = D('data', 'poids-historique', f); if (!existsSync(src)) throw new Error('copie introuvable');
  fait = false; archiverPoids('avant restauration');
  const p = lire(src); delete p.archive;
  // t a maintenant : le script du jeu voit des reglages plus recents et les reprend dans la minute.
  writeFileSync(P(), JSON.stringify({ ...p, t: Date.now(), restaure: { depuis: f, t: Date.now() } }, null, 1));
  return true;
}
// Reglages utilises par les analyses : ceux entraines sur le PC (poids.json) s'il y en a, sinon ceux du script,
// plus les reglages propres a chaque equipe (appliques quand l'equipe analysee est exactement celle-la).
export function reglagesAnalyse(save, defaut) {
  const p = lire(P()) || {}, src = p.W?.nm ? 'pc' : save?.W?.nm ? 'script' : 'defaut';
  const W = { ...defaut, ...(src === 'script' ? save.W : {}), ...(src === 'pc' ? p.W : {}) };
  delete W.equipes;
  const eq = Object.fromEntries(Object.entries(p.equipes || {}).filter(([, e]) => e?.nm?.length === W.boss?.length).map(([k, e]) => [k, { nom: e.nom, nm: e.nm }]));
  if (Object.keys(eq).length) W.equipes = eq;
  return { W, info: { source: src, t: src === 'pc' ? p.t || null : null, equipes: Object.keys(eq).length } };
}
