# Manual Pengguna BonsaiUrip — UD. Sumber Urip

Untuk: pemilik, admin, kasir, dan staf penjualan. Baca bagian peran Anda; menu yang tidak tampil berarti memang
bukan bagian tugas Anda. Semua layar berbahasa Indonesia; angka uang dalam rupiah.

**Masuk:** buka alamat aplikasi (di komputer kasir: ikon *Buka Kasir*), isi username dan password. Login pertama
wajib mengganti password. Sesi berakhir sendiri setelah 60 menit tidak dipakai. Lupa password → minta Owner
mereset di *Data Pengguna*.

**Lonceng (kanan atas):** pengingat yang perlu ditindaklanjuti — order terlalu lama menunggu, stok habis/kritis,
retur/void menunggu persetujuan, piutang jatuh tempo, shift yang perlu ditutup, uang non-tunai yang belum dicek
atau tidak masuk, cadangan bermasalah.

**Ganti akun di komputer yang sama:** keluar dulu (tombol **Keluar** di bagian bawah menu samping), lalu masuk
dengan akun berikutnya. Yang tampil selalu data akun yang sedang masuk.

---

## Staf Penjualan

Tugas: mencatat pesanan pembeli dan menyerahkannya ke antrean kasir.

1. *Transaksi › Order Penjualan*. Ketik nama/kode barang lalu **Enter** untuk menambah; `3*semen` = qty 3.
   **↓** pindah ke daftar barang; di daftar: **+ / −** ubah qty, angka untuk mengetik qty, **Del** hapus,
   **Ctrl+Z** urungkan.
   - **Lupa nama barangnya?** Ketik cirinya, dipisah spasi: `pipa 3 inch putih`, `cat 5 kg`, `besi 12 mm`.
     Semua kata harus cocok; tiap kata boleh cocok di nama, kode, barcode, merk, kategori, atau atribut
     (ukuran, warna, berat).
   - **Tidak mau mengetik?** Pilih kategori di kotak *Semua kategori* (sebelah kotak cari), lalu klik **Daftar**
     (atau **Alt+↓**): 30 barang pertama tampil urut nama beserta foto kecilnya; klik barangnya, atau sorot
     dengan panah lalu **Enter**.
2. Pembeli umum tidak perlu nama. Pelanggan langganan: **F4** cari pelanggan. Pengantaran: **F3** ubah jenis
   (alamat pelanggan terisi otomatis). **Catatan untuk kasir** (opsional) ikut tampil di tiket antrean kasir.
3. Isian yang belum dikirim **tidak hilang**: saat Anda pindah menu atau menutup halaman, isian disimpan sebagai
   **draf** dan dibuka lagi saat kembali ke Order Penjualan (draf lain bisa diklik di "Order saya"). Tombol
   **Simpan draf & order baru** menyimpan isian sekarang sebagai draf lalu mengosongkan form untuk pembeli
   berikutnya. Qty bisa diubah dengan tombol **−** / **+** di sebelah qty.
   - **Mulai dari awal** (tombol, atau **F9**): mengosongkan isian order yang sedang diketik (draf yang sedang
     diisi ikut dibuang). Selalu muncul pertanyaan dulu; tombol yang tersorot adalah **Batal**, jadi F9 yang
     terpencet lalu Enter tidak menghapus apa pun. Pilih **Ya, mulai dari awal** bila memang ingin mengosongkan.
4. **F8** kirim ke antrean. Order mendapat **nomor antrean** dan langsung muncul di layar kasir. Serahkan barang
   ke kasir sambil menyebut isi order (mis. "semen 3 sak, nomor 12").
5. Stok yang tampil adalah stok **tersedia** (sudah dikurangi order lain yang belum dibayar).
6. **Harga dan promo otomatis**: harga mengikuti total belanja (mis. harga Grosir untuk semua barang begitu total
   belanja mencapai Rp 1.000.000; di atas total tertulis "Belanja Rp … lagi untuk harga Grosir"). Promo untuk
   pembeli tertentu terpakai sendiri bila pelanggannya dipilih (**F4**).
   Potongan promo tampil hijau di bawah barang ("Promo … −Rp …"). Anda tidak perlu memilih harga apa pun.
