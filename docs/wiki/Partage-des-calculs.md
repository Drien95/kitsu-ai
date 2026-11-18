# Partage des calculs (base commune)

Coupé par défaut. Quand tu l'allumes, ton calcul Campagne récupère les résultats déjà calculés et **vérifiés** par d'autres joueurs pour tes cartes, et ne simule que ce qui manque.

## Comment on évite les faux résultats

| Mécanisme | Effet |
|---|---|
| Combat déterministe | Un résultat (trio, étoiles, collectifs, combats, graine) rejoué sur un autre PC donne exactement le même nombre de 3 étoiles. |
| Contrôle après l'envoi | Le serveur tire 24 lignes au hasard dans chaque lot et les fait rejouer. L'envoyeur ne sait pas lesquelles à l'avance. Le PC contrôleur vérifie aussi que tout le lot correspond à ce qu'annonçait l'envoyeur (nombre de résultats, cartes). |
| PC validateur | Au début, seul le PC du mainteneur peut faire passer un lot à « vérifié ». |
| Sanction | Un seul écart : tous les lots de cet ID sont retirés, et l'ID ne peut plus rien envoyer. |
| Graines fixes | Les tirages sont toujours 1, 2 et 3 : impossible de ne garder que ceux qui arrangent. |
| Version | Chaque résultat porte l'empreinte du moteur du jeu et de l'IA : rien ne se mélange entre versions. |

## Ce que ton PC télécharge

La liste des lots donne les cartes de chaque lot : ton PC ne télécharge que ceux où tu as au moins 3 cartes, puis ne garde que les trios faits de tes cartes (mêmes étoiles, collectifs et niveau). Les lots vérifiés sont regroupés en gros paquets pour limiter les téléchargements.

## IA commune

Les calculs partagés jouent tous avec la même IA (`moteur/poids-communs.json`, publiée avec la version). Ton IA à toi reste la tienne pour tous tes conseils. Une nouvelle IA commune n'est publiée que si elle bat nettement l'ancienne.

## Notice (données personnelles)

| Question | Réponse |
|---|---|
| Qui | Le projet KitsuAI (contact : voir la page d'accueil du dépôt). |
| Quoi | Un ID tiré au hasard sur ton PC (jamais ton pseudo ni ton ID KITSU) et, pour chaque trio calculé : les 3 cartes, leurs étoiles, collectifs et niveau utilisé, les combats, les graines et le nombre de 3 étoiles. |
| Jamais | Ton pseudo, ta sauvegarde, ton inventaire complet, tes heures de jeu, rien du script privé. Ton adresse IP passe par le serveur mais n'est pas gardée. |
| Pourquoi | Éviter que chacun recalcule la même chose, et repérer les faux résultats (intérêt légitime). |
| Combien de temps | Tant que la version du jeu et l'IA commune sont les mêmes, puis 3 mois au plus. |
| Où | Cloudflare (hébergeur), qui peut traiter les données hors de l'Union européenne dans un cadre encadré. |
| Tes droits | Couper le partage à tout moment (Réglages). « Supprimer mes envois » efface tout ce qui est lié à ton ID. « Changer d'ID » repart de zéro. |
| Moins de 15 ans | Demande à un parent avant d'activer le partage. |
