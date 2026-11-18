// Serveur de la base commune : recoit les lots de resultats Campagne, les distribue, organise les controles.
// Il ne rejoue jamais un combat (le moteur du jeu n'est jamais sur un serveur) : les controles sont faits par les PC des joueurs.
// Il ne decompresse jamais un lot non plus (offre gratuite : 10 ms de CPU par requete) : le PC qui envoie decrit son lot
// dans l'en-tete X-Kitsu-Meta, et c'est le PC controleur qui verifie le lot entier (format, nombre de lignes, cartes)
// en plus des lignes rejouees. Un lot qui ne correspond pas a sa description compte comme un lot truque.
// Routes (JSON, prefixe /v1) :
//   GET  /v1/manifeste?sigG=&wKey=     lots utilisables pour cette version, avec leurs cartes (verifies, et ceux en attente marques comme tels)
//   GET  /v1/lots/<id>                  un lot (gzip), immuable
//   POST /v1/lots                       envoyer un lot (corps gzip), cle du joueur dans X-Kitsu-Cle, description dans X-Kitsu-Meta
//   POST /v1/missions                   demander un controle { sigG, wKey } : { mission, lot, indices, lignes, cartes }
//   POST /v1/missions/<id>              rendre un controle : { ecarts } ou { invalide: true } ou { incompatible: true }
//   GET  /v1/moi                        etat de mon ID ; DELETE /v1/moi : supprimer tous mes envois
//   GET  /v1/etat                       chiffres publics de la base
// Stockage : tout dans D1 (offre gratuite, sans moyen de paiement). Chaque lot compresse est une ligne de la table `blocs`
// (D1 limite une ligne a 2 Mo : un lot fait au plus 1,9 Mo compresse).
// Admin (jeton secret ADMIN_JETON, seulement sur le PC d'Adrien) : X-Kitsu-Admin sur /v1/missions, POST /v1/admin/bannir,
// GET /v1/admin/a-regrouper et POST /v1/admin/paquets (regroupe les lots verifies d'un meme joueur en gros paquets :
// moins de fichiers a telecharger et une liste des lots plus courte).
import { tirerIndices, VERSION_SERVEUR } from '../../moteur/lib/partage-format.mjs';

const MAX_LOT = 1.9e6, JOUR = 86400e3, K_CONTROLE = 24, MISSION_MS = 6 * 3600e3, CRED_FIABLE = 3;
const LIGNES_LOT = 60000, LIGNES_PAQUET = 400000, MAX_CARTES = 20000;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-kitsu-cle, x-kitsu-admin, x-kitsu-meta, x-kitsu-remplace', 'access-control-allow-methods': 'GET, POST, DELETE' };
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS, ...h } });
const err = (s, m) => json({ err: m }, s);
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? new TextEncoder().encode(d) : d));
const alea = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const RE_ID = /^[0-9a-f]{64}$/, RE_CLE = /^[0-9a-f]{64}$/, RE_SIG = /^[0-9a-z]{1,14}$/, RE_TXT = /^[^\u0000-\u001f]{1,64}$/, RE_CARTES = /^[0-9a-z]{1,6}(\.[0-9a-z]{1,6})*$/;

const enOctets = v => v instanceof ArrayBuffer ? v : new Uint8Array(v).buffer; // D1 rend un BLOB en ArrayBuffer ou en tableau de nombres
async function lireBrut(env, id) { const r = await env.DB.prepare('SELECT data FROM blocs WHERE id = ?').bind(id).first(); return r ? enOctets(r.data) : null; }
async function lireCorps(req, max) {
  const n = +req.headers.get('content-length') || 0; if (n > max) throw new Error('trop gros');
  const b = await req.arrayBuffer(); if (b.byteLength > max) throw new Error('trop gros'); return b;
}
const lireJson = async req => JSON.parse(new TextDecoder().decode(await lireCorps(req, 2e4)));
const estGzip = b => { const u = new Uint8Array(b, 0, Math.min(3, b.byteLength)); return u.length === 3 && u[0] === 0x1f && u[1] === 0x8b && u[2] === 8; };
// Description d'un lot donnee par le PC qui l'envoie. Rien n'est cru sur parole : le controleur compare au contenu reel.
function lireMeta(req, maxLignes) {
  let m; try { m = JSON.parse(req.headers.get('x-kitsu-meta') || ''); } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  if (!RE_SIG.test(m.sigG || '') || !RE_SIG.test(m.wKey || '') || typeof m.moteur !== 'string' || !RE_TXT.test(m.moteur)) return null;
  if (!Number.isInteger(m.lignes) || m.lignes < 1 || m.lignes > maxLignes) return null;
  if (typeof m.cartes !== 'string' || m.cartes.length > MAX_CARTES || !RE_CARTES.test(m.cartes)) return null;
  return { sigG: m.sigG, wKey: m.wKey, moteur: m.moteur, lignes: m.lignes, cartes: m.cartes };
}

