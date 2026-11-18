// Serveur de la base commune : recoit les lots de resultats Campagne, les distribue, organise les controles.
// Il ne rejoue jamais un combat (le moteur du jeu n'est jamais sur un serveur) : les controles sont faits par les PC des joueurs.
// Routes (JSON, prefixe /v1) :
//   GET  /v1/manifeste?sigG=&wKey=     lots utilisables pour cette version (verifies, plus ceux en attente marques comme tels)
//   GET  /v1/lots/<id>                  un lot (gzip), immuable
//   POST /v1/lots                       envoyer un lot (corps gzip), cle du joueur dans X-Kitsu-Cle
//   POST /v1/missions                   demander un controle { sigG, wKey } -> { mission, lot, indices }
//   POST /v1/missions/<id>              rendre un controle { resultats: [[n, s3], ...] }
//   GET  /v1/moi                        etat de mon ID ; DELETE /v1/moi : supprimer tous mes envois
//   GET  /v1/etat                       chiffres publics de la base
// Admin (jeton secret ADMIN_JETON, seulement sur le PC d'Adrien) : X-Kitsu-Admin sur /v1/missions, POST /v1/admin/bannir.
import { verifierLot, tirerIndices, ecarts, LIMITES } from '../../moteur/lib/partage-format.mjs';

const JOUR = 86400e3, K_CONTROLE = 24, MISSION_MS = 6 * 3600e3, CRED_FIABLE = 3;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-kitsu-cle, x-kitsu-admin', 'access-control-allow-methods': 'GET, POST, DELETE' };
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS, ...h } });
const err = (s, m) => json({ err: m }, s);
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha = async d => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? new TextEncoder().encode(d) : d));
const alea = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const RE_ID = /^[0-9a-f]{64}$/, RE_CLE = /^[0-9a-f]{64}$/, RE_SIG = /^[0-9a-z]{1,14}$/;

async function lireCorps(req, max) {
  const n = +req.headers.get('content-length') || 0; if (n > max) throw new Error('trop gros');
  const b = await req.arrayBuffer(); if (b.byteLength > max) throw new Error('trop gros'); return b;
}
async function degzip(buf, max) {
  const r = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).body.getReader();
  const parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > max) { r.cancel(); throw new Error('trop gros une fois decompresse'); } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return new TextDecoder().decode(out);
}

// Joueur = empreinte de sa cle (la cle elle-meme n'est jamais stockee).
async function joueur(env, req, creer = true) {
  const cle = req.headers.get('x-kitsu-cle') || ''; if (!RE_CLE.test(cle)) return null;
  const id = (await sha('kitsu-partage|' + cle)).slice(0, 32);
  let j = await env.DB.prepare('SELECT * FROM joueurs WHERE id = ?').bind(id).first();
  if (!j && creer) { await env.DB.prepare('INSERT OR IGNORE INTO joueurs (id, cred, banni, cree) VALUES (?, 0, 0, ?)').bind(id, Date.now()).run(); j = { id, cred: 0, banni: 0 }; }
  return j;
}
const estAdmin = (env, req) => !!env.ADMIN_JETON && req.headers.get('x-kitsu-admin') === env.ADMIN_JETON;

async function envoyerLot(env, req) {
  const j = await joueur(env, req); if (!j) return err(401, 'cle manquante');
  if (j.banni) return err(403, 'ID ecarte');
  const jour = Math.floor(Date.now() / JOUR), max = +(j.cred > 0 ? env.LOTS_PAR_JOUR : env.LOTS_PAR_JOUR_NOUVEAU);
  const q = await env.DB.prepare('SELECT lots FROM quotas WHERE joueur = ? AND jour = ?').bind(j.id, jour).first();
  if ((q?.lots || 0) >= max) return err(429, 'quota du jour atteint pour cet ID');
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM lots WHERE recu >= ?').bind(jour * JOUR).first();
  if (total.n >= +env.LOTS_PAR_JOUR_TOTAL) return err(429, 'quota du jour atteint pour la base');
  let brut, lot;
  try { brut = await lireCorps(req, 2.5e6); lot = JSON.parse(await degzip(brut, LIMITES.octets)); } catch (e) { return err(400, 'lot illisible : ' + e.message); }
  const raison = verifierLot(lot); if (raison) return err(400, 'lot refuse : ' + raison);
  const id = await sha(brut);
  if (await env.DB.prepare('SELECT 1 FROM lots WHERE id = ?').bind(id).first()) return json({ id, deja: true });
  await env.LOTS.put('lots/' + id, brut, { httpMetadata: { contentType: 'application/gzip' } });
  await env.DB.batch([
    env.DB.prepare('INSERT INTO lots (id, joueur, sigG, wKey, moteur, lignes, octets, statut, verifs, recu) VALUES (?, ?, ?, ?, ?, ?, ?, \'attente\', 0, ?)').bind(id, j.id, lot.sigG, lot.wKey, lot.moteur, lot.l.length, brut.byteLength, Date.now()),
    env.DB.prepare('INSERT INTO quotas (joueur, jour, lots) VALUES (?, ?, 1) ON CONFLICT (joueur, jour) DO UPDATE SET lots = lots + 1').bind(j.id, jour),
  ]);
  return json({ id, lignes: lot.l.length });
}

