# Changelog KitsuAI

Les versions les plus récentes en premier. Les versions 1.x à 3.x sont résumées (détail non conservé).

---

## 5.16.0

- Campagne : meilleur trio **par combat** (nouvelle étape du calcul, `lib/etages.mjs`). La course classe les trios sur un score global et peut écarter tôt un trio qui serait le seul à faire 3 étoiles sur un combat. Désormais :
  - les 120 meilleurs trios de la course, les trios que le script essaie (tes 10 cartes les plus fortes) et ton équipe jouent chaque combat (2 tirages), puis les 8 meilleurs de chaque combat 6 tirages de plus ;
  - les combats sous 60 % de 3 étoiles sont cherchés sur TOUS les trios (Campagne d'abord, puis Cauchemar Normal, Difficile, Extrême), dans un budget de temps choisi au lancement (« Spécialistes par combat », 1 h par défaut) ; le journal garde chaque combat fini, la nuit suivante reprend ;
  - plan minimal : le moins de trios possible pour couvrir tous les combats, à un tirage près du meilleur.
- Page Campagne : carte « Meilleur trio par combat » (par difficulté : combats sûrs, comparaison avec le script, spécialistes, combats sans 3 étoiles, recherche restante et temps estimé), le plan, et chaque combat par monde avec filtres.
- Script : sur l'écran d'équipe, le trio du plan et le meilleur trio du combat (demandés au PC par `/equipes`) sont ajoutés aux trios essayés et rejoués à tes niveaux actuels (badge « calcul Campagne »).
- Correction : la page Tour (et Campagne) ne rechargeait pas les résultats à la fin d'un calcul suivi en direct ; il fallait recharger le launcher.
- Le hasard d'un combat est tiré par le jeu au lancement de chaque essai : les résultats sont des chances de 3 étoiles par essai.


## 5.15.0

### Ajouté
- **Tour de l'infini : tous tes trios sont essayés.** Avant, seuls les trios des 26 meilleures cartes seules étaient montés, et le tri des cartes seules ratait des combinaisons fortes. Maintenant, tous les trios de tes SSR, UR et LR font une course avec élimination : une montée par manche (même graine pour tous), un trio est écarté quand il est nettement derrière le 200e. Les 20 meilleurs refont ensuite 30 montées. Essai sur 3 000 trios : 136 restent après la 1re manche.
- **Journal des montées** (`cache/tour-*.jsonl`) : une montée déjà faite n'est pas refaite tant que le combat, la Tour, les cartes (niveau, étoiles, collectifs) et l'IA sont les mêmes. Il sert aussi de reprise après un arrêt. PC gardé éveillé pendant le calcul.
- **Page Tour comme la Campagne** : avant de lancer, cartes, trios à tester, déjà en mémoire et durée de la 1re manche ; pendant, barre de progression, manche en cours et trios encore en course ; après, résumé, podium, **carte à partager en PNG**, course des trios, planche PNG.
- Le résultat garde le classement des 200 meilleurs trios de la course (`classement` dans `tour.json`).

## 5.14.1

### Amélioré
- Le panneau utilise toute la largeur de l'écran (jusqu'à 1800 px au lieu de 1320 px). Les notes de version s'étalent sur plusieurs colonnes quand il n'y a qu'une catégorie.
- **Campagne : ce que fera le calcul** avant de le lancer : nombre de cartes SSR, UR et LR, trios à tester, combats par trio, combats déjà en mémoire et durée du 1er tour sur ton PC. Pendant le calcul : barre de progression, tour en cours, trios encore en course et vitesse.
- **Rappel du script** : une mise à jour du launcher apporte en général un nouveau script. La carte de mise à jour et la page Nouveautés le disent, puis la carte devient « Script à mettre à jour » (bouton Installer le script) tant que Tampermonkey a l'ancienne version.

## 5.14.0

### Ajouté
- **Nouveau launcher** : refonte visuelle complète du panneau.
  - Barre latérale par groupes (Accueil, Modes de jeu, Analyses, Outils) avec un onglet par mode : Campagne, Tour de l'infini, Raids (prêt pour plus tard), Arène, Événements et guilde.
  - **Mise à jour du launcher en évidence** : carte en tête de la barre latérale (nouvelle version, téléchargement, « Installer et redémarrer »), bandeau sur téléphone.
  - Tâche en cours toujours visible en bas de la barre latérale, badges dans le menu (3 étoiles, étage de la Tour, état du script, alertes).
  - Fond animé : portrait de la meilleure carte du mode affiché et braises qui montent. Coupé quand la fenêtre est cachée, désactivable dans Réglages, respecte le réglage « réduire les animations » de Windows.
  - Tableau de bord : équipe phare en grand, cartes des modes avec les portraits du meilleur trio, « Ce qui a changé » depuis l'analyse précédente.
  - **Fiche de carte** : clic sur n'importe quel portrait (stats de base, niveau et étoiles, meilleurs trios avec elle dans chaque mode).
  - **Recherche Ctrl+K** : aller à un onglet ou ouvrir la fiche d'une carte.
  - Sauvegarde : ta collection en portraits, avec recherche, filtres (rareté, série, dans mes meilleurs trios, niveau < 60) et tri.
  - Onglet Tour de l'infini : meilleur trio en grand, étages atteints par trio (graphique PNG), cartes seules, étages où les montées s'arrêtent avec les ennemis, collectifs.
  - Onglet Événements et guilde : événements, Salle, boss de guilde, Pain.
  - Calculs en grille de cartes avec durée indicative ; Résultats et Conseils réunis dans « Cartes et conseils » ; Journal et Nouveautés réunis.
  - Responsive : sur téléphone, barre d'onglets en bas et menu latéral.
- **Campagne en 6 difficultés** : Campagne Normal, Difficile, Extrême et Cauchemar Normal, Difficile, Extrême (option « Cauchemar seulement », plus rapide). La Campagne est jouée par les mêmes trios mais n'élimine personne (beaucoup y font 100 %). Podium, **carte à partager en PNG avec les portraits**, comparateur de trios (jusqu'à 3), tableau avec un en-tête « 3★ » par difficulté et l'explication des pourcentages.

## 5.13.0

