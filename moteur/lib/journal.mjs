// Journal des essais (resultats de combats deja calcules), garde d'une analyse a l'autre.
// Une entree n'est reutilisee que si RIEN de ce qui la determine n'a change :
//   - le code de combat du jeu (signature globale : fonctions du moteur + empreinte de combats de reference) ;
//   - la carte elle-meme (stats, kit, collectifs ou elle figure), son niveau, ses etoiles, ses collectifs choisis ;
//   - les combats du paquet (definition des ennemis) ;
//   - les reglages de l'IA qui joue tes coups.
// Un patch qui ne touche que les bannieres ou les boutiques ne vide donc pas le journal.
import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync, renameSync, readdirSync, statSync, unlinkSync } from 'node:fs';
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
export function makeSigCarte(G, B) {
  const memo = new Map();
  return id => {
    if (!memo.has(id)) {
      const links = (G.LINKS || []).filter(l => l.ids.includes(id)).map(l => JSON.stringify(l)).sort().join('|');
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
export function ouvrirJournal(fichier) {
  mkdirSync(path.dirname(fichier), { recursive: true });
  const m = new Map(), vals = []; let gens = new Uint16Array(1 << 16), g = 0, gMax = 0;
  const poser = (k, v, gen) => { const i = m.get(k); if (i !== undefined) { vals[i] = v; gens[i] = gen; return; }
    if (vals.length >= gens.length) { const x = new Uint16Array(gens.length * 2); x.set(gens); gens = x; }
    m.set(k, vals.length); gens[vals.length] = gen; vals.push(v); };
  if (existsSync(fichier)) for (const l of readFileSync(fichier, 'utf8').split('\n')) {
    if (!l) continue;
    if (l.startsWith('#g ')) { g = +l.slice(3) || 0; if (g > gMax) gMax = g; continue; }
    const i = l.indexOf(' '); poser(l.slice(0, i), l.slice(i + 1), g);
  }
  const G = Math.min(gMax + 1, 65535); let tampon = [], marque = false;
  const flush = () => { if (tampon.length) { appendFileSync(fichier, (marque ? '' : `#g ${G}\n`) + tampon.join('\n') + '\n'); marque = true; tampon = []; } };
  const get = k => { const i = m.get(k); if (i === undefined) return undefined; gens[i] = G; return vals[i]; };
  const set = (k, v) => { const i = m.get(k); if (i !== undefined) { gens[i] = G; return; } poser(k, v, G); tampon.push(k + ' ' + v); if (tampon.length >= 20000) flush(); };
  // Reecrit le fichier avec les lignes servies par l'une des `garder` dernieres generations (celle-ci comprise).
  const compacter = (garder = 2) => {
    flush(); const min = G - garder + 1, parGen = new Map(); let avant = 0, octetsAvant = 0, apres = 0, octetsApres = 0;
    for (const [k, i] of m) { const n = k.length + vals[i].length + 2; avant++; octetsAvant += n; if (gens[i] < min) continue;
      apres++; octetsApres += n; let a = parGen.get(gens[i]); if (!a) parGen.set(gens[i], a = []); a.push(k + ' ' + vals[i]); }
    { // reecrit toujours : les generations des lignes reprises changent aussi
      const tmp = fichier + '.tmp'; writeFileSync(tmp, '');
      for (const gen of [...parGen.keys()].sort((x, y) => x - y)) { const a = parGen.get(gen); for (let j = 0; j < a.length; j += 50000) appendFileSync(tmp, (j ? '' : `#g ${gen}\n`) + a.slice(j, j + 50000).join('\n') + '\n'); }
      renameSync(tmp, fichier);
    }
    return { avant, apres, octetsAvant, octetsApres, generation: G };
  };
  return { taille: () => m.size, get, set, flush, compacter, generation: G };
}

// Supprime les journaux `prefixe*.jsonl` du dossier qui n'ont servi a aucun calcul depuis `jours` jours (ancien code de
// combat apres un patch, ancienne IA), sauf le journal en service. Renvoie [{ fichier, octets }].
export function nettoyerAnciens(dossier, prefixe, actuel, jours = 30) {
  const out = [], lim = Date.now() - jours * 86400000;
  let fs = []; try { fs = readdirSync(dossier); } catch { return out; }
  for (const f of fs) {
    if (!f.startsWith(prefixe) || !/\.jsonl(\.tmp)?$/.test(f) || path.join(dossier, f) === actuel) continue;
    try { const st = statSync(path.join(dossier, f)); if (st.mtimeMs < lim) { unlinkSync(path.join(dossier, f)); out.push({ fichier: f, octets: st.size }); } } catch {}
  }
  return out;
}
