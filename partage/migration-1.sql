-- 5.22.2 : cartes presentes dans chaque lot (liste des lots filtree par le PC). A lancer une fois sur une base creee en 5.22.0 ou 5.22.1 :
--   npx wrangler@4 d1 execute kitsu-partage --remote --file migration-1.sql
ALTER TABLE lots ADD COLUMN cartes TEXT NOT NULL DEFAULT '';