7. **Pelanggan baru** boleh Anda tambahkan sendiri kapan saja. **Mengubah data pelanggan yang sudah ada**, atau
   menonaktifkan/mengaktifkannya, butuh persetujuan atasan (lihat *Kasir › Mengubah data pelanggan*; caranya
   sama).

## Kasir

Tugas: menerima pembayaran, mencetak struk/invoice, dan mempertanggungjawabkan uang laci.

**Awal hari — buka shift.** Semua uang tunai yang Anda terima/keluarkan tercatat di shift. Buka shift di
*Shift & Clerical Check* (tombol **Buka shift**) atau saat pertama membuka *Penjualan Langsung*. Muncul jendela
**Buka shift kasir** dengan tiga pilihan. Pilih dengan klik atau tombol keyboard di kirinya:

1. **Enter — Sama dengan uang ditinggal kemarin.** Dipakai bila laci tidak disentuh sejak shift terakhir
   ditutup. Angkanya adalah uang yang dicatat *ditinggal di laci* saat shift itu ditutup. Tidak bisa dipilih bila
   belum ada catatannya.
2. **H — Hitung sekarang.** Paling teliti. Isi jumlah lembar/keping per pecahan (Rp100.000 × 3, Rp2.000 × 10, …);
   total dihitung otomatis. Bila lebih mudah, klik **Ketik total saja**. Tekan **Enter** untuk lanjut.
3. **N — Buka dulu, hitung nanti.** Untuk pagi yang sudah ramai sebelum laci selesai dihitung. Shift langsung
   buka dengan modal sementara (uang ditinggal kemarin). Anda boleh langsung melayani: uang yang masuk dan
   kembalian yang keluar tetap tercatat. Lihat *Hitung susulan* di bawah.

Setelah memilih, muncul kotak konfirmasi berisi angka modal awal dalam huruf besar. Periksa angkanya:
**Enter** = ya, buka shift; **Esc** = kembali (angka yang sudah Anda isi tidak hilang). **Esc** di langkah
pertama menutup jendela; tidak perlu mengklik apa pun dulu.

- **Hitung susulan** (bila memilih *hitung nanti*). Di atas semua halaman muncul spanduk kuning *Hitung uang laci
  belum dikirim* beserta batas jamnya (bawaan 60 menit; menjadi merah bila lewat). Begitu sempat:
  (1) klik **Hitung sekarang** pada spanduk atau buka *Shift & Clerical Check*; (2) di kotak kuning **Hitung uang
  laci** hitung **semua** uang di laci saat itu, termasuk uang penjualan yang sudah masuk; (3) klik **Kirim
  hitungan susulan**, periksa angkanya, lalu **Ya, kirim**. Sistem menghitung sendiri modal yang sebenarnya saat
  buka: *hasil hitungan − (uang tunai masuk − uang tunai keluar sejak shift dibuka)*. Contoh: modal sementara
  Rp 500.000, sudah ada penjualan tunai Rp 24.000, laci dihitung Rp 529.000 → modal sebenarnya Rp 505.000, jadi
  ada *selisih semalam* Rp 5.000 yang dicatat sebagai koreksi modal dan dilihat Owner. Hitung susulan hanya
  sekali. Bila tidak pernah dikirim, selisih semalam ikut masuk ke selisih tutup shift dan ditandai.
- **Salah ketik modal awal?** Klik **Koreksi modal** di kartu shift Anda, isi *Modal awal yang benar* dan
  *Alasan* (mis. "kurang satu nol"), lalu **Simpan koreksi**. Angka lama tidak dihapus; koreksi tercatat dengan
  alasan dan terlihat atasan. Selama **belum ada transaksi tunai** di shift itu, Anda boleh mengoreksi sendiri.
  Bila **sudah ada** transaksi tunai, tombolnya menjadi **Minta persetujuan…**: klik, lalu
  **Kirim kode ke atasan** (kode 6 angka dikirim ke Telegram/email Admin/Owner); minta kodenya, ketik, lalu
  **Setujui dengan kode**. Kode hanya berlaku untuk angka yang Anda ajukan.

