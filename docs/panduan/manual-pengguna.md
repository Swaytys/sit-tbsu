# Manual Pengguna BonsaiUrip — UD. Sumber Urip

Untuk: pemilik, admin, kasir, dan staf penjualan. Baca bagian peran Anda; menu yang tidak tampil berarti memang
bukan bagian tugas Anda. Semua layar berbahasa Indonesia; angka uang dalam rupiah.

**Masuk:** buka alamat aplikasi (di komputer kasir: ikon *Buka Kasir*), isi username dan password. Login pertama
wajib mengganti password. Sesi berakhir sendiri setelah 60 menit tidak dipakai. Lupa password → minta Owner
mereset di *Data Pengguna*.

**Lonceng (kanan atas):** pengingat yang perlu ditindaklanjuti — order terlalu lama menunggu, stok habis/kritis,
retur/void menunggu persetujuan, piutang jatuh tempo, cadangan bermasalah.

---

## Staf Penjualan

Tugas: mencatat pesanan pembeli dan menyerahkannya ke antrean kasir.

1. *Transaksi › Order Penjualan*. Ketik nama/kode barang lalu **Enter** untuk menambah; `3*semen` = qty 3.
   **↓** pindah ke daftar barang; di daftar: **+ / −** ubah qty, angka untuk mengetik qty, **Del** hapus,
   **Ctrl+Z** urungkan.
2. Pembeli umum tidak perlu nama. Pelanggan langganan: **F4** cari pelanggan. Pengantaran: **F3** ubah jenis
   (alamat pelanggan terisi otomatis).
3. **F8** kirim ke antrean. Order mendapat **nomor antrean** dan langsung muncul di layar kasir. Serahkan barang
   ke kasir sambil menyebut isi order (mis. "semen 3 sak, nomor 12").
4. Stok yang tampil adalah stok **tersedia** (sudah dikurangi order lain yang belum dibayar).
5. **Promo** dihitung otomatis: potongan tampil hijau di bawah barang ("Promo … −Rp …") dan total sudah memakai
   potongan. "Saran: Grosir" berarti qty sudah cukup untuk harga grosir — sampaikan ke kasir.

## Kasir

Tugas: menerima pembayaran, mencetak struk/invoice, dan mempertanggungjawabkan uang laci.

**Awal hari — buka shift.** Saat pertama membuka *Penjualan Langsung*, isi **modal awal** (uang di laci).
Semua uang tunai yang Anda terima/keluarkan tercatat di shift ini.

**Penjualan langsung** (*Transaksi › Penjualan Langsung*):
- Papan antrean menampilkan order dari staf (terlama disorot). **Enter** memproses order yang disorot; panah
  untuk memilih order lain; ketik nomor antrean + **Enter** untuk memanggil nomor tertentu.
- Tanpa order: **F2** cari barang → **Enter** tambah. **F4** pelanggan, **F9** batal.
- **Promo** tampil di bawah barang dan total sudah dipotong. Di daftar barang, **P** melepas promo baris itu (mis.
  pembeli menolak) dan **P** lagi memasangnya kembali; pelepasan tercatat di log. Promo yang tampil saat order
  dihitung ulang saat bayar (promo yang sudah berakhir tidak berlaku lagi).
- Barang dengan satuan jual: di daftar barang tekan **S** untuk ganti satuan (sak ↔ dus); memindai barcode dus
  langsung memakai satuan dus. Di bawah qty tampil isinya dalam satuan dasar (mis. "= 30 sak").
- **F8** bayar → ketik uang yang diterima → **Enter**. Kembalian tampil besar; struk tercetak otomatis.
- Barang belum diambil pembeli: tandai *belum diambil*; konfirmasi saat diambil.

**Penjualan pengantaran** (*Transaksi › Penjualan Pengantaran*): pilih order pengantaran → bayar penuh / DP /
bayar saat barang diterima → **P** cetak invoice, **S** buat surat jalan & cetak. Status surat jalan dimajukan
saat dimuat, dikirim, dan diterima.

