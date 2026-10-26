<#
  BonsaiUrip - membuat Setup-BonsaiUrip.exe (K-188 v2). Dijalankan PENGEMBANG dari folder kode sumber:
      powershell -ExecutionPolicy Bypass -File installer\buat-installer.ps1

  Hasil: installer\keluaran\Setup-BonsaiUrip.exe berisi aplikasi hasil build, Node, PostgreSQL bawaan, dan peluncur
  BonsaiUrip.exe. Pemakai cukup klik dua kali Setup: tanpa hak Administrator, tanpa terminal, tanpa password
  PostgreSQL, tanpa program lain yang harus dipasang dulu.
  Perlu di komputer pengembang: Node 24, pnpm, PostgreSQL 17 (sumber berkas pgsql), Inno Setup 6.
#>
param([string]$PgDir = '')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repo
$paket = Join-Path $PSScriptRoot 'paket'
$iscc = @(
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
  'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
  'C:\Program Files\Inno Setup 6\ISCC.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 belum terpasang: winget install JRSoftware.InnoSetup' }
if (-not $PgDir) {
  $psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
  if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\17\bin\psql.exe', 'D:\PostgreSQL\17\bin\psql.exe' -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $psql) { throw 'PostgreSQL 17 tidak ditemukan. Isi -PgDir (folder yang berisi bin, lib, share).' }
  $PgDir = Split-Path (Split-Path $psql)
}
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

Write-Host '== 1. Build =='
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install gagal.' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'Build gagal.' }

Write-Host '== 2. Menyusun paket =='
if (Test-Path $paket) { cmd /c rmdir /s /q "$paket" }
New-Item -ItemType Directory -Force -Path "$paket\apps" | Out-Null
# Dependency produksi saja (tanpa alat pengembangan), lengkap dengan modul native (argon2).
$sementara = Join-Path $PSScriptRoot 'deploy-sementara'
if (Test-Path $sementara) { cmd /c rmdir /s /q "$sementara" }
pnpm --filter '@sit/api' deploy --prod --legacy "$sementara"
if ($LASTEXITCODE -ne 0) { throw 'pnpm deploy gagal.' }
# pnpm deploy mengusik node_modules repo (hook commit); dipulihkan sekarang juga.
pnpm install | Out-Null
# Inno Setup tidak menyalin tautan (junction) pnpm: seluruh paket nyata disalin ke satu folder node_modules datar.
$nm = "$sementara\node_modules"
$datar = "$paket\apps\api\node_modules"
New-Item -ItemType Directory -Force -Path $datar | Out-Null
foreach ($p in Get-ChildItem "$nm\.pnpm" -Directory -Force | Where-Object { $_.Name -ne 'node_modules' }) {
  $dalam = Join-Path $p.FullName 'node_modules'
  if (-not (Test-Path $dalam)) { continue }
  foreach ($e in Get-ChildItem $dalam -Directory -Force) {
    $anak = if ($e.Name.StartsWith('@')) {
      Get-ChildItem $e.FullName -Directory -Force | ForEach-Object { @{ Nama = "$($e.Name)\$($_.Name)"; Dir = $_ } }
    } else { @(@{ Nama = $e.Name; Dir = $e }) }
    foreach ($a in $anak) {
      if ($a.Dir.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
      $tujuan = Join-Path $datar $a.Nama
      if (-not (Test-Path $tujuan)) {
        New-Item -ItemType Directory -Force -Path (Split-Path $tujuan) | Out-Null
        Copy-Item $a.Dir.FullName $tujuan -Recurse -Force
      }
    }
  }
}
Copy-Item "$sementara\package.json" "$paket\apps\api\package.json"
cmd /c rmdir /s /q "$sementara" 2>$null
foreach ($wajib in 'pino-std-serializers', 'argon2', 'pg', 'hono', 'drizzle-orm', 'exceljs') {
  if (-not (Test-Path "$paket\apps\api\node_modules\$wajib")) { throw "Paket tidak lengkap: modul $wajib hilang." }
}
Copy-Item "$repo\apps\api\dist" "$paket\apps\api\dist" -Recurse -Force
Copy-Item "$repo\apps\api\src\db\migrations" "$paket\apps\api\dist\migrations" -Recurse -Force
New-Item -ItemType Directory -Force -Path "$paket\apps\web" | Out-Null
Copy-Item "$repo\apps\web\dist" "$paket\apps\web\dist" -Recurse -Force
New-Item -ItemType Directory -Force -Path "$paket\node" | Out-Null
Copy-Item (Get-Command node).Source "$paket\node\node.exe"

# PostgreSQL bawaan: hanya yang dibutuhkan server (tanpa pgAdmin, dokumentasi, berkas pengembang).
foreach ($sub in 'bin', 'lib', 'share') {
  robocopy "$PgDir\$sub" "$paket\pgsql\$sub" /E /NFL /NDL /NJH /NJS /NP /XF *.pdb *.lib /XD 'pgAdmin 4' | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Gagal menyalin PostgreSQL ($sub)." }
}
foreach ($wajib in 'initdb.exe', 'pg_ctl.exe', 'postgres.exe', 'pg_dump.exe') {
  if (-not (Test-Path "$paket\pgsql\bin\$wajib")) { throw "PostgreSQL bawaan tidak lengkap: $wajib." }
}
Copy-Item "$PgDir\server_license.txt" "$paket\pgsql\LICENSE-PostgreSQL.txt" -ErrorAction SilentlyContinue

# Peluncur BonsaiUrip.exe (C#, berikon logo).
& $csc -nologo -target:winexe "-win32icon:$PSScriptRoot\bonsaiurip.ico" "-out:$paket\BonsaiUrip.exe" `
  -r:System.Windows.Forms.dll -r:System.Drawing.dll "$PSScriptRoot\peluncur\BonsaiUrip.cs"
if ($LASTEXITCODE -ne 0) { throw 'Kompilasi BonsaiUrip.exe gagal.' }
Copy-Item "$repo\installer\bonsaiurip.ico" "$paket\bonsaiurip.ico"
"{0:N0} MB sebelum dikompres" -f ((Get-ChildItem $paket -Recurse -File | Measure-Object Length -Sum).Sum / 1MB) | Write-Host

Write-Host '== 3. Kompilasi Inno Setup =='
$versi = (Select-String -Path "$repo\packages\shared\src\versi.ts" -Pattern "VERSI_APLIKASI = '([^']+)'").Matches[0].Groups[1].Value
& $iscc /Q "/DVersi=$versi" "$PSScriptRoot\bonsaiurip.iss"
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup gagal (berkas keluaran mungkin sedang dibuka: tutup Setup yang berjalan).' }
$hasil = Get-Item "$PSScriptRoot\keluaran\Setup-BonsaiUrip.exe"
Write-Host ("Selesai: {0} ({1:N0} MB)" -f $hasil.FullName, ($hasil.Length / 1MB)) -ForegroundColor Green