- **Shift kemarin belum ditutup?** Anda tidak bisa membuka shift baru, menjual, menerima pembayaran, mencatat
  kas, atau mengembalikan uang sampai shift itu ditutup. Di atas semua halaman muncul peringatan merah yang
  menyebut nomor dan tanggal shiftnya. Caranya: (1) buka *Shift & Clerical Check*, (2) hitung uang di laci,
  (3) ketik jumlahnya, (4) **Tutup shift**, (5) buka shift baru untuk hari ini. Bila uangnya sudah tidak bisa
  dihitung dengan benar, isi apa adanya dan tulis sebabnya di keterangan selisih; Admin/Owner juga bisa
  menutupkannya.

**Penjualan langsung** (*Transaksi › Penjualan Langsung*):
- Papan antrean menampilkan order dari staf (terlama disorot). **Enter** memproses order yang disorot; panah
  untuk memilih order lain; ketik nomor antrean + **Enter** untuk memanggil nomor tertentu.
- Tanpa order: **F2** cari barang → **Enter** tambah. Qty langsung: `semen*3` atau `3*semen` (**F1** = tanda `*`). **F4** pelanggan.
- **Mulai dari awal** (tombol di atas daftar barang, atau **F9**): selalu bertanya dulu, dan tombol yang
  tersorot adalah **Batal**. Bila layar berisi order dari antrean, order itu **tidak dihapus**: ia kembali ke
  antrean dan bisa diproses lagi. Bila tanpa order, daftar barang, pelanggan, dan isian pembayaran dikosongkan;
  belum ada yang tersimpan, jadi tidak ada penjualan yang terhapus (**Ctrl+Z** mengembalikan daftar barangnya).
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
- Hasil cari menampilkan foto kecil, nama, atribut singkat, satuan, harga, dan stok; info lengkap (kode, merk,
  atribut) dan foto yang lebih besar muncul di bawah daftar untuk barang yang disorot.
- **Cari lewat ciri barang:** ketik beberapa kata dipisah spasi, mis. `pipa 3 inch putih`, `cat 5 kg`,
  `besi 12 mm`. Semua kata harus cocok; tiap kata boleh cocok di nama, kode, barcode, merk, kategori, atau
  atribut. Barang yang cocok di namanya tampil paling atas.
- **Melihat barang tanpa mengetik:** pilih kategori di kotak *Semua kategori* lalu klik **Daftar** (atau
  **Alt+↓**). **Enter** pada kotak cari yang kosong tetap berarti "lanjut bayar".
- Keterangan **"Belanja Rp … lagi untuk harga …"** tampil sebagai kotak kuning dengan angka merah di atas total:
  sebutkan ke pembeli, karena menambah belanja sebesar itu menurunkan harga semua barangnya.
- **F8** bayar → ketik uang yang diterima → **Enter**. Kembalian tampil besar; struk tercetak otomatis di kertas
  thermal. Di *Pengaturan › Struk & printer*: lebar kertas 57/58/80 mm, **Langsung cetak** / **Tanya dulu** /
  **Tidak dicetak**; tombol *Cetak struk* juga ada di layar hasil.
- **Bayar bukan tunai:** di kotak bayar tekan **B** (Transfer), **E** (EDC/kartu), atau **Q** (QRIS); tombolnya
  juga bisa diklik. Kotak **Rekening tujuan** langsung berisi rekening bawaan toko; bila toko punya lebih dari
  satu, pilih dari daftar. **Anda tidak mengetik nomor rekening.** Lalu **Enter**. Pembayaran ini tercatat
  *Belum dicek* sampai Admin/Owner mencocokkannya dengan mutasi bank. Bila daftar rekening kosong, minta
  Admin/Owner mengisinya di *Pengaturan › Pembayaran*.
