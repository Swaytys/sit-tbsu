# Panduan Uji Deploy di Satu Laptop (localhost)

Untuk: pemilik. Waktu: ± 45 menit pertama kali. Tujuannya mencoba aplikasi seperti nanti dipakai di toko, di
**satu laptop** yang sekaligus menjadi server dan tempat membuka aplikasi.

```
 ┌─────────────────────────────── Laptop server ───────────────────────────────┐
 │ PostgreSQL (database "tbsu")  ◄──  Aplikasi BonsaiUrip (menyala otomatis)    │
 │ Folder C:\BonsaiUrip\sit-tbsu (kode, storage, log, cadangan, sertifikat)     │
 │                         ▲                                                    │
 │ Chrome/Edge: https://localhost/  (pintasan "BonsaiUrip" di desktop)          │
 └──────────────────────────────────────────────────────────────────────────────┘
   (opsional) HP/komputer lain di WiFi yang sama: https://NAMA-LAPTOP/
```

- Semua data (database, gambar barang, cadangan) ada di laptop itu. Tidak ada server di internet.
- Aplikasi menyala sendiri setiap laptop dinyalakan. Laptop mati/tidur = aplikasi mati; nyalakan lagi, tunggu ±30
  detik, buka pintasan.
- Ini **salinan terpisah** dari folder pengembangan `D:\sit-tbsu` dan memakai database terpisah (`tbsu`, bukan
  `tbsu_dev`). Uji coba tidak mengganggu pengembangan, dan sebaliknya.

## 1. Sebelum mulai

1. Laptop dicolok listrik. Setelah dipasang, laptop **tidak tidur** saat dicolok listrik dan **menutup layar
   tidak mematikan server**. Saat memakai baterai, Windows tetap boleh tidur.
2. Program yang dibutuhkan: Node.js 24, pnpm, PostgreSQL 17, Git. Di laptop pengembangan semuanya **sudah
   terpasang**. Di laptop lain, pasang dulu sesuai `fase-8-pasang-server.md` bagian 2 (nomor 1–4).
3. Siapkan **password user `postgres`** (dibuat saat memasang PostgreSQL). Bila lupa, lihat bagian 7.

## 2. Ambil aplikasi (sekali)

Buka **PowerShell** biasa:

```powershell
PS> mkdir C:\BonsaiUrip
PS> git clone https://github.com/Swaytys/sit-tbsu.git C:\BonsaiUrip\sit-tbsu
```

## 3. Pasang

1. Klik Start, ketik `PowerShell`, klik kanan **Windows PowerShell** › **Run as administrator** › Yes.
2. Ketik:

   ```powershell
   PS> cd C:\BonsaiUrip\sit-tbsu
   PS> powershell -ExecutionPolicy Bypass -File scripts\server\pasang-server.ps1
   ```

3. Pertanyaan yang muncul:
   - *Password user database 'sit'*: bila laptop pengembangan, ketik password user `sit` yang sudah ada (di
     `D:\sit-tbsu\.env`, bagian `DATABASE_URL` setelah `sit:` sampai `@`). Laptop lain: buat password baru dan
     catat.
   - *Password user postgres*: hanya ditanya bila database `tbsu` belum ada.
4. Tunggu ±5–10 menit (memasang, build, membuat database). Di akhir tertulis **SERVER SIAP** dan **password
   awal Owner**. **Foto/catat password itu.**

Bila berhenti dengan tulisan merah, foto layarnya dan kirim ke pengembang; jalankan ulang perintah yang sama
setelah diperbaiki (aman diulang).

## 4. Buka dan siapkan aplikasi

1. Klik dua kali pintasan **BonsaiUrip** di desktop (atau buka Chrome ke `https://localhost/`). Gembok tampil
   tanpa peringatan.
