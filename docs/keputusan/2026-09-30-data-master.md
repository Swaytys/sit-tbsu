# Keputusan Data Master (Fase 3) — 30 September 2026

Melanjutkan penomoran dari `2026-09-30-akses-dasar.md`. K-056 dijawab pemilik proyek; sisanya keputusan teknis
Claude Code sesuai kewenangan yang diberikan pemilik proyek.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-056 — Keputusan bisnis Fase 3 (dijawab pemilik proyek)
**Keputusan:**
1. **Tanda perlu tinjau harga dipasang sejak Fase 3**, sesuai docs/06 H5: `barang.perlu_tinjau_harga = true`
   ketika `harga_modal_awal` diubah sebelum ada penerimaan, `harga_titip` berubah, atau `markup_default_persen`
   tier berubah (untuk barang yang punya baris IKUT_TIER di tier itu). Tanda tampil sebagai lencana di daftar
   barang dan lepas saat harga barang itu disimpan manual. Halaman Tinjau Harga tetap Fase 9. Ini menegaskan
   docs/06 H5 dan mempersempit kalimat K-047 ("tanda perlu tinjau ... tetap Fase 9") menjadi: hanya halaman
   Tinjau Harga dan penerapan otomatis yang Fase 9.
2. **No. HP wajib** untuk pelanggan dan pemasok (dipakai untuk konfirmasi pengantaran dan penagihan).
3. **Import Excel barang hanya menambah barang baru.** Baris yang kodenya sudah ada dilewati dan dilaporkan di
   pratinjau; tidak ada pembaruan massal lewat import.

**Alasan:** (1) Tanda yang dipasang sejak awal tidak kehilangan riwayat pemicu sebelum Fase 9. (2) Toko
menghubungi pelanggan/pemasok lewat telepon/WhatsApp. (3) Import yang menimpa data berisiko mengubah harga dan
nama barang tanpa sadar.
**Ditolak:** tanda dipasang mulai Fase 9; No. HP opsional; import menimpa barang lama.

### K-057 — Aturan data referensi (kategori, satuan, jenis atribut)
**Keputusan:**
1. **Satu halaman bertab** "Kategori, Satuan & Atribut" (`/kategori-satuan`), izin menu
   `master.kategori.kelola`. Membaca daftar memakai `master.barang.lihat` (dibutuhkan form barang semua peran).
   Mengubah kategori: `master.kategori.kelola`; satuan dan jenis atribut: `master.satuan.kelola`.
2. **Kategori**: nama unik tanpa membedakan huruf besar/kecil.
3. **Satuan**: tepat satu satuan basis per dimensi fisik (panjang, luas, volume, berat, daya); satuan non-basis
   hanya bisa dibuat bila basisnya sudah ada. Satuan JUMLAH/LAINNYA selalu basis dengan faktor 1 (konversi
   "1 dus = 12 buah" diatur per barang, Fase 12). Faktor boleh diketik dengan koma. Setelah satuan dipakai
   (satuan dasar barang, satuan atribut, atau satuan jual), jenis dimensi, faktor, dan status basisnya dikunci;
   nama dan kode tetap bisa diubah.
4. **Jenis atribut**: kode huruf besar (`PANJANG`, `WARNA`); atribut TEKS tidak punya dimensi. Setelah dipakai
   barang, tipe nilai dan dimensinya dikunci.
5. **Aksi log baru** (melengkapi docs/05 §16): `KATEGORI_*`, `SATUAN_*`, `JENIS_ATRIBUT_*`, `TIER_*`
   (BUAT/UBAH/NONAKTIF/AKTIFKAN) serta `BARANG_AKTIFKAN`, `PELANGGAN_AKTIFKAN`, `PEMASOK_AKTIFKAN`.
   Log ubah hanya mencatat kolom yang berubah (nilai lama dan baru).

**Alasan:** Mengubah faktor atau dimensi satuan yang sudah dipakai akan mengubah arti kuantitas yang sudah
tersimpan di transaksi. Dua basis dalam satu dimensi membuat konversi ambigu.
**Ditolak:** menghapus satuan/kategori yang belum dipakai (data master tidak dihapus, CLAUDE.md aturan 4).