- **Bayar campuran** (satu tagihan, lebih dari satu cara, mis. sebagian tunai sebagian transfer):
  1. Pilih cara bayar bagian pertama (**T** tunai, **B** transfer, **E** EDC, **Q** QRIS).
  2. Ketik nominal bagian itu, lalu tekan **C**. Bagian itu masuk daftar bernomor dan **sisa tagihan** berkurang.
  3. Ulangi untuk bagian berikutnya. Pada bagian terakhir tekan **Enter** (bukan C) untuk menyelesaikan.
  4. Salah ketik? Klik tanda silang di bagian itu, atau tekan **Backspace** saat kotak bayar kosong untuk
     menghapus bagian terakhir, atau **Hapus semua** untuk mengulang dari awal.
  5. Bila ada yang keliru (mis. jumlah melebihi tagihan), pesannya tampil tepat di bawah kotak bayar.
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
- *Retur Penjualan* — barang dikembalikan pembeli (sudah lewat shift atau sudah dikirim).
  1. Di *Pilih transaksi yang diretur*, 20 transaksi terbaru langsung tampil; klik transaksinya. Transaksi yang
     lebih lama: ketik nomor struk/invoice atau nama pembeli.
  2. Tabel menunjukkan **Dibeli**, **Sudah diretur**, dan **Sisa** tiap barang, dan retur sebelumnya atas
     transaksi itu. Isi qty (paling banyak sebesar Sisa), kondisi (baik/rusak/cacat), dan alasan.
  3. Pilih penyelesaian: **Uang dikembalikan**, **Tukar barang sama (tukar guling)** (barang yang sama, jumlah
     yang sama, tanpa uang), atau **Potong tagihan**. *Potong tagihan* hanya muncul bila transaksi itu masih
     punya sisa tagihan; sisa tagihannya tertulis di layar. Bila nilai retur lebih besar dari sisa tagihan,
     pakai *Uang dikembalikan*.
  4. Uang dikembalikan lewat transfer: pilih **rekening toko** asal uangnya dari daftar; rekening pembeli dan
     nomor referensi boleh diisi sebagai catatan, tidak wajib.
  5. **Ajukan & minta persetujuan**.
- **Persetujuan retur/void**: setelah diajukan muncul dialog *Persetujuan*. Tekan **Kirim kode ke atasan**:
  Admin/Owner menerima pesan Telegram/email berisi rincian permintaan dan **kode 6 angka**. Hubungi atasan; bila
  setuju ia menyebutkan kodenya → ketik → **Setujui dengan kode** (tercatat atas nama atasan; uang kembali dari
  laci shift Anda). Kode berlaku 10 menit, sekali pakai. Belum bisa menghubungi atasan: **Nanti saja, tunggu
  persetujuan**, lalu lanjutkan dari tab *Menunggu persetujuan* → **Setujui dengan kode**. Retur/void bernilai
  kecil (batas di Pengaturan) langsung jadi tanpa dialog. Anda tidak pernah diminta password atasan.
- **Salah input?** Selama masih *Menunggu*, buka tab **Menunggu persetujuan** → **Batalkan** (isi alasan), lalu
  ajukan lagi. Yang sudah *Disetujui* tidak bisa dibatalkan: kurang → retur tambahan; lebih → catat penjualan
  baru.

**Mengubah data pelanggan** (*Data Master › Data Pelanggan*): menambah pelanggan baru bebas. Mengubah pelanggan
yang sudah ada, menonaktifkan, atau mengaktifkannya kembali butuh persetujuan atasan:
1. Klik tombol titik tiga di ujung kanan baris pelanggan → **Ubah**, ubah isiannya, lalu tekan **Simpan dengan
   persetujuan…** (untuk nonaktif/aktif: di menu titik tiga yang sama pilih **Nonaktifkan** atau **Aktifkan
   kembali**).
