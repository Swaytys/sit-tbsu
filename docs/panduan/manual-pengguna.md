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
   (alamat pelanggan terisi otomatis). **Catatan untuk kasir** (opsional) ikut tampil di tiket antrean kasir.
3. Isian yang belum dikirim **tidak hilang**: saat Anda pindah menu atau menutup halaman, isian disimpan sebagai
   **draf** dan dibuka lagi saat kembali ke Order Penjualan (draf lain bisa diklik di "Order saya"). **F9** pada
   draf = buang draf. Tombol **Simpan draf & order baru** menyimpan isian sekarang sebagai draf lalu mengosongkan
   form untuk pembeli berikutnya. Qty bisa diubah dengan tombol **−** / **+** di sebelah qty.
4. **F8** kirim ke antrean. Order mendapat **nomor antrean** dan langsung muncul di layar kasir. Serahkan barang
   ke kasir sambil menyebut isi order (mis. "semen 3 sak, nomor 12").
5. Stok yang tampil adalah stok **tersedia** (sudah dikurangi order lain yang belum dibayar).
6. **Harga dan promo otomatis**: harga mengikuti total belanja (mis. harga Grosir untuk semua barang begitu total
   belanja mencapai Rp 1.000.000; di atas total tertulis "Belanja Rp … lagi untuk harga Grosir"). Promo untuk
   pembeli tertentu terpakai sendiri bila pelanggannya dipilih (**F4**).
   Potongan promo tampil hijau di bawah barang ("Promo … −Rp …"). Anda tidak perlu memilih harga apa pun.

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
- **Harga otomatis**: harga menurut total belanja satu transaksi. Begitu total belanja (dihitung dengan harga
  Normal) mencapai syarat sebuah tier, semua barang memakai harga tier itu ("· Grosir otomatis"); di atas total
  tertulis berapa rupiah lagi menuju tier berikutnya. Potongan promo dihitung dari harga tier tersebut. Tier
  tidak bisa dipilih sendiri.
- **Menu baris (⋮ atau M)**: setiap barang di daftar punya tombol ⋮ berisi ubah qty, ganti satuan, diskon,
  lepas promo, dan hapus (sama dengan tombol keyboardnya). Nama barang panjang tampil utuh (dua baris) berikut
  atributnya.
- **Catatan order** dari staf tampil di tiket antrean dan di atas daftar barang saat order dibuka.
- **Pindah layar cepat**: **Alt+1** Order, **Alt+2** Penjualan Langsung, **Alt+3** Pengantaran (juga tombol di
  bilah atas). Keranjang yang belum dibayar meminta konfirmasi sebelum ditinggalkan.
- Barang berkemasan (dus, roll, …): hasil cari menampilkan setiap kemasan sebagai pilihan sendiri, mis.
  "Semen · sak" dan "Semen · dus isi 10 sak" — pilih dengan panah lalu **Enter**. Memindai barcode dus langsung
  memakai dus; **S** di daftar barang mengganti satuan baris. Qty kemasan harus bulat; setengah dus dijual
  sebagai 5 sak. Pembeli yang mengambil dus **dan** satuan ecer (mis. 100 dus + 50 buah): tambahkan keduanya —
  setiap satuan menjadi baris sendiri dengan harganya sendiri. Di bawah qty tampil isinya dalam satuan dasar (mis.
  "= 30 sak").
- Hasil cari menampilkan nama, atribut singkat, satuan, harga, dan stok; info lengkap (kode, merk, atribut)
  muncul di bawah daftar untuk barang yang disorot.
- **F8** bayar → ketik uang yang diterima → **Enter**. Kembalian tampil besar; struk tercetak otomatis di kertas
  thermal. Di *Pengaturan › Struk & printer*: lebar kertas 57/58/80 mm, **Langsung cetak** / **Tanya dulu** /
  **Tidak dicetak**; tombol *Cetak struk* juga ada di layar hasil.
- **Struk tanpa jendela cetak:** buka aplikasi dengan **Chrome atau Edge** di komputer kasir, lalu di
  *Pengaturan › Struk & printer › Printer struk komputer ini* kerjakan lima langkah berurutan sampai semuanya
  bercentang hijau: (1) pasangkan printer Bluetooth di Windows, (2) **Pilih printer…** (pilih baris *SPP slave* /
  *Spp1* / nama printer; jangan *EM7455* atau *Bluetooth Peripheral Device*), (3) lebar kertas (58 mm = 32
  karakter), (4) **Uji cetak** lalu jawab pertanyaan "apa yang keluar dari printer?", (5) nyalakan **Cetak struk
  langsung ke printer thermal**. Cukup sekali per komputer kasir. Bila printer mati saat menjual, penjualan
  tetap tersimpan dan muncul tombol **Jendela cetak**. Panduan lengkap dan daftar masalah:
  `docs/panduan/printer-struk.md`.