### K-058 — Helper uang dan kuantitas di `packages/shared`
**Keputusan:** `money.ts` (pembulatan rupiah ROUND_HALF_UP, markup, pembulatan ke kelipatan harga ke atas,
format `Rp 1.234.567`) dan `qty.ts` (aritmatika dan konversi kuantitas) memakai `decimal.js` 10.6.0 di
`packages/shared`, dipakai API dan web. Kode API tidak mengimpor `decimal.js` langsung; perbandingan qty memakai
`bandingQty()`. Komponen `InputAngka` dipindah ke `apps/web/src/components` karena dipakai lintas fitur.
**Alasan:** Satu sumber aturan pembulatan (docs/06 U1, U4, H4) untuk API dan tampilan sementara di web.
**Ditolak:** aritmatika `number` biasa untuk qty (melanggar CLAUDE.md aturan 8).

### K-059 — Tier, term, dan limit kredit pelanggan hanya Admin/Owner (dijawab pemilik proyek)
**Keputusan:** Izin baru `master.pelanggan.atur_kredit` (Admin, Owner) untuk mengatur tier harga default, term
hari, dan limit kredit pelanggan. Staf dan Kasir tetap menambah/mengubah data kontak pelanggan
(`master.pelanggan.kelola`); pelanggan baru dari mereka memakai tier default toko (`id_tingkat_harga = null`),
term `term_hari_default`, dan tanpa limit. API menolak (403) permintaan tanpa izin yang mengubah ketiga nilai
itu; nilai yang tidak dikirim berarti bawaan (tambah) atau nilai lama (ubah). Kode pelanggan `PLG-00001` dan
pemasok `PMS-00001` diterbitkan penomoran dan tidak bisa diubah (N5). Tier nonaktif tidak bisa dipilih.
Daftar tingkat harga (`GET /api/tingkat-harga`) dibaca semua peran; `markup_default_persen` hanya dikirim ke
pemegang `master.barang.lihat_hpp`.
**Alasan:** Staf tidak boleh mengganti tier di order (`penjualan.tier.ubah`); tanpa pembatasan ini Staf bisa
memberi harga lebih murah lewat tier default pelanggan. Term dan limit adalah kebijakan kredit toko.
**Ditolak:** semua pemegang `master.pelanggan.kelola` boleh mengatur (celah harga); Kasir ke atas.

### K-060 — Aturan teknis barang, harga, dan tier (Fase 3)
**Keputusan:**
1. **Hanya `persediaan/ledger.ts` yang menulis tabel `persediaan`.** Fase 3 mengisinya dengan `buatPersediaan()`
   (L10) dan `selaraskanHppMaster()`: barang KONSINYASI → `hpp_rata2 = harga_titip` (L7); barang MILIK_SENDIRI
   yang belum pernah punya mutasi (`terakhir_mutasi` kosong) → `hpp_rata2 = harga_beli_terakhir =
   harga_modal_awal`. `catatMutasi()` menyusul di Fase 4.
2. **Harga modal awal dan satuan dasar dikunci setelah ada mutasi stok** (API 409, isian dinonaktifkan di UI).
   Sebelum itu harga modal awal boleh diubah dan HPP awal ikut (butir 1). Kepemilikan dikunci selama stok
   fisik + rusak > 0 (KS1).
3. **"Belum ada penerimaan" (docs/06 H3)** = `persediaan.tanggal_beli_terakhir` kosong; saat itu dasar markup
   `D = harga_modal_awal`.
4. **Harga di form barang hanya dikirim bila bagian harga disentuh.** Mengubah harga modal awal / harga titip /
   kepemilikan tanpa menyentuh harga → `perlu_tinjau_harga = true` dan baris IKUT_TIER belum dihitung ulang.
   Menyimpan harga (form barang atau halaman Harga Jual) menghitung ulang IKUT_TIER dengan `D` terkini dan
   melepas tanda. Tier default harus tetap TETAP.
5. **Kelola tier** ada di halaman Harga Jual (tombol "Kelola tier"): tambah (baris IKUT_TIER dibuat untuk semua
   barang, H2), ubah (markup berubah → tanda tinjau untuk barang IKUT_TIER di tier itu), nonaktif (tier default
   ditolak, H1), aktifkan kembali (melengkapi baris yang belum ada). Mengganti tier default belum disediakan.
6. **Menambah/mengubah barang** membutuhkan `master.barang.kelola` + `master.barang.lihat_hpp` (form memuat harga
   modal); menambah barang juga `master.harga.kelola` (harga tier default wajib). Daftar/detail barang dibaca
   semua peran; harga modal, harga titip, HPP, harga beli terakhir, dan dasar markup hanya dikirim ke pemegang
   `master.barang.lihat_hpp`. `markup_default_persen` tier juga disaring.
7. **Atribut barang** disimpan ulang seluruhnya mengikuti isi form (tabel `barang_atribut` tidak punya status
   aktif; atribut yang dihapus dari form dihapus barisnya dan dicatat di log BARANG_UBAH).
