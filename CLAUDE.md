# KitsuAI : instructions pour Claude

Conseiller pour kitsu.games (jeu de cartes anime dans le navigateur). Depot PUBLIC : https://github.com/Drien95/kitsu-ai
Langue : francais. Reponses directes, tableaux plutot que paragraphes, pas de tirets cadratins ni de fleches dans les textes.

## Regles absolues (ne jamais les enfreindre)
- Lecture et affichage seulement : jamais de clic automatique, jamais de requete forgee vers le jeu, jamais d'ecriture dans la sauvegarde du jeu.
- Ne jamais contourner l'anti-robot du jeu (`isTrusted`, ecran « Petite verification »). Ne jamais aider un outil d'automatisation (AutoPilot, Auto-Verif...).
- Ne jamais copier le logo ni les images de KITSU dans le depot ou l'application (leur direction artistique : couleurs, polices, mise en page, est permise). Les portraits sont affiches depuis leur adresse d'origine, jamais copies.
- Ne jamais mettre le code du jeu dans le depot : `moteur/engine/` est ignore, chaque PC le telecharge.
- Le script public reste coupe en arene (PvP).
- Travaux locaux non publies : voir `CLAUDE.local.md` s'il existe. Rien de ce qu'il decrit ne doit entrer dans le depot.

## Organisation
| Element | Role |
|---|---|
| `kitsu_ai.user.js` | Script Tampermonkey (version dans `// @version` et `__v`). Le code de page est la fonction `kitsuMain`, indentee dans l'enveloppe ; le pont `GM_xmlhttpRequest` vers 127.0.0.1:47123 n'accepte que `/ping`, `/conseil`, `/poids`, `/equipes`, `/sauvegarde`, `/jeu`, `/raid`, `/plan` (GET, plan d'XP du PC). Modifier ce fichier directement. |
| `moteur/` | Moteur local Node : `serveur.mjs` (panneau sur 127.0.0.1:47123, jeton par demarrage, API du script), `tout.mjs` (analyse complete), `entrainer.mjs` (IA, `--par-equipe`), `distiller.mjs` (imitation), `conseils.mjs` (collectifs, XP, tirage, duos), `telecharger.mjs` (moteur du jeu + detection de patch), `tour.mjs` (Tour de l infini : TOUS les trios en course avec elimination, journal `cache/tour-*.jsonl`, finale, etages qui bloquent, collectifs ; logique dans `lib/tour.mjs` `course`), `cauchemar3.mjs` (meilleur trio PAR COMBAT apres la course : `lib/etages.mjs`, `--budget-specialistes` minutes, resultat `etages` lu par le script via `/equipes {conseil}` ; tous les trios pour les 3 etoiles en Cauchemar N/D/E et Campagne N/D/E (`--difficultes toutes|cauchemar`, la Campagne n elimine pas), course avec elimination, journal `lib/journal.mjs` garde entre analyses, `lib/eveil.mjs` empeche la veille ; a la fin, `lib/diagnostic.mjs` : cause de la 3e etoile perdue sur les combats sous le seuil, `etages.diagnostic`, aussi seul via `diagnostic3.mjs`), `raid.mjs` (Raid « Le Destin Effacé », 1 à 3 joueurs : meilleur trio contre 3 niveaux de coequipiers ; simulateur et strategie dans `lib/raid.mjs`, conseil en jeu via `/raid` du serveur), `lib/plan.mjs` (plan d'XP et de banniere tous modes, sans simulation, `/api/plan` et `/plan` ; part privee via `EXT.planPrive`), `tests.mjs` (20 tests). |
| `moteur/lib/` | `charger.mjs` (charge le moteur du jeu sous Node), `sim.mjs` (politique lineaire 19 criteres, smartPol avec reglages par equipe), `pool.mjs`/`worker.mjs` (fils), `commun.mjs`, `historique.mjs` (copies de poids.json, `reglagesAnalyse`), `chemins.mjs` (KITSU_DATA). |
| `moteur/panneau/index.html` | Panneau (refonte 5.13) : barre laterale `#nav` par groupes (liens `a[data-p]` enfants directs, l'extension y insere Arene puis le panneau le place a la place de `#navArene0`), carte de mise a jour `#majCard`, fond `.fx`. Pages : Tableau de bord, Campagne (`cauchemar3.json`, 6 difficultes, carte a partager en canvas), Tour (`tour.json`), Raids, Evenements et guilde, Calculs, Cartes et conseils (`p-resultats`), Script, Sauvegarde (collection `/api/collection`), Regles et effets (`/api/fiche`, `lib/fiche.mjs`, lu dans le moteur du jeu), Journal et Nouveautes, Reglages. Fiche de carte (clic sur un portrait), Ctrl+K. Graphiques SVG exportables en PNG. Marqueur `<!--EXT-->` pour l'extension locale. |
| `app/` | Application Electron (installateur NSIS, mises a jour electron-updater, icone pres de l'horloge, notifications). Donnees dans `%APPDATA%\KitsuAI`. |
| `docs/wiki/` | Wiki publie par le workflow `wiki`. `Methodes-et-recherches.md` : methodes utilisees, en attente, futures, outils, etudes (a tenir a jour, sans rien de `CLAUDE.local.md`). |
| `.github/workflows/` | `verif` (syntaxe, version coherente, tests moteur, refus d'une PR qui change le code sans nouvelle version), `release` (tag + Release + exe), `wiki`. |

Extension locale : `/equipes {conseil}` ajoute `exact` via `EXT.trioExact` (5.28) ; pages Tour et Campagne : `#twExt`/`twApres`, `#c3Ext`/`campApres`. Le serveur charge `prive/serveur.mjs` depuis `%APPDATA%\KitsuAI\prive` (application installee) ou `moteur/prive` (dev). Les calculs recoivent `KITSU_MOTEUR` (dossier du moteur).

## Regles de jeu utiles (lues dans le code du jeu)
- Etoiles : max(1, 3 - KO), limite a 2 si cycle > 8. Objectif des analyses : 2 etoiles minimum puis 3.
- Collectifs : 6 maximum par carte (`G.LINK_CAP`), choix dans la sauvegarde (`S.lk[id]`), respectes par `setupBattle` via `lk`.

## Publier (main est protegee)
1. Monter la version : `// @version` et `__v` dans `kitsu_ai.user.js`, ligne « Version documentee » et tableau des versions du README, section `## X.Y.Z` en tete du CHANGELOG.
2. `node moteur/tests.mjs` doit passer.
3. Claude publie lui-meme : branche depuis `origin/main`, commit (Conventional Commits), `git push -u origin <branche>`, `gh pr create` vers main, Adrien en assigne et relecteur.
4. Adrien merge. Le workflow `release` cree le tag vX.Y.Z, la Release, l'exe et le script. `publier.bat` reste un secours manuel.
Une version deja publiee ne doit jamais recevoir de nouveau code (sinon aucune mise a jour n'est proposee).
