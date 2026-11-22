// Journal des essais (resultats de combats deja calcules), garde d'une analyse a l'autre.
// Une entree n'est reutilisee que si RIEN de ce qui la determine n'a change :
//   - le code de combat du jeu (signature globale : fonctions du moteur + empreinte de combats de reference) ;
//   - la carte elle-meme (stats, kit, collectifs ou elle figure), son niveau, ses etoiles, ses collectifs choisis ;
//   - les combats du paquet (definition des ennemis) ;
//   - les reglages de l'IA qui joue tes coups.
// Un patch qui ne touche que les bannieres ou les boutiques ne vide donc pas le journal.
import { existsSync, readFileSync, appendFileSync, openSync, readSync, closeSync, mkdirSync, writeFileSync, renameSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

// Hachage 53 bits (deux FNV-1a 32 bits) : ~0,0003 collision attendue pour 3 millions d'entrees.
export function h53(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 0x5bd1e995); b ^= b >>> 15; }
  return ((a >>> 0) * 2097152 + ((b >>> 0) & 0x1fffff)).toString(36);
}

// Les noms courts du code minifie changent a chaque construction du site : on les neutralise.
const KW = new Set('if else for do in of new var let const return function typeof void null true false this while break continue switch case default throw try catch finally delete instanceof'.split(' '));
const norm = s => s.replace(/(?<![\w$])[A-Za-z_$][\w$]*/g, w => KW.has(w) || w.length > 3 ? w : '_');

// Signature du combat : code de BattleCore + resultat detaille de combats de reference (attrape aussi
// un changement interne de la mise en place des equipes, des collectifs ou des bonus).
export function signatureCombat(G, B, S, W) {
  const code = Object.keys(B).sort().filter(k => typeof B[k] === 'function').map(k => k + ':' + norm(B[k].toString())).join('|');
  const ids = Object.values(G.CHAR_BY_ID).filter(c => ['M', 'L', 'E'].includes(c.r)).map(c => c.id).sort((x, y) => x - y);
  const pol = S.smartPol(W), w0 = G.ALL_WORLDS[0].fights, out = [];
  for (let k = 0; k < 12; k++) {
    const team = [0, 1, 2].map(j => ({ id: ids[(k * 37 + j * 101) % ids.length], lv: 50 + k, stars: k % 4 }));
    const f = w0[(k * 7) % w0.length].id + ['', '@x', '@xn'][k % 3], r = S.fight(f, team, k + 1, pol);
    out.push([r.win, r.ko, r.cycle, r.stars].join(','));
  }
  return h53(code + '#' + out.join(';'));
}

// Signature d'une carte : ses stats, son kit et les collectifs ou elle apparait.
// 5.60.1 : le numero `i` d'un collectif n'entre plus dans la signature. Le jeu renumerote tous les collectifs quand il en
// insere de nouveaux (patch DFG3HI-s : 599 cartes invalidees, 167 vraiment changees). Seul compte l'ordre de ses collectifs,
// car `i` departage deux collectifs de meme % dans le choix des 6 actifs (G.linkOrder) : ils sont donc ranges par `i`.
export const collectifSansNumero = l => { const { i, ...reste } = l; return JSON.stringify(reste); };
export function makeSigCarte(G, B) {
  const memo = new Map();
  return id => {
    if (!memo.has(id)) {
      const links = (G.LINKS || []).filter(l => l.ids.includes(id)).sort((a, b) => (a.i ?? 0) - (b.i ?? 0)).map(collectifSansNumero).join('|');
      memo.set(id, h53(JSON.stringify(G.CHAR_BY_ID[id] || {}) + '#' + JSON.stringify(B.KITS?.[id] || {}) + '#' + links));
    }
    return memo.get(id);
  };
}

