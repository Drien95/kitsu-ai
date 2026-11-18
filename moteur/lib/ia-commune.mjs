// IA commune des calculs partages : construite a partir de { W, equipes } exactement comme reglagesAnalyse
// (lib/historique.mjs) construit l'IA du PC, pour que le PC qui l'a publiee obtienne la meme empreinte (wKey).
// Elle est distribuee par le serveur de la base commune (GET /v1/ia, publiee par le PC validateur) ; le fichier
// poids-communs.json livre avec l'appli sert de secours.
import { W_DEFAUT } from './sim.mjs';
import { h53 } from './journal.mjs';

const CLES = Object.keys(W_DEFAUT);
// Verifie champ par champ (rien n'est execute) : renvoie null si la forme ne va pas.
export function iaValide(p) {
  if (!p || typeof p !== 'object' || !p.W || typeof p.W !== 'object') return null;
  const ok = v => Array.isArray(v) && v.length === W_DEFAUT.nm.length && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 100);
  if (!CLES.every(k => p.W[k] === undefined || ok(p.W[k])) || !ok(p.W.nm)) return null;
  const equipes = {};
  for (const [k, e] of Object.entries(p.equipes && typeof p.equipes === 'object' ? p.equipes : {}).slice(0, 40))
    if (/^\d+(-\d+){2}$/.test(k) && ok(e?.nm)) equipes[k] = { nom: typeof e.nom === 'string' ? e.nom.slice(0, 120) : '', nm: e.nm };
  return { W: Object.fromEntries(CLES.filter(k => p.W[k]).map(k => [k, p.W[k]])), equipes, version: typeof p.version === 'string' ? p.version.slice(0, 40) : '', t: Number.isFinite(p.t) ? p.t : 0 };
}
export function construireWC(p) {
  if (!p?.W?.nm) return null;
  const W = { ...W_DEFAUT, ...p.W }; delete W.equipes;
  const eq = Object.fromEntries(Object.entries(p.equipes || {}).filter(([, e]) => e?.nm?.length === W.boss?.length).map(([k, e]) => [k, { nom: e.nom, nm: e.nm }]));
  if (Object.keys(eq).length) W.equipes = eq;
  return W;
}
export const cleIA = W => W ? h53(JSON.stringify(W)) : null;
