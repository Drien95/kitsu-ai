@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe : winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
node telecharger.mjs
echo.
echo Mode ? 1 = boss Cauchemar   2 = 3 ennemis Cauchemar   3 = boss Extreme
set /p M=Choix (1/2/3) : 
set MODE=boss
if "%M%"=="2" set MODE=nm3
if "%M%"=="3" set MODE=ext
node analyse.mjs --mode %MODE% %*
pause
