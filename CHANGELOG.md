# Changelog KitsuAI

Les versions les plus récentes en premier. Les versions 1.x à 3.x sont résumées (détail non conservé).

---

## 5.56.2

Script : après un nouveau calcul Campagne, l'écran d'équipe montre bien ses trios.

- **Cause** : le classement des trios d'un combat est gardé dans le navigateur (25 derniers combats, `kitsu_ai_teams`). Depuis la 5.54, le trio exact du privé est redemandé au PC à chaque écran d'équipe, mais pas les trios du calcul Campagne public : si le calcul avait trouvé un nouveau meilleur trio pour ce combat, l'ancien classement restait affiché.
- **Maintenant** : à chaque écran d'équipe (PC allumé), si un trio du calcul Campagne ou le trio exact manque au classement gardé, le classement est refait avec lui ; sinon le marquage « calcul » est mis à jour.
- Monter de version vide aussi ce cache une fois.



Campagne, panneau « Ton trio, combat par combat » : les « à calculer » ne comptent plus les combats déjà gagnés à 3 étoiles.

- **Cause** (vu par Adrien le 20/11) : depuis la 5.51, les combats déjà à 3★ dans ta partie (`pve.stars` de la sauvegarde) ne sont plus joués par le calcul, donc ils ne sont pas dans `cauchemar3.json`. Le panneau comptait tout combat du jeu absent du calcul comme « à calculer : relance la Campagne ». Après le calcul du 20/11, Dragon Ball Z affichait « +33 à calculer » (172 combats, dont 139 calculés en Cauchemar Normal) : relancer la Campagne n'y changeait rien.
- **Maintenant** : un combat à 3★ dans ta partie s'affiche « 3★ en jeu, déjà validé dans ta partie, plus rejoué ». Le monde affiche « N déjà 3★ » en vert, et « +N à calculer » ne compte plus que les combats vraiment absents (nouveau monde, nouvelle difficulté). En-tête de colonne : « N déjà 3★ en jeu ». Le filtre « Sous 60 % » ne les montre plus.
- Rien ne change dans le calcul.



Base commune : le quota du jour n'est plus mangé par des lots que personne ne pourra lire, et le message d'envoi dit ce qui s'est vraiment passé.

