<#
  BonsaiUrip - memasang sertifikat CA lokal toko di komputer kasir/admin (sekali per komputer, K-082).
  Tanpa ini peramban menampilkan "Koneksi tidak aman" saat membuka https://<server>/.
  1. Salin berkas ca-toko.cer dari folder sertifikat\ di server (flashdisk/folder bersama) ke folder ini.
  2. Klik kanan PowerShell > Run as administrator, lalu:
       powershell -ExecutionPolicy Bypass -File pasang-sertifikat.ps1
  ca-toko.cer hanya berisi kunci publik (aman disalin); JANGAN menyalin berkas .pfx dari server.
#>
#Requires -RunAsAdministrator
param([string]$Berkas = (Join-Path $PSScriptRoot 'ca-toko.cer'))
if (-not (Test-Path $Berkas)) { throw "Berkas $Berkas tidak ada. Salin ca-toko.cer dari server dulu." }
$hasil = Import-Certificate -FilePath $Berkas -CertStoreLocation Cert:\LocalMachine\Root -ErrorAction Stop
Write-Host "Sertifikat '$($hasil.Subject)' terpasang. Tutup lalu buka lagi peramban." -ForegroundColor Green
