@echo off
rem ============================================================================================
rem  BonsaiUrip - buka layar kasir dengan CETAK STRUK OTOMATIS (tanpa jendela pilihan print).
rem
rem  Peramban biasa SELALU menampilkan jendela print saat halaman mencetak; hanya Chrome/Edge yang
rem  dijalankan dengan --kiosk-printing yang langsung mencetak ke PRINTER BAWAAN Windows (K-074).
rem  Skrip ini membuka jendela peramban khusus kasir (profil terpisah, tidak mengganggu browsing biasa).
rem
rem  Persiapan sekali saja:
rem    1. Pasang driver printer struk (thermal 58/80 mm).
rem    2. Windows > Pengaturan > Printer: jadikan printer struk sebagai PRINTER BAWAAN, dan matikan
rem       "Biarkan Windows mengatur printer bawaan".
rem    3. Klik dua kali skrip ini (atau buat shortcut-nya di desktop kasir).
rem
rem  Pemakaian:  buka-kasir.cmd [alamat]
rem    alamat bawaan: http://localhost:5173/penjualan-langsung
rem ============================================================================================

setlocal
set "ALAMAT=%~1"
if "%ALAMAT%"=="" set "ALAMAT=http://localhost:5173/penjualan-langsung"
set "PROFIL=%LOCALAPPDATA%\BonsaiUrip\peramban-kasir"

set "PERAMBAN="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do (
  if not defined PERAMBAN if exist %%P set "PERAMBAN=%%~P"
)

if not defined PERAMBAN (
  echo Google Chrome atau Microsoft Edge tidak ditemukan. Pasang Google Chrome lalu jalankan lagi.
  pause
  exit /b 1
)

start "" "%PERAMBAN%" --kiosk-printing --user-data-dir="%PROFIL%" --no-first-run --start-maximized --app="%ALAMAT%"
endlocal
