# Keputusan Pengerasan, Deploy, dan Cadangan (Fase 8) — 4 Oktober 2026

Melanjutkan penomoran dari `2026-10-04-laporan.md`. K-082 lokasi server diputuskan **pemilik proyek**
(pertanyaan 4 Oktober 2026: "Komputer di toko + akses luar", OS Windows 10/11); rincian teknisnya dan K-083–K-085
keputusan teknis Claude Code sesuai kewenangan yang diberikan.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-082 — Server di komputer toko (Windows) + akses luar lewat Tailscale
**Keputusan:**
1. Aplikasi dan PostgreSQL berjalan di satu komputer Windows di toko. Produksi (`NODE_ENV=production`) menyajikan
   API dan hasil build web dari **satu port** (443); aset ber-hash di-cache lama, rute aplikasi dijawab
   `index.html`, berkas yang tidak ada tetap 404.
2. **HTTPS di jaringan toko** dengan CA lokal toko: `buat-sertifikat.ps1` membuat CA (10 tahun) dan sertifikat
   server (2 tahun) untuk nama komputer, localhost, dan semua IP server; `ca-toko.cer` dipasang di komputer
   kasir/admin. Port 80 hanya mengalihkan ke HTTPS. Cookie sesi tetap `Secure` sesuai CLAUDE.md.
3. Akses pemilik dari luar toko lewat **Tailscale** (`tailscale serve --https=8443` → server), sertifikat publik
   Tailscale; origin itu didaftarkan di `ORIGIN_TAMBAHAN` agar lolos CSRF.
4. Server dinyalakan Task Scheduler **"BonsaiUrip Server"** (akun SYSTEM, saat komputer menyala) lewat penjaga
   `jalankan-server.ps1` yang menyalakan ulang bila server berhenti. Log ke `log\server.log` (diputar > 10 MB).
5. Skrip: `pasang-server.ps1` (sekali), `perbarui-server.ps1` (cadangkan → git pull → build → migrasi),
   `pulihkan.ps1` (darurat), `scripts/kasir/pasang-sertifikat.ps1`; `buka-kasir.cmd` membaca `alamat-server.txt`.

**Alasan:** Toko tetap bisa berjualan saat internet mati; tanpa biaya sewa server; Tailscale memberi akses luar
terenkripsi tanpa membuka port router ke internet.
**Ditolak:** VPS (toko lumpuh saat internet mati, biaya bulanan); HTTP biasa di LAN (cookie sesi bisa disadap di
WiFi toko); Caddy/nginx tambahan (komponen ekstra; Node sudah bisa HTTPS); layanan Windows via NSSM (unduhan pihak
ketiga; Task Scheduler sudah ada di Windows).