**Piutang** (*Transaksi › Piutang*): daftar tagihan belum lunas dan jatuh temponya; **Terima pembayaran** untuk
pelunasan.

**Salah transaksi:**
- *Void Transaksi* — membatalkan barang/transaksi **di shift yang masih buka** dan belum dikirim/diretur. Isi
  alasan → **Ajukan**; Admin/Owner menyetujui. Uang dikembalikan dari laci penyetuju.
- *Retur Penjualan* — barang dikembalikan pembeli (sudah lewat shift atau sudah dikirim). Isi qty, kondisi
  (baik/rusak/cacat), alasan, penyelesaian (uang kembali / tukar barang sama / potong tagihan) → **Ajukan**.

**Kas lain** (*Shift & Clerical Check*): kasbon, setor ke owner, kas masuk/keluar lain — selalu dengan keterangan.

**Akhir hari — tutup shift.** Hitung uang di laci, ketik jumlahnya **sebelum** melihat angka sistem (blind count),
**Tutup shift**. Bila ada selisih, wajib isi keterangan. Hasil *clerical check* tersimpan dan terlihat Admin/Owner.

**Laporan** (*Laporan*): penjualan per periode, produk terlaris, detail invoice, retur, piutang, daftar harga
(katalog untuk pelanggan) — bisa dicetak/PDF dan diekspor Excel.

## Admin

Semua tugas kasir, ditambah:

- **Data barang** (*Data Master › Data Barang*): tambah/ubah barang, kategori, merk, satuan, atribut, stok
  minimum, gambar. Banyak barang sekaligus: *Import Excel*. Harga per tier di *Harga Jual*.
- **Satuan jual** (form barang › *Satuan jual*): jual barang per dus/roll/dsb. Isi satuan, isi per satuan dasar
  (mis. dus = 12 pcs), barcode dus bila ada, dan centang *Satuan bawaan* bila biasanya dijual per dus. Harga
  kosong = otomatis (harga satuan dasar × isi); isi harga bila dus lebih murah. Stok tetap dalam satuan dasar.
- **Label barang** (*Data Barang › Cetak label*): pilih barang dan jumlah label, jenis kertas label, harga
  tier, lalu **Cetak**. Barcode di label bisa dipindai di layar kasir. Kertas yang sudah terpakai sebagian: isi
  "Mulai dari label ke-". Cetak dengan skala 100%.
- **Harga jual** (*Harga Jual*): tiap harga tier bisa **Rp** (harga tetap), **Tier** (ikut markup tier), atau
  **%** (markup sendiri). Harga Normal selalu harga tetap. Kolom margin = (harga − dasar modal) ÷ harga.
- **Tinjau Harga** (tab di *Harga Jual*): daftar barang yang harga modalnya berubah. **Terapkan** = harga diganti
  usulan (harga Normal ikut diganti hanya bila sakelar "Ganti juga harga Normal" menyala); **Abaikan** = harga
  tidak diubah. Barang dengan **Harga otomatis** (sakelar di form barang) naik sendiri saat harga modal naik; bila
  harga modal turun atau harga Normal jadi di bawah target, barang itu masuk Tinjau Harga.
- **Promo** (*Promo*): buat potongan persen atau rupiah per satuan untuk semua barang, satu kategori, atau satu
  barang, dengan masa berlaku dan syarat (minimal qty per baris, minimal total belanja). Satu promo per baris
  (potongan terbesar). Promo yang sudah terpakai tidak bisa diubah aturannya; nonaktifkan lalu buat promo baru.
- **Pelanggan & pemasok** (*Data Pelanggan*, *Data Pemasok*): tier harga, term pembayaran, limit.
- **Penerimaan barang** (*Persediaan › Penerimaan Barang*): catat barang datang dari pemasok (pembelian tunai/
  tempo atau titipan). Stok dan HPP rata-rata diperbarui otomatis.
- **Stok** (*Persediaan › Stok Persediaan*): posisi stok, mutasi, kartu stok per barang, stok tertahan, dan
  **penyesuaian** (saldo awal, koreksi, barang rusak, **stok opname**). Barang yang tidak dihitung saat opname
  dikecualikan dengan alasan, bukan dihapus.
