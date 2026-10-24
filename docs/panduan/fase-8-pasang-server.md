# Panduan Fase 8 — Memasang Server di Toko (Windows 10/11)

Untuk: pemilik toko / orang yang memasang. Waktu: ± 2 jam pertama kali. Kerjakan berurutan; setiap bagian
punya cara memeriksa hasilnya. Keputusan rancangan: K-082 (server di toko + akses luar Tailscale),
K-083 (keamanan), K-084 (cadangan).

```
              Jaringan toko (LAN/WiFi)                         Internet
 ┌───────────────────────┐   https://NAMA-SERVER/     ┌───────────────────────────┐
 │ Komputer SERVER       │◄───────────────────────────│ Komputer kasir / admin    │
 │ (mini-PC, selalu on)  │                            │ (Chrome/Edge)             │
 │ PostgreSQL + aplikasi │◄──── Tailscale (aman) ─────│ HP / laptop pemilik       │
 │ Disk cadangan (E:)    │──── salinan cadangan ─────►│ Google Drive (terenkripsi)│
 └───────────────────────┘                            └───────────────────────────┘
```

Kasir tetap bisa berjualan walaupun internet mati, karena server ada di toko.

---

## 1. Siapkan perangkat

- **Komputer server**: mini-PC/PC Windows 10/11, RAM ≥ 8 GB, SSD ≥ 256 GB. Dinyalakan terus (atur Windows:
  *Pengaturan › Sistem › Daya* → layar boleh mati, **komputer jangan tidur**).
- **UPS** untuk server dan router: listrik padam sebentar tidak mematikan server.
- **Disk kedua untuk cadangan**: harddisk/SSD eksternal atau disk internal kedua, mis. huruf `E:`.
- **Alamat IP tetap**: di pengaturan router, buat *DHCP reservation* untuk server (mis. `192.168.1.10`), supaya
  alamatnya tidak berganti. Catat **nama komputer** server: *Pengaturan › Sistem › Tentang* (mis. `SERVER-TOKO`).

## 2. Pasang program (sekali)

Semua sebagai pengguna Administrator. Setelah setiap pemasangan, tutup dan buka lagi PowerShell.

1. **Node.js 24 LTS** — https://nodejs.org (x64 .msi). Cek: `node -v` → `v24.x`.
2. **pnpm** — PowerShell (Run as administrator): `npm install -g pnpm@12`. Cek: `pnpm -v`.
3. **PostgreSQL 17** — https://www.postgresql.org/download/windows/ (installer EDB). Catat **password user
   `postgres`** yang Anda buat. Biarkan port 5432. Cek: `psql --version` (bila tidak dikenal, tambahkan
   `C:\Program Files\PostgreSQL\17\bin` ke PATH).
4. **Git** — https://git-scm.com/download/win. Cek: `git --version`.
5. **restic** (cadangan) — unduh `restic_x.y.z_windows_amd64.zip` dari https://github.com/restic/restic/releases,
   ekstrak, ganti nama menjadi `restic.exe`, simpan di `C:\BonsaiUrip\alat\restic.exe`.
6. **rclone** (cadangan ke Google Drive, opsional tetapi disarankan) — https://rclone.org/downloads/ (Windows
   AMD64), simpan `rclone.exe` di `C:\BonsaiUrip\alat\rclone.exe`.

## 3. Ambil aplikasi

```powershell
PS> mkdir C:\BonsaiUrip
PS> git clone https://github.com/Swaytys/sit-tbsu.git C:\BonsaiUrip\sit-tbsu
```

## 4. Jalankan pemasang

PowerShell **Run as administrator**:

```powershell
PS> cd C:\BonsaiUrip\sit-tbsu
PS> powershell -ExecutionPolicy Bypass -File scripts\server\pasang-server.ps1
```

Yang ditanyakan:
- *Password user database 'sit'* → buat password baru (simpan).
- *Password user postgres* → password dari langkah 2.3 (hanya bila database belum ada).

Skrip memasang dependency, build, membuat database & akun owner, sertifikat HTTPS, membuka port 443/80 untuk
jaringan pribadi, dan mendaftarkan tugas **"BonsaiUrip Server"** yang menyalakan aplikasi setiap komputer
menyala. Di akhir tercetak **password awal Owner** — catat.

**Periksa:** di server buka `https://localhost/` (muncul peringatan sertifikat — normal sebelum langkah 5) lalu
login sebagai `owner` dengan password awal; Anda diminta mengganti password.

## 5. Komputer kasir dan admin (sekali per komputer)