// Journal en ajout seul (une ligne par paquet calcule) : sert aussi de point de reprise apres une coupure.
// 5.42 : chaque calcul complet est une « generation » (ligne `#g N` avant ses ajouts). Une ligne lue ou ecrite par un calcul
// passe a sa generation ; compacter() reecrit le fichier sans les lignes qui n'ont servi a aucun des `garder` derniers
// calculs complets (cartes montees en etoiles, anciens liens, resultats recus pour des cartes que tu n'as pas).
// Memoire : generations dans un Uint16Array (2 octets par ligne) ; mesure sur un journal de 4,35 M lignes : 567 Mo de tas contre 533.
// 5.42.1 : grosses collections. Le 1er tour de 7 M trios ecrit 21 M lignes : une Map de V8 plafonne a 16,7 M cles (2^24,
// « Map maximum size exceeded ») et 21 M petites chaines ne tiennent pas dans les 2 Go de tas de Node. Les cles (h53 en base 36,
// un entier < 2^53) sont donc rangees comme nombres dans une table de hachage a adressage ouvert (Float64Array), hors du tas ;
// les valeurs, tres repetitives ('16,0,0000000000000000' pour la plupart des trios), sont mises en commun (une seule chaine par
// valeur distincte). Une cle qui n'est pas un h53 reste dans une Map (aucune aujourd'hui). Fichier relu par morceaux de 32 Mo.
const B36 = /^[0-9a-z]{1,11}$/, DEUX32 = 4294967296;
const nombreDe = k => { if (!B36.test(k)) return -1; const x = parseInt(k, 36); return Number.isSafeInteger(x) && x.toString(36) === k ? x : -1; }; // forme exacte de h53 (sans zero devant)
function lireLignes(fichier, f) {
  const fd = openSync(fichier, 'r'), buf = Buffer.allocUnsafe(32 << 20); let reste = Buffer.alloc(0), n;
  try {
    while ((n = readSync(fd, buf, 0, buf.length, null)) > 0) {
      const b = reste.length ? Buffer.concat([reste, buf.subarray(0, n)]) : buf.subarray(0, n), fin = b.lastIndexOf(10);
      if (fin < 0) { reste = Buffer.from(b); continue; }
      for (const l of b.toString('utf8', 0, fin).split('\n')) if (l) f(l);
      reste = Buffer.from(b.subarray(fin + 1));
    }
    if (reste.length) for (const l of reste.toString('utf8').split('\n')) if (l) f(l);
  } finally { closeSync(fd); }
}
// Table cle numerique -> (valeur, generation). 14 octets par case, remplie au plus a 70 %.
function tableNombres() {
  let cap = 1 << 16, K = new Float64Array(cap), V = new Uint32Array(cap), GN = new Uint16Array(cap), n = 0;
  const h = x => (Math.imul((x >>> 0) ^ Math.floor(x / DEUX32), 0x9e3779b1) >>> 0) & (cap - 1);
  const place = x => { let i = h(x); while (V[i] && K[i] !== x) i = (i + 1) & (cap - 1); return i; };
  const grandir = () => { const k0 = K, v0 = V, g0 = GN; cap *= 2; K = new Float64Array(cap); V = new Uint32Array(cap); GN = new Uint16Array(cap);
    for (let j = 0; j < k0.length; j++) if (v0[j]) { const i = place(k0[j]); K[i] = k0[j]; V[i] = v0[j]; GN[i] = g0[j]; } };
  return {
    taille: () => n,
    lire: x => { const i = place(x); return V[i] ? i : -1; }, // case, ou -1
    val: i => V[i] - 1, gen: i => GN[i], marquer: (i, g) => { GN[i] = g; },
    poser: (x, v, g) => { let i = place(x); if (!V[i]) { if (++n > cap * 0.7) { grandir(); i = place(x); } K[i] = x; } V[i] = v + 1; GN[i] = g; },
    *cases() { for (let i = 0; i < cap; i++) if (V[i]) yield i; }, cle: i => K[i].toString(36),
  };
}
export function ouvrirJournal(fichier) {
  mkdirSync(path.dirname(fichier), { recursive: true });
  const T = tableNombres(), autres = new Map(), pool = [], idDe = new Map(); let g = 0, gMax = 0; // autres : cle texte -> [valeur, generation]
  const id = v => { let i = idDe.get(v); if (i === undefined) { i = pool.length; pool.push(v); idDe.set(v, i); } return i; };
  const poser = (k, v, gen) => { const x = nombreDe(k); if (x >= 0) T.poser(x, id(v), gen); else autres.set(k, [v, gen]); };
  if (existsSync(fichier)) lireLignes(fichier, l => {
    if (l.startsWith('#g ')) { g = +l.slice(3) || 0; if (g > gMax) gMax = g; return; }
    const i = l.indexOf(' '); poser(l.slice(0, i), l.slice(i + 1), g);
  });
  const G = Math.min(gMax + 1, 65535); let tampon = [], marque = false;
  const flush = () => { if (tampon.length) { appendFileSync(fichier, (marque ? '' : `#g ${G}\n`) + tampon.join('\n') + '\n'); marque = true; tampon = []; } };
  const get = k => { const x = nombreDe(k);
    if (x < 0) { const e = autres.get(k); if (!e) return undefined; e[1] = G; return e[0]; }
    const i = T.lire(x); if (i < 0) return undefined; T.marquer(i, G); return pool[T.val(i)]; };
  const set = (k, v) => { const x = nombreDe(k);
    if (x < 0 ? autres.has(k) : T.lire(x) >= 0) { get(k); return; } poser(k, v, G); tampon.push(k + ' ' + v); if (tampon.length >= 20000) flush(); };
  // Reecrit le fichier avec les lignes servies par l'une des `garder` dernieres generations (celle-ci comprise), generation par
  // generation, par lots de 50 000 lignes (sans copie de tout le journal en memoire).
  const compacter = (garder = 2) => {
    flush(); const min = G - garder + 1, gensGardees = new Set(); let avant = 0, octetsAvant = 0, apres = 0, octetsApres = 0;
    const compter = (k, v, gen) => { const n = k.length + v.length + 2; avant++; octetsAvant += n; if (gen < min) return; apres++; octetsApres += n; gensGardees.add(gen); };
    for (const i of T.cases()) compter(T.cle(i), pool[T.val(i)], T.gen(i));
    for (const [k, [v, gen]] of autres) compter(k, v, gen);
    { // reecrit toujours : les generations des lignes reprises changent aussi
      const tmp = fichier + '.tmp'; writeFileSync(tmp, '');
      for (const gen of [...gensGardees].sort((x, y) => x - y)) {
        let lot = [`#g ${gen}`]; const vider = () => { appendFileSync(tmp, lot.join('\n') + '\n'); lot = []; };
        for (const i of T.cases()) if (T.gen(i) === gen) { lot.push(T.cle(i) + ' ' + pool[T.val(i)]); if (lot.length >= 50000) vider(); }
        for (const [k, [v, g2]] of autres) if (g2 === gen) { lot.push(k + ' ' + v); if (lot.length >= 50000) vider(); }
        if (lot.length) vider();
      }
      renameSync(tmp, fichier);
    }
    return { avant, apres, octetsAvant, octetsApres, generation: G };
  };
  return { taille: () => T.taille() + autres.size, get, set, flush, compacter, generation: G };
}

export function nettoyerAnciens(dossier, prefixe, actuel, jours = 30) {
  const out = [], lim = Date.now() - jours * 86400000;
  let fs = []; try { fs = readdirSync(dossier); } catch { return out; }
  for (const f of fs) {
    if (!f.startsWith(prefixe) || !/\.jsonl(\.tmp)?$/.test(f) || path.join(dossier, f) === actuel) continue;
    try { const st = statSync(path.join(dossier, f)); if (st.mtimeMs < lim) { unlinkSync(path.join(dossier, f)); out.push({ fichier: f, octets: st.size }); } } catch {}
  }
  return out;
}