### Ajouté
- **Meilleur trio pour les 3 étoiles en Cauchemar Normal, Difficile et Extrême** (`node moteur/cauchemar3.mjs`) : tous les trios de tes SSR/UR/LR (383 306 pour 133 cartes), sans tri préalable par carte seule. Course avec élimination : mêmes combats et mêmes tirages pour tous, un trio n'est écarté que s'il est nettement derrière (z = 3) pour chaque objectif (Normal, Difficile, Extrême, moyenne). Les finalistes jouent tous les combats puis 2 tirages de plus ; 2 étoiles et victoires des meilleurs ; collectifs des 5 meilleurs trios.
- **Journal des essais** (`lib/journal.mjs`) : un résultat n'est recalculé que si le code de combat du jeu, la carte (stats, kit, collectifs), son niveau, ses étoiles, ses collectifs choisis, les combats ou les réglages de l'IA changent. Un patch qui ne touche que les bannières ne vide plus rien. Sert aussi de point de reprise.
- **Onglet Campagne dans le panneau** : le calcul se lance depuis le launcher (bouton « Calculer la campagne », à ton niveau ou au niveau 99). Résultats par objectif (Normal, Difficile, Extrême, les trois) : 10 meilleurs trios avec portraits, 3 étoiles, 2 étoiles et victoires par difficulté, marge d'erreur ; graphiques du classement, des difficultés, boss contre autres combats, carte de chaleur par monde, course des trios, répartition des finalistes ; ton équipe actuelle (tes niveaux et niveau 99), meilleurs trios jouables tout de suite, cartes clés, collectifs conseillés. Export PNG de chaque graphique ou d'une planche complète.
- **Page « Méthodes et recherches »** dans le wiki (`docs/wiki/Methodes-et-recherches.md`) : méthodes utilisées, mises de côté, axes futurs, outils et études consultées.
- **PC gardé éveillé pendant un long calcul** (`lib/eveil.mjs`), sans modifier les réglages d'alimentation.

### Amélioré
- Simulation : option `stop3`, le combat s'arrête dès que les 3 étoiles sont perdues (cycle 9, ou un K.O. quand personne dans l'équipe ne peut ranimer). 1,8 fois plus rapide, 3 étoiles identiques (vérifié sur 9840 combats et par un nouveau test).
- Tests du moteur : 12 (arrêt des 3 étoiles perdues, journal).

---

## 5.12.1

### Corrigé
- **Le jeu ralentissait avec le temps** : l'objectif de bannière (barre en haut du dock) était recalculé toutes les 0,4 s et relisait à chaque fois la sauvegarde et le journal des gains, qui grossit à chaque combat (jusqu'à 500). Il est maintenant recalculé toutes les 5 s.
- Conseiller de combat : les contours (bouton, cible, carte qui joue) étaient retirés puis remis toutes les 150 ms, ce qui forçait le navigateur à redessiner les halos en continu. Ils ne sont plus touchés que s'ils changent.
- Le journal de calibration (300 combats) n'est plus relu pour chaque pourcentage affiché, seulement après un combat terminé.

---

## 5.12.0

### Ajouté
- **Tour de l'infini** (`tour.mjs`, carte « Tour de l'infini » dans Calculs) : le trio est cherché pour la Tour elle-même (chaque carte seule, puis tous les trios des meilleures, puis les 20 meilleurs sur 30 montées), au lieu d'être pris parmi les meilleurs des autres modes. Résultats : étage moyen avec sa marge, minimum, 10 % des montées les plus courtes, maximum.
- **Réglages de combat appris pour la Tour** (`entrainer.mjs --types tour`, case « Tour » dans Entraînement, et étape de « Tout lancer ») : appris sur l’étage atteint (montées complètes, PV reportés) et gardés seulement s’ils battent les réglages actuels sur 100 montées jamais vues par équipe. Essai sur la sauvegarde du 16/11 : étage moyen 95,1 puis 99,6 (+4,4, z = 9).
- Étages où les montées s’arrêtent, avec les ennemis qui y sont (ils sont toujours les mêmes pour un étage), et collectifs conseillés pour la Tour. Affichés dans Résultats, catégorie Tour.

- **Conseil en combat dans la Tour** : le calcul du PC ne vise plus les étoiles (qui ne comptent pas dans la Tour) mais la victoire puis les PV gardés pour les étages suivants, et l’affiche (« victoire … % · PV gardés … % »).
- **Pain (événement de guilde)** : pendant l’événement, l’analyse complète cherche le trio qui fait le plus de dégâts en 12 cycles, au niveau de Pain exporté par le script (catégorie « Pain (guilde) » dans Résultats).
- **Marché (échanges)** : nouvelle partie « Marché » des Conseils de cartes. Pour chaque carte au marché que tu n’as pas, ce qu’elle ajoute à ton meilleur trio, et quelles cartes de même rareté tu peux proposer sans toucher à tes équipes. Pour chaque offre reçue sur tes lots : accepter ou non. Le script exporte les lots et offres en lisant `/api/market` et `/api/market/mine`, comme la page du marché.

### Corrigé
- **Les analyses ne tenaient pas compte des collectifs choisis** : l'analyse complète (`tout.mjs`) et la simulation de la Tour du script construisaient les équipes sans `lk`, l’entraînement de l’IA aussi. Le cache de l'analyse en tient compte désormais.

---

## 5.11.4

### Corrigé
- **Conseil en combat (campagne et autres modes)** : quand tous les coups donnaient le même résultat (combat gagné à 3 étoiles quoi qu'on fasse, ou perdu quoi qu'on fasse), le calcul du PC classait en tête le premier coup de sa liste, « Respirer », et les boutons mettaient « Respirer » en avant alors que le panneau conseillait la meilleure attaque. Le PC ne remplace plus le conseil du navigateur que s'il trouve un coup strictement meilleur.

---

## 5.11.3

### Ajouté
- **Extensions locales** : le serveur charge, s'il existe, un module `prive/serveur.mjs` placé dans le dossier de données (ou à côté du moteur en développement). Il peut ajouter des routes et des calculs au panneau. Rien n'est chargé si le dossier n'existe pas, et ce dossier n'est jamais publié.
- Les calculs lancés depuis le panneau connaissent le dossier du moteur (`KITSU_MOTEUR`), pour les calculs placés hors de l'application.

