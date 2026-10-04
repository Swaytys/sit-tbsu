<#
  BonsaiUrip - memasang server di komputer toko (Windows 10/11), sekali saja (K-082).
  Jalankan sebagai Administrator dari folder aplikasi:
      powershell -ExecutionPolicy Bypass -File scripts\server\pasang-server.ps1

  Yang dilakukan:
    1. Memeriksa Node.js 24, pnpm, dan PostgreSQL.
    2. Membuat .env produksi (password acak) bila belum ada, dan database produksi bila belum ada.
    3. Memasang dependency, build, migrasi database, dan data awal (akun owner).
    4. Membuat sertifikat HTTPS (CA lokal toko) dan membuka port 443/80 di firewall (jaringan pribadi).
    5. Mendaftarkan tugas "BonsaiUrip Server" yang menyalakan server setiap komputer menyala.
  Panduan lengkap: docs/panduan/fase-8-pasang-server.md
#>
#Requires -RunAsAdministrator
param(
  [string]$NamaDatabase = 'tbsu',
  [string]$PenggunaDb = 'sit',
  [string]$HostDb = 'localhost',
  [int]$PortDb = 5432
)
# 'Continue': di Windows PowerShell 5.1, keluaran galat program (pnpm, psql) tidak boleh menghentikan skrip;
# hasil program diperiksa lewat $LASTEXITCODE, cmdlet penting memakai -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$namaTugas = 'BonsaiUrip Server'

function Langkah([string]$teks) { Write-Host ''; Write-Host "== $teks ==" -ForegroundColor Cyan }
function Acak([int]$n) { -join ((48..57) + (65..90) + (97..122) | Get-Random -Count $n | ForEach-Object { [char]$_ }) }
function TeksBiasa([Security.SecureString]$s) {
  [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}

Langkah '1. Memeriksa program'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node.js belum terpasang. Pasang Node.js 24 LTS (nodejs.org) lalu jalankan lagi.' }
$versi = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($versi -lt 24) { throw "Node.js minimal versi 24 (terpasang v$versi)." }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw 'pnpm belum terpasang. Jalankan: npm install -g pnpm' }
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
  $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe', 'D:\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) { throw 'PostgreSQL (psql) tidak ditemukan. Pasang PostgreSQL 17 lalu jalankan lagi.' }
Write-Host "Node $((& $node --version)), pnpm $((pnpm --version)), $psql"

Langkah '2. Berkas .env produksi dan database'
$envPath = Join-Path $repo '.env'
if (Test-Path $envPath) {
  Write-Host '.env sudah ada; dipakai apa adanya.'
  if (-not (Select-String -Path $envPath -Pattern '^NODE_ENV=production' -Quiet)) {
    throw '.env yang ada bukan produksi (NODE_ENV=production). Pindahkan/ganti namanya dulu, lalu jalankan lagi.'
  }
} else {
  $sandiDb = TeksBiasa (Read-Host "Password user database '$PenggunaDb' (buat baru bila belum ada)" -AsSecureString)
  $sandiOwner = Acak 12
  $sandiPfx = Acak 24
  @(
    '# .env PRODUKSI server toko - dibuat pasang-server.ps1. JANGAN dibagikan / di-commit.'
    'NODE_ENV=production'
    'PORT=443'
    'PORT_HTTP_ALIH=80'
    "DATABASE_URL=postgres://$($PenggunaDb):$([uri]::EscapeDataString($sandiDb))@$($HostDb):$PortDb/$NamaDatabase"
    "SEED_OWNER_PASSWORD=$sandiOwner"
    'SESSION_IDLE_MENIT=60'
    'SESSION_ABSOLUT_JAM=12'
    'LOG_LEVEL=info'
    "LOG_FILE=$repo\log\server.log"
    "STORAGE_DIR=$repo\storage"
    "HTTPS_PFX=$repo\sertifikat\server.pfx"
    "HTTPS_PFX_PASSWORD=$sandiPfx"
    '# Alamat Tailscale (akses luar toko), mis. https://server-toko.tailxxxx.ts.net:8443'
    'ORIGIN_TAMBAHAN='
  ) | Set-Content -Path $envPath -Encoding ascii -ErrorAction Stop
  Write-Host ".env dibuat. Password awal Owner: $sandiOwner  (catat; wajib diganti saat login pertama)" -ForegroundColor Yellow

  # Database & user dibuat dengan akun superuser postgres bila belum ada.
  $env:PGPASSWORD = $sandiDb
  & $psql -h $HostDb -p $PortDb -U $PenggunaDb -d $NamaDatabase -c 'select 1' 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Database '$NamaDatabase' atau user '$PenggunaDb' belum ada; dibuat dengan akun postgres."
    $env:PGPASSWORD = TeksBiasa (Read-Host 'Password user postgres (superuser PostgreSQL)' -AsSecureString)
    $sandiSql = $sandiDb.Replace("'", "''")
    & $psql -h $HostDb -p $PortDb -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DO `$`$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PenggunaDb') THEN CREATE ROLE $PenggunaDb LOGIN PASSWORD '$sandiSql'; END IF; END`$`$;"
    if ($LASTEXITCODE -ne 0) { throw 'Gagal membuat user database.' }
    & $psql -h $HostDb -p $PortDb -U postgres -d postgres -c "CREATE DATABASE $NamaDatabase OWNER $PenggunaDb ENCODING 'UTF8' TEMPLATE template0"
    if ($LASTEXITCODE -ne 0) { throw 'Gagal membuat database.' }
  }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Langkah '3. Dependency, build, migrasi, data awal'
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'pnpm install gagal.' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'Build gagal.' }
pnpm db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Migrasi database gagal (lihat log\server.log).' }
pnpm db:seed
if ($LASTEXITCODE -ne 0) { throw 'Data awal gagal (lihat log\server.log).' }