### K-083 — Pengerasan keamanan (OWASP dasar)
**Keputusan:**
1. Header di setiap respons: CSP hanya sumber sendiri (`style-src 'unsafe-inline'` untuk atribut style React dan
   `<style>` dokumen cetak), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`,
   `Referrer-Policy: same-origin`, HSTS bila HTTPS.
2. Body JSON maksimal 1 MB (413); unggahan tetap memakai batas rutenya.
3. Dependensi: `pnpm audit --prod` wajib bersih; `uuid` (dipakai exceljs) dipaksa ≥ 11.1.1 lewat `overrides`.
   `esbuild` lama di rantai `drizzle-kit` diterima karena hanya alat pengembangan.
4. `.env` dan folder `sertifikat\` di server hanya bisa dibaca Administrators dan SYSTEM.
5. Checklist dan buktinya di `docs/09-keamanan.md`, ditinjau ulang setiap rilis.

**Alasan:** Menutup celah umum (clickjacking, XSS lewat sumber luar, DoS body besar, dependensi rentan) dengan
biaya kecil.
**Ditolak:** WAF/proxy terpisah (berlebihan untuk aplikasi internal); CSP tanpa `unsafe-inline` untuk style
(perlu menulis ulang banyak komponen).

### K-084 — Cadangan data dan uji pulih
**Keputusan:**
1. Isi cadangan: `pg_dump` format custom **tanpa kompresi** (agar restic bisa mendeduplikasi; restic mengompres
   sendiri) + folder `STORAGE_DIR`. Dump sementara selalu dihapus setelah dipakai.
2. Disimpan sebagai snapshot restic terenkripsi di repositori lokal (disk kedua) dan cloud
   (`rclone:gdrive:...`). Retensi `forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --keep-yearly 5
   --prune`. Status BERHASIL bila minimal satu tujuan berhasil; kegagalan tujuan lain tetap memunculkan
   peringatan.
3. Jadwal dijalankan server sendiri (cek tiap 10 menit): harian setelah `CADANGAN_JAM`, atau segera bila cadangan
   berhasil terakhir > 24 jam (server mati semalam); gagal → dicoba lagi paling cepat 1 jam kemudian. Tanggal 1
   tiap bulan disusul uji pulih.
4. Uji pulih: dump snapshot terbaru diambil (`restic dump`), diperiksa (`pg_restore --list`), lalu dipulihkan ke
   database sementara `<nama>_ujipulih` (hanya nama berakhiran `_ujipulih` yang boleh dihapus), dihitung isinya,
   dan dihapus. Bila user database tidak punya hak CREATEDB, hasilnya "terbatas" (arsip diverifikasi utuh);
   `pasang-server.ps1` membuat user dengan CREATEDB.
5. Riwayat di tabel `cadangan` (migrasi 0004); Pengaturan › Cadangan untuk izin baru `sistem.cadangan.kelola`
   (Owner): status, lokasi, retensi, "Cadangkan sekarang", "Uji pulih sekarang", riwayat. Lonceng Owner
   menampilkan "Cadangan data perlu diperiksa" bila gagal, terlewat > 26 jam, tidak sampai cloud/lokal, uji pulih
   gagal, atau (produksi) belum diatur. Log aksi `CADANGAN_JALANKAN`, `CADANGAN_UJI_PULIH`.
6. Lokasi dan kata sandi repositori di `.env` (bukan di tabel konfigurasi): rahasia dan khusus mesin. Kata sandi
   hanya dikirim ke restic lewat variabel lingkungan, tidak lewat argumen.
7. `pulihkan.ps1`: menampilkan snapshot, meminta ketik `PULIHKAN`, menyimpan isi database sekarang sebagai
   pengaman, memulihkan database (`pg_restore --clean --if-exists`) dan folder gambar (`restore --delete`),
   menjalankan migrasi, lalu menyalakan server.

**Alasan:** Sesuai rancangan K-062 (snapshot terdeduplikasi seperti git, retensi berjenjang, lokal + cloud);
uji pulih membuktikan cadangan benar-benar bisa dipakai.
**Ditolak:** Task Scheduler terpisah untuk cadangan (status sulit ditampilkan di aplikasi); `pg_dump` terkompresi
(deduplikasi tidak efektif); menyimpan kata sandi cadangan di database (ikut tercadangkan dan bisa bocor).

### K-085 — Lima alur kritis Playwright
**Keputusan:** Tes yang sudah ada ditandai `@kritis` dan dijalankan dengan `pnpm test:e2e:kritis` sebelum setiap
pembaruan server: (1) Owner menambah kasir → kasir wajib ganti password → dinonaktifkan; (2) staf input order cepat
→ kasir bayar dengan keyboard; (3) pengantaran DP → dua surat jalan → pelunasan; (4) penerimaan barang tunai →
stok bertambah; (5) shift: kasbon, jual tunai, tutup shift blind count.

**Alasan:** Kelima alur mewakili akses, uang masuk, piutang, stok, dan kas — bila salah satunya rusak toko tidak
bisa beroperasi. Menandai tes yang sudah stabil lebih murah daripada menulis tes baru.
**Ditolak:** satu tes raksasa "satu hari toko" (lambat dan sulit didiagnosis bila gagal).
