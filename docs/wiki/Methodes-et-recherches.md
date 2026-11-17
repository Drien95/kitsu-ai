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
| Mêmes tirages pour tous (nombres aléatoires communs) | `cauchemar3.mjs`, `tout.mjs` | Tous les trios jouent les mêmes combats avec les mêmes graines : l'écart mesuré vient du trio, pas de la chance | Divise fortement le nombre de combats nécessaires pour départager |
| Collectifs | `conseils.mjs`, `cauchemar3.mjs` | Les 6 collectifs à cocher quand une carte en a plus : crible rapide, puis confirmation | Changement conseillé seulement si le gain dépasse 2 erreurs types |
| Conseils de cartes | `conseils.mjs` | Plan d'XP, valeur des cartes des bannières, duos, marché | Mesurés avec le moteur sur tes cartes |
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
| Journal des essais | Chaque paquet calculé est gardé avec une signature : code de combat du jeu, carte (stats, kit, collectifs), niveau, étoiles, collectifs choisis, combats, réglages de l'IA | Rien n'est refait sans raison ; un patch qui ne touche que les bannières ne vide pas le journal ; reprise après une coupure |
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
| Plan d'XP qui tient compte du coût | Le plan actuel dit quelle carte monter, pas encore à quel prix |

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