Langkah '4. Sertifikat HTTPS dan firewall'
$pfx = Join-Path $repo 'sertifikat\server.pfx'
if (-not (Test-Path $pfx)) {
  $sandiPfx = ((Select-String -Path $envPath -Pattern '^HTTPS_PFX_PASSWORD=(.*)$').Matches[0].Groups[1].Value)
  & (Join-Path $PSScriptRoot 'buat-sertifikat.ps1') -Folder (Join-Path $repo 'sertifikat') -KataSandi $sandiPfx
}
if (-not (Get-NetFirewallRule -DisplayName 'BonsaiUrip HTTPS' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'BonsaiUrip HTTPS' -Direction Inbound -Protocol TCP -LocalPort 443, 80 `
    -Action Allow -Profile Private, Domain -ErrorAction Stop | Out-Null
  Write-Host 'Port 443 dan 80 dibuka untuk jaringan pribadi (Private/Domain).'
}

# Berkas rahasia (.env, kunci sertifikat) hanya bisa dibaca Administrator dan SYSTEM (K-083).
foreach ($rahasia in @($envPath, (Join-Path $repo 'sertifikat'))) {
  & icacls.exe $rahasia /inheritance:r /grant:r 'Administrators:(OI)(CI)F' 'SYSTEM:(OI)(CI)F' | Out-Null
}

Langkah '5. Menyalakan otomatis saat komputer menyala'
$aksi = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $repo `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$repo\scripts\server\jalankan-server.ps1`" -Node `"$node`""
$pemicu = New-ScheduledTaskTrigger -AtStartup
$pelaku = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$atur = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $namaTugas -Action $aksi -Trigger $pemicu -Principal $pelaku -Settings $atur -Force -ErrorAction Stop | Out-Null
Start-ScheduledTask -TaskName $namaTugas -ErrorAction Stop

Langkah '6. Memeriksa server'
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  Start-Sleep -Seconds 2
  $hasil = & curl.exe -sk -o NUL -w '%{http_code}' https://localhost/api/health
  $ok = ($hasil -eq '200')
}
if (-not $ok) { throw 'Server belum menjawab. Periksa log\server.log dan log\penjaga.log.' }

Write-Host ''
Write-Host 'SERVER SIAP.' -ForegroundColor Green
Write-Host "Alamat di jaringan toko : https://$($env:COMPUTERNAME)/"
Write-Host 'Langkah berikutnya (lihat panduan):'
Write-Host '  - Salin sertifikat\ca-toko.cer ke setiap komputer kasir/admin, jalankan scripts\kasir\pasang-sertifikat.ps1'
Write-Host '  - Login Owner dengan password awal di atas (atau SEED_OWNER_PASSWORD di .env), lalu ganti password'
Write-Host '  - Atur cadangan data: Pengaturan > Cadangan'
