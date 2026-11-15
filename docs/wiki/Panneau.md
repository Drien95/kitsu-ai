# Le panneau

Le panneau s'ouvre dans la fenêtre KitsuAI (adresse interne : `http://127.0.0.1:47123`). Fermer la fenêtre ne coupe pas KitsuAI : il reste près de l'horloge pour continuer le conseil en combat. Pour quitter : clic droit sur l'icône, **Quitter KitsuAI**.

| Onglet | Contenu |
|---|---|
| Tableau de bord | **Tout lancer** (moteur du jeu, entraînement de l'IA, analyse complète), tâche en cours, tuiles d'état (moteur, processeur, script, sauvegarde, conseils en combat), meilleure équipe par catégorie |
| Calculs | Chaque calcul séparément avec ses options : analyse complète, entraînement, analyse par mode, mesure du plafond, mise à jour du moteur, mesure de vitesse |
| Résultats | Top 10 par catégorie, à tes niveaux ou au niveau 99, et tous les fichiers CSV/JSON/TXT |
| Script | Version disponible et version installée, connexion au PC, installer ou mettre à jour, copier le script, voir le code |
| Sauvegarde | Export actuel (cartes, équipe, boss de guilde) et import par glisser-déposer |
| Nouveautés | Notes de version de KitsuAI (bouton Mise à jour) et **patchs KITSU détectés** (cartes nouvelles et modifiées, mondes, événements, bannières, tes cartes touchées) |
| Réglages | Démarrer avec Windows, temps de réflexion du conseil en combat, fils gardés libres, alertes |
| Journal | Journal complet de la tâche, du serveur, historique, alertes |

## Tout lancer

| Étape | Durée indicative (6 coeurs) |
|---|---|
| 1. Mise à jour du moteur du jeu | moins d'une minute |
| 2. Entraînement de l'IA (Cauchemar, boss, normal) | 5 à 30 min |
| 3. Analyse complète (tes niveaux puis 99) | 10 à 40 min |

Une seule tâche à la fois : elle utilise tout le processeur moins deux fils, pour garder le conseil en combat fluide. **Arrêter** coupe l'étape en cours et les suivantes.

## Signaux visuels

| Signal | Signification |
|---|---|
| Bandeau rouge « Patch KITSU détecté » | Le jeu a changé : détail dans Nouveautés, bouton **Vu** pour le masquer |
| Bandeau jaune « Calcul conseillé » et bouton **Tout lancer** qui clignote | Le jeu, ta collection ou l'IA ont changé depuis la dernière analyse. Rien n'est lancé tout seul. |
| Bouton orange **Mise à jour** en haut | Nouvelle version de KitsuAI |
| Cloche avec un nombre | Nouvelles alertes (détail dans Journal) |

## Alertes

| Alerte | Quand |
|---|---|
| Énergie pleine | Ton énergie ne se recharge plus |
| Boss de guilde | Essais restants après 20 h |
| Fin d'événement | Moins de 24 h, avec des premières victoires à prendre |
| Bannières | Nouvelle bannière ouverte |
| Patch KITSU | Nouvelle version du jeu |
| Calcul conseillé | Voir ci-dessus |
| Calcul terminé | Fin d'une analyse ou d'un entraînement |

Les alertes du jeu (énergie, guilde, événements, bannières) viennent du script : kitsu.games doit être ouvert au moins de temps en temps.
