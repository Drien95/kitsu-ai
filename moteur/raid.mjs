// Raid « Le Destin Effacé » : meilleur trio de ta collection, contre des coequipiers inconnus (3 niveaux, a 2 ou 3 joueurs).
// Chaque trio joue des raids complets avec le code du jeu et la strategie de KitsuAI (lib/raid.mjs) : Ruptures planifiees,
// Garde sur les cartes visees, Reanimation. Les meilleurs rejouent avec plus de tirages, avec le role de chaque carte.
//   node raid.mjs [--niveaux actuel|99] [--min-niveau 60] [--max-cartes 16] [--tirages 8] [--finale 10] [--fils 11]
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { arg, log, SAVE, lvOf, stOf, ecrire } from './lib/commun.mjs';
import { GROUPES, tirages } from './lib/raid.mjs';
import { garderEveille } from './lib/eveil.mjs';
import { limitePuissance, decrireLimite, eveilDe } from './lib/puissance.mjs';

const { G, version } = await loadEngine(); const CH = G.CHAR_BY_ID;
// 5.62 : limite de puissance (V2) sur les trios et Eveil (aw / awakened, niveau 100) sur les cartes.
const LIM = limitePuissance(G, SAVE), EV = eveilDe(SAVE, G, LIM);
const NIV = arg('niveaux', 'actuel'), LV = NIV === '99' ? id => EV.niveauMax(id) : lvOf, MIN = +arg('min-niveau', 60);
const nom = id => CH[id]?.n || String(id);
let IDS = Object.keys(SAVE.owned || {}).map(Number).filter(id => CH[id] && !CH[id].raidExclusive && ['M', 'L', 'E'].includes(CH[id].r) && (NIV === '99' || lvOf(id) >= MIN));
const actuelle = (SAVE.team || []).map(Number).filter(id => CH[id]);
// Trop de cartes : on garde les plus fortes (niveau, puis puissance de la carte), plus ton equipe actuelle.
const MAXC = +arg('max-cartes', 16);
// 5.62 : avec la limite de puissance, une LR ne va plus avec deux LR : au moins la moitie des places pour des UR / SSR.
if (IDS.length > MAXC) { const tri = IDS.sort((a, b) => LV(b) - LV(a) || (CH[b].pw || 0) - (CH[a].pw || 0)), moitie = LIM.actif ? tri.filter(id => CH[id].r !== 'M').slice(0, MAXC >> 1) : []; IDS = [...new Set([...actuelle.filter(id => IDS.includes(id)), ...moitie, ...tri])].slice(0, MAXC); }
if (IDS.length < 3) { console.log(`Moins de 3 cartes LR, UR ou SSR ${NIV === '99' ? '' : `au niveau ${MIN} ou plus `}dans la sauvegarde exportee.`); process.exit(1); }
const mk = ids => ids.map(id => ({ id, lv: LV(id), stars: stOf(id), ...EV.champs(id) }));
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const N = +arg('tirages', 8), TAILLES = [3, 2];
log(`${decrireLimite(LIM)}`);
log(`moteur ${version}, ${IDS.length} cartes (${NIV === '99' ? 'niveau 99' : 'niveau ' + MIN + ' ou plus'}), ${pool.n} fils`);
const tr = []; const S_ = [...IDS].sort((a, b) => a - b); for (let a = 0; a < S_.length; a++) for (let b = a + 1; b < S_.length; b++) for (let c = b + 1; c < S_.length; c++) if (LIM.ok([S_[a], S_[b], S_[c]])) tr.push([S_[a], S_[b], S_[c]]);
const cle = t => t.slice().sort((a, b) => a - b).join('-');
if (actuelle.length === 3 && LIM.ok(actuelle) && !tr.some(t => cle(t) === cle(actuelle))) tr.push(actuelle);
// Cases : groupe de coequipiers x nombre de joueurs. Memes coequipiers pour tous les trios (comparaison juste).
const cases = (n, graine) => GROUPES.flatMap((g, gi) => TAILLES.map(t => ({ id: `${g.id}-${t}`, groupe: g.id, joueurs: t, autres: tirages(G, g, n, t - 1, graine + gi * 101 + t) })));
const eveil = garderEveille(), T0 = Date.now();
async function evaluer(trios, n, graine, detail) {
  const C = cases(n, graine), jobs = trios.flatMap(t => C.map(c => ({ type: 'raid', moi: mk(t), autres: c.autres, graine, detail })));
  const r = await pool.runAll(jobs, {}, {}, 2);
  return { C, res: trios.map((t, i) => Object.fromEntries(C.map((c, k) => [c.id, r[i * C.length + k]]))), raids: jobs.length * n };
}
log(`${tr.length} trios, ${GROUPES.length * TAILLES.length} cas (coequipiers moyens, bons, forts ; a 3 et a 2 joueurs), ${N} tirages par cas`);
const E1 = await evaluer(tr, N, 7919, false); let raids = E1.raids;
const note = r => Object.values(r).reduce((a, x) => a + x.win / x.n, 0) / Object.keys(r).length;
const pre = tr.map((t, i) => ({ t, r: E1.res[i], note: note(E1.res[i]) })).sort((a, b) => b.note - a.note);
log(`premier tour : ${raids} raids en ${Math.round((Date.now() - T0) / 1000)} s ; en tete ${pre.slice(0, 3).map(x => x.t.map(nom).join(' / ') + ' ' + Math.round(100 * x.note) + ' %').join(' ; ')}`);
// Finale : les meilleurs et ton trio actuel, 3 fois plus de tirages (autres coequipiers), avec le detail par carte.
const fin0 = pre.slice(0, +arg('finale', 10)).map(x => x.t); if (actuelle.length === 3 && !fin0.some(t => cle(t) === cle(actuelle))) fin0.push(actuelle);
const E2 = await evaluer(fin0, 3 * N, 104729, true); raids += E2.raids;
const pct = (x, k) => +(100 * x[k] / x.n).toFixed(1);
const ligne = (t, r) => {
  const par = Object.fromEntries(Object.entries(r).map(([k, x]) => [k, { victoire: pct(x, 'win'), etape: +(x.etape / x.n).toFixed(2), part: +(100 * x.part / x.n).toFixed(1), causes: x.causes }]));
  const cartes = {}; for (const x of Object.values(r)) for (const [k, c] of Object.entries(x.cartes || {})) { const d = cartes[k] ||= { degats: 0, ruptures: 0, gardes: 0, part: 0, n: 0 }; d.degats += c.degats; d.ruptures += c.ruptures; d.gardes += c.gardes; d.part += c.part; d.n += x.n; }
  const roles = t.map((id, i) => { const c = cartes['p0-' + i] || { n: 1 }; const n = c.n || 1; return { id, carte: nom(id), part: +(100 * (c.part || 0) / n).toFixed(1), ruptures: +((c.ruptures || 0) / n).toFixed(1), gardes: +((c.gardes || 0) / n).toFixed(1) }; });
  const maxP = Math.max(...roles.map(x => x.part)); roles.forEach(x => x.role = x.ruptures >= 1.5 && x.part < maxP ? 'rupture' : x.part >= maxP * 0.6 ? 'degats' : 'soutien');
  return { ids: t, equipe: t.map(nom), niveaux: t.map(LV), etoiles: t.map(stOf), note: +(100 * note(r)).toFixed(1), par, roles };
};
const fin = fin0.map((t, i) => ligne(t, E2.res[i])).sort((a, b) => b.note - a.note);
const act = actuelle.length === 3 ? fin.find(x => cle(x.ids) === cle(actuelle)) || null : null;
fin.slice(0, 5).forEach((x, i) => log(`  ${i + 1}. ${x.equipe.join(' / ')} : ${x.note} % de victoires en moyenne (bons a 3 : ${x.par['bons-3'].victoire} %)`));
if (act) log(`  ton equipe : ${act.equipe.join(' / ')} : ${act.note} %`);
const out = { version, date: new Date().toISOString(), niveaux: NIV, minNiveau: MIN, cartes: IDS.length, trios: tr.length, tirages: N, raids, duree: Math.round((Date.now() - T0) / 1000),
  vitesse: Math.round(raids / Math.max(1, (Date.now() - T0) / 1000)), groupes: GROUPES.map(g => ({ id: g.id, nom: g.nom, raretes: g.r, niveau: g.lv })), joueurs: TAILLES,
  classement: fin, equipeActuelle: act, premierTour: pre.slice(0, 40).map(x => ({ ids: x.t, note: +(100 * x.note).toFixed(1) })) };
ecrire('raid.json', out);
log('termine : resultats\\raid.json');
eveil.fin(); await pool.close(); process.exit(0);
