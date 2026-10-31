@echo off
rem K-210: menyalakan aplikasi versi pengembangan (API port 3000 + tampilan port 5173), setelah memperbarui
rem dependency dan database. Klik dua kali; biarkan jendela terbuka selama memakai. Tutup jendela = mati.
chcp 65001 >nul
cd /d "%~dp0.."
echo 1/3 Memasang dependency...
call pnpm install
if errorlevel 1 goto gagal
echo 2/3 Memperbarui struktur database (migrasi)...
call pnpm db:migrate
if errorlevel 1 goto gagal
echo 3/3 Menyalakan. Buka http://localhost:5173 di peramban.
start "" http://localhost:5173
call pnpm dev
exit /b 0
:gagal
echo GAGAL. Foto jendela ini dan kirim ke pengembang.
pause
exit /b 1
