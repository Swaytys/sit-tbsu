# Komputer kasir: cetak struk otomatis

Peramban (Chrome/Edge) **selalu** menampilkan jendela pilihan print setiap kali halaman web mencetak. Halaman
web tidak bisa mematikannya sendiri — itu pengaman peramban. Satu-satunya cara resmi agar struk langsung keluar
adalah menjalankan peramban dengan opsi `--kiosk-printing`, yang mencetak ke **printer bawaan Windows** tanpa
bertanya (K-074).

## Persiapan (sekali per komputer kasir)

1. Pasang driver printer struk (thermal 58 atau 80 mm).
2. Windows › Pengaturan › Bluetooth & perangkat › Printer & pemindai:
   - matikan **"Biarkan Windows mengatur printer bawaan"**;
   - pilih printer struk › **Jadikan default**.
3. Pengaturan aplikasi › Profil toko › Lebar struk: samakan dengan kertas printer (58/80 mm).
4. Klik dua kali `buka-kasir.cmd` (boleh buat shortcut di desktop). Terbuka jendela kasir khusus; setiap transaksi
   penjualan langsung yang selesai langsung mencetak struk.

Jendela ini memakai profil peramban terpisah, jadi browsing biasa di komputer yang sama tidak ikut mencetak
otomatis. Login di jendela kasir cukup sekali (sesi mengikuti batas di Pengaturan › Keamanan).

## Alamat lain

`buka-kasir.cmd http://192.168.1.10:5173/penjualan-langsung` — bila aplikasi berjalan di komputer/server lain.

## Catatan

- Invoice dan surat jalan pengantaran (A4) tidak dicetak otomatis; tekan **P** (invoice) atau **S** (surat jalan)
  setelah invoice dibuat. Bila jendela kasir ini juga dipakai untuk pengantaran, cetakannya ikut keluar di printer
  bawaan (printer struk) — gunakan peramban biasa (dengan jendela print) di komputer yang punya printer A4.
- Pengaturan printer dari dalam aplikasi (pilih printer, matikan cetak otomatis) dijadwalkan di v2.0.0
  (docs/08-backlog.md, Sprint F).
