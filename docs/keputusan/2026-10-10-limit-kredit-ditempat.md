# Keputusan Limit Kredit dengan Persetujuan di Tempat — 10 Oktober 2026

Melanjutkan penomoran dari `2026-10-10-tinjauan-kode.md`. Butir **(pemilik)** diputuskan pemilik proyek
(menyetujui usulan D-K2 dari tinjauan kode); butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-101 — Melampaui limit kredit pelanggan dengan persetujuan atasan di tempat

**Status:** melengkapi PT6 (docs/06 §4, K-088) dan docs/04 §6 (K-099). Cara lama (Admin/Owner yang sedang
login menekan *Setujui & lanjutkan*) tetap berlaku.

**Keputusan:**

1. **(pemilik) Persetujuan di tempat untuk limit kredit.** Bila checkout tidak lunas membuat piutang pelanggan
   melewati `limit_kredit` dan pengguna yang login tidak memegang `master.pelanggan.atur_kredit` (Kasir),
   layar kasir menampilkan dialog *Persetujuan atasan* yang sama dengan retur/void: Admin/Owner mengetik nama
   pengguna dan password-nya sendiri. Penjualan lalu tersimpan atas nama kasir (kasir, shift, dan laci tetap
   milik kasir); tidak ada sesi baru dan sesi kasir tidak berubah.
2. **Yang tercatat:** log `PENJUALAN_LIMIT_OVERRIDE` atas nama **atasan**, dengan keterangan "disetujui di
   tempat, sesi <kasir>", limit, piutang berjalan, dan tagihan baru. Penjualan sendiri tidak diberi kolom
   baru: siapa yang mengizinkan sudah terbaca dari log yang terikat ke nomor dokumennya.
3. **Pengaman sama dengan K-099/K-100:** akun atasan diperiksa seperti login (argon2id, akun aktif, tidak
   terkunci, punya izin `master.pelanggan.atur_kredit`); kegagalan menaikkan hitungan gagal login, mengunci
   akun, dan dicatat `PERSETUJUAN_GAGAL`; pemeriksaan dilakukan sebelum transaksi penjualan agar hitungan gagal
   tidak ikut dibatalkan; batas laju 20 percobaan per menit per kasir; password tidak disimpan di layar maupun
   log, hanya ikut dalam satu permintaan.
4. **Kasir tetap punya jalan lain:** menutup dialog lalu menerima pembayaran lebih dulu sampai piutang masuk
   limit. Pesan dialog menyebut limit, piutang berjalan, dan tagihan baru.
5. **Komponen `DialogAtasan` dipindah** dari `features/koreksi/` ke `components/dialog-atasan.tsx` karena kini
   dipakai tiga alur (retur, void, limit kredit); isian tambahan (pilihan refund) masuk lewat `children`.

*Alasan:* toko memakai satu perangkat. Tanpa ini kasir harus keluar agar atasan bisa masuk hanya untuk menekan
satu tombol, sementara pembeli menunggu; masalah yang sama dengan retur sebelum K-099. Wewenang tetap
berpindah lewat password atasan, bukan lewat akun kasir, dan jejaknya atas nama atasan.

*Ditolak:* batas "boleh lewat limit sampai Rp X tanpa persetujuan" seperti batas bebas retur (limit kredit
sendiri sudah merupakan batas yang diatur atasan; melonggarkannya berarti menaikkan limit pelanggan itu);
menyimpan penjualan dulu lalu meminta persetujuan belakangan (piutang sudah terlanjur terjadi dan barang
sudah keluar); kolom `id_penyetuju_limit` di tabel penjualan (migrasi untuk informasi yang sudah ada di log).
