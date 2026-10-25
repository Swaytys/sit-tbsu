@echo off
rem BonsaiUrip - pemasang. Klik dua kali berkas ini. Windows akan meminta izin Administrator (klik Ya).
rem Semua isian (password) diminta lewat jendela; tidak perlu mengetik perintah.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0scripts\server\pasang-server.ps1""'"
