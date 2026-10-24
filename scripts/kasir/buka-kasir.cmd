@echo off
rem ============================================================================================
rem  BonsaiUrip - buka layar kasir dengan CETAK STRUK OTOMATIS (tanpa jendela pilihan print).
rem
rem  Peramban biasa SELALU menampilkan jendela print saat halaman mencetak; hanya Chrome/Edge yang
rem  dijalankan dengan --kiosk-printing yang langsung mencetak ke PRINTER BAWAAN Windows (K-074).
rem  Skrip ini membuka jendela peramban khusus kasir (profil terpisah, tidak mengganggu browsing biasa).
rem
rem  K-124: bila struk memakai CETAK LANGSUNG (Pengaturan > Struk & printer), jadikan PRINTER A4 sebagai
rem  printer bawaan: invoice dan surat jalan langsung keluar di printer A4, struk tetap ke printer thermal.
rem
rem  Persiapan sekali saja:
rem    1. Pasang driver printer struk (thermal 57/58/80 mm). Printer Bluetooth: pasangkan dulu di
rem       Windows > Bluetooth, pasang driver-nya sampai muncul di daftar printer.
rem    2. Windows > Pengaturan > Printer: jadikan printer struk sebagai PRINTER BAWAAN, dan matikan
rem       "Biarkan Windows mengatur printer bawaan".
rem    3. Klik dua kali skrip ini (atau buat shortcut-nya di desktop kasir).
rem
rem  Pemakaian:  buka-kasir.cmd [alamat]
rem    alamat diambil dari argumen, atau baris pertama alamat-server.txt di folder ini
rem    (mis. https://SERVER-TOKO/penjualan-langsung), atau bawaan http://localhost:5173/penjualan-langsung
rem ============================================================================================

setlocal
set "ALAMAT=%~1"
if "%ALAMAT%"=="" if exist "%~dp0alamat-server.txt" set /p ALAMAT=<"%~dp0alamat-server.txt"
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