- **Stok rusak** (tab *Stok rusak* di *Stok Persediaan*): barang rusak tidak bisa dijual. Pindahkan dari stok
  baik lewat *Penyesuaian › Stok rusak*. Lalu pilih **Retur ke pemasok** (diklaim) atau **Musnahkan** (dibuang;
  alasan wajib).
- **Retur ke pemasok** (*Persediaan › Retur ke Pemasok*): pilih pemasok, barang (dari stok baik atau rusak), alasan,
  dan penyelesaian: **Potong hutang** (pilih penerimaan tempo yang dipotong), **Ganti barang** (barang pengganti
  langsung tercatat masuk), **Uang kembali** (tunai ke laci shift Anda atau transfer), **Pengembalian titipan**
  (barang konsinyasi). Retur tidak bisa diubah setelah disimpan. **Cetak nota retur** untuk ditandatangani pemasok.
- **Hutang pemasok** (*Persediaan › Hutang Pemasok*): pembelian tempo yang belum lunas, umurnya, dan yang lewat
  jatuh tempo (juga muncul di lonceng). **Bayar**: transfer (isi rekening tujuan) atau tunai dari laci shift Anda;
  boleh sebagian. Ikon jam menampilkan riwayat pembayaran.
- **Konsinyasi** (*Persediaan › Konsinyasi*): tab *Posisi per pemasok* menunjukkan barang titipan yang terjual
  tetapi belum disetor. **Buat setoran** → pilih tanggal akhir → periksa pratinjau (retur pelanggan kondisi baik
  sudah dikurangkan) → **Simpan setoran** → **Cetak nota setoran** untuk pemasok → **Bayar** (transfer atau tunai
  dari laci). Barang titipan yang tidak laku dikembalikan lewat *Retur ke Pemasok › Pengembalian titipan*.
- **Limit kredit**: bila penjualan tidak lunas membuat piutang pelanggan melewati limitnya, kasir ditolak. Admin/
  Owner melihat dialog **Setujui & lanjutkan**; persetujuan tercatat di log.
- **Persetujuan**: tab *Persetujuan* di *Retur Penjualan* dan *Void Transaksi* (juga dari lonceng). Periksa
  alasan, pilih cara pengembalian uang, **Setujui** atau **Tolak** dengan alasan.
- **Laporan lengkap**: stok rekap, kartu stok, stok minimum, nilai persediaan (termasuk informasi barang rusak),
  riwayat harga beli (bandingkan harga antarpemasok), promo, gross profit (laba kotor), hutang usaha, umur
  piutang, konsinyasi.
- **Pengaturan**: profil toko & logo, penomoran, aturan operasional, batas diskon, keamanan.

## Owner (pemilik)

Semua tugas admin, ditambah:

- **Data Pengguna**: tambah akun karyawan (password awal wajib diganti saat login pertama), reset password,
  nonaktifkan akun karyawan yang keluar (sesinya langsung berakhir).
- **Log aktivitas** (*Pengaturan › Log aktivitas*): siapa melakukan apa dan kapan — termasuk persetujuan,
  perubahan harga, ekspor/cetak laporan.
- **Cadangan** (*Pengaturan › Cadangan*): pastikan *cadangan terakhir* hari ini/kemarin dan *berhasil* (lokal &
  cloud). Lihat panduan server bagian 7 untuk mengatur, bagian 8 untuk memulihkan.
- **Dashboard**: penjualan hari ini vs kemarin, grafik 7 hari, antrean, pengiriman aktif, peringatan stok.
- Dari luar toko: buka alamat Tailscale di HP (panduan server bagian 6).

## Tips umum

- Jangan berbagi akun: setiap aksi tercatat atas nama pemilik akun.
- Transaksi yang sudah tersimpan tidak diedit; koreksi lewat void, retur, atau penyesuaian agar jejaknya jelas.
- Laporan: pilih periode (hari ini … tahun ini, atau rentang), lalu **Cetak / PDF** atau **Ekspor Excel**.
