# Changelog KitsuAI

Les versions les plus récentes en premier. Les versions 1.x à 3.x sont résumées (détail non conservé).

---

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
