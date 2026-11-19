// Liens actifs (collectifs) : les 6 a garder pour une carte qui en a plus, cherches sur les combats de son trio (5.41).
// Regle du jeu (lue dans le moteur) : un lien est actif si 2 de ses cartes sont dans l'equipe ; chaque carte en garde 6
// (G.LINK_CAP), ceux choisis (lk) d'abord, sinon les plus gros % (G.linkOrder). Un lien ne fait qu'une chose : ajouter
// un % a une stat de la carte. Deux choix qui donnent les memes totaux par stat jouent donc le meme combat.
// Recherche :
//   1) totaux distincts : on garde un choix par total (Pain (Akatsuki) avec Pain : 210 choix, 83 totaux) ;
//   2) front de Pareto : un total qui a autant ou moins partout (ATK, DEF, PV, critique, energie, a VIT egale) qu'un autre
//      est retire (83 -> 25). La VIT n'est pas comparee : elle change l'ordre des tours. Controle : quelques retires jouent
//      quand meme le 1er tirage, et le resultat dit si l'un d'eux a fait mieux que le meilleur garde ;
//   3) elimination par manches : chaque total garde joue les combats du trio (1 tirage, memes graines pour tous), les 4
//      meilleurs et ton reglage actuel jouent `conf` tirages de plus. Le meilleur n'est conseille que s'il bat ton reglage
//      de plus de 2 ecarts types.
// Les cartes du trio sont cherchees l'une apres l'autre (la 2e avec le choix retenu pour la 1re).

export const STATS = ['atk', 'def', 'hp', 'crit', 'spd', 'energy'];
const MONO = STATS.map(s => s !== 'spd'); // VIT comparee a egalite seulement

// Liens actifs de la carte `id` dans le trio, et choix distincts par totaux de stats (un representant par total).
export function profilsLiens(G, trio, id, cap = G.LINK_CAP || 6) {
  const liens = G.activeLinks(trio).filter(l => l.ids.includes(id)).sort(G.linkOrder);
  if (liens.length <= cap) return { liens, actifs: liens.length, tous: 1, distincts: [], gardes: [] };
  const v = liens.map(l => STATS.map(s => (s === l.stat ? l.pct : 0))), n = liens.length, par = new Map();
  let tous = 0;
  const rec = (i, k, acc, pris) => {
    if (k === 0) { tous++; const c = acc.join(','); if (!par.has(c)) par.set(c, { v: acc, cles: pris.map(j => G.linkKey(liens[j])) }); return; }
    if (n - i < k) return;
    pris.push(i); rec(i + 1, k - 1, acc.map((x, j) => x + v[i][j]), pris); pris.pop();
    rec(i + 1, k, acc, pris);
  };
  rec(0, cap, STATS.map(() => 0), []);
  const distincts = [...par.values()];
  const domine = (p, q) => STATS.every((_, j) => (MONO[j] ? q.v[j] >= p.v[j] : q.v[j] === p.v[j])) && STATS.some((_, j) => q.v[j] > p.v[j]);
  const gardes = distincts.filter(p => !distincts.some(q => q !== p && domine(p, q)));
  return { liens, actifs: n, tous, distincts, gardes };
}

const parStat = (liens, cles) => { const o = {}; for (const k of cles) { const l = liens.find(x => x.series + '|' + x.name === k); if (l) o[l.stat] = (o[l.stat] || 0) + l.pct; } return o; };

