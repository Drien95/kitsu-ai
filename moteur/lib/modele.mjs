// « Le modele vivant » (5.28) : un instantane de l'IA apres chaque calcul, pour voir ce qu'elle apprend.
// Aucun combat simule : tout vient du plan (score modele parfait, deja calcule sans simulation) et des resultats.
// Un instantane fait ~1 Ko ; il n'est ajoute que si quelque chose a change (empreinte), 400 au plus.
// data/modele-historique.json : [{ t, score, m: { campagne: pct, ... }, c: { normal: '3320...' }, tour: { now, max }, tr: [[mode, a, b, c, poids]], ia }]
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dir as D } from './chemins.mjs';

const F = () => D('data', 'modele-historique.json'), GARDER = 400;
const lire = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const CAU = ['normal', 'difficile', 'extreme'];

// Niveau d'un combat d'apres la chance de 3 etoiles du meilleur trio : 3 = sur (seuil du calcul), 2 = souvent, 1 = parfois, 0 = jamais.
export const niveau = (p, seuil) => p >= seuil ? 3 : p >= seuil / 2 ? 2 : p > 0 ? 1 : 0;

// Empreinte des reglages de l'IA (pour savoir quand elle a change).
export function cleIA(p) {
  const W = p?.W; if (!W?.nm) return null;
  return createHash('sha1').update(JSON.stringify([W.norm, W.boss, W.nm, W.tower, Object.keys(p.equipes || {}).sort()])).digest('hex').slice(0, 10);
}

// Instantane a partir du plan deja calcule et des resultats bruts.
export function instantane({ plan, campagne, tour, raid, poids, t }) {
  const s = { t: t || Date.now(), score: plan?.score ?? null, m: {}, c: {}, tour: null, tr: [], ia: cleIA(poids) };
  for (const m of plan?.modes || []) s.m[m.cle] = m.pct;
  const tm = plan?.modes?.find(m => m.cle === 'tour'); if (tm) s.tour = { now: tm.now, max: tm.max, prive: tm.source !== 'public' || undefined };
  // Campagne Cauchemar : un chiffre par combat.
  const e = campagne?.etages;
  if (e?.combats?.length) {
    const seuil = (e.seuil ?? 0.6) <= 1 ? (e.seuil ?? 0.6) * 100 : e.seuil, diffs = (e.resume || []).map(r => r.difficulte);
    for (const d of CAU) { const di = diffs.indexOf(d); if (di < 0) continue; const L = e.combats.filter(c => c[1] === di); if (L.length) s.c[d] = L.map(c => niveau(+c[3] || 0, seuil)).join(''); }
    // Trios qui servent : meilleur trio de chaque combat, compte une fois par combat.
    const n = new Map();
    for (const c of e.combats) { if (!CAU.includes(diffs[c[1]])) continue; const ids = e.trios?.[c[2]]; if (ids?.length === 3) { const k = ids.join('-'); n.set(k, (n.get(k) || 0) + 1); } }
    [...n].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => s.tr.push(['c', ...k.split('-').map(Number), v]));
  }
  const top = (L, mode, nb, val) => (L || []).filter(x => x?.ids?.length === 3).slice(0, nb).forEach((x, i) => s.tr.push([mode, ...x.ids, val(x, i)]));
  top(tour?.classement?.length ? tour.classement : tour?.trios, 't', 5, (x, i) => 5 - i);
  top(raid?.classement, 'r', 3, (x, i) => 3 - i);
  // Modes du script prive (Arene, Tour exacte) : leur meilleur trio, sans autre detail.
  for (const m of plan?.modes || []) if (m.source !== 'public' && m.trio?.length === 3) s.tr.push([m.cle === 'arene' ? 'a' : m.cle[0], ...m.trio, 6]);
  return s;
}

const empreinte = s => JSON.stringify([s.score, s.m, s.c, s.tour, s.tr, s.ia]);
export function historique() { const h = lire(F()); return Array.isArray(h) ? h : []; }

// Ajoute l'instantane s'il differe du dernier. Renvoie true si ajoute.
export function noter(s) {
  if (s?.score == null && !Object.keys(s?.c || {}).length) return false;
  const h = historique(), d = h[h.length - 1];
  if (d && empreinte(d) === empreinte(s)) return false;
  if (d && s.t <= d.t) s.t = d.t + 1;
  h.push(s); mkdirSync(D('data'), { recursive: true });
  writeFileSync(F(), JSON.stringify(h.slice(-GARDER)));
  return true;
}

// Date des resultats : celle du dernier fichier ecrit (pas celle de l'ouverture du panneau).
export function dateResultats() {
  let t = 0; for (const f of [D('resultats', 'cauchemar3.json'), D('resultats', 'tour.json'), D('resultats', 'raid.json'), D('data', 'poids.json')]) { try { t = Math.max(t, statSync(f).mtimeMs); } catch {} }
  return Math.round(t) || Date.now();
}

// « ADN » : les reglages de chaque version de l'IA (copies gardees dans poids-historique + celle en service), 76 nombres.
export function adn() {
  const H = D('data', 'poids-historique'), L = [];
  const gene = p => { const W = p?.W; if (!W?.nm) return null; return ['norm', 'boss', 'nm', 'tower'].flatMap(k => (W[k] || W.boss || []).slice(0, 19).map(x => +(+x || 0).toFixed(3))); };
  if (existsSync(H)) for (const f of readdirSync(H).filter(x => /^poids-\d+\.json$/.test(x)).sort()) { const p = lire(D('data', 'poids-historique', f)), g = gene(p); if (g) L.push({ t: p.t || +f.match(/\d+/)[0], g, cle: cleIA(p) }); }
  const p = lire(D('data', 'poids.json')), g = gene(p); if (g) L.push({ t: p.t || Date.now(), g, cle: cleIA(p), actuelle: true });
  // Une copie identique a la precedente n'est pas une nouvelle version.
  return L.filter((x, i) => !i || x.cle !== L[i - 1].cle).slice(-6);
}

