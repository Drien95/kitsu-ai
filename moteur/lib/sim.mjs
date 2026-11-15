// Simulation d'un combat avec la meme IA que le userscript (politique lineaire sur 19 criteres).
// Regle des etoiles du jeu : etoiles = max(1, 3 - K.O.), plafonnees a 2 si le combat depasse le cycle 8.
// Donc 2 etoiles ou plus = victoire avec au plus 1 K.O. ; 3 etoiles = aucun K.O. et cycle <= 8.
export const W_DEFAUT = {
  norm: [0.1933,-0.5256,0.4111,1.7846,-0.1384,0.0592,0.4946,1.1049,0.6246,0.094,1.1405,0.437,2.0554,0.077,0.3738,-0.6323,0.0012,-0.0684,-0.6149],
  boss: [0.0647,-0.4792,0.9519,2.1617,-0.3986,0.6054,0.7547,1.2413,0.7783,0.0479,1.2698,0.4325,2.1071,-0.1634,0.4417,-0.879,-0.0136,1.0088,-0.8569],
  nm: [-0.3042,-0.8322,0.7914,1.6557,-0.2005,1.2199,0.9199,0.3791,0.5382,0.0507,1.0024,0.5477,1.5751,-0.6616,0.5372,-0.6145,-0.0156,0.7633,-0.8152],
  tower: [-0.2911,-0.7984,0.8698,2.0784,-0.1861,0.9833,1.0596,1.5232,0.2841,0.6186,1.5002,0.9077,1.6502,-0.4352,0.1318,-0.6398,0.4653,0.7975,0.1358],
};
const COST = { basic: 10, skill: 25, ult: 20, rest: -45 };
export function makeSim(G, B) {
  const findF = id => G.EVENT_FIGHTS?.[id] || G.findFight(id);
  const step = st => {
    for (let i = 0; i < 300; i++) {
      if (B.outcome(st)) return null;
      const u = B.nextActor(st); const { skip } = B.startTurn(st, u);
      if (!u.alive || skip || B.outcome(st)) { u.av = 1e4 / u.spd; continue; }
      if (u.side === 'ally') return u;
      B.enemyAct(st, u);
    }
    return null;
  };
  const doAct = (st, u, c) => { if (!B.legal(st, u, c.kind, c.target || null)) B.act(st, u, 'rest'); else B.act(st, u, c.kind, c.target && B.needsTarget(u, c.kind) ? c.target : undefined); };
  const cands = (st, u) => { const out = [{ kind: 'rest' }], foes = B.foes(st, u); for (const k of ['basic', 'skill', 'ult']) { if (B.needsTarget(u, k)) { for (const t of foes) if (B.legal(st, u, k, t)) out.push({ kind: k, target: t }); } else if (B.legal(st, u, k, null)) out.push({ kind: k }); } return out; };
  const feat = (st, u, c, low, foes, charging) => {
    const t = c.target, pv = t ? B.preview(st, u, t, c.kind) : null, dmg = pv ? pv.dmg : 0;
    const role = c.kind !== 'rest' && c.kind !== 'basic' ? B.kitRole(u, c.kind) : {};
    const big = c.kind === 'skill' || c.kind === 'ult' ? 1 : 0;
    return [c.kind === 'rest' ? 1 : 0, c.kind === 'basic' ? 1 : 0, c.kind === 'skill' ? 1 : 0, c.kind === 'ult' ? 1 : 0,
      t ? Math.min(1, dmg / Math.max(1, t.hp)) : 0, t && dmg >= t.hp ? 1 : 0, t && t.charging ? 1 : 0,
      t && t.toughMax ? Math.min(1, (pv?.tough || 0) / Math.max(1, t.tough)) : 0, pv ? (pv.adv > 0 ? 1 : pv.adv < 0 ? -1 : 0) : 0,
      (st.end - (COST[c.kind] || 0)) / 100, (role.heal || role.shield || role.taunt || role.protect) ? (1 - low) : 0,
      role.aoe ? Math.min(3, role.aoe) * foes.length / 3 : 0, charging * big, (u.energy || 0) / 100 * (c.kind === 'skill' ? 1 : 0),
      role.control ? 1 : 0, role.buff ? 1 : 0, (t && t.status && (t.status.defDown || t.status.def_moins) ? 1 : 0) * big,
      st.end < 25 && c.kind === 'rest' ? 1 : 0, (u.energy || 0) >= 80 && c.kind === 'basic' ? 1 : 0];
  };
  // Valeurs communes (PV le plus bas, ennemis, charge) calculees une fois par decision, pas par action candidate.
  const policy = w => (st, u) => {
    const al = B.allies(st).filter(x => x.alive), low = Math.min(...al.map(x => x.hp / x.maxHp)), foes = B.foes(st, u), charging = foes.some(e => e.charging) ? 1 : 0;
    let best = null, bv = -1e9;
    for (const c of cands(st, u)) { const f = feat(st, u, c, low, foes, charging); let v = 0; for (let i = 0; i < f.length; i++) v += (w[i] || 0) * f[i]; if (v > bv) { bv = v; best = c; } }
    return best;
  };
  const hasBoss = st => B.enemies(st).some(e => e.boss);
  const smartPol = W => { const pn = policy(W.norm), pb = policy(W.boss), pm = policy(W.nm || W.boss), pt = policy(W.tower || W.norm); return (st, u) => (st.__tower ? pt : st.ai === 'nm' ? pm : hasBoss(st) ? pb : pn)(st, u); };
  // Un combat. stop2 : arret des que 2 allies sont K.O. (2 etoiles deviennent impossibles).
  const fight = (fid, team, seed, pol, { stop2 = false } = {}) => {
    const st = G.setupBattle(findF(fid), team, seed).st;
    for (let i = 0; i < 400; i++) {
      const u = step(st); if (!u) break;
      doAct(st, u, pol(st, u));
      if (stop2) { let ko = 0; for (const x of B.allies(st)) if (!x.alive) ko++; if (ko >= 2) return { win: false, ko, cycle: st.cycle, stars: 0, cut: true }; }
    }
    const win = B.outcome(st) === 'win';
    let ko = 0; for (const x of B.allies(st)) if (!x.alive) ko++;
    let stars = 0; if (win) { stars = Math.max(1, 3 - ko); if (st.cycle > 8) stars = Math.min(stars, 2); }
    return { win, ko, cycle: st.cycle, stars };
  };
  // Tour de l'infini : on enchaine les etages avec les PV qui restent (soin entre les etages, comme le jeu).
  const tower = (team0, seed, pol, maxFl = 300) => {
    const TW = G.TOWER || { HEAL: 0.12, BOSS_HEAL: 0.3 }; let team = team0.map(m => ({ ...m }));
    for (let fl = 1; fl <= maxFl; fl++) {
      const { st } = G.setupTower(fl, team, seed * 1000 + fl); st.__tower = 1;
      for (let i = 0; i < 400; i++) { const u = step(st); if (!u) break; doAct(st, u, pol(st, u)); }
      if (B.outcome(st) !== 'win') return fl - 1;
      const heal = G.isBossFloor?.(fl) ? TW.BOSS_HEAL : TW.HEAL;
      team = team.map(m => { const u = B.allies(st).find(x => x.id === m.id); return !u || !u.alive ? { ...m, alive: false, hp: 0 } : { ...m, alive: true, hp: Math.min(u.maxHp, u.hp + u.maxHp * heal) }; });
    }
    return maxFl;
  };
  // Boss de guilde : degats en N cycles, plafonnes comme dans le jeu.
  const gw = (team, seed, pol, boss) => {
    const { st, hp0 } = G.setupGwBoss(boss.id, boss.lv, boss.hp, team, seed);
    for (let i = 0; i < 800 && st.cycle <= boss.turns; i++) { const u = step(st); if (!u || st.cycle > boss.turns) break; doAct(st, u, pol(st, u)); }
    return Math.min(boss.cap || 300000, hp0 - B.enemies(st)[0].hp);
  };
  return { step, doAct, policy, smartPol, fight, tower, gw };
}