async function manifeste(env, url, ctx) {
  const sigG = url.searchParams.get('sigG') || '', wKey = url.searchParams.get('wKey') || '';
  if (!RE_SIG.test(sigG) || !RE_SIG.test(wKey)) return err(400, 'version');
  const cache = caches.default, cle = new Request(url.toString()), vu = await cache.match(cle); if (vu) return vu;
  const r = await env.DB.prepare('SELECT id, lignes, octets, statut, verifs FROM lots WHERE sigG = ? AND wKey = ? AND statut IN (\'verifie\', \'attente\') ORDER BY recu').bind(sigG, wKey).all();
  const rep = json({ sigG, wKey, lots: r.results }, 200, { 'cache-control': 'public, max-age=120' });
  ctx.waitUntil(cache.put(cle, rep.clone())); return rep;
}

async function lireLot(env, id) {
  const o = await env.LOTS.get('lots/' + id); if (!o) return null;
  return { brut: await o.arrayBuffer() };
}

async function lot(env, id) {
  if (!RE_ID.test(id)) return err(400, 'id');
  const l = await env.DB.prepare('SELECT statut FROM lots WHERE id = ?').bind(id).first();
  if (!l || l.statut === 'rejete') return err(404, 'lot inconnu ou ecarte');
  const o = await env.LOTS.get('lots/' + id); if (!o) return err(404, 'lot absent');
  return new Response(o.body, { headers: { 'content-type': 'application/gzip', 'cache-control': 'public, max-age=31536000, immutable', ...CORS } });
}

// Controle : un lot d'un autre joueur, des lignes tirees ici (le joueur controle ne sait pas lesquelles a l'avance).
async function demanderMission(env, req) {
  const admin = estAdmin(env, req), j = admin ? { id: 'admin', banni: 0 } : await joueur(env, req);
  if (!j) return err(401, 'cle manquante'); if (j.banni) return err(403, 'ID ecarte');
  let b; try { b = JSON.parse(await degzipOuTexte(req)); } catch { return err(400, 'corps'); }
  if (!RE_SIG.test(b?.sigG || '') || !RE_SIG.test(b?.wKey || '')) return err(400, 'version');
  // Admin : d'abord les lots contestes, puis les plus anciens en attente. Autres : un lot en attente au hasard parmi les 50 plus anciens.
  const choix = admin
    ? await env.DB.prepare('SELECT id, lignes FROM lots WHERE sigG = ? AND wKey = ? AND statut IN (\'conteste\', \'attente\') ORDER BY statut = \'conteste\' DESC, recu LIMIT 1').bind(b.sigG, b.wKey).first()
    : (await env.DB.prepare('SELECT id, lignes FROM lots WHERE sigG = ? AND wKey = ? AND statut = \'attente\' AND joueur != ? ORDER BY verifs, recu LIMIT 50').bind(b.sigG, b.wKey, j.id).all()).results.sort(() => alea() - .5)[0];
  if (!choix) return json({ mission: null });
  const indices = tirerIndices(choix.lignes, K_CONTROLE, alea), id = hex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.prepare('INSERT INTO missions (id, lot, verificateur, admin, indices, expire) VALUES (?, ?, ?, ?, ?, ?)').bind(id, choix.id, j.id, admin ? 1 : 0, JSON.stringify(indices), Date.now() + MISSION_MS).run();
  return json({ mission: id, lot: choix.id, indices });
}
async function degzipOuTexte(req) { const b = await lireCorps(req, 2e5); return new TextDecoder().decode(b); }

