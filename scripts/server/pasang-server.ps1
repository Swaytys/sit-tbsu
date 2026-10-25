<#
  BonsaiUrip - memasang server di komputer toko (Windows 10/11), sekali saja (K-082).
  Jalankan sebagai Administrator dari folder aplikasi:
      powershell -ExecutionPolicy Bypass -File scripts\server\pasang-server.ps1

  Yang dilakukan:
    1. Memeriksa Node.js 24, pnpm, dan PostgreSQL.
    2. Membuat .env produksi (password acak) bila belum ada, dan database produksi bila belum ada.
    3. Memasang dependency, build, migrasi database, dan data awal (akun owner).
    4. Membuat sertifikat HTTPS (CA lokal toko) dan membuka port 443/80 di firewall (jaringan pribadi).
    5. Mendaftarkan tugas "BonsaiUrip Server" yang menyalakan server setiap komputer menyala; komputer/laptop
       tidak tidur saat dicolok listrik; sertifikat toko dipercaya di komputer ini; pintasan desktop
       "BonsaiUrip" (https://localhost/) untuk membuka aplikasi di komputer server itu sendiri.
  Panduan lengkap: docs/panduan/fase-8-pasang-server.md
#>
#Requires -RunAsAdministrator
param(
  [string]$NamaDatabase = 'bonsaiurip',
  [string]$PenggunaDb = 'bonsai',
  [string]$HostDb = 'localhost',
  [int]$PortDb = 5432
)
# 'Continue': di Windows PowerShell 5.1, keluaran galat program (pnpm, psql) tidak boleh menghentikan skrip;
# hasil program diperiksa lewat $LASTEXITCODE, cmdlet penting memakai -ErrorAction Stop.
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$namaTugas = 'BonsaiUrip Server'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

# Galat apa pun ditampilkan sebagai jendela pesan (pengguna tidak perlu membaca terminal).
trap {
  [Windows.Forms.MessageBox]::Show(
    "Pemasangan berhenti (baris $($_.InvocationInfo.ScriptLineNumber)):`n`n$($_.Exception.Message)`n`nPerbaiki lalu klik dua kali 'Pasang BonsaiUrip' lagi (aman diulang).",
    'BonsaiUrip - pemasangan gagal', 'OK', 'Error') | Out-Null
  break
}

function Langkah([string]$teks) { Write-Host ''; Write-Host "== $teks ==" -ForegroundColor Cyan }
function AmbilEnv([string]$k) {
  $b = Get-Content (Join-Path $repo '.env') | Where-Object { $_ -like "$k=*" } | Select-Object -First 1
  if ($null -eq $b) { throw ".env tidak memuat $k. Hapus berkas .env di folder aplikasi lalu jalankan Setup lagi." }
  return $b.Substring($k.Length + 1).Trim()
}
function Acak([int]$n) { -join ((48..57) + (65..90) + (97..122) | Get-Random -Count $n | ForEach-Object { [char]$_ }) }

<# Jendela isian password. Mengembalikan teks, atau $null bila dibatalkan. #>
function MintaSandi([string]$judul, [string]$pesan) {
  $f = New-Object Windows.Forms.Form
  $f.Text = $judul; $f.Width = 460; $f.Height = 230; $f.StartPosition = 'CenterScreen'
  $f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.MinimizeBox = $false; $f.TopMost = $true
  $l = New-Object Windows.Forms.Label
  $l.Text = $pesan; $l.SetBounds(16, 14, 410, 70)
  $t = New-Object Windows.Forms.TextBox
  $t.UseSystemPasswordChar = $true; $t.SetBounds(16, 90, 410, 24)
  $ok = New-Object Windows.Forms.Button
  $ok.Text = 'Lanjut'; $ok.SetBounds(240, 130, 90, 30); $ok.DialogResult = 'OK'
  $batal = New-Object Windows.Forms.Button
  $batal.Text = 'Saya lupa'; $batal.SetBounds(336, 130, 90, 30); $batal.DialogResult = 'Cancel'
  $f.Controls.AddRange(@($l, $t, $ok, $batal)); $f.AcceptButton = $ok; $f.CancelButton = $batal
  if ($f.ShowDialog() -eq 'OK') { return $t.Text } else { return $null }
}

<#
  Menjalankan SQL sebagai superuser postgres TANPA bertanya password (pemasang berjalan sebagai Administrator di
  komputer yang sama): izin masuk lokal untuk postgres dibuka SEMENTARA di pg_hba.conf (dicadangkan, lalu
  dikembalikan persis), SQL dijalankan, PostgreSQL dimulai ulang. Hanya bila cara ini gagal, password postgres
  diminta lewat jendela.
#>
function JalankanSuper([string[]]$perintah) {
  $layanan = Get-CimInstance Win32_Service | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
  $dataDir = $null
  if ($layanan -and ($layanan.PathName -match '-D\s+"?([^"]+?)"?(\s|$)')) { $dataDir = $Matches[1] }
  if (-not $dataDir) {
    $kandidat = Join-Path (Split-Path (Split-Path $psql)) 'data'
    if (Test-Path (Join-Path $kandidat 'pg_hba.conf')) { $dataDir = $kandidat }
  }
  if ($layanan -and $dataDir -and (Test-Path (Join-Path $dataDir 'pg_hba.conf'))) {
    $hba = Join-Path $dataDir 'pg_hba.conf'
    $cadangan = "$hba.bonsaiurip-cadangan"
    Copy-Item $hba $cadangan -Force
    $gagal = $false
    try {
      @('host all postgres 127.0.0.1/32 trust', 'host all postgres ::1/128 trust') + (Get-Content $cadangan) |
        Set-Content -Path $hba -Encoding ascii
      Restart-Service $layanan.Name -Force; Start-Sleep -Seconds 4
      foreach ($q in $perintah) {
        & $psql -h 127.0.0.1 -p $PortDb -U postgres -d postgres -v ON_ERROR_STOP=1 -c $q
        if ($LASTEXITCODE -ne 0) { $gagal = $true }
      }
    } catch { $gagal = $true } finally {
      Copy-Item $cadangan $hba -Force; Remove-Item $cadangan -ErrorAction SilentlyContinue
      Restart-Service $layanan.Name -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 4
    }
    if (-not $gagal) { return }
  }
  for ($i = 1; $i -le 3; $i++) {
    $sandi = MintaSandi 'Password PostgreSQL' ("Pemasang tidak bisa membuat database otomatis. Masukkan password user 'postgres' (dibuat saat memasang PostgreSQL)." + "`nPercobaan $i dari 3.")
    if ($null -eq $sandi) { break }
    $env:PGPASSWORD = $sandi
    & $psql -h $HostDb -p $PortDb -U postgres -d postgres -c 'select 1' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      foreach ($q in $perintah) { & $psql -h $HostDb -p $PortDb -U postgres -d postgres -v ON_ERROR_STOP=1 -c $q }
      Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
      return
    }
  }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  throw 'Database belum bisa dibuat. Pastikan layanan PostgreSQL berjalan, lalu jalankan Setup lagi.'
}

