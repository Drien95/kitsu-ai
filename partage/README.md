# Serveur de la base commune

Cloudflare Worker (offre **gratuite** seulement) : tout est dans D1 (index et lots compressés). **Aucun moyen de paiement** : ne jamais ajouter de carte ni d'abonnement (R2 en demande une, c'est pour ça qu'on ne l'utilise pas). Il ne rejoue jamais un combat : le moteur du jeu n'est jamais sur un serveur, les contrôles sont faits par les PC.

Adresse actuelle : `https://kitsu-partage.kitsu-partage-whag.workers.dev` (base D1 `kitsu-partage`).

Pour mettre à jour le serveur après une modification de `partage/` : `cd partage` puis `npx wrangler@4 deploy` (et `npx wrangler@4 d1 execute kitsu-partage --remote --file schema.sql` si le schéma change).

## Mise en ligne (une fois)

| Étape | Commande ou action |
|---|---|
| 1 | Créer un compte Cloudflare, activer la double authentification. Ne jamais ajouter de moyen de paiement. |
| 2 | `cd partage` puis `npx wrangler login` |
| 3 | `npx wrangler d1 create kitsu-partage` et copier l'`database_id` affiché dans `wrangler.toml` |
| 4 | `npx wrangler d1 execute kitsu-partage --remote --file schema.sql` |
| 5 | `npx wrangler secret put ADMIN_JETON` : un long mot de passe tiré au hasard, gardé sur le PC validateur seulement |
| 6 | `npx wrangler deploy` : affiche l'adresse `https://kitsu-partage.<sous-domaine>.workers.dev` |
| 7 | Mettre cette adresse dans `URL_DEFAUT` de `moteur/lib/partage.mjs` (nouvelle version) |
| 8 | Sur le PC validateur : ajouter `"admin": "<le jeton>"` dans `%APPDATA%\KitsuAI\data\partage.json` |
| 9 | Tableau de bord Cloudflare, Sécurité, WAF : une règle de limite de débit (gratuite) sur `/v1/`, par exemple 60 requêtes par minute et par IP. |

## Place

Un lot de 20 000 résultats fait environ 90 Ko compressé, un calcul complet environ 25 lots. Une base D1 gratuite (500 Mo) tient donc environ 5 000 lots, soit 200 calculs complets. Les lots d'un ID écarté sont effacés. Au-delà, une 2e base D1 gratuite (10 par compte).

## Essai sans Cloudflare

`node partage/tests.mjs` (11 tests) et `node partage/serveur-local.mjs 47200` (base en mémoire), puis `KITSU_PARTAGE_URL=http://127.0.0.1:47200` pour le moteur, et `--partage-test` pour autoriser un petit calcul (`--max-trios`) à partager.

## Quotas (dans `wrangler.toml`)

| Réglage | Défaut | Rôle |
|---|---|---|
| `LOTS_PAR_JOUR_NOUVEAU` | 6 | lots par jour pour un ID sans lot vérifié |
| `LOTS_PAR_JOUR` | 80 | lots par jour ensuite (un calcul complet fait environ 25 lots) |
| `LOTS_PAR_JOUR_TOTAL` | 4000 | toute la base, sous le quota gratuit de 100 000 écritures D1 par jour |
| `VERIF_ADMIN_SEULE` | true | seul le PC validateur fait passer un lot à « vérifié » |
