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
3. Isian yang belum dikirim **tidak hilang**: saat Anda pindah menu atau menutup halaman, isian disimpan sebagai
   **draf** dan dibuka lagi saat kembali ke Order Penjualan (draf lain bisa diklik di "Order saya"). **F9** pada
   draf = buang draf. Tombol **Simpan draf & order baru** menyimpan isian sekarang sebagai draf lalu mengosongkan
   form untuk pembeli berikutnya. Qty bisa diubah dengan tombol **−** / **+** di sebelah qty.
4. **F8** kirim ke antrean. Order mendapat **nomor antrean** dan langsung muncul di layar kasir. Serahkan barang
   ke kasir sambil menyebut isi order (mis. "semen 3 sak, nomor 12").
5. Stok yang tampil adalah stok **tersedia** (sudah dikurangi order lain yang belum dibayar).
6. **Harga dan promo otomatis**: harga mengikuti tier pelanggan, dan berubah ke harga grosir sendiri bila qty
   memenuhi syarat (mis. Grosir mulai 10 sak). Potongan promo tampil hijau di bawah barang ("Promo … −Rp …") dan
   total sudah memakai potongan. Anda tidak perlu memilih harga apa pun.

## Kasir

Tugas: menerima pembayaran, mencetak struk/invoice, dan mempertanggungjawabkan uang laci.

**Awal hari — buka shift.** Saat pertama membuka *Penjualan Langsung*, isi **modal awal** (uang di laci).
Semua uang tunai yang Anda terima/keluarkan tercatat di shift ini.

**Penjualan langsung** (*Transaksi › Penjualan Langsung*):
- Papan antrean menampilkan order dari staf (terlama disorot). **Enter** memproses order yang disorot; panah
  untuk memilih order lain; ketik nomor antrean + **Enter** untuk memanggil nomor tertentu.
- Tanpa order: **F2** cari barang → **Enter** tambah. Qty langsung: `semen*3` atau `3*semen` (**F1** = tanda `*`). **F4** pelanggan, **F9** batal.
- **Promo** tampil di bawah barang dan total sudah dipotong. Di daftar barang, **P** melepas promo baris itu (mis.
  pembeli menolak) dan **P** lagi memasangnya kembali; pelepasan tercatat di log. Promo yang tampil saat order
  dihitung ulang saat bayar (promo yang sudah berakhir tidak berlaku lagi).
- **Harga otomatis**: tier pelanggan dipakai otomatis; bila qty memenuhi syarat tier yang lebih murah (mis.
  Grosir mulai 10 sak), harga grosir langsung dipakai ("· Grosir otomatis"). Yang berizin bisa menekan **T** untuk
  memilih tier tertentu (urutan: otomatis → setiap tier).
- Barang berkemasan (dus, roll, …): hasil cari menampilkan setiap kemasan sebagai pilihan sendiri, mis.
  "Semen · sak" dan "Semen · dus isi 10 sak" — pilih dengan panah lalu **Enter**. Memindai barcode dus langsung
  memakai dus; **S** di daftar barang mengganti satuan baris. Qty kemasan harus bulat; setengah dus dijual
  sebagai 5 sak. Pembeli yang mengambil dus **dan** satuan ecer (mis. 100 dus + 50 buah): tambahkan keduanya —
  setiap satuan menjadi baris sendiri dengan harganya sendiri. Di bawah qty tampil isinya dalam satuan dasar (mis.
  "= 30 sak").
- Hasil cari menampilkan nama, atribut singkat, satuan, harga, dan stok; info lengkap (kode, merk, atribut)
  muncul di bawah daftar untuk barang yang disorot.
