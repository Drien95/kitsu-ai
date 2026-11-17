# KitsuAI

Conseiller et guide complet pour **KITSU** (kitsu.games), le jeu de cartes anime au tour par tour.

Version documentée : **5.14.1**. Historique détaillé : `CHANGELOG.md`. Dépôt public : https://github.com/Drien95/kitsu-ai (copie locale : `C:\Project\PROJECT_KITSU`).

## Télécharger

| Quoi | Lien |
|---|---|
| **Application Windows** (panneau, conseil en combat sur le PC, analyses, entraînement, mises à jour automatiques) | [Dernière release](https://github.com/Drien95/kitsu-ai/releases/latest), fichier `KitsuAI-Setup-X.Y.Z.exe` |
| **Script du jeu** (Tampermonkey) | [kitsu_ai.user.js](https://github.com/Drien95/kitsu-ai/releases/latest/download/kitsu_ai.user.js) |
| **Documentation** | [Wiki](https://github.com/Drien95/kitsu-ai/wiki) |


Fichiers : `kitsu_ai.user.js` (le script Tampermonkey à installer, qui contient tout le code), `README.md`, `CHANGELOG.md`, `publier.bat` / `publier.ps1` (envoi sur GitHub : double-clic sur `publier.bat`, avec ton git et ton compte GitHub Windows ; le message de commit est dans `.commitmsg`).

---

## Sommaire

1. [Principes](#1-principes)
2. [Installation et mise à jour](#2-installation-et-mise-à-jour)
3. [L'interface](#3-linterface)
4. [Le guide pas à pas](#4-le-guide-pas-à-pas)
5. [Le conseiller de combat](#5-le-conseiller-de-combat)
6. [Le moteur de combat du jeu (analyse)](#6-le-moteur-de-combat-du-jeu-analyse)
7. [L'IA : simulation, apprentissage, calibration](#7-lia--simulation-apprentissage-calibration)
8. [Le choix d'équipe](#8-le-choix-déquipe)
9. [Campagne, modes et plan](#9-campagne-modes-et-plan)
10. [Économie : énergie, gemmes, boutique, invocations](#10-économie--énergie-gemmes-boutique-invocations)
11. [Événements, Salle de l'Esprit et du Temps, Comptoir](#11-événements-salle-de-lesprit-et-du-temps-comptoir)
12. [Guilde, Tour de l'infini, quêtes, pass, albums](#12-guilde-tour-de-linfini-quêtes-pass-albums)
13. [Onglet Avenir : prévisions](#13-onglet-avenir--prévisions)
14. [Roadmap de connexion](#14-roadmap-de-connexion)
15. [Fiabilité et diagnostic](#15-fiabilité-et-diagnostic)
16. [Données du jeu utilisées](#16-données-du-jeu-utilisées)
17. [Données enregistrées par le script](#17-données-enregistrées-par-le-script)
18. [Commandes console](#18-commandes-console)
19. [Limites connues](#19-limites-connues)
20. [Historique des versions](#20-historique-des-versions)
21. [Analyses réalisées en dehors du script](#21-analyses-réalisées-en-dehors-du-script)
22. [Paramètres internes](#22-paramètres-internes)
23. [Export de la collection](#23-export-de-la-collection)
24. [Déroulé du projet](#24-déroulé-du-projet)

---

## 1. Principes

| Règle | Détail |
|---|---|
| **Lecture seule** | Le script lit la page, ta sauvegarde (`localStorage.shokan_save_v1`) et le code du jeu. Il n'écrit jamais dans la sauvegarde du jeu. |
| **Aucun clic automatique** | Il ne clique jamais à ta place. Il met en évidence l'endroit où cliquer, et c'est toi qui cliques. |
| **Aucune requête forgée** | Il n'envoie aucune action au serveur du jeu. Les seules requêtes sont des lectures (état de la guilde) et le chargement des fichiers du jeu déjà présents dans la page. |
| **Respect de l'anti-robot** | Le jeu vérifie que chaque clic vient d'un humain (`isTrusted`) et affiche une « Petite vérification » en cas de doute. Le script ne contourne rien et, sur cet écran, te dit simplement de cocher la case toi-même. |
| **Arène désactivée** | Le conseiller se coupe en arène (joueur contre joueur), volontairement. |
| **Tout est simulé localement** | Les conseils viennent de simulations faites avec le propre moteur du jeu (`BattleCore`, `setupBattle`), dans ton navigateur. |

---

## 2. Installation et mise à jour

1. Installer l'extension **Tampermonkey** dans Chrome.
2. Dans les réglages de l'extension Chrome, autoriser les **scripts utilisateur** (« Allow User Scripts »).
3. Tampermonkey, puis « Créer un nouveau script », coller tout le contenu de `kitsu_ai.user.js`, puis **Ctrl+S**.
4. Recharger kitsu.games.

**Mettre à jour :** ouvrir le script dans Tampermonkey, tout remplacer par la nouvelle version, Ctrl+S, recharger la page. L'onglet Santé affiche la version active.

**Comment le script se lance :** l'en-tête `@match https://kitsu.games/*`, `@grant none`. Le code est injecté dans la page par une balise `<script>` (la politique de sécurité du site l'autorise). Il attend que `BattleCore`, `CHAR_BY_ID` et les fichiers `dom-*.js` et `app-*.js` du jeu soient chargés, puis lance `KitsuAI.start()`.

---

## 3. L'interface

### Le dock

Un seul cadre, déplaçable à la souris par sa barre, repliable avec **Alt+K** (position mémorisée). Les onglets :

| Onglet | Contenu |
|---|---|
| **Combat** | Le coup conseillé, la cible, les chances de victoire, le « Pourquoi », l'alerte « coup décisif » |
| **Équipe** | Sur l'écran de choix des cartes : le verdict « À jouer », le classement des trios, ton équipe |
| **Plan** | Les combats à faire, gemmes à prendre, énergie nécessaire, murs, Tour |
| **Roadmap** | Les priorités de la session (voir section 14) |
| **Tirage** | La valeur de chaque bannière active pour ton équipe |
| **Avenir** | Les prévisions (voir section 13) |
| **Santé** | État du script, calibration, erreurs, boutons « Tout recalculer », « Signaler », « Alerte énergie pleine » |

Un point vert sur un onglet signale qu'il a du contenu à jour. L'onglet suit le contexte (combat, équipe, invocation) sauf si tu viens d'en choisir un (30 s).

En haut du dock, la barre **Objectif LR** suit la bannière limitée en cours : gemmes, compteur de garantie, temps restant, et si la garantie est atteignable ou non.

### La bulle du guide

Placée juste sous la barre de navigation du jeu (pour ne pas la cacher). Elle dit **quoi faire et pourquoi**.

### Le code couleur

| Couleur | Sens |
|---|---|
| **Contour bleu qui clignote** | Clique ici maintenant. Un seul élément à la fois. |
| **Vert** | Carte à ajouter ensuite |
| **Rouge** | Carte à retirer |
| **Orange** (en combat) | L'attaque à jouer et la cible |

Dans le panneau Équipe, un cadre « À jouer » **bleu** veut dire que l'équipe fait aussi monter des cartes en retard ; **vert**, qu'elle est simplement la plus forte. Les taux de 3 étoiles sous 95 % sont en rouge.

### Les accents

Le code est écrit sans accents ; un correcteur les remet à l'affichage (étoiles, équipe, énergie, dégâts, bannières, etc.).

---

## 4. Le guide pas à pas

Toutes les 0,5 s, le guide regarde l'écran et ta sauvegarde, et montre **une seule** prochaine action.

### Ordre de priorité

La règle : **ce qui se perd passe avant ce qui attend**.

| Rang | Situation | Action guidée |
|---|---|---|
| 1 | Combat en cours | Suivre le panneau orange |
| 2 | Vérification anti-robot du jeu | Texte seulement : coche la case toi-même |
| 3 | Animation ou fenêtre par-dessus l'écran | Booster à ouvrir (glisser sur les pointillés), carte à retourner, « Tout passer », « Passer ▸▸ » de l'invocation, « Touche pour continuer », carte obtenue, croix des fenêtres, popup « installer l'appli » |
| 4 | Fenêtre parchemin ouverte | Le plus gros parchemin, puis la carte à faire monter (ou la recherche) |
| 5 | Fenêtre défi de doublons ouverte | « Remplir », puis valider |
| 6 | Fenêtre de confirmation du jeu (`.ask`) après un achat, une recharge ou une récupération conseillée | Le bouton de validation (`[data-yes]` : Recharger, Acheter, Confirmer) |
| 7 | Dialogue d'aventure | « Passer », avec l'astuce « Passer les dialogues » |
| 8 | Écran de fin de combat | « Rejouer » (mode XP), « Combat suivant » (si c'est le prochain du plan), sinon « Retour à la carte » |
| 9 | Écran de choix des cartes | Voir plus bas |
| 10 | Récompenses gratuites | Connexion du jour, quêtes terminées (« Tout récupérer »), paliers du pass, albums complets |
| 11 | Quêtes du jour faciles | « Consulte des fiches », « Fais défiler 15 cartes » : la bonne page, 90 s, puis on passe |
| 12 | Événements | Invocations Shonen gratuites (dès 8/10), clochettes (20 = 1 invocation), Comptoir, défis de doublons prêts, Salle de l'Esprit et du Temps, premières victoires d'événement, parchemins à utiliser |
| 13 | Guilde | Raid Pain, puis boss de la semaine (essais du jour) |
| 14 | Économie | Énergie x25 de la boutique du jour, offres de boutique jugées rentables, tirage seulement si une LR garantie est atteignable |
| 15 | Énergie à 0 | Recharge (15 gemmes) s'il reste des 3 étoiles à prendre, sinon « reviens dans ~10 min » |
| 16 | Campagne | Les combats jamais joués gagnés à 90 % ou plus, et les combats déjà à 1 ou 2 étoiles seulement si les 3 étoiles sont quasi sûres (90 % ou plus). Classés par chance de 3 étoiles, puis gemmes par énergie, puis XP |
| 17 | Tour de l'infini | Si débloquée (niveau de compte 25) et si l'IA prévoit de battre ton record |
| 18 | Rejouer pour l'XP | Le combat déjà à 3 étoiles qui donne le plus d'XP par énergie, avec une équipe sûre qui fait monter tes cartes en retard |

### Navigation

- **Vers une page** (`goView`) : le lien du menu déroulant s'il est ouvert, sinon celui de la barre du haut, sinon le premier visible. La bulle précise « clique d'abord sur « QUÊTES » dans la barre du haut ». Pour Aventure, Événements, Tour et Arène, passage par **Jouer**.
- **Page Quêtes** : hub à 3 cartes (Récompense quotidienne, Quêtes, Parcours), puis la liste, puis « Tout récupérer ». Bouton retour vers le hub si tu es dans la mauvaise section.
- **Campagne** : monde, puis arc (défilement si besoin), puis bouton de mode de l'arc (Normal, Difficile, Extrême, Cauchemar), puis l'étape. Jamais de retour à la liste des mondes si tu es dans le bon monde (correction de la « boucle »).
- **Événement** : Jouer, Événements, la carte de l'événement, la difficulté, Combattre. Salle : « S'entraîner » ou « Affronter le gardien ».
- **Boutique** : l'icône panier en haut (`#navShop`), puis l'offre.

### Écran de choix des cartes

- Le guide suit **exactement** le verdict « À jouer » du panneau Équipe dès qu'il est calculé pour ce combat. Avant, il utilise l'équipe du plan.
- Toutes les cartes à la fois : rouge à retirer, vert à ajouter, bleu clignotant pour le prochain clic.
- Si la carte n'est pas affichée (pagination), il met en évidence la **barre de recherche** et te dit quoi taper.
- Équipe déjà bonne : « équipe prête : clique sur Combattre », avec l'astuce « Passer les dialogues » si elle n'est pas cochée.
- **Bouton « Carte »** (retour) mis en évidence si : un combat de Salle ou d'événement est à faire d'abord ; si ce combat est un mur (moins de 90 % de 3 étoiles au mieux) ; ou si tu as déjà 1 ou 2 étoiles et que la 3e n'est pas assez sûre (« 3e étoile pas assez sûre ici, pour 1 gemme : joue plutôt… »).

### Anti-blocage

- Mise en pause de 20 min des propositions d'économie quand tu lances un autre combat (jamais pour la Salle ou les événements).
- Si un bouton attendu reste introuvable sur la bonne page, le guide attend 8 s (chargement), puis passe à la suite pour 10 min.
- Aucune flèche n'est posée sur l'écran de vérification anti-robot.

---

## 5. Le conseiller de combat

Pendant ton tour, pour l'unité active :

1. Liste des coups légaux : Attaque, Technique, Ultime, Repos, et chaque cible possible.
2. Pour chaque coup : copie de l'état du combat, coup joué, puis fin du combat simulée par l'IA. **8 simulations par coup**, puis des simulations en plus (jusqu'à 40) sur les coups au coude à coude, dans une limite d'environ 60 ms.
3. Affichage : le meilleur coup avec son **vrai nom** (« Tir de pistolet », « Ordre tactique », etc.), sa description, la cible, les chances de victoire **calibrées**, et les autres coups.
4. Surbrillance orange du bouton d'action (touches du jeu Q, E, R, F) et de la cible ; contour vert sur l'unité qui joue ; badge au-dessus de la cible.
5. **« Pourquoi »** : les raisons en clair (met X K.O., brise X et lui fait sauter un tour, le boss charge et le briser annule son attaque de zone, avantage de type x1,5, endurance basse, un allié est à 40 % de PV, touche les 3 ennemis, profite de sa DEF baissée, etc.).
6. **« COUP DÉCISIF »** quand un seul coup sépare la victoire de la défaite.

Chaque décision est enregistrée (prévision de victoire, prévision de 3 étoiles) puis comparée au résultat réel : c'est la base de la calibration (section 7).

---

## 6. Le moteur de combat du jeu (analyse)

Analysé dans le code du jeu, puis reproduit par simulation.

### Tours et ressources

| Mécanique | Valeur |
|---|---|
| Ordre des tours | Jauge AV = 10 000 / vitesse ; un « cycle » = le temps pour une unité de vitesse 100 de jouer une fois |
| Endurance | Réserve de 100 par équipe, +10 à chaque tour de ton équipe |
| Coût en endurance | Attaque 10, Technique 25, Ultime 20 |
| Repos | +45 d'endurance, garde (dégâts subis x0,7) |
| Énergie d'ultime | Attaque +20, Technique +30, coup reçu +10, K.O. +10 ; Ultime disponible à 100 |

### Dégâts

`dégâts = ATK² / (ATK + DEF) x multiplicateur`, puis :

| Facteur | Effet |
|---|---|
| Avantage de type (TEC > DEF > DEG > SOI > TEC) | x1,5 (désavantage x0,75) |
| Cible brisée | x1,25 |
| Coup critique | x1,6 |
| Variation aléatoire | x0,93 à x1,07 |

### Résistance (casse)

Chaque ennemi a une jauge de résistance. À zéro, il est **brisé** : il saute son tour, subit +25 % de dégâts, et un boss qui chargeait perd sa charge.

### IA ennemie

| Ennemi | Comportement |
|---|---|
| Normal | Technique toutes les 3 actions |
| Cible | Une unité qui provoque d'abord ; sinon 45 % du temps l'allié le plus bas en PV (%), 55 % au hasard. **La position dans l'équipe ne compte pas.** |
| Boss | Toutes les 3 actions, il charge, puis attaque de zone x1,7. Phase 2 sous 50 % de PV : ATK x1,3 |
| Cauchemar et guerre de guilde (`ai = 'nm'`) | IA plus fine : elle choisit quand charger selon ton endurance et tes PV ; attaque de zone x1,9 (x2,1 en phase 2) ; dégâts qui augmentent avec les actions |

### Étoiles

**3 étoiles = victoire sans aucun K.O. en 8 cycles maximum.**

### Collectifs

Liens entre cartes (même série, duos, groupes : « Akatsuki » ATK +15 %, « NERV » DEF +15 %, « Duel contre Sasori » ATK +15 %, etc.). Ils s'activent dès que les cartes sont dans l'équipe, **quel que soit l'ordre**. Le moteur les applique à la construction du combat, donc toutes les simulations les incluent. Vérifié : avec Sasori, l'ATK de Sakura passe de 1 410 à 1 621 ; avec Kaji, la DEF de Misato passe de 2 810 à 3 231.

### Synergie « même série » (patch du jeu du 13/11/2026)

Chaque carte gagne **+5 % d'ATK et de DEF par allié de la même série** (+10 % pour un trio d'un même anime). Valable partout (Aventure, Tour, événements, boss de guilde, Arène), en plus des collectifs. Appliquée par le moteur du jeu, donc incluse dans toutes les simulations. Vérifié au niveau 60 : Kisame passe de 2 290 d'ATK (sans allié Naruto) à 2 766 avec Orochimaru (Akatsuki +15 % et synergie +5 %), et 2 897 avec Orochimaru et Sasori.

Autres changements du même patch pris en compte automatiquement : ennemis des films et hors-série à -25 % de PV, ATK et DEF en Difficile et Cauchemar ; techniques de la Saga Buu (Goku SSJ3, Kid Buu, Vegetto) ; correctif de Julius Novachrono (Vol de temps).

### Ordre des cartes

Vérifié dans le code et en simulation (4 ordres, 80 combats, 42 victoires dans chaque cas) : **l'ordre ne change rien**.

### Équipement

Il n'existe pas de système d'équipement dans le jeu. Le mot n'apparaît que dans le conseil générique de l'écran de défaite et dans des noms de sorts.

---

## 7. L'IA : simulation, apprentissage, calibration

### Politique de jeu

Une politique **linéaire** : chaque coup possible est décrit par **19 critères**, pondérés, et le coup au meilleur score est joué.

| # | Critère |
|---|---|
| 1 à 4 | Type de coup : Repos, Attaque, Technique, Ultime |
| 5 | Part des PV de la cible retirés |
| 6 | Met la cible K.O. |
| 7 | La cible est en train de charger |
| 8 | Part de la résistance retirée (casse) |
| 9 | Avantage ou désavantage de type |
| 10 | Endurance restante après le coup |
| 11 | Soin, bouclier, provocation ou protection, pondéré par le PV de l'allié le plus bas |
| 12 | Attaque de zone, pondérée par le nombre d'ennemis |
| 13 | Gros coup pendant qu'un boss charge |
| 14 | Énergie déjà accumulée (pour la Technique) |
| 15 | Contrôle |
| 16 | Bonus (buff) |
| 17 | Gros coup sur une cible à DEF baissée |
| 18 | Repos quand l'endurance est sous 25 |
| 19 | Attaque simple quand l'ultime est presque prêt |

### Quatre jeux de poids, un par mode

`normal`, `boss`, `cauchemar`, `tour`. La stratégie choisit automatiquement : Tour si le combat est un étage, Cauchemar si `ai = 'nm'`, Boss s'il y a un boss, sinon Normal.

### Apprentissage (méthode d'entropie croisée)

Population de jeux de poids, chacun joué sur un banc de combats ; on garde les meilleurs, on recentre, on recommence **jusqu'au plateau** (arrêt après 12 générations sans progrès, 120 maximum). Les calculs se mettent en pause pendant tes combats. Poids enregistrés dans `kitsu_ai_w3`. À la fin, la campagne, les équipes, l'équipe cible, les événements et les murs sont resimulés avec eux. Réentraînement automatique en tâche de fond quand ton équipe a beaucoup changé.

### Résultats mesurés (IA du script contre le mode AUTO du jeu)

| Banc | IA du script | AUTO du jeu | Total |
|---|---|---|---|
| Combats normaux | **174** | 94 | 342 |
| Boss | **236** | 166 | 492 |
| Cauchemar | **62** | 27 | 162 |
| Tour (étages atteints en moyenne) | **16,4** | 12,5 | |

### Calcul en fil séparé (Web Worker)

Les classements d'équipes, le plan d'entraînement et la boutique tournent dans un **Web Worker** qui charge le même module du jeu. Les fonctions de simulation lui sont transmises telles quelles. Résultats vérifiés identiques au fil principal. Repli automatique sur le fil principal si le worker n'est pas disponible.

### Calibration

Chaque prédiction (victoire et 3 étoiles) est comparée au résultat réel. Les pourcentages affichés sont corrigés par tranche (0-20 %, 20-50 %, 50-80 %, 80-100 %) dès qu'une tranche a 10 combats. L'onglet Santé affiche la calibration **par mode** (Normal, Difficile, Extrême, Cauchemar, Salle, Événement). Mesuré en campagne : 114 combats, prédictions justes.

---

## 8. Le choix d'équipe

### Le panneau Équipe

Sur l'écran « Choisis tes cartes » :

1. Tous les trios de tes 10 meilleures cartes (plus les cartes de l'équipe cible et du plan d'entraînement), **8 simulations** chacun contre ce combat précis (résultats en cache par combat et par niveaux).
2. Les **8 meilleurs et ton équipe sont rejoués 32 fois** : 8 simulations ne suffisent pas à dire qu'une équipe fait 3 étoiles à coup sûr.
3. Classement : 3 étoiles d'abord, puis victoire.
4. Parmi les équipes à 95 % de 3 étoiles ou plus, priorité à celle qui fait monter les **cartes à entraîner**.
5. **Verdict unique « À jouer »**, avec la raison : « déjà la bonne », « fait monter X », ou « la plus sûre ». Le guide suit ce verdict.

### L'équipe cible (long terme)

Calculée dans le plan d'entraînement :

- Toutes tes cartes SSR, UR et LR classées par stats **au même niveau** (le niveau de tes meilleures cartes).
- Tous les trios des 10 meilleures, simulés **deux fois sur 77 combats Extrême** (en Normal, presque tout gagne).
- Parmi les trios à 4 victoires près du meilleur, celui qui demande **le moins d'XP**.
- Stabilité : l'ancienne cible est gardée tant qu'elle reste à 4 victoires près.

Ses cartes en retard deviennent prioritaires pour l'XP : le plan et le panneau prennent l'équipe cible dès qu'elle fait aussi 3 étoiles (16 simulations).

### Exemple mesuré (tes cartes, toutes au niveau 66, 231 combats Extrême)

| Équipe | Victoires |
|---|---|
| Osamu / Trunks / Sasori | 63 |
| Osamu / Kisame / Trunks | 51 |
| Osamu / Kisame / Konan | 46 |
| Osamu / Kisame / Misato | 45 |

### Plan d'entraînement

Pour chaque carte candidate : en la montant au niveau de ton équipe, combien de combats de référence gagnés en plus, pour combien d'XP. Classement par gain par XP. Recalculé au plus toutes les heures après tes combats, et dès qu'une carte arrive.

---

## 9. Campagne, modes et plan

### Modes

| Mode | Suffixe | Multiplicateur d'XP | Bonus de 1re victoire |
|---|---|---|---|
| Normal | | x1 | 0 |
| Difficile | `@h` | x1,3 | +1 gemme |
| Extrême | `@x` | x1,6 | +2 gemmes |
| Cauchemar Normal / Difficile / Extrême | `@n` / `@hn` / `@xn` | | x2 sur tout |

Le **Cauchemar** se débloque par arc, après les 3 difficultés en 3 étoiles sur tout l'arc. Les ennemis s'adaptent aux stats de ton équipe (x3 PV, ATK, DEF dans l'affichage du jeu) : les niveaux aident peu, la **composition** compte.

### Gemmes (formule exacte du jeu)

`gemmes = ((3 - étoiles déjà obtenues) + (bonus de 1re victoire si aucune étoile)) x (2 en Cauchemar)`

| Palier en 3 étoiles d'un coup | Gemmes |
|---|---|
| Normal | 3 |
| Difficile | 4 |
| Extrême | 5 |
| Cauchemar Normal | 6 |
| Cauchemar Difficile | 8 |
| Cauchemar Extrême | 10 |

Soit 36 gemmes par combat sur les 6 paliers, et **71 892** pour toute la campagne.

### XP

Chaque carte de l'équipe reçoit **toute** l'XP du combat. XP pour passer du niveau l au suivant : `30 x l^1,35`.

### Le plan

**Rejouer ou pas ?** Sur un combat déjà à 1 ou 2 étoiles, il ne reste que 1 ou 2 gemmes. À 78 % de 3 étoiles, cela fait moins d'une gemme par énergie, contre environ 3 pour un combat neuf. Ces combats ne sont donc reproposés que lorsque les 3 étoiles atteignent 90 %, **et jamais pendant 24 h après un vrai échec** (les vrais résultats priment sur la simulation) ; en attendant, la roadmap les liste dans « À reprendre plus tard pour la 3e étoile ».

Pour chaque combat jouable pas encore à 3 étoiles (y compris la suite Normal, Difficile, Extrême, Cauchemar) : meilleure équipe (tri rapide de 4 simulations, puis les 6 meilleurs rejoués 16 fois), chances de victoire et de 3 étoiles, gemmes attendues, XP, coût en énergie. Ton équipe actuelle est gardée si elle fait aussi bien. Recalculé après chaque combat ; les équipes des 3 prochains combats sont précalculées pendant l'écran de résultats.

### Murs

Les combats hors de portée sont listés avec les niveaux qu'il manque, l'équipe qui les passera le plus tôt, et une **date estimée** à ton rythme de montée en niveau (mesuré toutes les 6 h). Exemple : Garlic Jr. (forme Makyo), Difficile, 61 342 PV et 10 152 d'ATK : 13 % au mieux aujourd'hui ; Osamu / Trunks / Sasori atteignent 60 % vers le niveau 75 et 75 % vers 80.

### Rejouer pour l'XP

Quand il ne reste plus de 3 étoiles faciles : parmi les combats déjà à 3 étoiles, celui qui donne le plus d'XP par énergie, avec une équipe qui gagne à 95 % ou plus et fait monter les cartes en retard. Exemple : « Le Cell Game » (DBZ), 6 215 XP par carte pour 1 énergie. Pas de recharge d'énergie pour ça (non rentable).

---

## 10. Économie : énergie, gemmes, boutique, invocations

### Énergie

| Règle | Valeur |
|---|---|
| Recharge naturelle | 1 toutes les 10 min, 10 maximum |
| Recharge payante | 15 gemmes, **remplit jusqu'au maximum** : à faire **à 0**, jamais avant (à 7/10, on perd environ 6 gemmes) |
| Rentabilité à 0 | 10 énergies, soit environ 30 gemmes de 3 étoiles, donc environ +15 net |
| Énergie de la boutique du jour | x25 pour 30 gemmes, une fois par jour |
| Énergie du Comptoir | +5 pour 600 Zeni, 3 fois par jour |
| Alerte | Notification système quand l'énergie devient pleine (onglet Santé) |

### Invocations

| Règle | Valeur |
|---|---|
| Prix | 5 gemmes la carte, 50 le x10 |
| Taux | SSR 8,5 %, UR 1 %, LR 0,4 % ; carte vedette une fois sur deux |
| Garantie (« pity ») | **1 point tous les 10 tirages**, LR garantie à 50 points, soit 2 500 gemmes depuis 0 |
| Compteur | Propre à chaque bannière |
| Invocations Shonen gratuites | +1 toutes les 10 min, **10 maximum** (20 en VIP). Pleines, elles ne se rechargent plus. Le guide les signale dès 8/10. |
| Clochettes | 20 = 1 invocation Shonen |

**Stratégie appliquée par le guide :**

- Invocations gratuites : toujours.
- Gemmes : **pas de tirage**, sauf si la LR garantie d'une bannière est atteignable avec ce que tu as, ou pour la **LR du jour de la boutique** (1 500 gemmes) si elle vaut le coup pour ton équipe. Une réserve de 15 gemmes est toujours gardée pour une recharge à 0.

### L'onglet Tirage

Pour chaque bannière active : victoires en plus sur les combats difficiles de référence par 10 tirages, compte tenu des cartes que tu possèdes déjà, du taux de chaque rareté et de la carte vedette (nouvelle carte supposée niveau 22). Meilleure carte à espérer pour toi.

### Boutique du jour

Chaque offre (carte SSR, UR, LR, énergie) est comparée aux tirages et aux recharges : acheter ou passer, avec la raison. Le guide ne propose que les achats « acheter », en gardant 15 gemmes.

### Doublons

Chaque étoile apporte +2 % d'ATK et DEF (7 maximum). Les doublons SSR, UR et LR sont gardés pour les **défis de doublons** (section 11) ; les autres pour la quête « Fusionne un doublon » ou le marché.

---

## 11. Événements, Salle de l'Esprit et du Temps, Comptoir

### Événements (liés à une bannière limitée)

Chaque événement a un combat « entraînement » et un boss, en 4 difficultés.

| Difficulté | Énergie | Gemmes 1re victoire (entraînement / boss) | Chance de carte SSR de la série (boss) |
|---|---|---|---|
| Normal | 1 | 1 / 2 | 4 % |
| Difficile | 2 | 2 / 3 | 7 % |
| Extrême | 3 | 3 / 5 | 11 % |
| Ultime | 4 | 5 / 8 | 16 % |

- 3 essais par jour et par difficulté. XP de combat à 60 %.
- Récompenses de l'entraînement selon l'événement : parchemins d'XP (petit 500, moyen 2 500, grand 10 000), Zeni ou clochettes.
- Le script simule chaque combat avec ta meilleure équipe. Le guide propose les **premières victoires gagnables à 80 % ou plus**, les plus sûres d'abord, puis les plus rentables en gemmes par énergie. Les combats perdus d'avance (ex. Acnologia Extrême 2/12, Ultime 0/12) sont listés à part.
- **Événements tournants** (Tenkaichi, Ginyu, etc.) : présents dans le code mais désactivés par le jeu pour l'instant. Ils seront repris automatiquement s'ils apparaissent.

### Salle de l'Esprit et du Temps

Toujours ouverte, **XP de combat x10**, 3 essais par jour.

| Combat | Énergie | XP par carte | Bonus |
|---|---|---|---|
| Le Gardien (Mr Popo) | 3 | 16 580 | 2 petits parchemins, 5 gemmes à la 1re victoire |
| L'entraînement de Piccolo | 2 | 6 030 | 3 gemmes à la 1re victoire |

Le guide fait le Gardien d'abord, avec l'équipe qui gagne à coup sûr et fait monter les cartes en retard. Ces combats ne sont jamais mis en pause.

### Comptoir des Zeni

Énergie +5 (600, 3 fois par jour), grand parchemin (3 500), invocation (4 000), parchemin moyen (1 000). Ordre d'achat conseillé : **l'énergie d'abord** (5 énergies dans la Salle valent environ 80 000 XP).

### Parchemins

Guidés jusqu'au bout : « Utiliser », le plus gros parchemin, puis la carte à faire monter (équipe cible en priorité), avec la recherche si elle n'est pas affichée.

### Défis de doublons (renouvelés le lundi à 17 h)

| Défi | Coût | Gain | Par semaine |
|---|---|---|---|
| Relève | 10 doublons SSR | 1 UR au hasard | 2 |
| Esprit de série | 5 doublons UR d'une même série | 1 UR au choix de cette série | 1 |
| Sceau légendaire | 10 doublons UR | 1 ticket LR | 1 |
| Pacte des légendes | 3 doublons LR | 1 LR au hasard | 1 |

Seuls les exemplaires en trop comptent. Le guide signale un défi dès qu'il est prêt, puis « Remplir » et valider. La roadmap suit ta progression.

---

## 12. Guilde, Tour de l'infini, quêtes, pass, albums

### Guilde

| Contenu | Ce que fait le script |
|---|---|
| Raid Pain | Meilleur trio en dégâts (cartes du niveau minimum requis), essais restants, guidage : COMMUNAUTÉ, Social, onglet Guilde, onglet Pain, choix des cartes, Attaquer |
| Boss de la semaine | 3 essais par jour, 12 tours, 1 000 dégâts minimum, 1 point par 2 500 dégâts. Meilleur trio simulé, puis même guidage |
| Défis et coffre | Proposés seulement quand l'API dit que tu es éligible (3 jours dans la guilde + 1 combat livré). Sinon : date exacte de déblocage, et avertissement si elle tombe après le reset du lundi 17 h. Guidage : onglet Défis puis Réclamer, onglet Coffre puis Réclamer |
| Boutique de guilde | Points personnels. Ordre : 5 invocations Shonen (150, 30 pts/invocation) > 10 énergies (120) > multi x10 (500). Carte UR (4 000/mois) non visée. Guidage : onglet Boutique puis le bon bouton |
| Plafond boss | 400 points par semaine : la roadmap calcule le nombre d'essais nécessaires (dégâts plafonnés à 300 000 par combat) |
| Équipe déjà en place | Le guide lit les noms sous « Ton équipe » : bonne équipe = flèche directe sur Attaquer, sinon « Changer l'équipe » |
| Défis de guilde | Défis terminés à récupérer (roadmap) |
| Guerre de guilde | Combats disponibles quand une rivalité est active (roadmap) |

État des essais relu toutes les 5 minutes.

### Tour de l'infini

Débloquée au **niveau de compte 25**. Coût 4 énergies par montée ; soin de 12 % entre les étages, 30 % après un boss (tous les 10 étages) ; 2 gemmes au premier passage de chaque étage de boss. Le script simule une montée complète pour chaque trio et retient le meilleur étage moyen. Guidage : Tour, nouvelle montée, cartes, lancer, étage suivant, seulement si l'IA prévoit de battre ton record.

### Quêtes, pass, connexion

- **Détection complète** des quêtes terminées, y compris celles d'**Histoire** (« termine l'arc », « 3 étoiles sur tout l'arc »), dont la progression est calculée par le jeu et non enregistrée.
- Guidage : « QUÊTES », la carte « Quêtes » du hub, « Tout récupérer ». Récompense quotidienne : la carte « Récompense quotidienne », puis le jour. Paliers du pass : la page du pass.
- Quêtes du jour faciles (fiches, défilement d'invocation) : guidées.

### Albums

Une série dont tu possèdes toutes les cartes sorties donne une récompense : le guide t'emmène dans Collection pour la récupérer.

### Marché

Pas encore ouvert dans le jeu (« Le marché arrive bientôt »). Signalé dans l'onglet Avenir.

---

## 13. Onglet Avenir : prévisions

Tout vient des données du jeu ou de ton rythme mesuré.

| Section | Contenu |
|---|---|
| Gemmes | Maintenant, rythme sur 24 h, projection à 3 et 7 jours |
| LR de la boutique | Dans combien de jours, et si 1 500 gemmes seront atteignables |
| Bannières | Fin de chaque bannière limitée (avec ton compteur), ouvertures à venir |
| Événements | Fin, premières victoires restantes |
| Nouvelles cartes | Calendrier de sortie du jeu (une sortie par jour à 17 h), avec les LR et UR de chaque jour |
| Quêtes du jour restantes | Progression et comment les finir |
| Quêtes de demain | Avec la préparation (ex. « mets une carte Soin dans l'équipe ») |
| Hebdo de la semaine prochaine | Avec la préparation (ex. « Fusionne 20 doublons : ne fusionne pas tes doublons avant », « Dépense 300 gemmes : garde-les pour ce jour-là ») |
| Tes cartes dans 3 / 7 jours | Niveau projeté à ton rythme, cartes qui ne montent pas en rouge, cartes de l'équipe cible signalées |
| Prochain mur | Niveaux manquants et date estimée |
| Tour, marché, événements tournants | État |

Exemple de calendrier relevé : 15 nov. Barbe Blanche (LR), Marco (UR) ; 17 nov. Goku Super Saiyan Blue (UR), Golden Freezer (UR) ; 18 nov. Itachi Edo Tensei (UR) ; 19 nov. Garp (LR), Sengoku (UR), Akainu (UR) ; 21 nov. Vados (LR), Zeno (LR) ; 22 nov. Madara Uchiha (LR).

Les nouvelles cartes arrivent dans les invocations (Shonen gratuites, bannières de leur série) et la boutique du jour.

---

## 14. Roadmap de connexion

Affichée à la connexion (au plus toutes les 90 min), triée par priorité :

- Quêtes à récupérer, défis de guilde terminés, albums complets
- Énergie pleine (« joue maintenant »), combats à jouer avec l'équipe pour chacun
- Recharge à 0 si rentable
- Invocations gratuites, Comptoir, défis de doublons, Salle, premières victoires d'événement
- Raid Pain et boss de guilde avec l'équipe et les dégâts attendus
- Bannières qui se terminent (dans les 96 h) avec le coût exact de la garantie
- Gemmes : garder, ou tirer si la garantie est atteignable
- Équipe cible et cartes à monter
- Boutique du jour : offres à acheter
- Plan d'entraînement
- Doublons
- Combats à reprendre plus tard pour la 3e étoile
- Prochain mur avec date estimée
- Tour de l'infini (niveau requis)

Affichage instantané depuis le cache ; recalcul en arrière-plan.

---

## 15. Fiabilité et diagnostic

| Outil | Rôle |
|---|---|
| **Vérification après mise à jour du jeu** | À chaque nouvelle version des fichiers du jeu, le script vérifie que les ~40 boutons qu'il utilise existent toujours dans le code. Sinon : alerte, et le nombre d'introuvables dans l'onglet Santé. |
| **Détection de version** | Fichiers du jeu, nombre de combats, de cartes, bannières actives. À chaque changement : tous les résultats simulés (plan, équipes, équipe cible, murs, boutique, événements, XP, Tour, guilde, roadmap) sont effacés et recalculés avec les nouvelles règles, puis l'IA est réentraînée. |
| **Bouton « Signaler »** | Copie un rapport : version, écran, ce que dit le guide, élément pointé, énergie, gemmes, équipe, écran d'équipe ou combat en cours, plan, erreurs, vérification, et les boutons visibles avec leurs attributs. À coller dans la conversation avec Claude. Les 10 derniers sont gardés. |
| **Onglet Santé** | Version, fil séparé actif ou non, âge du plan, des équipes, de l'entraînement, des murs, des bannières, de la boutique ; état de l'apprentissage ; journal ; prédictions de 3 étoiles justes ; calibration par mode ; erreurs récentes |
| **Tout recalculer** | Vide les caches (plan, équipes, entraînement, murs, bannières, boutique, guilde, roadmap) et relance tout |
| **Pause pendant les combats** | Les calculs lourds attendent la fin du combat |
| **Détection de visibilité** | Prend en compte les fenêtres affichées par-dessus la page (position fixe) |

---

## 16. Données du jeu utilisées

### Objets globaux

`window.BattleCore` (moteur), `CHAR_BY_ID` (3 244 cartes : nom `n`, rareté `r`, série `s`, rôle `prof`, ATK, DEF, puissance `pw`), `MOVES`, `KitsuLinks`.

Raretés internes : `C` commune, `U`, `R`, `E` = SSR, `L` = UR, `M` = LR.

### Modules importés

`/assets/dom-*.js` (objet `g` : `setupBattle`, `findFight`, `ALL_WORLDS`, `BANNERS`, `statsAt`, `fightXp`, `fightCost`, `energy`, `enMax`, `NM`, `MODES`, `questList`, `streakState`, `passState`, `albumList`, `activeLinks`, `pityMax`, `EVENTS`, `EVENT_FIGHTS`, `eventOpen`, `SCROLLS`, `setupTower`, `TOWER`, `setupGwBoss`, `setupPain`, `STORY_DROPS`, `dropAt`, `CARD_DROPS`, `MARKET_OPEN`, `ROT_ON`, etc.) et `/assets/app-*.js` (combat en cours, écran de choix des cartes, retrouvés par leur forme).

### Sauvegarde lue (`shokan_save_v1`)

`owned`, `lv`, `stars`, `pve.stars`, `pve.team`, `ki` (gemmes), `energy`, `pity`, `dshop`, `quests`, `pass`, `acct`, `streak`, `ev` (parchemins, Zeni, clochettes, victoires, essais), `packs` (invocations gratuites), `sbc`, `albums`, `tower`, `teams`, `dupMode`.

### Sélecteurs de la page (principaux)

Combat `.unit[data-unit]`, `button.act[data-act]` ; campagne `button.node[data-fight]`, `button.world[data-world]`, `[data-arc-mode]`, `[data-arc-nm]`, `[data-back-worlds]` ; équipe `[data-pick]`, `.card[data-id]`, `[data-unslot]`, `[data-close-prep]`, `input[data-skip-dlg]` ; fin de combat `[data-result-next]`, `[data-result-retry]`, `[data-result-close]` ; dialogues `[data-dl-skip]` ; navigation `a[data-view]`, `a[href="#"]`, `#navShop` ; économie `[data-en-refill]`, `[data-ds-buy]`, `[data-open]` ; quêtes `[data-qpage]`, `[data-qclaim-all]`, `[data-claim-streak]`, `[data-pass-claim]`, `[data-claim-album]` ; événements `[data-evp-feat]`, `[data-evp-diff]`, `[data-evp-go]`, `[data-salle-fight]`, `[data-ev-buy]`, `[data-ev-bells]`, `[data-ev-use]`, `[data-ev-size]`, `[data-ev-scroll]`, `[data-sbc-open]`, `[data-sbc-auto]`, `[data-sbc-ok]` ; guilde `[data-gtab]`, `[data-gw]`, `[data-pain]` ; Tour `[data-tw]` ; fenêtres `.wk-skip`, `.rr-tap`, `.rw-card`, `[data-pop-close]`, `[data-pwa-later]`.

---

## 17. Données enregistrées par le script

Toutes dans le `localStorage` du site, préfixe `kitsu_ai_`. Aucune n'est envoyée nulle part.

| Clé | Contenu |
|---|---|
| `w3` | Poids réentraînés |
| `log` | Journal des combats (prédictions, résultat, étoiles) pour la calibration |
| `ver` | Dernière version du jeu vue |
| `plan` | Plan de campagne |
| `teams` | Classements d'équipes par combat (25 derniers) |
| `training` | Plan d'entraînement et équipe cible |
| `walls` | Murs et niveaux nécessaires |
| `pulls` | Valeur des bannières |
| `shop` | Verdicts de la boutique du jour |
| `events` | Combats d'événement et de la Salle, chances, équipes |
| `farm` | Combat à rejouer pour l'XP |
| `tower` | Meilleure équipe et étage prévu |
| `guild`, `gw`, `pain` | Essais de guilde, équipes boss et Pain |
| `rewards` | Récompenses de chaque combat (500 derniers) |
| `lvhist` | Historique des niveaux (rythme de progression) |
| `road`, `road_seen` | Roadmap et dernier affichage |
| `goal` | Objectif LR |
| `snooze` | Propositions mises en pause |
| `lastTeam` | Dernière équipe conseillée |
| `selfcheck` | Résultat de la vérification des boutons |
| `reports` | Les 10 derniers « Signaler » |
| `dock`, `guide`, `enAlert`, `enNotified`, `rosterSig` | Réglages et états d'interface |

---

## 18. Commandes console

Ouvrir la console (F12) sur kitsu.games :

| Commande | Rôle |
|---|---|
| `await KitsuAI.start()` | Lancer (automatique avec Tampermonkey) |
| `KitsuAI.stop()` | Arrêter |
| `KitsuAI.status()` | Version du jeu, poids, entraînement, calibration |
| `await KitsuAI.retrain()` | Réentraîner jusqu'au plateau |
| `await KitsuAI.plan()` | Recalculer le plan |
| `await KitsuAI.roadmap()` / `KitsuAI.showRoad()` | Roadmap |
| `await KitsuAI.training()` | Plan d'entraînement et équipe cible |
| `await KitsuAI.pulls()` | Valeur des bannières |
| `await KitsuAI.shops()` | Boutique du jour |
| `await KitsuAI.events()` | Événements et Salle |
| `await KitsuAI.farm()` | Combat à rejouer pour l'XP |
| `await KitsuAI.tower()` | Simulation de la Tour |
| `await KitsuAI.guildRefresh()` | Essais de guilde |
| `await KitsuAI.xpPlan()` | Quelle carte monter |
| `await KitsuAI.selfCheck(true)` | Vérifier les boutons du jeu |
| `KitsuAI.signal()` | Rapport de l'écran (copié) |
| `KitsuAI.report()` | Prédictions contre résultats |
| `KitsuAI.rewards()` | Récompenses des derniers combats |
| `KitsuAI.guide(false)` / `KitsuAI.guide(true)` | Couper ou relancer le guide |
| `KitsuAI.energyAlert(true)` | Notification d'énergie pleine |
| Alt+K | Replier le dock |

---

## 19. Limites connues

- **Écrans pas encore vus en fonctionnement réel** (vérifiés seulement dans le code du jeu) : boutique, guilde, Tour, albums, parchemins, défis de doublons, rejouer pour l'XP. Utiliser « Signaler » au premier souci.
- **Ce n'est pas une optimisation sur la semaine entière** : ce sont des règles de priorité appuyées par des simulations. Par exemple, le guide ne garde pas d'énergie en prévision d'un événement qui ouvre le lendemain.
- **Préparations de quêtes futures** (garder des doublons, des gemmes, mettre une carte Soin) : affichées dans Avenir, pas imposées par le guide.
- **Simulations** : une simulation par combat sur certains classements de fond ; un écart de 2 ou 3 victoires sur 77 n'est pas significatif.
- **Contenu ajouté plus tard par les développeurs** : repris automatiquement au chargement suivant, mais impossible à prévoir avant.
- **Arène** : non couverte, volontairement. **Marché** : fermé dans le jeu.

---

## 20. Historique des versions

| Version | Apports |
|---|---|
| 1.x | Lecture de la collection, conseiller de combat en direct (surbrillance de l'attaque et de la cible) |
| 2.x | Politique apprise (CEM) jusqu'au plateau, poids boss, simulations de campagne |
| 3.x | Détection de version, poids par mode (Cauchemar, Tour), modes Difficile, Extrême, Cauchemar, plan de progression, suivi des récompenses, conseiller d'invocation |
| 3.10 | Versions en texte (« 3.10 » n'est plus égal à « 3.1 ») |
| 4.0 à 4.6 | Roadmap, guide pas à pas, guilde dans la roadmap, garder l'équipe actuelle, règles 3 étoiles d'abord, départage par l'XP, dock unique, accents, « Pourquoi », calibration, onglet Santé, Web Worker, échéances de bannières, alerte énergie pleine, barre objectif LR, formule exacte des gemmes, paliers Cauchemar |
| 4.7 | Événements, Salle de l'Esprit et du Temps, invocations gratuites, défis de doublons, Comptoir, parchemins ; garantie corrigée à 1 point pour 10 tirages |
| 4.7.1 | Les combats d'événement et de la Salle ne sont plus mis en pause |
| 4.8 à 4.8.3 | Équipe cible à niveau égal, plan d'entraînement refait, vérification des 3 étoiles sur 16 puis 32 simulations |
| 4.9 / 4.9.1 | Écran de fin de combat guidé, équipe entière en couleur, recherche de carte ; verdict « À jouer », équipe cible stabilisée |
| 5.0 | Récompenses (quêtes, connexion, pass), boutique et confirmation, parchemins et doublons jusqu'au bout, menu Jouer, Signaler, vérification après mise à jour, calibration par mode, date des murs, plus de tirages en gemmes sans garantie atteignable |
| 5.0.1 / 5.0.2 | Le guide suit le panneau Équipe ; bouton « Carte » quand il faut jouer ailleurs |
| 5.1 | Rejouer pour l'XP quand la campagne est épuisée |
| 5.2 | Guilde (Pain, boss), Tour de l'infini, albums, onglet Avenir |
| 5.3 | Quêtes de demain et de la semaine prochaine avec préparation, projection d'entraînement, quêtes du jour faciles |
| 5.3.1 à 5.3.4 | Quêtes d'Histoire détectées, hub de la page Quêtes, bulle sous la barre du jeu, « clique d'abord sur QUÊTES », animations et fenêtres (Passer, carte obtenue, croix, installation), détection des fenêtres en position fixe |
| 5.3.5 | Plus de relance d'un combat déjà à 1 ou 2 étoiles si la 3e n'est pas quasi sûre ; liste « à reprendre plus tard » |
| 5.3.6 | Après une mise à jour du jeu, tous les calculs sont refaits avec les nouvelles règles (patch synergie « même série ») |
| 5.3.7 | Le guide pointe toujours l'exemplaire visible d'un bouton (recharge d'énergie) |
| 5.3.8 | Fenêtres de confirmation du jeu reconnues (« Recharger », « Acheter ») |
| 5.3.9 | Invocations gratuites : « Invoquer x1 » quand le x10 n'est pas disponible |
| 5.3.10 | Animation d'invocation guidée (booster, carte, Tout passer) ; toutes les invocations gratuites utilisées une fois sur la page |
| 5.3.11 | Boutons de l'écran de résultats d'invocation (Invoquer x1, Fermer) |
| 5.3.12 | Correctif d'une erreur du guide sur l'écran de résultats d'invocation |
| 5.3.13 | Page Jouer : la carte « Aventure » est surlignée (et non la jauge d'énergie) |
| 5.3.14 | Boss de guilde : équipe calculée dès que des essais restent, sans attendre la roadmap |
| 5.3.15 | Les vrais résultats priment : un combat raté (pas 3 étoiles) n'est plus reproposé pendant 24 h |
| 5.3.16 | Cauchemar seulement sur les arcs vraiment débloqués ; équipe de guilde parmi tes meilleures cartes |
| 5.3.17 | Caches recalculés à chaque nouvelle version du script ; jamais de flèche sur un Cauchemar verrouillé |
| 5.3.18 | Tout est resimulé automatiquement à la fin d'un réentraînement de l'IA |
| 5.3.19 | Guilde atteinte par COMMUNAUTÉ, Social, onglet Guilde ; meilleure équipe de boss conservée |
| 5.3.20 | Guilde complète : défis, coffre, boutique (avec éligibilité 3 jours), plafond de 400 points, équipe déjà en place détectée |
| 5.3.21 | Pauses du guide effacées à chaque version ; lien Parrainage ignoré pour aller en Guilde |
| 5.3.22 | Boss de guilde : toutes les cartes éligibles, confirmation sur 40 combats, plafond 300 000 |
| 5.3.23 | Fin de la boucle Changer l'équipe / Fermer ; essais épuisés détectés (pause jusqu'à minuit) |
| 5.3.24 | Confirmation des achats et récupérations de guilde guidée |
| 5.3.25 | Salle de l'Esprit et du Temps ouverte depuis sa carte d'événement |
| 5.3.26 | Fenêtres de confirmation des événements et des défis de doublons guidées |
| 5.3.27 | Confirmation du dessus prise en priorité (Déposer, pas Valider le défi) |
| 5.3.28 | Parchemins d'XP guidés par la Collection (fiche de la carte cible, plus gros parchemin, Max utile, Utiliser) |
| 5.3.29 | Nouveaux boutons de combat d'événement (`data-ev-fight`), difficulté Ultime |
| 5.3.30 | Bouton Combattre de l'écran d'équipe prioritaire sur ceux de la page en dessous |
| 5.3.31 | Équipe cible jugée sur les 127 boss du jeu en Extrême |
| 5.4.0 | Moteur local multithread (dossier moteur/), règle des étoiles, export de la sauvegarde |
| 5.4.1 | Mode « tout » du moteur local (campagne, Cauchemar, boss, événements, Tour, guilde), élimination adaptative, cache disque |
| 5.5.0 | Conseil en combat calculé sur le PC (serveur local, anticipation poussée), mesure du plafond |
| 5.6.0 | Panneau local (KitsuAI.bat), entraînement local de l'IA, réglages adoptés par le script |
| 5.7.0 | Application Windows (installateur, icône près de l'horloge, mises à jour automatiques), wiki, panneau aux couleurs de KITSU |
| 5.8.0 | Bouton Tout lancer, onglet Script (versions, copier, installer), panneau réorganisé sur le modèle du site KITSU |
| 5.8.1 | Release en brouillon jusqu'à l'ajout de l'installateur (mise à jour automatique fiable) |
| 5.9.0 | Bouton Mise à jour et onglet Nouveautés (patch notes) dans le panneau, mise à jour d'un clic |
| 5.10.0 | Sauvegarde automatique, guide branché sur les calculs du PC, détection des patchs KITSU, calcul conseillé, Réglages, alertes, tests automatiques |
| 5.11.0 | Conseils de cartes (collectifs, plan d'XP, tirage, duos), IA par équipe, IA par imitation, historique et restauration des réglages de l'IA |
| 5.11.1 | Portraits et cadres de rareté dans le panneau, équipe phare, icônes de mode |
| 5.11.2 | Les analyses utilisent les réglages entraînés sur le PC (et par équipe), écarts avec l'analyse précédente |
| 5.11.3 | Extensions locales facultatives pour le serveur et le panneau |
| 5.11.4 | Combat : le calcul du PC ne remplace plus un bon coup par « Respirer » quand tous les coups se valent |
| 5.12.0 | Tour de l'infini : trio cherché pour la Tour, étages qui bloquent, collectifs, réglages de combat appris pour la Tour, Pain, conseils d'échange au marché ; les analyses tiennent compte des collectifs |
| 5.12.1 | Le jeu ne ralentit plus avec le temps : l'objectif de bannière n'est plus recalculé toutes les 0,4 s (il relisait le journal des gains, qui grossit à chaque combat), les contours du conseiller ne sont plus retirés et remis 7 fois par seconde, le journal de calibration n'est plus relu à chaque coup |
| 5.14.1 | Launcher : pages sur toute la largeur de l'écran, notes de version sur plusieurs colonnes ; Campagne : trios, combats, mémoire et durée du 1er tour affichés avant le calcul, progression pendant ; rappel de réinstaller le script Tampermonkey avec une mise à jour du launcher, carte « Script à mettre à jour » tant que Tampermonkey a l'ancienne version |
| 5.14.0 | Refonte du launcher : barre latérale par groupes (Modes de jeu, Analyses, Outils), mise à jour du launcher en évidence, onglets Tour, Événements et guilde, Raids ; Campagne en 6 difficultés (Campagne et Cauchemar N/D/E), podium, carte à partager en PNG, comparateur ; collection avec recherche et filtres, fiche de carte, Ctrl+K, fond animé, responsive |
| 5.13.0 | Cauchemar 3 étoiles : `cauchemar3.mjs` juge TOUS les trios de tes SSR/UR/LR (course avec élimination prudente), combat arrêté dès que les 3 étoiles sont perdues (vérifié), journal des essais gardé entre deux analyses (vidé seulement si le combat, la carte ou l'IA changent), PC gardé éveillé pendant le calcul ; onglet Campagne dans le panneau (bouton de calcul, graphiques, export PNG) ; page wiki Méthodes et recherches |

---

## 21. Analyses réalisées en dehors du script

### Pour ton compte

- **Équipe cible avant le patch synergie** : Osamu Miya + Trunks + Sasori (63/231 combats Extrême à niveau 66).
- **Après le patch** (tout au niveau 70, 231 combats Extrême) : Kisame / Orochimaru / Trunks 77, Osamu / Trunks / Sasori 71, Kisame / Sasori / Trunks 64, Konan / Osamu / Trunks 63, Osamu / Kisame / Misato 41. Le trio 100 % Naruto Kisame / Orochimaru / Sasori ne fait que 14 : la synergie ne remplace pas Trunks.
- **Nouvelles cartes testées** : Trunks, Rikiya, Kakuzu, Konan, Edgar, Zanark, Ultear. Seul le duo Trunks + Sasori change la donne.
- **Le roi démon ressuscité (Difficile, boss)** : 3 étoiles à 78 % au mieux (Kisame / Orochimaru / Trunks) ; garder 2 étoiles et revenir plus tard.
- **Krilin sous la brume (Difficile)** : 3 étoiles à 100 % avec Osamu / Kisame / Misato ; 75 % avec Kakuzu / Midnight / Edgar.
- **Garlic Jr. (Difficile)** : mur, voir section 9.
- **Garantie Akatsuki** : 1 750 gemmes manquantes, hors de portée avant la fin de la bannière ; gemmes à garder pour la LR de la boutique.

### Pour des amis

| Demande | Résultat |
|---|---|
| Meilleure de deux équipes | Orochimaru / Itachi / Kisame bat Orochimaru / Obito / Itachi |
| Cauchemar, grande collection LR | Sasori / Itachi / Tenma |
| Boss de guilde (Zeref niveau 12, 12 tours) | Shou Kusakabe + Sasori (Akatsuki) + Lelouch, Meruem ou Asta : plafond de 300 000 dégâts atteint à chaque essai, en 7 tours, sans K.O. |
| Campagne, 2e ami (niveaux actuels) | Itachi / Son Gohan (enfant) / Orochimaru (Akatsuki) : 75/77 |
| Campagne, 2e ami (à niveau égal) | Void (LR) dans les 10 meilleures équipes ; Void / Son Gohan / Baraggan ou Void / Itachi / Wirbel |

---

## 22. Paramètres internes

### Fréquences

| Élément | Fréquence |
|---|---|
| Guide (prochain clic) | 0,5 s |
| Dock (onglets, accents, barre objectif) | 0,4 s |
| Détection de fin de combat (récompenses) | 0,4 s |
| Onglet Santé | 2 s |
| Onglet Avenir | 3 s |
| Essais de guilde | 5 min |
| Historique des niveaux | contrôlé toutes les heures, une mesure toutes les 6 h, 3 jours gardés (12 mesures maximum) |
| Roadmap affichée d'office | au plus toutes les 90 min |
| Vérification des boutons du jeu | 15 s après le lancement, puis à chaque nouvelle version des fichiers du jeu |

### Nombre de simulations

| Calcul | Simulations |
|---|---|
| Conseiller de combat | 8 par coup, puis jusqu'à 40 sur les coups proches, budget d'environ 60 ms, 8 tours d'affinage |
| Panneau Équipe | Tous les trios x 8, puis les 8 meilleurs et ton équipe x 32 |
| Guide, vérification de ton équipe | 12 |
| Plan de campagne | Tous les trios x 4 (x 12 sur les boss), puis les 6 meilleurs x 16 ; équipe cible x 16 |
| Équipe cible | 10 cartes, tous les trios, 77 combats Extrême x 2 |
| Plan d'entraînement | 77 combats de référence x 1 par trio testé |
| Événements | Classement d'équipes complet pour chaque combat pas encore gagné |
| Tour | Trios de tes 8 meilleures cartes, 4 montées complètes (au lancement, au plus une fois par jour) |
| Raid Pain | Trios des 12 premières cartes éligibles x 2 |
| Boss de guilde | Trios des 24 cartes éligibles les plus hautes x 4 combats, puis 12 meilleurs x 40 combats |
| Rejouer pour l'XP | Les 6 combats au meilleur XP par énergie, classement d'équipes complet |

### Caches et seuils

| Élément | Durée ou clé |
|---|---|
| Classements d'équipes | Par combat, équipe cible, niveaux (par tranches de 3) et étoiles de tes 10 meilleures cartes ; 25 combats gardés |
| Plan d'entraînement | 6 h, ou dès que la collection ou les niveaux (tranches de 3) changent |
| Murs | 12 h, niveaux par tranches de 3 |
| Événements | 6 h, ou dès qu'une victoire est enregistrée |
| Combat XP | 1 h |
| Boutique | Par jour et par taille de collection |
| Garder l'équipe actuelle | Si elle fait 3 étoiles au moins aussi souvent que la meilleure, à 2 % près |
| Équipe « pour l'XP » | Seulement à 95 % de 3 étoiles ou plus |
| Combats proposés en campagne | Victoire à 90 % ou plus (jamais joués) ; 3 étoiles à 90 % ou plus (déjà 1 ou 2 étoiles) |
| Premières victoires d'événement | Victoire à 80 % ou plus |
| Salle | Victoire à 85 % ou plus |
| Équipe cible | Tolérance de 4 victoires, puis le moins d'XP |

### Mises en pause du guide

| Cas | Durée |
|---|---|
| Achat ou tirage proposé, mais tu lances un combat | 20 min |
| Récompense introuvable sur la bonne page (après 8 s d'attente) | 10 min |
| Quête du jour facile (après 90 s sur la page) | 15 min |
| Guilde introuvable | 15 min |
| Salle et événements | jamais |

### Déclencheurs automatiques

- **Réentraînement de l'IA** : quand les niveaux de tes 8 meilleures cartes ont changé (tranches de 5) depuis plus de 12 h.
- **Plan, équipes précalculées** : après chaque combat.
- **Événements** : après un combat d'événement.
- **Plan d'entraînement** : après un combat, s'il a plus d'une heure.
- **Alerte énergie** : au passage de « pas pleine » à « pleine ».

---

## 23. Export de la collection

`kitsu_collection.csv` : la première extraction de tes cartes possédées (128 cartes au moment de l'export ; tu en as 287 aujourd'hui, le fichier n'a pas été remis à jour).

Colonnes : id, nom, série, rareté, profil, type, puissance, niveau, étoiles, PV / ATK / DEF actuels, vitesse, critique, ATK et DEF de base, maximum au niveau 99 avec 7 étoiles, kit, compétence, ultime, collectif.

Les données viennent de `CHAR_BY_ID`, `MOVES` et `KitsuLinks`, puis des fiches de cartes ouvertes une à une (avec contrôle du nom pour éviter de relire une fiche déjà affichée).

---

## 24. Déroulé du projet

1. **Extraction de la collection** (cartes possédées seulement), puis lecture directe des données du jeu dans le code de la page.
2. **Analyse des mécaniques** : combinaisons, collectifs, kits, IA ennemie, formules.
3. **Simulateur de combat** à partir du moteur du jeu, puis **IA auto-améliorée** entraînée jusqu'au plateau.
4. **Conseiller en direct** : surbrillance de l'attaque et de la cible. Les demandes d'automatisation (cliquer à ta place, envoyer des requêtes) ont été refusées : le jeu bloque les clics non humains et ce serait contourner sa protection.
5. **Modes de campagne**, Cauchemar, plan de progression, suivi des récompenses, conseiller d'invocation, détection de version.
6. **Roadmap**, **guide pas à pas**, guilde, gestion de l'équipe actuelle, règles des 3 étoiles, XP.
7. **Dock unique**, accents, raisons des coups, calibration, Santé, Web Worker, échéances, alerte énergie, objectif LR.
8. **Événements**, Salle, Comptoir, doublons, parchemins ; correction de la garantie (1 point pour 10 tirages).
9. **Équipe cible**, vérifications sur plus de simulations, panneau à verdict unique.
10. **Guide complet** : fin de combat, récompenses, boutique, fenêtres, menu Jouer, bouton Carte, rejouer pour l'XP, guilde, Tour, albums, quêtes.
11. **Prévisions** (onglet Avenir) et outils de fiabilité (Signaler, vérification après mise à jour).

Les analyses ponctuelles des tout premiers échanges (comparaison de cartes, meilleure carte de parrainage, première équipe Misato / Rococo / Salamander) ne sont pas reprises en détail : leurs résultats ont été dépassés par l'évolution de ta collection et ne sont plus conservés.

## Panneau local (`KitsuAI.bat`)

Double-clic sur `KitsuAI.bat` : le moteur est mis à jour si besoin, le serveur démarre et le panneau s'ouvre sur http://127.0.0.1:47123. Laisse la fenêtre noire ouverte pendant que tu joues : c'est elle qui calcule le conseil en combat.

| Zone du panneau | Contenu |
|---|---|
| En-tête | Serveur et port, moteur chargé, processeur et fils, conseils en combat |
| Ta sauvegarde | Export du jeu (onglet Santé, « Exporter pour le moteur local ») à glisser-déposer |
| Actions | Analyse complète, entraînement de l'IA, analyse par mode, mesure du plafond, mise à jour du moteur, mesure de vitesse |
| Tâche en cours | Journal en direct, bouton Arrêter |
| Dernière analyse | Meilleurs trios par catégorie, à tes niveaux et au niveau 99 |
| Fichiers | Tous les CSV/JSON de `moteur/resultats/`, consultables dans le panneau |

Une seule tâche à la fois (elle utilise tout le processeur moins deux fils, pour garder le conseil en combat fluide). Les réglages appris par l'entraînement sont récupérés tout seuls par le script du jeu.

## Moteur local (dossier `moteur/`)

Le moteur de combat du jeu tourne aussi sous Node.js, directement sur le PC, en multithread. C'est beaucoup plus rapide que dans l'onglet et rien ne se perd si la page se recharge.

| Fichier | Rôle |
|---|---|
| `telecharger-moteur.bat` | Télécharge le moteur du jeu dans `moteur/engine/<version>/` (une fois par version du jeu). Fichiers du jeu : jamais dans le dépôt (`.gitignore`). |
| `serveur.bat` | Raccourci vers `KitsuAI.bat`. **Conseil en combat calculé sur le PC.** À laisser ouvert pendant que tu joues. Le panneau de combat envoie l'état du combat à `http://127.0.0.1:47123` (ta machine uniquement) ; le PC simule la suite de chaque action sur tous ses coeurs et renvoie la meilleure pour 2 étoiles ou plus, puis 3. Sans serveur, le script garde son conseil habituel. |
| `entrainer.mjs` | Entraînement local de l'IA (`--types nm,boss,norm --generations 40`), résultat dans `data/poids.json`. |
| `plafond.mjs` | Compare l'IA actuelle et l'IA qui anticipe sur des combats disputés (`node plafond.mjs --n 10 --k 6 --r 20`). |
| `tout.bat` | **Analyse complète** de tes LR/UR/SSR, à tes niveaux puis au niveau 99 : campagne Extrême, boss Extrême, Cauchemar (tous, 2 ennemis ou plus, boss), événements et Salle, Tour de l'infini, boss de guilde. Prend son temps (de l'ordre de 10 à 40 min). Résultats : `moteur/resultats/tout-<date>.csv` et `.json`. Options : `--niveaux actuel`, `--tirages 5`, `--cartes 26`, `--fils 12`, `--max 40` (test rapide). |
| `analyser.bat` | Choix du mode (boss Cauchemar, 3 ennemis Cauchemar, boss Extrême), puis meilleures cartes et meilleurs trios. Résultats aussi en CSV dans `moteur/resultats/`. |
| `bench.mjs` | Mesure de vitesse (combats par seconde). |
| `lib/` | Chargement du moteur, simulation (même IA que le script), pool de fils. |

Ta collection : onglet Santé du panneau, **Exporter pour le moteur local**, puis mettre `sauvegarde.json` dans `moteur/data/`. Sans ce fichier, l'analyse porte sur toutes les SSR, UR et LR du jeu au niveau 99. Options : `--lv99` (tes cartes au niveau 99), `--top 30` (nombre de cartes gardées pour les trios), `--fils 11`.

Règle des étoiles (code du jeu) : étoiles = max(1, 3 - K.O.), plafonnées à 2 au-delà du cycle 8. L'objectif de l'analyse est 2 étoiles minimum (victoire avec au plus 1 K.O.), départagé par les 3 étoiles.

## Workflow Git

La branche `main` est protégée : personne n'y pousse directement, tout passe par une branche et une Pull Request.

| Type de changement | Préfixe de branche | Exemple |
|---|---|---|
| Nouvelle fonction | `feat/` | `feat/guide-parchemins` |
| Correction | `fix/` | `fix/bouton-combattre-evenement` |
| Documentation | `docs/` | `docs/readme-guilde` |
| Maintenance | `chore/` | `chore/maj-selecteurs` |

1. Écrire le nom de la branche dans `.branch` et le message dans `.commitmsg` (fichiers locaux, non versionnés).
2. Double-clic sur `publier.bat` : la branche part de la dernière version de `main`, le commit est envoyé et la page de la Pull Request s'ouvre.
3. Sur GitHub : **Create pull request**, attendre que la vérification `verif` passe au vert, puis **Squash and merge**.

### Versions, tags et releases

Le numéro de version vient de l'en-tête du script (`// @version`). À chaque merge sur `main`, le workflow `.github/workflows/release.yml` regarde si cette version a déjà un tag :

- si non : il crée le tag `vX.Y.Z` et une **Release GitHub** avec la section correspondante du CHANGELOG et le fichier `kitsu_ai.user.js` en pièce jointe ;
- si oui (changement de doc, de workflow…) : rien, pas de nouvelle version.

Une nouvelle version = monter `@version` dans le script, plus la ligne du README et une section `## X.Y.Z` dans le CHANGELOG (la vérification `verif` bloque le merge si l'un des trois manque). Toutes les versions : onglet **Releases** du dépôt.

La vérification automatique (`.github/workflows/verif.yml`) contrôle la syntaxe de `kitsu_ai.user.js` et la cohérence de la version entre l'en-tête du script, le README et le CHANGELOG.
