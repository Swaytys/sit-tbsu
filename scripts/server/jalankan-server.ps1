<#
  BonsaiUrip - penjaga server (K-082). Dijalankan Task Scheduler "BonsaiUrip Server" saat komputer menyala.
  Menjalankan server produksi; bila server berhenti karena galat, dinyalakan ulang 10 detik kemudian.
  Log aplikasi: log\server.log (LOG_FILE di .env); catatan penjaga & galat fatal: log\penjaga.log.
#>
param([string]$Node = 'node')
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$log = Join-Path $repo 'log'
New-Item -ItemType Directory -Force -Path $log | Out-Null
Set-Location $repo

while ($true) {
  Add-Content -Path (Join-Path $log 'penjaga.log') -Value "$(Get-Date -Format s) server dinyalakan"
  & $Node 'apps\api\dist\index.js' 2>> (Join-Path $log 'penjaga.log')
  Add-Content -Path (Join-Path $log 'penjaga.log') -Value "$(Get-Date -Format s) server berhenti (kode $LASTEXITCODE); dinyalakan ulang dalam 10 detik"
  Start-Sleep -Seconds 10
}
