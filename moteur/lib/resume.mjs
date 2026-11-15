// Resume d'une version du moteur du jeu (cartes, kits, mondes, evenements, bannieres) et comparaison
// entre deux versions : c'est ce qui alimente « Patch KITSU detecte ».
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dir as D } from './chemins.mjs';
const R = { M: 'LR', L: 'UR', E: 'SSR', R: 'SR', U: 'R', C: 'N' };
const PART = { a: 'Attaque', s: 'Technique', t: 'Technique', u: 'Ultime', p: 'Passif' };
const flat = (o, p = '', out = {}) => { if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, out); } else if (typeof o === 'number' || typeof o === 'string') out[p] = o; return out; };
export function resumer(G, B, version) {
  const cartes = {};
  for (const c of Object.values(G.CHAR_BY_ID)) {
    const kit = B.KITS?.[c.id] || null;
    cartes[c.id] = { n: c.n, r: R[c.r] || c.r, serie: c.series?.name || String(c.s), atk: c.atk, def: c.def, hpK: +(+c.hpK || 0).toFixed(4), spd: c.spd0, kit: kit ? Object.fromEntries(Object.entries(flat(kit)).filter(([k, v]) => typeof v === 'number' || /nom$/.test(k))) : null };
  }
  const mondes = Object.fromEntries(G.ALL_WORLDS.map(w => [w.id, { nom: w.name || w.title || w.id, combats: w.fights.length }]));
  const evenements = Object.fromEntries((G.EVENTS || []).map(e => [e.id || e.title, { titre: e.title, monde: e.world }]));
  const bannieres = Object.fromEntries((G.BANNERS || []).map(b => [b.series, { ouvre: b.opens || b.from || null, fin: b.until || null, lr: b.pool?.M || [] }]));
  return { version, date: Date.now(), cartes, mondes, evenements, bannieres };
}
export function comparer(A, Bv, save = null) {
  const out = { de: A.version, vers: Bv.version, date: Date.now(), nouvellesCartes: [], cartesModifiees: [], cartesRetirees: [], nouveauxMondes: [], mondesModifies: [], nouveauxEvenements: [], nouvellesBannieres: [], tesCartes: [] };
  const mine = new Set(Object.keys(save?.owned || {}).map(String)), team = new Set((save?.team || []).map(String));
  for (const [id, c] of Object.entries(Bv.cartes)) {
    const o = A.cartes[id];
    if (!o) { out.nouvellesCartes.push({ id: +id, n: c.n, r: c.r, serie: c.serie }); continue; }
    const ch = [];
    for (const k of ['atk', 'def', 'hpK', 'spd']) if (o[k] !== c[k]) ch.push({ quoi: { atk: 'ATK', def: 'DEF', hpK: 'PV', spd: 'VIT' }[k], avant: o[k], apres: c[k] });
    if (JSON.stringify(o.kit) !== JSON.stringify(c.kit)) {
      const a = o.kit || {}, b = c.kit || {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (/nom$/.test(k) || a[k] === b[k]) continue;
        const top = k.split('.')[0], nom = b[top + '.nom'] || a[top + '.nom'] || PART[top] || top, champ = k.split('.').pop();
        ch.push({ quoi: `${PART[top] || top} « ${nom} » (${champ})`, avant: a[k] ?? null, apres: b[k] ?? null });
      }
    }
    if (ch.length) { out.cartesModifiees.push({ id: +id, n: c.n, r: c.r, changements: ch.slice(0, 12) }); if (mine.has(id)) out.tesCartes.push({ id: +id, n: c.n, equipe: team.has(id) }); }
  }
  for (const id of Object.keys(A.cartes)) if (!Bv.cartes[id]) out.cartesRetirees.push({ id: +id, n: A.cartes[id].n });
  for (const [id, w] of Object.entries(Bv.mondes)) { const o = A.mondes[id]; if (!o) out.nouveauxMondes.push({ id, ...w }); else if (o.combats !== w.combats) out.mondesModifies.push({ id, nom: w.nom, avant: o.combats, apres: w.combats }); }
  for (const [id, e] of Object.entries(Bv.evenements)) if (!A.evenements[id]) out.nouveauxEvenements.push({ id, ...e });
  for (const [s, b] of Object.entries(Bv.bannieres)) if (!A.bannieres[s] || A.bannieres[s].fin !== b.fin) out.nouvellesBannieres.push({ serie: s, ...b });
  const series = {}; for (const c of out.nouvellesCartes) { const k = c.serie; (series[k] ||= { serie: k, n: 0, lr: 0 }); series[k].n++; if (c.r === 'LR') series[k].lr++; }
  out.resumeNouvelles = Object.values(series).sort((a, b) => b.n - a.n);
  out.vide = !out.nouvellesCartes.length && !out.cartesModifiees.length && !out.cartesRetirees.length && !out.nouveauxMondes.length && !out.mondesModifies.length && !out.nouveauxEvenements.length && !out.nouvellesBannieres.length;
  return out;
}
// Enregistre le resume d'une version et, s'il y avait une version precedente, la comparaison dans data/patchs.json.
export function enregistrer(G, B, version, precedente) {
  const f = D('engine', version, 'resume.json'); const r = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : resumer(G, B, version);
  if (!existsSync(f)) writeFileSync(f, JSON.stringify(r));
  if (!precedente || precedente === version) return null;
  const fp = D('engine', precedente, 'resume.json'); if (!existsSync(fp)) return null;
  const save = existsSync(D('data', 'sauvegarde.json')) ? JSON.parse(readFileSync(D('data', 'sauvegarde.json'), 'utf8')) : null;
  const diff = comparer(JSON.parse(readFileSync(fp, 'utf8')), r, save);
  mkdirSync(D('data'), { recursive: true });
  const pf = D('data', 'patchs.json'), all = existsSync(pf) ? JSON.parse(readFileSync(pf, 'utf8')) : [];
  if (!all.some(p => p.de === diff.de && p.vers === diff.vers)) { all.unshift({ ...diff, vu: false }); writeFileSync(pf, JSON.stringify(all.slice(0, 30))); }
  return diff;
}
