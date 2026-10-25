<#
  BonsaiUrip - menghentikan dan melepas server dari komputer ini (mis. selesai uji coba di laptop).
  Jalankan sebagai Administrator:
      powershell -ExecutionPolicy Bypass -File scripts\server\copot-server.ps1

  Yang dilakukan: menghentikan server, menghapus tugas "BonsaiUrip Server" (tidak menyala otomatis lagi),
  menghapus aturan firewall dan pintasan desktop. DATA TIDAK DIHAPUS: database, folder storage, cadangan, .env,
  dan sertifikat tetap ada, sehingga pasang-server.ps1 bisa dijalankan lagi kapan pun dengan data yang sama.
  Untuk sekadar mematikan sementara tanpa melepas: -Hentikan (nyalakan lagi dengan -Nyalakan).
#>
#Requires -RunAsAdministrator
param([switch]$Hentikan, [switch]$Nyalakan)
$namaTugas = 'BonsaiUrip Server'

function HentikanServer {
  Stop-ScheduledTask -TaskName $namaTugas -ErrorAction SilentlyContinue
  # Proses node yang menjalankan apps\api\dist\index.js milik penjaga server.
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'apps\\api\\dist\\index\.js' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -match 'jalankan-server\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($Nyalakan) {
  Start-ScheduledTask -TaskName $namaTugas -ErrorAction Stop
  Write-Host 'Server dinyalakan. Buka https://localhost/ dalam ±10 detik.' -ForegroundColor Green
  exit 0
}

HentikanServer
if ($Hentikan) {
  Write-Host 'Server dihentikan. Tetap menyala lagi otomatis saat komputer dinyalakan ulang.' -ForegroundColor Yellow
  Write-Host 'Nyalakan sekarang: copot-server.ps1 -Nyalakan'
  exit 0
}

Unregister-ScheduledTask -TaskName $namaTugas -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName 'BonsaiUrip HTTPS' -ErrorAction SilentlyContinue
$pintasan = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'BonsaiUrip.url'
Remove-Item $pintasan -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('CommonStartup')) 'BonsaiUrip.url') -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Server dilepas dari komputer ini. Data tidak dihapus (database, storage, cadangan, .env).' -ForegroundColor Green
Write-Host 'Pasang lagi kapan pun: scripts\server\pasang-server.ps1'
