<#
  BonsaiUrip - membuat sertifikat HTTPS untuk server toko (K-082).

  Membuat "CA lokal toko" (sekali) lalu sertifikat server yang ditandatanganinya, berlaku untuk nama komputer
  server, localhost, dan semua alamat IP komputer ini. Hasil di folder sertifikat\ (JANGAN dibagikan):
    ca-toko.cer   - dipasang di setiap komputer/HP yang membuka aplikasi (scripts\kasir\pasang-sertifikat.ps1)
    ca-toko.pfx   - kunci CA, untuk memperbarui sertifikat server tanpa memasang ulang ca-toko.cer
    server.pfx    - dipakai server (HTTPS_PFX di .env)
  Kata sandi .pfx dicetak di akhir dan ditulis ke .env oleh pasang-server.ps1.

  Pemakaian:  powershell -ExecutionPolicy Bypass -File buat-sertifikat.ps1 [-NamaTambahan kasir.toko] [-KataSandi xxx]
  Jalankan ulang setiap 2 tahun (masa berlaku sertifikat server) atau bila alamat IP server berubah.
#>
param(
  [string]$Folder = (Join-Path $PSScriptRoot '..\..\sertifikat'),
  [string[]]$NamaTambahan = @(),
  [string]$KataSandi = ''
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Folder | Out-Null
$Folder = (Resolve-Path $Folder).Path
if (-not $KataSandi) {
  $KataSandi = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
}
$sandi = ConvertTo-SecureString -String $KataSandi -Force -AsPlainText
$caPfx = Join-Path $Folder 'ca-toko.pfx'
$sementara = @()

try {
  if (Test-Path $caPfx) {
    Write-Host 'Memakai CA lokal yang sudah ada (ca-toko.pfx).'
    $ca = Import-PfxCertificate -FilePath $caPfx -CertStoreLocation Cert:\CurrentUser\My -Password $sandi -Exportable
  } else {
    Write-Host 'Membuat CA lokal toko baru...'
    $ca = New-SelfSignedCertificate -Type Custom -Subject 'CN=BonsaiUrip CA Lokal Toko' `
      -KeyUsage CertSign, CRLSign, DigitalSignature -KeyExportPolicy Exportable -KeyLength 2048 `
      -HashAlgorithm SHA256 -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(10) `
      -TextExtension @('2.5.29.19={critical}{text}ca=true&pathlength=0')
    Export-PfxCertificate -Cert $ca -FilePath $caPfx -Password $sandi | Out-Null
    Export-Certificate -Cert $ca -FilePath (Join-Path $Folder 'ca-toko.cer') | Out-Null
  }
  $sementara += $ca

  $nama = @($env:COMPUTERNAME, 'localhost') + $NamaTambahan | Select-Object -Unique
  $ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress -Unique
  $san = '2.5.29.17={text}' + ((@($nama | ForEach-Object { "dns=$_" }) + @($ip | ForEach-Object { "ipaddress=$_" })) -join '&')

  Write-Host "Membuat sertifikat server untuk: $($nama -join ', '), $($ip -join ', ')"
  $server = New-SelfSignedCertificate -Type Custom -Subject "CN=$($env:COMPUTERNAME)" -Signer $ca `
    -KeyExportPolicy Exportable -KeyLength 2048 -HashAlgorithm SHA256 `
    -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(2) `
    -TextExtension @($san, '2.5.29.37={text}1.3.6.1.5.5.7.3.1')
  $sementara += $server
  Export-PfxCertificate -Cert $server -FilePath (Join-Path $Folder 'server.pfx') -Password $sandi -ChainOption BuildChain | Out-Null
} finally {
  # Kunci hanya disimpan di berkas .pfx; salinan di penyimpanan sertifikat Windows dihapus.
  foreach ($c in $sementara) { Remove-Item -Path "Cert:\CurrentUser\My\$($c.Thumbprint)" -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host "Selesai. Berkas di $Folder"
Write-Host "HTTPS_PFX=$(Join-Path $Folder 'server.pfx')"
Write-Host "HTTPS_PFX_PASSWORD=$KataSandi"
