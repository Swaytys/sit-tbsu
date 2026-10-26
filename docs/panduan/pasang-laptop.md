# Memasang BonsaiUrip di Komputer (Setup-BonsaiUrip.exe)

Untuk: pemilik dan siapa pun yang memasang di komputer toko. Waktu: ± 5 menit. Tidak perlu terminal, tidak perlu
memasang program lain, tidak ada password database yang harus diingat.

## Yang terjadi di balik layar (cukup dibaca sekali)

```
 Setup-BonsaiUrip.exe (±54 MB) memasang ke  %LOCALAPPDATA%\Programs\BonsaiUrip
   ├─ BonsaiUrip.exe   ← ikon di desktop / menu Start
   ├─ aplikasi (server + tampilan), Node.js, PostgreSQL bawaan
 Data disimpan terpisah di  %LOCALAPPDATA%\BonsaiUrip
   ├─ pgdata\  database      ├─ storage\  gambar & logo      └─ log\  catatan
```

- **Database ikut di dalam aplikasi.** PostgreSQL bawaan dibuat sendiri pada pemakaian pertama, memakai password
  acak yang tidak perlu diketahui siapa pun, dan hanya bisa diakses dari komputer itu. PostgreSQL lain yang mungkin
  sudah terpasang tidak disentuh.
- **Tanpa hak Administrator.** Setup tidak meminta izin "Ya/Tidak" Windows.
- **Membuka aplikasi** = klik ikon BonsaiUrip: database dan server dinyalakan, lalu peramban terbuka ke
  `http://localhost:7878`. Menutup peramban tidak mematikan server; server berhenti saat komputer dimatikan atau
  lewat menu Start › *Matikan BonsaiUrip*.
- **Memperbarui** = jalankan Setup versi baru; data tidak hilang. **Menghapus** aplikasi (Setelan › Aplikasi) juga
  tidak menghapus data; folder data dihapus sendiri bila memang ingin mulai dari nol.

## Memasang

1. Salin **Setup-BonsaiUrip.exe** ke komputer itu, lalu klik dua kali.
2. Bila Windows menampilkan *"Windows melindungi PC Anda"* (karena aplikasi belum bertanda tangan digital):
   klik **Info selengkapnya** › **Tetap jalankan**.
3. Ikuti wizard: **Next** › centang pilihan yang diinginkan:
   - *Buat ikon di desktop* (disarankan);
   - *Nyalakan BonsaiUrip otomatis saat Windows dimulai* (disarankan untuk komputer kasir);
   lalu **Install** › **Finish** (biarkan *Buka BonsaiUrip sekarang* tercentang).
4. Muncul jendela **"Menyiapkan BonsaiUrip..."**. Pemakaian pertama ± 1–3 menit (database dibuat). Berikutnya
   ± 10–20 detik.
5. Muncul jendela **akun pertama** berisi password awal Owner. Password **sudah tersalin otomatis**. Catat juga di
   kertas: jendela ini hanya muncul sekali.
6. Peramban terbuka. Masuk dengan nama pengguna `owner` dan password tadi (tempel dengan **Ctrl+V**), lalu buat
   password baru.

## Sesudah masuk pertama

Isi berurutan: *Pengaturan › Profil toko* (nama, alamat, logo) › *Pengaturan › Pembayaran* (rekening) ›
*Data Pengguna* (akun tiap pegawai) › *Data Barang › Import* (barang, harga, saldo awal stok) › pelanggan dan
pemasok › *Pengaturan › Struk & printer*.

## Bila ada masalah

| Gejala | Yang dilakukan |
|---|---|
| Jendela "BonsaiUrip gagal dinyalakan" | Pesannya menyebut sebab dan folder catatan. Foto jendelanya dan kirim ke pengembang. Catatan lengkap: `%LOCALAPPDATA%\BonsaiUrip\log` (`peluncur.log`, `postgres.log`, `server.log`). |
| Peramban menampilkan "tidak dapat dijangkau" | Klik ikon BonsaiUrip sekali lagi (menyalakan ulang yang belum menyala). |
| Lupa password Owner | Akun Admin/Owner lain bisa me-reset di *Data Pengguna*. Bila tidak ada, hubungi pengembang. |
| Mulai dari nol (hapus semua data) | Menu Start › *Matikan BonsaiUrip*, hapus folder `%LOCALAPPDATA%\BonsaiUrip`, lalu buka BonsaiUrip lagi. **Semua data hilang.** |

## Batasan versi ini

- Dipakai di **satu komputer** (localhost). Membuka dari HP/komputer lain di jaringan toko butuh mode server
  (HTTPS, `fase-8-pasang-server.md`) dan belum ada di Setup ini.
- Cadangan otomatis ke disk/Google Drive belum diatur dari Setup; sementara salin folder
  `%LOCALAPPDATA%\BonsaiUrip` ke flashdisk secara berkala saat aplikasi dimatikan.

## Untuk pengembang: membuat Setup

`powershell -ExecutionPolicy Bypass -File installer\buat-installer.ps1` (perlu Node 24, pnpm, PostgreSQL 17 sebagai
sumber berkas `pgsql`, Inno Setup 6). Hasil: `installer\keluaran\Setup-BonsaiUrip.exe`. Peluncur:
`apps/api/src/peluncur.ts` (data, database bawaan, migrasi, akun awal, server) dan `installer/peluncur/BonsaiUrip.cs`
(jendela). Uji tanpa Setup: `node installer\paket\apps\api\dist\peluncur.js --latar` dengan `BONSAIURIP_DATA` diisi
folder uji.