- **F8** bayar → ketik uang yang diterima → **Enter**. Kembalian tampil besar; struk tercetak otomatis di kertas
  thermal (lebar 57/58/80 mm diatur di *Pengaturan › Profil toko*; panjang struk mengikuti isinya). Di pengaturan
  yang sama: **Langsung cetak**, **Tanya dulu**, atau **Tidak dicetak**; tombol *Cetak struk* juga ada di layar
  hasil. Agar tanpa jendela pratinjau, buka kasir lewat pintasan `buka-kasir` (lihat panduan server).
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
  minimum, gambar. Belum tahu harga modalnya? Centang *Belum tahu harga modalnya*: harga markup terisi sendiri
  setelah penerimaan pertama (sebelum itu barang belum bisa dijual kecuali harganya diisi Rp). Tombol **Saring**
  memilih saringan yang tampil di atas tabel. Banyak barang sekaligus: *Import Excel*. Harga per tier di *Harga Jual*.
- **Kemasan** (form barang › *Kemasan (satuan jual lain)*): untuk barang yang juga dijual per dus/roll/dsb.
  Satuan dasar barang = satuan **terkecil** yang dijual (sak, pcs, meter). Isi kemasan, isinya (mis. 1 dus = 12
  pcs; harus lebih dari 1), barcode dus bila ada, dan nyalakan *Satuan bawaan* bila biasanya dijual per dus.
  Harga kosong = otomatis (harga satuan dasar × isi); isi harga bila dus lebih murah. Stok tetap dalam satuan
  dasar.
- **Label barang** (*Data Barang › Cetak label*): pilih barang dan jumlah label, jenis kertas (printer thermal
  58/57/80 mm atau kertas label A4), harga tier, lalu **Cetak**. Barcode di label bisa dipindai di layar kasir. Kertas yang sudah terpakai sebagian: isi
  "Mulai dari label ke-". Cetak dengan skala 100%.
- **Harga jual** (*Harga Jual*): tiap harga tier — termasuk Normal — bisa **Tier** (harga modal + markup tier;
  bawaan barang baru), **%** (markup sendiri), atau **Rp** (harga tetap yang Anda ketik). Kolom margin = (harga −
  dasar modal) ÷ harga. Sakelar **otomatis** di bawah nama barang: nyala (bawaan) = harga markup ikut naik sendiri
  saat harga beli naik; matikan bila harga barang itu ingin selalu ditinjau dulu.
- **Tier harga** (*Harga Jual › Kelola tier*): Normal untuk pembeli umum; tier lain (mis. Grosir, Distributor)
  dipakai otomatis untuk pelanggan yang diberi tier itu (*Data Pelanggan*), dan untuk siapa saja bila qty
  mencapai *syarat qty* tier itu. Kasir tidak perlu memilih harga.
- **Tinjau Harga** (tab di *Harga Jual*): daftar barang yang harga modalnya berubah. **Terapkan** = harga diganti
  usulan (harga Normal ikut diganti hanya bila sakelar "Ganti juga harga Normal" menyala); **Abaikan** = harga
  tidak diubah. Barang dengan **Harga otomatis** (bawaan semua barang) naik sendiri saat harga modal naik; bila
  harga modal turun atau harga Normal Rp tetap jadi di bawah target, barang itu masuk Tinjau Harga.
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
- **Konsinyasi** (*Persediaan › Konsinyasi*): (1) daftarkan barang titipan (barang baru: tombol *Daftarkan barang
  titipan*; barang yang sudah ada di toko: *Data Barang* › ⋯ › **Daftarkan versi titipan**, lalu pilih penitip
  dan harga titip), (2) terima barangnya (Penerimaan, jenis Konsinyasi), (3) jual seperti biasa, (4)
  setor & bayar. Retur pelanggan barang titipan (baik maupun rusak) otomatis mengurangi setoran. Barang titipan
  rusak: **Kembalikan ke penitip** (penitip menanggung) atau **Musnahkan** (toko mengganti di setoran berikutnya).
  Tab *Posisi per pemasok* menunjukkan barang titipan yang terjual
  tetapi belum disetor. **Buat setoran** → pilih tanggal akhir → periksa pratinjau (retur pelanggan
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