1. Salin dua berkas dari server ke komputer itu (flashdisk/folder bersama):
   `C:\BonsaiUrip\sit-tbsu\sertifikat\ca-toko.cer` dan folder `C:\BonsaiUrip\sit-tbsu\scripts\kasir\`.
   **Jangan** menyalin berkas `.pfx` atau `.env`.
2. Taruh `ca-toko.cer` di folder `kasir`, lalu PowerShell (Run as administrator):
   `powershell -ExecutionPolicy Bypass -File pasang-sertifikat.ps1`.
3. Buat berkas `alamat-server.txt` di folder `kasir` berisi satu baris: `https://SERVER-TOKO/penjualan-langsung`
   (ganti `SERVER-TOKO` dengan nama komputer server; bila tidak bisa, pakai IP: `https://192.168.1.10/...`).
4. Komputer kasir: ikuti `scripts/kasir/README.md` (printer struk sebagai printer bawaan), lalu klik dua kali
   `buka-kasir.cmd`. Komputer admin: cukup buka Chrome ke `https://SERVER-TOKO/`.

**Periksa:** gembok di bilah alamat tanpa peringatan; login berhasil; transaksi uji mencetak struk.

## 6. Akses dari luar toko (Tailscale)

1. Buat akun di https://tailscale.com (gratis untuk pemakaian pribadi). Pasang **Tailscale** di server dan di
   HP/laptop pemilik, login dengan akun yang sama.
2. Di https://login.tailscale.com/admin/dns aktifkan **MagicDNS** dan **HTTPS Certificates**.
3. Di server, PowerShell (administrator):
   `tailscale serve --bg --https=8443 https+insecure://localhost:443`
   Perintah ini mencetak alamat seperti `https://server-toko.tailxxxx.ts.net:8443`.
4. Tambahkan alamat itu ke `.env` server: `ORIGIN_TAMBAHAN=https://server-toko.tailxxxx.ts.net:8443`, lalu
   nyalakan ulang aplikasi (lihat bagian 10).

**Periksa:** dari HP (data seluler, bukan WiFi toko) buka alamat tadi → login → buka Dashboard.

## 7. Cadangan data (wajib)

Cadangan berisi database lengkap + gambar barang/logo, **terenkripsi**, disimpan di disk kedua **dan** Google
Drive. Disimpan 7 harian, 4 mingguan, 12 bulanan, 5 tahunan; yang lebih lama dibuang otomatis. Berjalan otomatis
setiap hari (jam di `.env`) dan diuji pulih otomatis setiap tanggal 1.

1. Buat folder di disk kedua, mis. `E:\BonsaiUrip-cadangan`.
2. Buat **kata sandi cadangan** panjang (≥ 16 karakter). **Tulis di kertas dan simpan di tempat aman di luar
   toko.** Tanpa kata sandi ini cadangan TIDAK BISA dibuka oleh siapa pun.
3. Google Drive (disarankan): PowerShell (administrator):
   ```powershell
   PS> C:\BonsaiUrip\alat\rclone.exe config --config C:\BonsaiUrip\sit-tbsu\sertifikat\rclone.conf
   ```
   Pilih `n` (new remote) → nama `gdrive` → jenis `drive` (Google Drive) → client id/secret kosong → scope `1`
   (full) → sisanya Enter → login Google di peramban yang terbuka → `q` untuk keluar.
4. Tambahkan ke `C:\BonsaiUrip\sit-tbsu\.env` (Notepad sebagai administrator):
   ```
   CADANGAN_REPO_LOKAL=E:\BonsaiUrip-cadangan
   CADANGAN_REPO_CLOUD=rclone:gdrive:BonsaiUrip-cadangan
   CADANGAN_SANDI=kata-sandi-cadangan-anda
   CADANGAN_RESTIC=C:\BonsaiUrip\alat\restic.exe
   CADANGAN_RCLONE=C:\BonsaiUrip\alat\rclone.exe
   RCLONE_CONFIG=C:\BonsaiUrip\sit-tbsu\sertifikat\rclone.conf
   CADANGAN_PG_BIN=C:\Program Files\PostgreSQL\17\bin
   CADANGAN_JAM=21
   ```
5. Nyalakan ulang aplikasi (bagian 10).

**Periksa:** login Owner → *Pengaturan › Cadangan* → **Cadangkan sekarang** → status *Berhasil* (lokal & cloud
berhasil). Lalu **Uji pulih sekarang** → *Berhasil*. Bila ada masalah, lonceng notifikasi Owner menampilkan
"Cadangan data perlu diperiksa".

## 8. Pemulihan darurat

Bila database rusak, data terhapus, atau komputer server diganti:

