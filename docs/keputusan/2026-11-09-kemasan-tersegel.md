# Keputusan 9 November 2026 — Kemasan tersegel (K-227 tahap 3) dan buka box otomatis (K-246)

Lanjutan rancangan K-227 butir 1–4 (`2026-11-07-masukan-presentasi-owner.md`). Opname bertahap (butir 5–10) sudah
selesai 8–9 Nov.

| K | Isi | Versi | Status |
|---|---|---|---|
| K-246 | Saat menjual ecer tetapi ecer di catatan tidak cukup, box segel dibuka **otomatis** dan tercatat atas nama kasir, dengan pemberitahuan di baris keranjang (dipilih pemilik 9 Nov) | V1 | Selesai |

## Pertanyaan dan jawaban pemilik (9 Nov)

*"Saat kasir menjual ecer tetapi ecer di catatan tidak cukup, satu box segel harus dibuka. Bagaimana pencatatan
buka box itu di layar kasir?"* → **Otomatis + pemberitahuan**: aplikasi mencatat "box dibuka oleh kasir X untuk
STR-…" tanpa langkah tambahan; baris keranjang menampilkan "membuka 1 box segel". Gudang tetap bisa mencatat
*Buka kemasan* lebih dulu agar ecer siap. (Pilihan lain: kasir wajib konfirmasi; atau ditolak sampai gudang
membuka.)

## Rancangan yang dikerjakan

1. **Kemasan tersegel per barang**: satu satuan jual (kemasan) per barang boleh ditandai *tersegel* di Data Barang,
   isinya bilangan bulat ≥ 2 satuan dasar (mis. *box isi 250 pcs*). Kemasan bertingkat (karton berisi box) belum
   didukung; satu tingkat mencukupi kebutuhan toko (baut, paku, sekrup, keramik per dus).
2. **Stok dua lapis**: stok tetap satu angka di satuan dasar; lapisan **segel** = jumlah box utuh tersegel
   (`persediaan.qty_segel`, cache dari buku `mutasi_segel`), **ecer** = stok − segel × isi. Aturan tetap: segel ×
   isi ≤ stok fisik.
3. **Pergerakan lapisan**:
   - penerimaan barang: jumlah box segel yang datang diisi per baris (bawaan = box utuh terbanyak dari jumlah
     diterima); sisanya ecer;
   - penjualan dalam satuan kemasan tersegel mengambil box segel lebih dulu (bila segel kurang, sisanya dari ecer);
     penjualan ecer mengambil ecer; bila ecer kurang, box segel **dibuka otomatis** (K-246) dan tercatat atas nama
     kasir dengan nomor transaksinya;
   - semua pengurangan stok lain (retur ke pemasok, rusak, koreksi, opname) memakai ecer dan membuka box otomatis
     bila perlu; barang kembali (retur jual, void) masuk ke ecer;
   - **Buka kemasan** manual (gudang/admin): pindah N box ke ecer dengan alasan, tercatat siapa dan kapan.
4. **Opname**: barang tersegel dihitung dua bagian: jumlah **box segel** (cepat) + **ecer** (boleh ditimbang).
   Lapisan segel disamakan dengan hitungan box saat opname diselesaikan (transaksi sesudah waktu hitung tetap
   diperhitungkan).
5. **Uji petik**: daftar hitung harian menandai sebagian barang bersegel (± 1 dari 3) untuk **membuka 1 box acak dan
   menghitung isinya**. Box itu menjadi ecer; isi yang kurang dari seharusnya ikut menjadi selisih opname dan dihitung
   di kinerja sebagai *box segel terbukti kurang*.
6. **Tampilan**: stok barang bersegel tampil "6 box segel + 226 ecer" di Data Barang, cari barang, posisi stok,
   dan kartu kemasan; riwayat segel tercatat (masuk, keluar, dibuka otomatis/manual, opname).

Belum: label segel bernomor (box diisi ulang oleh toko) — menunggu K-230 label rak; kemasan bertingkat.
