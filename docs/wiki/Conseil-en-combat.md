# Conseil en combat

Pendant un combat, le panneau orange du script propose une action. Le coup conseillé s'affiche en grand, avec une étiquette au-dessus de la cible. Quand l'application tourne, un cadre vert **Calcul du PC** s'ajoute sous la raison.

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

## Raid « Le Destin Effacé »

Pendant un raid (1 à 3 joueurs), le script lit l'état du combat affiché par la page et l'envoie au PC. Le PC répond avec l'action de chacune de tes cartes : **Rupture** quand le boss annonce un coup à interrompre (le groupe en réunit juste assez, les Ruptures déjà prévues par tes partenaires comptent d'abord), **Garde** pour la carte visée, **Réanimer** si une carte est tombée, sinon la meilleure attaque. Il joue aussi la suite du raid quelques fois pour donner tes chances de victoire avec et sans le conseil. Le script ne clique jamais.