2. Tekan **Kirim kode ke atasan**. Admin/Owner menerima pesan Telegram/email berisi **rincian perubahannya**
   (kolom apa, dari apa menjadi apa) dan kode 6 angka.
3. Hubungi atasan; bila setuju ia menyebutkan kodenya. Ketik kodenya → simpan.
4. Kode hanya berlaku untuk perubahan yang dibaca atasan. Bila isian Anda ubah lagi setelah kode diminta, kode
   itu ditolak dan Anda perlu meminta kode baru. Kode berlaku 10 menit, sekali pakai.
5. Term, limit kredit, dan golongan tidak bisa Anda ubah, dengan atau tanpa kode: itu wewenang Admin/Owner.

**Kas lain** (*Shift & Clerical Check*): kasbon, setor ke owner, kas masuk/keluar lain — selalu dengan keterangan.

**Akhir hari — tutup shift** (*Shift & Clerical Check*, kotak **Tutup shift & clerical check**). Dua langkah:

1. **Hitung dan kirim.** Hitung semua uang di laci (termasuk modal awal) per pecahan atau ketik totalnya. Angka
   sistem belum tampil (*blind count*), supaya hitungan Anda jujur dan tidak terpengaruh. Klik **Kirim hitungan**,
   periksa angkanya, lalu **Ya, kirim**. Hitungan ini **terkunci dan tercatat**; sejak itu shift berstatus
   *sedang ditutup* dan tidak bisa menerima uang lagi (spanduk kuning di atas halaman mengingatkan Anda untuk
   menyelesaikan penutupan).
2. **Lihat hasil dan tutup.** Tampil rincian: modal, penerimaan tunai, kas masuk/keluar, *saldo menurut sistem*,
   uang yang Anda hitung, dan **selisihnya** (hijau = cocok, abu-abu = selisih receh, merah = kurang, kuning =
   lebih). Di sampingnya ada **Tinjauan shift**: transaksi per jenis, pembayaran per metode, dan *linimasa tunai*
   (setiap uang yang masuk/keluar laci dengan jam, nomor, kembalian, dan saldo laci saat itu).
   - **Selisih receh** (bawaan sampai Rp 1.000, diatur Owner/Admin): keterangan tidak wajib; sistem menulis
     "Selisih receh" sendiri.
   - **Selisih di luar toleransi**: baca kotak **Bantuan mencari selisih**. Sistem mencocokkan nilai selisih
     dengan kejadian di shift Anda, mis. "Sama dengan kembalian STR-… (Rp 20.000)" atau "1 lembar Rp 50.000",
     plus daftar hal yang perlu diperiksa. Ini saran, bukan tuduhan. Bila menemukan uang yang terselip, buka
     **Hitung ulang (sekali)**, hitung lagi, dan kirim. Hitung ulang hanya **sekali**; kedua hitungan tercatat
     dan terlihat atasan. Bila masih berselisih, tulis **Keterangan selisih (wajib)**, mis. apa yang sudah Anda
     periksa.
   - Isi **Uang ditinggal di laci untuk shift berikutnya** (bawaan sebesar modal). Sisanya dianggap disetor.
     Angka ini menjadi pilihan *Sama dengan uang ditinggal kemarin* saat shift berikutnya dibuka.
   - Klik **Tutup shift**, periksa ringkasannya, lalu **Ya, tutup shift**. Setelah ditutup angka tidak bisa
     diubah; Admin/Owner bisa menambahkan penjelasan bila sebab selisih ditemukan kemudian.

Order yang masih Anda proses dikembalikan ke antrean saat shift ditutup.

- Bila toko mengatur jam tutup: 15 menit sebelumnya muncul pengingat biru di atas halaman; setelah lewat,
  peringatan kuning. Anda **masih bisa menjual** (pembeli yang datang terlambat tetap dilayani), tetapi tutuplah
  shift begitu pembeli terakhir selesai. Atasan ikut diberi tahu.