- **Pembeli terdata boleh belum lunas.** Pilih pelanggan (F4 atau klik nama pelanggan), lalu pilih cara bayar:
  **Lunas** (L), **DP** (U: ketik uang muka, sisanya jadi piutang), atau **Bayar nanti** (N: seluruhnya piutang).
- Barang belum diambil pembeli: tandai *belum diambil*; konfirmasi saat diambil.

**Penjualan pengantaran** (*Transaksi › Penjualan Pengantaran*): pilih order pengantaran dari antrean, **atau
buat langsung di halaman ini**: klik *Pelanggan* (atau F4) → pilih pelanggan (atau **Pelanggan baru**) → isi
alamat kirim dan ongkir → tambah barang. Pelanggan pengantaran wajib punya No. HP. Lalu pilih cara bayar:
**Lunas** (L), **DP** (U), **Bayar nanti** (N), atau **Saat terima** (S: ditagih saat barang diterima) → **Buat
invoice** → **P** cetak invoice, **S** buat surat jalan & cetak. Status surat jalan dimajukan saat dimuat,
dikirim, dan diterima.

**Piutang** (*Transaksi › Piutang*): daftar tagihan belum lunas dan jatuh temponya; **Terima pembayaran** untuk
pelunasan.

**Salah transaksi:**
- *Void Transaksi* — membatalkan barang/transaksi **di shift yang masih buka** dan belum dikirim/diretur. Isi
  alasan → **Ajukan & minta persetujuan**.
- *Retur Penjualan* — barang dikembalikan pembeli (sudah lewat shift atau sudah dikirim). Cari nomor struk;
  tabel menunjukkan **Dibeli**, **Sudah diretur**, dan **Sisa** tiap barang, dan retur sebelumnya atas struk itu.
  Isi qty (paling banyak sebesar Sisa), kondisi (baik/rusak/cacat), alasan, penyelesaian (uang kembali / tukar
  barang sama / potong tagihan) → **Ajukan & minta persetujuan**.
- **Persetujuan retur/void**: setelah diajukan muncul dialog *Persetujuan*. Tekan **Kirim kode ke atasan**:
  Admin/Owner menerima pesan Telegram/email berisi rincian permintaan dan **kode 6 angka**. Hubungi atasan; bila
  setuju ia menyebutkan kodenya → ketik → **Setujui dengan kode** (tercatat atas nama atasan; uang kembali dari
  laci shift Anda). Kode berlaku 10 menit, sekali pakai. Belum bisa menghubungi atasan: **Nanti saja, tunggu
  persetujuan**, lalu lanjutkan dari tab *Menunggu persetujuan* → **Setujui dengan kode**. Retur/void bernilai
  kecil (batas di Pengaturan) langsung jadi tanpa dialog. Anda tidak pernah diminta password atasan.
- **Salah input?** Selama masih *Menunggu*, buka tab **Menunggu persetujuan** → **Batalkan** (isi alasan), lalu
  ajukan lagi. Yang sudah *Disetujui* tidak bisa dibatalkan: kurang → retur tambahan; lebih → catat penjualan
  baru.

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
- **Harga jual** (*Harga Jual*): harga dasar (Normal) tiap barang bisa **Tier** (harga modal + markup tier;
  bawaan barang baru), **%** (markup sendiri), atau **Rp** (harga tetap yang Anda ketik). Harga tier lain (Grosir,
  Distributor) selalu harga modal + markup tier untuk semua barang dan hanya ditampilkan. Kolom margin = (harga −
  dasar modal) ÷ harga. Tombol **?** di kanan atas tabel menjelaskan istilahnya. Sakelar **otomatis** di bawah nama barang: nyala (bawaan) = harga markup ikut naik sendiri
  saat harga beli naik; matikan bila harga barang itu ingin selalu ditinjau dulu.