Langkah '1. Memeriksa program'
# Mode paket (dipasang dari Setup-BonsaiUrip.exe): Node ikut terbawa, tanpa pnpm/build; migrasi dan data awal
# dijalankan dari hasil build. Mode kode sumber (git clone) memakai Node dan pnpm di komputer.
$paket = (Test-Path (Join-Path $repo 'apps\api\dist\db\migrate.js')) -and -not (Test-Path (Join-Path $repo 'pnpm-workspace.yaml'))
$node = if ($paket) { Join-Path $repo 'node\node.exe' } else { (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) { throw 'Node.js belum terpasang. Pasang Node.js 24 LTS (nodejs.org) lalu jalankan lagi.' }
$versi = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($versi -lt 24) { throw "Node.js minimal versi 24 (terpasang v$versi)." }
if (-not $paket -and -not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw 'pnpm belum terpasang. Jalankan: npm install -g pnpm' }
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
  $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe', 'D:\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) { throw 'PostgreSQL (psql) tidak ditemukan. Pasang PostgreSQL 17 lalu jalankan lagi.' }
Write-Host "Node $((& $node --version)), $psql"

Langkah '2. Berkas .env produksi dan database'
# Akun database khusus aplikasi (bukan akun pengembangan 'sit'); password dibuat otomatis, tidak perlu diingat.
$envPath = Join-Path $repo '.env'
$sandiOwner = $null
# .env lama yang kosong/bukan produksi (sisa percobaan sebelumnya) dicadangkan, lalu dibuat yang baru.
if ((Test-Path $envPath) -and -not (Select-String -Path $envPath -Pattern '^NODE_ENV=production' -Quiet)) {
  Move-Item $envPath "$envPath.lama-$(Get-Date -Format yyyyMMddHHmmss)" -Force
}
if (Test-Path $envPath) {
  $isiEnv = Get-Content $envPath
  # Pemasangan lama yang gagal memakai akun 'sit': diganti akun aplikasi sendiri.
  if ($isiEnv -match '^DATABASE_URL=postgres://sit:') {
    $baru = "DATABASE_URL=postgres://$($PenggunaDb):$(Acak 24)@$($HostDb):$PortDb/$NamaDatabase"
    $isiEnv = $isiEnv | ForEach-Object { if ($_ -like 'DATABASE_URL=*') { $baru } else { $_ } }
    $isiEnv | Set-Content -Path $envPath -Encoding ascii -ErrorAction Stop
  }
  Write-Host '.env sudah ada; dipakai.'
} else {
  $sandiOwner = Acak 12
  @(
    '# .env PRODUKSI - dibuat pasang-server.ps1. JANGAN dibagikan / di-commit.'
    'NODE_ENV=production'
    'PORT=443'
    'PORT_HTTP_ALIH=80'
    "DATABASE_URL=postgres://$($PenggunaDb):$(Acak 24)@$($HostDb):$PortDb/$NamaDatabase"
    "SEED_OWNER_PASSWORD=$sandiOwner"
    'SESSION_IDLE_MENIT=60'
    'SESSION_ABSOLUT_JAM=12'
    'LOG_LEVEL=info'
    "LOG_FILE=$repo\log\server.log"
    "STORAGE_DIR=$repo\storage"
    "HTTPS_PFX=$repo\sertifikat\server.pfx"
    "HTTPS_PFX_PASSWORD=$(Acak 24)"
    '# Alamat Tailscale (akses luar toko), mis. https://server-toko.tailxxxx.ts.net:8443'
    'ORIGIN_TAMBAHAN='
  ) | Set-Content -Path $envPath -Encoding ascii -ErrorAction Stop
}
if (-not $sandiOwner) {
  $sandiOwner = (AmbilEnv 'SEED_OWNER_PASSWORD')
}
$url = [uri](AmbilEnv 'DATABASE_URL')
$userDb = $url.UserInfo.Split(':')[0]
$sandiDb = [uri]::UnescapeDataString($url.UserInfo.Split(':', 2)[1])
$namaDb = $url.AbsolutePath.TrimStart('/')
$env:PGPASSWORD = $sandiDb
& $psql -h $HostDb -p $PortDb -U $userDb -d $namaDb -c 'select 1' 2>$null | Out-Null
$adaDb = ($LASTEXITCODE -eq 0)
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
if (-not $adaDb) {
  Write-Host "Membuat akun '$userDb' dan database '$namaDb'..."
  $s = $sandiDb.Replace("'", "''")
  JalankanSuper @(
    "DO `$`$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$userDb') THEN CREATE ROLE $userDb LOGIN CREATEDB PASSWORD '$s'; ELSE ALTER ROLE $userDb LOGIN CREATEDB PASSWORD '$s'; END IF; END`$`$;",
    "SELECT 'database sudah ada' WHERE EXISTS (SELECT FROM pg_database WHERE datname = '$namaDb')"
  )
  $env:PGPASSWORD = $sandiDb
  & $psql -h $HostDb -p $PortDb -U $userDb -d postgres -tAc "select 1 from pg_database where datname = '$namaDb'" | Out-String |
    ForEach-Object { if ($_.Trim() -ne '1') { & $psql -h $HostDb -p $PortDb -U $userDb -d postgres -c "CREATE DATABASE $namaDb ENCODING 'UTF8' TEMPLATE template0" } }
  & $psql -h $HostDb -p $PortDb -U $userDb -d $namaDb -c 'select 1' 2>$null | Out-Null
  $ok = ($LASTEXITCODE -eq 0)
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  if (-not $ok) { throw "Database '$namaDb' belum bisa dibuka dengan akun '$userDb'." }
}

