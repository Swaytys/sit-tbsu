<#
  BonsaiUrip - MEMULIHKAN data dari cadangan (K-084). Hanya untuk keadaan darurat: database rusak, komputer
  server diganti, atau data terhapus. Isi database SEKARANG akan DIGANTI dengan isi cadangan yang dipilih.

  Jalankan sebagai Administrator dari folder aplikasi (server boleh menyala; skrip menghentikannya):
      powershell -ExecutionPolicy Bypass -File scripts\server\pulihkan.ps1                 (snapshot terbaru)
      powershell -ExecutionPolicy Bypass -File scripts\server\pulihkan.ps1 -Snapshot 1a2b3c4d
      powershell -ExecutionPolicy Bypass -File scripts\server\pulihkan.ps1 -DariCloud      (repositori cloud)

  Pengaman: sebelum mengganti, isi database sekarang disimpan dulu ke folder pulih\ (pg_dump), dan Anda harus
  mengetik PULIHKAN untuk melanjutkan. Panduan: docs/panduan/fase-8-pasang-server.md bagian Pemulihan.
#>
#Requires -RunAsAdministrator
param(
  [string]$Snapshot = 'latest',
  [switch]$DariCloud,
  [switch]$TanpaGambar
)
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$namaTugas = 'BonsaiUrip Server'
function Langkah([string]$teks) { Write-Host ''; Write-Host "== $teks ==" -ForegroundColor Cyan }

# --- Baca .env ---
$nilai = @{}
foreach ($baris in Get-Content (Join-Path $repo '.env')) {
  if ($baris -match '^\s*([A-Z_]+)=(.*)$') { $nilai[$Matches[1]] = $Matches[2].Trim() }
}
$repoRestic = if ($DariCloud) { $nilai['CADANGAN_REPO_CLOUD'] } else { $nilai['CADANGAN_REPO_LOKAL'] }
if (-not $repoRestic) { throw 'Repositori cadangan belum diatur di .env (CADANGAN_REPO_LOKAL / CADANGAN_REPO_CLOUD).' }
if (-not $nilai['CADANGAN_SANDI']) { throw 'CADANGAN_SANDI belum diisi di .env.' }
$restic = if ($nilai['CADANGAN_RESTIC']) { $nilai['CADANGAN_RESTIC'] } else { 'restic' }
$pgBin = $nilai['CADANGAN_PG_BIN']
$pgRestore = if ($pgBin) { Join-Path $pgBin 'pg_restore.exe' } else { 'pg_restore' }
$pgDump = if ($pgBin) { Join-Path $pgBin 'pg_dump.exe' } else { 'pg_dump' }
$url = [uri]$nilai['DATABASE_URL']
$userInfo = $url.UserInfo.Split(':', 2)
$dbUser = [uri]::UnescapeDataString($userInfo[0])
$env:PGPASSWORD = [uri]::UnescapeDataString($userInfo[1])
$dbHost = $url.Host
$dbPort = if ($url.Port -gt 0) { $url.Port } else { 5432 }
$dbNama = $url.AbsolutePath.TrimStart('/')
$storage = if ($nilai['STORAGE_DIR']) { $nilai['STORAGE_DIR'] } else { Join-Path $repo 'storage' }
$env:RESTIC_PASSWORD = $nilai['CADANGAN_SANDI']
$opsiRclone = @()
if ($nilai['CADANGAN_RCLONE']) { $opsiRclone = @('-o', "rclone.program=$($nilai['CADANGAN_RCLONE'])") }

Langkah "Snapshot di $repoRestic"
& $restic -r $repoRestic @opsiRclone snapshots --tag bonsaiurip
if ($LASTEXITCODE -ne 0) { throw 'Tidak bisa membaca repositori cadangan (periksa lokasi & kata sandi).' }

Write-Host ''
Write-Host "Yang akan dipulihkan: snapshot '$Snapshot' ke database '$dbNama'" -ForegroundColor Yellow
if (-not $TanpaGambar) { Write-Host "dan folder gambar/logo: $storage" -ForegroundColor Yellow }
Write-Host 'Semua transaksi SETELAH waktu snapshot itu akan hilang dari database.' -ForegroundColor Yellow
$ketik = Read-Host 'Ketik PULIHKAN untuk melanjutkan (lainnya = batal)'
if ($ketik -ne 'PULIHKAN') { Write-Host 'Dibatalkan.'; exit 0 }