- Sistem **tidak pernah menutup shift sendiri**, karena menutup shift berarti menghitung uang di laci. Shift
  yang terbawa ke hari berikutnya mengunci pekerjaan Anda (lihat *Awal hari*).

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
- **Promo** (*Pengaturan › Promo*; menu samping "Promo" sudah tidak ada): buat potongan persen atau rupiah per satuan untuk semua barang, satu kategori, atau satu
  barang, dengan masa berlaku dan syarat (minimal qty per baris, minimal total belanja). **Untuk pembeli**: semua
  pembeli, satu golongan pelanggan, atau pelanggan tertentu; bisa juga disyaratkan "pelanggan sudah belanja
  minimal Rp … dalam … hari terakhir". Potongan promo dihitung dari harga tier yang berlaku (harga dasar, atau Grosir bila total belanja
  tercapai), jadi tier dan promo bisa terpakai bersama.
  Satu promo per baris (potongan terbesar). Promo yang sudah terpakai tidak bisa diubah aturannya; nonaktifkan
  lalu buat promo baru.
  - Kolom **Potongan diberikan** = jumlah rupiah potongan promo itu di semua penjualan (penjualan yang di-void
    tidak dihitung). Bila promo punya anggaran, di bawahnya tertulis "sisa Rp … dari Rp …".
  - **Anggaran promo** (opsional): jumlah seluruh potongan yang boleh diberikan. Saat sisanya lebih kecil dari
    potongan sebuah barang, barang itu dipotong sebesar sisanya; setelah habis, promo berhenti sendiri. Void
    mengembalikan anggaran; retur tidak.
  - **Potongan paling banyak per pembeli** (opsional): supaya satu pembeli tidak menghabiskan anggaran.
    Pelanggan terdata dihitung dari semua transaksinya; pembeli umum (tanpa nama) dihitung per transaksi. Bila
    anggaran diisi, angka ini harus lebih kecil dari anggaran.
  - Anggaran dan batas per pembeli boleh diubah walau promo sudah terpakai; anggaran tidak boleh di bawah yang
    sudah diberikan.
- **Pelanggan & pemasok** (*Data Pelanggan*, *Data Pemasok*): golongan (untuk sasaran promo; kelola lewat tombol
  **Golongan**), term pembayaran, limit. Daftar Data Pelanggan menampilkan **limit kredit dan sisanya**,
  **tagihan berjalan** (jumlah rupiah dan banyaknya nota), dan **jatuh tempo terdekat** ("5 hari lagi",
  "jatuh tempo hari ini", "terlambat 3 hari"); tombol **?** menjelaskan tiap kolom. Admin/Owner mengubah
  pelanggan langsung. Kasir/Staf butuh kode Anda untuk mengubah atau menonaktifkan pelanggan: pesan yang Anda
  terima memuat rincian perubahannya; **baca dulu, sebutkan kodenya hanya bila setuju**.
- **Rekening toko** (*Pengaturan › Pembayaran*): daftarkan sekali, supaya kasir tinggal memilih.
  1. Di kartu *Rekening bank (transfer)*, *Mesin EDC (kartu)*, atau *QRIS*, klik **Tambah**.
  2. Isi nama bank/mesin/QRIS (mis. BCA). Rekening bank: isi juga **Nomor rekening**; untuk EDC dan QRIS nomor
     boleh kosong. *Atas nama* boleh kosong. Nama yang tampil di layar kasir disusun otomatis.
  3. Centang **Jadikan bawaan untuk …** bila ini rekening yang paling sering dipakai: ia langsung terpilih di
     layar kasir. Satu bawaan per jenis.
  4. **Simpan**. Rekening yang tidak dipakai lagi **dinonaktifkan** (bukan dihapus) agar hilang dari pilihan
     kasir; pembayaran lama yang memakainya tetap utuh.
