// Tour de l'infini, analyse detaillee : meilleur trio POUR la Tour, etages ou les montees s'arretent, collectifs.
//   node tour.mjs [--niveaux actuel|99] [--cartes 26] [--tirages 30] [--fils 11]
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { writeFileSync } from 'node:fs';
import { arg, log, SAVE, WA, lvOf, stOf, ecrire, readJ } from './lib/commun.mjs';
import { dir as D } from './lib/chemins.mjs';
import { makeTour } from './lib/tour.mjs';

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

const { solo, essais, fin, actuelle: act } = await T.trios({ cartes: +arg('cartes', 26), tirages: +arg('tirages', 30) });
const ligne = x => ({ equipe: x.t.map(nom), ids: x.t, etageMoyen: +x.moy.toFixed(1), marge: +(2 * x.se).toFixed(1), min: x.min, p10: x.p10, mediane: x.med, max: x.max });
const out = { version, date: new Date().toISOString(), niveaux: NIV, record: SAVE.tower?.best ?? null, triosEssayes: essais,
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
await pool.close(); process.exit(0);
