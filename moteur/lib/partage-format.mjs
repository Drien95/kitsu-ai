// Format des lots de la base commune (partage des calculs Campagne). Sans dependance : utilise par le moteur (Node)
// et par le serveur de partage (Cloudflare Worker, dossier partage/). Un lot ne contient que des chiffres :
// il est lu par JSON.parse puis verifie champ par champ, rien n'est jamais execute.
//
// { f: 1, sigG, wKey, moteur, paq,
//   t: [ [[id, niveau, etoiles, [collectifs], sigCarte] x 3], ... ]   trios
//   p: [ [difficulte, paquet, clePaquet], ... ]                         paquets de combats
//   l: [ [trio, paquet, graine, combats, troisEtoiles], ... ] }         resultats (indices dans t et p)

export const FORMAT = 1;
export const LIMITES = { trios: 20000, paquets: 2000, lignes: 60000, octets: 8e6, graineMax: 3, paq: 16, collectifs: 6 };
const RE_SIG = /^[0-9a-z]{1,14}$/, RE_TXT = /^[^\u0000-\u001f]{1,64}$/;
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
      if (!Array.isArray(c) || c.length !== 5) return 'carte';
      const [id, lv, st, lk, sig] = c;
      if (!ent(id, 1, 1e7) || !ent(lv, 1, 99) || !ent(st, 0, 20) || !Array.isArray(lk) || lk.length > LIMITES.collectifs || typeof sig !== 'string' || !RE_SIG.test(sig)) return 'carte';
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
export const cleCarteDe = ([id, lv, st, lk, sig]) => `${id}:${lv}:${st}:${(lk || []).join('+')}:${sig}`;
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