- **Cek uang non-tunai** (*Shift & Clerical Check › Cek uang non-tunai*; Admin/Owner). Sistem tidak tersambung
  ke bank, jadi setiap pembayaran transfer/EDC/QRIS dicatat *Belum dicek* sampai Anda mencocokkannya:
  1. Buka mutasi m-banking (atau rekap settlement EDC, atau riwayat QRIS) untuk tanggal yang sama.
  2. Di layar, pilih **Rekening** yang sedang Anda cocokkan. Ringkasan di atas tabel menampilkan jumlah dan
     total pembayaran untuk rekening itu; angka itulah yang dibandingkan dengan mutasi.
  3. Untuk tiap baris, cari uang masuk dengan nominal yang sama di mutasi. Ada: **Sudah masuk**. Tidak ada:
     **Tidak masuk…** lalu tulis catatannya (wajib), mis. "tidak ada di mutasi 12/10".
  4. Baris yang sudah ditandai pindah dari daftar *Belum dicek*; lihat lagi lewat pilihan **Hasil cek**. Salah
     tanda: **Ubah hasil cek**.
  5. **Tidak masuk tidak mengubah penjualannya.** Itu tanda untuk ditindaklanjuti: hubungi pembeli; setelah
     uangnya masuk ubah menjadi *Sudah masuk*; bila batal, koreksi lewat void atau retur. Lonceng menampilkan
     jumlah yang belum dicek dan yang tidak masuk. Hasil cek juga tampil di rincian penjualan.
  6. Pembayaran non-tunai yang dicatat sebelum fitur ini ada sudah ditandai *Sudah masuk* dengan catatan khusus.
- **Jadwal shift** (*Pengaturan › Operasional › Jadwal shift*): isi **Jam buka shift** dan **Jam tutup shift**
  (boleh dikosongkan; jam tutup harus setelah jam buka). Jadwal baru berlaku untuk shift yang **dibuka setelah
  disimpan**; shift yang sedang berjalan memakai jadwal saat ia dibuka.
- **Menutup shift orang lain** (kasir lupa atau berhalangan): *Shift & Clerical Check › Semua shift* → centang
  **Hanya yang perlu ditutup** → klik nomor shiftnya → di bagian **Tutup shift ini (milik …)** jalankan dua
  langkah yang sama dengan kasir (hitung dan kirim, lalu lihat hasil dan tutup). Tanda warna: *Buka*, *Buka,
  lewat jam tutup*, *Sedang ditutup*, *Terlewat, belum ditutup*. Shift tercatat ditutup atas nama Anda.
- **Menyetujui koreksi modal**: bila kasir meminta kode *Koreksi modal*, pesan Telegram/email memuat nomor shift,
  modal lama → baru, dan alasannya. Berikan kodenya hanya bila Anda yakin angka barunya benar (mis. sudah melihat
  sendiri isi laci). Admin/Owner juga bisa mengoreksi modal langsung tanpa kode selama shift masih berjalan.
- **Penjelasan selisih** (setelah shift ditutup): buka shift yang berselisih di *Semua shift*, isi **Penjelasan
  selisih (Admin/Owner)**, mis. "uang Rp 50.000 terselip di bawah laci, sudah disetor", lalu **Tandai
  terjelaskan**. Angka clerical tidak berubah; penjelasan, nama, dan waktunya tercatat.
- **Toleransi dan batas hitung** (*Pengaturan › Operasional*): **Toleransi selisih kas** (rupiah; selisih sampai
  angka ini tidak wajib keterangan) dan **Batas hitung susulan** (menit; untuk shift yang dibuka dengan *hitung
  nanti*).
- **Penerimaan barang** (*Persediaan › Penerimaan Barang*): catat barang datang dari pemasok (pembelian tunai/
  tempo atau titipan). Stok dan HPP rata-rata diperbarui otomatis.
- **Stok** (*Persediaan › Stok Persediaan*): posisi stok, mutasi, kartu stok per barang, stok tertahan, dan
  **penyesuaian** (saldo awal, koreksi, barang rusak, **stok opname**). Barang yang tidak dihitung saat opname
  dikecualikan dengan alasan, bukan dihapus.
