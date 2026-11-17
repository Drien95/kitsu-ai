// Raid « Le Destin Effacé » (Diavolo) : simulation et strategie, avec le code du jeu (G.createRaidCombat, G.resolveRaidTurn...).
// De 1 a 3 joueurs, 3 cartes chacun. Le boss annonce son coup (forecast) : la strategie y repond.
// - planTour(G, s, intents)  : actions de tous les joueurs pour ce tour (Ruptures choisies pour le groupe, Garde, attaques).
// - jouer(G, roster, seed)   : un raid complet joue par la strategie (pour les calculs).
// Regles lues dans le jeu : reserve d'energie par joueur (100, +10 par carte vivante a chaque tour), attaque 10, technique 25,
// ultime 20 (jauge pleine), Rupture 10 puis 2 tours d'attente, Garde gratuite (-60 % de degats, retire 1 charge de Moisissure).
// Une carte qui rompt, garde ou reanime ne frappe pas. Les coups du boss sont des % des PV max : la defense ne compte pas.
export const COUT = { basic: 10, skill: 25, ult: 20 };
const RES = ['end', 'end1', 'end2', 'end3'];
const reserve = (s, seat) => s.battle[RES[seat]] ?? 0;
export const allies = (s, seat) => s.battle.units.filter(u => u.side === 'ally' && u.alive && (seat == null || u.owner === seat));
export const sieges = s => [...new Set(s.battle.units.filter(u => u.side === 'ally').map(u => u.owner))].sort((a, b) => a - b);
export const boss = s => s.battle.units.find(u => u.key === 'raid-boss');
// Ce qu'une carte peut viser : le boss (sauf Secco pendant les fissures) et SA fissure ou son Echo.
export const cibles = (s, seat) => s.battle.units.filter(x => x.side === 'enemy' && x.alive && (x.key === 'raid-boss' ? (s.stage !== 1 || !Object.keys(s.fixtureOwners || {}).length) : s.fixtureOwners?.[x.key] === seat));
const peutRompre = (s, seat) => allies(s, seat).length > 0 && s.turn >= (s.ruptureAt?.[seat] ?? 0) && reserve(s, seat) >= (s.config?.ruptureEnd ?? 10);
const force = (s, seat) => allies(s, seat).reduce((a, u) => a + (u.atk || 0), 0);
const intentDe = (intents, seat) => intents?.[seat] || null;

// Qui rompt ce tour. Les Ruptures deja prevues par un joueur (intentions visibles dans la page) comptent d'abord.
// Rien si le groupe ne peut pas en reunir assez (une Rupture seule ne sert a rien et coute l'action de la carte).
// Anticipation : en phase 2 de Diavolo, quand la phase 3 approche, on garde les Ruptures pour « Seul le resultat demeure ».
export function rupteurs(s, intents = null, opt = {}) {
  const f = s.forecast || {}, need = f.breaks || 0, r = new Set(); if (!need) return r;
  if (opt.anticipe !== false && s.stage === 2 && s.phase === 2) { const b = boss(s); if (b && b.hp - (s.dernierDegats || 0) * 1.3 <= b.maxHp * 0.3) return r; }
  const ss = sieges(s).filter(p => peutRompre(s, p));
  for (const p of ss) if (intentDe(intents, p)?.some(a => a.kind === 'rupture')) r.add(p);
  const libres = ss.filter(p => !r.has(p) && !(intents && intentDe(intents, p) && opt.figes?.includes(p))).sort((a, b) => force(s, a) - force(s, b));
  for (const p of libres) { if (r.size >= need) break; r.add(p); }
  if (r.size < need) r.clear();
  return r;
}

// Actions d'un joueur. why : la raison, affichee par le script.
export function planSiege(G, s, seat, R, opt = {}) {
  const f = s.forecast || {}, marks = f.marks || [], mine = allies(s, seat), out = [];
  let e = reserve(s, seat), rompt = R.has(seat);
  const casse = !!(f.breaks && R.size >= f.breaks);
  const ordre = [...mine].sort((a, b) => (a.atk || 0) - (b.atk || 0)); // la plus faible en attaque rompt ou reanime
  const morts = s.battle.units.filter(u => u.side === 'ally' && !u.alive && u.owner === seat);
  if (morts.length && (s.revives || 0) > 0 && ordre.length > 1) { const u = ordre.shift(); out.push({ unit: u.key, kind: 'revive', target: morts[0].key, why: 'reanime ' + morts[0].name }); }
  for (const u of ordre) {
    const vise = marks.includes(u.key);
    if (rompt && !(vise && ['fatal', 'ultimate'].includes(f.kind) && ordre.length > 1)) { out.push({ unit: u.key, kind: 'rupture', why: f.kind === 'cloud' ? 'annule le Nuage' : f.kind === 'ultimate' ? 'interrompt King Crimson' : 'interrompt Epitaph' }); rompt = false; e -= 10; continue; }
    let garde = '';
    if (vise && f.kind === 'fatal') garde = 'cible de la Chute fatale';
    else if (vise && f.kind === 'ultimate') garde = 'cible de King Crimson';
    else if (vise && f.kind === 'epitaph' && !casse) garde = 'marquee par Epitaph : son attaque serait effacee';
    else if (f.kind === 'cloud' && !casse) garde = 'Nuage mortel sans Ruptures';
    else if ((s.mold?.[u.key]?.stacks || 0) >= 2) garde = 'retire une charge de Moisissure';
    else if (u.hp < u.maxHp * 0.35 && (f.kind === 'assault' || f.kind === 'cloud')) garde = 'PV bas avant un assaut';
    if (garde) { out.push({ unit: u.key, kind: 'guard', why: garde }); continue; }
    const en = cibles(s, seat), fx = en.filter(x => x.key.startsWith('fixture-')).sort((a, b) => a.hp - b.hp), tgt = (fx[0] || en[0])?.key;
    if (!tgt) { out.push({ unit: u.key, kind: 'guard', why: 'aucune cible ce tour' }); continue; }
    let best = null, bd = 0;
    for (const kind of ['ult', 'skill', 'basic']) {
      const c = COUT[kind]; if (e < c || (kind !== 'basic' && e - c < 10)) continue; // garde 10 pour une Rupture
      let d = null; try { d = G.previewRaidDamage(s, { unit: u.key, kind, target: tgt }); } catch {}
      if (d != null && d > bd) { bd = d; best = { unit: u.key, kind, target: tgt, why: (fx[0] && tgt === fx[0].key ? 'casse ta fissure' : 'frappe') + ' (~' + Math.round(d) + ')', degats: Math.round(d) }; }
    }
    if (best) { e -= COUT[best.kind]; out.push(best); } else out.push({ unit: u.key, kind: 'guard', why: "pas assez d'energie" });
  }
  return out;
}