$waktu = Get-Date -Format 'yyyyMMdd-HHmmss'
$kerja = Join-Path $repo "pulih\$waktu"
New-Item -ItemType Directory -Force -Path $kerja | Out-Null

Langkah '1. Menghentikan server'
Stop-ScheduledTask -TaskName $namaTugas -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*apps\api\dist\index.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

try {
  Langkah '2. Menyimpan isi database sekarang (pengaman)'
  & $pgDump -h $dbHost -p $dbPort -U $dbUser --format=custom --file (Join-Path $kerja 'sebelum-pulih.dump') $dbNama
  if ($LASTEXITCODE -ne 0) { throw 'Gagal menyimpan database sekarang; pemulihan dibatalkan.' }

  Langkah '3. Mengambil cadangan'
  $info = (& $restic -r $repoRestic @opsiRclone snapshots --json --tag bonsaiurip $Snapshot) | ConvertFrom-Json
  $snap = @($info)[-1]
  if (-not $snap) { throw "Snapshot '$Snapshot' tidak ditemukan." }
  # Path di dalam snapshot restic: C:\a\b -> /C/a/b
  function DalamSnapshot([string]$p) {
    $p = $p.Replace('\', '/')
    if ($p -match '^[A-Za-z]:/') { return '/' + $p.Substring(0, 1) + $p.Substring(2) }
    return $p
  }
  $pathDump = @($snap.paths) | Where-Object { $_ -like '*.dump' } | Select-Object -First 1
  if (-not $pathDump) { throw 'Snapshot tidak berisi berkas dump database.' }
  $dump = Join-Path $kerja 'cadangan.dump'
  & $restic -r $repoRestic @opsiRclone dump --target $dump $snap.short_id (DalamSnapshot $pathDump)
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dump)) { throw 'Gagal mengambil dump dari snapshot.' }
  Write-Host "Snapshot $($snap.short_id) ($($snap.time)) diambil."

  Langkah '4. Memulihkan database'
  & $pgRestore -h $dbHost -p $dbPort -U $dbUser --clean --if-exists --no-owner --dbname $dbNama $dump
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'PERINGATAN: pg_restore melaporkan pesan di atas. Data umumnya tetap terpulihkan; periksa' -ForegroundColor Yellow
    Write-Host "aplikasi setelah menyala. Isi database sebelum pemulihan: $kerja\sebelum-pulih.dump" -ForegroundColor Yellow
  }

  # Cadangan dari versi aplikasi lama: lengkapi struktur database ke versi sekarang.
  pnpm db:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi setelah pemulihan gagal; lihat log\server.log.' }

  if (-not $TanpaGambar) {
    Langkah '5. Memulihkan gambar & logo'
    $pathGambar = @($snap.paths) | Where-Object { $_ -notlike '*.dump' } | Select-Object -First 1
    if ($pathGambar) {
      & $restic -r $repoRestic @opsiRclone restore "$($snap.short_id):$(DalamSnapshot $pathGambar)" --target $storage --delete
      if ($LASTEXITCODE -ne 0) { Write-Host 'Sebagian gambar gagal dipulihkan (lihat pesan di atas).' -ForegroundColor Yellow }
      else { Write-Host "Folder $storage dipulihkan." }
    } else {
      Write-Host 'Snapshot tidak berisi folder gambar; dilewati.'
    }
  }
  Remove-Item -Force $dump -ErrorAction SilentlyContinue
  Write-Host ''
  Write-Host 'PEMULIHAN SELESAI.' -ForegroundColor Green
  Write-Host "Pengaman (isi database sebelum pemulihan): $kerja\sebelum-pulih.dump - hapus bila sudah yakin."
} finally {
  Langkah 'Menyalakan server'
  Start-ScheduledTask -TaskName $namaTugas -ErrorAction SilentlyContinue
  Remove-Item Env:\PGPASSWORD, Env:\RESTIC_PASSWORD -ErrorAction SilentlyContinue
}