Langkah '3. Dependency, build, migrasi, data awal'
if ($paket) {
  & $node (Join-Path $repo 'apps\api\dist\db\migrate.js')
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi database gagal (lihat log\server.log).' }
  & $node (Join-Path $repo 'apps\api\dist\db\seed.js')
  if ($LASTEXITCODE -ne 0) { throw 'Data awal gagal (lihat log\server.log).' }
} else {
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install gagal.' }
  pnpm build
  if ($LASTEXITCODE -ne 0) { throw 'Build gagal.' }
  pnpm db:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migrasi database gagal (lihat log\server.log).' }
  pnpm db:seed
  if ($LASTEXITCODE -ne 0) { throw 'Data awal gagal (lihat log\server.log).' }
}

Langkah '4. Sertifikat HTTPS dan firewall'
$pfx = Join-Path $repo 'sertifikat\server.pfx'
if (-not (Test-Path $pfx)) {
  $sandiPfx = (AmbilEnv 'HTTPS_PFX_PASSWORD')
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

Langkah '5b. Komputer ini juga dipakai membuka aplikasinya (localhost)'
# Server tidak boleh tidur/hibernasi saat dicolok listrik. Laptop: menutup layar tidak mematikan server.
& powercfg.exe /change standby-timeout-ac 0 | Out-Null
& powercfg.exe /change hibernate-timeout-ac 0 | Out-Null
$laptop = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue).Count -gt 0
if ($laptop) {
  & powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
  & powercfg.exe /setactive SCHEME_CURRENT | Out-Null
  Write-Host 'Laptop: saat dicolok listrik tidak tidur, dan menutup layar tidak mematikan server.'
  Write-Host 'Saat memakai baterai, Windows tetap boleh tidur (server ikut berhenti sampai laptop bangun).' -ForegroundColor Yellow
} else {
  Write-Host 'Komputer tidak akan tidur saat menyala.'
}
# Peramban di komputer ini memercayai sertifikat toko, jadi https://localhost terbuka tanpa peringatan.
$ca = Join-Path $repo 'sertifikat\ca-toko.cer'
if (Test-Path $ca) {
  Import-Certificate -FilePath $ca -CertStoreLocation Cert:\LocalMachine\Root -ErrorAction Stop | Out-Null
  Write-Host 'Sertifikat toko dipercaya di komputer ini.'
}
# Pintasan "BonsaiUrip" di desktop semua pengguna: membuka https://localhost/ di peramban bawaan.
$pintasan = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'BonsaiUrip.url'
@('[InternetShortcut]', 'URL=https://localhost/', 'IconIndex=0') | Set-Content -Path $pintasan -Encoding ascii
Write-Host "Pintasan desktop dibuat: $pintasan"
# K-186: aplikasi juga terbuka sendiri di peramban setiap pengguna masuk ke Windows.
$mulai = Join-Path ([Environment]::GetFolderPath('CommonStartup')) 'BonsaiUrip.url'
@('[InternetShortcut]', 'URL=https://localhost/', 'IconIndex=0') | Set-Content -Path $mulai -Encoding ascii
Write-Host 'Aplikasi terbuka otomatis setiap Windows dinyalakan (folder Startup).'