2. Login `owner` dengan password awal → ganti password.
3. Isi, berurutan:
   - *Pengaturan › Profil toko* (nama, alamat, telepon, logo).
   - *Pengaturan › Pembayaran* (rekening bank/QRIS).
   - *Pengaturan › Operasional* (jadwal shift dan lainnya).
   - *Data Pengguna*: akun tiap pegawai (Admin, Kasir, Staf Penjualan), masing-masing password sendiri.
   - *Data Barang › Import* (templat Excel): barang, harga, saldo awal stok. Lalu pelanggan dan pemasok.
   - *Pengaturan › Struk & printer*: printer struk dan kertas invoice/surat jalan.
4. Coba alur inti: order → kasir bayar → struk; pengantaran + surat jalan; retur/void; buka/tutup shift;
   penerimaan barang. Catat hasilnya di `docs/UJI-PEMILIK.md` (cukup sebut nomornya ke pengembang).

## 5. Cadangan (wajib sebelum data sungguhan)

Colok flashdisk/HDD eksternal, lalu ikuti `fase-8-pasang-server.md` bagian 7 (Google Drive boleh dilewati dulu).
Periksa di *Pengaturan › Cadangan*: **Cadangkan sekarang** → *Berhasil*.

## 6. Membuka dari HP/komputer lain (opsional)

1. Laptop dan HP di WiFi yang sama. Di laptop: *Setelan › Jaringan & internet › WiFi* › nama WiFi › jenis
   jaringan **Pribadi** (Private). Firewall hanya membuka akses di jaringan pribadi.
2. Komputer lain (Windows): pasang sertifikat sesuai `fase-8-pasang-server.md` bagian 5, lalu buka
   `https://NAMA-LAPTOP/` (nama di *Setelan › Sistem › Tentang*).
3. HP Android sering tidak mengenal nama laptop dan tidak memercayai sertifikat toko; peramban HP akan memberi
   peringatan. Untuk uji coba cukup di laptop. Akses HP yang rapi memakai Tailscale (bagian 6 panduan server).

## 7. Mematikan, menyalakan, melepas, memperbarui

Semua di PowerShell **Run as administrator**, dari `C:\BonsaiUrip\sit-tbsu`:

| Mau apa | Perintah |
|---|---|
| Matikan sementara (menyala lagi saat laptop restart) | `powershell -ExecutionPolicy Bypass -File scripts\server\copot-server.ps1 -Hentikan` |
| Nyalakan lagi | `powershell -ExecutionPolicy Bypass -File scripts\server\copot-server.ps1 -Nyalakan` |
| Lepas dari laptop (data tetap ada) | `powershell -ExecutionPolicy Bypass -File scripts\server\copot-server.ps1` |
| Pasang perbaikan terbaru dari pengembang | `powershell -ExecutionPolicy Bypass -File scripts\server\perbarui-server.ps1` |

`perbarui-server.ps1` mencadangkan dulu, menguji perubahan database pada salinan, lalu menyalakan versi baru;
bila gagal, kembali ke versi lama otomatis.

**Lupa password postgres:** pasang ulang PostgreSQL tidak perlu; minta pengembang menjalankan reset password
lewat `pg_hba.conf` (butuh ±10 menit).

## 8. Masalah umum

| Gejala | Jalan keluar |
|---|---|
| Pintasan membuka halaman "tidak dapat dijangkau" | Tunggu 30 detik setelah laptop menyala. Masih? `copot-server.ps1 -Nyalakan`. Lihat `C:\BonsaiUrip\sit-tbsu\log\penjaga.log`. |
| Peringatan "koneksi tidak pribadi" | Jalankan lagi `pasang-server.ps1` (memasang ulang kepercayaan sertifikat), tutup lalu buka peramban. |
| Aplikasi mati setelah laptop ditutup | Laptop sedang memakai baterai. Colok listrik. |
| Port 443 dipakai program lain | Tutup program itu (mis. server web lain), lalu `copot-server.ps1 -Nyalakan`. |
