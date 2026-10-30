# Hasil uji pemilik sebelum Setup v3 (30 Oktober 2026, K-192–K-204)

Status: dicatat semua. Hasil uji: U60, U62–U63, U65–U69, U71, U72, U75, U77, dan U108–U117 **OK**. U61 OK (yang
dimaksud teks panjang yang bisa dibuka-tutup, mis. nama barang di Data Barang). U73 hanya bisa diuji setelah server
dipasang. U64 dan U70 bermasalah (K-196, K-198). U118 ke bawah belum diuji.

Empat pilihan konsep ditanyakan dan dijawab pemilik (rekomendasi dipilih semua): K-192, K-199, K-203, K-197.

## Keputusan

- **K-192 Penyelesaian nilai barang kembali/rusak dari hasil kirim, menurut status bayar.** Bug: memilih
  pengembalian lewat transfer tanpa mengisi rekening tidak memunculkan tugas di *Refund transfer*. Konsep diperbaiki;
  istilah "tagihan dikurangi lalu refund" membingungkan karena seolah pembeli harus lunas dulu. Aturan baru:
  - pembeli **belum bayar sama sekali** (tempo penuh) → hanya **Potong tagihan**;
  - **sudah bayar sebagian** (DP) → pilih **Potong tagihan** atau **Kembalikan uang** (tunai/transfer, paling banyak
    sebesar yang sudah dibayar);
  - **lunas** → hanya **Kembalikan uang**.
  *Rencana.* **Selesai (30 Okt):** kotak penyelesaian di *Catat hasil* menyebut status bayar dan hasil tiap pilihan.
  "Potong tagihan" pada pembeli DP memotong sisa tagihan lebih dulu; kelebihannya dikembalikan. Penyebab bug transfer
  tanpa rekening: nilai yang muat di sisa tagihan otomatis menjadi potong tagihan (tidak ada uang kembali), padahal
  layar tetap meminta cara transfer; kini cara pengembalian hanya diminta bila memang ada uang kembali.
- **K-193 Pengembalian uang menunggu (tunai dan transfer).** Pengembalian tunai juga bisa tertunda (pembeli belum
  datang ke toko), padahal hasil kirim harus segera dicatat agar kartu pindah ke *Selesai*. Halaman *Refund
  transfer* diganti menjadi **Pengembalian uang** yang memuat dua daftar: menunggu transfer dan menunggu diambil
  tunai. Tunai dikonfirmasi saat uang diserahkan dan keluar dari kas shift yang sedang terbuka. Sebelum dikonfirmasi,
  cara pengembalian bisa diganti (transfer ↔ tunai) dengan alasan, untuk jaga-jaga salah pilih. Pengguna tidak perlu
  mengingat mana yang belum dikembalikan. *Rencana.* **Selesai (30 Okt):** tab *Retur Penjualan › Pengembalian uang*
  (Kasir juga bisa membuka; konfirmasi transfer hanya Admin/Owner); retur dari hasil kirim tidak mengeluarkan uang
  saat dicatat; tunai keluar dari kas shift saat **Sudah diserahkan**; **Jadikan tunai/transfer** dengan alasan.
- **K-194 Batas kelipatan "Beli N potong Rp X".** Ada isian berapa kali potongan boleh berlaku per baris: sekali,
  paling banyak k kali, atau tanpa batas. *Rencana.*
- **K-195 FIFO hanya dasar harga jual — dikonfirmasi boleh.** PSAK 14 mengatur rumus biaya persediaan (HPP dan nilai
  persediaan): FIFO atau rata-rata tertimbang, dipakai **konsisten** untuk persediaan sejenis; LIFO tidak boleh. Harga
  jual adalah kebijakan manajemen dan tidak diatur PSAK, jadi harga jual boleh dihitung dari lapisan FIFO sementara
  HPP dan laporan laba tetap rata-rata tertimbang (K-008), selama laporan memakai satu rumus secara konsisten.
  Tidak ada perubahan. **Selesai.**
- **K-196 Aturan berlaku sama di semua peran.** Temuan fatal: *No. referensi wajib* untuk pembayaran non-tunai hanya
  berlaku saat masuk sebagai Kasir, tidak saat Owner. Aturan bisnis tidak boleh bergantung pada peran kecuali memang
  aturan izin (mis. lihat HPP). Diperbaiki di sumbernya (API) dan seluruh jalur pembayaran/transaksi diperiksa untuk
  kasus serupa. *Rencana.* **Selesai (30 Okt):** di POS, Owner sudah ditolak sama seperti Kasir; perbedaannya ada di
  jalur yang hanya dibuka Owner/Admin (bayar hutang pemasok, uang muka PO, pembelian tunai lewat transfer, refund
  transfer pemasok, bukti refund transfer pembeli) yang selama ini tidak mewajibkan No. referensi. Kini satu aturan
  `POLA_REFERENSI` untuk semua uang non-tunai di semua peran. Audit service API: perbedaan per peran hanya hak akses
  (izin), bukan aturan bisnis.
