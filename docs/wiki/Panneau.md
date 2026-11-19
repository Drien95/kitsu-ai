# Le panneau

Le panneau s'ouvre dans la fenêtre KitsuAI (adresse interne : `http://127.0.0.1:47123`). Fermer la fenêtre ne coupe pas KitsuAI : il reste près de l'horloge pour continuer le conseil en combat. Pour quitter : clic droit sur l'icône, **Quitter KitsuAI**.

| Onglet | Contenu |
|---|---|
| Tableau de bord | Trois cartes de mode avec les portraits du trio (Campagne : combats gagnés à 3★, un trio par combat ; Tour : étage ; Raids : % de raids gagnés ; Arène : % de victoires, avec le script privé), liste **À faire** (sauvegarde ancienne, analyse à relancer, combats sans 3★), bouton **Mettre à jour l'IA** et tâche en cours |
| Le modèle | Ce que l’IA a appris, calcul après calcul. **La conquête** (compacte depuis 5.45) : une ligne par difficulté Cauchemar N/D/E (une case = des combats à la suite, or = presque tous à 3★ sûrs), puis la Tour (étage du meilleur trio déjà au 99 et meilleur possible), l’Arène (script privé) et le Raid en barres ; un curseur et **Rejouer** montrent chaque instantané. **Le cerveau** : les cartes des meilleurs trios, reliées quand l'IA les joue ensemble (clic : avec qui, depuis quand). **Le journal de bord** : courbe du score modèle parfait et ce qui a changé d'un calcul à l'autre. **L'ADN de l'IA** : les 76 réglages de chaque version, ceux qui ont changé entourés. Un instantané (~1 Ko) est gardé dans `data/modele-historique.json` à la fin de chaque calcul et à l'ouverture de l'onglet, seulement si quelque chose a changé (400 au plus). Rien n'est simulé, rien ne bouge sans clic. Une mini version (cerveau et score) est sur le tableau de bord. |
| Calculs | **En direct** (5.45) : pendant un calcul Tour ou Campagne, trios encore en course manche après manche et top 10 provisoire. Chaque calcul séparément avec ses options : analyse complète, entraînement, conseils de cartes, IA par équipe, IA par imitation, analyse par mode, mesure du plafond, mise à jour du moteur, mesure de vitesse |
| Résultats | Top 10 par catégorie, à tes niveaux ou au niveau 99, conseils de cartes (collectifs, plan d’XP, tirage, duos) et tous les fichiers CSV/JSON/TXT |
| Campagne | **La carte des mondes** (5.45) : une case par combat, monde par monde, pour la difficulté choisie ; or = 3★ à chaque tirage, orange = 60 % ou plus, rouge = parfois ; couche « Acquis dans le jeu » avec les étoiles gagnées (script 5.45 ou plus) ; clic sur un monde = son trio combat par combat. **Ton trio, combat par combat** (5.43) : par monde, une ligne par combat et une colonne par difficulté (Campagne ou Cauchemar N/D/E), trio de base du monde en tête de colonne et lignes orange où changer d'équipe ; lecture « objectif tout au 99 » ou « avec mes niveaux actuels » (trios aux 3 cartes déjà au 99), niveau actuel sur les portraits, mondes et combats du jeu absents du calcul « à calculer » ; sur téléphone une colonne à la fois (N/D/E). **3 étoiles en Campagne et en Cauchemar** (6 difficultés, ou Cauchemar seulement) : podium, carte à partager en PNG avec les portraits, comparateur de trios, bouton de calcul (tous les trios de tes SSR, UR et LR, ou seulement les raretés cochées avec leur risque ; temps de travail jusqu'au bout ou pause après 2 h ou 8 h ; durée prévue, heure de fin et frise, récapitulatif au-delà de 3 h ; reprise après arrêt, PC gardé éveillé ; 5.44), 10 meilleurs trios par difficulté avec portraits, graphiques (classement, difficultés, boss, mondes, course, répartition), ton équipe, ce que tu peux faire à tes niveaux, cartes clés, collectifs conseillés, export PNG par graphique ou en planche |
| Raids | Raid « Le Destin Effacé » (1 à 3 joueurs) : bouton de calcul du meilleur trio, podium par niveau de coéquipiers (moyens, bons, forts) et à 3 ou 2 joueurs, rôle de chaque carte, causes de défaite, les 3 boss et ce qu'il faut faire, tes derniers raids lus par le script |
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
| Barre à rayures fixe dans la carte de la tâche | Un calcul tourne (la barre ne défile pas, pour laisser le processeur au calcul) ; au-dessus, la mini frise des manches |
| Cloche avec un nombre | Nouvelles alertes (détail dans Journal) |

## Fiche de carte (5.45)

Clic sur un portrait : en plus des stats de base, un radar PV, ATK, DÉF, VIT, critique au niveau actuel (trait plein) et au 99 (pointillés), lus dans le moteur du jeu, carte seule avec ses étoiles. Chaque axe va jusqu'à la meilleure carte SSR, UR ou LR au 99. Dessous, ses liens actifs dans son meilleur trio, tracés entre les portraits ; en pointillés ceux qui ne sont pas gardés (6 par carte).

## Réactions de Kiko (5.45)

Une bulle de 10 s, une par évènement, jamais au premier lancement : nouveau record de Tour, carte au niveau 99, monde fini en Cauchemar, nouveaux 3★ après un calcul. Réglage : Guides, « Réactions de Kiko ».

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
