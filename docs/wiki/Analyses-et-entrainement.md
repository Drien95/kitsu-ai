# Analyses et entraînement

## Règle des étoiles (lue dans le code du jeu)

Étoiles = 3 moins le nombre de K.O., avec un minimum de 1, et plafonnées à 2 si le combat dépasse le cycle 8.

| Résultat | Étoiles |
|---|---|
| Victoire sans K.O., cycle 8 ou moins | 3 |
| Victoire sans K.O. après le cycle 8, ou avec 1 K.O. | 2 |
| Victoire avec 2 K.O. | 1 |

L'objectif des analyses est **2 étoiles minimum** (victoire avec au plus 1 K.O., quel que soit le cycle), départagé par les 3 étoiles.

## Analyse complète

Tes LR, UR et SSR, à tes niveaux actuels puis au niveau 99 :

| Catégorie | Combats |
|---|---|
| Campagne | Tous les combats, en Extrême |
| Boss | Tous les boss, en Extrême |
| Cauchemar | Tous les combats en Cauchemar Extrême |
| Cauchemar, plusieurs ennemis | 2 ennemis ou plus |
| Cauchemar, boss | Boss en Cauchemar Extrême |
| Événements | Événements ouverts et Salle de l'Esprit et du Temps |
| Tour de l'infini | Montée complète, PV gardés entre les étages |
| Boss de guilde | Dégâts plafonnés à 300 000 (si exporté avec la sauvegarde) |

### Pourquoi c'est rapide

| Technique | Effet |
|---|---|
| Multithread | Un fil par coeur logique moins un, en priorité basse |
| Arrêt dès 2 K.O. | x1,6 à x2, résultats identiques (2 étoiles devenues impossibles) |
| Élimination adaptative | Un trio est abandonné dès que sa borne haute passe sous la borne basse du 10e meilleur |
| Mêmes combats et tirages pour tous | Les écarts mesurés viennent des équipes, pas du hasard |
| Cache disque | Un calcul déjà fait n'est jamais refait (vidé à chaque version du jeu) |
| Choix des cartes | Chaque carte testée seule puis avec les deux meilleures, pour ne pas écarter les soutiens |

## Entraînement de l'IA

L'IA note chaque action avec 19 critères (dégâts prévus, ennemi qui charge, PV bas, ultime prêt, etc.). L'entraînement ajuste ces critères par entropie croisée, avec paires opposées pour réduire le bruit :

- équipes : les meilleures de la dernière analyse complète ;
- combats : ceux où l'IA actuelle ne fait pas 3 étoiles à coup sûr ;
- contrôle : chaque amélioration est vérifiée sur des combats non utilisés pour apprendre.

Les nouveaux réglages (`poids.json`) sont récupérés par le script du jeu dans la minute ; plan et équipes sont recalculés.