export function planTour(G, s, intents = null, opt = {}) {
  const R = rupteurs(s, intents, opt), par = {};
  for (const p of sieges(s)) par[p] = (opt.naif?.includes(p)) ? planNaif(G, s, p) : planSiege(G, s, p, R, opt);
  return { R, par };
}
// Joueur qui frappe sans jamais rompre ni garder (pour mesurer ce que vaut la coordination).
export function planNaif(G, s, seat) { return planSiege(G, { ...s, forecast: { kind: 'aucun' }, mold: {} }, seat, new Set(), {}); }

const sansWhy = a => { const { why, degats, ...x } = a; return x; };
// Joue un tour (le plan de tous les joueurs) sur une copie : renvoie le nouvel etat.
export function jouerTour(G, s, actions, now = 0) {
  const b0 = boss(s), h0 = b0?.hp ?? 0, st0 = s.stage;
  const n = G.resolveRaidTurn(s, actions.map(sansWhy), now);
  const b1 = boss(n); n.dernierDegats = n.stage === st0 && b1 ? Math.max(0, h0 - b1.hp) : 0;
  return n;
}

// Un raid complet. roster : [{ id, lv, stars, owner }] (owner = siege 0, 1 ou 2). Renvoie le resultat et le detail par carte.
export function jouer(G, roster, seed, opt = {}) { return finir(G, G.createRaidCombat(roster, seed >>> 0, 0), null, opt); }
// Joue un raid jusqu'au bout depuis un etat (copie). premier : actions imposees au premier tour (sinon la strategie).
export function finir(G, s, premier = null, opt = {}) {
  const parCarte = {}, causes = [];
  const note = (k, f) => { const c = parCarte[k] ||= { degats: 0, ruptures: 0, gardes: 0 }; f(c); };
  for (let k = 0; k < 80 && !s.outcome; k++) {
    const acts = k === 0 && premier ? premier : Object.values(planTour(G, s, null, opt).par).flat();
    for (const a of acts) { if (a.kind === 'rupture') note(a.unit, c => c.ruptures++); if (a.kind === 'guard') note(a.unit, c => c.gardes++); }
    const f = s.forecast;
    s = jouerTour(G, s, acts, 0);
    for (const l of s.log || []) if (l.type === 'damage' && l.unit && l.amount > 0) note(l.unit, c => c.degats += l.amount);
    if (s.log?.some(l => l.type === 'ultimate-failed')) causes.push('kc');
    if (s.outcome) { if (s.outcome !== 'WON') s.cause = s.reason === 'Plafond de tours atteint.' ? ['tours-cioccolata', 'tours-secco', 'tours-diavolo'][s.stage] : causes.includes('kc') ? 'kc' : f?.kind === 'cloud' ? 'nuage' : s.stage === 1 ? 'secco' : 'ko-' + s.stage; break; }
    G.prepareRaidTurn(s, 0);
  }
  const deg = sieges(s).map(p => Object.entries(parCarte).filter(([k]) => k.startsWith('p' + p + '-')).reduce((a, [, c]) => a + c.degats, 0));
  return { outcome: s.outcome || 'FAILED', gagne: s.outcome === 'WON', stage: s.stage, phase: s.phase, tour: s.turn, cause: s.cause || null, degats: deg, parCarte };
}

// Coequipiers tires au hasard (graine fixe) : moyens = epiques niveau 70, bons = epiques et legendaires 99, forts = legendaires et mythiques 99.
export const GROUPES = [{ id: 'moyens', nom: 'Coéquipiers moyens', r: ['E'], lv: 70 }, { id: 'bons', nom: 'Coéquipiers bons', r: ['E', 'L'], lv: 99 }, { id: 'forts', nom: 'Coéquipiers forts', r: ['L', 'M'], lv: 99 }];
export function tirages(G, groupe, n, nb = 2, graine = 777) {
  const pool = Object.values(G.CHAR_BY_ID).filter(c => !c.raidExclusive && !c.special && groupe.r.includes(c.r)).map(c => c.id).sort((a, b) => a - b);
  let x = graine >>> 0; const rnd = () => (x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296;
  return Array.from({ length: n }, () => Array.from({ length: 3 * nb }, () => ({ id: pool[Math.floor(rnd() * pool.length)], lv: groupe.lv, stars: 0 })));
}
// Roster : ton trio au siege 0, puis les coequipiers (3 cartes par siege).
export const roster = (moi, autres) => [...moi, ...autres].map((c, i) => ({ id: c.id, lv: c.lv, stars: c.stars || 0, owner: Math.floor(i / 3) }));
