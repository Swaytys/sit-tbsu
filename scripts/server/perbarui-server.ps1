<#
  BonsaiUrip - memperbarui aplikasi di server toko ke versi terbaru (K-082).
  Jalankan sebagai Administrator dari folder aplikasi:
      powershell -ExecutionPolicy Bypass -File scripts\server\perbarui-server.ps1
  Urutan: cadangkan data -> hentikan server -> ambil kode terbaru (git pull) -> dependency -> build ->
  migrasi database -> nyalakan server. Data tidak dihapus; migrasi hanya menambah/mengubah struktur.
#>
#Requires -RunAsAdministrator
param([switch]$TanpaGitPull)
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$namaTugas = 'BonsaiUrip Server'
function Langkah([string]$teks) { Write-Host ''; Write-Host "== $teks ==" -ForegroundColor Cyan }

Langkah '1. Cadangan sebelum memperbarui'
if (Test-Path 'apps\api\dist\cadangan.js') {
  node 'apps\api\dist\cadangan.js' --alasan 'sebelum pembaruan'
  if ($LASTEXITCODE -ne 0) { throw 'Cadangan gagal; pembaruan dibatalkan agar data aman.' }
} else {
  Write-Host 'Modul cadangan belum ada di versi ini; langkah dilewati.'
}

Langkah '2. Menghentikan server'
Stop-ScheduledTask -TaskName $namaTugas -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*apps\api\dist\index.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

try {
  if (-not $TanpaGitPull) {
    Langkah '3. Mengambil kode terbaru'
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw 'git pull gagal (ada perubahan lokal?). Server dinyalakan lagi dengan versi lama.' }
  }
  Langkah '4. Dependency, build, migrasi'
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install gagal.' }
  pnpm build
  if ($LASTEXITCODE -ne 0) { throw 'Build gagal.' }
  pnpm db:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi gagal; pulihkan dari cadangan bila server tidak bisa menyala.' }
} finally {
  Langkah '5. Menyalakan server'
  Start-ScheduledTask -TaskName $namaTugas
}
Write-Host 'Pembaruan selesai.' -ForegroundColor Green
