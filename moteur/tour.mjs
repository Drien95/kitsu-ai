// Tour de l'infini, analyse detaillee : meilleur trio POUR la Tour, etages ou les montees s'arretent, collectifs.
// Methode (5.14.1) : TOUS les trios de tes SSR/UR/LR font une course avec elimination (une montee par manche, meme graine
// pour tous, abandon quand un trio est nettement derriere le Ke meilleur), puis les 20 meilleurs font 30 montees de plus.
// Journal (cache/tour-*.jsonl) : une montee deja faite n'est pas refaite tant que le combat, la Tour, la carte et l'IA sont les memes.
//   node tour.mjs [--niveaux actuel|99] [--garder 200] [--z 3] [--manches 10] [--finale 20] [--tirages 30] [--fils 11]
//   tests : --max-trios 2000 (trios au hasard)
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { writeFileSync } from 'node:fs';
import { arg, log, SAVE, WA, lvOf, stOf, ecrire, readJ } from './lib/commun.mjs';
import { dir as D } from './lib/chemins.mjs';
import { makeTour, statsEtages } from './lib/tour.mjs';
import { makeSim } from './lib/sim.mjs';
import { shuffle } from './lib/commun.mjs';
import { h53, signatureCombat, makeSigCarte, ouvrirJournal } from './lib/journal.mjs';
import { garderEveille } from './lib/eveil.mjs';

const { G, B, version } = await loadEngine(); const CH = G.CHAR_BY_ID;
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
const NIV = arg('niveaux', 'actuel'), LV = NIV === '99' ? () => 99 : lvOf;
const nom = id => CH[id]?.n || String(id), noms = t => t.map(nom).join(' / ');
const IDS = Object.keys(SAVE.owned || {}).map(Number).filter(id => ['M', 'L', 'E'].includes(CH[id]?.r));
if (!IDS.length) { console.log('Aucune carte LR, UR ou SSR dans la sauvegarde exportee.'); process.exit(1); }
const mk = (ids, lk = {}) => ids.map(id => { const l = lk[id] || SAVE.lk?.[id]; return { id, lv: LV(id), stars: stOf(id), ...(l ? { lk: l } : {}) }; });
const actuelle = (SAVE.team || []).map(Number).filter(id => IDS.includes(id));
const T = makeTour({ G, B, pool, W: WA, ids: IDS, mk, actuelle, log });
log(`moteur ${version}, ${IDS.length} cartes LR/UR/SSR, niveaux ${NIV}, ${pool.n} fils`);

// Signatures du journal : code de combat, etages de la Tour (ennemis de quelques etages), IA, chaque carte.
const SIM = makeSim(G, B), sigG = signatureCombat(G, B, SIM, WA), wKey = h53(JSON.stringify(WA)), sigCarte = makeSigCarte(G, B);
const sigT = h53(String(G.setupTower) + '#' + [1, 10, 37, 100, 150, 250, 400].map(fl => { try { return JSON.stringify(B.enemies(G.setupTower(fl, mk([IDS[0]]), 7).st).map(e => [e.id, e.lv, e.atk, e.def, e.maxHp, e.spd, e.boss ? 1 : 0])); } catch { return fl; } }).join('|'));
const J = ouvrirJournal(D('cache', `tour-${sigG}-${sigT}-${wKey}.jsonl`));
const cleCarte = id => { const c = mk([id])[0]; return `${id}:${c.lv}:${c.stars}:${(c.lk || []).join('+')}:${sigCarte(id)}`; };
let tr = []; const S_ = [...IDS].sort((a, b) => a - b); for (let a = 0; a < S_.length; a++) for (let b = a + 1; b < S_.length; b++) for (let c = b + 1; c < S_.length; c++) tr.push([S_[a], S_[b], S_[c]]);
if (arg('max-trios')) tr = shuffle(tr, 5).slice(0, +arg('max-trios'));
const cles = tr.map(t => t.map(cleCarte).sort().join(','));
const eveil = garderEveille(), T0 = Date.now(); let dernierLog = Date.now();
log(`${tr.length} trios, journal ${J.taille()} montees${eveil.ok ? ', PC garde eveille' : ''}`);
const solo0 = await T.climb(IDS.map(id => mk([id])), [1, 2], 16);
const solo = IDS.map((id, i) => ({ id, etage: (solo0[i][0] + solo0[i][1]) / 2 })).sort((a, b) => b.etage - a.etage);
const C = await T.course({ trios: tr, cle: t => cles[t], J, garder: +arg('garder', 200), z: +arg('z', 3), manches: +arg('manches', 10), onManche: x => {
  if (x.fin) log(`manche ${x.r}/${x.manches} : ${x.avant} -> ${x.apres} trios en course, ${x.montees} montees simulees (${Math.round(x.vitesse)}/s), ${x.repris} reprises du journal`);
  else if (Date.now() - dernierLog > 60000) { dernierLog = Date.now(); log(`  manche ${x.r} : ${x.fait} / ${x.total} montees, ${Math.round(x.vitesse)} montees/s`); } } });
