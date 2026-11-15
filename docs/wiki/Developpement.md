# Développement

## Structure du dépôt

| Dossier ou fichier | Rôle |
|---|---|
| `kitsu_ai.user.js` | Script Tampermonkey (pont vers le serveur local en en-tête, code injecté dans la page) |
| `moteur/` | Serveur local, panneau (`panneau/index.html`), analyses, entraînement, simulation (`lib/`) |
| `app/` | Application Electron : fenêtre, icône près de l'horloge, mises à jour, installateur |
| `docs/wiki/` | Pages de ce wiki, publiées automatiquement |
| `.github/workflows/` | `verif` (syntaxe et versions), `release` (tag, Release, installateur), `wiki` |
| `KitsuAI.bat`, `publier.bat` | Mode développeur sans installateur, publication par branche |

## Workflow Git

`main` est protégée : une branche par changement (`feat/`, `fix/`, `docs/`, `chore/`), Pull Request, vérification `verif` au vert, **Squash and merge**. Une nouvelle `@version` dans le script déclenche le tag, la Release et l'installateur.

## Lancer en mode développeur

| Commande | Effet |
|---|---|
| `KitsuAI.bat` | Serveur et panneau dans le navigateur, données dans `moteur/` |
| `cd app && npm install && npm start` | Application Electron, données dans `%APPDATA%\KitsuAI` |
| `cd app && npm run dist` | Installateur local dans `app/dist/` |

Variable `KITSU_DATA` : dossier des données (moteur du jeu, sauvegarde, cache, résultats). Par défaut, le dossier `moteur/`.
