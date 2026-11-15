@echo off
rem KitsuAI : ouvre le panneau local (serveur du conseil en combat, analyses, entrainement, resultats).
cd /d "%~dp0moteur"
where node >nul 2>nul || (echo Node.js n'est pas installe : winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
title KitsuAI - panneau local
node telecharger.mjs
node serveur.mjs --ouvrir
pause