Langkah '6. Memeriksa server'
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  Start-Sleep -Seconds 2
  $hasil = & curl.exe -sk -o NUL -w '%{http_code}' https://localhost/api/health
  $ok = ($hasil -eq '200')
}
if (-not $ok) {
  $log = Join-Path $repo 'log\penjaga.log'
  $akhir = if (Test-Path $log) { (Get-Content $log -Tail 12) -join "`n" } else { '(log belum ada)' }
  throw "Server belum menjawab setelah 60 detik. Isi log terakhir:`n$akhir"
}

# Jendela akhir: password awal Owner bisa disalin, lalu aplikasi dibuka.
$f = New-Object Windows.Forms.Form
$f.Text = 'BonsaiUrip siap dipakai'; $f.Width = 480; $f.Height = 260; $f.StartPosition = 'CenterScreen'
$f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.TopMost = $true
$l = New-Object Windows.Forms.Label
$l.Text = "Pemasangan selesai. Masuk dengan nama pengguna 'owner' dan password awal di bawah (wajib diganti saat masuk pertama). Simpan/salin password ini sekarang."
$l.SetBounds(16, 14, 430, 60)
$t = New-Object Windows.Forms.TextBox
$t.Text = $sandiOwner; $t.ReadOnly = $true; $t.Font = New-Object Drawing.Font('Consolas', 14); $t.SetBounds(16, 80, 430, 32)
$salin = New-Object Windows.Forms.Button
$salin.Text = 'Salin password'; $salin.SetBounds(16, 140, 140, 32)
$salin.Add_Click({ [Windows.Forms.Clipboard]::SetText($sandiOwner) })
$buka = New-Object Windows.Forms.Button
$buka.Text = 'Buka BonsaiUrip'; $buka.SetBounds(306, 140, 140, 32); $buka.DialogResult = 'OK'
$f.Controls.AddRange(@($l, $t, $salin, $buka)); $f.AcceptButton = $buka
if ($f.ShowDialog() -eq 'OK') { Start-Process 'https://localhost/' }

Write-Host ''
Write-Host 'SERVER SIAP.' -ForegroundColor Green
Write-Host 'Alamat di komputer ini  : https://localhost/  (pintasan BonsaiUrip di desktop)'
Write-Host "Alamat di jaringan toko : https://$($env:COMPUTERNAME)/"
Write-Host 'Langkah berikutnya (lihat panduan):'
Write-Host '  - Salin sertifikat\ca-toko.cer ke setiap komputer kasir/admin, jalankan scripts\kasir\pasang-sertifikat.ps1'
Write-Host "  - Login Owner (owner / $sandiOwner), lalu ganti password"
Write-Host '  - Atur cadangan data: Pengaturan > Cadangan'
