// Pourquoi la 3e etoile saute (5.26) : relit resultats/cauchemar3.json et rejoue les combats sous le seuil (lib/diagnostic.mjs).
// Calcul leger (un seul fil, de l'ordre de la minute). Le resultat est range dans cauchemar3.json (etages.diagnostic).
// Le calcul Campagne le fait aussi tout seul a la fin ; ce script sert pour un resultat deja calcule.
//   node diagnostic3.mjs [--tirages 8] [--trios 3]
import { readFileSync, writeFileSync } from 'node:fs';
import { loadEngine } from './lib/charger.mjs';
import { makeSim } from './lib/sim.mjs';
import { arg, log, SAVE, WA, WC } from './lib/commun.mjs';
import { dir as D } from './lib/chemins.mjs';
import { diagnostiquer } from './lib/diagnostic.mjs';

const f = D('resultats', 'cauchemar3.json');
let c3; try { c3 = JSON.parse(readFileSync(f, 'utf8')); } catch { console.log('Pas encore de resultat Campagne : lance d\'abord le calcul Campagne.'); process.exit(1); }
if (!c3.etages?.combats?.length) { console.log('Ce resultat Campagne n\'a pas de meilleur trio par combat : relance le calcul Campagne.'); process.exit(1); }
const { G, B, version } = await loadEngine(); const SIM = makeSim(G, B);
if (c3.version && c3.version !== version) log(`attention : resultat calcule avec le moteur ${c3.version}, moteur actuel ${version}`);
// Meme IA que le calcul : l'IA commune s'il etait partage, sinon la tienne.
const W = c3.partage?.ia === 'commune' && WC ? WC : WA, pol = SIM.smartPol(W);
const LV = id => c3.niveaux === '99' ? 99 : (SAVE.lv?.[id]?.l || 1);
const equipeDe = ids => ids.map(id => ({ id, lv: LV(id), stars: SAVE.stars?.[id] || 0, ...(SAVE.lk?.[id] ? { lk: SAVE.lk[id] } : {}) }));
const diag = diagnostiquer(G, B, SIM, pol, c3, equipeDe, { tirages: +arg('tirages', 8), maxTrios: +arg('trios', 3), log });
if (!diag) { console.log('Rien a diagnostiquer.'); process.exit(0); }
diag.ia = W === WC ? 'commune' : 'pc';
// Relecture juste avant l'ecriture : un calcul Campagne a pu finir pendant ce temps.
let frais; try { frais = JSON.parse(readFileSync(f, 'utf8')); } catch { frais = c3; }
if (frais.date !== c3.date) { log('le resultat Campagne a change pendant le diagnostic : rien ecrit, relance le diagnostic'); process.exit(1); }
frais.etages.diagnostic = diag; writeFileSync(f, JSON.stringify(frais, null, 1));
const N = { cycle: 'trop lent (cycle 9)', ko: 'un K.O.', les2: 'K.O. et trop lent', defaite: 'defaite' };
for (const r of diag.resume.filter(r => r.combats)) log(`${r.difficulte} : ${r.combats} combats durs : ${Object.keys(N).map(k => `${N[k]} ${r[k]}`).join(', ')}${r.pv9Med != null ? `, il reste en mediane ${Math.round(100 * r.pv9Med)} % des PV ennemis au cycle 9` : ''}`);
log(`termine en ${diag.duree} s : resultats\\cauchemar3.json (etages.diagnostic)`);
process.exit(0);
