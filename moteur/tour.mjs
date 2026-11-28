// Tour de l'infini, analyse detaillee : meilleur trio POUR la Tour, etages ou les montees s'arretent, collectifs.
// Methode (5.14.1) : TOUS les trios de tes SSR/UR/LR font une course avec elimination (une montee par manche, meme graine
// pour tous, abandon quand un trio est nettement derriere le Ke meilleur), puis les 20 meilleurs font 30 montees de plus.
// Journal (cache/tour-*.jsonl) : une montee deja faite n'est pas refaite tant que le combat, la Tour, la carte et l'IA sont les memes.
//   node tour.mjs [--niveaux actuel|99] [--garder 200] [--z 3] [--manches 10] [--finale 20] [--tirages 30] [--fils 11]
//   tests : --max-trios 2000 (trios au hasard)  journal : --garder-journal  --journal-calculs 2
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { arg, log, SAVE, WA, lvOf, stOf, ecrire, readJ } from './lib/commun.mjs';
import { dir as D } from './lib/chemins.mjs';
import { makeTour, statsEtages, cleCarteTour } from './lib/tour.mjs';
import { makeSim } from './lib/sim.mjs';
import { shuffle } from './lib/commun.mjs';
import { h53, signatureCombat, makeSigCarte, ouvrirJournal, nettoyerAnciens } from './lib/journal.mjs';
import { garderEveille } from './lib/eveil.mjs';
import { limitePuissance, decrireLimite, eveilDe } from './lib/puissance.mjs';

const { G, B, version } = await loadEngine(); const CH = G.CHAR_BY_ID;
const pool = await makePool(arg('fils') ? +arg('fils') : undefined);
// 5.62 : Eveil (V2) : carte eveillee au niveau 100 en mode 99, aw / awakened dans l'equipe ; limite de puissance sur les trios.
const EV = eveilDe(SAVE), LIM = limitePuissance(G, SAVE);
const NIV = arg('niveaux', 'actuel'), LV = NIV === '99' ? id => EV.niveauMax(id) : lvOf;
const nom = id => CH[id]?.n || String(id), noms = t => t.map(nom).join(' / ');
// 5.44 : raretes essayees (--raretes LR,UR,SSR) et pause au bout d'un temps de travail (--pause-apres minutes), comme la Campagne.
const RAR = { LR: 'M', UR: 'L', SSR: 'E' }, RARETES = String(arg('raretes', 'LR,UR,SSR')).split(',').filter(r => RAR[r]), CODES = RARETES.map(r => RAR[r]);
const PAUSE = Math.max(0, +arg('pause-apres', 0) || 0);
const IDS = Object.keys(SAVE.owned || {}).map(Number).filter(id => CODES.includes(CH[id]?.r));
if (!IDS.length) { console.log('Aucune carte LR, UR ou SSR dans la sauvegarde exportee.'); process.exit(1); }
const mk = (ids, lk = {}) => ids.map(id => { const l = lk[id] || SAVE.lk?.[id]; return { id, lv: LV(id), stars: stOf(id), ...(l ? { lk: l } : {}), ...EV.champs(id) }; });
const actuelle = (SAVE.team || []).map(Number).filter(id => IDS.includes(id));
const T = makeTour({ G, B, pool, W: WA, ids: IDS, mk, actuelle, log, ok: LIM.ok });
log(`moteur ${version}, ${IDS.length} cartes LR/UR/SSR, niveaux ${NIV}, ${pool.n} fils`);

