// Format des lots de la base commune (partage des calculs Campagne). Sans dependance : utilise par le moteur (Node)
// et par le serveur de partage (Cloudflare Worker, dossier partage/). Un lot ne contient que des chiffres :
// il est lu par JSON.parse puis verifie champ par champ, rien n'est jamais execute.
//
// { f: 1, sigG, wKey, moteur, paq,
//   t: [ [[id, niveau, etoiles, [collectifs], sigCarte, eveil?] x 3], ... ]   trios
//      eveil (5.63, facultatif) : 'a<Eveil du compte>' et 'e' si la carte est eveillee (V2), ex. 'a2e' ; niveau jusqu'a 100.
//      Une carte sans Eveil garde 5 champs : les lots sans carte eveillee restent lisibles par les versions d'avant.
//   p: [ [difficulte, paquet, clePaquet], ... ]                         paquets de combats
//   l: [ [trio, paquet, graine, combats, troisEtoiles], ... ] }         resultats (indices dans t et p)

export const FORMAT = 1;
// Version du serveur (partage/src) : a monter a chaque changement du serveur. Le launcher du PC validateur compare
// avec celle que le serveur en ligne annonce et propose « Mettre a jour le serveur » quand elles different.
export const VERSION_SERVEUR = 4;
export const LIMITES = { trios: 60000, paquets: 2000, lignes: 400000, octets: 40e6, graineMax: 3, paq: 16, collectifs: 6 };
const RE_EV = /^a[1-9][0-9]?e?$/, RE_SIG = /^[0-9a-z]{1,14}$/, RE_TXT = /^[^\u0000-\u001f]{1,64}$/;
const ent = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;

// Renvoie null si le lot est valide, sinon la raison du refus.
export function verifierLot(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return 'pas un objet';
  if (o.f !== FORMAT) return 'format inconnu';
  for (const k of ['sigG', 'wKey']) if (typeof o[k] !== 'string' || !RE_SIG.test(o[k])) return 'signature ' + k;
  if (typeof o.moteur !== 'string' || !RE_TXT.test(o.moteur)) return 'version du moteur';
  if (o.paq !== LIMITES.paq) return 'taille de paquet';
  if (!Array.isArray(o.t) || !Array.isArray(o.p) || !Array.isArray(o.l)) return 'tableaux manquants';
  if (!o.l.length || o.t.length > LIMITES.trios || o.p.length > LIMITES.paquets || o.l.length > LIMITES.lignes) return 'taille';
  for (const tr of o.t) {
    if (!Array.isArray(tr) || tr.length !== 3) return 'trio';
    for (const c of tr) {
      if (!Array.isArray(c) || (c.length !== 5 && c.length !== 6)) return 'carte';
      const [id, lv, st, lk, sig] = c;
      if (c.length === 6 && (typeof c[5] !== 'string' || !RE_EV.test(c[5]))) return 'eveil';
      if (!ent(id, 1, 1e7) || !ent(lv, 1, c.length === 6 ? 100 : 99) || !ent(st, 0, 20) || !Array.isArray(lk) || lk.length > LIMITES.collectifs || typeof sig !== 'string' || !RE_SIG.test(sig)) return 'carte';
      for (const x of lk) if (typeof x !== 'string' || !RE_TXT.test(x)) return 'collectif';
    }
    if (new Set(tr.map(c => c[0])).size !== 3) return 'trio en double';
  }
  for (const p of o.p) if (!Array.isArray(p) || p.length !== 3 || !ent(p[0], 0, 5) || !ent(p[1], 0, 999) || typeof p[2] !== 'string' || !RE_SIG.test(p[2])) return 'paquet';
  const vu = new Set();
  for (const l of o.l) {
    if (!Array.isArray(l) || l.length !== 5) return 'ligne';
    const [ti, pj, g, n, s3] = l;
    if (!ent(ti, 0, o.t.length - 1) || !ent(pj, 0, o.p.length - 1) || !ent(g, 1, LIMITES.graineMax) || !ent(n, 0, LIMITES.paq) || !ent(s3, 0, n)) return 'ligne';
    const k = ti + ',' + pj + ',' + g; if (vu.has(k)) return 'ligne en double'; vu.add(k);
  }
  return null;
}

// Cle d'une carte, identique a celle du journal (cauchemar3.mjs : cleCarte).
export const cleCarteDe = ([id, lv, st, lk, sig, ev]) => `${id}:${lv}:${st}:${(lk || []).join('+')}:${sig}${ev ? ':' + ev : ''}`;
// Eveil d'une carte de lot -> champs de l'equipe pour setupBattle (aw, awakened).
export const eveilDeCarte = ev => { const m = /^a([0-9]+)(e?)$/.exec(ev || ''); return m ? { aw: +m[1], ...(m[2] ? { awakened: true } : {}) } : {}; };
export const avecEveil = tr => tr.some(c => c.length === 6);
export const cleTrioDe = tr => tr.map(cleCarteDe).sort().join(',');

// Indices de lignes tires au hasard (sans remise) pour un controle.
export function tirerIndices(nb, k, alea) {
  const r = new Set(), m = Math.min(k, nb);
  while (r.size < m) r.add(Math.floor(alea() * nb));
  return [...r].sort((a, b) => a - b);
}

// Compare les resultats rejoues a ceux du lot. Renvoie le nombre d'ecarts.
export function ecarts(lot, indices, resultats) {
  if (!Array.isArray(resultats) || resultats.length !== indices.length) return indices.length || 1;
  let e = 0;
  indices.forEach((i, j) => { const l = lot.l[i], r = resultats[j]; if (!l || !Array.isArray(r) || r[0] !== l[3] || r[1] !== l[4]) e++; });
  return e;
}

// Cartes presentes dans un lot (ids tries, ecarts en base 36 separes par des points) : la liste des lots les donne,
// pour qu'un PC ne telecharge que les lots dont il possede au moins un trio possible.
export function cartesDuLot(lot) {
  const ids = [...new Set(lot.t.flatMap(tr => tr.map(c => c[0])))].sort((a, b) => a - b);
  let p = 0; return ids.map(id => { const d = id - p; p = id; return d.toString(36); }).join('.');
}
export function decoderCartes(s) {
  if (typeof s !== 'string' || !s) return [];
  let p = 0; return s.split('.').map(x => (p += parseInt(x, 36)));
}

// Fusionne des lots de la meme version en un seul (paquet), sans doublon d'essai.
export function fusionner(lots) {
  const o = { f: FORMAT, sigG: lots[0].sigG, wKey: lots[0].wKey, moteur: lots[0].moteur, paq: LIMITES.paq, t: [], p: [], l: [] };
  const ti = new Map(), pj = new Map(), vu = new Set();
  for (const lot of lots) {
    if (lot.sigG !== o.sigG || lot.wKey !== o.wKey) throw new Error('versions differentes');
    const mt = lot.t.map(tr => { const k = cleTrioDe(tr); let a = ti.get(k); if (a === undefined) { a = o.t.length; ti.set(k, a); o.t.push(tr); } return a; });
    const mp = lot.p.map(p => { const k = p[0] + '|' + p[1] + '|' + p[2]; let b = pj.get(k); if (b === undefined) { b = o.p.length; pj.set(k, b); o.p.push(p); } return b; });
    for (const [ti0, pj0, g, n, s3] of lot.l) { const a = mt[ti0], b = mp[pj0], k = a + ',' + b + ',' + g; if (vu.has(k)) continue; vu.add(k); o.l.push([a, b, g, n, s3]); }
  }
  return o;
}