- **Cause du quota plein** (mesuré sur le PC d'Adrien le 20/11) : la file d'envoi gardait 189 lots du calcul du 18/11 (moteur `B4t5msj4`, signature `1gz16357hta`). Le jeu a été mis à jour depuis (moteur `DFG3HI-s`, signature `8hxan3wwks`). Au calcul du 20/11, ces vieux lots sont partis en premier : 80 envoyés (le quota de 80 lots par jour de l'ID), 109 encore en file. Le manifeste est filtré par version : ces 80 lots ne seront jamais lus ni contrôlés par personne, et les résultats du calcul du jour seraient restés derrière eux.
- **Lots périmés effacés** : avant d'envoyer, `viderFile` efface de la file les lots d'une autre version du jeu ou de l'IA commune (`{ sigG, wKey }` du calcul en cours) au lieu de les envoyer. Le nombre effacé est écrit dans le calcul et dans le journal de la base commune.
- **Lots de 60 000 résultats** (`LIGNES_PAR_LOT`, le maximum que le serveur accepte déjà, rien à redéployer) au lieu de 20 000. Mesuré sur les vrais lots du 18/11 : 20 000 résultats = 69 à 76 Ko, 60 000 = 210 à 216 Ko (limite 1,9 Mo). Le calcul complet du 18/11 (3,9 millions de résultats) fait 65 lots au lieu de 195 : il tient dans un seul jour de quota (80) au lieu de trois.
- **Message juste** : avant, « envoi reporte (429 quota du jour atteint) » s'écrivait au moment du refus, puis « 80 lots en attente envoyes » juste après, ce qui semblait se contredire. Maintenant une seule ligne de bilan : « 80 lots envoyes (1600000 resultats), 109 gardes en file : quota du jour atteint pour cet ID, nouvel essai au prochain calcul lance apres 01 h 00 » (le serveur compte les jours à minuit UTC). Un envoi qui échoue arrête la file au premier refus au lieu de réessayer chaque lot (30 s d'attente chacun sans internet).
- **Envoi coupé** : la file n'est plus envoyée au début d'un calcul quand « envoyer » est décoché.
- Tests de la base commune : 20 (2 nouveaux : file avec un lot périmé et quota atteint, lot de 60 000 résultats accepté).

## 5.55.0

Guide : le « + » de l'énergie est entouré comme les autres indications, sans calcul.

- **Encadré blanc** : énergie vide, au moins 15 gemmes et un combat sûr à faire dans le plan, le guide entoure le « + » avec l'encadré blanc habituel (`kitsu-guide`) et dit « clique sur « + » pour recharger (15 gemmes) ». L'étiquette verte et le calcul de gemmes de la 5.52 (`refillValue`, `#kitsuRefillLab`) sont retirés : un simple repère suffit.
- **Gardé de la 5.52** : le plan se recalcule quand tes étoiles ont changé (`cle`) et un seul calcul du plan tourne à la fois. C'est ce qui fait réapparaître le repère après tes combats.
- Roadmap : « Recharge l'énergie (15 gemmes) : il reste N combats à faire », sans chiffre estimé.

## 5.54.0

Choix d'équipe (Campagne) : le trio du calcul exact du script privé passe devant même quand le classement de ce combat était déjà en cache.

- **Cause** : le classement des trios d'un combat est gardé en cache (`kitsu_ai_teams`). S'il avait été calculé PC éteint, ou avant le dernier calcul Campagne exact, l'écran d'équipe réaffichait le trio du public sans redemander le trio exact au PC.
- **Correction** : à chaque écran d'équipe, le trio exact est redemandé au PC (`_exactPC`, une requête locale). Déjà classé : son marquage est mis à jour ; absent : le classement est refait avec lui ; PC muet : le cache sert tel quel.
- **Mesure** (vrai jeu joué en local, PC simulé) : 1er passage PC éteint, « À jouer » = trio du public ; 2e passage PC allumé avec un trio exact : avant, trio du public (aucune demande au PC) ; après, trio exact (« calcul exact (script privé) : 3 étoiles 92 % »).

## 5.53.0

Combat : quand le script privé donne le coup, le conseil orange du script public n'apparaît plus du tout, même un instant.

- **Contours et étiquette « CIBLE » cachés dès que le privé a pris le combat** (`html[data-kar-avis]`), et plus seulement quand il a déjà un coup (`data-kar-coup`). Avant, au début de chacun de tes tours, le public répondait en quelques dizaines de ms et son contour orange restait visible le temps que le privé calcule.
- **Début de combat** : si le script privé est là (`html[data-kar-pret]`) et que le combat est un étage de Tour ou un combat à graine connue, le cadre public attend qu'il prenne le combat ou le rende (`data-kar-libre`), 2,5 s au plus, puis s'affiche (`data-kitsu-public`). Avant, le cadre orange restait affiché 0,2 à 0,3 s.
- **Repli inchangé** : sans script privé, ou quand il ne peut pas calculer, le conseil public s'affiche comme avant.
- **Mesure** (vrai jeu joué en local, image par image, script privé 0.27.0) : Tour, 7 tours de jeu, 5,9 s d'orange avant, 0 ms après ; Campagne, 3 combats, 0,3 à 3,9 s avant, 0 ms après. Privé absent : public tout de suite ; privé muet : public après 2,7 s ; calcul exact impossible : public 0,25 s après le début du tour.

## 5.52.0

Guide : quand l'énergie est vide, le « + » dit ce que la recharge rapporte vraiment, et le plan ne reste plus bloqué sur des combats déjà faits.

- **Recharge calculée** (`refillValue`) : prix lu dans le jeu (`G.EN_REFILL`, 15 gemmes, aucune limite par jour, remplit la jauge). Gain = gemmes attendues des combats du plan sûrs à 90 % ou plus, classés par gemmes par énergie, jusqu'à remplir la jauge (formule du jeu : nouvelles étoiles + bonus de 1re victoire Difficile 1 / Extrême 2, x2 en Cauchemar, multipliée par les chances du plan). Remplace le texte fixe « ~+15 gemmes nettes ».
- **Repère sur le « + »** : rentable, contour vert et étiquette « Recharge : 15 → +44 gemmes, net +29 » avec le nombre de combats par difficulté ; pas rentable, pas de contour, étiquette grise et « reviens dans ~10 min ». La roadmap reprend le même calcul.
- **Plan à jour** : le plan garde une empreinte de tes étoiles (`cle`). Le guide, la roadmap et l'onglet Plan le recalculent dès qu'elle ne correspond plus à ta partie. Le plan ne garde que le combat suivant de chaque arc : une fois ceux-là faits, un plan ancien semblait vide (« reviens dans ~10 min ») alors que les combats d'après étaient ouverts.
- **Un seul calcul du plan à la fois** : un appel pendant un calcul en relance un à la fin. Avant, deux calculs lancés coup sur coup pouvaient finir dans le désordre et laisser le plus ancien enregistré.
- **Mesure** (sauvegarde du 19/11 19 h 51, IA publique, 8 simulations par combat) : 81 combats jouables pas à 3★, dont 4 Extrême et 8 Difficile à 0★ sûrs à 100 % ; 10 énergies = 44 gemmes pour 15. L'ancien guide affichait « reviens dans ~10 min » sans repère.

## 5.51.0

Campagne : un combat déjà à 3★ dans ta partie n'est plus jamais rejoué, et quand il en reste peu, le calcul va droit aux combats à finir.

- **Combats validés** (`cauchemar3.mjs`) : les combats à 3★ dans ta sauvegarde (`pve.stars`, envoyé par le script depuis la 5.45) sont retirés avant tout : ni course, ni étape par combat, ni plancher. Une difficulté entièrement validée ne compte plus dans le classement. Tout validé : rien n'est calculé, le résultat précédent est gardé. `--rejouer-valides` : comme avant.
- **Recherche directe** : sous 100 combats Cauchemar restants (`--seuil-direct`), pas de course. Après le plancher et les candidats, chaque combat restant sous 100 % est cherché sur tous les trios (spécialistes groupés de la 5.47), sans budget. Le classement global des trios est celui du dernier calcul. `--course` : course quand même.
- **Pourquoi pas la course** : les combats restants sont les durs, où presque aucun trio ne fait 3★. Les bornes ne se séparent plus et personne n'est éliminé. Mesuré sur 81 combats restants : 161 700 trios encore en course après 3 tours (1 038 s, avant la finale), contre 1 090 s au total pour la recherche directe.
- **Panneau** : tuile « Validés en jeu » (nombre de combats jamais rejoués, combats restants), méthode et durée prévue de la recherche directe (environ 1 combat simulé par trio et par combat restant, mesuré). `/api/campagne/prevision` renvoie `valides` par difficulté.
- **Mesures** (VM 4 fils, moteur B4t5msj4, 100 cartes, 161 700 trios, Cauchemar, 96 combats par difficulté, journal vide). Combats validés simulés par une liste (la sauvegarde du bench n'a pas `pve.stars`), comparés au calcul complet 5.47 (1 398 s, 288 combats) :

| Combats restants | Méthode | Durée | Restants à 60 % ou plus | Meilleur trio par combat |
|---|---|---|---|---|
| 30 | recherche directe | 334 s | 10 (calcul complet : 9) | 18 identiques, 8 meilleurs, 4 moins bons de 5 à 8 points (un tirage sur 8) |
| 81 | recherche directe | 1 090 s | 53 (calcul complet : 53) | 66 identiques, 8 meilleurs, 7 moins bons |
| 81 | course sur les restants | arrêtée à 1 038 s, aucun trio éliminé | | |

## 5.50.0

Campagne : un trio déjà trouvé n'est plus perdu d'un calcul à l'autre, et les combats déjà à 3★ dans ta partie ne sont plus cherchés par les spécialistes.

- **Plancher** (`cauchemar3.mjs`, `lib/etages.mjs`) : avant l'étape par combat, le meilleur trio de chaque combat au dernier calcul est rejoué 64 tirages sur ce combat, avec les niveaux de ce calcul. Son taux remplace le meilleur trio du combat s'il fait mieux. Pourquoi 64 : un trio à 8 tirages sur 8 n'est garanti qu'à 69 % (borne basse à 95 % de confiance), à 64 sur 64 il l'est à 95,4 %. Rejoués gardés au journal. `--sans-plancher` : comme avant.
- **Combats à 3★ dans ta partie** (`pve.stars`, envoyé par le script depuis la 5.45) : pas de spécialistes. Colonne `acquisJeu` dans `etages.combats`. `--sans-acquis-jeu` : spécialistes aussi sur ces combats.
- **Mesures** (VM 4 fils, moteur B4t5msj4, 100 cartes, 161 700 trios, Cauchemar, 96 combats par difficulté, journal vide, budget spécialistes 30 min). Étoiles en jeu simulées : 3★ sur les 265 combats où le calcul précédent avait un trio à plus de 0 % (la sauvegarde du bench n'a pas `pve.stars`).

| | Avant (5.47.0) | Après (5.50.0) |
|---|---|---|
| Plancher | | 265 trios rejoués en 7 s, 207 à 64/64 |
| Spécialistes | 29 combats, 305 s | 23 combats, 246 s |
| Calcul complet | 1 398 s | 1 359 s |
| Combats à 60 % ou plus (N / D / E) | 93 / 90 / 77 | 94 / 90 / 76 |
| Plan | 14 trios | 12 trios |

Meilleur trio par combat : 283 combats identiques, 3 meilleurs grâce au plancher (+10 points en moyenne), 2 moins bons, tous deux déjà à 3★ dans la partie (spécialistes sautés, dont celui qui fait passer l'Extrême de 77 à 76).

## 5.49.1

Onglet Plan du script : la case « Me proposer la Tour dans le guide » est visible partout, plus seulement sur la carte de l'Aventure (hors de la carte, l'onglet n'affichait que l'objectif de bannière). Les combats du plan restent affichés sur la carte de l'Aventure.

## 5.49.0

Guide : la Tour devient un choix, la Campagne passe d'abord.

- **Constat** (demande d'Adrien du 19/11) : le guide envoyait sans cesse vers la Tour alors qu'il restait des gemmes et de l'XP à prendre en Campagne Cauchemar N/D/E. Deux causes dans `guide()` : (1) quand le plan n'avait plus de 3★ sûre, la Tour était testée **avant** le farm d'XP des murs ; (2) l'étage prévu par le script privé arrivait arrondi (158,6 devenait 159), donc « prévision ≥ record + 1 » restait vrai avec un record de 158, alors que la médiane prévue était 156.
- **Changement** :
  - Ordre du guide : 3★ du plan, puis farm des murs, puis la Tour seulement s'il n'y a ni l'un ni l'autre (et pas pendant le calcul du farm).
  - La Tour n'est plus proposée par défaut. Onglet Plan du script : case « Me proposer la Tour dans le guide » (clé `kitsu_ai_tourGuide`, décochée par défaut).
  - Prévision lue sans arrondi (`_karTour` accepte une décimale, cible affichée à 0,1 près).
  - Inchangé : une montée lancée par toi est suivie jusqu'au bout, et l'écran de compo de la Tour suit toujours le trio exact du privé quand tu y vas.

## 5.47.0

Campagne : les spécialistes (meilleur trio par combat cherché sur tous les trios) vont deux fois plus vite.

- **Constat** : sur ton calcul du 18/11, l'étape par combat a pris 11 430 s (budget de 3 h), à 0,65 min par combat ; 1 340 combats restaient à chercher. Chaque trio jouait un seul combat par tâche.
- **Changement** (`lib/etages.mjs`) : les combats à chercher sont pris par groupes de 8. Une seule tâche par trio joue tous les combats du groupe qu'il n'a pas déjà joués dans la course, puis les tirages 2 et 3 et la confirmation sont regroupés de la même façon. Mêmes combats, mêmes graines, mêmes étoiles. Le budget est vérifié avant chaque groupe.
- **Mesures** (VM 4 fils, moteur B4t5msj4) :

| Essai | Avant | Après |
|---|---|---|
| Banc : 1 combat par tâche contre 8 (4 000 trios, 16 combats Cauchemar Extrême) | 8 146 combats/s | 18 260 combats/s, étoiles identiques |
| Banc : 1 contre 4 et 16 (6 000 trios, 16 combats Campagne Difficile) | 7 667 et 7 423 combats/s | 12 536 et 13 258 combats/s, étoiles identiques |
| Calcul complet, 100 cartes fortes, 29 combats sous 60 %, budget 30 min | 556 s (0,32 min par combat) | 275 s (0,16 min par combat), résultat identique (meilleurs trios des 288 combats, trios trouvés par les spécialistes, plan) |

Avec le même budget, environ deux fois plus de combats sont cherchés à chaque calcul.

## 5.46.0

Campagne : le 1er tour de la course ne fait plus jouer leur paquet complet aux trios sans espoir.

- **Méthode** (tours de 3 000 trios ou plus, Cauchemar N/D/E) : tous les trios jouent la 1re moitié de leur paquet. Les 2 000 meilleurs à mi-chemin (borne basse, chaque objectif qui élimine) jouent la 2e moitié et donnent la barre : la 30e meilleure borne basse sur paquets complets, qui ne dépasse jamais celle du tour complet. Un trio dont la borne haute à mi-chemin est sous la barre de tous ces objectifs est écarté sans jouer la 2e moitié ; les autres finissent leur paquet (mêmes graines par combat : paquets complets identiques, journal et base commune inchangés). La moitié jouée est gardée au journal pour la reprise. `--sans-demi` : tour complet pour tous ; `--demi-min`, `--demi-barre`.
- **Mémoire** : état dans des tableaux de nombres (7 M trios = 21 M moitiés), aucun objet par trio. 348 cartes, 3 min de calcul : 1,43 Go sans, 1,49 Go avec (+4 %).
- **Mesures** (VM 4 fils, moteur B4t5msj4, 100 cartes, 161 700 trios, Cauchemar, 96 combats par difficulté) :

| Collection | 1er tour | Calcul complet | Combats simulés | Résultats |
|---|---|---|---|---|
| Cartes fortes | 747 s puis 491 s (−34 %) | 1 331 s puis 1 061 s (−20 %) | 10,67 M puis 7,77 M (−27 %) | identiques (top 10 des 4 objectifs, meilleur trio des 288 combats, plan) |
| Cartes au hasard | 681 s puis 698 s | 989 s puis 991 s | 10,60 M puis 10,36 M | identiques |

Avec des cartes au hasard, la barre reste trop basse à mi-chemin : peu de trios sont écartés (8 805 sur 161 700) et le gain ne couvre pas le surcoût.

## 5.45.0

Le panneau prend des visuels, sans rien qui tourne en continu.

- **Campagne, la carte des mondes** : une case par combat du dernier calcul, monde par monde, pour chacune des 6 difficultés. Couleur : or = le meilleur trio fait 3★ à chaque tirage, orange = 60 % ou plus, rouge = parfois, sombre = aucun trio. Contour or = monde fini. Clic sur un monde : « Ton trio, combat par combat » s'ouvre dessus. Couche « Acquis dans le jeu » : les étoiles gagnées par combat, envoyées par le script.
- **Tour, la tour verticale** : ton record, la prévision du meilleur trio (du pire au record, 9 montées sur 10, moyenne), les trios n° 2 et 3, l'étage exact privé s'il existe, et les étages où les montées s'arrêtent (champ `murs` de `tour.json`, détail au survol).
- **Calcul en direct** (onglet Calculs, et une mini frise dans la carte de la tâche) : pendant un calcul Tour ou Campagne, les trios encore en course manche après manche et le top 10 provisoire, avec les places gagnées ou perdues. `tour.mjs` et `cauchemar3.mjs` écrivent une ligne « top 10 » à la fin de chaque manche (un seul passage sur les trios en course). Le dessin n'est refait qu'à la fin d'une manche (transition de 0,4 s).
- **Fiche de carte** : radar PV, ATK, DÉF, VIT, critique au niveau actuel et au 99, lus dans le moteur du jeu (`/api/carte-stats`, carte seule avec ses étoiles, échelle = meilleure carte SSR, UR ou LR au 99) ; liens actifs dans son meilleur trio, dessinés entre les portraits, ceux qui ne sont pas gardés (6 par carte) en pointillés.
- **Le modèle** : la conquête compacte (une ligne par difficulté Cauchemar, les autres modes en barres), environ 3 fois moins haute. Avec 1 979 combats par difficulté, une case regroupe des combats à la suite (80 cases au plus).
- **Réactions de Kiko** : une bulle de 10 s sur un nouveau record de Tour, une carte au 99, un monde fini en Cauchemar (dans le jeu si le script envoie les étoiles, sinon prévu) ou de nouveaux 3★ après un calcul. Rien au premier passage. Réglage dans Guides.
- **Script** : l'export de la sauvegarde ajoute les étoiles gagnées par combat (`pve.stars`) et le record de la Tour (`tower.best`). Le serveur les garde sans changer `hashSave` (elles ne demandent pas de recalcul).
- **Pendant un calcul, la barre « en cours » ne défile plus** (bande fixe à rayures en mode repos). Mesuré sur un faux serveur avec les vraies données Campagne du 18/11, Chromium sans accélération graphique, médiane de 3 mesures de 10 s : 0,8 à 4,8 s de travail de rendu toutes les 10 s avant, 0,04 à 0,1 s après, selon l'onglet.
- Tests : stats d'une unité et liens d'un trio lus dans le moteur du jeu, et `/api/carte-stats`.

## 5.44.0

Campagne et Tour : avant de lancer, tu choisis et tu vois ce que coûtera le calcul.

- **Cartes essayées** : LR, UR, SSR à cocher, avec le nombre de cartes et de trios. Une rareté décochée affiche son risque, lu dans ton dernier résultat : en Campagne, combien des trios du plan par combat en ont une et la part des combats qu'ils couvrent ; en Tour, combien des finalistes en ont une et si le meilleur trio en fait partie. Calculs : `--raretes LR,UR,SSR` (`cauchemar3.mjs`, `tour.mjs`), noté dans `raretes` du résultat.
- **Temps de travail** : jusqu'au bout, 2 h puis pause, ou une nuit (8 h) puis pause (`--pause-apres` minutes). La pause arrive à la fin d'un lot (journal écrit), le résultat précédent reste affiché, la relance reprend sans rien refaire. Le panneau affiche « En pause ».
- **Durée prévue** : 1er tour, tours suivants et finale (entonnoir du dernier calcul s'il avait les mêmes combats, sinon 1er tour = 70 % de la course, mesuré le 18/11), meilleur trio par combat, Campagne sous 100 % (durée par combat du dernier calcul), spécialistes. Heure de fin ou de pause, frise par étape. Tour : trios et reprises du journal recomptés sur les raretés cochées.
- **Au-delà de 3 h prévues** : un récapitulatif avant de lancer (durée, heure de fin, ce qui raccourcit sans perte et avec risque).
- Choix gardés dans le navigateur. Le spécialiste par combat reste un réglage à part.

## 5.43.2

Campagne et Tour : les très grosses collections ne plantent plus faute de mémoire.

- **Constat** (19/11, collection de 348 SSR/UR/LR, 6 963 596 trios) : le calcul s'arrêtait dès le lancement (`RangeError: Array buffer allocation failed`, `cauchemar3.mjs`). Le tableau des étoiles déjà jouées prenait 1 octet par trio et par combat, joué ou non : 6,96 M × 11 874 combats = 83 Go. Avec « Cauchemar seulement », 41 Go. Reproduit sur une VM : même erreur.
- **Étoiles déjà jouées** : un mot de 32 bits par trio et par paquet de 16 combats, seulement pour les paquets joués (d'abord une table, puis un tableau de 4 octets par trio quand plus d'un trio sur 16 a joué le paquet, c'est-à-dire au 1er tour). Mêmes étoiles relues par les étapes par combat.
- **Trios** : tableau compact (3 × 16 bits par trio) au lieu de 7 M petits tableaux ; clés de journal calculées à la demande ; plus de table de 7 M clés pour retrouver un trio (rang calculé) ; candidats par combat choisis sans trier les 7 M trios ; élimination sans un objet par trio ; compteurs sur 16 bits.
- **Tour de course** : paquets préparés par lots de 60 000 au lieu de 21 M objets d'un coup.
- **Journal** (`lib/journal.mjs`) : le 1er tour de 7 M trios écrit 21 M lignes. Une table de Node plafonne à 16,7 M clés : 2e plantage reproduit (`Map maximum size exceeded`). Les clés sont maintenant des nombres dans une table de hachage hors du tas, et les valeurs, très répétitives, sont mises en commun ; fichier relu par morceaux de 32 Mo ; compaction par lots. Mesuré avec 21 M lignes : écrites, relues (21 s) et compactées (14 s), 0,8 Go au plus.
- **Mesures** (VM 4 fils, Node 22, moteur B4t5msj4, 348 cartes, les 6 difficultés) : avant, plantage immédiat ; après, 0,5 Go au début du 1er tour. Course complète sur 100 cartes (161 700 trios, Cauchemar, 96 combats par difficulté) : résultats identiques à la 5.42.0, et à la 5.43.1 après fusion (top 10 des 4 objectifs, meilleur trio des 288 combats, plan ; les trios essayés par le script restent dans l'ordre d'avant, sinon une égalité à 100 % se départage autrement).
- **Tour** (`tour.mjs`, `lib/tour.mjs`) : mêmes trios compacts, clés à la demande, manche jouée par lots de 20 000 trios, élimination sans un objet par trio ; le travail de la manche annoncé par la 5.43.1 est compté sans liste d'objets. 348 cartes : 2,6 Go dès la 1re manche avant, 0,55 Go après. Essai 3 000 trios : `tour.json` identique (classement, entonnoir, murs, collectifs).
- Tests : 34.

## 5.43.1

Tour de l'infini : ce que le panneau annonce correspond au travail réel du calcul.

- **Avant** : la durée prévue comptait une montée par trio, même quand le journal en avait déjà la plupart (une relance après une nouvelle carte annonçait la même durée qu'un premier calcul). La tuile « Déjà en mémoire » montrait la taille du journal le plus récent sans vérifier qu'il servirait encore (patch du jeu, IA changée, autres niveaux). Pendant le calcul, la barre donnait 70 % à la 1re manche et 24 % aux suivantes quel que soit le travail, et ne bougeait qu'une fois par minute.
- **Prévision** (`/api/tour/prevision?niveaux=`) : `tour.mjs` écrit `cache/tour-etat.json` (journal utilisé, moteur, IA, clé de chaque carte par mode de niveaux). Le serveur ne compte une reprise que si le moteur et l'IA sont les mêmes, et seulement pour les trios dont les 3 cartes ont la même clé (niveau, étoiles, liens, carte). Tuiles : montées à simuler, reprises du journal (ou la raison pour laquelle rien n'est repris), durée sur les seules montées à simuler, manches suivantes comprises (entonnoir du calcul précédent).
- **Pendant le calcul** : `tour.mjs` annonce le travail prévu, puis pour chaque manche les montées à simuler et les reprises. La barre suit les montées vraiment simulées, avec « reste ≈ » à la vitesse mesurée ; mise à jour toutes les 30 s au plus.

## 5.43.0

Campagne : ton trio, combat par combat.

- **Nouvelle carte en haut de la page Campagne** : « Ton trio, combat par combat ». Campagne ou Cauchemar, puis un monde ; chaque combat a une ligne et chaque difficulté (Normal, Difficile, Extrême) une colonne, avec le trio qui y fait le plus souvent 3★ et son %. Par monde et difficulté, le **trio de base** (celui à égalité du meilleur sur le plus de combats) est en tête de colonne : les lignes « = trio de base » le rejouent, les lignes orange disent quand changer d'équipe. Sur le résultat du 18/11, Dragon Ball Z Cauchemar Normal : trio de base sur 93 combats sur 172. Filtres : seulement où changer, sous le seuil. Clic sur un combat : trios à égalité, suivants, trio du plan, script seul, cause du diagnostic.
- **Objectif : tout au 99 / Avec mes niveaux actuels** : la 2e lecture ne garde que les trios dont les 3 cartes sont déjà au 99 dans ta sauvegarde. Les portraits portent le niveau actuel des cartes pas encore au 99. En lecture « au 99 », si le trio montré n'est pas prêt, la ligne dit ce que tu peux jouer tout de suite. À égalité, un trio déjà prêt passe devant.
- **Calcul** (`lib/etages.mjs`, `cauchemar3.mjs`) : nouvelle colonne `pret` dans `etages.combats` (meilleur trio aux 3 cartes au 99 sur ce combat, quel que soit son %), ce trio est confirmé avec les autres sur chaque combat où il a fait 3★ au moins une fois, et les 40 meilleurs trios prêts du classement rejoignent les candidats (`--candidats-prets 40`, en niveaux 99 seulement). Avant, `autres` ne gardait que les trios au-dessus du seuil et la lecture « niveaux actuels » restait souvent vide : le calcul du 18/11 n'a pas cette colonne, il faut relancer la Campagne pour la remplir.
- **Futurs mondes et combats** : `/api/campagne/prevision` donne la carte des mondes et combats du jeu par difficulté. Un monde, un combat ou une difficulté absents du dernier calcul apparaissent « à calculer » (puce « + monde », étiquette « nouveau »).
- **Calcul privé** : `window.CAMP_EXACT = { '<combat>': { ids, p } }` puis `tcRender()` ; ce trio passe devant le public, marqué « exact ».
- La carte « Meilleur trio par combat » devient « Plan et diagnostic par combat » (son tableau combat par combat est remplacé par la nouvelle carte).
- Tests : 34 (2 nouveaux sur la colonne `pret`).

## 5.42.0

Journal des calculs : il ne garde plus ce qui ne sert plus.

- **Constat** (mesuré le 19/11 sur le journal Campagne d'Adrien, 78 Mo, 4 349 501 lignes) : avec ses cartes actuelles, 2 211 072 lignes (39,2 Mo) peuvent encore servir, au niveau 99 comme aux niveaux actuels. Les autres datent d'anciennes étoiles (34 cartes ont changé depuis) : elles ne seront jamais relues. Le calcul charge pourtant tout au démarrage : 533 Mo de mémoire et 5,5 s, contre 269 Mo et 2,9 s pour les lignes utiles.
- **Générations** (`lib/journal.mjs`) : chaque calcul complet ajoute `#g N` avant ses lignes, et toute ligne lue ou écrite passe à sa génération. À la fin d'un calcul complet (Campagne et Tour, sans `--max-trios` ni `--max-combats`), `compacter()` réécrit le fichier avec les lignes servies par ce calcul ou le précédent (`--journal-calculs 2`). Un calcul en niveaux actuels puis un en niveau 99, ou Cauchemar seul puis tout, ne se gênent donc pas. Un calcul coupé ne retire rien. `--garder-journal` saute le nettoyage. Les journaux sans génération (avant 5.42) sont lus comme la génération 0 : le ménage se fait au 2e calcul complet.
- **Essai sur le vrai journal** (copie, deux calculs simulés qui lisent les lignes utiles) : 1er calcul 78 Mo gardés, 2e calcul 4 349 501 vers 2 211 072 lignes, 39,2 Mo, 8 s de réécriture ; au chargement suivant 291 Mo de mémoire au lieu de 533. Le suivi des générations coûte 2 octets par ligne (567 Mo contre 533 sur le journal complet).
- **Anciens journaux** : un `cauchemar3-*.jsonl` ou `tour-*.jsonl` d'un autre code de combat ou d'une autre IA, inutilisé depuis 30 jours, est supprimé au début du calcul.
- **Anciens moteurs du jeu** (`telecharger.mjs`) : au téléchargement d'une nouvelle version, seuls la nouvelle et la précédente (comparaison du patch) restent. Sur le PC d'Adrien : 3 anciennes versions, environ 23 Mo chacune.
- Tests : 32 (3 nouveaux sur le journal).

## 5.41.4

Tour : le message « Tour bloquée » suit exactement la règle du jeu.

- Lu dans le moteur du jeu (`towerFight`) : un combat d'Aventure ou d'événement ne bloque la Tour que pendant 20 minutes après son début (`fight.t`). Passé ce délai, le jeu laisse monter.
- La 5.41.2 affichait « Tour bloquée » tant que le combat restait dans la sauvegarde, même après ces 20 minutes. Maintenant le guide revient sur « Combattre l'étage » dès que le jeu ne bloque plus, et le message indique ce délai.

## 5.41.3

Base commune : un calcul Campagne qui ne partage pas le dit, avec la raison.

- Le partage est lu au lancement du calcul. Allumé pendant le calcul, il ne sert qu'au calcul suivant : la page Campagne montrait seulement « pas encore de calcul partagé », sans dire pourquoi.
- Maintenant, la tuile « Dernier calcul » affiche « non partagé » et la raison (base coupée au lancement, ton IA plus forte que l'IA commune, réglages de test), et le journal de la Base commune garde une ligne « Calcul lancé sans partage ».

## 5.41.2

Script : le guide explique pourquoi la Tour refuse de combattre.

- **Constat** (19/11) : en pleine montée (étage 64), « Combattre l'étage » répondait « Un combat est déjà en cours (Aventure ou événement) : termine-le ou abandonne-le avant de monter dans la Tour ». Un combat d'Aventure ou d'événement lancé pendant la montée reste dans ta sauvegarde (`fight`) et bloque la Tour ; le guide entourait quand même « Combattre l'étage ».
- **Correction** : avec une montée en cours et un combat encore ouvert, le guide n'entoure plus rien dans la Tour et dit de terminer ou d'abandonner ce combat (avec son nom quand il le trouve). La montée est gardée.

## 5.41.1

Calcul Campagne : la progression dit la vérité pendant les spécialistes, et les combats sans aucune 3★ passent en dernier.

- **Constat** (19/11, calcul Cauchemar seulement, spécialistes 1 h) : après 1 h 43, la barre affichait « 97 %, finale » et l'aperçu « 1er tour ≈ 23 min, par combat ≈ 64 min ». En réalité la course a pris 1 h 07, puis les spécialistes ont démarré avec leur budget de 60 min, compté à partir de leur premier combat de Cauchemar (comportement voulu, inchangé). Et les combats étaient pris difficulté par difficulté : sur les 52 premiers, 9 combats du Normal où aucun trio n'avait jamais fait 3★ ont coûté environ 5 min de budget sans rien trouver, avant tout combat Difficile ou Extrême.
- **Progression** : la course va jusqu'à 72 %, la finale 75 %, le meilleur trio par combat 78 %, les spécialistes de 80 à 97 % selon le budget écoulé, avec « X combats cherchés sur Y, budget restant ≈ Z min ». La fin (plan, liens, diagnostic) affiche 98 %.
- **Aperçu** : « 1er tour » dit qu'il ne compte que le 1er tour de la course et donne la durée du dernier calcul complet sur ce PC ; « Par combat » précise que le budget démarre après la course.
- **Ordre des spécialistes** (`lib/etages.mjs`) : Campagne d'abord (hors budget, inchangé), puis les combats de Cauchemar où un candidat a déjà fait 3★ au moins une fois, toutes difficultés, puis ceux à 0 %. Le journal garde chaque combat fini, la reprise ne refait rien. Gain à mesurer sur ton prochain calcul (combats améliorés dans le même budget), pas encore mesuré.

## 5.41.0

Calcul Campagne : les liens actifs à cocher, cherchés combat par combat pour les trios du plan.

- **Règle du jeu** (lue dans le moteur) : un lien est actif dès que 2 de ses cartes sont dans l'équipe ; chaque carte en garde 6, ceux que tu as choisis d'abord, sinon les plus gros %. Avant, le calcul ne cherchait les liens que pour ses 5 meilleurs trios en moyenne (liste vide sur le calcul du 18/11), jamais pour le meilleur trio par combat.
- **Recherche** (`lib/liens.mjs`) : pour chaque trio du plan où une carte a plus de 6 liens actifs, sur les combats où il est le trio du plan :
  1. un lien ne fait qu'ajouter un % à une stat : deux choix qui donnent les mêmes totaux jouent le même combat (vérifié par un test). Un seul choix par total est joué (Pain (Akatsuki) avec Pain : 210 choix, 83 totaux) ;
  2. un total qui a autant ou moins partout (ATK, DEF, PV, critique, énergie, à VIT égale) qu'un autre est écarté (83 puis 25). La VIT n'est pas comparée : elle change l'ordre des tours. Contrôle : 8 choix écartés jouent quand même le 1er tirage, et le résultat dit si l'un d'eux a fait mieux ;
  3. chaque choix gardé joue les combats du trio (1 tirage, mêmes graines pour tous), puis les 4 meilleurs et ton réglage 6 tirages de plus. Un changement n'est conseillé que s'il bat ton réglage de plus de 2 écarts types.
- Comptes sur la collection testée : 1 345 trios concernés, 85,7 millions de choix possibles, 739 571 totaux distincts, 274 628 après le tri. Essai (2 fils, 30 combats Cauchemar, Pain / Kanki / Pain (Akatsuki)) : 3 420 combats joués en 2,1 s ; contrôle 0 / 8.
- **Onglet Campagne**, sous « Le plan » : « Liens actifs à cocher » (trio, carte, les 6 liens et leurs totaux, 3★ de ton réglage puis du conseil, combats sûrs). Le réglage est par carte dans le jeu : il vaut pour toutes ses équipes.
- `--sans-liens` pour sauter cette étape. Tests : 4 de plus (29).

## 5.40.3

Script : tes liens actifs (collectifs) partent avec la sauvegarde.

- **Constat** (19/11) : dans le jeu, chaque carte garde 6 liens actifs au plus, et tu peux choisir lesquels (sinon le jeu prend les 6 plus gros %). Le script n'envoyait pas ce choix au launcher (`data/sauvegarde.json` sans `lk`) : tous les calculs jouaient le choix par défaut, pas le tien. Ça ne touche que les trios où une carte a plus de 6 liens actifs : 1 345 trios sur 562 475 de la collection testée (0,24 %), dont Kanki / Pain (Akatsuki) / Pain et les paires Gon + Killua.
- **Correction** : la sauvegarde envoyée contient `lk` (tes choix, lus dans ta sauvegarde du jeu, sans rien y écrire). Le serveur la remplace aussi quand seuls tes liens changent. Sans liens choisis, l'empreinte de la collection ne change pas (pas de fausse alerte « ta collection a changé »).

## 5.40.2

Script : le guide fait reprendre une montée de la Tour en cours avant le reste du plan.

- **Constat** (19/11) : sur la page de la Tour, avec une montée en cours (étage 6, bouton « Reprendre la montée »), le guide disait d'ouvrir l'Aventure pour « Le dernier coup ». La Tour ne passait qu'une fois tous les combats du plan faits.
- **Correction** : si ta sauvegarde a une montée en cours, le guide entoure « Reprendre la montée » (`[data-tour-open]`), puis le bouton de l'étage suivant (`[data-tw="fight"]`) ; ailleurs, il te ramène à la Tour. Les étages suivants sont gratuits et l'équipe est figée : rien ne justifie de les laisser attendre.
- Pendant un combat, rien ne change.

## 5.40.1

Script : le guide ne répète plus en boucle « fais defiler la carte jusqu'a l'arc … » pour un combat déjà fait.

- **Constat** (18/11) : le guide répétait « fais defiler la carte jusqu'a l'arc « Le doigt de Sukuna » pour « Le Roi des fléaux » » alors que ce combat était fait. Lu dans le code du guide : quand il n'y a plus de 3 étoiles faciles, il propose un combat de farm, c'est-à-dire un combat déjà à 3 étoiles qu'on rejoue pour l'XP (5.37 à 5.39). Ce message ne le disait pas. Et le guide ne proposait de changer le mode de l'arc que pour les combats Difficile, Extrême ou Cauchemar : pour un combat en Normal, si l'arc était affiché dans un autre mode, l'étape n'était jamais trouvée et le même texte revenait.
- **Correction** : le message dit « rejouer … pour l'XP (déjà à 3 étoiles, mode …) » pour un combat de farm et donne toujours le mode. Le guide propose aussi de repasser l'arc en Normal, ou d'en retirer le Cauchemar, quand le combat conseillé n'est pas dans le mode affiché.

## 5.40.0

Launcher : une visite guidée qu'on peut rejouer, racontée par Kiko, le renard de KitsuAI.

- Kiko : personnage original dessiné en SVG dans le panneau, tiré de l'icône KitsuAI (5 expressions). Aucune image téléchargée.
- La visite : 9 chapitres, 22 étapes (bienvenue, sauvegarde, Mettre à jour l'IA, Campagne, Tour, Arène privée, script dans le jeu, le modèle, rejouer). Un projecteur éclaire l'élément dont Kiko parle, avec une étiquette ; sa boîte de dialogue reste en bas (ou en haut si elle cacherait l'élément). Les étapes « À toi » attendent que tu ouvres l'onglet toi-même. Clavier : flèches, Entrée, Échap.
- Rejouer : bouton « ? » dans la barre du haut et page Outils > Guides (visite entière, reprise au premier chapitre pas vu, ou un chapitre seul ; chapitres vus cochés), aussi dans Réglages > Application.
- Premier lancement : une carte d'accueil propose la visite, jamais lancée d'office. Après une mise à jour qui a des nouveautés, un point rouge sur « ? » ouvre un mini guide de la version (5.40 : le guide lui-même).
- Options sur la page Guides : carte d'accueil, nouveautés, texte instantané (sans machine à écrire, aussi coupé si le système demande moins d'animations). État gardé dans le navigateur (`kitsuGuide`). Le projecteur ne suit le panneau que pendant que le guide est ouvert.

## 5.39.0

Script : le farm fait enfin monter les cartes basses du plan d'XP.

- Mesure du 18/11 : plan d'XP du PC avec Cell (558) et 137777 au niveau 1 en tête (Campagne +2 912 combats au 99), mais le farm jouait encore Shanks, Tobi et Kanki, tous au 99. Le farm exigeait 3 étoiles à 90 % ; une carte niveau 1 est souvent K.O., donc aucun trio avec elle ne passait et le farm retombait sur un trio sans XP utile.
- Règle du jeu lue dans le moteur : à la victoire, chaque carte gagne l'XP du combat, la moitié si elle est K.O. ; une défaite ne donne rien. Le farm rejoue des combats déjà à 3 étoiles, où les étoiles ne rapportent plus rien.
- Nouveau critère : le trio doit gagner 95 % du temps. Il est classé par XP utile = cartes à monter pondérées x (0,5 + 0,5 x 3 étoiles), le taux de 3 étoiles servant d'estimation basse des combats sans K.O.

## 5.38.0

Script : la règle privé/public est respectée sur l'écran d'équipe.

- Avant (5.28) : le trio du calcul Campagne exact (script privé) n'était choisi que s'il faisait 3 étoiles au moins 50 % du temps et dépassait de 10 points la simulation publique.
- Maintenant : dès que ce trio est jouable (ses 3 cartes au niveau du calcul, 3 étoiles > 0 avec le conseil exact), il est choisi ; le meilleur trio public n'est qu'un repli quand le privé n'a rien pour ce combat.

## 5.37.0

Script : le farm fait monter plusieurs cartes à la fois, dans l'ordre du plan d'XP global (Campagne, Tour, Raid, Arène), sans perdre les 3 étoiles.

- Avant : une seule carte avait un poids d'XP (le n°1 du plan, Shanks), donc le farm prenait toujours Shanks avec tes 2 cartes les plus fortes, déjà au 99 (Pain et Tobi), sur le combat le plus rentable, souvent en Cauchemar.
- Poids d'XP : la suite du plan d'XP (`/plan` renvoie `suite`, 6 premières montées du plan global, dans son ordre) de 5 à 2, cartes des prochains murs 4, n°1 du plan 5. Une carte au 99 n'a jamais de poids.
- Farm : trios essayés parmi tes 6 cartes les plus fortes et les 5 cartes à monter les plus utiles. Combats essayés : les 2 plus rentables de chaque difficulté (10 au plus), pour qu'une carte basse puisse monter en Normal ou Difficile. Combat retenu : le plus d'XP utile par énergie (XP du combat x cartes à monter du trio), avec un trio qui gagne 95 % et fait 3 étoiles 90 % du temps.
- Gemmes d'abord : inchangé, le farm ne passe qu'une fois les combats à gemmes faits.

## 5.36.0

Script : un seul cadre en combat avec le script privé (0.25+), comme si les deux scripts n'en faisaient qu'un.

- Le cadre KitsuAI a maintenant une place `#kitsuPriv` en tête de son contenu. Quand le privé conseille un combat (Tour, Campagne, Arène contre les fantômes), il s'y installe : même cadre, même place, même en-tête (liseré et renard bleus, « Privé · Campagne · Exact »). Les onglets et le conseil public sont cachés dessous.
- L'avis du public et du calcul du PC reste en une ligne dans le conseil du privé ; un clic dessus affiche le conseil public complet sous le privé, dans le même cadre.
- Quand le privé n'a pas de réponse (calcul exact impossible), sa note reste en tête du cadre et le conseil public reprend juste dessous.
- Avant (5.32 à 5.34), le cadre public était caché ou replié pendant que le privé gardait son propre cadre ailleurs : deux cadres dès qu'un des deux réapparaissait.
- Sans script privé, ou avec un privé plus ancien : comportement de la 5.34.
## 5.35.0

Conseiller en combat sans à-coups : son calcul de chaque tour tourne dans le worker, plus sur le fil du jeu.

- **Mesure avant** (18/11, ton navigateur, passe 2 de la 5.34, ~4,5 min de jeu) : il restait 1,13 s de page bloquée par minute en combat, dont 3,87 s au total dans le conseiller (`setInterval` du conseil). Compteur `__kitsuPerf` : `evalLive` 4 105 ms sur 59 tours, 70 ms en moyenne, **163 ms au pire** (une image figée à chaque tour).
- **Ce qui change** : `evalLive` (8 tirages par coup puis jusqu'à 8 tours de 4 tirages sur les coups proches, budget 60 ms) est envoyé au worker de `simBatch` avec une copie de l'état du combat. Même fonction, même budget, mêmes politiques : même qualité de conseil. La page ne fait plus que copier l'état et relire le classement. Les lots du worker (plan, équipes) cèdent la main toutes les ~15 ms, donc un conseil en combat passe devant au lieu d'attendre la fin d'un lot.
- **Repli** : si le worker n'est pas encore prêt (premier tour) ou ne répond pas en 3 s, le calcul se fait sur le fil du jeu comme avant, et le worker est lancé en fond pour le tour suivant.
- **Mesure** : `__kitsuPerf.evalLive` compte désormais le temps passé sur le fil du jeu, et `evalLive:aller-retour` le délai total jusqu'à l'affichage du conseil. Gain à confirmer par une nouvelle mesure avec le script privé.

## 5.34.0

Moins de lag hors combat (carte, fin de combat, choix de l'équipe) : les simulations du script ne tournent plus sur le fil du jeu.

- **Mesure avant** (18/11, ton navigateur, 20,7 min de jeu avec un calcul en cours, script privé 0.24 qui note chaque image affichée en retard et le script responsable) : 883 images en retard, 255 s de retard au total, dont **210 s** dans les calculs de fond du script public (plan du moment, relancé après chaque combat et sur la carte, entre deux `idle()`). Écrans : carte 111 s bloquées, fin de combat 42 s, combat 41 s. Le script privé : 0 s. Le jeu lui-même : ~18 s (effets d'arène surtout).
- **Ce qui change** : le plan du moment (meilleur trio par combat, murs à venir, combat de farm), la vérification de l'équipe sur l'écran d'équipe (12 tirages) et les 32 tirages des 8 meilleurs trios de l'écran d'équipe passent par le worker (`simBatch`) déjà utilisé pour l'entraînement et la boutique. Mêmes graines, mêmes équipes, même code de simulation : mêmes résultats. Sans worker, repli sur le fil principal comme avant.
- **2e passe** (mesure après la 1re passe, 12,9 min : fin de combat 2,0 à 1,4 s bloquées par minute, combat 2,0 à 1,1 s, mais page des bannières 44 s) : la valeur des bannières (`pulls`), le banc de combats de référence (`buildBench`), tes 3 meilleurs trios (`defaultTeams`) et `xpPlan` passent aussi dans le worker (`simTrios`), avec les mêmes graines, les mêmes équipes et le même ordre de somme.
- Restent sur le fil du jeu : le conseil en combat (`evalLive`, ~60 ms par tour), la Tour simulée une fois par jour et l'équipe du boss de guilde (une fois par boss).
- Mesure : `window.__kitsuPerf` compte le temps passé sur le fil du jeu après chaque pause, par fonction (`idle:Object.plan`...), et celui du conseil en combat (`evalLive`). Lu par la mesure du lag du script privé (0.24.2+), lecture seule.
- Aucun cœur ni fil bridé.

## 5.33.3

Script : le guide ne t'envoie plus vers le monde Halloween, fermé depuis le 1er novembre.

- **Constat** (18/11) : le guide disait « fais defiler jusqu'au monde Halloween pour « Le portail de la nuit des citrouilles » », mais la page Aventure n'a plus ce monde. Lu dans le code du jeu : l'Aventure Halloween n'est affichée que jusqu'à `HALLOWEEN_UNTIL` (1er/11/2026 17 h), mais le monde reste dans `ALL_WORLDS` et `fightOpen` ne regarde pas cette date (`halloween-1` encore « ouvert » pour lui le 18/11). Le plan du script le comptait donc comme jouable, et, faute de bouton à entourer, le guide affichait seulement le texte.
- **Correction** : le plan (combats, modes, combat de farm, murs à venir) ignore le monde Halloween une fois `HALLOWEEN_UNTIL` passé, et le guide écarte ses combats d'un ancien plan. Avant la date, rien ne change. Test avec le moteur du jeu du PC : 12 mondes au 31/10, 11 le 18/11.
- Le moteur (calculs Campagne) l'excluait déjà.

## 5.33.2

Panneau : « Ta collection » suit la sauvegarde envoyée automatiquement par le script.

- Avant, la collection était lue une seule fois à l'ouverture du panneau, puis seulement après un import manuel. Quand le script mettait la sauvegarde à jour (nouvelle carte tirée), « Export actuel » affichait le nouveau compte (ex. 7 LR) mais la collection gardait l'ancien (6 LR) jusqu'au redémarrage.
- Maintenant, dès que la date de la sauvegarde change, la collection est rechargée (vérifié toutes les 1,5 s avec l'état déjà lu, sans requête en plus tant que rien ne change).

## 5.33.1

Script : avec le script privé (0.24.1+), le cadre public reste caché pendant tout le combat, tours adverses compris.

- En 5.32.0, le cadre public se cachait seulement pendant ton tour et sur l'onglet Conseil : il revenait à chaque tour adverse, donc deux cadres à l'écran une bonne partie du combat. Il reste maintenant caché tant que le privé annonce son avis (`html[data-kar-avis]`). Clic sur les lignes d'avis du privé pour le revoir.
- Repli inchangé : si le privé n'a pas de réponse (calcul exact impossible, combat non pris en charge), il retire l'annonce et le cadre public revient.

## 5.33.0

Calculs plus rapides, résultats identiques : les collectifs d'un trio ne sont plus recalculés à chaque combat.

- **Ce qui coûtait** (profil CPU mesuré) : à chaque combat, le jeu recherche les collectifs actifs du trio en parcourant toute la liste des collectifs. C'est 21 % du temps d'un combat sur l'ancien moteur, plus sur le moteur actuel. Or ce résultat ne dépend que des 3 cartes et des collectifs choisis, pas du combat.
- **Ce qui change** (`lib/charger.mjs`) : le moteur du jeu est chargé depuis une copie locale (`assets/*.memo.js`, à côté du fichier téléchargé, jamais dans le dépôt) où cette fonction garde ses résultats déjà calculés. Même entrée, même résultat, lu sans être modifié. Rien d'autre du jeu n'est touché.
- **Garde-fous** : si la fonction n'est plus reconnue après un patch du jeu, ou si la copie ne se charge pas, le moteur normal est utilisé. `KITSU_SANS_MEMO=1` force le moteur normal. Trois tests dans `tests.mjs` : la copie est active ; 40 trios au hasard × des combats de tous les mondes, joués en entier et coupés, donnent exactement les mêmes étoiles, K.O. et cycles qu'avec le moteur normal ; repli si la fonction est absente.
- **Mesures** (VM, 2 cœurs, moteur B4t5msj4, sans puis avec, essais alternés) :
  - 1 000 trios × 6 combats Cauchemar durs, coupés dès que la 3★ est perdue (comme les spécialistes), 3 essais : médiane 3,89 s puis 3,12 s (1,25 fois). Les 6 000 étoiles sont identiques caractère par caractère.
  - Calcul Campagne de test (90 trios, 192 combats, diagnostic compris), 2 essais : 36 et 39 s, puis 23 et 25 s (environ 1,55 fois). `cauchemar3.json` identique hors dates et durées.
  - Le gain réel sur un calcul complet reste à mesurer sur ton PC : compare sa durée à celle du dernier calcul.

## 5.32.0

Script : un seul cadre de conseil quand le script privé a le coup exact (Tour, Campagne).

- Le script public publie son avis pour le tour en cours dans `window.__kitsuAvis` : son coup (`pub`) et le résultat du calcul du PC (`pc` : en attente, confirme, change, avec les % ; erreur). Lecture seule, rien n'est envoyé.
- Si le script privé annonce qu'il affiche cet avis (`html[data-kar-avis]`, privé 0.23+), le cadre public disparaît entièrement pendant le conseil exact au lieu de rester replié en une ligne. Un clic sur les lignes d'avis du privé le réaffiche.
- Sans script privé, ou avec un privé plus ancien : rien ne change. Quand le privé n'a pas de réponse pour un tour, le cadre public revient comme avant.

## 5.31.1

Onglet « Le modèle » : plus d'attente à l'ouverture, et « Rejouer » explique quand il ne peut rien rejouer.

- **Ouverture immédiate.** `/api/modele` recalculait tout le plan d'XP avant de répondre, même quand rien n'avait changé : 4,2 à 5,1 s mesurées sur un PC avec 75 cartes SSR+ (cauchemar3.json de 4,6 Mo), et le serveur ne répondait à rien d'autre pendant ce temps. Il rend maintenant l'historique tout de suite. Chaque instantané garde l'empreinte (date et taille) des fichiers de `resultats/` et de `poids.json` : tant qu'elle ne change pas, le plan n'est pas recalculé du tout, ni à l'ouverture ni à la fin d'une tâche qui n'écrit pas de résultat (par exemple « Mettre à jour le serveur »). Quand un résultat a changé, l'instantané est pris juste après la réponse et l'onglet se recharge seul quelques secondes plus tard.
- **Rejouer** : avec un seul instantané, le bouton est grisé et un texte dit que le rejeu marchera après le prochain calcul (avant, le clic ne faisait rien).
## 5.31.0

Base commune : ton IA passe devant l'IA commune pour la Campagne quand elle est nettement meilleure.

- Avec le partage allumé, le calcul Campagne tournait toujours avec l'IA commune, même quand ton IA était meilleure. Maintenant, si la dernière comparaison (`comparer-ia.mjs`, lancée après chaque entraînement sur le PC validateur) dit « nettement meilleure » pour ces deux IA-là (mêmes empreintes), le calcul prend ton IA et ne partage rien (ni réception ni envoi : ses résultats ne se recoupent pas avec la base).
- Dans tous les autres cas (pareille, moins bonne, pas de comparaison, ton IA ou l'IA commune changée depuis), l'IA commune reste en service et le partage marche comme avant.
- Le partage reprend dès que tu publies ton IA comme IA commune (Réglages, cadre validateur). Le journal du calcul et la ligne IA commune des Réglages le disent.

## 5.30.1

Campagne : le meilleur trio de chaque combat de Campagne est de nouveau cherché parmi **tous** les trios.

- Depuis la 5.27, la Campagne Normal, Difficile et Extrême n'est plus jouée par tous les trios pendant la course (seuls les finalistes du Cauchemar la jouent). Un trio écarté par le Cauchemar mais très fort sur un combat de Campagne précis n'avait donc sa chance que si ce combat était sous 60 %.
- Maintenant, chaque combat de Campagne qui n'est pas à 100 % de 3★ chez les candidats passe par les spécialistes : tous les trios le jouent seul (1 tirage, puis 2 de plus pour ceux qui font 3★, puis 6 de plus pour les 20 meilleurs). Cette recherche ne compte pas dans le budget des spécialistes, qui reste pour le Cauchemar. Le Cauchemar ne change pas : il était déjà joué par tous les trios.
- Coût : au plus ce que la course faisait avant la 5.27 sur la Campagne, et seulement sur les combats qui ne sont pas déjà à 100 %.

## 5.30.0

IA par trio : des réglages propres aux trios que tu joues vraiment en Cauchemar.

- **Trios du plan** (`entrainer.mjs --trios plan`, utilisé par « Entraînement par équipe » et « Mettre à jour l'IA ») : les trios du plan du calcul Campagne (`cauchemar3.json`), chacun entraîné sur **ses** combats Cauchemar (ceux que le plan lui donne et ceux dont il est le meilleur trio), aux niveaux du calcul ; complétés par d'autres combats Cauchemar Extrême s'il y en a moins de 40. Un combat sur deux du trio sert à l'entraînement, l'autre au contrôle. Sans calcul Campagne : les meilleures équipes de la dernière analyse, comme avant.
- **Gain confirmé avant d'être gardé** : les nouveaux réglages d'un trio sont rejoués contre les réglages généraux sur ses combats de contrôle avec 6 tirages jamais utilisés (mêmes combats, mêmes graines) ; gardés seulement si z ≥ 2. Avant : +0,5 point sur le contrôle suffisait, ce qui laissait passer du bruit.
- Essai (VM, plan du 17/11, 2 générations) : Cell / Mei Terumî / Kanki 1,3 % puis 8,8 % de 3★ sur 240 combats jamais joués (z = 4,4), gardé.

## 5.29.0

Le modèle vivant : un nouvel onglet (Analyses, « Le modèle ») pour voir ce que ton IA apprend, calcul après calcul.

- **La conquête** : une case par combat Cauchemar Normal, Difficile et Extrême, couleur selon la chance de 3★ du meilleur trio trouvé (or = sûr, orange = souvent, rouge = parfois, gris = jamais). À côté, la Tour (étage du meilleur trio déjà au 99, trait du meilleur possible), l'Arène (si le script privé est installé) et le Raid. Un curseur passe d'un instantané à l'autre, **Rejouer** les enchaîne en 3 secondes.
- **Le cerveau** : les cartes des meilleurs trios (Campagne, Tour, Raid, Arène en privé) sont des étoiles, reliées quand l'IA les joue ensemble ; la taille dit combien elle s'en sert. Clic sur une carte : avec qui elle joue et depuis quand.
- **Le journal de bord** : courbe du score modèle parfait et liste de ce qui a changé d'un calcul à l'autre (combats gagnés à 3★, étages, %, nouvelle IA).
- **L'ADN de l'IA** : les 76 réglages (4 situations × 19 critères) de chaque version gardée dans `data/poids-historique`, ceux qui ont changé entourés.
- **Tableau de bord** : une mini version (cerveau sans texte, score, courbe) qui mène à l'onglet.
- **Léger** : rien n'est simulé. Un instantané (~1 Ko, `data/modele-historique.json`, 400 au plus) est pris à la fin de chaque calcul et à l'ouverture de l'onglet, seulement si un résultat a changé ; il reprend le score du plan d'XP et les résultats déjà écrits (`lib/modele.mjs`). Dessin SVG fait une fois, aucune animation continue. L'historique commence à cette version : la courbe se trace à partir du prochain calcul.

## 5.28.0

Campagne : avec le script privé, le trio choisi par la recherche exacte passe devant (règle « public par défaut, privé quand il a une vraie réponse »).

- **Écran d'équipe** : `/equipes` (demande `conseil`) renvoie aussi `exact` quand l'extension locale a un trio pour ce combat (`EXT.trioExact`). Le script l'ajoute aux trios essayés et le choisit s'il fait au moins 50 % de 3★ avec le conseil exact et nettement mieux (+10 points) que ce que la simulation publique donne. Raison affichée : « calcul exact (script privé) », pastille « exact N % ». Calcul fait au niveau 99 : proposé seulement si les 3 cartes y sont déjà. Sans extension : rien ne change.
- **Page Campagne** : place `#c3Ext` et appel `window.campApres(j)` après chaque rendu, comme la page Tour (`#twExt`, `twApres`), pour une carte de l'extension locale.

## 5.27.0

Campagne : moins de combats pour les mêmes résultats (mesuré sur un petit test : 71 s au lieu de 122 s, mêmes % de 3★ partout).

- **La Campagne n'est jouée que par les finalistes.** Pendant la course, seuls les trois Cauchemar éliminent ; la Campagne Normal, Difficile et Extrême était pourtant jouée par tous les trios. Elle est maintenant jouée après la course, par les finalistes seulement, avec les mêmes tirages : résultats identiques pour eux, moitié moins de combats pour les trios écartés.
- **Les combats de la course ne sont plus rejoués.** La course joue déjà chaque trio sur chaque combat (tirage 1, et tirages 2 et 3 pour les finalistes). Elle garde maintenant l'étoile de chaque combat (1 octet par trio et par combat, ~13 Mo pour toute une collection), et l'étape « meilleur trio par combat » la reprend : candidats et première passe des spécialistes ne rejouent plus le même trio sur le même combat avec la même graine (le simulateur est déterministe, donc même résultat). Le journal garde aussi ces étoiles (`n,s3,etoiles`) : une reprise après coupure en profite. Les anciennes lignes du journal et celles de la base commune restent valables.
- Test avant / après (90 trios, 192 combats, mêmes réglages) : 71 s au lieu de 122 s (processeur : 125 s au lieu de 208 s, -40 %), étape par combat 31 s au lieu de 64 s, 21 580 combats repris de la course. Tous les % de 3★, le résumé et le plan sont identiques ; sur 2 combats sur 192, le meilleur trio affiché est un autre trio **au même %** (ordre des ex aequo).
- Base commune : format des lots inchangé.

## 5.26.0

Campagne : savoir pourquoi la 3e étoile saute, pour viser le bon remède (trios qui frappent plus fort, ou plus de protection).

- **Diagnostic** (`moteur/lib/diagnostic.mjs`) : sur chaque combat sous le seuil, jusqu'à 3 trios (son meilleur, celui du plan, les suivants, puis le meilleur trio de la difficulté pour les combats sans aucun 3★) rejouent 8 tirages jusqu'au bout, sans arrêt anticipé. Cause notée selon la règle du jeu (aucun K.O. et cycle 8 au plus) : **trop lent** (victoire sans K.O. mais après le cycle 8), **un K.O.**, **les deux**, **défaite**. Pour les combats trop lents : part des PV ennemis encore debout au début du cycle 9. Pour les K.O. : la carte qui tombe en premier.
- Fait tout seul à la fin du calcul Campagne (`--sans-diagnostic` pour l'éviter), avec la même IA que le calcul. Pour un résultat déjà calculé : bouton **Analyser** dans la carte « Meilleur trio par combat » (`diagnostic3.mjs`, un seul fil, 14 s mesurées sur 81 combats).
- Onglet Campagne : bloc « Pourquoi la 3★ saute » (4 tuiles par difficulté) et la cause sous le % de chaque combat dur.
- Premier résultat (calcul du 17/11, cartes au 99) : en Cauchemar, la 3e étoile saute surtout **au temps** (Normal 12 combats durs sur 16, Difficile 18 sur 31 et 9 de plus avec un K.O., Extrême 12 sur 29) ; il reste en médiane 16 à 29 % des PV ennemis au début du cycle 9. Presque jamais un K.O. seul.
- Tests : 20 (cause cohérente avec le simulateur).

## 5.25.0

IA commune : savoir quand la changer, et la publier d'un clic (PC validateur).

- **Comparaison** (`moteur/comparer-ia.mjs`) : ton IA contre l'IA commune en service, mêmes équipes (tes meilleures au 99), mêmes combats Cauchemar disputés, mêmes tirages. Test séquentiel par paires : on ajoute des tirages tant que l'écart n'est pas tranché (« nettement meilleure » : z ≥ 3 et au moins +0,5 point de 3 étoiles ; « moins bonne » : z ≤ -2 ; sinon « pas d'écart net » après 8 tours). Lancée toute seule à la fin d'un entraînement sur le PC validateur (`--sans-comparaison` pour l'éviter), ou par « Comparer ». Résultat : `resultats/comparaison-ia.json`.
- **Cadre validateur, ligne « IA commune »** : celle en service, le verdict de la dernière comparaison (marqué périmé si ton IA ou l'IA commune a changé depuis), et « Publier comme IA commune », en orange seulement si ton IA est nettement meilleure. La confirmation rappelle que les résultats partagés avec l'ancienne IA ne serviront plus.
- **IA commune distribuée par le serveur** : `GET /v1/ia`, publiée par `POST /v1/admin/ia` (jeton admin). Les calculs partagés la prennent au lancement (copie locale si pas d'internet) ; `poids-communs.json` livré avec l'appli sert tant qu'aucune n'est publiée. Le PC qui la lit la vérifie champ par champ (`lib/ia-commune.mjs`, rien n'est exécuté) et calcule la même empreinte que le PC qui l'a publiée.
- Serveur en version 4 (`migration-2.sql`, table `ia`) : « Mettre à jour le serveur » s'en charge. Tests du serveur et du client : 17.

## 5.24.2

- **« Mettre à jour le serveur » réparé** : lancé depuis le launcher, wrangler n'a pas de terminal et refuse la connexion faite dans le navigateur (`npx wrangler login`) ; il demandait `CLOUDFLARE_API_TOKEN` et la mise à jour s'arrêtait à la migration 1. Le cadre du PC validateur a maintenant une ligne « Jeton Cloudflare » (marche à suivre et lien) : le jeton est gardé dans `data/partage.json` (clé `cloudflare`), jamais affiché ni envoyé ailleurs qu'à Cloudflare, et passé à wrangler. Sans jeton, le bouton explique quoi faire au lieu d'échouer ; une erreur d'autorisation dit quelle permission manque.

## 5.24.1

- **Quand ça envoie, quand ça récupère** : le bloc Base commune de Campagne l'explique (seulement pendant un calcul Campagne que tu lances : récupération au début, envoi et contrôles à la fin) et montre les derniers échanges avec la base (récupéré, envoyé, en attente et pourquoi, contrôles, regroupements), tenus dans `data/partage-journal.json`.
- **« Joueurs » = IDs qui ont envoyé** : allumer un interrupteur ne compte pas encore. Une requête refusée (par exemple sans description) n'enregistre plus d'ID sur le serveur.
- Serveur en version 3 (`VERSION_SERVEUR`) : le cadre du PC validateur propose de le mettre à jour.

## 5.24.0

- **Bouton « Mettre à jour le serveur »** (Réglages, cadre du PC validateur, avec confirmation) : `moteur/partage-deployer.mjs` prend le code du serveur (dossier `partage/` du dépôt en mode développeur, sinon celui de la version installée téléchargé depuis GitHub dans un dossier temporaire), passe les migrations D1 qui manquent (retenues dans `data/partage.json`), déploie avec wrangler déjà connecté, vérifie le serveur en ligne puis efface le dossier temporaire. Réservé au PC qui a le jeton admin.
- **Version du serveur** : `VERSION_SERVEUR` (`lib/partage-format.mjs`, à monter à chaque changement de `partage/src`) est annoncée par `/v1/etat`. Le cadre validateur dit si le serveur en ligne est à jour ; le bouton n'est mis en avant que s'il est plus ancien que l'appli. Ce n'est donc pas une tâche régulière : seulement quand une version change le serveur.

## 5.23.0

Écran de la base commune dans le launcher (maquette validée le 18/11).

- **Réglages, carte « Base commune »** : interrupteurs « Utiliser la base commune », « Partager mes calculs » (grisé tant que « Aider à vérifier » est coupé) et « Aider à vérifier », ton ID, boutons « Changer d'ID », « Supprimer mes envois » et « Lire la notice ». Carte « Ce qui part, ce qui ne part jamais ». Sur le PC validateur seulement : « Contrôler la base » (40 contrôles et regroupement des lots à la fin des calculs ; coupé, ce PC fait 2 contrôles comme les autres).
- **Campagne, bloc « Base commune »** : résultats vérifiés et en attente, joueurs, ton apport et ton crédit, lots en attente d'envoi, résultats repris de la base au dernier calcul. Coupée, le bloc dit comment l'allumer.
- `/api/partage` donne aussi l'état public de la base et le nombre de lots en file ; réglage `partage.controler` (par défaut allumé).

## 5.22.2

Base commune plus légère, pour rester dans l'offre gratuite de Cloudflare (10 ms de calcul par requête) et télécharger moins.

- **Le serveur ne décompresse plus rien** : le PC qui envoie décrit son lot dans l'en-tête `X-Kitsu-Meta` (version, nombre de lignes, cartes présentes). Le PC contrôleur vérifie tout le lot (format, version, nombre de lignes, cartes) en plus des 24 lignes rejouées, et compte lui-même les écarts. Un lot qui ne correspond pas à sa description compte comme un lot truqué : l'ID est écarté. Un envoi prend environ 5 ms côté serveur au lieu de 46.
- **Liste des lots avec leurs cartes** : ton PC ne télécharge que les lots où tu as au moins 3 cartes.
- **Regroupement** : à la fin de ses calculs, le PC validateur fusionne les lots vérifiés d'un même ID en paquets d'environ 300 000 résultats (`GET /v1/admin/a-regrouper`, `POST /v1/admin/paquets`). Moins de fichiers à télécharger, liste plus courte.
- **Lecture directe** : les résultats reçus vont directement dans le journal au fil de la lecture (plus de grande liste en mémoire) ; les lots en cache qui ne sont plus dans la liste (regroupés, écartés, ancienne version) sont effacés.
- Mise à jour d'une base existante : `migration-1.sql` (colonne `cartes`). Tests du serveur et du client : 15 (`node partage/tests.mjs`).

## 5.22.1

- **Base commune sans carte bancaire** : les lots compressés sont rangés dans D1 (table `blocs`) au lieu de R2. R2 exige d'ajouter un moyen de paiement et facture au-delà de son quota gratuit ; D1 gratuit refuse simplement au-delà, sans rien facturer. Un lot envoyé fait au plus 1,9 Mo compressé (limite d'une ligne D1) ; en pratique, 20 000 résultats font environ 90 Ko. Les lots d'un ID écarté sont effacés pour libérer la place. Guide de mise en ligne raccourci (plus d'étape R2).
- **Serveur en ligne** : `https://kitsu-partage.kitsu-partage-whag.workers.dev` (adresse par défaut du moteur). Le partage reste coupé par défaut dans Réglages.

## 5.22.0

Base commune : partager les calculs Campagne entre joueurs, sans jamais croire personne sur parole. Coupée par défaut.

- **Principe** : le combat est déterministe à graine égale. Un résultat partagé (trio, étoiles, collectifs, paquet de combats, graine, nombre de 3 étoiles) peut donc être rejoué à l'identique par un autre PC. Ton calcul Campagne récupère les résultats déjà vérifiés pour TES cartes et ne simule que le reste.
- **IA commune** (`moteur/poids-communs.json`) : les calculs partagés jouent tous avec la même IA, sinon rien ne se recoupe. Ton IA perso reste la tienne pour tous tes conseils ; quand le partage est allumé, seul le calcul Campagne utilise l'IA commune.
- **Contrôles** : chaque lot envoyé est contrôlé sur 24 lignes tirées par le serveur après l'envoi. Au début, seul le PC validateur (jeton admin) peut faire passer un lot à « vérifié » ; un écart et TOUT le travail de l'ID est retiré. Un contrôleur qui conteste à tort est écarté. Les graines sont fixes (1 à 3) : impossible de ne garder que les tirages favorables.
- **Client** (`moteur/lib/partage.mjs`, `lib/partage-format.mjs`) : ID tiré au hasard sur le PC (`data/partage.json`, jamais lié au compte KITSU), file d'envoi sur le disque si pas d'internet, lots lus champ par champ (rien n'est exécuté), contrôles des autres à la fin de ton calcul (2 lots, quelques secondes). Rien n'est envoyé hors d'un calcul que tu lances.
- **Serveur** (`partage/`) : Cloudflare Worker + D1 + R2, offre gratuite uniquement (au-delà des quotas, la base refuse, rien n'est facturé). Quotas par ID et par jour, aucune adresse IP ni pseudo stockés, « Supprimer mes envois ». Tests sans Cloudflare : `node partage/tests.mjs` (11 tests), serveur d'essai `node partage/serveur-local.mjs`.
- **API du launcher** : `/api/partage` (état de mon ID), `/api/partage/supprimer`, `/api/partage/changer-id`. Les interrupteurs (`partage.utiliser`, `envoyer`, `verifier`) sont dans `reglages.json`. L'écran (Réglages et bloc « Base commune » de Campagne) viendra une fois la maquette validée.
- Le partage ne s'active qu'avec les réglages standard du calcul (paquets de 16, sans `--max-trios` ni `--max-combats`) ; `--sans-partage` le coupe pour un calcul.

## 5.21.0

Plan d'XP et de bannière unique : une seule liste pour toute ton XP et tes gemmes, qui pèse tous les modes selon l'objectif « modèle parfait » (3 étoiles partout en Campagne Cauchemar N/D/E, étage max en Tour, Arène à 100 %).

- **Score « modèle parfait » sur 100** : moyenne des modes, chacun en % de ce que ta collection peut faire au niveau 99. Campagne : combats Cauchemar N/D/E sûrs à 3 étoiles avec des trios déjà tout au 99 ; Tour et Raid : meilleur trio déjà au 99 contre le meilleur possible. Campagne, Tour (et Arène) pèsent 1, le Raid 1/2. Avec le script privé, sa part (Tour exacte, Arène) remplace ou complète la part publique ; sinon, le public seul.
- **Classement des montées** (`moteur/lib/plan.mjs`) : chaque carte (ou groupe de 2 ou 3 cartes qui ne servent qu'ensemble) à mettre au 99, notée en points gagnés pour 100 000 XP. Classement glouton : la suivante est comptée en supposant la précédente faite (un groupe ne recompte pas le gain d'une carte déjà proposée). Aucun combat simulé : tout vient des résultats déjà calculés, en quelques millisecondes. Avant, le plan d'XP ne regardait que des combats Cauchemar : une carte qui ne sert qu'en Tour (Shanks : +29 étages au 99) n'était jamais proposée.
- **Bannières ouvertes** notées de la même façon (verdict « Ça vaut tes gemmes » ou « Garde tes gemmes », pity, XP à prévoir derrière une carte neuve) et cartes « à guetter » (le script privé y met les doublons utiles en Arène).
- **Launcher** : bloc « Plan d'XP et bannière » en tête de Cartes et conseils (4 modes, prochaine carte à monter, classement, bannières). Les anciens onglets Plan d'XP et Tirage des conseils de cartes y sont remplacés. API `/api/plan`.
- **Script** : relit le plan du PC toutes les 10 minutes (`/plan`, lecture seule, ajouté au pont) ; les parchemins d'XP vont à la carte n°1 du plan, avec sa raison, et les équipes « pour l'XP » de la Campagne la font porter. Sans le launcher, le plan de la page reste comme avant. Il envoie aussi la pity de chaque bannière ouverte.
- **Calcul Campagne** (`lib/etages.mjs`) : chaque combat garde maintenant ses 6 meilleurs trios sûrs et le meilleur dont les cartes sont déjà au 99 (colonne `autres`). Le plan sait ainsi ce qu'une carte montée débloque vraiment. Avec un ancien résultat, les chiffres Campagne du plan sont approximatifs : relance le calcul Campagne.
- Tests : 2 de plus pour le plan, 1 pour `/plan`.

## 5.20.0

Raid « Le Destin Effacé » (Diavolo) : calcul du meilleur trio dans le launcher et conseil à chaque tour dans le script. De 1 à 3 joueurs.

- **Simulateur de raid** (`moteur/lib/raid.mjs`) : le raid complet joué avec le code du jeu (Cioccolata, Secco, Diavolo et ses 3 phases), réserve d'énergie par joueur, Ruptures, Garde, Réanimation. Stratégie de groupe : Ruptures choisies pour le groupe (les plus faibles rompent, les Ruptures déjà prévues par un partenaire comptent d'abord), Garde sur la carte visée, 2 Ruptures gardées pour « Seul le résultat demeure » quand la phase 3 approche. Mesuré : trio recopié aux 3 places, 0 raid gagné sur 20 en frappant seulement, 30 sur 30 avec la stratégie.
- **Calcul « Raid : meilleur trio »** (`moteur/raid.mjs`) : tous les trios de tes LR, UR et SSR (niveau 60 ou plus, ou tout au niveau 99) contre 3 niveaux de coéquipiers tirés au hasard (moyens, bons, forts), à 3 et à 2 joueurs, mêmes coéquipiers pour tous les trios. Finale des 10 meilleurs avec 3 fois plus de tirages et le rôle de chaque carte (dégâts, Rupture, soutien). Résultat : `resultats/raid.json`.
- **Onglet Raids du launcher** (il était « bientôt ») : bouton de calcul et progression, tuiles, onglets coéquipiers moyens, bons, forts et à 3 ou 2 joueurs, podium, rôle de chaque carte, « Pourquoi tu perds », les meilleurs trios, les 3 boss et ce qu'il faut faire, tes derniers raids lus par le script, méthode. Badge du menu et carte Raids au tableau de bord.
- **Conseil du script pendant le raid** (lecture seule, aucun clic) : dans le salon, le meilleur trio avec les vraies cartes de tes partenaires (ou des partenaires inconnus si le groupe n'est pas complet) ; à chaque tour, l'action de chacune de tes cartes avec sa raison (contour vert : Rupture ou Réanimer, orange : Garde, pointillé : attaque), qui rompt dans le groupe, et les chances de victoire avec et sans le conseil ; en fin de raid, le résultat et les conseils suivis, gardés pour l'onglet Raids. Le pont du script accepte `/raid` (réservé au script, comme `/sauvegarde`).
- Tests : 16 au lieu de 12 (même graine même raid, conseils acceptés par le jeu, coordination meilleure que frapper seulement, `/raid` réservé au script).

## 5.19.1

Tour de l'infini avec le script privé installé : le choix de la compo suit le trio de son calcul exact.

- Le script privé publie son trio de la Tour (`html[data-kar-tour]`, seulement les identifiants des cartes et l'étage visé). Sur l'écran de choix de la compo de la Tour, le script entoure alors les cartes à retirer puis à ajouter, puis « Lancer la montée », même s'il reste des combats au plan.
- Sans script privé, rien ne change : le trio vient toujours de la simulation faite dans la page.
- Tous les autres conseils (Campagne, plan, boutique, combat) restent ceux du script public.

## 5.19.0

Nouvelle direction artistique du script dans la page du jeu, alignée sur le launcher (maquette validée le 17/11). Mêmes conseils, mêmes calculs : seul l'habillage change.

- **Une couleur par source de conseil** : orange renard pour le script, bleu glacier pour le calcul exact du script privé, blanc pour le guide, vert et rouge pour tes cartes (ajouter, retirer, carte qui joue).
- **Panneau de combat** : le coup conseillé en grand (« LAME D'OMBRE → ZETSU »), pastilles (coup décisif, type et coût, ennemi qui charge), raison, puis le classement des coups avec une fine barre de chances. Le cadre **Calcul du PC** se place sous la raison ; quand il change le conseil, le coup affiché en grand suit (comme les contours).
- **Contours nets** : trait de 3 px et anneau sombre autour, au lieu du halo flou de 24 à 28 px (moins de surface à redessiner en plein combat). Le badge au-dessus de la cible devient une étiquette.
- **Dock** : en-tête renard, onglets soulignés (point vert = onglet utile), ligne de contexte et voyant du moteur du PC ; replié (Alt+K), il garde une ligne.
- **Plan du moment** : gemmes à prendre en grand, combats classés avec barre de 3 étoiles et équipe.
- **Guide** : contour blanc (pulse toujours 3 fois seulement) et pilule « Guide ».
- Avec le script privé : quand il donne un coup exact (Tour, Campagne, arène contre un fantôme), le panneau de combat se replie sur une ligne « Public · coup » avec **=** s'ils sont d'accord, **≠** sinon (clic sur la ligne : tout voir), et seuls ses contours bleus restent affichés.
- Coût machine : aucun flou, aucune animation continue, aucune image ni police téléchargée (titres en Bahnschrift, déjà dans Windows), styles regroupés dans une feuille au lieu d'être répétés dans chaque panneau.
- **Tableau de bord du launcher refait** avec les mêmes éléments que l’onglet Campagne : trois cartes de mode avec les portraits du trio et un seul chiffre (Campagne : combats gagnés à 3★ sur le total, un trio par combat, avec N / D / E ; Tour : étage, départage exact si le script privé l'a calculé ; Arène : % de victoires, seulement avec le privé), une liste « À faire » courte (sauvegarde ancienne, analyse à relancer, combats sans 3★) et le bouton. Disparus : l'équipe phare en 2★, les tuiles, le tableau des meilleures équipes et « Ce qui a changé » (toujours dans leurs onglets).
- **« Tout lancer » devient « Mettre à jour l'IA »** : mêmes étapes, nom plus juste (il n'inclut pas la Campagne 3★ ni la Tour, qui se lancent depuis leur onglet). L'écran affiche maintenant ses 6 étapes : l'entraînement de l'IA de la Tour manquait, ce qui décalait l'étape « en cours ».
- Badge Campagne du menu : combats à 3★ sur le total au lieu du % du meilleur trio.

## 5.18.0

Moins de lag pendant les calculs (YouTube et kitsu.games qui saccadaient), sans perte de vitesse de calcul.

- Calculs en priorité **inactive** (la plus basse de Windows) au lieu de « inférieure à la normale » : le navigateur, les vidéos et le jeu passent toujours devant. Avant, le calcul était au même niveau que les onglets d'arrière-plan du navigateur. Quand rien d'autre ne tourne, le calcul garde tout le processeur. Vaut pour tous les calculs lancés par le launcher (`serveur.mjs` à chaque lancement, `lib/pool.mjs` par défaut ; une priorité plus basse n'est jamais remontée).
- Le serveur (conseil en combat) reste en « inférieure à la normale » : pendant un calcul, ton conseil en combat passe maintenant devant lui.
- Launcher : pendant un calcul, ou quand sa fenêtre n'est pas au premier plan, plus d'effets animés (braises, reflets, clignotements) ni de flou. Mesuré le 17/11 : la fenêtre et sa carte graphique prenaient ~22 % du processeur pendant un calcul, en priorité normale et haute. Fenêtre cachée : plus de rafraîchissement ; pas au premier plan : toutes les 6 s au lieu de 1,5 s. Ce temps revient au calcul.
- Script : la sauvegarde du jeu, lue plusieurs fois par seconde par les conseils, n'est plus reparsée que si elle a changé.
- Le départage exact de la Tour suit aussi le réglage « fils réservés ».
- Moins de mémoire au repos (mesure du 17/11 : KitsuAI prenait ~1,1 Go de RAM et 205 Mo de mémoire vidéo sans rien calculer) :
  - le serveur ne garde plus 11 copies du moteur du jeu pour le conseil en combat : les fils sont créés au premier conseil et fermés après 3 min sans conseil (environ 95 Mo de moins par fil). Mêmes fils et mêmes paquets quand ils servent : conseils identiques ;
  - un second serveur lancé alors que KitsuAI tourne déjà (application + `KitsuAI.bat`) s'arrête tout de suite au lieu de rester en mémoire (~500 Mo) ;
  - le launcher n'utilise plus l'accélération graphique : plus de mémoire vidéo ni de processus graphique pour un panneau de texte et de graphiques (`KITSU_GPU=1` pour la remettre).
- Script : le worker de calcul (copie du moteur du jeu, ~100 Mo dans l'onglet) est fermé après 3 min sans calcul et recréé au besoin ; le contour du conseil clignote 3 fois puis reste fixe, au lieu de redessiner la page en continu.
- Script plus léger dans la page du jeu :
  - les objets du jeu (combat, écran d'équipe) sont retrouvés par leur nom retenu au lieu de parcourir tous les exports du jeu plusieurs fois par seconde ;
  - hors combat, le conseiller ne cherche un combat que toutes les 600 ms (au lieu de 150) et ne nettoie les contours qu'une fois, à la fin du combat ;
  - les accents ne sont corrigés qu'une fois par texte (avant : ~40 remplacements repassés sur tout le dock toutes les 400 ms) ;
  - le dock ne resérialise plus le HTML de ses panneaux à chaque tick, le guide lit les textes sans forcer de mise en page ;
  - onglet caché : dock, guide, conseiller, équipe, plan et invocations ne tournent plus (l'alerte d'énergie et la synchro continuent).
- Panneau : l'état (toutes les 1,5 s) ne réécrit plus que ce qui a changé ; le serveur ne relit plus sauvegarde, réglages, patchs et derniers résultats tant que leurs fichiers ne changent pas.

## 5.17.0

- Nouvelle page « Règles et effets » (Outils) : les 33 statuts (malus, bonus, protections) avec ce qu'ils font et leur valeur par défaut, les règles du combat (tour de jeu, énergie, endurance, formule des dégâts, critique, types, rupture, boss, étoiles), les 146 passifs et la progression. Tout est lu dans le moteur du jeu à chaque version (`lib/fiche.mjs`, `/api/fiche`) ; un statut inconnu est marqué « nouveau ».
- Entraînement de l'IA PvE : objectif 3 étoiles par défaut (`entrainer.mjs --objectif 3etoiles`, `2etoiles` pour l'ancien) ; les réglages sont gardés s'ils font plus de 3 étoiles sur les combats jamais vus.
- Conseils (collectifs, plan d'XP, tirage, duos, marché) : la note vise maintenant les 3 étoiles (3 étoiles + 2 étoiles / 4). Le plan d'XP donne aussi un nombre estimé de combats gagnés à 3 étoiles pour atteindre chaque niveau.
- Tour : le calcul garde aussi la suite du classement (`classementLarge`, 1 500 trios) pour le départage exact.
- Correction : la page Tour (et Campagne) ne rechargeait pas les résultats à la fin d'un calcul suivi en direct ; il fallait recharger le launcher.

## 5.16.0

- Campagne : meilleur trio **par combat** (nouvelle étape du calcul, `lib/etages.mjs`). La course classe les trios sur un score global et peut écarter tôt un trio qui serait le seul à faire 3 étoiles sur un combat. Désormais :
  - les 120 meilleurs trios de la course, les trios que le script essaie (tes 10 cartes les plus fortes) et ton équipe jouent chaque combat (2 tirages), puis les 8 meilleurs de chaque combat 6 tirages de plus ;
  - les combats sous 60 % de 3 étoiles sont cherchés sur TOUS les trios (Campagne d'abord, puis Cauchemar Normal, Difficile, Extrême), dans un budget de temps choisi au lancement (« Spécialistes par combat », 1 h par défaut) ; le journal garde chaque combat fini, la nuit suivante reprend ;
  - plan minimal : le moins de trios possible pour couvrir tous les combats, à un tirage près du meilleur.
- Page Campagne : carte « Meilleur trio par combat » (par difficulté : combats sûrs, comparaison avec le script, spécialistes, combats sans 3 étoiles, recherche restante et temps estimé), le plan, et chaque combat par monde avec filtres.
- Script : sur l'écran d'équipe, le trio du plan et le meilleur trio du combat (demandés au PC par `/equipes`) sont ajoutés aux trios essayés et rejoués à tes niveaux actuels (badge « calcul Campagne »).
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
