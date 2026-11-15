# Installation

## 1. L'application (Windows 10 ou 11)

1. Ouvre la [dernière release](https://github.com/Drien95/kitsu-ai/releases/latest) et télécharge `KitsuAI-Setup-X.Y.Z.exe`.
2. Lance-le. L'installateur n'est pas signé : Windows peut afficher « Windows a protégé votre ordinateur ». Clique sur **Informations complémentaires**, puis **Exécuter quand même**.
3. Choisis le dossier d'installation, puis **Installer**. Un raccourci est créé sur le bureau et dans le menu Démarrer.
4. Au premier lancement, KitsuAI télécharge le moteur du jeu (environ 20 Mo), démarre son serveur local et ouvre le panneau.

Rien d'autre à installer : Node.js est inclus dans l'application.

## 2. Le script du jeu (Tampermonkey)

1. Installe l'extension [Tampermonkey](https://www.tampermonkey.net/) dans ton navigateur.
2. Ouvre [kitsu_ai.user.js](https://github.com/Drien95/kitsu-ai/releases/latest/download/kitsu_ai.user.js) : Tampermonkey propose de l'installer.
3. Au premier conseil en combat, Tampermonkey demande l'accès à `127.0.0.1` : accepte (c'est ton propre PC, voir [[Sécurité et confidentialité|Securite-et-confidentialite]]).
4. Recharge kitsu.games. Le dock KitsuAI apparaît en bas à droite.

Le menu de l'icône KitsuAI (près de l'horloge) propose aussi « Installer le script Tampermonkey ».

## 3. Relier ta collection

1. Dans le jeu, dock KitsuAI, onglet **Santé**, bouton **Exporter pour le moteur local** : un fichier `sauvegarde.json` est téléchargé.
2. Glisse-le dans la zone « Ta sauvegarde » du panneau.
3. Lance une **Analyse complète**, puis un **Entraînement de l'IA**.

## Où sont mes données ?

| Données | Dossier |
|---|---|
| Application | Le dossier choisi à l'installation |
| Moteur du jeu, sauvegarde, réglages de l'IA, cache, résultats | `%APPDATA%\KitsuAI` |

Les mises à jour et la désinstallation ne touchent pas à `%APPDATA%\KitsuAI`.
