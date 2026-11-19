# Méthodes et recherches

Ce que KitsuAI utilise pour conseiller, ce qui est mis de côté, les pistes pour la suite, et les outils et études sur lesquels tout cela s'appuie. Page tenue à jour à chaque version (dernière mise à jour : 5.13.0).

Rappel des règles du projet : KitsuAI lit et affiche seulement. Aucun clic automatique, aucune requête forgée vers le jeu, aucune écriture dans la sauvegarde du jeu. Toutes les simulations tournent sur ton PC, avec le moteur de combat du jeu téléchargé localement (jamais copié dans le dépôt).

## 1. Méthodes utilisées

| Méthode | Fichiers | À quoi elle sert | Ce qu'on a mesuré |
|---|---|---|---|
| Simulation avec le moteur du jeu | `lib/charger.mjs`, `lib/sim.mjs` | Jouer les combats exactement comme le jeu (même boucle de tour, même hasard tiré d'une graine) | Même graine, même résultat ; règle des étoiles vérifiée par les tests |
| Règle de combat apprise à 19 critères | `lib/sim.mjs` | L'IA qui joue nos coups : une note par action (dégâts, K.O., soin, contrôle, énergie, endurance...), réglages séparés pour combats normaux, boss, Cauchemar et Tour, et réglages par équipe | Rapide (des milliers de combats par seconde), c'est elle qui fait tourner les analyses |
| Entraînement par entropie croisée (CEM) | `entrainer.mjs` | Ajuster les 19 réglages sur tes meilleures équipes, objectif 2 étoiles puis 3 | Gardé seulement s'il bat les réglages actuels sur des combats jamais vus |
| Imitation de l'IA qui anticipe | `distiller.mjs` | La règle rapide apprend les choix de l'IA lente (régression softmax) | Gardée seulement si elle fait mieux sur des combats de contrôle |
| IA qui anticipe | `lib/anticipe.mjs`, `plafond.mjs` | Conseil en combat : chaque action candidate est jouée jusqu'à la fin plusieurs fois sur une copie du combat | Sert aussi à mesurer le plafond de la règle rapide |
| Analyse complète | `tout.mjs` | Meilleurs trios par mode (campagne, Cauchemar, boss, événements, Salle, Tour, guilde, Pain) | Objectif 2 étoiles minimum, départage par les 3 étoiles |
| Tour de l'infini | `tour.mjs`, `lib/tour.mjs` | Tous les trios SSR/UR/LR en course avec élimination (une montée par manche, même graine, écart type pris d'au moins 4 étages, z = 3), finale de 30 montées pour les 20 meilleurs, journal des montées ; étages qui bloquent, collectifs | Montées complètes avec PV reportés et soin entre étages comme le jeu ; la règle apprise classe vite mais sous-estime certains trios |
| Campagne : 3 étoiles | `cauchemar3.mjs` | Tous les trios de tes SSR, UR et LR sur tous les combats de Cauchemar Normal, Difficile et Extrême, et de Campagne Normal, Difficile et Extrême (jouée, sans élimination) | Voir la section 2 |
| Campagne : meilleur trio par combat | `cauchemar3.mjs`, `lib/etages.mjs` | Les meilleurs trios de la course et ceux du script jouent chaque combat seul ; les combats sans trio sûr sont cherchés sur tous les trios (budget de temps, reprise par le journal) ; plan minimal de trios pour tout couvrir | En place (5.16.0) |
| Pourquoi la 3★ saute (5.26) | `lib/diagnostic.mjs`, `diagnostic3.mjs` | Les combats sous le seuil sont rejoués jusqu'au bout avec leurs meilleurs trios ; cause de la 3e étoile perdue : fini après le cycle 8, allié K.O., les deux, défaite | Calcul du 17/11 au 99 : en Cauchemar, la 3e étoile saute surtout au temps (il reste 16 à 29 % des PV ennemis au cycle 9), presque jamais sur un K.O. seul ; 14 s pour 81 combats |
| Combats de la course réutilisés (5.27) | `cauchemar3.mjs`, `lib/etages.mjs` | La Campagne (qui n'élimine pas) n'est jouée que par les finalistes ; l'étoile de chaque combat de la course est gardée et reprise par l'étape par combat au lieu de rejouer le même trio, même combat, même graine | -40 % de processeur sur un test de 90 trios, mêmes % de 3★ partout |
| IA par trio (5.30) | `entrainer.mjs --trios plan` | Réglages Cauchemar propres à chaque trio du plan Campagne, entraînés sur ses combats | Gardés seulement si le gain tient sur 6 tirages jamais utilisés (test apparié, z ≥ 2) |
| Mêmes tirages pour tous (nombres aléatoires communs) | `cauchemar3.mjs`, `tout.mjs` | Tous les trios jouent les mêmes combats avec les mêmes graines : l'écart mesuré vient du trio, pas de la chance | Divise fortement le nombre de combats nécessaires pour départager |
| Collectifs | `conseils.mjs`, `cauchemar3.mjs` | Les 6 collectifs à cocher quand une carte en a plus : crible rapide, puis confirmation | Changement conseillé seulement si le gain dépasse 2 erreurs types |
| Liens actifs par trio du plan (5.41) | `lib/liens.mjs`, `cauchemar3.mjs` | Choix regroupés par totaux de stats (mêmes totaux, même combat), front de Pareto à VIT égale avec contrôle sur des choix écartés, puis élimination par manches sur les combats du trio | 210 choix ramenés à 25 pour Pain (Akatsuki) ; changement conseillé seulement au-delà de 2 écarts types |
| Conseils de cartes | `conseils.mjs` | Collectifs, valeur des cartes des bannières, duos, marché | Mesurés avec le moteur sur tes cartes |
| Plan d'XP et de bannière (5.21) | `lib/plan.mjs`, `/api/plan`, `/plan` | Score « modèle parfait » (Campagne 1, Tour 1, Arène 1, Raid 1/2, en % de ce que la collection peut faire au 99) ; montées classées en points pour 100 000 XP, de façon gloutonne (la suivante comptée une fois la précédente faite) | Aucun combat simulé : lu dans les résultats existants |
| Collectifs calculés une fois par trio (5.33) | `lib/charger.mjs` | Le moteur du jeu est chargé depuis une copie locale où la recherche des collectifs actifs du trio garde ses résultats (elle parcourait toute la liste à chaque combat) ; repli sur le moteur normal si la fonction n'est plus reconnue | Profil CPU : 21 % du temps d'un combat ; test VM : 1,25 fois sur les combats coupés, environ 1,55 fois sur un calcul Campagne de 90 trios, résultats identiques (tests) |
| Demi-paquet au 1er tour (5.46) | `cauchemar3.mjs` | Les trios sans espoir à mi-paquet (borne haute sous la barre des 2 000 meilleurs finis) ne jouent pas la 2e moitié | Cartes fortes : calcul −20 %, combats −27 % ; cartes au hasard : sans gain ; résultats identiques dans les deux cas |
| Spécialistes groupés (5.47) | `lib/etages.mjs` | Un trio joue 8 combats à chercher par tâche au lieu d'un | 2 fois plus de combats par seconde, résultats identiques |
| Plancher et 3★ en jeu (5.50) | `cauchemar3.mjs`, `lib/etages.mjs` | Meilleur trio du dernier calcul rejoué 64 tirages par combat, plancher du meilleur trio ; pas de spécialistes sur les combats déjà à 3★ dans la partie | 7 s de plus, spécialistes 305 s puis 246 s, Normal 93 puis 94 combats à 60 % ou plus |
| Combats validés jamais rejoués, recherche directe (5.51) | `cauchemar3.mjs`, `lib/etages.mjs` | Combats à 3★ en jeu retirés partout ; sous 100 combats Cauchemar restants, pas de course : chaque combat restant cherché sur tous les trios | 30 restants : 334 s au lieu de 1 398 s ; la course sur les seuls restants n'élimine personne (combats durs) |
| Calcul sur tous les cœurs | `lib/pool.mjs`, `lib/worker.mjs` | Les combats sont répartis sur les fils du processeur | Vérifié identique au calcul sur un seul fil |
| Raid : simulation et stratégie de groupe | `lib/raid.mjs`, `raid.mjs` | Raid complet joué avec le code du jeu, de 1 à 3 joueurs ; Ruptures planifiées pour le groupe, Garde sur la carte visée, 2 Ruptures gardées pour la phase 3 de Diavolo ; trios classés contre 3 niveaux de coéquipiers tirés au hasard, à 3 et à 2 joueurs | Trio recopié aux 3 places : 0 sur 20 en frappant seulement, 30 sur 30 avec la stratégie. Coéquipiers L/M niveau 99 : 93 % ; E/L : 60 % ; E niveau 70 : 7 % |
| Détection de patch | `telecharger.mjs`, `lib/resume.mjs` | Repérer ce qui change dans le jeu (cartes, kits, combats) | Une version comparée à elle-même est vide (test) |

## 2. La méthode de la campagne (version 5.13.0)

| Élément | Choix | Pourquoi |
|---|---|---|
| Recherche | Tous les trios (383 306 pour 133 cartes), sans présélection par carte seule | Une présélection rate les combos : une carte moyenne seule peut être la meilleure dans un trio |
| Course avec élimination (racing, proche du successive halving) | Tous les trios jouent un paquet de 16 combats par manche ; un trio est retiré seulement si sa borne haute passe sous la borne basse du 30e meilleur (z = 3) | On ne gaspille pas de calcul sur les trios clairement battus, sans risque réel d'éliminer le bon |
| Quatre objectifs | Normal, Difficile, Extrême et la moyenne des trois ; les 4 premières manches n'éliminent que sur la moyenne et Normal | Un trio excellent dans une seule difficulté n'est pas jeté trop tôt |
| Finale | Les survivants rejouent tous les combats avec 2 graines de plus | Les résultats affichés ne dépendent pas d'un seul tirage |
| Arrêt dès que les 3 étoiles sont perdues | Cycle 9 atteint, ou un K.O. si aucune carte de l'équipe ne peut ranimer | 1,8 fois plus rapide, mêmes 3 étoiles (vérifié sur 9 840 combats et par un test) |
| Journal des essais | Chaque paquet calculé est gardé avec une signature : code de combat du jeu, carte (stats, kit, collectifs), niveau, étoiles, collectifs choisis, combats, réglages de l'IA | Rien n'est refait sans raison ; un patch qui ne touche que les bannières ne vide pas le journal ; reprise après une coupure. Depuis 5.42, les lignes qui n'ont servi à aucun des 2 derniers calculs complets sont retirées (journal Campagne mesuré : 78 Mo vers 39 Mo, mémoire au chargement 533 vers 291 Mo) |
| PC éveillé | Demande à Windows de ne pas se mettre en veille pendant le calcul seulement | Aucun réglage d'alimentation modifié |
| Détails | Par difficulté, par monde, boss contre autres combats, ton équipe actuelle, meilleurs trios à tes niveaux actuels, cartes clés | Affichés dans l'onglet Campagne avec export PNG |

Vitesse mesurée : environ 7 300 combats par seconde sur 11 fils (Ryzen 5 5600X), environ 3 h pour le premier calcul complet. Les calculs suivants ne refont que ce qui a changé.

Limite connue : la règle à 19 critères joue bien mais pas parfaitement. Un trio peut faire mieux en jeu avec de meilleurs coups. C'est l'objet de l'axe « recherche coup par coup » plus bas.

## 3. Mis de côté (en attente)

| Piste | Raison |
|---|---|
| Modèle prédictif (estimer un trio sans le jouer) | Plus rapide, mais risque de rater les combos (synergies de série, collectifs, passifs d'équipe) : on préfère jouer tous les trios |
| Bandits (UCB, LUCB) pour choisir quels trios rejouer | La course avec élimination suffit pour l'instant ; gain de temps possible plus tard |
| Réseau de neurones (valeur et coups, PyTorch sur carte graphique) pour la campagne | La règle à 19 critères plus la simulation suffisent ; à reprendre si la recherche coup par coup plafonne |
| Collectifs optimisés pour tous les trios | Fait seulement pour les 5 meilleurs (le calcul est long) |

## 4. Axes futurs

| Axe | Idée | Étude de référence |
|---|---|---|
| Recherche coup par coup dans le conseil en combat de la campagne (prochain axe) | Arbre de recherche (MCTS) sur les coups pour viser les 3 étoiles ; vérifier d'abord que la graine du combat est lisible dans la page | AlphaZero, Foul Play |
| Recherche avec peu de simulations | Choix des coups candidats par Gumbel et halving séquentiel : l'amélioration est garantie même avec peu de simulations | Gumbel AlphaZero |
| Comparer deux réglages plus vite | Test séquentiel (SPRT) au lieu d'un nombre fixe de combats | Stockfish, Fishtest |
| Cible de valeur plus riche | Apprendre aussi les PV restants et le cycle de fin, pas seulement le résultat | KataGo, Leela Chess Zero |
| Positions difficiles | Rejouer en priorité les combats perdus de peu | Go-Exploit |
| Collectifs dans toutes les analyses PvE | Étendre le crible des collectifs à l'analyse complète | |

## 5. Écarté

| Piste | Raison |
|---|---|
| Arrêt anticipé « sans perte » d'un paquet (borne haute) | Mesuré le 19/11 : −13 % du temps seulement |
| Pré-tri des cartes avant la course | Des trios gardés au 1er tour ont une carte classée 337e sur 348 (portée par une paire forte) |
| Pré-tri de la Tour | Les trios écartés à la 1re manche font 58 à 97 % des étages montés, mais chacun s'arrête quand il perd : on ne peut pas les couper plus tôt sans deviner |
| Automatiser le jeu ou contourner l'anti-robot | Interdit par les règles du projet |
| Entraîner ou tester contre le vrai jeu | Interdit, et inutile : le simulateur reproduit le jeu |
| Un modèle de langage (LLM) dans la boucle de combat | Trop lent et moins bon que les IA spécialisées (PokéAgent, PokéChamp) |
| Équilibre de Nash (CFR, ReBeL, DeepNash) | Surdimensionné : en PvE l'adversaire est une IA fixe |

## 6. Logiciels et outils

| Outil | Usage |
|---|---|
| Node.js | Moteur local, simulations, serveur du panneau |
| Electron, electron-updater, NSIS | Application Windows, installateur et mises à jour |
| Tampermonkey | Script KitsuAI dans le navigateur (lecture et affichage) |
| GitHub Actions | Vérification (syntaxe, version, tests), publication des versions, wiki |
| Python et PyTorch (CUDA) | Essais d'apprentissage sur carte graphique |
| PowerShell (`SetThreadExecutionState`) | Garder le PC éveillé pendant un long calcul |

## 7. Études consultées

| Étude | Ce qu'on en retient | Lien |
|---|---|---|
| Hoeffding Races (Maron et Moore, 1994) | Éliminer un candidat dès qu'il est statistiquement battu | |
| Successive halving (Karnin, Koren, Somekh, 2013) | Répartir le calcul par manches en gardant les meilleurs | |
| Méthode de l'entropie croisée (Rubinstein) | Base de `entrainer.mjs` | |
| Expert Iteration (Anthony et al., 2017) | L'expert (recherche) enseigne à l'apprenti (règle rapide) : justifie l'imitation | [arXiv 1705.08439](https://arxiv.org/abs/1705.08439) |
| AlphaZero (Silver et al., 2017) | Recherche guidée par une valeur apprise | [arXiv 1712.01815](https://arxiv.org/abs/1712.01815) |
| KataGo (Wu, 2019) | Beaucoup moins de calcul pour le même niveau, cibles auxiliaires | [arXiv 1902.10565](https://arxiv.org/abs/1902.10565) |
| Gumbel AlphaZero / MuZero (DeepMind, 2022) | Recherche fiable avec peu de simulations | [ICLR 2022](https://iclr.cc/virtual/2022/poster/6418) |
| MuZero Unplugged, Reanalyse (2021) | Recalculer les cibles d'anciennes parties | [arXiv 2104.06294](https://arxiv.org/abs/2104.06294) |
| piKL (Meta, 2022) | Garder l'imitation comme ancre pendant la recherche | [arXiv 2112.07544](https://arxiv.org/abs/2112.07544) |
| Metamon (UT Austin, 2025) | IA de combat Pokémon, l'apprentissage par renforcement bat l'imitation pure | [arXiv 2504.04395](https://arxiv.org/abs/2504.04395) |
| PokéAgent Challenge (NeurIPS 2025) | Les IA spécialisées battent les LLM en combat | [arXiv 2603.15563](https://arxiv.org/abs/2603.15563) |
| Foul Play (2025) | MCTS sans réseau, bien plus profond qu'un minimax | [billet de l'auteur](https://pmariglia.github.io/posts/foul-play) |
| PokéChamp (ICML 2025) | LLM dans la recherche : spectaculaire mais lent | [arXiv 2503.04094](https://arxiv.org/abs/2503.04094) |
| ISMCTS (Cowling, Powley, Whitehouse, 2012) | Chercher quand une partie de l'état est cachée | [PDF](https://eprints.whiterose.ac.uk/75048/1/CowlingPowleyWhitehouse2012.pdf) |
| SPRT (Chessprogramming, Fishtest) | Arrêter un test dès que la preuve suffit | [SPRT](https://chessprogramming.org/SPRT) |
| Go-Exploit (2023) | Repartir de positions intéressantes | [arXiv 2302.12359](https://arxiv.org/abs/2302.12359) |
| Population Based Training (2017) | Plusieurs entraînements qui se copient les meilleurs réglages | [arXiv 1711.09846](https://arxiv.org/abs/1711.09846) |
| Leela Chess Zero, Oracle (« Lessons from AlphaZero ») | Mélanger résultat final et valeur de la recherche | [blog Lc0](https://blog.lczero.org/2018/10/understanding-training-against-q-as.html) |
