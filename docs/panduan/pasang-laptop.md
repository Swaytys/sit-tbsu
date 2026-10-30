# Memasang BonsaiUrip di Komputer (Setup-BonsaiUrip.exe, Setup v3)

Untuk: pemilik dan siapa pun yang memasang di komputer toko. Waktu: ± 5 menit memasang, ± 30 menit menyiapkan data.
Tidak perlu terminal, tidak perlu memasang program lain, tidak ada password bawaan.

Sesudah terpasang, panduan langkah demi langkah untuk pemakaian pertama ada di menu Start › BonsaiUrip ›
**Panduan mulai pakai** (sumbernya `installer/panduan/mulai-pakai.html`).

## Yang terjadi di balik layar (cukup dibaca sekali)

```
 Setup-BonsaiUrip.exe memasang ke folder pilihan (bawaan %LOCALAPPDATA%\Programs\BonsaiUrip)
   ├─ BonsaiUrip.exe     ikon di desktop / menu Start; layar pembuka + ikon di pojok kanan bawah
   ├─ aplikasi (server + tampilan), Node.js, PostgreSQL bawaan
   ├─ alat\restic.exe    program cadangan (terenkripsi)
   └─ panduan\           panduan mulai pakai
 Data disimpan terpisah di  %LOCALAPPDATA%\BonsaiUrip
   ├─ pgdata\  database   ├─ storage\  gambar, logo, pengaturan cadangan   └─ log\  catatan
```

- **Database ikut di dalam aplikasi.** PostgreSQL bawaan dibuat sendiri pada pemakaian pertama, memakai password
  acak yang tidak perlu diketahui siapa pun, dan hanya menerima sambungan dari komputer itu. PostgreSQL lain yang
  mungkin sudah terpasang tidak disentuh.
- **Tanpa hak Administrator.** Setup tidak meminta izin "Ya/Tidak" Windows. Program boleh dipasang di drive lain
  (mis. `D:\BonsaiUrip`); data tetap di folder pengguna Windows yang memasang.
- **Membuka aplikasi** = klik ikon BonsaiUrip. Layar pembuka cokelat menampilkan langkah yang sedang dikerjakan,
  lalu peramban terbuka ke `http://localhost:7878` dan **ikon BonsaiUrip** muncul di area notifikasi (pojok kanan
  bawah, dekat jam). Menutup peramban tidak mematikan server.
- **Mematikan** = klik kanan ikon BonsaiUrip › *Matikan BonsaiUrip* (atau menu Start › *Matikan BonsaiUrip*).
  Mematikan komputer juga aman.
- **Memperbarui** = jalankan Setup versi baru; aplikasi yang sedang menyala dimatikan dulu secara otomatis, data
  tidak hilang. **Menghapus** aplikasi (Setelan › Aplikasi) juga tidak menghapus data.

## Memasang

1. Salin **Setup-BonsaiUrip.exe** ke komputer itu, lalu klik dua kali.
2. Bila Windows menampilkan *"Windows melindungi PC Anda"* (aplikasi belum bertanda tangan digital):
   klik **Info selengkapnya** › **Tetap jalankan**.
3. Ikuti wizard:
   - **Selamat datang** › *Next*;
   - **Lokasi pemasangan**: biarkan bawaan, atau pilih folder di drive lain › *Next*;
   - **Tugas tambahan**: centang *Buat ikon di desktop* (disarankan) dan, untuk komputer kasir, *Nyalakan BonsaiUrip
     otomatis saat Windows dimulai* › *Next*;
   - **Siap memasang**: periksa folder program dan folder data › *Install*;
   - **Selesai**: biarkan *Buka BonsaiUrip sekarang* tercentang (boleh centang *Buka panduan mulai pakai*) › *Finish*.
4. Layar pembuka tampil. Pemakaian pertama ± 1–3 menit (database dibuat), berikutnya ± 10–20 detik.
5. Peramban membuka halaman **Buat akun pertama**: isi nama, nama pengguna, password (2 kali) › **Buat akun dan
   masuk**. Akun ini adalah Owner.
6. Simpan **kode pemulihan** yang tampil (Salin/Unduh berkas/Cetak) di tempat aman, centang *sudah menyimpan*, lalu
   **Lanjut ke aplikasi**. Kode ini dipakai di *Lupa password?* bila password Owner terlupa.

## Sesudah masuk pertama

