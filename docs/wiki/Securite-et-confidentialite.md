# Sécurité et confidentialité

| Question | Réponse |
|---|---|
| Qu'est-ce qui sort de mon PC ? | Rien par défaut. Le serveur écoute uniquement sur `127.0.0.1` (ta machine). Seule exception, si tu l'allumes : le [[partage des calculs|Partage-des-calculs]] envoie tes résultats Campagne et un ID tiré au hasard. |
| Le panneau télécharge-t-il quelque chose ? | Les portraits des cartes, depuis les mêmes adresses que le jeu (AniList et kitsu.games), sans envoyer de donnée ni d'adresse d'origine. Ils ne sont ni copiés dans le dépôt ni dans l'installateur. Le moteur du jeu et les mises à jour viennent de kitsu.games et GitHub. |
| Que reçoit le serveur ? | L'état du combat en cours, envoyé par le script, et les actions lancées depuis le panneau. |
| Un autre site peut-il piloter KitsuAI ? | Non. Les actions du panneau exigent un jeton généré à chaque démarrage, présent uniquement dans la page du panneau, et les autres origines sont refusées. |
| Que peut faire le script via Tampermonkey ? | Le pont n'accepte que `/ping`, `/conseil`, `/poids`, `/equipes`, `/sauvegarde` et `/jeu`, seulement vers `127.0.0.1`, avec un en-tête propre au script (un autre site ne peut pas imiter ces envois). |
| Ma sauvegarde contient-elle mon jeton de connexion ? | Non : cartes, niveaux, étoiles, équipe, niveau du compte, boss de guilde et réglages de l'IA uniquement. |
| Le code du jeu est-il dans le dépôt ? | Non. Chaque installation télécharge le moteur du jeu depuis kitsu.games ; il reste sur le PC. |
| KitsuAI joue-t-il à ma place ? | Non. Aucun clic, aucune requête forgée, aucun contournement de la vérification anti-robot, arène désactivée. |

KitsuAI est un outil non officiel, sans lien avec les éditeurs de KITSU. Vérifie les conditions d'utilisation du jeu.