8. **Kode barang**: kosong → `BRG-nnnnn` dari penomoran (kode yang sudah dipakai manual dilewati); kode sendiri
   berpola `BRG-nnnnn` menaikkan penghitung agar tidak bentrok.
9. **Gambar barang** disimpan di `STORAGE_DIR` (bawaan `storage/` di root repo, tidak di-commit) dengan nama acak
   buatan server; hanya JPG/PNG/WebP (diperiksa dari isi berkas), maksimal 2 MB; dilayani lewat
   `GET /api/barang/:id/gambar` dengan izin `master.barang.lihat`.
10. **Pelanggaran UNIQUE** yang lolos pemeriksaan service (dua simpan bersamaan) dijawab 409 KONFLIK.
11. **Status stok 4 tingkat (ST1)** belum ditampilkan di daftar barang; daftar hanya menampilkan angka stok
    tersedia dan minimum. Status dibangun bersama halaman Stok Persediaan (Fase 4).

**Alasan:** Menjaga satu penulis cache persediaan (CLAUDE.md aturan 2) dan HPP yang konsisten dengan ledger;
mencegah perubahan harga tidak sengaja saat hanya mengubah nama barang.
**Ditolak:** menghitung ulang semua harga IKUT_TIER otomatis setiap kali dasar berubah (itu fitur `harga_otomatis`,
Fase 9, H7).

### K-061 — Import Excel barang
**Keputusan:**
1. Templat `.xlsx` dibuat API dari data saat itu: lembar **Barang** (baris 1 = kunci kolom yang dibaca import,
   baris 2 = petunjuk, data mulai baris 3), **Referensi** (kategori, satuan, pemasok aktif; dipakai daftar
   pilihan di sel), dan **Petunjuk**. Kolom harga `harga_<KODE_TIER>` dan atribut `atribut_<KODE_JENIS>`
   mengikuti tier dan jenis atribut aktif. Kategori ditulis dengan nama; satuan dan pemasok dengan kode;
   atribut berdimensi ditulis "angka satuan" (mis. `6 m`).
2. **Pratinjau menjalankan proses simpan yang sama** (fungsi `buatBarang()` yang juga dipakai form) di dalam
   transaksi yang lalu dibatalkan; tiap baris dalam savepoint. Hasil pratinjau = hasil simpan.
3. **Simpan semua-atau-tidak-sama-sekali**: bila masih ada baris bergalat, tidak ada yang disimpan. Baris dengan
   kode yang sudah ada berstatus DILEWATI (K-056). Maksimal 2.000 baris dan 5 MB per berkas.
4. Log: satu `BARANG_BUAT` per barang (ditandai "import Excel") dan satu ringkasan `IMPORT_BARANG`.
5. Izin: `master.import.jalankan` untuk rute import; membuat barang tetap memeriksa izin yang sama dengan form.
6. `exceljs` 4.4.0 dipasang di API (import/ekspor) dan sebagai devDependency web untuk membuat berkas uji e2e.

**Alasan:** Satu jalur validasi (form dan import tidak bisa berbeda aturan); import sebagian yang gagal di
tengah menyulitkan pengguna melacak baris mana yang sudah masuk.
**Ditolak:** menyimpan baris yang valid saja dan melewati baris bergalat; validasi import terpisah dari form.

### K-062 — Masukan pemilik setelah Fase 3: versi, backlog, cadangan, uji skala
**Keputusan:**
1. **Versi**: v1.0.0 (MVP) = akhir M1 (Fase 8); M2 (Fase 9–12) = v1.1–v1.4; usulan baru dikumpulkan di
   `docs/08-backlog.md` sebagai v2.0.0 (produktivitas data, peran kustom, keuangan ringan, sprint penemuan
   perbaikan) dan v3.0.0 (pembukuan, cabang/gudang, valuta, tutup periode).
2. **Cadangan data** masuk deliverable wajib Fase 8 dengan rancangan: snapshot terdeduplikasi terenkripsi
   (restic), retensi berjenjang 7/4/12/5, tujuan lokal + cloud otomatis, tab Pengaturan › Cadangan, uji pulih
   bulanan (docs/07 Fase 8).
3. **Uji skala** (database uji, 5.000 barang × 3 tier): daftar/cari barang 5–28 ms, referensi 2–4 ms, ekspor
   harga 0,9 dtk. Import 2.000 baris ±20 dtk (pratinjau) + ±20 dtk (simpan): diterima untuk sekarang, optimasi
   batch masuk v2 Sprint D. Waktu pindah halaman yang terasa lambat berasal dari mode pengembangan (`pnpm dev`);
   build produksi ±0,1–0,5 dtk. Kode halaman kini dimuat per rute (bundel awal 892 KB → 405 KB).