// Finale : les meilleurs (et ton trio actuel) font beaucoup de montees de plus, sur d'autres graines.
const top = C.classement.slice(0, +arg('finale', 20)).map(x => x.t);
if (actuelle.length === 3 && !top.some(t => t.slice().sort().join() === actuelle.slice().sort().join())) top.push(actuelle);
const r2 = await T.climb(top.map(t => mk(t)), Array.from({ length: +arg('tirages', 30) }, (_, i) => 101 + i), 1);
const fin = top.map((t, i) => ({ t, fl: r2[i], ...statsEtages(r2[i]) })).sort((a, b) => b.moy - a.moy), essais = tr.length;
const act = actuelle.length === 3 ? fin.find(x => x.t.slice().sort().join() === actuelle.slice().sort().join()) || null : null;
log(`finale : ${top.length} trios, ${+arg('tirages', 30)} montees chacun`);
const ligne = x => ({ equipe: x.t.map(nom), ids: x.t, etageMoyen: +x.moy.toFixed(1), marge: +(2 * x.se).toFixed(1), min: x.min, p10: x.p10, mediane: x.med, max: x.max });
const out = { version, date: new Date().toISOString(), niveaux: NIV, record: SAVE.tower?.best ?? null, triosEssayes: essais, cartes: IDS.length,
  methode: 'course', entonnoir: C.entonnoir, monteesSimulees: C.montees, reprisesJournal: C.repris, duree: Math.round((Date.now() - T0) / 1000), vitesse: Math.round(C.montees / Math.max(1, C.duree)),
  classement: C.classement.slice(0, 200).map(x => ({ ids: x.t, etageMoyen: +x.moy.toFixed(1), montees: x.n })),
  // Suite du classement (trios en course apres les 200 premiers, puis les mieux places des ecartes) : prefiltre du departage exact.
  classementLarge: [...C.classement.slice(200), ...C.ecartes].slice(0, 1500).map(x => ({ ids: x.t, etageMoyen: +x.moy.toFixed(1), montees: x.n })),
  cartesSeules: solo.slice(0, 10).map(x => ({ carte: nom(x.id), id: x.id, etage: x.etage })), trios: fin.slice(0, 8).map(ligne), equipeActuelle: act ? ligne(act) : null };
log(`cartes seules : ${solo.slice(0, 5).map(x => `${nom(x.id)} ${x.etage}`).join(', ')}`);
fin.slice(0, 5).forEach((x, i) => log(`  ${i + 1}. ${noms(x.t)} : etage moyen ${x.moy.toFixed(1)} (+/- ${(2 * x.se).toFixed(1)}), 10 % des montees sous ${x.p10}, max ${x.max}`));
out.murs = T.murs(fin[0]);
out.murs.forEach(m => log(`  arret a l'etage ${m.etage} : ${m.part} % des montees (${m.ennemis.join(', ')})`));
out.collectifs = (await T.collectifs(fin[0].t, { tirages: +arg('tirages', 30) })).map(l => ({ carte: nom(l.id), ...l }));
out.collectifs.forEach(l => log(`collectifs ${l.carte} : etage moyen ${l.avant} puis ${l.apres}${l.utile ? '' : ' (pas significatif, garde les tiens)'}`));
ecrire('tour.json', out);
// Le panneau affiche la categorie « tour » de la derniere analyse : on la remplace par ce resultat plus complet.
const prec = readJ(D('resultats', 'dernier.json'));
if (prec?.modes) { prec.modes[NIV] ??= {}; prec.modes[NIV].tour = { titre: "Tour de l'infini", trios: essais, date: out.date, top: fin.slice(0, 5).map(x => ({ equipe: x.t.map(nom), ids: x.t, etageMoyen: +x.moy.toFixed(1), etageMin: x.min, p10: x.p10, max: x.max })), murs: out.murs, collectifs: out.collectifs }; writeFileSync(D('resultats', 'dernier.json'), JSON.stringify(prec)); }
log('termine : resultats\\tour.json');
eveil.fin(); await pool.close(); process.exit(0);