// Joueur = empreinte de sa cle (la cle elle-meme n'est jamais stockee).
// creer = 'plus tard' : l'ID n'est enregistre que si l'envoi est accepte (une requete refusee ne laisse aucune trace).
async function joueur(env, req, creer = true) {
  const cle = req.headers.get('x-kitsu-cle') || ''; if (!RE_CLE.test(cle)) return null;
  const id = (await sha('kitsu-partage|' + cle)).slice(0, 32);
  let j = await env.DB.prepare('SELECT * FROM joueurs WHERE id = ?').bind(id).first();
  if (!j && creer === 'plus tard') return { id, cred: 0, banni: 0, nouveau: true };
  if (!j && creer) { await env.DB.prepare('INSERT OR IGNORE INTO joueurs (id, cred, banni, cree) VALUES (?, 0, 0, ?)').bind(id, Date.now()).run(); j = { id, cred: 0, banni: 0 }; }
  return j;
}
const estAdmin = (env, req) => !!env.ADMIN_JETON && req.headers.get('x-kitsu-admin') === env.ADMIN_JETON;

// Tout le travail d'un joueur est retire (lot truque vu par l'admin, ou bannissement manuel).
const ecarter = (env, jid) => env.DB.batch([
  env.DB.prepare('UPDATE joueurs SET banni = 1 WHERE id = ?').bind(jid),
  env.DB.prepare('UPDATE lots SET statut = \'rejete\' WHERE joueur = ?').bind(jid),
  env.DB.prepare('DELETE FROM blocs WHERE id IN (SELECT id FROM lots WHERE joueur = ?)').bind(jid),
]);

async function envoyerLot(env, req) {
  const j = await joueur(env, req, 'plus tard'); if (!j) return err(401, 'cle manquante');
  if (j.banni) return err(403, 'ID ecarte');
  const meta = lireMeta(req, LIGNES_LOT); if (!meta) return err(400, 'lot refuse : description (X-Kitsu-Meta) absente ou invalide');
  const jour = Math.floor(Date.now() / JOUR), max = +(j.cred > 0 ? env.LOTS_PAR_JOUR : env.LOTS_PAR_JOUR_NOUVEAU);
  const q = await env.DB.prepare('SELECT lots FROM quotas WHERE joueur = ? AND jour = ?').bind(j.id, jour).first();
  if ((q?.lots || 0) >= max) return err(429, 'quota du jour atteint pour cet ID');
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM lots WHERE recu >= ?').bind(jour * JOUR).first();
  if (total.n >= +env.LOTS_PAR_JOUR_TOTAL) return err(429, 'quota du jour atteint pour la base');
  let brut; try { brut = await lireCorps(req, MAX_LOT); } catch (e) { return err(400, 'lot illisible : ' + e.message); }
  if (!estGzip(brut)) return err(400, 'lot illisible : pas du gzip');
  const id = await sha(brut);
  if (await env.DB.prepare('SELECT 1 FROM lots WHERE id = ?').bind(id).first()) return json({ id, deja: true });
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO joueurs (id, cred, banni, cree) VALUES (?, 0, 0, ?)').bind(j.id, Date.now()),
    env.DB.prepare('INSERT OR REPLACE INTO blocs (id, data) VALUES (?, ?)').bind(id, brut),
    env.DB.prepare('INSERT INTO lots (id, joueur, sigG, wKey, moteur, lignes, octets, cartes, statut, verifs, recu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'attente\', 0, ?)').bind(id, j.id, meta.sigG, meta.wKey, meta.moteur, meta.lignes, brut.byteLength, meta.cartes, Date.now()),
    env.DB.prepare('INSERT INTO quotas (joueur, jour, lots) VALUES (?, ?, 1) ON CONFLICT (joueur, jour) DO UPDATE SET lots = lots + 1').bind(j.id, jour),
  ]);
  return json({ id, lignes: meta.lignes });
}

