@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe. Installe-le avec : winget install OpenJS.NodeJS.LTS & echo puis relance ce fichier. & pause & exit /b 1)
node telecharger.mjs
pause
