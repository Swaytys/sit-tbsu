<#
  BonsaiUrip - memperbarui aplikasi di server toko ke versi terbaru (K-082, K-166).
  Jalankan sebagai Administrator dari folder aplikasi:
      powershell -ExecutionPolicy Bypass -File scripts\server\perbarui-server.ps1
  Urutan aman:
    1. hentikan server (tidak ada transaksi baru)   2. cadangan "sebelum pembaruan" (gagal = berhenti)
    3. ambil kode terbaru                           4. dependency + build
    5. uji migrasi pada SALINAN database            6. migrasi database asli
    7. nyalakan server + periksa versi & migrasi
  Bila langkah 3-6 gagal, kode dikembalikan ke versi sebelumnya dan server dinyalakan lagi dengan versi lama.
  Data tidak dihapus; migrasi hanya maju (tidak pernah diedit).
#>
#Requires -RunAsAdministrator
param([switch]$TanpaGitPull, [int]$Port = 3000)
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$namaTugas = 'BonsaiUrip Server'
function Langkah([string]$teks) { Write-Host ''; Write-Host "== $teks ==" -ForegroundColor Cyan }

function Nyalakan { Start-ScheduledTask -TaskName $namaTugas }

function Kembalikan([string]$sebelum, [string]$alasan) {
  Write-Host "GAGAL: $alasan" -ForegroundColor Red
  if ($sebelum) {
    Langkah 'Mengembalikan kode ke versi sebelumnya'
    git reset --keep $sebelum
    pnpm install --frozen-lockfile
    pnpm build
  }
  Langkah 'Menyalakan server (versi lama)'
  Nyalakan
  throw "Pembaruan dibatalkan: $alasan"
}

$sebelum = (git rev-parse HEAD).Trim()
$versiLama = ''
try { $versiLama = (Invoke-RestMethod "http://localhost:$Port/api/health" -TimeoutSec 5).data.versi } catch {}

Langkah '1. Menghentikan server'
Stop-ScheduledTask -TaskName $namaTugas -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*apps\api\dist\index.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Langkah '2. Cadangan sebelum memperbarui'
if (Test-Path 'apps\api\dist\cadangan.js') {
  node 'apps\api\dist\cadangan.js'
  if ($LASTEXITCODE -ne 0) { Kembalikan '' 'Cadangan gagal; data tidak disentuh.' }
} else {
  Write-Host 'Modul cadangan belum ada di versi ini; langkah dilewati.'
}

if (-not $TanpaGitPull) {
  Langkah '3. Mengambil kode terbaru'
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) { Kembalikan '' 'git pull gagal (ada perubahan lokal di server?).' }
}

Langkah '4. Dependency dan build'
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Kembalikan $sebelum 'pnpm install gagal.' }
pnpm build
if ($LASTEXITCODE -ne 0) { Kembalikan $sebelum 'Build gagal.' }

Langkah '5. Uji migrasi pada salinan database'
node 'apps\api\dist\uji-migrasi.js'
if ($LASTEXITCODE -ne 0) { Kembalikan $sebelum 'Uji migrasi pada salinan gagal; database asli tidak disentuh.' }

Langkah '6. Migrasi database'
pnpm db:migrate
if ($LASTEXITCODE -ne 0) {
  Kembalikan $sebelum 'Migrasi gagal. Bila server versi lama tidak bisa menyala, pulihkan cadangan langkah 2 (panduan server bagian 8).'
}

Langkah '7. Menyalakan server dan memeriksa'
Nyalakan
$sehat = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try { $sehat = (Invoke-RestMethod "http://localhost:$Port/api/health" -TimeoutSec 5).data; break } catch {}
}
if (-not $sehat) {
  Write-Host 'Server belum menjawab setelah 60 detik. Periksa log\server.log; bila rusak, pulihkan cadangan (bagian 8).' -ForegroundColor Red
  exit 1
}
if ($sehat.migrasi.terpasang -ne $sehat.migrasi.tersedia) {
  Write-Host "Peringatan: migrasi terpasang $($sehat.migrasi.terpasang) dari $($sehat.migrasi.tersedia)." -ForegroundColor Yellow
}
Write-Host "Pembaruan selesai: versi $versiLama -> $($sehat.versi), migrasi $($sehat.migrasi.terpasang)/$($sehat.migrasi.tersedia)." -ForegroundColor Green
