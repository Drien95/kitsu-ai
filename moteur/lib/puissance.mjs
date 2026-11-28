// 5.62 : limite de puissance d'equipe (V2 du jeu, 28/11/2026), lue dans le moteur du jeu.
// Regle du jeu : une equipe est valide si G.teamPowerSum(ids) <= G.powerCap(S). Le plafond depend du nombre de
// Transcendances (S.rb.n) : 28, 36, 44, 48, 52, 56, puis +2 par Transcendance, max 64. Moteur sans ces fonctions
// (avant la V2) : pas de limite, comme avant.
// Le nombre de Transcendances vient de la sauvegarde ; --transcendance N (ou KITSU_TRANSCENDANCE=N) calcule comme si le
// compte en avait N (guides par palier). --sans-limite : ancien comportement (tests, comparaisons).
const argv = process.argv.slice(2);
const argDe = k => { const i = argv.indexOf('--' + k); return i < 0 ? undefined : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };

export const transcendancesDe = S => { const n = S?.rb?.n; return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0; };

export function limitePuissance(G, S, opts = {}) {
  const sans = opts.sansLimite ?? (argDe('sans-limite') !== undefined || process.env.KITSU_SANS_LIMITE === '1');
  const force = opts.transcendance ?? argDe('transcendance') ?? process.env.KITSU_TRANSCENDANCE;
  const rb = force !== undefined && force !== true && force !== '' && Number.isInteger(+force) && +force >= 0 ? +force : transcendancesDe(S);
  const dispo = typeof G?.teamPowerSum === 'function' && typeof G?.powerCap === 'function';
  const actif = dispo && !sans && G.POWER_LIMIT?.on !== false;
  const plafond = actif ? G.powerCap({ ...(S || {}), rb: { ...(S?.rb || {}), n: rb } }) : Infinity;
  const reel = transcendancesDe(S);
  if (!actif || !Number.isFinite(plafond)) return { actif: false, rb, reel, plafond: Infinity, cout: ids => (dispo ? G.teamPowerSum(ids) : 0), ok: () => true, okPositions: () => () => true, compter: l => { const n = l.length; return { total: n * (n - 1) * (n - 2) / 6, ok: n * (n - 1) * (n - 2) / 6 }; }, force: force !== undefined };
  // Le cout d'une equipe ne depend que du cout de chaque carte et de sa rarete (LR comptees a part, MR a part) : on le
  // calcule une fois par combinaison de classes avec des cartes representatives (7 M trios : quelques classes seulement).
  const CH = G.CHAR_BY_ID || {}, classe = new Map(), reps = new Map(), cache = new Map();
  const classeDe = id => { let k = classe.get(id); if (k === undefined) { const c = CH[id] || {}; k = [G.cardPower(id), c.r, c.appearanceRarity || '', c.awakenX ? 1 : 0].join('|'); classe.set(id, k); const r = reps.get(k) || []; if (r.length < 6 && !r.includes(id)) { r.push(id); reps.set(k, r); } } return k; };
  const cout = ids => {
    const u = [...new Set(ids)]; if (typeof G.cardPower !== 'function') return G.teamPowerSum(u);
    const ks = u.map(classeDe), cle = [...ks].sort().join('#'); let v = cache.get(cle);
    if (v === undefined) { const vus = new Map(), rep = ks.map(k => { const i = vus.get(k) || 0; vus.set(k, i + 1); return reps.get(k)[i]; }); v = rep.every(x => x !== undefined) ? G.teamPowerSum(rep) : G.teamPowerSum(u); cache.set(cle, v); }
    return v;
  };
  const ok = ids => cout(ids) <= plafond;
  // Pour les grosses enumerations (7 M trios) : verdict par positions dans une liste de cartes, une table par triple de classes.
  const okPositions = liste => {
    const ks = liste.map(classeDe), u = [...new Set(ks)], NC = u.length, ci = Int32Array.from(ks.map(k => u.indexOf(k))), tab = new Int8Array(NC * NC * NC).fill(-1);
    return (a, b, c) => { const k = (ci[a] * NC + ci[b]) * NC + ci[c]; let v = tab[k]; if (v < 0) tab[k] = v = ok([liste[a], liste[b], liste[c]]) ? 1 : 0; return v === 1; };
  };
  // 5.63 : nombre de trios acceptes parmi des cartes, sans les enumerer : par classes de cartes (combinaisons exactes).
  const compter = liste => {
    const n = new Map(); for (const id of liste) { const k = classeDe(id); n.set(k, (n.get(k) || 0) + 1); }
    const ks = [...n.keys()], C = (a, b) => b === 1 ? a : b === 2 ? a * (a - 1) / 2 : a * (a - 1) * (a - 2) / 6; let total = 0, okN = 0;
    for (let i = 0; i < ks.length; i++) for (let j = i; j < ks.length; j++) for (let k = j; k < ks.length; k++) {
      const m = new Map(); for (const x of [ks[i], ks[j], ks[k]]) m.set(x, (m.get(x) || 0) + 1);
      let nb = 1; for (const [x, c] of m) nb *= n.get(x) >= c ? C(n.get(x), c) : 0; if (!nb) continue;
      total += nb; const vus = new Map(), rep = [ks[i], ks[j], ks[k]].map(x => { const v = vus.get(x) || 0; vus.set(x, v + 1); return reps.get(x)[v]; });
      if (cout(rep) <= plafond) okN += nb;
    }
    return { total, ok: okN };
  };
  return { actif: true, rb, reel, plafond, cout, ok, okPositions, compter, force: force !== undefined };
}

