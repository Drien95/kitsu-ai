# Changelog KitsuAI

Les versions les plus récentes en premier. Les versions 1.x à 3.x sont résumées (détail non conservé).

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
