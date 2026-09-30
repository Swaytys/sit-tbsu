# Keputusan Akses Dasar (Fase 2) — 30 September 2026

Melanjutkan penomoran dari `2026-09-29-setup-fase-1.md`. Keputusan teknis diambil Claude Code sesuai
kewenangan yang diberikan pemilik proyek (keputusan teknis diserahkan; konsep bisnis tetap ditanyakan).

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-054 — Login, sesi, dan penjaga izin
**Keputusan:**
1. **Guard default** = pemeriksaan saat server menyala: `periksaDeklarasiIzin()` membaca daftar rute Hono dan
   server menolak menyala bila ada rute tanpa `requirePermission` / `requireLogin` yang tidak terdaftar publik.
   Ada tes yang memastikan daftarnya kosong.
2. Rute milik pengguna sendiri (`POST /api/auth/logout`, `GET /api/auth/saya`, `POST /api/auth/ganti-password`)
   memakai `requireLogin()` — butuh login, tanpa izin khusus. Ini melengkapi daftar pengecualian CLAUDE.md
   aturan 5 (publik: `POST /api/auth/login`, `GET /api/health`).
3. **Izin membaca satuan** = `master.barang.lihat` (semua peran), karena nama satuan tampil di barang, order,
   dan struk. Mengubah satuan tetap `master.satuan.kelola` (Fase 3). Menutup catatan terbuka K-051.
4. **Sesi**: token acak 256 bit di cookie `sit_sesi` (httpOnly, SameSite=Lax, Secure di produksi); database
   menyimpan `sha256(token)`. `terakhir_aktif` diperbarui paling sering sekali per menit. `SESSION_SECRET` belum
   dipakai (token acak 256 bit tidak memerlukan kunci tambahan); disimpan untuk kebutuhan nanti.
5. **Kode error baru**: `WAJIB_GANTI_PASSWORD` (403, pengguna harus mengganti password dulu) dan
   `TERLALU_BANYAK_PERCOBAAN` (429, rate limit login).
6. **Aksi log baru** (melengkapi docs/05 §16): `PENGGUNA_AKTIFKAN`, `PENGGUNA_GANTI_PASSWORD`,
   `PENGGUNA_CABUT_SESI`.
7. **Username** dinormalisasi: spasi di tepi dibuang, huruf kecil semua.
8. **Rate limit** 20 percobaan/menit per IP disimpan di memori server (cukup untuk satu server). Bila kelak di
   belakang reverse proxy, IP asli dibaca dari header proxy tepercaya (Fase 8).
9. **Masuk cepat per peran** memakai akun demo `demo.owner`, `demo.admin`, `demo.kasir`, `demo.staf` yang dibuat
   seed hanya saat `NODE_ENV=development` (password = `SEED_OWNER_PASSWORD`, tanpa wajib ganti). Rute
   `POST /api/auth/masuk-cepat` hanya dipasang di mode pengembangan dan service-nya menolak di mode lain;
   tombol di web dirender di dalam `import.meta.env.DEV` dan terverifikasi tidak ada di bundle produksi.
   Akun Owner sungguhan (`owner`) tidak pernah bisa dimasuki lewat jalur ini.
10. **Menu** sesuai docs/04 §4 tampil lengkap menurut izin sejak Fase 2. Halaman yang belum dibangun menampilkan
    "sedang disiapkan — Fase N". Halaman satuan kini berada di `/kategori-satuan` (menu "Kategori, Satuan &
    Atribut", izin `master.kategori.kelola`), menunggu tab kategori/atribut di Fase 3.
11. **Konfigurasi** di-cache di memori; di dalam transaksi dibaca lewat `tx` yang sama. Membaca lewat pool saat
    semua koneksi dipegang transaksi membuat semuanya saling menunggu (ditemukan oleh tes 50 penomoran paralel).
12. **Seed**: kode pengguna diterbitkan lewat penomoran (N5) dan penghitung `USR` disinkronkan dengan kode yang
    sudah ada; konfigurasi `batas_kunci_order_menit` dan `jatuh_tempo_default_hari` (docs/05 §15) ditambahkan.
13. Port dev bisa diubah bila bentrok: `PORT_WEB`, `PORT_API` (Vite), `PORT` (API), `E2E_URL` (Playwright).

**Alasan:** Menjalankan docs/04 §7 dan CLAUDE.md § Keamanan dengan cara yang bisa diuji otomatis; menutup celah
"rute lupa diberi izin" sejak awal, bukan hanya lewat review.
**Ditolak:** Guard saat runtime yang memeriksa setelah handler jalan (efek samping sudah terjadi); JWT (tidak bisa
dicabut seketika saat akun dinonaktifkan); menyembunyikan menu yang belum dibangun (peran tidak bisa diuji sesuai
docs/04 §4 sampai Fase 7).

### K-055 — Kelola pengguna, pengaturan, dan log aktivitas
**Keputusan:**
1. **Kelola pengguna** (Owner): kode `USR` dari penomoran; pengguna baru wajib ganti password saat login pertama;
   Owner tidak bisa menonaktifkan akun sendiri, dan reset password akun sendiri diarahkan ke menu Ganti password.
   Aturan "Owner terakhir" dijaga dengan mengunci baris Owner aktif (`FOR UPDATE`), sehingga dua Owner yang saling
   menonaktifkan bersamaan tidak bisa menghabiskan semua Owner (teruji). Mengaktifkan kembali ikut membuka kunci
   gagal login. Perubahan peran berlaku seketika pada sesi yang sedang aktif (izin dihitung tiap request).
2. **Pengaturan** dikelompokkan per bagian (profil toko, penomoran, operasional, harga & diskon, keamanan) dan
   disimpan lewat `PATCH /api/pengaturan` (satu atau beberapa bagian). Hanya nilai yang berubah yang ditulis dan
   dicatat `PENGATURAN_UBAH` (kode konfigurasi: lama → baru). Batas isian: prefix 2–5 huruf dan unik antar-jenis
   dokumen; digit nomor 3–6; batas gagal login 3–20; panjang minimal password 8–64; lebar struk 58/80 mm.
   Idle timeout dan batas absolut sesi tetap di `.env` (bukan pengaturan layar).
3. **Log aktivitas** tampil sebagai tab "Log aktivitas" di halaman Pengaturan, hanya bila `sistem.log.lihat`
   (Owner), sesuai docs/04 §4: daftar terbaru dulu, cari, saring aksi, tampilkan perubahan lama → baru. Tidak ada
   rute ubah/hapus log (teruji).
4. `zod` ditambahkan sebagai dependency web (versi catalog yang sama) untuk tipe input/output form.
**Alasan:** Menyelesaikan deliverable Fase 2 (roadmap) dengan aturan docs/04 §7–8 yang diuji otomatis.
**Ditolak:** Menghapus pengguna (bertentangan dengan K-021); satu formulir raksasa untuk semua pengaturan (galat
di tab lain tidak terlihat).