1. (Server baru) kerjakan bagian 1–4 dan isi `.env` cadangan seperti bagian 7 dengan **kata sandi yang sama**.
2. PowerShell (administrator):
   ```powershell
   PS> cd C:\BonsaiUrip\sit-tbsu
   PS> powershell -ExecutionPolicy Bypass -File scripts\server\pulihkan.ps1
   ```
   Tambahkan `-DariCloud` bila disk lokal ikut rusak, atau `-Snapshot 1a2b3c4d` untuk memilih snapshot tertentu
   (daftar snapshot tampil di layar). Ketik `PULIHKAN` untuk melanjutkan.
3. Skrip menyimpan isi database sekarang ke `pulih\<waktu>\sebelum-pulih.dump` sebagai pengaman, memulihkan
   database & gambar, lalu menyalakan aplikasi. Semua transaksi setelah waktu snapshot hilang — catat ulang.

## 9. Memperbarui aplikasi

Saat ada versi baru di GitHub, PowerShell (administrator):

```powershell
PS> cd C:\BonsaiUrip\sit-tbsu
PS> powershell -ExecutionPolicy Bypass -File scripts\server\perbarui-server.ps1
```

Lakukan di luar jam toko (± 5–10 menit). Urutan skrip:

1. Menghentikan aplikasi (tidak ada transaksi baru).
2. Cadangan "sebelum pembaruan" ke disk lokal (dan cloud bila diatur). Gagal = berhenti, aplikasi dinyalakan lagi.
3. Mengambil versi baru (`git pull`), memasang dependency, build.
4. **Uji migrasi pada salinan**: database toko disalin ke database sementara, perubahan struktur dicoba di sana, dan
   jumlah baris setiap tabel dibandingkan. Ada data yang hilang = berhenti; database asli tidak disentuh.
5. Memperbarui struktur database asli.
6. Menyalakan aplikasi dan memeriksa versi serta jumlah migrasi (tampil "Pembaruan selesai: versi lama -> baru").

Bila langkah 3–5 gagal, skrip **mengembalikan kode ke versi sebelumnya** dan menyalakan aplikasi versi lama;
pesan merah menjelaskan sebabnya. Bila aplikasi tidak bisa menyala sama sekali, pulihkan cadangan langkah 2
(bagian 8, snapshot terbaru). Uji migrasi dapat dicoba kapan saja tanpa memperbarui:
`pnpm db:uji-migrasi` (user database wajib punya hak CREATEDB; pemasang sudah memberikannya).

Setelah selesai, buka aplikasi di komputer kasir, tekan **Ctrl+F5**, lalu menu pengguna › **Tentang aplikasi**:
versi tampilan dan server harus sama, struktur database "N/N".

## 10. Menyalakan ulang aplikasi

*Task Scheduler › Task Scheduler Library › BonsaiUrip Server* → klik kanan **End**, lalu **Run**. Atau restart
komputer server. Log ada di `C:\BonsaiUrip\sit-tbsu\log\` (`server.log`, `penjaga.log`).

## 11. Perawatan rutin

| Kapan | Apa |
|---|---|
| Setiap minggu | Owner membuka *Pengaturan › Cadangan*: cadangan terakhir hari ini/kemarin, lokal & cloud berhasil. |
| Setiap bulan | Lihat hasil uji pulih tanggal 1 (*Berhasil*). |
| Awal tahun (setelah semua dokumen tahun lalu selesai) | Owner: *Pengaturan › Arsip tahunan* › **Tutup tahun** tahun lalu, lalu **Periksa**. Berkas arsip ikut cadangan malam itu. |
| Setiap 2 tahun | Perbarui sertifikat: `scripts\server\buat-sertifikat.ps1 -KataSandi <HTTPS_PFX_PASSWORD dari .env>` lalu nyalakan ulang aplikasi (komputer kasir tidak perlu dipasang ulang). Juga bila IP server berubah. |
| Otomatis | Windows Update di server (atur jam aktif agar tidak restart saat toko buka). |

## 12. Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| "Koneksi Anda tidak pribadi" di komputer kasir | `ca-toko.cer` belum dipasang (bagian 5.2), atau membuka alamat yang tidak ada di sertifikat (pakai nama komputer/IP server). |
| Halaman tidak bisa dibuka dari komputer lain | Server mati/tidur; firewall: jaringan Windows harus *Private*; IP server berubah (bagian 1). |
| Bisa dibuka tetapi tidak bisa login | Jam komputer server salah; periksa `log\server.log`. |
| Simpan data gagal saat lewat Tailscale ("asal permintaan tidak dikenal") | `ORIGIN_TAMBAHAN` di `.env` belum sama persis dengan alamat Tailscale (termasuk `:8443`). |
| Notifikasi "Cadangan data perlu diperiksa" | Buka *Pengaturan › Cadangan*, baca keterangan. Disk eksternal tercabut, internet mati (cloud), atau kata sandi `.env` berubah. |