- **Tier harga** (*Harga Jual › Kelola tier*): harga ditentukan total belanja satu transaksi. Tier bertanda
  **Harga dasar** (Normal) dipakai semua transaksi dan tidak bisa dinonaktifkan. Tier lain (mis. Grosir,
  Distributor) dipakai otomatis untuk **semua barang** bila total belanja mencapai **Mulai belanja** tier itu
  (wajib diisi; tier tanpa syarat belanja tetap nonaktif). Isi **Markup** (persen di atas harga modal) dan **Mulai belanja**; makin
  besar syarat belanja, markup seharusnya makin kecil (ada peringatan bila terbalik). Kasir tidak perlu memilih
  harga. Harga khusus satu barang, jumlah beli tertentu, atau pelanggan tertentu dibuat di *Promo*.
- **Tinjau Harga** (tab di *Harga Jual*): daftar barang yang harga modalnya berubah. **Terapkan** = harga diganti
  usulan (harga Normal ikut diganti hanya bila sakelar "Ganti juga harga Normal" menyala); **Abaikan** = harga
  tidak diubah. Barang dengan **Harga otomatis** (bawaan semua barang) naik sendiri saat harga modal naik; bila
  harga modal turun atau harga Normal Rp tetap jadi di bawah target, barang itu masuk Tinjau Harga.
- **Promo** (*Promo*): buat potongan persen atau rupiah per satuan untuk semua barang, satu kategori, atau satu
  barang, dengan masa berlaku dan syarat (minimal qty per baris, minimal total belanja). **Untuk pembeli**: semua
  pembeli, satu golongan pelanggan, atau pelanggan tertentu; bisa juga disyaratkan "pelanggan sudah belanja
  minimal Rp … dalam … hari terakhir". Potongan promo dihitung dari harga tier yang berlaku (harga dasar, atau Grosir bila total belanja
  tercapai), jadi tier dan promo bisa terpakai bersama.
  Satu promo per baris (potongan terbesar). Promo yang sudah terpakai tidak bisa diubah aturannya; nonaktifkan
  lalu buat promo baru.
- **Pelanggan & pemasok** (*Data Pelanggan*, *Data Pemasok*): golongan (untuk sasaran promo; kelola lewat tombol
  **Golongan**), term pembayaran, limit.
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
- **Limit kredit**: bila penjualan tidak lunas membuat piutang pelanggan melewati limitnya, Admin/Owner melihat
  dialog **Setujui & lanjutkan**. Kasir melihat dialog *Limit kredit terlampaui*: **Kirim kode ke atasan**, lalu
  ketik kode yang disebutkan atasan; atau tutup dialog dan terima pembayaran lebih dulu. Persetujuan tercatat di
  log atas nama atasan. Limit pelanggan baru terisi dari **limit bawaan** (centang *Jadikan limit ini bawaan* di
  form tambah pelanggan).
- **Menerima kode persetujuan (Admin/Owner)**: buka menu akun (kanan atas) › **Akun saya** → isi **Email** dan/atau
  **Hubungkan Telegram** (buka bot toko, tekan Start, lalu Periksa). Saat kasir meminta persetujuan, Anda menerima
  pesan berisi rinciannya dan sebuah kode. **Sebutkan kode ke kasir hanya bila setuju**; bila tidak, abaikan.
  Owner/Admin menyiapkan salurannya sekali di *Pengaturan › Persetujuan*: tiap saluran (Telegram, Email) punya
  tiga langkah bernomor (akun pengirim toko, kontak Anda, kirim pesan uji) yang berubah menjadi centang hijau
  saat beres. Tombol uji tiap saluran mengirim pesan sungguhan dan menyebut apa yang kurang bila gagal. Panduan
  lengkap (membuat bot, sandi aplikasi Gmail, daftar masalah): `docs/panduan/kode-persetujuan-telegram-email.md`.
- **Persetujuan**: tab *Menunggu persetujuan* di *Retur Penjualan* dan *Void Transaksi* (juga dari lonceng).
  Periksa alasan, pilih cara pengembalian uang, **Setujui** atau **Tolak** dengan alasan. Di toko dengan satu
  komputer, atau saat Anda tidak di toko, Anda tidak perlu ganti akun: cukup sebutkan kode yang Anda terima ke
  kasir (lihat *Menerima kode persetujuan*). Kolom Status di riwayat menulis siapa yang menyetujui dan caranya. **Batas tanpa persetujuan** diatur di
  *Pengaturan › Operasional* (Rp 0 = semua retur/void harus disetujui atasan).
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
