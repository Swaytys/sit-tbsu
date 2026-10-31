@echo off
rem K-210: membuat Setup-BonsaiUrip.exe dari kode di folder ini (termasuk perubahan yang belum di-commit).
rem Klik dua kali. Hasil: installer\keluaran\Setup-BonsaiUrip-<versi>.exe, folder hasil dibuka otomatis.
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
if not exist pintasan\log mkdir pintasan\log
set LOG=pintasan\log\buat-setup.txt

echo ================================================================
echo  Membuat Setup BonsaiUrip
echo ================================================================
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CABANG=%%b
for /f "delims=" %%c in ('git log -1 --format^="%%h %%s" 2^>nul') do set KOMIT=%%c
echo  Cabang : %CABANG%
echo  Terakhir: %KOMIT%
git diff --quiet 2>nul
if errorlevel 1 echo  Catatan: ada perubahan yang belum di-commit; perubahan itu IKUT masuk Setup.
echo.
echo  Lama: 5-10 menit. Jangan tutup jendela ini. Catatan lengkap: %LOG%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { & '.\installer\buat-installer.ps1' *>&1 | Tee-Object -FilePath '%LOG%'; exit $LASTEXITCODE }"
if errorlevel 1 goto gagal
powershell -NoProfile -Command "if (-not (Get-Content '%LOG%' -Raw).Contains('Selesai:')) { exit 1 }"
if errorlevel 1 goto gagal

for /f "tokens=2 delims='" %%v in ('findstr /c:"VERSI_APLIKASI = " packages\shared\src\versi.ts') do set VERSI=%%v
copy /y installer\keluaran\Setup-BonsaiUrip.exe "installer\keluaran\Setup-BonsaiUrip-%VERSI%.exe" >nul
echo.
echo ================================================================
echo  BERHASIL: installer\keluaran\Setup-BonsaiUrip-%VERSI%.exe
echo ================================================================
explorer /select,"%CD%\installer\keluaran\Setup-BonsaiUrip-%VERSI%.exe"
pause
exit /b 0

:gagal
echo.
echo ================================================================
echo  GAGAL. Baca pesan merah di atas, atau kirim berkas ini ke pengembang:
echo  %CD%\%LOG%
echo ================================================================
pause
exit /b 1
