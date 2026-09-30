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
