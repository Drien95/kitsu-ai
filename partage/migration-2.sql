-- 5.25.0 : IA commune distribuee par la base (publiee par le PC validateur). A lancer une fois sur une base creee avant 5.25.0
-- (le bouton « Mettre a jour le serveur » du launcher le fait tout seul).
CREATE TABLE IF NOT EXISTS ia (id INTEGER PRIMARY KEY, data TEXT NOT NULL, t INTEGER NOT NULL);
