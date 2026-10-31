@echo off
rem K-210: pemeriksaan wajib sebelum sebuah perubahan dianggap selesai (typecheck, lint, tes otomatis).
rem Klik dua kali. Lama: 10-15 menit. Jangan dijalankan bersamaan dengan Buat-Setup (memori laptop terbatas).
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
if not exist pintasan\log mkdir pintasan\log
set LOG=pintasan\log\uji-penuh.txt
set NODE_OPTIONS=--max-old-space-size=4096
echo Menjalankan typecheck, lint, dan tes otomatis. Catatan lengkap: %LOG%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { pnpm typecheck *>&1 | Tee-Object -FilePath '%LOG%'; if ($LASTEXITCODE) { exit 1 }; pnpm lint *>&1 | Tee-Object -FilePath '%LOG%' -Append; if ($LASTEXITCODE) { exit 1 }; pnpm test *>&1 | Tee-Object -FilePath '%LOG%' -Append; exit $LASTEXITCODE }"
if errorlevel 1 (
  echo.
  echo GAGAL. Kirim ke pengembang cukup kalimat: "Uji-Penuh gagal, lihat pintasan\log\uji-penuh.txt".
) else (
  echo.
  echo LULUS semua.
)
pause
