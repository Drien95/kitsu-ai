# Le panneau

Le panneau s'ouvre dans la fenêtre KitsuAI (adresse interne : `http://127.0.0.1:47123`). Fermer la fenêtre ne coupe pas KitsuAI : il reste près de l'horloge pour continuer le conseil en combat. Pour quitter : clic droit sur l'icône, **Quitter KitsuAI**.

| Zone | Contenu |
|---|---|
| En-tête | Serveur et port, version du moteur du jeu (alerte si une plus récente est téléchargée), processeur et nombre de fils, nombre de conseils en combat et durée du dernier |
| Ta sauvegarde | Date d'export, nombre de cartes (LR, UR, SSR), équipe, niveau du compte, boss de guilde. Glisser-déposer pour importer un nouvel export |
| Actions | Voir ci-dessous |
| Tâche en cours | Nom, durée, journal en direct, bouton **Arrêter** |
| Dernière analyse | Meilleurs trios par catégorie, à tes niveaux ou tout au niveau 99 |
| Résultats | Tous les fichiers CSV, JSON et TXT, consultables dans le panneau, et le bouton pour ouvrir le dossier |
| Journal | Événements du serveur |

## Actions

| Action | Options | Durée indicative (6 coeurs) |
|---|---|---|
| Analyse complète | Niveaux (actuels, 99, les deux), tirages par combat, nombre de cartes gardées pour les trios | 10 à 40 min |
| Entraînement de l'IA | Cauchemar, boss, normal ; nombre de générations | 5 à 30 min |
| Analyse par mode | Boss Cauchemar, 3 ennemis Cauchemar, boss Extrême ; niveau 99 ; nombre de cartes | 1 à 3 min |
| Mesure du plafond | Nombre de combats | 2 à 10 min |
| Mettre à jour le moteur | À faire après une mise à jour du jeu, puis **Recharger le moteur** | moins d'une minute |
| Mesure de vitesse | Combats simulés par seconde | quelques secondes |

Une seule tâche à la fois : elle utilise tout le processeur moins deux fils, pour garder le conseil en combat fluide.