4. Parameter pengaturan dari sistem lain ditinjau satu per satu (docs/08): logo, opsi struk, dan jumlah baris per
   halaman dikerjakan sekarang; lainnya dijadwalkan atau ditolak dengan alasan.

**Alasan:** MVP harus dipakai toko lebih dulu agar fungsi utama teruji sebelum fitur produktivitas; cadangan
berjenjang terdeduplikasi memberi riwayat panjang tanpa memenuhi disk laptop.
**Ditolak:** mengerjakan fitur massal/peran kustom sekarang (di luar fase aktif); cadangan penuh tanpa deduplikasi
tiap hari (boros ruang).

### K-063 — Master Merk dan halaman Referensi Barang (masukan pemilik)
**Keputusan:**
1. Merk menjadi data master (tabel `merk`, barang memilih lewat `id_merk`), seperti kategori/satuan/atribut,
   agar tidak diketik ulang dan bisa disaring. Migrasi 0001 membuat tabel dan memindahkan merk teks lama (nama
   sama beda huruf besar/kecil digabung; ejaan berhuruf kapital dipilih); migrasi 0002 menghapus kolom teks.
2. Menu "Kategori, Satuan & Atribut" diganti **Referensi Barang** (`/referensi`), tab: Kategori, Merk, Satuan,
   Atribut. Nama menu/halaman dibuat 1–2 kata.
3. Izin: baca `master.barang.lihat`; kelola `master.kategori.kelola` (tanpa izin baru). Nama merk unik tanpa
   membedakan huruf besar/kecil; merk nonaktif tidak bisa dipilih untuk barang baru/perubahan. Log `MERK_*`.
4. Import: kolom `merk` diisi nama merk yang sudah ada (dropdown di templat); nama yang belum ada = galat baris.
5. Daftar barang bisa disaring per merk; pencarian mencakup nama merk.

**Alasan:** Data yang bervariasi tetapi berulang harus berupa pilihan (masukan pemilik 2026-09-30).
**Ditolak:** membuat merk baru otomatis saat import (salah ketik akan menghasilkan merk ganda).

### K-064 — Import Excel v2: sunting baris di layar, templat ringkas/lengkap, ekspor data (masukan pemilik)
**Keputusan:**
1. Alur import: berkas **dibaca** server menjadi baris teks (`POST /api/import/barang/baca`) → **pratinjau** dan
   **simpan** menerima baris itu sebagai JSON. Baris bergalat bisa **diubah atau dibuang langsung di tabel
   pratinjau**; baris yang diubah diperiksa ulang sendirian (kode baris lain ikut dikirim untuk cek kode ganda).
   Pratinjau tetap menjalankan proses simpan yang sama lalu dibatalkan (K-061).
2. Templat **ringkas** (kolom yang paling sering dipakai) dan **lengkap** (semua kolom). Kolom wajib ditandai
   warna biru tua. Sel berisi daftar pilihan (kategori, merk, satuan, kepemilikan, pemasok, status) dan
   validasi angka (rupiah hanya bilangan bulat ≥ 0, stok minimum angka ≥ 0) sehingga Excel menolak huruf.
3. Lembar **Contoh** berisi dua contoh pengisian dengan kolom ditulis menurun (vertikal).
4. Kunci kolom huruf kecil (`harga_normal`, `atribut_panjang`). Kolom harga mengikuti kode tier: templat lama
   tetap bisa dipakai setelah tier baru ditambahkan (tier baru otomatis "ikut markup"); kolom yang tidak dikenali
   (tier/atribut dihapus atau nonaktif) diabaikan dengan **peringatan**, bukan galat.
5. **Ekspor data barang** (`GET /api/import/barang/ekspor`, tombol di Data Barang) memakai format templat lengkap
   + kolom `status`, sehingga bisa dipakai sebagai cadangan/migrasi dan diimpor ulang. Harga "ikut tier"
   dikosongkan agar tetap mengikuti markup. Butuh izin import dan `master.barang.lihat_hpp`.
6. Kolom `status` (AKTIF/NONAKTIF) dikenali import; barang berstatus NONAKTIF dibuat lalu langsung dinonaktifkan.

**Alasan:** Memperbaiki satu sel tidak perlu bolak-balik ke Excel; kolom banyak menakutkan pengguna baru;
validasi di Excel mencegah salah ketik sejak awal.
**Ditolak:** memperbarui barang lama lewat import (K-056 tetap: hanya menambah).
