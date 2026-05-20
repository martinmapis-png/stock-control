# Conecta el proyecto a GitHub y Vercel (ejecutar una vez tras `gh auth login`)
$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\bin;C:\Program Files\GitHub CLI;" + $env:Path

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Primero inicia sesion en GitHub:" -ForegroundColor Yellow
  gh auth login -h github.com -p https -w --skip-ssh-key
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Write-Host "Creando repositorio stock-control en GitHub..." -ForegroundColor Cyan
  gh repo create stock-control --public --source=. --remote=origin --push
} else {
  Write-Host "Remote existente: $remote" -ForegroundColor Gray
  git push -u origin master
  if ($LASTEXITCODE -ne 0) { git push -u origin main }
}

Write-Host "Conectando Vercel al repositorio..." -ForegroundColor Cyan
$repoUrl = (gh repo view --json url -q .url)
vercel git connect $repoUrl

Write-Host ""
Write-Host "Listo. Cada push a GitHub desplegara automaticamente en Vercel." -ForegroundColor Green
Write-Host "App: https://stock-control-beta.vercel.app"
