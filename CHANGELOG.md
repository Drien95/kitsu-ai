# Changelog KitsuAI

Les versions les plus récentes en premier. Les versions 1.x à 3.x sont résumées (détail non conservé).

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
