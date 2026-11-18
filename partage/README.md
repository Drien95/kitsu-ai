# Serveur de la base commune

Cloudflare Worker (offre **gratuite** seulement) : D1 pour l'index, R2 pour les lots. Il ne rejoue jamais un combat : le moteur du jeu n'est jamais sur un serveur, les contrôles sont faits par les PC.

## Mise en ligne (une fois)

| Étape | Commande ou action |
|---|---|
| 1 | Créer un compte Cloudflare, activer la double authentification. Ne jamais ajouter de moyen de paiement. |
| 2 | `cd partage` puis `npx wrangler login` |
| 3 | `npx wrangler d1 create kitsu-partage` et copier l'`database_id` affiché dans `wrangler.toml` |
| 4 | `npx wrangler d1 execute kitsu-partage --remote --file schema.sql` |
| 5 | `npx wrangler r2 bucket create kitsu-partage-lots` (R2 demande parfois d'activer l'offre gratuite dans le tableau de bord) |
| 6 | `npx wrangler secret put ADMIN_JETON` : un long mot de passe tiré au hasard, gardé sur le PC validateur seulement |
| 7 | `npx wrangler deploy` : affiche l'adresse `https://kitsu-partage.<sous-domaine>.workers.dev` |
| 8 | Mettre cette adresse dans `URL_DEFAUT` de `moteur/lib/partage.mjs` (nouvelle version) |
| 9 | Sur le PC validateur : ajouter `"admin": "<le jeton>"` dans `%APPDATA%\KitsuAI\data\partage.json` |
| 10 | Tableau de bord Cloudflare, Sécurité, WAF : une règle de limite de débit (gratuite) sur `/v1/`, par exemple 60 requêtes par minute et par IP. |

## Essai sans Cloudflare

`node partage/tests.mjs` (11 tests) et `node partage/serveur-local.mjs 47200` (base en mémoire), puis `KITSU_PARTAGE_URL=http://127.0.0.1:47200` pour le moteur, et `--partage-test` pour autoriser un petit calcul (`--max-trios`) à partager.

## Quotas (dans `wrangler.toml`)

| Réglage | Défaut | Rôle |
|---|---|---|
| `LOTS_PAR_JOUR_NOUVEAU` | 6 | lots par jour pour un ID sans lot vérifié |
| `LOTS_PAR_JOUR` | 80 | lots par jour ensuite (un calcul complet fait environ 25 lots) |
| `LOTS_PAR_JOUR_TOTAL` | 4000 | toute la base, sous le quota gratuit de 100 000 écritures D1 par jour |
| `VERIF_ADMIN_SEULE` | true | seul le PC validateur fait passer un lot à « vérifié » |