async function manifeste(env, url, ctx) {
  const sigG = url.searchParams.get('sigG') || '', wKey = url.searchParams.get('wKey') || '';
  if (!RE_SIG.test(sigG) || !RE_SIG.test(wKey)) return err(400, 'version');
  const cache = caches.default, cle = new Request(url.toString()), vu = await cache.match(cle); if (vu) return vu;
  const r = await env.DB.prepare('SELECT id, lignes, octets, statut, verifs, cartes FROM lots WHERE sigG = ? AND wKey = ? AND statut IN (\'verifie\', \'attente\') ORDER BY recu').bind(sigG, wKey).all();
  const rep = json({ sigG, wKey, lots: r.results }, 200, { 'cache-control': 'public, max-age=120' });
  ctx.waitUntil(cache.put(cle, rep.clone())); return rep;
}

async function lot(env, id) {
  if (!RE_ID.test(id)) return err(400, 'id');
  const l = await env.DB.prepare('SELECT statut FROM lots WHERE id = ?').bind(id).first();
  if (!l || l.statut === 'rejete' || l.statut === 'regroupe') return err(404, 'lot inconnu, ecarte ou regroupe');
  const brut = await lireBrut(env, id); if (!brut) return err(404, 'lot absent');
  return new Response(brut, { headers: { 'content-type': 'application/gzip', 'cache-control': 'public, max-age=31536000, immutable', ...CORS } });
}

// Controle : un lot d'un autre joueur, des lignes tirees ici (le joueur controle ne sait pas lesquelles a l'avance).
async function demanderMission(env, req) {
  const admin = estAdmin(env, req), j = admin ? { id: 'admin', banni: 0 } : await joueur(env, req);
  if (!j) return err(401, 'cle manquante'); if (j.banni) return err(403, 'ID ecarte');
  let b; try { b = await lireJson(req); } catch { return err(400, 'corps'); }
  if (!RE_SIG.test(b?.sigG || '') || !RE_SIG.test(b?.wKey || '')) return err(400, 'version');
  // Admin : d'abord les lots contestes, puis les plus anciens en attente. Autres : un lot en attente au hasard parmi les 50 plus anciens.
  const choix = admin
    ? await env.DB.prepare('SELECT id, lignes, cartes FROM lots WHERE sigG = ? AND wKey = ? AND statut IN (\'conteste\', \'attente\') ORDER BY statut = \'conteste\' DESC, recu LIMIT 1').bind(b.sigG, b.wKey).first()
    : (await env.DB.prepare('SELECT id, lignes, cartes FROM lots WHERE sigG = ? AND wKey = ? AND statut = \'attente\' AND joueur != ? ORDER BY verifs, recu LIMIT 50').bind(b.sigG, b.wKey, j.id).all()).results.sort(() => alea() - .5)[0];
  if (!choix) return json({ mission: null });
  const indices = tirerIndices(choix.lignes, K_CONTROLE, alea), id = hex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.prepare('INSERT INTO missions (id, lot, verificateur, admin, indices, expire) VALUES (?, ?, ?, ?, ?, ?)').bind(id, choix.id, j.id, admin ? 1 : 0, JSON.stringify(indices), Date.now() + MISSION_MS).run();
  return json({ mission: id, lot: choix.id, indices, lignes: choix.lignes, cartes: choix.cartes });
}

