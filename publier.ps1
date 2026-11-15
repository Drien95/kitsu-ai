# Publie le contenu de ce dossier sur https://github.com/Drien95/kitsu-ai par une branche + Pull Request.
# main est protegee : on ne pousse jamais directement dessus.
# Nom de branche : fichier .branch (ex. feat/guide-guilde, fix/bouton-combattre, docs/readme, chore/maj).
# Message de commit : fichier .commitmsg. Les deux fichiers restent locaux (.gitignore).
Set-Location -Path $PSScriptRoot
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "git n'est pas installe : https://git-scm.com/download/win" -ForegroundColor Red; Read-Host "Entree pour fermer"; exit 1 }
$repo = "https://github.com/Drien95/kitsu-ai"
$branch = if (Test-Path .branch) { (Get-Content .branch -Raw).Trim() } else { "chore/maj-" + (Get-Date -Format 'yyyyMMdd-HHmm') }
if ($branch -eq 'main') { Write-Host "Interdit : main est protegee, choisis une branche feat/, fix/, docs/ ou chore/." -ForegroundColor Red; Read-Host "Entree pour fermer"; exit 1 }
$msg = if (Test-Path .commitmsg) { Get-Content .commitmsg -Raw } else { "Mise a jour KitsuAI" }
git fetch --prune --tags origin
$cur = (git rev-parse --abbrev-ref HEAD).Trim()
# Branche deja fusionnee (supprimee sur GitHub) : on repart de la derniere version de main.
$remote = git ls-remote --heads origin $branch
if ($cur -ne $branch -or -not $remote) {
  # Nouvelle branche partant de la derniere version de main, avec le contenu actuel du dossier.
  $tmp = Join-Path $env:TEMP "kitsu-ai-publier"
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  robocopy . $tmp /E /XD .git /NFL /NDL /NJH /NJS /NP | Out-Null
  git checkout -f -B $branch origin/main
  robocopy $tmp . /E /XD .git /NFL /NDL /NJH /NJS /NP | Out-Null
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
# Version deja publiee ? Sans nouveau numero, aucune mise a jour ne sera proposee (et la verification GitHub refusera).
$ver = ((Select-String -Path kitsu_ai.user.js -Pattern '@version\s+(\S+)' | Select-Object -First 1).Matches[0].Groups[1].Value)
if (git tag -l "v$ver") {
  $code = git diff --name-only "v$ver" -- . ':!docs' ':!README.md' ':!CHANGELOG.md' ':!.github'
  if ($code) { Write-Host "`nAttention : la version $ver est deja publiee et le code a change. Monte la version, sinon aucune mise a jour ne sera proposee." -ForegroundColor Yellow; if ((Read-Host "Envoyer quand meme ? (o/N)") -ne 'o') { exit 1 } }
}
git add -A
git commit -m $msg
git push -u origin $branch
if ($LASTEXITCODE -eq 0) {
  Write-Host "`nBranche $branch envoyee. La page de la Pull Request s'ouvre : clique sur Create pull request, attends le test vert, puis Merge." -ForegroundColor Green
  Start-Process "$repo/compare/main...$($branch)?expand=1"
} else { Write-Host "`nEchec de l'envoi (voir le message ci-dessus)." -ForegroundColor Red }
Read-Host "Entree pour fermer"