async function rendreMission(env, req, mid) {
  const admin = estAdmin(env, req), j = admin ? { id: 'admin', banni: 0 } : await joueur(env, req, false);
  if (!j) return err(401, 'cle manquante'); if (j.banni) return err(403, 'ID ecarte');
  const m = await env.DB.prepare('SELECT * FROM missions WHERE id = ?').bind(mid).first();
  if (!m || m.verificateur !== j.id || m.expire < Date.now()) return err(404, 'mission inconnue ou expiree');
  let b; try { b = JSON.parse(await degzipOuTexte(req)); } catch { return err(400, 'corps'); }
  const L = await env.DB.prepare('SELECT * FROM lots WHERE id = ?').bind(m.lot).first(), f = L && await lireLot(env, m.lot);
  await env.DB.prepare('DELETE FROM missions WHERE id = ?').bind(mid).run();
  if (!L || !f || L.statut === 'rejete') return json({ ok: true, sansObjet: true });
  if (b?.incompatible) return json({ ok: true, ignore: true }); // cartes ou combats differents chez le controleur : rien a conclure
  const lotJ = JSON.parse(await degzip(f.brut, LIMITES.octets)), e = ecarts(lotJ, JSON.parse(m.indices), b?.resultats);
  const now = Date.now();
  if (m.admin) {
    if (e) { // le PC admin a tort ? impossible par construction : l'envoyeur a triche ou son PC est defaillant -> tout son travail est retire
      await env.DB.batch([
        env.DB.prepare('UPDATE joueurs SET banni = 1 WHERE id = ?').bind(L.joueur),
        env.DB.prepare('UPDATE lots SET statut = \'rejete\' WHERE joueur = ?').bind(L.joueur),
      ]);
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

async function moi(env, req, supprimer) {
  const j = await joueur(env, req, false); if (!j) return supprimer ? json({ ok: true, supprime: 0 }) : json({ connu: false });
  if (!supprimer) {
    const r = await env.DB.prepare('SELECT statut, COUNT(*) AS n, SUM(lignes) AS lignes FROM lots WHERE joueur = ? GROUP BY statut').bind(j.id).all();
    return json({ connu: true, cred: j.cred, ecarte: !!j.banni, lots: r.results });
  }
  const ids = (await env.DB.prepare('SELECT id FROM lots WHERE joueur = ?').bind(j.id).all()).results.map(x => x.id);
  for (let i = 0; i < ids.length; i += 500) await env.LOTS.delete(ids.slice(i, i + 500).map(x => 'lots/' + x));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lots WHERE joueur = ?').bind(j.id), env.DB.prepare('DELETE FROM quotas WHERE joueur = ?').bind(j.id),
    env.DB.prepare('DELETE FROM missions WHERE verificateur = ?').bind(j.id), env.DB.prepare('DELETE FROM desaccords WHERE verificateur = ?').bind(j.id),
    // Un ID ecarte le reste (sinon supprimer puis revenir effacerait la sanction) ; sinon il disparait completement.
    j.banni ? env.DB.prepare('SELECT 1') : env.DB.prepare('DELETE FROM joueurs WHERE id = ?').bind(j.id),
  ]);
  return json({ ok: true, supprime: ids.length });
}

async function etat(env) {
  const r = await env.DB.prepare('SELECT statut, COUNT(*) AS lots, SUM(lignes) AS lignes FROM lots GROUP BY statut').all();
  const j = await env.DB.prepare('SELECT COUNT(*) AS n FROM joueurs WHERE banni = 0').first();
  return json({ joueurs: j.n, parStatut: r.results }, 200, { 'cache-control': 'public, max-age=300' });
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
      if (p === '/v1/admin/bannir' && m === 'POST') {
        if (!estAdmin(env, req)) return err(403, 'admin');
        const { joueur: jid } = JSON.parse(await degzipOuTexte(req)); if (!/^[0-9a-f]{32}$/.test(jid || '')) return err(400, 'id');
        await env.DB.batch([env.DB.prepare('UPDATE joueurs SET banni = 1 WHERE id = ?').bind(jid), env.DB.prepare('UPDATE lots SET statut = \'rejete\' WHERE joueur = ?').bind(jid)]);
        return json({ ok: true });
      }
      if (p === '/' ) return json({ service: 'base commune KitsuAI', notice: 'https://github.com/Drien95/kitsu-ai/wiki/Partage-des-calculs' });
      return err(404, 'route inconnue');
    } catch (e) { return err(500, 'erreur serveur'); }
  },
};