// Texte court pour les journaux et les resultats.
export const decrireLimite = L => L.actif ? `limite de puissance ${L.plafond} points (${L.rb} Transcendance${L.rb > 1 ? 's' : ''}${L.force ? ', palier choisi' : ''})` : 'sans limite de puissance';

// 5.62 : Eveil (V2). Le script envoie dans la sauvegarde `eveil` = { aw: niveau d'Eveil du compte, cartes: [ids eveillees] },
// calcule dans le jeu par G.withAwOf. setupBattle lit `aw` et `awakened` sur chaque carte de l'equipe (+10 %, niveau 100).
export function eveilDe(S) {
  const aw = +S?.eveil?.aw || 0, ev = new Set((S?.eveil?.cartes || []).map(Number));
  const champs = id => ({ ...(aw ? { aw } : {}), ...(aw && ev.has(+id) ? { awakened: true } : {}) });
  return { aw, eveillee: id => ev.has(+id), champs, niveauMax: id => ev.has(+id) ? 100 : 99, cle: id => (aw ? `a${aw}${ev.has(+id) ? 'e' : ''}` : '') };
}

// 5.63 : resultats par palier. Le calcul de ton palier reel garde les noms habituels (cauchemar3.json, tour.json) ;
// un autre palier (--transcendance N) ecrit cauchemar3-pN.json, tour-pN.json, sans toucher aux resultats de ton palier.
export const fichierDuPalier = (base, n, reel) => n == null || n === reel ? `${base}.json` : `${base}-p${n}.json`;
export const nomResultat = (base, L) => fichierDuPalier(base, L.force ? L.rb : null, L.reel);
// Paliers montres dans le guide : 0 a 5, puis le palier ou le plafond atteint 64.
export const PALIERS = [0, 1, 2, 3, 4, 5, 9];

// 5.64 : raretes du choix des calculs (Campagne, Tour) : les 7 classes de cout de la V2, lues sur la fiche de la carte.
// MR, LR-X, LR, UR-X, UR, SSR-X, SSR (les MR et LR-X sont des cartes M du jeu, les X ont awakenX).
export const RARETES_V2 = ['MR', 'LR-X', 'LR', 'UR-X', 'UR', 'SSR-X', 'SSR'];
export function classeRarete(c) {
  if (!c || !['M', 'L', 'E'].includes(c.r)) return null;
  if (c.appearanceRarity === 'MR') return 'MR';
  if (c.appearanceRarity === 'LR-X') return 'LR-X';
  return ({ M: 'LR', L: 'UR', E: 'SSR' })[c.r] + (c.awakenX ? '-X' : '');
}
// Liste --raretes : noms V2 ; « LR,UR,SSR » d'avant 5.64 garde son sens (toutes les cartes M, L ou E).
export function raretesChoisies(txt) {
  const l = String(txt || '').split(',').map(x => x.trim()).filter(Boolean), ancien = { LR: ['MR', 'LR-X', 'LR'], UR: ['UR-X', 'UR'], SSR: ['SSR-X', 'SSR'] };
  const v2 = l.some(x => x.endsWith('-X') || x === 'MR') || l.length === 0 ? l : l.flatMap(x => ancien[x] || []);
  const r = RARETES_V2.filter(x => v2.includes(x));
  return r.length ? r : RARETES_V2.slice();
}