- **Saran pesan ulang** (*Persediaan › Stok Persediaan › Saran pesan*): daftar barang yang perlu dibeli dan
  berapa banyak, dikelompokkan per pemasok.
  1. Isi dulu sekali per pemasok di *Data Pemasok* › Ubah: **Lama kirim (hari)** (dari memesan sampai barang tiba)
     dan **Belanja tiap (hari)** (seberapa sering Anda belanja ke pemasok itu). Kosong = memakai bawaan di
     *Pengaturan › Operasional* (bawaan 3 dan 7 hari).
  2. Buka tab **Saran pesan**. Empat kotak di atas menghitung barang per status: **Pesan sekarang** (stok sudah di
     titik pesan ulang), **Segera pesan** (akan habis sebelum belanja berikutnya), **Aman**, **Tidak laku** (tidak
     terjual 30 hari terakhir: modal tertahan). Klik kotak untuk menyaring.
  3. Tiap baris menulis terjual dan rata-rata per hari, stok tersedia dan cukup untuk berapa hari, titik pesan,
     **saran pesan** (dan dalam dus/kemasan bila ada), serta perkiraan biaya. Total perkiraan belanja ada di bilah
     saringan.
  4. Tombol **?** menjelaskan rumusnya dengan contoh. **Cetak / Excel** membuka laporan *Rekomendasi Pemesanan
     Ulang* untuk dibawa saat belanja.
  5. Angka dihitung dari penjualan sampai **kemarin**, jadi penjualan hari ini belum mengubah rata-rata. Saran
     adalah bahan keputusan; jumlah yang dibeli tetap keputusan Anda. Lonceng menampilkan "Barang perlu dipesan"
     bila ada yang berstatus Pesan sekarang.
- **Stok rusak** (tab *Stok rusak* di *Stok Persediaan*): barang rusak tidak bisa dijual. Pindahkan dari stok
  baik lewat *Penyesuaian › Stok rusak*. Lalu pilih **Retur ke pemasok** (diklaim) atau **Musnahkan** (dibuang;
  alasan wajib).
- **Retur ke pemasok** (*Persediaan › Retur ke Pemasok*): pilih pemasok, barang (dari stok baik atau rusak), alasan,
  dan penyelesaian: **Potong hutang** (pilih penerimaan tempo yang dipotong), **Ganti barang** (barang pengganti
  langsung tercatat masuk), **Uang kembali** (tunai ke laci shift Anda atau transfer), **Pengembalian titipan**
  (barang konsinyasi). Retur tidak bisa diubah setelah disimpan. **Cetak nota retur** untuk ditandatangani pemasok.
- **Hutang pemasok** (*Persediaan › Hutang Pemasok*): pembelian tempo yang belum lunas, umurnya, dan yang lewat
  jatuh tempo (juga muncul di lonceng). **Bayar**: transfer (isi rekening tujuan milik pemasok) atau tunai dari laci shift Anda;
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
  piutang, konsinyasi. Daftar laporan di kiri berupa tiga kelompok (Persediaan, Penjualan, Keuangan) yang bisa
  dibuka dan ditutup dengan mengklik namanya; pilihan itu diingat di komputer tersebut.
- **Pengaturan**: profil toko & logo, struk & printer, penomoran, aturan operasional (termasuk jadwal shift),
  pembayaran (rekening toko), harga & diskon, promo, keamanan, persetujuan.
- **Mencetak laporan, invoice, atau surat jalan** (kertas A4): di jendela cetak, periksa kotak **Printer**
  lebih dulu. Peramban mengingat printer yang terakhir dipakai, jadi bila sebelumnya mencetak ke printer struk,
  ganti ke printer A4. Ukuran dan arah kertas sudah diatur tiap dokumen. Agar tidak perlu berganti-ganti,
  nyalakan cetak struk langsung (lihat *Kasir › Struk tanpa jendela cetak*): setelah itu jendela cetak hanya
  dipakai dokumen A4.

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