// Le controleur a rejoue les lignes tirees et compare lui-meme. ecarts > 0 ou invalide : le lot ne dit pas la verite.
async function rendreMission(env, req, mid) {
  const admin = estAdmin(env, req), j = admin ? { id: 'admin', banni: 0 } : await joueur(env, req, false);
  if (!j) return err(401, 'cle manquante'); if (j.banni) return err(403, 'ID ecarte');
  const m = await env.DB.prepare('SELECT * FROM missions WHERE id = ?').bind(mid).first();
  if (!m || m.verificateur !== j.id || m.expire < Date.now()) return err(404, 'mission inconnue ou expiree');
  let b; try { b = await lireJson(req); } catch { return err(400, 'corps'); }
  const L = await env.DB.prepare('SELECT * FROM lots WHERE id = ?').bind(m.lot).first();
  await env.DB.prepare('DELETE FROM missions WHERE id = ?').bind(mid).run();
  if (!L || L.statut === 'rejete' || L.statut === 'regroupe') return json({ ok: true, sansObjet: true });
  if (b?.incompatible) return json({ ok: true, ignore: true }); // cartes ou combats differents chez le controleur : rien a conclure
  const nb = JSON.parse(m.indices).length;
  const e = b?.invalide === true ? nb : Number.isInteger(b?.ecarts) && b.ecarts >= 0 && b.ecarts <= nb ? b.ecarts : null;
  if (e === null) return err(400, 'corps');
  const now = Date.now();
  if (m.admin) {
    if (e) { // le PC admin a tort ? impossible par construction : l'envoyeur a triche ou son PC est defaillant, tout son travail est retire
      await ecarter(env, L.joueur);
      return json({ ok: true, ecarts: e, decision: 'envoyeur ecarte' });
    }
    // Lot juste : les controleurs qui l'avaient conteste avaient tort.
    const d = (await env.DB.prepare('SELECT verificateur FROM desaccords WHERE lot = ?').bind(L.id).all()).results;
    await env.DB.batch([
      env.DB.prepare('UPDATE lots SET statut = \'verifie\', verifs = verifs + 1 WHERE id = ?').bind(L.id),
      env.DB.prepare('UPDATE joueurs SET cred = cred + 1 WHERE id = ?').bind(L.joueur),
      ...d.map(x => env.DB.prepare('UPDATE joueurs SET banni = 1 WHERE id = ?').bind(x.verificateur)),
      env.DB.prepare('DELETE FROM desaccords WHERE lot = ?').bind(L.id),
    ]);
    return json({ ok: true, ecarts: 0, decision: 'verifie' });
  }
  if (e) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO desaccords (lot, verificateur, t) VALUES (?, ?, ?)').bind(L.id, j.id, now),
      env.DB.prepare('UPDATE lots SET statut = \'conteste\' WHERE id = ? AND statut != \'rejete\'').bind(L.id),
    ]);
    return json({ ok: true, ecarts: e, decision: 'conteste, en attente du controle admin' });
  }
  const fiable = env.VERIF_ADMIN_SEULE !== 'true' && (j.cred || 0) >= CRED_FIABLE;
  await env.DB.batch([
    env.DB.prepare(`UPDATE lots SET verifs = verifs + 1${fiable ? ', statut = \'verifie\'' : ''} WHERE id = ? AND statut = 'attente'`).bind(L.id),
    env.DB.prepare('UPDATE joueurs SET cred = cred + 1 WHERE id = ?').bind(j.id),
  ]);
  return json({ ok: true, ecarts: 0, decision: fiable ? 'verifie' : 'controle compte' });
}

// ---------- regroupement (PC admin) ----------
// Groupes de lots verifies d'un meme joueur et d'une meme version (au moins 2). L'ID du joueur n'est pas montre.
async function aRegrouper(env) {
  const r = (await env.DB.prepare('SELECT id, joueur, sigG, wKey, lignes FROM lots WHERE statut = \'verifie\' ORDER BY joueur, sigG, wKey, recu').all()).results;
  const g = new Map();
  for (const x of r) { const k = x.joueur + '|' + x.sigG + '|' + x.wKey; if (!g.has(k)) g.set(k, { sigG: x.sigG, wKey: x.wKey, lots: [] }); g.get(k).lots.push({ id: x.id, lignes: x.lignes }); }
  return json({ groupes: [...g.values()].filter(x => x.lots.length >= 2) });
}
// Un paquet remplace des lots verifies du meme joueur (en-tete X-Kitsu-Remplace : ids separes par des virgules).
// Le paquet est la fusion faite par le PC admin : il est verifie d'office, les lots remplaces disparaissent.
async function envoyerPaquet(env, req) {
  const meta = lireMeta(req, LIGNES_PAQUET); if (!meta) return err(400, 'description (X-Kitsu-Meta) absente ou invalide');
  const ids = [...new Set((req.headers.get('x-kitsu-remplace') || '').split(',').filter(Boolean))];
  if (ids.length < 2 || ids.length > 90 || !ids.every(x => RE_ID.test(x))) return err(400, 'lots remplaces');
  const place = ids.map(() => '?').join(',');
  const L = (await env.DB.prepare(`SELECT id, joueur, sigG, wKey, statut FROM lots WHERE id IN (${place})`).bind(...ids).all()).results;
  if (L.length !== ids.length || L.some(x => x.statut !== 'verifie' || x.joueur !== L[0].joueur || x.sigG !== meta.sigG || x.wKey !== meta.wKey)) return err(409, 'lots remplaces : absents, non verifies, de joueurs ou de versions differents');
  let brut; try { brut = await lireCorps(req, MAX_LOT); } catch (e) { return err(400, 'paquet illisible : ' + e.message); }
  if (!estGzip(brut)) return err(400, 'paquet illisible : pas du gzip');
  const id = await sha(brut);
  if (await env.DB.prepare('SELECT 1 FROM lots WHERE id = ?').bind(id).first()) return err(409, 'paquet deja present');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO blocs (id, data) VALUES (?, ?)').bind(id, brut),
    env.DB.prepare('INSERT INTO lots (id, joueur, sigG, wKey, moteur, lignes, octets, cartes, statut, verifs, recu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'verifie\', 1, ?)').bind(id, L[0].joueur, meta.sigG, meta.wKey, meta.moteur, meta.lignes, brut.byteLength, meta.cartes, Date.now()),
    env.DB.prepare(`UPDATE lots SET statut = 'regroupe' WHERE id IN (${place})`).bind(...ids),
    env.DB.prepare(`DELETE FROM blocs WHERE id IN (${place})`).bind(...ids),
  ]);
  return json({ ok: true, id, remplaces: ids.length });
}

