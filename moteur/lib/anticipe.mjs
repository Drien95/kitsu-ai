// IA qui anticipe : pour chaque decision, on essaie les meilleures actions de l'IA de base,
// on simule la suite du combat plusieurs fois (copie de l'etat), et on garde l'action qui donne
// le plus souvent 2 etoiles ou plus (puis 3 etoiles). Lent, sert a mesurer le plafond de l'IA.
export function makeAnticipe(G, B, S, W, { K = 3, R = 3 } = {}) {
  const base = S.smartPol(W);
  const COST = { basic: 10, skill: 25, ult: 20, rest: -45 };
  const clone = (st, seed) => { const { rng, ...rest } = st; const c = structuredClone(rest); c.rng = B.seeded(seed); return c; };
  const cands = (st, u) => { const out = [{ kind: 'rest' }], foes = B.foes(st, u); for (const k of ['basic', 'skill', 'ult']) { if (B.needsTarget(u, k)) { for (const t of foes) if (B.legal(st, u, k, t)) out.push({ kind: k, target: t }); } else if (B.legal(st, u, k, null)) out.push({ kind: k }); } return out; };
  const val = st => { const win = B.outcome(st) === 'win'; let ko = 0; for (const x of B.allies(st)) if (!x.alive) ko++; if (!win) return -ko * 0.05; const stars = Math.min(st.cycle > 8 ? 2 : 3, Math.max(1, 3 - ko)); return stars >= 2 ? 1 + (stars === 3 ? 0.3 : 0) : 0.3; };
  const playOut = st => { for (let i = 0; i < 400; i++) { const u = S.step(st); if (!u) break; S.doAct(st, u, base(st, u)); } return st; };
  let seedCtr = 1;
  return (st, u) => {
    const all = cands(st, u); if (all.length <= 1) return all[0];
    // pre-tri par l'IA de base : on garde les K meilleures actions + celle de l'IA de base
    const pick = base(st, u), scored = [pick, ...all.filter(c => c !== pick)].slice(0, Math.max(K, 1) + 2);
    const ui = st.units.indexOf(u);
    let best = pick, bv = -1e9;
    for (const c of scored.slice(0, K + 1)) {
      let v = 0;
      for (let r = 0; r < R; r++) {
        const s2 = clone(st, (seedCtr = (seedCtr * 16807) % 2147483647)), u2 = s2.units[ui];
        const c2 = c.target ? { kind: c.kind, target: s2.units[st.units.indexOf(c.target)] } : { kind: c.kind };
        S.doAct(s2, u2, c2); v += val(playOut(s2));
      }
      if (v > bv + 1e-9) { bv = v; best = c; }
    }
    return best;
  };
}
