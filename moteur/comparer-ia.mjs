// Compare ton IA (data/poids.json) a l'IA commune en service, sur les memes combats Cauchemar et les memes tirages.
// Test sequentiel par paires : on ajoute des tirages tant que l'ecart n'est pas tranche (z >= 3 ou z <= -2), 8 tours au plus.
// Lance tout seul a la fin d'un entrainement sur le PC validateur, ou depuis Reglages (cadre validateur).
// Resultat : resultats/comparaison-ia.json, lu par le launcher pour mettre en avant « Publier comme IA commune ».
//   node comparer-ia.mjs [--fils 8]
import { loadEngine } from './lib/charger.mjs';
import { makePool } from './lib/pool.mjs';
import { arg, log, WA, WC, POIDS, team, topTeams, shuffle, disputes, ecrire } from './lib/commun.mjs';
import { construireWC, cleIA } from './lib/ia-commune.mjs';
import { iaCommune, reglagesPartage } from './lib/partage.mjs';

const { G, version } = await loadEngine();
const IAC = await iaCommune(reglagesPartage()).catch(() => null), WCX = IAC ? construireWC(IAC.p) : WC;
const base = { t: Date.now(), version, commune: cleIA(WCX), source: IAC?.source || 'appli', communeT: IAC?.p?.t || null, mienne: cleIA(WA), poidsT: POIDS.t || null };
if (!WCX) { log('pas d IA commune (poids-communs.json absent)'); ecrire('comparaison-ia.json', { ...base, verdict: 'sans-commune' }); process.exit(0); }
if (base.commune === base.mienne) { log('ton IA est identique a l IA commune : rien a comparer'); ecrire('comparaison-ia.json', { ...base, verdict: 'identique' }); process.exit(0); }

const teams = topTeams(['cauchemar', 'cauchemar_multi', 'cauchemar_boss'], 4).map(t => team(t, 99));
if (!teams.length) { log('aucune equipe : lance d abord une analyse complete'); process.exit(1); }
const pool = await makePool(arg('fils') ? +arg('fils') : undefined, version);
const camp = G.ALL_WORLDS.filter(w => w.id !== 'halloween').flatMap(w => w.fights.map(f => f.id));
const tous = shuffle(['@n', '@hn', '@xn'].flatMap(s => camp.map(f => f + s)).filter(f => { try { return !!G.findFight(f); } catch { return false; } }), 7);
// Combats disputes pour l'IA commune (les combats toujours gagnes a 3 etoiles par les deux n'apprennent rien).
const fights = [...new Set((await Promise.all(teams.map(t => disputes(pool, WCX, t, tous.slice(0, 500), 60)))).flat())].slice(0, 160);
log(`moteur ${version} : ton IA contre l IA commune (${base.source}), ${teams.length} equipes au 99, ${fights.length} combats Cauchemar disputes`);

const d = [], pA = [0, 0], pB = [0, 0]; let z = 0, md = 0, se = 0, tour = 0, verdict = 'pareille';
for (; tour < 8; tour++) {
  const seeds = [70001 + 2 * tour, 70002 + 2 * tour], jobs = teams.flatMap(t => fights.map(f => ({ team: t, fights: [f], seeds })));
  const [a, b] = await Promise.all([pool.runAll(jobs, WCX, { stop3: true }, 16), pool.runAll(jobs, WA, { stop3: true }, 16)]);
  a.forEach((x, i) => { d.push((b[i].s3 - x.s3) / x.n); pA[0] += x.s3; pA[1] += x.n; pB[0] += b[i].s3; pB[1] += b[i].n; });
  md = d.reduce((s, x) => s + x, 0) / d.length; se = Math.sqrt(d.reduce((s, x) => s + (x - md) ** 2, 0) / (d.length - 1) / d.length); z = se ? md / se : 0;
  log(`tour ${tour + 1} : IA commune ${(100 * pA[0] / pA[1]).toFixed(1)} %, ton IA ${(100 * pB[0] / pB[1]).toFixed(1)} % de 3 etoiles (ecart ${(100 * md).toFixed(2)} pts, z = ${z.toFixed(1)})`);
  if (tour >= 1 && z >= 3 && md >= 0.005) { verdict = 'meilleure'; break; }
  if (tour >= 1 && z <= -2) { verdict = 'moins bonne'; break; }
}
const out = { ...base, verdict, combats: pA[1], commune3: +(100 * pA[0] / pA[1]).toFixed(1), mienne3: +(100 * pB[0] / pB[1]).toFixed(1), ecart: +(100 * md).toFixed(2), marge: +(200 * se).toFixed(2), z: +z.toFixed(1), tours: Math.min(tour + 1, 8) };
ecrire('comparaison-ia.json', out);
log(verdict === 'meilleure' ? `ton IA est nettement meilleure (+${out.ecart} pts) : tu peux la publier comme IA commune (Reglages)` : verdict === 'moins bonne' ? 'ton IA est moins bonne que l IA commune : garde l IA commune' : `pas d ecart net (${out.ecart} +/- ${out.marge} pts) : garde l IA commune`);
await pool.close(); process.exit(0);
