// Client de la base commune (partage des calculs Campagne). Tout est optionnel et coupe par defaut (Reglages > Partage).
// - utiliser : avant un calcul, recuperer les resultats deja verifies pour TES cartes et les mettre dans le journal ;
// - envoyer  : envoyer les resultats que TON PC a simules (jamais ceux recus de la base, jamais rien du prive) ;
// - verifier : pendant ton calcul, rejouer quelques lignes des lots des autres (environ 0,3 % de temps en plus).
// Les calculs partages utilisent tous la meme IA (poids-communs.json, publiee avec chaque version) : sinon rien ne se recoupe.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { dir as D } from './chemins.mjs';
import { FORMAT, LIMITES, verifierLot, cleTrioDe } from './partage-format.mjs';

export const URL_DEFAUT = 'https://kitsu-partage.kitsu-partage-whag.workers.dev';
const lireJ = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

// Reglages du partage (data/reglages.json, cle partage) et identite (data/partage.json, cle secrete tiree au hasard).
export function reglagesPartage() {
  const r = lireJ(D('data', 'reglages.json'))?.partage || {};
  return { utiliser: !!r.utiliser, envoyer: !!r.envoyer && !!r.verifier, verifier: !!r.verifier, url: r.url || process.env.KITSU_PARTAGE_URL || URL_DEFAUT };
}
export function identite() {
  const f = D('data', 'partage.json'); let o = lireJ(f);
  if (!o?.cle || !/^[0-9a-f]{64}$/.test(o.cle)) { o = { ...(o || {}), cle: randomBytes(32).toString('hex'), cree: Date.now() }; /* garde le jeton admin */ mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(o, null, 1)); }
  // ID affiche : meme empreinte que cote serveur, raccourcie.
  return { cle: o.cle, id: createHash('sha256').update('kitsu-partage|' + o.cle).digest('hex').slice(0, 32), admin: o.admin || process.env.KITSU_ADMIN || null };
}
export function changerIdentite() { const f = D('data', 'partage.json'), o = lireJ(f) || {}; delete o.cle; mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(o, null, 1)); return identite(); }

async function appel(url, chemin, { methode = 'GET', corps, id, admin, gz = false } = {}) {
  const h = {}; if (id) h['x-kitsu-cle'] = id.cle; if (admin) h['x-kitsu-admin'] = admin;
  if (corps !== undefined) h['content-type'] = gz ? 'application/gzip' : 'application/json';
  const r = await fetch(url.replace(/\/$/, '') + chemin, { method: methode, headers: h, body: corps === undefined ? undefined : gz ? corps : JSON.stringify(corps), signal: AbortSignal.timeout(30000) });
  if (!r.ok) { let m = ''; try { m = (await r.json()).err; } catch {} throw new Error(`${r.status} ${m}`); }
  return r;
}

// ---------- construire et envoyer un lot ----------
// items : { cartes: [[id, niveau, etoiles, [collectifs], sigCarte] x3], di, pi, clePaquet, graine, n, s3 }
export function construireLot({ sigG, wKey, moteur }, items) {
  const t = [], ti = new Map(), p = [], pj = new Map(), l = [], vu = new Set();
  for (const x of items) {
    const kt = cleTrioDe(x.cartes); let a = ti.get(kt); if (a === undefined) { a = t.length; ti.set(kt, a); t.push(x.cartes); }
    const kp = x.di + '|' + x.pi; let b = pj.get(kp); if (b === undefined) { b = p.length; pj.set(kp, b); p.push([x.di, x.pi, x.clePaquet]); }
    const k = a + ',' + b + ',' + x.graine; if (vu.has(k)) continue; vu.add(k); // un meme essai calcule deux fois : une seule ligne
    l.push([a, b, x.graine, x.n, x.s3]);
  }
  return { f: FORMAT, sigG, wKey, moteur, paq: LIMITES.paq, t, p, l };
}
export function decouper(items, taille = 20000) { const out = []; for (let i = 0; i < items.length; i += taille) out.push(items.slice(i, i + taille)); return out; }

export async function envoyerLot(reg, lot) {
  const raison = verifierLot(lot); if (raison) throw new Error('lot invalide : ' + raison);
  const id = identite(), r = await appel(reg.url, '/v1/lots', { methode: 'POST', corps: gzipSync(JSON.stringify(lot)), id, gz: true });
  return r.json();
}
// File d'envoi gardee sur le disque : un envoi rate (pas d'internet, quota du jour) repart au calcul suivant.
const FILE = () => D('cache', 'partage', 'a-envoyer');
export function mettreEnFile(lot) { mkdirSync(FILE(), { recursive: true }); const b = gzipSync(JSON.stringify(lot)); writeFileSync(path.join(FILE(), createHash('sha256').update(b).digest('hex').slice(0, 20) + '.json.gz'), b); }
export async function viderFile(reg, log = () => {}) {
  if (!existsSync(FILE())) return 0; const { readdirSync, unlinkSync } = await import('node:fs'); let n = 0;
  for (const f of readdirSync(FILE())) {
    const p = path.join(FILE(), f);
    try { await envoyerLot(reg, JSON.parse(gunzipSync(readFileSync(p)))); unlinkSync(p); n++; }
    catch (e) { log(`partage : envoi reporte (${e.message})`); if (/^4(29|03)/.test(e.message)) break; if (/^400/.test(e.message)) unlinkSync(p); }
  }
  return n;
}

