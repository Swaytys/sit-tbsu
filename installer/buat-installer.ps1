<#
  BonsaiUrip - membuat Setup-BonsaiUrip.exe (K-188). Jalankan dari folder kode sumber (pengembang), bukan di toko:
      powershell -ExecutionPolicy Bypass -File installer\buat-installer.ps1

  Langkah: build semua paket -> susun folder paket (installer\paket) berisi hasil build, dependency produksi saja,
  Node, migrasi, dan skrip pemasang -> kompilasi dengan Inno Setup -> installer\keluaran\Setup-BonsaiUrip.exe.
  Perlu: Node 24, pnpm, Inno Setup 6 (winget install JRSoftware.InnoSetup).
#>
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

Write-Host '== 1. Build =='
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'Build gagal.' }

Write-Host '== 2. Menyusun paket =='
if (Test-Path $paket) { Remove-Item $paket -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$paket\apps" | Out-Null
# Dependency produksi saja (tanpa alat pengembangan), lengkap dengan modul native (argon2).
pnpm --filter '@sit/api' deploy --prod --legacy "$paket\apps\api"
if ($LASTEXITCODE -ne 0) { throw 'pnpm deploy gagal.' }
# Inno Setup tidak menyalin tautan (junction) pnpm: seluruh paket nyata disalin ke satu folder node_modules datar.
$nm = "$paket\apps\api\node_modules"
$datar = "$paket\apps\api\node_modules_datar"
New-Item -ItemType Directory -Force -Path $datar | Out-Null
foreach ($p in Get-ChildItem "$nm\.pnpm" -Directory -Force | Where-Object { $_.Name -ne 'node_modules' }) {
  $dalam = Join-Path $p.FullName 'node_modules'
  if (-not (Test-Path $dalam)) { continue }
  foreach ($e in Get-ChildItem $dalam -Directory -Force) {
    $anak = if ($e.Name.StartsWith('@')) { Get-ChildItem $e.FullName -Directory -Force | ForEach-Object { @{ Nama = "$($e.Name)\$($_.Name)"; Dir = $_ } } } else { @(@{ Nama = $e.Name; Dir = $e }) }
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
cmd /c rmdir /s /q "$nm" 2>$null
Rename-Item $datar 'node_modules'
foreach ($wajib in 'pino-std-serializers', 'argon2', 'pg', 'hono', 'drizzle-orm') {
  if (-not (Test-Path "$paket\apps\api\node_modules\$wajib")) { throw "Paket tidak lengkap: modul $wajib hilang." }
}
Copy-Item "$repo\apps\api\dist" "$paket\apps\api\dist" -Recurse -Force
Copy-Item "$repo\apps\api\src\db\migrations" "$paket\apps\api\dist\migrations" -Recurse -Force
New-Item -ItemType Directory -Force -Path "$paket\apps\web" | Out-Null
Copy-Item "$repo\apps\web\dist" "$paket\apps\web\dist" -Recurse -Force
New-Item -ItemType Directory -Force -Path "$paket\node" | Out-Null
Copy-Item (Get-Command node).Source "$paket\node\node.exe"
New-Item -ItemType Directory -Force -Path "$paket\scripts" | Out-Null
Copy-Item "$repo\scripts\server" "$paket\scripts\server" -Recurse -Force
Copy-Item "$repo\scripts\kasir" "$paket\scripts\kasir" -Recurse -Force
Copy-Item "$repo\installer\bonsaiurip.ico" "$paket\bonsaiurip.ico"
Copy-Item "$repo\docs\panduan\pasang-laptop.md" "$paket\PANDUAN.txt"
"{0:N0} MB" -f ((Get-ChildItem $paket -Recurse -File | Measure-Object Length -Sum).Sum / 1MB) | Write-Host

Write-Host '== 3. Kompilasi Inno Setup =='
$versi = (Select-String -Path "$repo\packages\shared\src\versi.ts" -Pattern "VERSI_APLIKASI = '([^']+)'").Matches[0].Groups[1].Value
& $iscc "/DVersi=$versi" "$PSScriptRoot\bonsaiurip.iss"
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup gagal.' }
Write-Host "Selesai: $PSScriptRoot\keluaran\Setup-BonsaiUrip.exe" -ForegroundColor Green
