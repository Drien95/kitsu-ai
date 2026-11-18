-- Statuts d'un lot : attente, conteste, verifie, rejete (ID ecarte), regroupe (remplace par un paquet).
-- Base commune : index des lots, lots compresses (table blocs), joueurs, controles. Tout dans D1 : aucun moyen de paiement requis.
-- Aucune adresse IP, aucun pseudo : un joueur = empreinte de sa cle secrete, tiree au hasard sur son PC.
CREATE TABLE IF NOT EXISTS joueurs (id TEXT PRIMARY KEY, cred INTEGER NOT NULL DEFAULT 0, banni INTEGER NOT NULL DEFAULT 0, cree INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY, joueur TEXT NOT NULL, sigG TEXT NOT NULL, wKey TEXT NOT NULL, moteur TEXT NOT NULL,
  lignes INTEGER NOT NULL, octets INTEGER NOT NULL, cartes TEXT NOT NULL DEFAULT '', statut TEXT NOT NULL DEFAULT 'attente', verifs INTEGER NOT NULL DEFAULT 0, recu INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS lots_version ON lots (sigG, wKey, statut);
CREATE INDEX IF NOT EXISTS lots_joueur ON lots (joueur);
CREATE INDEX IF NOT EXISTS lots_recu ON lots (recu);
CREATE TABLE IF NOT EXISTS missions (id TEXT PRIMARY KEY, lot TEXT NOT NULL, verificateur TEXT NOT NULL, admin INTEGER NOT NULL, indices TEXT NOT NULL, expire INTEGER NOT NULL);
-- Desaccord d'un controleur ordinaire : le lot attend l'avis du PC admin, qui tranche (celui qui avait tort est banni).
CREATE TABLE IF NOT EXISTS desaccords (lot TEXT NOT NULL, verificateur TEXT NOT NULL, t INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quotas (joueur TEXT NOT NULL, jour INTEGER NOT NULL, lots INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (joueur, jour));
CREATE TABLE IF NOT EXISTS blocs (id TEXT PRIMARY KEY, data BLOB NOT NULL);
-- IA commune publiee par le PC validateur (une ligne par publication, la plus recente sert).
CREATE TABLE IF NOT EXISTS ia (id INTEGER PRIMARY KEY, data TEXT NOT NULL, t INTEGER NOT NULL);