// Signatures du journal : code de combat, etages de la Tour (ennemis de quelques etages), IA, chaque carte.
const SIM = makeSim(G, B), sigG = signatureCombat(G, B, SIM, WA), wKey = h53(JSON.stringify(WA)), sigCarte = makeSigCarte(G, B);
const sigT = h53(String(G.setupTower) + '#' + [1, 10, 37, 100, 150, 250, 400].map(fl => { try { return JSON.stringify(B.enemies(G.setupTower(fl, mk([IDS[0]]), 7).st).map(e => [e.id, e.lv, e.atk, e.def, e.maxHp, e.spd, e.boss ? 1 : 0])); } catch { return fl; } }).join('|'));
const FJ = D('cache', `tour-${sigG}-${sigT}-${wKey}.jsonl`), J = ouvrirJournal(FJ), ANCIENS = nettoyerAnciens(D('cache'), 'tour-', FJ);
const cleCarte = id => cleCarteTour(mk([id])[0], sigCarte);
// 5.42.1 : trios ranges en tableau compact (3 x 16 bits) et cles calculees a la demande (avant : 7 M petits tableaux et 7 M chaines
// pour 348 cartes, 2,6 Go des la 1re manche). tr[t] et l'ordre des trios sont inchanges.
const S_ = [...IDS].sort((a, b) => a - b), NS = S_.length;
let TRI = new Uint16Array(3 * (NS * (NS - 1) * (NS - 2) / 6)); { let k = 0; for (let a = 0; a < NS; a++) for (let b = a + 1; b < NS; b++) for (let c = b + 1; c < NS; c++) { TRI[k++] = a; TRI[k++] = b; TRI[k++] = c; } }
const NTOT = TRI.length / 3;
if (LIM.actif) { // 5.62 : seuls les trios que le jeu accepte (limite de puissance)
  const okP = LIM.okPositions(S_); let n = 0; for (let r = 0; r < NTOT; r++) if (okP(TRI[3 * r], TRI[3 * r + 1], TRI[3 * r + 2])) { if (n !== r) TRI.copyWithin(3 * n, 3 * r, 3 * r + 3); n++; }
  TRI = TRI.slice(0, 3 * n); log(`${decrireLimite(LIM)} : ${n} trios acceptes par le jeu sur ${NTOT}`);
}
if (arg('max-trios')) { const pris = shuffle([...Array(TRI.length / 3).keys()], 5).slice(0, +arg('max-trios')), t2 = new Uint16Array(3 * pris.length); pris.forEach((r, i) => t2.set(TRI.subarray(3 * r, 3 * r + 3), 3 * i)); TRI = t2; }
const NTR = TRI.length / 3, estIndex = k => typeof k === 'string' && k.length > 0 && k.charCodeAt(0) >= 48 && k.charCodeAt(0) <= 57;
const tr = new Proxy([], { get: (o, k) => k === 'length' ? NTR : estIndex(k) && +k < NTR ? [S_[TRI[3 * k]], S_[TRI[3 * k + 1]], S_[TRI[3 * k + 2]]] : undefined });
const CLEC = S_.map(cleCarte), cles = t => [CLEC[TRI[3 * t]], CLEC[TRI[3 * t + 1]], CLEC[TRI[3 * t + 2]]].sort().join(',');
const eveil = garderEveille(), T0 = Date.now(); let dernierLog = Date.now();
log(`${tr.length} trios, journal ${J.taille()} montees${eveil.ok ? ', PC garde eveille' : ''}`);
const solo0 = await T.climb(IDS.map(id => mk([id])), [1, 2], 16);
const solo = IDS.map((id, i) => ({ id, etage: (solo0[i][0] + solo0[i][1]) / 2 })).sort((a, b) => b.etage - a.etage);
// 5.42.1 : travail prevu = montees a simuler de la 1re manche (les reprises du journal ne coutent rien) + manches suivantes,
// estimees sur l'entonnoir du calcul precedent (trios encore en course avant chaque manche ; tous si rien n'avait ete elimine)
// au prorata des trios a simuler.
const PREC = readJ(D('resultats', 'tour.json')), MANCHES = +arg('manches', 10); let PREVU = 0;
const arret = async () => { if (!PAUSE || Date.now() - T0 < PAUSE * 60000) return; log(`pause apres ${PAUSE} min de travail : montees gardees dans le journal, relance le calcul pour finir (rien n est refait)`); eveil.fin(); await pool.close(); process.exit(0); };
const C = await T.course({ trios: tr, cle: cles, J, arret, garder: +arg('garder', 200), z: +arg('z', 3), manches: MANCHES, onManche: x => {
  if (x.debut) {
    if (x.r === 1) { const ent = PREC?.methode === 'course' && Array.isArray(PREC.entonnoir) ? PREC.entonnoir.slice(0, MANCHES - 1) : null;
      const tp = PREC?.triosEssayes || 0, suite = Math.round((ent ? ent.reduce((a, b) => a + (b >= tp ? tr.length : Math.min(b, tr.length)), 0) : 0.1 * tr.length * (MANCHES - 1)) * x.aFaire / Math.max(1, tr.length));
      PREVU = x.aFaire + suite; log(`travail prevu : ${PREVU} montees a simuler (1re manche ${x.aFaire}, ${x.reprises} reprises du journal sur ${tr.length} ; manches suivantes ${ent ? 'environ' : 'estimees a'} ${suite})`); }
    log(`manche ${x.r}/${x.manches} : ${x.aFaire} montees a simuler, ${x.reprises} reprises du journal`);
  } else if (x.fin) { log(`manche ${x.r}/${x.manches} : ${x.avant} -> ${x.apres} trios en course, ${x.montees} montees simulees (${Math.round(x.vitesse)}/s), ${x.repris} reprises du journal`); if (x.top?.length) log(`top 10 manche ${x.r} : ${x.top.map(o => [...o.ids].join(',') + '=' + o.v.toFixed(1)).join(' | ')}`); }
  else if (Date.now() - dernierLog > 30000) { dernierLog = Date.now(); log(`  manche ${x.r}/${x.manches} : ${x.fait} / ${x.total} montees (${x.montees} au total, prevu ${PREVU}), ${Math.round(x.vitesse)} montees/s`); } } });