- **K-197 Dependensi alur dan shift.** Diperiksa semua alur, termasuk pengantaran baru: hal yang harus selesai
  sebelum langkah berikutnya boleh dilakukan. Shift hanya boleh ditutup bila semua yang menggantung pada shift itu
  sudah diakui/diproses (mis. pengembalian tunai yang sudah disetujui, pembayaran yang belum diverifikasi); hal yang
  tidak bergantung pada shift boleh tetap berjalan. **Transaksi di luar shift** (non-tunai dan order saat shift belum
  dibuka) tetap boleh agar toko tidak macet, ditandai *di luar shift*, dan otomatis masuk shift berikutnya untuk diakui
  saat shift itu dibuka. *Rencana.*
- **K-198 Cadangan lokal diatur dari layar.** U70: tidak ada tombol untuk mengatur cadangan; layar meminta mengubah
  berkas `.env`. Folder cadangan (disk kedua/eksternal) dan sandinya diatur dari *Pengaturan › Cadangan* oleh Owner,
  dengan petunjuk langkah demi langkah. *Rencana.*
- **K-199 Data master ganda persis tidak boleh ada.** Pilihan "simpan saja, itu dua orang berbeda" salah bila nama
  dan No. HP sama persis (kasus: dua Bu Siti Aminah, satu aktif satu nonaktif). Bila sama persis, data tidak bisa
  disimpan; penyelesaian: **ubah** nama/No. HP salah satunya (yang sedang diubah atau yang ditemukan), atau **hapus
  permanen** salah satunya **bila belum pernah dipakai di transaksi apa pun** (tercatat di log). Data yang sudah
  dipakai tidak bisa dihapus. Berlaku untuk semua data master. Pilihan "tetap simpan" hanya untuk data yang mirip
  (bukan sama persis). *Rencana.*
- **K-200 Selisih stok karena salah input atau salah serah (human error).** Contoh: tercatat 2 tetapi diserahkan 1,
  tercatat 1 tetapi diserahkan 2, barang lain ikut terinput, atau barang yang diserahkan/dikirim keliru. Disusun
  konsep tiga lapis **mencegah – mengajari – menangani** beserta langkah konkret untuk pengguna; fitur yang dibutuhkan
  dikerjakan bertahap. *Rencana.*
- **K-201 Atribut ↔ data muatan langsung selaras di form.** Saat selesai mengisi salah satu (Enter/pindah kotak), yang
  lain langsung ikut, bukan hanya saat Simpan (lanjutan K-169). *Rencana.*
- **K-202 Pencarian dan saringan daftar diingat.** Kembali dari halaman ubah/detail (mis. Data Barang dicari "semen",
  ubah barang, simpan) daftar tetap memakai pencarian, kategori, dan saringan sebelumnya. Pindah ke menu lain
  melupakannya. Berlaku untuk semua daftar yang punya pencarian. *Rencana.*
- **K-203 Muat rit dengan centang, rit bisa diubah, batas muatan bertingkat.** Tombol *Dimuat* di kolom Dijadwalkan
  diganti centang per surat jalan di dalam rit. Rit hanya bisa berangkat bila semua surat jalannya dicentang. Beban
  berat dan ruang dihitung dari yang sudah dicentang; melewati kapasitas memunculkan peringatan; **sampai 110%** boleh
  berangkat dengan alasan, **di atas 110%** tidak bisa berangkat (ganti kendaraan). Angka 110% diatur Owner di
  Pengaturan. Kendaraan dan sopir rit yang belum berangkat bisa diubah. *Rencana.*
- **K-204 Pemasangan.** Setelah perbaikan ini: berkas .exe untuk laptop Windows (Setup v3, K-191), lalu versi untuk
  HP dan tablet. *Rencana.*

## Urutan pengerjaan

1. K-196 (fatal), K-192 bug transfer tanpa rekening.
2. K-192 + K-193 penyelesaian dan pengembalian uang.
3. K-197 dependensi dan shift.
4. K-203 muat rit dan batas muatan.
5. K-199 data ganda, K-202 pencarian diingat, K-201 muatan langsung selaras, K-194 batas kelipatan.
6. K-198 cadangan dari layar.
7. K-200 konsep human error (dokumen + fitur tahap pertama).
8. K-204 Setup v3 laptop, lalu mobile.
