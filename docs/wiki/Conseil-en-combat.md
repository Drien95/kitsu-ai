# Conseil en combat

Pendant un combat, le panneau orange du script propose une action. Quand l'application tourne, un cadre vert **Calcul du PC** s'ajoute en haut du panneau.

## Comment le PC choisit

1. Le script envoie l'état exact du combat (PV, énergie, effets en cours, cycle) au serveur local.
2. Pour chaque action possible, le PC simule la suite du combat de nombreuses fois avec le vrai moteur du jeu, réparties sur tous ses coeurs.
3. Les actions nettement moins bonnes sont abandonnées en cours de route ; les autres reçoivent plus de simulations.
4. Le PC renvoie l'action qui donne le plus souvent **2 étoiles ou plus**, puis **3 étoiles**, puis la victoire. Environ 0,7 s par coup.

Le cadre indique si le calcul du PC **confirme** ou **change** le conseil du script, avec les chances de 2 et 3 étoiles. La mise en évidence (contours) suit l'action du PC.

## Ce que ça apporte

Mesure sur des combats de Cauchemar disputés (20 parties, marge d'environ 10 points) :

| Combats | IA de base, 2+ étoiles | Anticipation poussée, 2+ étoiles | IA de base, 3 étoiles | Anticipation, 3 étoiles |
|---|---|---|---|---|
| 2 ennemis ou plus | 65 % | 85 % | 5 % | 25 % |
| Boss | 40 % | 50 % | 5 % | 15 % |

Sans l'application, le script garde son conseil habituel (simulation rapide dans le navigateur).
