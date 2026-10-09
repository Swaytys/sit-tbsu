# Keputusan dari Tinjauan Pemilik (lanjutan): Harga, Kemasan, Struk Thermal — 9 Oktober 2026

Melanjutkan penomoran dari `2026-10-08-tinjauan-pemilik.md`. Butir **(pemilik)** diputuskan pemilik proyek
(pilihan dari usulan Claude Code); butir lain keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-094 — Harga otomatis bawaan, tier otomatis berdasarkan qty, kemasan disederhanakan, cetak thermal

**Keputusan:**

1. **(pemilik) Harga otomatis menjadi bawaan semua barang** (menggantikan K-086 #1). `barang.harga_otomatis`
   bawaan `true`; migrasi 0008 menyalakannya untuk semua barang yang ada. Mematikannya per barang: sakelar
   *otomatis* di tabel Harga Jual (`PUT /api/harga-barang/otomatis`, izin `master.harga.kelola`, log
   `BARANG_UBAH`; menyalakan langsung mengevaluasi harga seperti dari form barang) atau sakelar di form barang.
   Aturan H7 tetap: kenaikan dasar langsung diterapkan, penurunan masuk Tinjau Harga.
2. **(pemilik) Harga tier default (Normal) boleh ikut markup** (menggantikan K-086 #2 dan "tier default wajib
   TETAP" di H4). Barang baru: semua tier bawaan *Ikut tier* (harga = dasar modal + markup tier, dibulatkan ke
   atas); harga Rp tetap tetap bisa dipilih per tier. Harga tier default tidak boleh Rp 0: barang tanpa harga
   modal/harga titip harus diberi harga Rp. Import Excel: kolom harga tier default boleh kosong bila harga modal
   awal (atau harga titip) diisi. Barang lama yang harga Normal-nya Rp tetap tidak diubah migrasi; pemilik dapat
   mengganti ke *Tier* di Harga Jual. Usulan harga Normal di Tinjau Harga tetap berlaku untuk Normal Rp tetap.
3. **(pemilik) Tier baris ditentukan otomatis** (menggantikan "saran, tidak memaksa" di H8/K-087): tanpa pilihan
   kasir, tier baris = yang **termurah** di antara tier bawaan transaksi (tier pelanggan, atau tier default) dan
   tier aktif yang `saran_min_qty`-nya terpenuhi oleh `qty_dasar`; seri → tier bawaan. Tidak butuh izin karena
   mengikuti aturan. Kasir yang berizin `penjualan.tier.ubah` tetap bisa memilih tier tertentu (tombol **T** di
   kasir, pilihan di form order); pilihan itu tidak diganti otomatis, dan API menyarankan tier qty yang lebih murah
   bila ada. Order menyimpan `order_penjualan_detail.tier_dipilih` (migrasi 0008; baris lama yang tier-nya berbeda
   dari tier bawaan dianggap dipilih). Mengubah qty order mengevaluasi ulang tier otomatis; harga janji (P2) tetap
   dipakai selama tier dan satuan baris sama.
4. **(pemilik) Satuan jual dipertahankan dan disederhanakan menjadi "kemasan"** (melengkapi K-091):
   - Satuan dasar barang = **satuan terkecil yang dijual** (sak, pcs, meter). Satuan jual lain adalah kemasan
     berisi **lebih dari 1** satuan dasar (`faktor > 1`, ditolak bila tidak, untuk satuan jual aktif).
   - **Qty kemasan wajib bilangan bulat**; sebagian kemasan (mis. setengah dus) dijual dalam satuan dasar
     (5 sak). Qty satuan dasar tetap boleh desimal (mis. 0,5 kg).
   - Isi kemasan per barang, ditampilkan di mana pun sebagai "dus isi 10 sak", sehingga dus barang A dan dus
     barang B tidak tertukar.
   - Di kasir dan order cepat, **hasil cari menampilkan setiap kemasan sebagai pilihan sendiri** ("Semen · sak",
     "Semen · dus isi 10 sak"); kasir cukup memilih dengan panah lalu Enter. Satuan hasil pindai barcode atau
     satuan bawaan barang tampil paling atas. Tombol **S** tetap ada untuk mengganti satuan baris.
   - Di form barang bagiannya bernama "Kemasan (satuan jual lain)".
5. **Struk dan label thermal dicetak seukuran gulungan.** `@page { size: 58mm auto }` tidak sah di CSS (browser
   mengabaikannya lalu memakai A4), jadi tinggi dokumen gulungan diukur dari isinya dan ukuran kertas ditulis
   lengkap (mis. `58mm 143mm`). Lebar struk bisa 57, 58, atau 80 mm (Pengaturan › Profil toko).
6. **(pemilik) Barang yang sama dititipkan pemasok:** menu baris Data Barang › **Daftarkan versi titipan** membuka
   form barang baru berisi salinan nama, kategori, merk, satuan, stok minimum, keterangan, dan atribut, dengan
   kepemilikan Titipan; pengguna tinggal memilih penitip dan harga titip. Barang titipan tetap barang tersendiri
   (stok, HPP, dan harga terpisah dari barang milik toko, KS1–KS4).

*Alasan:* kasir tidak perlu memilih harga apa pun (tier pelanggan dan qty sudah menentukan; promo sudah otomatis
sejak K-087); pemilik tidak perlu menyalakan harga otomatis satu per satu; kemasan tetap menyatukan stok kabel
roll/meter atau keramik dus/pcs tanpa menambah langkah input.

*Ditolak:*
- Menghapus satuan jual (1 barang 1 satuan): kabel roll dan kabel meter menjadi dua barang dengan stok terpisah,
  dan membuka roll untuk dijual per meter perlu penyesuaian manual.
- Tier qty tetap sebagai saran: menambah satu keputusan kasir di setiap baris grosir.
- Mengubah harga Normal Rp tetap barang lama menjadi markup lewat migrasi: harga yang sudah dipakai pelanggan bisa
  berubah tanpa ditinjau.