1. **Panduan penyiapan** (terbuka sendiri; juga kotak biru di Dashboard atau Pengaturan › *Panduan penyiapan*):
   profil toko › rekening › akun karyawan › barang › stok awal › pelanggan › pemasok › kendaraan & sopir › printer
   struk. Tiap langkah berisi petunjuk dan tombol ke layar yang tepat. Tombol *Isi contoh* membuat 5 contoh per
   jenis untuk mencoba.
2. **Cadangan** (wajib): Pengaturan › Cadangan › *Atur cadangan*: folder di flashdisk/hardisk eksternal/drive lain,
   **Buat sandi**, tulis sandinya di kertas, centang *Sandi sudah saya catat* › **Simpan** › **Cadangkan sekarang**.
   Sesudah itu cadangan berjalan sendiri setiap hari dan diuji pulih sebulan sekali. Program cadangan (restic)
   sudah termasuk di Setup.

## Bila ada masalah

| Gejala | Yang dilakukan |
|---|---|
| Jendela "BonsaiUrip gagal dinyalakan" | Pesannya menyebut sebab dan folder catatan. Foto jendelanya dan kirim ke pengembang. Catatan lengkap: `%LOCALAPPDATA%\BonsaiUrip\log` (`peluncur.log`, `postgres.log`, `server.log`). |
| Peramban menampilkan "tidak dapat dijangkau" | Klik ikon BonsaiUrip di desktop sekali lagi (menyalakan ulang yang belum menyala). |
| Ikon di pojok kanan bawah tidak terlihat | Klik panah **^** di dekat jam; seret ikon BonsaiUrip ke bilah tugas supaya selalu tampil. |
| Lupa password Owner | Halaman masuk › **Lupa password?** dengan kode pemulihan. Tanpa kode: akun Admin/Owner lain me-reset di *Data Pengguna*. Bila tidak ada keduanya, hubungi pengembang. |
| Cadangan gagal | Pengaturan › Cadangan menulis sebabnya (mis. flashdisk tercabut). Colokkan lagi lalu **Cadangkan sekarang**. |
| Mulai dari nol (hapus semua data) | Matikan BonsaiUrip, hapus folder `%LOCALAPPDATA%\BonsaiUrip`, lalu buka BonsaiUrip lagi. **Semua data hilang.** |

## Keamanan

- Database dan aplikasi hanya menerima sambungan dari komputer itu sendiri (`localhost`).
- Password pengguna disimpan dengan argon2id; sesi berakhir sendiri bila lama tidak dipakai (aturan di docs/04).
- Cadangan terenkripsi dengan sandi cadangan; tanpa sandi itu isinya tidak bisa dibuka. Sandi tidak bisa diminta
  ulang dari pengembang.
- Data tersimpan di folder pengguna Windows yang memasang. Beri akun Windows itu password, dan jangan pakai akun
  Windows bersama untuk orang luar.
- Setup belum bertanda tangan digital (perlu sertifikat *code signing* berbayar atas nama toko). Karena itu Windows
  menampilkan peringatan SmartScreen; ambil Setup hanya dari pengembang langsung.

## Batasan versi ini

- Dipakai di **satu komputer** (localhost). Membuka dari HP/tablet di jaringan toko adalah tahap berikutnya (K-204
  bagian 2).

## Lisensi komponen bawaan

Node.js (MIT), PostgreSQL (PostgreSQL License), restic 0.17.3 (BSD 2-Clause). Ketiganya boleh disertakan dalam paket
tanpa biaya. Teks lisensi ikut di folder program masing-masing komponen.

## Untuk pengembang: membuat Setup

`powershell -ExecutionPolicy Bypass -File installer\buat-installer.ps1` (perlu Node 24, pnpm, PostgreSQL 17 sebagai
sumber berkas `pgsql`, Inno Setup 6, dan internet sekali untuk mengunduh restic; unduhannya disimpan di
`installer\alat-cache` dan diperiksa SHA-256). Hasil: `installer\keluaran\Setup-BonsaiUrip.exe`.

- `apps/api/src/peluncur.ts`: data, database bawaan, migrasi, server, berkas langkah `status-peluncur.txt`.
- `installer/peluncur/BonsaiUrip.cs`: layar pembuka, ikon area notifikasi (Buka/Matikan), satu ikon per pengguna.
- `installer/bonsaiurip.iss`: wizard, pintasan, panduan, mematikan aplikasi sebelum memperbarui.

Uji tanpa Setup: `node installer\paket\apps\api\dist\peluncur.js --latar` dengan `BONSAIURIP_DATA` diisi folder uji.