// o : { G, pool, WA, cibles: [{ trio: [ids], fights: [combats] }], carte(id, lk) -> carte d'equipe, lkDe(id) -> reglage actuel,
//       nom(id), conf, controle, log }
export async function chercherLiens(o) {
  const { G, pool, WA, cibles, carte, lkDe, nom, log } = o, conf = o.conf ?? 6, nCtrl = o.controle ?? 8;
  const seeds2 = Array.from({ length: conf }, (_, i) => 2 + i);
  let simules = 0; const T0 = Date.now();
  const jouer = async (jobs, taille) => { const r = await pool.runAll(jobs, WA, { stop3: true }, taille); simules += jobs.reduce((a, j) => a + j.fights.length * j.seeds.length, 0); return r; };
  const trois = st => { let s = 0; for (const c of st) if (c === '3') s++; return s; };
  const label = (liens, k) => { const l = liens.find(x => x.series + '|' + x.name === k); return l ? `${l.name} (+${l.pct} % ${({ atk: 'ATK', def: 'DEF', hp: 'PV', crit: 'critique', spd: 'VIT', energy: 'énergie' })[l.stat] || l.stat})` : k; };
  const out = [];
  for (const { trio, fights } of cibles) {
    if (!fights.length) continue;
    const choix = {}; // reglage retenu par carte pour ce trio
    for (const id of trio) {
      const P = profilsLiens(G, trio, id); if (!P.gardes.length) continue;
      const equipe = lk => trio.map(x => carte(x, x === id ? lk : (choix[x] || lkDe(x))));
      const actuel = lkDe(id) || null, cleActuel = (actuel || G.linkPlan(trio, {}).kept[id].map(G.linkKey)).slice().sort().join('+');
      // 1) chaque total garde (et ton reglage actuel) : 1 tirage sur tous les combats du trio
      const cands = P.gardes.map(p => ({ cles: p.cles, v: p.v })), iAct = cands.findIndex(c => c.cles.slice().sort().join('+') === cleActuel);
      if (iAct < 0) cands.push({ cles: actuel || G.linkPlan(trio, {}).kept[id].map(G.linkKey), actuel: true }); else cands[iAct].actuel = true;
      const r1 = await jouer(cands.map(c => ({ type: 'etoiles', team: equipe(c.cles), fights, seeds: [1] })), 4);
      cands.forEach((c, j) => { c.st1 = r1[j].st; c.s1 = trois(r1[j].st); });
      // controle de la regle « plus de stat n'est jamais pire » : quelques totaux retires, meme tirage
      const retires = P.distincts.filter(p => !P.gardes.includes(p)), pas = Math.max(1, Math.floor(retires.length / nCtrl)), ctrl = retires.filter((_, j) => j % pas === 0).slice(0, nCtrl);
      const rc = ctrl.length ? await jouer(ctrl.map(p => ({ type: 'etoiles', team: equipe(p.cles), fights, seeds: [1] })), 4) : [];
      // 2) les 4 meilleurs et ton reglage : `conf` tirages de plus
      const ordre = cands.slice().sort((a, b) => b.s1 - a.s1), fin = [...new Set([...ordre.slice(0, 4), cands.find(c => c.actuel)])];
      const r2 = await jouer(fin.map(c => ({ type: 'etoiles', team: equipe(c.cles), fights, seeds: seeds2 })), 2);
      const nF = fights.length, nT = 1 + conf;
      fin.forEach((c, j) => {
        const st = r2[j].st; c.s = c.s1 + trois(st); c.p = c.s / (nF * nT);
        c.parCombat = fights.map((_, k) => { let s = c.st1[k] === '3' ? 1 : 0; for (let t = 0; t < conf; t++) if (st[t * nF + k] === '3') s++; return s / nT; });
      });
      fin.sort((a, b) => b.p - a.p);
      const best = fin[0], act = fin.find(c => c.actuel), se = c => Math.sqrt(c.p * (1 - c.p) / (nF * nT));
      const utile = best !== act && best.p - act.p > 2 * Math.hypot(se(best), se(act));
      if (utile) choix[id] = best.cles;
      const seuil = o.seuil ?? 0.6, surs = c => c.parCombat.filter(x => x >= seuil).length;
      const mieuxCtrl = rc.filter(y => trois(y.st) > best.s1).length;
      const tout = P.liens.map(l => G.linkKey(l)), garde = utile ? best.cles : act.cles;
      out.push({ equipe: trio.map(nom), ids: trio, carte: nom(id), id, actifs: P.actifs, choix: { tous: P.tous, distincts: P.distincts.length, gardes: P.gardes.length },
        combats: nF, tirages: nT, avant: +(100 * act.p).toFixed(1), apres: +(100 * (utile ? best.p : act.p)).toFixed(1), utile,
        sursAvant: surs(act), sursApres: surs(utile ? best : act),
        conseil: garde.map(k => label(P.liens, k)), cles: garde, retirer: tout.filter(k => !garde.includes(k)).map(k => label(P.liens, k)),
        stats: parStat(P.liens, garde), controle: { testes: ctrl.length, mieux: mieuxCtrl } });
      log(`liens ${trio.map(nom).join(' / ')}, ${nom(id)} : ${P.tous} choix, ${P.distincts.length} totaux, ${P.gardes.length} gardes ; 3 etoiles ${(100 * act.p).toFixed(1)} -> ${(100 * best.p).toFixed(1)} %${utile ? '' : ' (pas nettement mieux, garde le tien)'} sur ${nF} combats ; controle ${mieuxCtrl}/${ctrl.length} retire(s) mieux`);
    }
  }
  return { date: new Date().toISOString(), duree: Math.round((Date.now() - T0) / 1000), simules, cartes: out };
}

// Cibles depuis le resultat par combat (lib/etages.mjs) : chaque trio du plan, avec les combats ou il est le trio du plan.
export function ciblesDuPlan(G, etages, trioMin = 1) {
  if (!etages?.trios || !etages.combats) return [];
  const cap = G.LINK_CAP || 6, out = [];
  etages.plan.forEach(({ trio }) => {
    const ids = etages.trios[trio]; if (!ids) return;
    const act = G.activeLinks(ids); if (!ids.some(id => act.filter(l => l.ids.includes(id)).length > cap)) return;
    const fights = etages.combats.filter(c => c[4] === trio).map(c => c[0]);
    if (fights.length >= trioMin) out.push({ trio: ids, fights });
  });
  return out;
}