---

## 5.11.2

### Corrigé
- **Les analyses utilisent enfin les réglages entraînés sur le PC.** L'analyse complète, l'analyse par mode et la mesure du plafond prenaient les réglages envoyés par le script du jeu, pas ceux de `poids.json`, et jamais les réglages propres à chaque équipe. Les % du panneau ne reflétaient donc pas l'entraînement. Exemple mesuré sur Kanki / Pain (Akatsuki) / Pain, 957 combats Cauchemar à plusieurs ennemis : 51,6 % de 2 étoiles avec les anciens réglages, 60,1 % avec ses réglages propres.

### Ajouté
- Tableau de bord : écart avec l'analyse précédente pour chaque catégorie (en vert ou rouge) et origine des réglages utilisés (PC, script, nombre d'équipes avec réglages propres).

---

## 5.11.1

### Ajouté
- **Portraits et cadres de rareté** dans le panneau : chaque équipe et chaque carte (Tableau de bord, Résultats, Conseils de cartes) s'affiche avec son portrait, affiché depuis la même adresse que dans le jeu (rien n'est copié dans le dépôt). Cadres dessinés pour KitsuAI : LR doré animé avec reflet, UR rouge, SSR violet, SR bleu, R vert. Initiales si le portrait ne charge pas.
- **Équipe phare** en tête du Tableau de bord (Cauchemar, plusieurs ennemis) avec grands portraits et taux de 2 étoiles.
- **Icônes de mode** dessinées pour KitsuAI (campagne, boss, Cauchemar, plusieurs ennemis, événements, tour, guilde, collectifs, XP, tirage, duos).

### Corrigé
- Ces ajouts avaient été fusionnés sous le numéro 5.11.0 déjà publié : aucune nouvelle version n'était proposée. La vérification GitHub refuse maintenant une Pull Request qui modifie le code sans changer de version, et `publier.bat` prévient avant l'envoi.

---

## 5.11.0

### Ajouté
- **Conseils de cartes** (panneau, Calculs puis Résultats), calculés avec le moteur du jeu sur 120 combats Cauchemar Extrême (plusieurs ennemis et boss) :
  - **Collectifs** : quand une carte de tes meilleures équipes a plus de 6 collectifs actifs, les 6 à cocher et ceux à décocher, avec le gain en 2 étoiles. Les choix sont vérifiés aussi combinés.
  - **Plan d'XP** : pour chaque carte pas encore niveau 99, son meilleur trio et ses chances à plusieurs niveaux. L'XP n'est conseillée que si la carte finit par battre ta meilleure équipe.
  - **Tirage** : chaque LR et UR des bannières ouvertes, avec son meilleur trio et le gain par rapport à ta meilleure équipe (une carte déjà possédée est comptée avec une étoile de plus).
  - **Duos** : les paires qui marchent le mieux ensemble, leur meilleur troisième et leur synergie.
- **IA par équipe** : des réglages Cauchemar propres à chacune de tes meilleures équipes, gardés seulement s'ils battent les réglages généraux sur des combats de contrôle. Le script les utilise dès que tu joues exactement cette équipe (conseil en combat, plan, guide, et calcul sur le PC).
- **IA par imitation** : l'IA rapide apprend à reproduire les choix de l'IA qui anticipe plusieurs coups (plusieurs tirages par coup possible). Les nouveaux réglages ne sont gardés que s'ils font mieux sur des combats jamais vus pendant l'apprentissage.
- « Tout lancer » enchaîne maintenant : moteur du jeu, entraînement, analyse complète, IA par équipe, conseils de cartes.
- **Historique des réglages de l'IA** (Réglages) : une copie de `poids.json` est faite avant chaque entraînement ou imitation (15 dernières gardées), avec ses scores. « Restaurer » remet une copie en service, après avoir copié les réglages en place ; le script du jeu la reprend dans la minute.

---

## 5.10.0

