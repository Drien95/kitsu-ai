# Le panneau

Le panneau s'ouvre dans la fenêtre KitsuAI (adresse interne : `http://127.0.0.1:47123`). Fermer la fenêtre ne coupe pas KitsuAI : il reste près de l'horloge pour continuer le conseil en combat. Pour quitter : clic droit sur l'icône, **Quitter KitsuAI**.

| Onglet | Contenu |
|---|---|
| Tableau de bord | **Tout lancer** (moteur du jeu, entraînement de l'IA, analyse complète), tâche en cours, tuiles d'état (moteur, processeur, script, sauvegarde, conseils en combat), meilleure équipe par catégorie |
| Calculs | Chaque calcul séparément avec ses options : analyse complète, entraînement, analyse par mode, mesure du plafond, mise à jour du moteur, mesure de vitesse |
| Résultats | Top 10 par catégorie, à tes niveaux ou au niveau 99, et tous les fichiers CSV/JSON/TXT |
| Script | Version disponible et version installée, connexion au PC, installer ou mettre à jour, copier le script, voir le code |
| Sauvegarde | Export actuel (cartes, équipe, boss de guilde) et import par glisser-déposer |
| Journal | Journal complet de la tâche, du serveur, historique |

## Tout lancer

| Étape | Durée indicative (6 coeurs) |
|---|---|
| 1. Mise à jour du moteur du jeu | moins d'une minute |
| 2. Entraînement de l'IA (Cauchemar, boss, normal) | 5 à 30 min |
| 3. Analyse complète (tes niveaux puis 99) | 10 à 40 min |

Une seule tâche à la fois : elle utilise tout le processeur moins deux fils, pour garder le conseil en combat fluide. **Arrêter** coupe l'étape en cours et les suivantes.