// ---------- recuperer la base ----------
// Ne garde que les lots verifies (sauf `avecAttente`), et dans ces lots que les trios faits de TES cartes (memes niveau,
// etoiles, collectifs et signature) : cleCarteLocale(id) doit renvoyer la cle de ta carte, ou null si tu ne l'as pas.
export async function telecharger(reg, { sigG, wKey }, { cleCarteLocale, avecAttente = false, log = () => {} }) {
  const man = await (await appel(reg.url, `/v1/manifeste?sigG=${sigG}&wKey=${wKey}`)).json(), dossier = D('cache', 'partage', 'lots');
  mkdirSync(dossier, { recursive: true });
  const lignes = []; let lots = 0, octets = 0;
  for (const x of man.lots) {
    if (x.statut !== 'verifie' && !avecAttente) continue;
    if (!/^[0-9a-f]{64}$/.test(x.id)) continue;
    const f = path.join(dossier, x.id + '.json.gz'); let brut;
    if (existsSync(f)) brut = readFileSync(f); else { brut = Buffer.from(await (await appel(reg.url, '/v1/lots/' + x.id)).arrayBuffer()); octets += brut.length; if (createHash('sha256').update(brut).digest('hex') !== x.id) continue; writeFileSync(f, brut); }
    let lot; try { lot = JSON.parse(gunzipSync(brut, { maxOutputLength: LIMITES.octets })); } catch { continue; }
    if (verifierLot(lot) || lot.sigG !== sigG || lot.wKey !== wKey) continue;
    lots++;
    const ok = lot.t.map(tr => tr.every(c => cleCarteLocale(c[0]) === `${c[0]}:${c[1]}:${c[2]}:${c[3].join('+')}:${c[4]}`) ? cleTrioDe(tr) : null);
    for (const [ti, pj, g, n, s3] of lot.l) if (ok[ti]) lignes.push({ ck: ok[ti], di: lot.p[pj][0], pi: lot.p[pj][1], clePaquet: lot.p[pj][2], graine: g, n, s3 });
  }
  log(`partage : ${lots} lots verifies lus (${Math.round(octets / 1e5) / 10} Mo telecharges), ${lignes.length} resultats pour tes cartes`);
  return lignes;
}

// ---------- controles ----------
// rejouer(mission) doit renvoyer [[n, s3], ...] pour les lignes demandees, ou null si ce PC ne peut pas les rejouer
// (signature de carte ou paquet different : version du jeu differente).
export async function controler(reg, { sigG, wKey }, rejouer, { max = 2, log = () => {} } = {}) {
  const id = identite(), admin = id.admin; let faits = 0;
  for (let k = 0; k < max; k++) {
    const m = await (await appel(reg.url, '/v1/missions', { methode: 'POST', corps: { sigG, wKey }, id, admin })).json();
    if (!m.mission) break;
    const f = path.join(D('cache', 'partage', 'lots'), m.lot + '.json.gz'); let brut;
    if (existsSync(f)) brut = readFileSync(f); else brut = Buffer.from(await (await appel(reg.url, '/v1/lots/' + m.lot)).arrayBuffer());
    const lot = JSON.parse(gunzipSync(brut, { maxOutputLength: LIMITES.octets }));
    const raison = verifierLot(lot), lignes = raison ? null : m.indices.map(i => lot.l[i]).filter(Boolean);
    const res = lignes && lignes.length === m.indices.length ? await rejouer(lot, lignes) : null;
    const r = await (await appel(reg.url, '/v1/missions/' + m.mission, { methode: 'POST', corps: res ? { resultats: res } : { incompatible: true }, id, admin })).json();
    log(`partage : controle d'un lot (${m.indices.length} lignes) : ${res ? (r.ecarts ? r.ecarts + ' ecarts, ' : 'identique, ') + r.decision : 'pas rejouable ici'}`);
    faits++;
  }
  return faits;
}

export async function moi(reg) { return (await appel(reg.url, '/v1/moi', { id: identite() })).json(); }
export async function supprimerMesEnvois(reg) { return (await appel(reg.url, '/v1/moi', { methode: 'DELETE', id: identite() })).json(); }