### Ajouté
- **Sauvegarde automatique** : le script envoie ta collection à l'application à chaque changement (cartes, niveaux, étoiles, équipe) et au moins toutes les 30 min. Plus d'export à la main (le bouton reste disponible).
- **Le guide utilise les calculs du PC** : le classement des trios pour un combat (écran d'équipe, plan, événements, farm) est calculé par l'application avec 24 tirages par trio au lieu de 8 dans le navigateur. Repli automatique sur le navigateur si l'application n'est pas lancée.
- **Détection des patchs KITSU** : à chaque nouvelle version du jeu, l'application compare le moteur à la version précédente : nouvelles cartes (par série, nombre de LR), cartes modifiées (ATK, DEF, PV, VIT, multiplicateurs et valeurs des techniques), cartes retirées, nouveaux mondes et combats, événements, bannières, et lesquelles de **tes** cartes sont touchées. Bandeau « Patch KITSU détecté » sur le tableau de bord, historique dans Nouveautés.
- **Calcul conseillé** : bandeau et bouton « Tout lancer » qui clignote quand le jeu, ta collection ou l'IA ont changé depuis la dernière analyse. Aucun calcul n'est lancé tout seul.
- **Onglet Réglages** : démarrer avec Windows (en arrière-plan, près de l'horloge), temps de réflexion du conseil en combat (0,4 à 2 s), fils gardés libres pendant les calculs, choix des alertes.
- **Alertes** (notifications Windows, cloche dans le panneau) : énergie pleine, boss de guilde (essais restants après 20 h), fin d'événement avec premières victoires à prendre, nouvelle bannière, patch KITSU, calcul conseillé, calcul terminé. Chacune activable dans Réglages, bouton de test.
- **Tests automatiques** (`moteur/tests.mjs`, job `moteur` de la vérification GitHub) : chargement du moteur, même tirage même résultat, règle des étoiles, arrêt à 2 K.O. sans changement des 2 étoiles, multithread identique au fil unique, comparaison de patch, démarrage du serveur et protections.

### Sécurité
- Les envois du script (`/sauvegarde`, `/equipes`, `/jeu`) exigent un en-tête propre au script : un autre site ouvert dans le navigateur ne peut pas écrire dans ta sauvegarde. Les notifications de l'application passent par un secret généré à chaque démarrage.

---

## 5.9.0

### Ajouté
- **Bouton « Mise à jour »** dans la barre du panneau : il apparaît, en pulsant, dès qu'une nouvelle version est publiée.
- **Onglet Nouveautés**, au format patch notes : grand bandeau avec le numéro de version et la date, étiquettes « Nouvelle version » et version installée, puis les notes en trois colonnes (Ajouté, Modifié, Corrigé) tirées de la Release GitHub. Versions précédentes dépliables en dessous.
- Mise à jour d'un clic depuis le panneau : « Mettre à jour vers la vX », barre de progression du téléchargement, puis « Redémarrer et installer ». Tes données sont gardées.
- Le menu de l'icône « Rechercher une mise à jour » ouvre directement l'onglet Nouveautés.

### Modifié
- Le téléchargement des mises à jour ne démarre plus tout seul : c'est toi qui le lances depuis le panneau (une mise à jour déjà téléchargée s'installe toujours à la fermeture).
- Barre du haut plus compacte (libellés réduits sur les petites fenêtres).

---

## 5.8.1

### Corrigé
- Mise à jour automatique : « Cannot find latest.yml » quand l'application vérifiait pendant la fabrication de l'installateur. La Release est maintenant créée en brouillon et publiée seulement quand l'installateur et `latest.yml` sont ajoutés. Un brouillon laissé par un essai raté est remplacé au merge suivant ; la fabrication échoue clairement si `latest.yml` manque.
- Message clair si l'installateur d'une nouvelle version n'est pas encore prêt (« en cours de préparation sur GitHub, réessaie dans quelques minutes ») au lieu de l'erreur technique ; les autres erreurs n'affichent plus que leur première ligne.
- Tout lancer : si kitsu.games ne répond pas, la mise à jour du moteur garde le moteur déjà téléchargé au lieu d'arrêter la chaîne.

---

## 5.8.0

### Ajouté
- **Tout lancer** : un seul bouton enchaîne la mise à jour du moteur du jeu, l'entraînement de l'IA (Cauchemar, boss, normal) puis l'analyse complète (tes niveaux puis 99). Les étapes s'affichent avec leur état (terminé, en cours), arrêt possible à tout moment.
- **Onglet Script** : version disponible, version installée dans le navigateur (le script l'envoie au serveur), état de la connexion au PC ; boutons Installer ou mettre à jour, Copier le script, Voir le code, Installer Tampermonkey, Ouvrir kitsu.games ; marche à suivre.

### Modifié
- Panneau entièrement réorganisé sur le modèle du site KITSU : navigation en haut (Tableau de bord, Calculs, Résultats, Script, Sauvegarde, Journal) soulignée en orange, grands titres Anton en italique précédés d'une barre oblique rouge, sur-titre rouge, tuiles d'état façon blocs ATK/DEF, police Manrope.
- Tableau de bord : Tout lancer, tâche en cours (dernière ligne, progression), tuiles (moteur, processeur, script, sauvegarde, conseils en combat) et meilleure équipe par catégorie.
- Résultats : onglets par niveaux et par catégorie, top 10 complet, fichiers consultables.
- Le serveur n'ouvre que des liens vers le dépôt, kitsu.games et tampermonkey.net.

---

## 5.7.0

### Ajouté
- **Application Windows** (`app/`, Electron) : installateur `KitsuAI-Setup-5.7.0.exe` avec choix du dossier, raccourcis bureau et menu Démarrer, désinstallation propre. Node.js est inclus.
  - Démarre le serveur local, télécharge le moteur du jeu au premier lancement, ouvre le panneau dans sa fenêtre.
  - Icône près de l'horloge : le conseil en combat continue fenêtre fermée ; menu (panneau, kitsu.games, script Tampermonkey, dossier des données, wiki, mise à jour, quitter).
  - **Mise à jour automatique** depuis les releases GitHub (au démarrage puis toutes les 6 h), installation au redémarrage.
  - Données dans `%APPDATA%\KitsuAI` (moteur du jeu, sauvegarde, réglages, cache, résultats) : jamais effacées par une mise à jour ou la désinstallation.
- Installateur construit par GitHub Actions sur Windows à chaque nouvelle version et ajouté à la Release (avec `latest.yml` pour les mises à jour).
- **Wiki GitHub** (`docs/wiki/`, publié par le workflow `wiki`) : installation, panneau, conseil en combat, analyses et entraînement, script, versions, sécurité, FAQ, développement, changelog.
- Script : `@updateURL` / `@downloadURL` vers la dernière release (mise à jour par Tampermonkey).

### Modifié
- Panneau aux couleurs de KITSU : fond nuit, rouge-orange, titres condensés en italique majuscule précédés d'une barre oblique rouge, boutons en dégradé.
- Moteur local : dossier des données réglable (`KITSU_DATA`), utilisé par l'application.
- `publier.bat` : repart de `main` quand la branche a déjà été fusionnée, et récupère les tags.
- Vérification `verif` : syntaxe du moteur local et de l'application en plus du script.

---

## 5.6.0

### Ajouté
- **Panneau local** : `KitsuAI.bat` (à la racine du dépôt) lance le serveur et ouvre http://127.0.0.1:47123 dans le navigateur. Tout est au même endroit :
  - état : serveur et port, moteur chargé (et alerte si un plus récent est sur le disque), processeur et nombre de fils, nombre de conseils en combat et temps du dernier ;
  - ta sauvegarde : date d'export, cartes (LR, UR, SSR), équipe, boss de guilde ; import par glisser-déposer ;
  - actions : analyse complète (niveaux, tirages, nombre de cartes), entraînement de l'IA (Cauchemar, boss, normal, générations), analyse par mode, mesure du plafond, mise à jour et rechargement du moteur, mesure de vitesse, arrêt de la tâche ;
  - tâche en cours avec journal en direct, journal du serveur ;
  - dernière analyse complète en tableaux (tes niveaux / niveau 99), fichiers de résultats consultables, ouverture des dossiers.
- **Entraînement local de l'IA** (`moteur/entrainer.mjs`) : entropie croisée avec paires opposées, sur tes meilleures équipes (dernière analyse) et les combats disputés, objectif 2 étoiles puis 3. Résultat dans `moteur/data/poids.json`.
- Le script adopte tout seul les réglages entraînés sur le PC (vérification chaque minute), puis recalcule plan et équipes.

### Sécurité
- Les actions du panneau exigent un jeton généré à chaque démarrage et présent uniquement dans la page du panneau, et refusent les autres origines : un autre site ouvert dans le navigateur ne peut rien lancer. Le serveur n'écoute que sur 127.0.0.1.

---

## 5.5.0

### Ajouté
- Conseil en combat calculé sur le PC : `moteur/serveur.bat` lance un serveur local (http://127.0.0.1:47123, uniquement cette machine). Pendant un combat, le script envoie l'état du combat ; le PC simule la suite de chaque action possible sur tous ses coeurs (élimination des actions trop faibles, environ 0,7 s par coup) et renvoie celle qui donne le plus souvent 2 étoiles ou plus, puis 3 étoiles. Le panneau orange affiche « Calcul du PC » et met la bonne action en évidence.
- Mesure du plafond (`moteur/plafond.mjs`) : sur des combats disputés de Cauchemar, l'anticipation poussée fait 85 % de 2 étoiles ou plus contre 65 % pour l'IA actuelle (2 ennemis ou plus), et 50 % contre 40 % (boss), sur 20 parties.
- Onglet Santé : état du serveur du PC (connecté, nombre de fils, ou moteur pas à jour).

### Modifié
- Userscript : `@grant GM_xmlhttpRequest` et `@connect 127.0.0.1` pour joindre le serveur local (Tampermonkey demandera l'autorisation une fois). Le pont n'accepte que `/ping` et `/conseil`, vers 127.0.0.1 uniquement. Sans serveur, rien ne change.

---

## 5.4.1

### Ajouté
- `moteur/tout.bat` (`tout.mjs`) : analyse complète de tes LR, UR et SSR, à tes niveaux actuels puis au niveau 99 :
  - campagne (tous les combats en Extrême), boss en Extrême ;
  - Cauchemar Extrême : tous les combats, combats à 2 ennemis ou plus, boss ;
  - événements ouverts et Salle de l'Esprit et du Temps ;
  - Tour de l'infini (montée complète, PV gardés entre les étages) ;
  - boss de guilde (dégâts plafonnés à 300 000).
  Résultats en CSV et JSON dans `moteur/resultats/` (`dernier.json` = dernière analyse).
- Élimination adaptative : un trio est abandonné dès que sa borne haute passe sous la borne basse du 10e meilleur (mêmes combats et tirages pour tous).
- Cache sur le disque (`moteur/cache/`, par version du jeu et réglages de l'IA) : un calcul déjà fait n'est jamais refait.
- Export de la sauvegarde : ajoute le boss de guilde de la semaine et le niveau du compte.

---

## 5.4.0

### Ajouté
- Moteur local (dossier `moteur/`) : le moteur de combat du jeu tourne sous Node.js sur le PC, en multithread (un fil par coeur logique moins un), sans onglet ouvert.
  - `telecharger-moteur.bat` : télécharge le moteur du jeu (avec reprise et nouvel essai en cas d'erreur du serveur). Ces fichiers restent sur le PC et ne vont jamais dans le dépôt.
  - `analyser.bat` : meilleures cartes et meilleurs trios en Cauchemar (boss ou 3 ennemis) ou en Extrême. Objectif : 2 étoiles minimum, départagé par les 3 étoiles.
  - Optimisations : élimination par tours (24 combats, puis 64 x 2 tirages, puis tous x 3), mêmes combats et mêmes tirages pour toutes les équipes, arrêt du combat dès 2 K.O. (x1,6 à x2, résultats identiques), critères communs de l'IA calculés une fois par décision.
- Règle des étoiles lue dans le code du jeu : étoiles = max(1, 3 - K.O.), plafonnées à 2 au-delà du cycle 8. 2 étoiles ou plus = victoire avec au plus 1 K.O., quel que soit le cycle.
- Bouton « Exporter pour le moteur local » (onglet Santé) : télécharge `sauvegarde.json` (cartes, niveaux, étoiles, réglages de l'IA, aucun jeton).

---

## 5.3.31

### Modifié
- Équipe cible : jugée sur les 127 boss du jeu en Extrême, au lieu des 77 combats de référence. Avec une LR, les combats de référence saturaient (151/154) : l'équipe cible restait Tobi / Osamu / Pain alors que Tobi / Kanki / Pain (Akatsuki) fait 125/127 contre 108/127.

---

## 5.3.30

### Corrigé
- Écran d'équipe d'un événement : le contour se posait sur le bouton « Combattre » de la page Événements, caché sous l'écran d'équipe. Le bouton de l'écran d'équipe (`.pp-go`, `[data-go]`) passe maintenant en premier.

---

## 5.3.29

### Corrigé
- Événements : le jeu a changé ses boutons de combat (`[data-ev-fight="événement|type|difficulté"]`, « Combattre » / « Affronter le boss »). Le guide les met en évidence, y compris en difficulté Ultime.

---

## 5.3.28

### Ajouté
- Parchemins d'XP guidés par la Collection, dans la boucle du guide : Collection, puis la fiche de la carte cible (la plus en retard de l'équipe cible, sinon la carte à entraîner), puis le plus gros parchemin, « Max utile », « Utiliser », et la confirmation. Si la fiche ouverte n'est pas la bonne carte, le guide pointe la croix.
- Sélecteurs de la fiche : `[data-sc-size]`, `[data-sc-q]`, `[data-sc-use]`, `[data-fav-star]` (identifiant de la carte), vue `#view-collection`.

### Corrigé
- Faux « confirme : clique sur Utiliser » sur la fiche d'une carte au hasard : seules les vraies fenêtres de confirmation (`.ask`, ou une fenêtre avec `[data-yes]`) sont prises.

---

## 5.3.27

### Corrigé
- Défi de doublons : le guide pointait « Valider le défi » de la fenêtre du dessous au lieu de « Déposer » dans la confirmation au-dessus. La fenêtre de confirmation `.ask` la plus haute est maintenant prise en priorité.

---

## 5.3.26

### Corrigé
- Défi de doublons : la fenêtre « Valider … ? » (bouton « Déposer ») n'était pas guidée, le guide restait sur « valide » derrière la fenêtre. La confirmation passe maintenant avant les étapes de la page.
- Confirmations après les actions d'événements (Salle, achats du Comptoir, difficultés) guidées elles aussi.

---

## 5.3.25

### Corrigé
- Salle de l'Esprit et du Temps : quand la page Événements affiche un autre événement, le guide met en évidence la carte « Salle de l'Esprit et du Temps » (`[data-evp-feat="ev-salle"]`) au lieu de dire « fais défiler ».

---

## 5.3.24

### Corrigé
- Fenêtre de confirmation de la guilde (achat en boutique, défis, coffre) : le bouton « Acheter » / « Confirmer » est maintenant mis en évidence, et les données de guilde sont relues juste après.

---

## 5.3.23

### Corrigé
- Boucle « Changer l'équipe » / « Fermer » sur le boss de guilde : le jeu coupe les noms longs (« Misato Kats... »), la comparaison se fait maintenant sur le début du nom.
- Essais du jour épuisés (« Plus d'essai : reviens demain ») : le guide le détecte sur la page, met le boss en pause jusqu'à minuit et rafraîchit les données de guilde.
- Sélection d'équipe ouverte et déjà correcte : flèche sur « Fermer ».

---

## 5.3.22

### Modifié
- Boss de guilde : recherche de l'équipe sur toutes les cartes éligibles (24 plus hautes au niveau minimum), balayage sur 4 combats, puis les 12 meilleurs trios confirmés sur 40 combats. Dégâts plafonnés à 300 000 comme dans le jeu. Les anciennes estimations sur 3 combats étaient trop optimistes (167 700 annoncés, 144 000 réels en moyenne).

### Essayé, non retenu
- Façon de jouer apprise pour le boss de guilde (entropie croisée, 47 générations, objectif = dégâts en 12 tours) : +0,8 % seulement. Les dégâts dépendent surtout de l'équipe, pas du choix des attaques. La politique boss existante est gardée.

---

## 5.3.21

### Corrigé
- Boss de guilde caché par une pause posée par une ancienne version : les pauses du guide sont effacées à chaque nouvelle version du script.
- Le lien « Voir mon parrainage » (qui mène aussi à Social) n'est plus pris pour le lien Guilde : le guide passe par le menu COMMUNAUTÉ.

---

## 5.3.20

### Ajouté
- Guilde complète : défis de la semaine (`[data-gw="chal"]`), coffre (`[data-gw="chest"]`) et boutique de guilde (`[data-gw="buy"]`) sont guidés, onglet par onglet.
- Éligibilité lue dans l'API : défis et coffre ne sont proposés que si tu es dans la guilde depuis 3 jours et que tu as livré un combat. Sinon la roadmap donne la date exacte à laquelle ils deviennent réclamables, et prévient s'ils tombent après le reset du lundi 17 h.
- Plafond des points de boss (1 point par 2 500 dégâts, 400 par semaine) : nombre d'essais nécessaires pour l'atteindre.
- Boutique de guilde : ordre d'achat 5 invocations Shonen (150) > 10 énergies (120) > multi x10 (500). La carte UR (4 000) n'est pas visée.
- Ligne « Guilde » dans l'onglet Avenir.

### Corrigé
- « Changer l'équipe » n'est plus proposé en boucle : le guide lit l'équipe affichée et va directement sur « Attaquer » quand elle est déjà la bonne.
- La roadmap affichait une équipe de boss plus faible que celle calculée (elle réutilise maintenant l'équipe en cache).
- « Défis à récupérer » n'est plus annoncé quand la réclamation est verrouillée.

---

## 5.3.19

### Corrigé
- Boss de guilde jamais atteint : la page Guilde est dans le menu « COMMUNAUTÉ », puis « Social », puis l'onglet « Guilde ». Le guide ouvre maintenant le menu déroulant, puis Social, puis l'onglet Guilde, puis l'onglet du boss.
- Équipe du boss de guilde mal choisie (Trunks, Deidara, Rococo : ~47 000 dégâts) : 3 simulations par trio, et une équipe déjà calculée plus forte n'est plus écrasée. Meilleure équipe actuelle : Pain, Orochimaru, Trunks (~168 000).

### Ajouté
- Liens cachés dans un menu déroulant : le guide montre le bouton qui ouvre le menu (« ouvre « COMMUNAUTÉ », puis « Social » »).

---

## 5.3.18

### Ajouté
- À la fin d'un réentraînement de l'IA, la campagne, les équipes, l'équipe cible, les événements et les murs sont resimulés avec les nouveaux réglages.

---

## 5.3.17

### Corrigé
- Le Cauchemar verrouillé restait proposé après la v5.3.16 : le plan calculé par l'ancienne version était réutilisé. À chaque nouvelle version du script, plan, équipes, événements et roadmap sont recalculés.
- Le guide ne pointe plus jamais un bouton Cauchemar verrouillé (sécurité supplémentaire, lue sur la page).

---

## 5.3.16

### Corrigé
- Combats de Cauchemar proposés sur un arc encore verrouillé (« Le club d'occultisme ») : le Cauchemar demande les 3 étoiles sur tous les combats de l'arc dans les 3 difficultés, et non une simple victoire en Extrême.
- Équipe du boss de guilde de la roadmap (Edgar, Sasori, Midnight : ~66 000 dégâts) calculée sur des cartes prises au hasard : elle utilise maintenant tes 10 cartes les plus fortes (Misato, Sasori, Trunks : ~155 000). Idem pour le raid Pain.

---

## 5.3.15

### Corrigé
- « Le roi démon ressuscité » (Difficile) proposé 3 fois de suite, 3 fois sans 3 étoiles : la simulation le donnait à 100 %, les vrais résultats disaient le contraire et n'étaient pas pris en compte.

### Ajouté
- Les vrais résultats priment : un combat déjà à 1 ou 2 étoiles qui rate les 3 étoiles n'est plus proposé pendant 24 h.
- Écran de fin de combat après un tel échec : « pas 3 étoiles : stop sur ce combat pour aujourd'hui », et « Retour à la carte ».
- Écran d'équipe de ce combat : « stop : déjà raté N fois aujourd'hui », bouton « Carte ».
- Roadmap : « à reprendre plus tard », avec le nombre d'échecs du jour.

---

## 5.3.14

### Corrigé
- Boss de guilde jamais proposé : l'équipe n'était calculée que par la roadmap, et ce calcul avait été effacé par la mise à jour du jeu. Elle est maintenant calculée dès que le guide voit des essais restants (meilleur trio en dégâts, 2 simulations par trio), et recalculée quand le boss change.

---

## 5.3.13

### Corrigé
- Page Jouer : le guide surlignait la jauge d'énergie de la barre du haut (qui est aussi un lien vers l'Aventure) au lieu de la carte « Aventure ». Il prend maintenant en priorité les cartes de la page Jouer, puis les liens avec un texte.

---

## 5.3.12

### Corrigé
- Erreur « Cannot access 'S' before initialization » dans la bulle du guide sur l'écran de résultats d'invocation (vérification de « Fermer » faite avant la lecture de la sauvegarde).

---

## 5.3.11

### Corrigé
- Écran de résultats d'invocation : le guide surlignait le bouton « Invoquer x1 » de la bannière, caché sous l'écran de résultats. Il utilise maintenant les boutons de cet écran (`[data-reopen]`), et « Fermer » quand il n'y a plus d'invocation gratuite.

---

## 5.3.10

### Ajouté
- Animation d'invocation guidée de bout en bout : booster (« glisse sur les pointillés »), carte à retourner, « Tout passer », puis « Touche pour continuer ».
- Sur la page Invocation Shonen, le guide fait utiliser toutes les invocations gratuites restantes (« Invoquer x1 » à répéter, ou x10 à 10/10), au lieu de repartir en campagne à 7/10.

---

## 5.3.9

### Corrigé
- Invocations Shonen gratuites : le guide pointait « Multi-invocation x10 », désactivé tant qu'il n'y a pas 10 invocations. Il pointe maintenant « Invoquer x1 » (à répéter) quand le x10 n'est pas disponible.

---

## 5.3.8

### Corrigé
- Pas de flèche dans la fenêtre « Recharger l'énergie pour 15 ◆ ? » : la fenêtre de confirmation du jeu (`.ask`, boutons `[data-yes]` / `[data-no]`) est maintenant reconnue. La bulle dit « confirme : clique sur « Recharger » ». Vaut pour toutes les confirmations du jeu (achats, recharges).

---

## 5.3.7

### Corrigé
- Recharge d'énergie sans flèche : le jeu a deux boutons « + » (un caché dans le menu du haut, un visible à côté de la jauge) et le guide pointait le caché. Le guide choisit maintenant toujours l'exemplaire visible, pour tous ses boutons (recharge, invocation, menus).

---

## 5.3.6

### Ajouté
- Après une mise à jour du jeu détectée, tous les résultats simulés sont effacés et recalculés avec les nouvelles règles (plan, équipes, équipe cible, murs, boutique, événements, XP, Tour, guilde, roadmap), puis l'IA est réentraînée.

### Contexte
- Patch du jeu du 13/11/2026 : synergie « même série » (+5 % ATK et DEF par allié de la même série), ennemis des films et hors-série à -25 % en Difficile et Cauchemar, techniques de la Saga Buu, correctif de Julius Novachrono. Le script utilise le moteur du jeu : tout est pris en compte sans modification du code de simulation.

---

## 5.3.5

### Corrigé
- Le guide relançait un combat déjà à 2 étoiles alors que la 3e n'était sûre qu'à 78 % (« Le roi démon ressuscité », Difficile). Il ne restait qu'une gemme à gagner, pour moins d'une gemme par énergie.

### Modifié
- Un combat déjà à 1 ou 2 étoiles n'est proposé que si les 3 étoiles sont à 90 % ou plus. Les combats jamais joués restent proposés dès 90 % de victoire.
- Sur l'écran d'équipe d'un tel combat, le bouton « Carte » est mis en évidence : « 3e étoile pas assez sûre ici, pour 1 gemme : joue plutôt… ».

### Ajouté
- Roadmap : ligne « À reprendre plus tard pour la 3e étoile », avec les chances actuelles. Ces combats reviennent seuls dans le guide quand l'équipe a monté.

---

## 5.3.4

### Ajouté
- Animations et fenêtres par-dessus l'écran : « Passer ▸▸ » de l'invocation, « Touche pour continuer », carte obtenue, croix des fenêtres du jeu, popup « Installer l'appli ».
- Écran de vérification anti-robot du jeu détecté : le guide te dit de cocher la case toi-même et ne pointe rien.

### Corrigé
- Les fenêtres en position fixe étaient considérées comme invisibles par le guide : nouvelle détection de visibilité.

## 5.3.3

### Corrigé
- La bulle du guide cachait la barre de navigation du jeu : elle se place maintenant juste en dessous.
- La bulle annonçait « clique sur Tout récupérer » sans dire comment y aller : elle précise « clique d'abord sur « QUÊTES » dans la barre du haut » (idem pour Bannières, Collection, Boutique, Guilde, Jouer).
- Choix du bon lien quand plusieurs pointent vers la même page : menu déroulant ouvert, puis barre du haut.

## 5.3.2

### Corrigé
- La page Quêtes commence par un hub à 3 cartes : le guide passe maintenant par la carte « Quêtes » (ou « Récompense quotidienne ») avant « Tout récupérer », et propose le retour au hub si besoin.
- Le lien « QUÊTES » de la barre ouvre un menu déroulant : le guide pointe le lien du menu.

## 5.3.1

### Corrigé
- Les quêtes d'Histoire (« termine l'arc », « 3 étoiles sur tout l'arc ») n'étaient pas comptées : leur progression est calculée par le jeu, elle est maintenant lue. 17 récompenses détectées au lieu de 8.
- La récupération était mise en pause dès l'arrivée sur la page (bouton pas encore affiché) : attente de 8 s avant d'abandonner.

## 5.3

### Ajouté
- Onglet Avenir : quêtes du jour restantes, quêtes de demain, hebdo de la semaine prochaine, avec la préparation conseillée pour chacune.
- Onglet Avenir : niveau de tes cartes dans 3 et 7 jours à ton rythme, date estimée du prochain mur.
- Quêtes du jour « détour » guidées (fiches de cartes, défilement d'invocation), 90 s puis on passe.

---

## 5.2

### Ajouté
- Guilde : raid Pain et boss de la semaine guidés (onglet, choix des cartes, Attaquer) avec l'équipe la plus forte en dégâts ; essais relus toutes les 5 min.
- Tour de l'infini : guidage complet dès le niveau de compte 25, seulement si l'IA prévoit de battre ton record.
- Albums : séries complètes à récupérer.
- Onglet Avenir : gemmes à 3 et 7 jours, LR de la boutique, fins de bannières et d'événements, calendrier des nouvelles cartes (17 h), Tour, marché, événements tournants.

## 5.1

### Ajouté
- Quand la campagne n'a plus de 3 étoiles faciles : rejouer le combat qui donne le plus d'XP par énergie, avec une équipe sûre qui fait monter les cartes en retard, et « Rejouer » mis en évidence en fin de combat.

## 5.0.2

### Ajouté
- Bouton « Carte » de l'écran d'équipe mis en évidence quand il faut jouer ailleurs (Salle, événement) ou que le combat est un mur.

## 5.0.1

### Corrigé
- Le guide et le panneau Équipe ne conseillaient pas la même équipe : le guide suit maintenant le verdict « À jouer ».

### Modifié
- La carte à cliquer est en bleu clignotant uniquement ; légende des couleurs dans la bulle.

## 5.0

### Ajouté
- Récompenses guidées : connexion du jour, quêtes, paliers du pass.
- Boutique du jour via l'icône panier (énergie, offres rentables), fenêtres de confirmation.
- Parchemins guidés jusqu'au bout (taille, puis carte) ; défis de doublons (Remplir, puis valider).
- Menu Jouer : flèche vers Aventure, Événements ou Tour.
- Bouton « Signaler » (rapport de l'écran copié), vérification des boutons du jeu après chaque mise à jour.
- Calibration par mode dans l'onglet Santé ; date estimée des murs dans la roadmap.

### Modifié
- Plus de tirages avec les gemmes, sauf si une LR garantie est atteignable ou pour la LR de la boutique.

### Constaté
- Pas de système d'équipement dans le jeu.

---

## 4.9.1

### Ajouté
- Panneau Équipe : verdict unique « À jouer » avec sa raison, cartes à faire monter indiquées sur chaque trio.

### Modifié
- Équipe cible calculée sur deux fois plus de simulations et stabilisée (ancienne cible gardée à 4 victoires près).

## 4.9

### Ajouté
- Écran de fin de combat : « Combat suivant » ou « Retour à la carte ».
- Équipe entière en couleur (rouge à retirer, vert à ajouter), recherche de carte si elle n'est pas affichée, dialogues (« Passer »).

## 4.8.3

### Corrigé
- Le panneau Équipe proposait « Pour l'XP » une équipe à 83 % de 3 étoiles (vue à 100 % sur 8 simulations) : les 8 meilleurs et ton équipe sont rejoués 32 fois.

## 4.8.2

### Corrigé
- Calcul de l'équipe cible en échec, puis repli sur toutes les cartes de bas niveau : équipes trop faibles conseillées (Krilin sous la brume à 75 %).
- 3 étoiles vérifiées sur 16 simulations dans le plan, 12 dans le guide.

## 4.8.1

### Corrigé
- Équipe cible choisie sur 26 combats seulement (Osamu / Deidara / Sasori par chance) : 77 combats, puis le trio qui demande le moins d'XP à 2 victoires près.

## 4.8

### Ajouté
- Équipe cible à niveau égal sur des combats Extrême ; ses cartes en retard deviennent prioritaires pour l'XP ; ligne « Équipe cible » dans la roadmap.
- Plan d'entraînement recalculé au plus toutes les heures après tes combats.

## 4.7.1

### Corrigé
- Les combats de la Salle et des événements étaient mis en pause 20 min quand tu lançais un autre combat.

## 4.7

### Ajouté
- Événements (premières victoires gagnables), Salle de l'Esprit et du Temps, invocations Shonen gratuites, clochettes, Comptoir des Zeni, parchemins, défis de doublons.

### Corrigé
- Garantie LR : 1 point pour 10 tirages (50 gemmes par point), et non 1 par tirage.

---

## 4.0 à 4.6

### Ajouté
- Roadmap de connexion, guide pas à pas avec flèches, guilde dans la roadmap.
- Respect de l'équipe déjà sélectionnée, règles « 3 étoiles d'abord », 12 simulations sur les boss, suivi des étoiles.
- Départage des équipes par l'XP, plan d'entraînement au lancement, équipes précalculées pendant l'écran de résultats.
- Dock unique à onglets (Alt+K), accents, « Pourquoi » de chaque coup, calibration, onglet Santé, Web Worker.
- Échéances des bannières, conseils d'achat d'énergie et d'invocation, alerte énergie pleine, barre « Objectif LR ».
- Formule exacte des gemmes par mode, paliers Cauchemar (Normal, Difficile, Extrême, x2).

### Corrigé
- Boucle de navigation entre la liste des mondes et un monde.
- Roadmap lente (affichage depuis le cache).

## 3.x

### Ajouté
- Détection des mises à jour du jeu, poids d'IA par mode (Cauchemar, Tour), modes Difficile, Extrême, Cauchemar.
- Plan de progression, suivi des récompenses après chaque combat, conseiller d'invocation par bannière.

### Corrigé
- Numéros de version en texte (« 3.10 » n'est plus égal à « 3.1 »).
- Passage de 16 à 19 critères sans casser les poids enregistrés.

## 2.x

### Ajouté
- IA entraînée par la méthode d'entropie croisée jusqu'au plateau, poids spécialisés boss, simulations sur la campagne.

## 1.x

### Ajouté
- Extraction de la collection (cartes possédées), lecture des données du jeu.
- Conseiller de combat en direct : surbrillance de l'attaque et de la cible.
