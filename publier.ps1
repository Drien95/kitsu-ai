# Publie le contenu de ce dossier sur https://github.com/Drien95/kitsu-ai
# Double-clic (ou clic droit > Executer avec PowerShell). Utilise ton git et ton compte GitHub de Windows.
Set-Location -Path $PSScriptRoot
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "git n'est pas installe : https://git-scm.com/download/win" -ForegroundColor Red; Read-Host "Entree pour fermer"; exit 1 }
if (-not (Test-Path .git)) {
  git init -b main | Out-Null
  git remote add origin https://github.com/Drien95/kitsu-ai.git
  git fetch origin 2>$null
  if ($LASTEXITCODE -eq 0 -and (git ls-remote --heads origin main)) { git reset --soft origin/main 2>$null }
}
$msg = if (Test-Path .commitmsg) { Get-Content .commitmsg -Raw } else { "Mise a jour KitsuAI" }
git add -A
git commit -m $msg
git push -u origin main
if ($LASTEXITCODE -eq 0) { Write-Host "`nPublie sur GitHub." -ForegroundColor Green } else { Write-Host "`nEchec de l'envoi (voir le message ci-dessus)." -ForegroundColor Red }
Read-Host "Entree pour fermer"