async function moi(env, req, supprimer) {
  const j = await joueur(env, req, false); if (!j) return supprimer ? json({ ok: true, supprime: 0 }) : json({ connu: false });
  if (!supprimer) {
    const r = await env.DB.prepare('SELECT statut, COUNT(*) AS n, SUM(lignes) AS lignes FROM lots WHERE joueur = ? AND statut != \'regroupe\' GROUP BY statut').bind(j.id).all();
    return json({ connu: true, cred: j.cred, ecarte: !!j.banni, lots: r.results });
  }
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM lots WHERE joueur = ? AND statut != \'regroupe\'').bind(j.id).first()).n;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM blocs WHERE id IN (SELECT id FROM lots WHERE joueur = ?)').bind(j.id),
    env.DB.prepare('DELETE FROM lots WHERE joueur = ?').bind(j.id), env.DB.prepare('DELETE FROM quotas WHERE joueur = ?').bind(j.id),
    env.DB.prepare('DELETE FROM missions WHERE verificateur = ?').bind(j.id), env.DB.prepare('DELETE FROM desaccords WHERE verificateur = ?').bind(j.id),
    // Un ID ecarte le reste (sinon supprimer puis revenir effacerait la sanction) ; sinon il disparait completement.
    j.banni ? env.DB.prepare('SELECT 1') : env.DB.prepare('DELETE FROM joueurs WHERE id = ?').bind(j.id),
  ]);
  return json({ ok: true, supprime: n });
}

async function etat(env) {
  const r = await env.DB.prepare('SELECT statut, COUNT(*) AS lots, SUM(lignes) AS lignes FROM lots WHERE statut != \'regroupe\' GROUP BY statut').all();
  const j = await env.DB.prepare('SELECT COUNT(DISTINCT joueur) AS n FROM lots WHERE statut IN (\'attente\', \'conteste\', \'verifie\')').first(); // IDs qui ont envoye, pas ceux qui ont juste allume le partage
  return json({ serveur: VERSION_SERVEUR, joueurs: j.n, parStatut: r.results }, 200, { 'cache-control': 'public, max-age=300' });
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), p = url.pathname, m = req.method;
    try {
      if (p === '/v1/manifeste' && m === 'GET') return await manifeste(env, url, ctx);
      if (p.startsWith('/v1/lots/') && m === 'GET') return await lot(env, p.slice(9));
      if (p === '/v1/lots' && m === 'POST') return await envoyerLot(env, req);
      if (p === '/v1/missions' && m === 'POST') return await demanderMission(env, req);
      if (p.startsWith('/v1/missions/') && m === 'POST') return await rendreMission(env, req, p.slice(13));
      if (p === '/v1/moi' && (m === 'GET' || m === 'DELETE')) return await moi(env, req, m === 'DELETE');
      if (p === '/v1/etat' && m === 'GET') return await etat(env);
      if (p.startsWith('/v1/admin/')) {
        if (!estAdmin(env, req)) return err(403, 'admin');
        if (p === '/v1/admin/a-regrouper' && m === 'GET') return await aRegrouper(env);
        if (p === '/v1/admin/paquets' && m === 'POST') return await envoyerPaquet(env, req);
        if (p === '/v1/admin/bannir' && m === 'POST') {
          const { joueur: jid } = await lireJson(req); if (!/^[0-9a-f]{32}$/.test(jid || '')) return err(400, 'id');
          await ecarter(env, jid); return json({ ok: true });
        }
      }
      if (p === '/') return json({ service: 'base commune KitsuAI', serveur: VERSION_SERVEUR, notice: 'https://github.com/Drien95/kitsu-ai/wiki/Partage-des-calculs' });
      return err(404, 'route inconnue');
    } catch (e) { return err(500, 'erreur serveur'); }
  },
};
