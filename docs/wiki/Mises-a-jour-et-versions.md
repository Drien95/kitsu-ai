# Mises à jour et versions

| Élément | Règle |
|---|---|
| Numéro de version | Un seul numéro pour l'application et le script : `// @version` du script |
| Tag et Release | Créés automatiquement à chaque nouvelle version fusionnée sur `main` (`vX.Y.Z`) |
| Contenu d'une Release | Notes du CHANGELOG, `KitsuAI-Setup-X.Y.Z.exe`, `latest.yml`, `kitsu_ai.user.js` |
| Application | Vérifie les releases au démarrage puis toutes les 6 h, télécharge en arrière-plan et propose de redémarrer |
| Script | Tampermonkey vérifie les mises à jour selon ses réglages ; réinstaller depuis la dernière release force la mise à jour |
| Moteur du jeu | Retéléchargé par l'application quand le jeu change de version |

Menu de l'icône KitsuAI : **Rechercher une mise à jour** pour vérifier tout de suite.
