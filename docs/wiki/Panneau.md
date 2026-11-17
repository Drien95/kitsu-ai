# Le panneau

Le panneau s'ouvre dans la fenêtre KitsuAI (adresse interne : `http://127.0.0.1:47123`). Fermer la fenêtre ne coupe pas KitsuAI : il reste près de l'horloge pour continuer le conseil en combat. Pour quitter : clic droit sur l'icône, **Quitter KitsuAI**.

| Onglet | Contenu |
|---|---|
| Tableau de bord | Trois cartes de mode avec les portraits du trio (Campagne : combats gagnés à 3★, un trio par combat ; Tour : étage ; Arène : % de victoires, avec le script privé), liste **À faire** (sauvegarde ancienne, analyse à relancer, combats sans 3★), bouton **Mettre à jour l'IA** et tâche en cours |
| Calculs | Chaque calcul séparément avec ses options : analyse complète, entraînement, conseils de cartes, IA par équipe, IA par imitation, analyse par mode, mesure du plafond, mise à jour du moteur, mesure de vitesse |
| Résultats | Top 10 par catégorie, à tes niveaux ou au niveau 99, conseils de cartes (collectifs, plan d’XP, tirage, duos) et tous les fichiers CSV/JSON/TXT |
| Campagne | **3 étoiles en Campagne et en Cauchemar** (6 difficultés, ou Cauchemar seulement) : podium, carte à partager en PNG avec les portraits, comparateur de trios, bouton de calcul (tous les trios de tes SSR, UR et LR, reprise après arrêt, PC gardé éveillé), 10 meilleurs trios par difficulté avec portraits, graphiques (classement, difficultés, boss, mondes, course, répartition), ton équipe, ce que tu peux faire à tes niveaux, cartes clés, collectifs conseillés, export PNG par graphique ou en planche |
| Script | Version disponible et version installée, connexion au PC, installer ou mettre à jour, copier le script, voir le code |
| Sauvegarde | Export actuel (cartes, équipe, boss de guilde) et import par glisser-déposer |
| Nouveautés | Notes de version de KitsuAI (bouton Mise à jour) et **patchs KITSU détectés** (cartes nouvelles et modifiées, mondes, événements, bannières, tes cartes touchées) |
| Réglages | Démarrer avec Windows, temps de réflexion du conseil en combat, fils gardés libres, alertes |
| Journal | Journal complet de la tâche, du serveur, historique, alertes |

## Mettre à jour l'IA

Anciennement « Tout lancer ». Enchaîne l'entretien de l'IA dans le bon ordre ; la Campagne 3★ et la Tour se lancent depuis leur onglet.

| Étape | Durée indicative (6 coeurs) |
|---|---|
| 1. Mise à jour du moteur du jeu | moins d'une minute |
| 2. Entraînement de l'IA (Cauchemar, boss, normal) | 5 à 30 min |
| 3. Analyse complète (tes niveaux puis 99) | 10 à 40 min |
| 4. Entraînement de l'IA de la Tour | quelques minutes |
| 5. IA par équipe (tes 3 meilleures) | quelques minutes |
| 6. Conseils de cartes (collectifs, XP, tirage, duos) | quelques minutes |

Une seule tâche à la fois : elle utilise tout le processeur moins deux fils, pour garder le conseil en combat fluide. **Arrêter** coupe l'étape en cours et les suivantes.

## Signaux visuels

| Signal | Signification |
|---|---|
| Bandeau rouge « Patch KITSU détecté » | Le jeu a changé : détail dans Nouveautés, bouton **Vu** pour le masquer |
| Bandeau jaune « Calcul conseillé » et bouton **Mettre à jour l'IA** encadré | Le jeu, ta collection ou l'IA ont changé depuis la dernière analyse. Rien n'est lancé tout seul. |
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