// Etat du journal pour la prevision du panneau (/api/tour/prevision) : quelles cartes ont toutes leurs montees de 1re manche.
const etatJournal = () => { const f = D('cache', 'tour-etat.json'), e = readJ(f) || {}; if (e.fichier !== path.basename(FJ)) for (const k of Object.keys(e)) delete e[k]; return { f, e }; };
if (!arg('max-trios')) try { const { f, e } = etatJournal(); e.fichier = path.basename(FJ); e.version = version; e.wKey = wKey; e[NIV] = { gen: J.generation, cles: IDS.map(cleCarte) }; writeFileSync(f, JSON.stringify(e)); } catch {}
// Finale : les meilleurs (et ton trio actuel) font beaucoup de montees de plus, sur d'autres graines.
const top = C.classement.slice(0, +arg('finale', 20)).map(x => x.t);
if (actuelle.length === 3 && LIM.ok(actuelle) && !top.some(t => t.slice().sort().join() === actuelle.slice().sort().join())) top.push(actuelle);
const r2 = await T.climb(top.map(t => mk(t)), Array.from({ length: +arg('tirages', 30) }, (_, i) => 101 + i), 1);
const fin = top.map((t, i) => ({ t, fl: r2[i], ...statsEtages(r2[i]) })).sort((a, b) => b.moy - a.moy), essais = tr.length;
const act = actuelle.length === 3 ? fin.find(x => x.t.slice().sort().join() === actuelle.slice().sort().join()) || null : null;
log(`finale : ${top.length} trios, ${+arg('tirages', 30)} montees chacun`);
const ligne = x => ({ equipe: x.t.map(nom), ids: x.t, etageMoyen: +x.moy.toFixed(1), marge: +(2 * x.se).toFixed(1), min: x.min, p10: x.p10, mediane: x.med, max: x.max });
const out = { version, date: new Date().toISOString(), niveaux: NIV, record: SAVE.tower?.best ?? null, triosEssayes: essais, cartes: IDS.length, raretes: RARETES,
  puissance: LIM.actif ? { plafond: LIM.plafond, transcendances: LIM.rb, palierChoisi: LIM.force, triosTotal: NTOT } : null, eveil: EV.aw || 0,
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
// 5.42 : le journal ne garde que les montees servies par ce calcul ou le precedent (lib/journal.mjs).
if (!arg('max-trios') && !arg('garder-journal')) try {
  const c = J.compacter(+arg('journal-calculs', 2)), Mo = o => (o / 1048576).toFixed(1); out.journal = { ...c, anciens: ANCIENS };
  log(`journal : ${c.avant} -> ${c.apres} montees (${Mo(c.octetsAvant)} -> ${Mo(c.octetsApres)} Mo)${ANCIENS.length ? `, ${ANCIENS.length} ancien(s) journal(aux) supprime(s)` : ''}`);
  // Un mode de niveaux dont les montees viennent d'un calcul trop ancien n'est plus dans le journal.
  try { const { f, e } = etatJournal(); for (const k of ['actuel', '99']) if (e[k] && e[k].gen < c.generation - (+arg('journal-calculs', 2)) + 1) delete e[k]; writeFileSync(f, JSON.stringify(e)); } catch {}
} catch (e) { log('journal : nettoyage reporte (' + e.message + ')'); }
ecrire('tour.json', out);
// Le panneau affiche la categorie « tour » de la derniere analyse : on la remplace par ce resultat plus complet.
const prec = readJ(D('resultats', 'dernier.json'));
if (prec?.modes) { prec.modes[NIV] ??= {}; prec.modes[NIV].tour = { titre: "Tour de l'infini", trios: essais, date: out.date, top: fin.slice(0, 5).map(x => ({ equipe: x.t.map(nom), ids: x.t, etageMoyen: +x.moy.toFixed(1), etageMin: x.min, p10: x.p10, max: x.max })), murs: out.murs, collectifs: out.collectifs }; writeFileSync(D('resultats', 'dernier.json'), JSON.stringify(prec)); }
log('termine : resultats\\tour.json');
eveil.fin(); await pool.close(); process.exit(0);
