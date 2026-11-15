// Ou ranger les donnees : moteur du jeu, sauvegarde, cache, resultats.
// Application installee : KITSU_DATA = dossier de donnees Windows de l'application (%APPDATA%\KitsuAI).
// Mode developpeur (.bat) : le dossier moteur/ lui-meme.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const CODE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = process.env.KITSU_DATA || CODE;
export const dir = (...p) => path.join(DATA, ...p);
