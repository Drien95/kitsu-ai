@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe : winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
node telecharger.mjs
node tout.mjs %*
pause
