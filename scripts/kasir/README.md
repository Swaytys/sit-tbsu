# Komputer kasir: cetak struk otomatis

Peramban (Chrome/Edge) **selalu** menampilkan jendela pilihan print setiap kali halaman web mencetak. Halaman
web tidak bisa mematikannya sendiri — itu pengaman peramban. Satu-satunya cara resmi agar struk langsung keluar
adalah menjalankan peramban dengan opsi `--kiosk-printing`, yang mencetak ke **printer bawaan Windows** tanpa
bertanya (K-074).

## Persiapan (sekali per komputer kasir)

1. Pasang driver printer struk (thermal 57, 58, atau 80 mm). Printer **Bluetooth**: pasangkan dulu di Windows ›
   Bluetooth & perangkat, lalu pasang driver-nya sampai printer muncul di _Printer & pemindai_.
2. Windows › Pengaturan › Bluetooth & perangkat › Printer & pemindai:
   - matikan **"Biarkan Windows mengatur printer bawaan"**;
   - pilih printer struk › **Jadikan default**.
3. Pengaturan aplikasi › Profil toko › Lebar struk: samakan dengan kertas printer (57/58/80 mm). Di bawahnya,
   _Cetak struk setelah bayar_: **Langsung cetak**, **Tanya dulu**, atau **Tidak dicetak** (K-095).
4. Klik dua kali `buka-kasir.cmd` (boleh buat shortcut di desktop). Terbuka jendela kasir khusus; setiap transaksi
   penjualan langsung yang selesai langsung mencetak struk.

Jendela ini memakai profil peramban terpisah, jadi browsing biasa di komputer yang sama tidak ikut mencetak
otomatis. Login di jendela kasir cukup sekali (sesi mengikuti batas di Pengaturan › Keamanan).

## Alamat lain

`buka-kasir.cmd http://192.168.1.10:5173/penjualan-langsung` — bila aplikasi berjalan di komputer/server lain.

## Catatan

- **Invoice dan surat jalan A4 tanpa jendela cetak (K-124).** Bila struk dicetak lewat _cetak langsung_ (Web
  Serial, disarankan), jadikan **printer A4** sebagai printer bawaan Windows, bukan printer struk. Jendela mode
  kasir ini lalu mencetak invoice dan surat jalan langsung ke printer A4, sedangkan struk tetap ke printer
  thermal lewat cetak langsung; keduanya tidak tertukar. Kapan invoice/surat jalan dicetak (Langsung cetak /
  Tanya dulu / Tidak dicetak) dan ukuran kertasnya (bawaan A4 lanskap) diatur di Pengaturan › Struk & printer ›
  _Invoice, surat jalan & kertas_. Samakan ukuran kertas di Preferensi pencetakan printer A4 di Windows.
- Cetak otomatis bisa dimatikan atau diganti "tanya dulu" di Pengaturan › Struk & printer (K-095).
- **Cara yang dianjurkan untuk printer struk thermal adalah cetak langsung** (K-103, K-105): struk dikirim
  sebagai teks tanpa driver dan tanpa jendela cetak, hasilnya tegak dan tajam. Lihat
  `docs/panduan/printer-struk.md`. Skrip ini tetap berguna untuk printer yang tidak mendukung cetak langsung.
- Jendela kasir dari skrip ini memakai profil peramban tersendiri. Pengaturan printer (Pengaturan › Struk &
  printer › Printer struk komputer ini) tersimpan per profil: bila kasir dijalankan lewat skrip ini, kerjakan
  penyiapan printer **di dalam jendela ini**, bukan di peramban biasa.
