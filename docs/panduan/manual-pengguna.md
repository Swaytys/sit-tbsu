# Buku Panduan BonsaiUrip (Manual Pengguna)

Untuk: pemilik, admin, kasir, dan staf penjualan. Baca bagian peran Anda; menu yang tidak tampil berarti memang
bukan bagian tugas Anda. Semua layar berbahasa Indonesia; angka uang dalam rupiah.

**Masuk:** buka alamat aplikasi (di komputer kasir: ikon *Buka Kasir*), isi username dan password. Login pertama
wajib mengganti password. Sesi berakhir sendiri setelah 60 menit tidak dipakai. Lupa password → klik **Lupa password?** di
halaman masuk (kode ke email, atau kode pemulihan), atau minta Owner/Admin mereset di *Data Pengguna*.

**Menyalakan dan mematikan (komputer tempat BonsaiUrip terpasang):** klik ikon **BonsaiUrip** di desktop; layar
pembuka cokelat tampil, lalu peramban terbuka. Selama menyala ada ikon BonsaiUrip di pojok kanan bawah layar (dekat
jam; klik panah **^** bila tersembunyi). Menutup peramban tidak mematikan aplikasi; klik dua kali ikon itu untuk
membuka lagi. Untuk mematikan: tutup shift, klik kanan ikon › **Matikan BonsaiUrip** › **Ya**. Panduan pemakaian
pertama: menu Start › BonsaiUrip › *Panduan mulai pakai*.

**Pemakaian pertama (setup awal dan tur):** saat BonsaiUrip pertama kali dibuka, Owner mengisi **Setup awal**
langkah demi langkah: data usaha, cara berjualan, akun Owner, kode pemulihan, lalu (boleh dilewati) logo & struk,
rekening, email toko, cadangan, akun karyawan, dan data awal. Setelah itu **tur pengenalan** menyorot bagian-bagian
layar; saat sebuah menu dibuka pertama kali, tur fitur ditawarkan di pojok kanan bawah. Semua tur bisa diulang dari
menu nama Anda › **Tur & panduan**; Owner juga bisa **Ulangi setup awal** dari sana. Prosedur baku penggunaan ada di
**Buku SOP** (`buku-sop.md`).

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
     (ukuran, warna, berat), dan atribut boleh sebagian: `1` menemukan 10 dan 12,5, `c` menemukan cm. Barang yang
     cocok lewat namanya tampil paling atas.
   - **Label di samping nama** (dari penjualan 30 hari terakhir, diperbarui tiap 10 menit): **Laris** (20% barang
     dengan penjualan tertinggi), **Lambat** (terjual sedikit), **Tidak laku** (tidak terjual 30 hari), **Baru**
     (ditambahkan kurang dari 30 hari). Arahkan kursor ke label untuk melihat jumlah terjual dan tanggal terakhir
     terjual. Angka **stok** di hasil cari tebal merah supaya cepat terbaca.
   - **Tidak mau mengetik?** Pilih kategori di kotak *Semua kategori* (sebelah kotak cari), lalu klik **Daftar**
     (atau **Alt+↓**): 30 barang pertama tampil urut nama beserta foto kecilnya; klik barangnya, atau sorot
     dengan panah lalu **Enter**.
2. Pembeli umum tidak perlu nama. Pelanggan langganan: **F4** cari pelanggan. Pengantaran: **F3** ubah jenis
   (alamat pelanggan terisi otomatis). **Catatan untuk kasir** (opsional) ikut tampil di tiket antrean kasir.
   - **Rincian barang**: saat barang disorot di hasil cari (panah atau kursor), rinciannya (foto, stok tersedia/
     fisik/dipesan, harga tiap satuan dan tier, atribut, label keterjualan, terjual 30 hari, rata-rata per hari,
     terakhir terjual) tampil menutupi daftar *Order saya*. **Esc** atau tombol **×** di pojok kanan atas menutupnya.
   - **Peringatan "juga ada di draf lain"**: bila barang yang baru ditambahkan juga ada di draf orang lain (atau
     draf Anda yang lain) dan stoknya tidak cukup untuk semuanya, muncul peringatan yang menyebut draf itu
     (nomor, pembeli, pembuat, qty). Draf belum menahan stok, jadi pembeli yang lebih dulu dibayar yang mendapat
     barangnya. Pilih: **Biarkan** (Enter), **Hapus lagi dari order ini** (Esc), atau **Buka draf …** (B; hanya
     draf Anda sendiri: isian sekarang disimpan dulu sebagai draf, lalu draf itu dibuka untuk dilanjutkan). Bila
     draf milik orang lain, hubungi dia bila pembelinya masih menunggu.
3. Isian yang belum dikirim **tidak hilang**: saat Anda pindah menu atau menutup halaman, isian disimpan sebagai
   **draf** dan dibuka lagi saat kembali ke Order Penjualan (draf lain bisa diklik di "Order saya"). Tidak ingin
   draf terakhir terbuka sendiri? Hilangkan centang **Buka draf otomatis** di atas *Order saya*; form lalu selalu
   kosong saat dibuka, dan draf dibuka dengan mengkliknya. Pilihan ini tersimpan di peramban komputer/tablet itu. Tombol
   **Simpan draf & order baru** menyimpan isian sekarang sebagai draf lalu mengosongkan form untuk pembeli
   berikutnya. Qty bisa diubah dengan tombol **−** / **+** di sebelah qty.
   - **Mulai dari awal** (tombol, atau **F9**): mengosongkan isian order yang sedang diketik (draf yang sedang
     diisi ikut dibuang). Selalu muncul pertanyaan dulu; tombol yang tersorot adalah **Batal**, jadi F9 yang
     terpencet lalu Enter tidak menghapus apa pun. Pilih **Ya, mulai dari awal** bila memang ingin mengosongkan.
4. **F8** kirim ke antrean. Order mendapat **nomor antrean** dan langsung muncul di layar kasir. Serahkan barang
   ke kasir sambil menyebut isi order (mis. "semen 3 sak, nomor 12").
   - **Pembeli pesan sekarang, mengambil nanti** (mis. besok atau minggu depan): klik **Simpan untuk nanti** (atau
     **F7**). Isi **Nama pembeli** (tidak perlu bila pelanggan terdaftar dipilih), **No. HP pembeli**, dan
     **Rencana tanggal ambil** (tombol cepat *Hari ini / Besok / 3 hari / 7 hari / 14 hari*, paling lama 14 hari),
     lalu **Simpan order** (Enter). Barangnya langsung **ditahan** (tidak bisa dijual ke pembeli lain), tetapi order
     **tidak masuk antrean kasir**; ia tampil di *Order Penjualan › Daftar order › Disimpan*. Saat pembeli datang:
     buka order itu lalu **Kirim ke antrean** (atau kasir langsung **Proses ke pembayaran**). Lewat tanggal ambil:
     order ditandai merah dan lonceng mengingatkan untuk menghubungi pembeli; order **tidak** dibatalkan sendiri.
     Pembeli batal: **Batalkan** (stok dilepas). Pembeli belum pasti: **Kembalikan ke draf** (stok dilepas,
     barang tetap tersimpan).
5. Stok yang tampil adalah stok **tersedia** (sudah dikurangi order lain yang belum dibayar).
6. **Harga dan promo otomatis**: harga mengikuti total belanja (mis. harga Grosir untuk semua barang begitu total
   belanja mencapai Rp 1.000.000; di atas total tertulis "Belanja Rp … lagi untuk harga Grosir"). Promo untuk
   pembeli tertentu terpakai sendiri bila pelanggannya dipilih (**F4**).
   Potongan promo tampil hijau di bawah barang ("Promo … −Rp …"). Anda tidak perlu memilih harga apa pun.
7. **Pelanggan baru** boleh Anda tambahkan sendiri kapan saja. **Mengubah data pelanggan yang sudah ada**, atau
   menonaktifkan/mengaktifkannya, butuh persetujuan atasan (lihat *Kasir › Mengubah data pelanggan*; caranya
   sama).

## Kasir

Tugas: menerima pembayaran, mencetak struk/invoice, dan mempertanggungjawabkan uang shift.

**Shift toko.** Toko memegang satu kumpulan uang tunai, jadi hanya ada **satu shift terbuka**. Siapa pun yang punya menu
*Shift & Clerical Check* boleh membuka dan menutupnya. Semua uang tunai masuk ke shift itu, dengan nama pencatatnya.
Status shift tampil di bagian atas layar untuk semua orang (*Shift buka* / *Shift tutup*).

**Buka shift** (*Shift & Clerical Check* → **Buka shift**). Pilih dengan klik atau tombolnya:

1. **Enter — Pakai uang kemarin.** Laci tidak disentuh sejak shift terakhir ditutup.
2. **H — Hitung sekarang.** Isi jumlah lembar per pecahan (atau **Total saja**), lalu **Enter**.
   - Di kotak pecahan: **↑ ↓** pindah, **+ −** ubah 1, **Del** kosongkan baris, **Shift+Del** kosongkan semua.
3. **N — Buka dulu, hitung nanti.** Toko sudah ramai: langsung jualan, hitung uang shift dalam 60 menit.

Konfirmasi menampilkan modal awal dengan huruf besar: **Enter** = buka, **Esc** = kembali (angka tidak hilang).
**Esc** di langkah pertama menutup jendela.

**Hitung nanti — cara menghitung** (kotak kuning *Hitung uang shift* di halaman Shift):
1. Hitung **semua** uang shift. Uang penjualan tadi dan kembalian yang sudah keluar **tidak perlu dipisah**.
2. **Kirim hitungan** → **Ya, kirim**. Hasil tampil dengan angka, misalnya:
   *Laci Rp 160.000 − masuk sejak buka Rp 15.000 = modal saat buka Rp 145.000. Kemarin ditinggal Rp 150.000 →
   selisih semalam −Rp 5.000.*
3. Beda besar? **Hitung ulang (sekali)**. Lalu **Simpan hasil**. Selisih semalam tercatat untuk Owner.
- Modal sementara (uang kemarin) hanya angka sementara; angka sebenarnya dari hitungan ini.
- **Koreksi modal** baru tersedia setelah hasil disimpan.

**Salah ketik modal**: **Koreksi modal** → isi modal yang benar dan alasan → **Simpan koreksi**. Angka lama tetap
tercatat. Setelah ada transaksi tunai, tombolnya **Minta persetujuan…** → **Kirim kode ke atasan** → ketik kode →
**Setujui dengan kode**. Jendela kode tertutup sebelum kode diketik? Buka lagi: kode yang sama masih berlaku.

**Tambah uang shift** (mis. receh habis) atau **Setor ke owner**: catat di *Kas masuk / keluar*. Bukan penjualan.

**Shift kemarin belum ditutup**: uang tunai tidak bisa dicatat. Tutup dulu (hitung uang shift), lalu buka shift baru.

**Pembeli datang setelah shift ditutup**: buka shift baru → **Enter** (pakai uang yang tadi ditinggal) → **Enter**.

**Order yang tidak jadi dibayar sekarang** (layar kasir, order dari antrean sudah dibuka): tekan **F9** (atau
**Mulai dari awal**). Muncul pilihan:
- **A — Kembalikan ke antrean**: pembeli masih di toko dan akan dilayani lagi. Stok tetap ditahan.
- **S — Simpan untuk diambil nanti…**: pembeli datang lagi lain hari; isi No. HP dan tanggal ambil. Stok tetap
  ditahan; order pindah ke *Daftar order › Disimpan*.
- **D — Kembalikan ke draf**: pembeli batal untuk sementara (mis. lupa membawa dompet). Stok dilepas; daftar
  barangnya tetap tersimpan sebagai draf milik staf yang membuatnya, jadi tidak perlu diketik ulang.
- **Esc**: kembali ke transaksi.

**Order disimpan** (pembeli datang mengambil pesanannya): di atas papan antrean tertulis "*n* disimpan" (merah bila
ada yang lewat tanggal ambil). Klik, pilih order pembelinya, lalu **Proses ke pembayaran**: order langsung terbuka
di layar kasir seperti order antrean.

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
- **Menu baris (⋮ atau M)**: setiap barang di daftar punya tombol ⋮ berisi ubah qty, ganti satuan,
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
  satu, pilih dari daftar. **Anda tidak mengetik nomor rekening.** Isi **No. referensi** (wajib, minimal 4 huruf/
  angka): nomor referensi di bukti transfer/e-wallet pembeli, nomor approval/trace di struk EDC, atau nomor
  referensi di notifikasi QRIS. Lalu **Enter**. Pembayaran ini tercatat *Belum dicek* sampai Admin/Owner
  mencocokkannya dengan mutasi. Tombol cara bayar bergaris putus-putus = rekeningnya belum didaftarkan, jadi belum
  bisa dipakai; minta Admin/Owner mengisinya di *Pengaturan › Pembayaran*. E-wallet (OVO, GoPay, DANA, ShopeePay)
  memakai **Transfer**.
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
  langsung ke printer thermal**. Cukup sekali per komputer kasir; setelan tetap tersimpan setelah komputer
  dimatikan. Bila printer mati saat menjual, penjualan tetap tersimpan dan muncul tombol **Jendela cetak**.
  Struk pudar: *Pengaturan lanjutan* › **Kepekatan cetak** (Normal / Tebal / Paling tebal). Logo di struk:
  nyalakan *Kop struk memakai logo toko*; pratinjau hitam-putihnya tampil di kartu printer. Panduan lengkap dan
  daftar masalah: `docs/panduan/printer-struk.md`.
- **Invoice dan surat jalan** (Pengaturan › Struk & printer › kartu *Invoice, surat jalan & kertas*): pilih
  kertas tiap dokumen (bawaan A4 lanskap) dan kapan dicetak setelah dibuat: **Langsung cetak**, **Tanya dulu**
  (muncul pemberitahuan dengan tombol *Cetak*), atau **Tidak dicetak**. Invoice tetap bisa dicetak kapan pun
  dengan **P**. Agar keluar tanpa jendela cetak, ikuti langkah di dalam kartu itu (mode kasir + printer A4
  sebagai printer bawaan Windows).
- **Pembeli terdata boleh belum lunas.** Pilih pelanggan (F4 atau klik nama pelanggan), lalu pilih cara bayar:
  **Lunas** (L), **DP** (U: ketik uang muka, sisanya jadi piutang), atau **Bayar nanti** (N: seluruhnya piutang).
- Barang belum diambil pembeli: tandai *belum diambil*; konfirmasi saat diambil.

**Penjualan pengantaran** (*Transaksi › Penjualan Pengantaran*): pilih order pengantaran dari antrean, **atau
buat langsung di halaman ini**: klik *Pelanggan* (atau F4) → pilih pelanggan (atau **Pelanggan baru**) → isi
alamat kirim dan ongkir → tambah barang. Pelanggan pengantaran wajib punya No. HP. Lalu pilih cara bayar:
**Lunas** (L), **DP** (U), **Bayar nanti** (N), atau **Saat terima** (S: ditagih saat barang diterima) → **Buat
invoice** → **P** cetak invoice, **S** kirim dengan rit: pilih rit (kendaraan + sopir) atau buat **Rit baru**
(**Alt+N**), periksa qty, **Enter**. Surat jalan dicetak saat rit berangkat.

**Mengantar barang** (*Logistik › Pengiriman*; dari halaman Penjualan Pengantaran juga ada tautan **Pengiriman
(papan)**). Papan empat kolom seperti papan tugas; kartu dikerjakan dari kiri ke kanan. Istilah: **rit** = satu
kendaraan + satu sopir berangkat sekali, membawa satu atau beberapa surat jalan.

1. **Backlog** — invoice pengantaran yang barangnya belum dikirim (semua atau sebagian). **#angka** hitam = nomor
   antrean order (kode pendek untuk mengenali order; sama walau order dibagi). Garis kiri: biru = order baru, kuning
   *Sisa dibagi* = sisa order yang sebagian sudah dijadwalkan, oranye *Kirim ulang* = sisa dari pengantaran
   sebelumnya (barang kembali atau pengganti barang rusak). Lencana *Hari ini* atau tanggal order. Tanda *Bayar di
   tempat* = sopir menagih uangnya. Tombol **(i)** = info cepat (telepon, alamat, catatan, barang). Saringan di
   bawah judul kolom: **Semua / Hari ini / Lebih lama**.
2. **Dijadwalkan** — rencana rit.
   - **Buat rit**: klik **Rit baru** (atau tekan **R**) → pilih **Kendaraan** dan **Sopir** → periksa **Jadwal
     berangkat** → catatan bila perlu (mis. rute) → **Enter**. Kendaraan yang sedang di jalan boleh dipilih untuk
     rit berikutnya (tertulis *sekarang di jalan: TRP-…*).
   - **Isi rit**: tarik kartu invoice dari Backlog lewat pegangan ⋮⋮ di kiri atas kartu, lepas di atas grup rit
     (grup berbingkai biru saat bisa dilepas). Tanpa menyeret: klik **⋮** di kanan atas kartu → pilih rit di bawah
     *Masukkan ke rit*. Surat jalan untuk **semua** barang yang belum dikirim langsung dibuat, dengan nama sopir dan
     plat kendaraan rit itu. Bila hanya sebagian barang yang dibawa: **⋮ › Kirim sebagian / pilih rit…** → pilih
     **Rit** → ubah **Qty kirim** → **Enter**. Sisanya tetap di Backlog.
   - **Dengan keyboard saja**: tekan **Tab** sampai pegangan ⋮⋮ kartu tersorot → **Spasi** (kartu terangkat) →
     **panah kanan/kiri/atas/bawah** memilih tempat lepas (grup rit atau kolom Backlog; yang terpilih berbingkai
     biru) → **Spasi** melepas, **Esc** membatalkan.
   - Surat jalan **tidak pernah** dibuat tanpa rit, jadi selalu tertulis sopir dan kendaraannya.
   - **Pindah**: seret kartu surat jalan ke grup rit lain, atau **⋮ › Pindah ke rit** (sopir dan kendaraan di surat
     jalan ikut berganti).
   - **Keluarkan**: seret kartu surat jalan ke kolom Backlog, atau **⋮ › Keluarkan ke Backlog**. Surat jalannya
     batal (tercatat di log) dan ordernya kembali ke Backlog untuk dijadwalkan lagi.
   - **Cetak**: tombol **Cetak** pada grup rit mencetak semua surat jalan rit itu sekaligus (bisa juga sebelum
     berangkat, mis. untuk dicek gudang).
   - Header grup menunjukkan nomor rit, plat, jam, sopir, jumlah surat jalan, dan **bar muatan** (hijau aman, kuning
     hampir penuh, oranye perlu alasan, merah melebihi). Klik panah di kiri header untuk menciutkan/membuka grup.
   - **Dimuat** (centang di tiap kartu surat jalan): centang setelah barang surat jalan itu naik ke kendaraan; klik
     lagi untuk melepas bila salah. Header grup menulis *dimuat 1/3* dst., dan **bar muatan** hanya menghitung yang
     sudah dicentang. **Berangkat** baru aktif setelah semua dicentang.
   - **Muatan berlebih**: di atas 100% sampai batas toleransi (bawaan 110%, diatur Owner di *Pengaturan ›
     Operasional*) rit boleh berangkat dengan alasan tertulis; di atasnya tidak bisa berangkat. Ganti kendaraan
     (atau sopir/jadwal) dengan tombol **Ubah** pada grup rit, atau keluarkan sebagian surat jalan.
   - **Berangkat**: klik pada grup → periksa panel muatan (tulis alasan bila oranye) → pilih surat jalan setelah
     berangkat: **1 Cetak** (ke printer), **2 Simpan PDF** (di jendela cetak pilih tujuan *Simpan sebagai PDF*), atau
     **3 Tidak sekarang** → **Berangkat** (atau **Enter**). Semua surat jalan rit keluar dalam satu jendela cetak,
     tiap surat jalan di halaman baru (dua rangkap bila diatur di Pengaturan). Kendaraan dan sopir ditolak bila
     masih di jalan dengan rit lain.
   - **Batal rit**: tulis alasannya. Surat jalannya ikut batal; ordernya kembali ke Backlog.
   - Papan memuat ulang sendiri tiap 30 detik. Bila dua orang mengubah rit yang sama, yang kedua mendapat pesan
     "muat ulang halaman".
3. **Di jalan** — satu kartu per rit (nomor TRP, plat, sopir dan No. HP-nya, jam berangkat, lama di jalan).
   Kartu menguning bila lebih dari 6 jam atau sudah ganti hari. Saat sopir kembali membawa surat jalan bertanda
   tangan, klik **Catat hasil** pada surat jalannya:
   - Semua barang sampai dengan baik → **Semua diterima** (atau **Enter**).
   - Ada yang tidak sampai: isi hanya kolom yang perlu, lalu **pilih alasannya** di kotak yang muncul di bawah
     angka. Kolom **Diterima** terhitung sendiri.
     - **Kembali utuh** (barang dibawa pulang dalam keadaan baik), alasan:
       - *Kirim ulang nanti* (rumah tutup, alamat salah, pembeli menunda): barang tetap milik pembeli, stok tidak
         berubah, dan muncul lagi di *Backlog* bertanda *Kirim ulang*.
       - *Kelebihan pesanan*, *Salah barang*, atau *Pembeli batal*: barang kembali ke stok jual; nilainya
         diselesaikan di kotak di bawahnya.
     - **Rusak**, alasan *Rusak di jalan* atau *Rusak/cacat saat dicek pembeli*: ditanggung toko (masuk stok rusak).
       Tanyakan pembeli lalu pilih **Dikirim pengganti** (tagihan tetap; pengganti muncul di *Backlog*) atau
       **Tidak diganti** (nilainya diselesaikan di kotak di bawahnya).
     - Kotak **Nilai barang dikembalikan/rusak** menyebut status bayar pembeli dan pilihannya:
       - pembeli **belum membayar** apa pun → nilainya **memotong tagihan** (tanpa pilihan);
       - pembeli **sudah membayar sebagian** (DP) → pilih **Potong tagihan** (sisa tagihan berkurang; bila nilainya
         lebih besar dari sisa tagihan, kelebihannya dikembalikan) atau **Kembalikan uang** (paling banyak sebesar
         yang sudah dibayar; sisanya memotong tagihan). Di samping tiap pilihan tertulis hasilnya;
       - tagihan **sudah lunas** → uangnya **dikembalikan** (tanpa pilihan).
     - Bila ada uang yang dikembalikan, pilih **Tunai** (diambil di toko atau diantar nanti) atau **Transfer**
       (rekening pembeli boleh dikosongkan dulu). Uangnya **belum keluar** saat hasil disimpan: tugasnya menunggu di
       *Retur Penjualan › Pengembalian uang* (lonceng: *Pengembalian uang menunggu*).
   - **Pengembalian uang** (*Retur Penjualan › Pengembalian uang*): dua daftar.
     - *Menunggu diserahkan tunai*: saat pembeli datang/uang diantar, klik **Sudah diserahkan** → **Enter**. Uang
       dicatat keluar dari kas shift yang sedang buka (shift harus terbuka).
     - *Menunggu ditransfer* (Admin/Owner): kirim uangnya dari rekening toko, klik **Sudah ditransfer** → isi
       rekening tujuan dan **No. referensi** dari bank (4–40 huruf/angka) → **Enter**.
     - Salah pilih cara, atau pembeli berubah pikiran? Klik **Jadikan tunai** / **Jadikan transfer**, isi alasannya
       (ada saran yang bisa diklik) → **Ganti cara**. Bisa selama belum dikonfirmasi.
   - Isi **Nama yang menerima** bila berbeda dari pembeli → **Simpan hasil**.
   Kartu surat jalan di *Di jalan* dan *Selesai hari ini* diberi penanda: **Terkirim semua** (hijau), **Ada yang
   kembali** (kuning), **Ada yang rusak** (merah); klik nomornya untuk rincian.
   Barang dikembalikan/rusak menjadi retur otomatis. Bila Anda kasir, retur itu menunggu persetujuan atasan (tampil
   *menunggu atasan* di surat jalan); barangnya baru bisa dikirim ulang setelah diputuskan. Perjalanan selesai
   sendiri setelah hasil semua surat jalannya dicatat; kendaraan dan sopir bebas lagi.
4. **Selesai hari ini** — rit yang hasilnya sudah dicatat semua hari ini. Rit lebih lama: *Kendaraan & Sopir* →
   klik angka di kolom **Perjalanan**.

Uang yang dibawa pulang sopir (bayar di tempat) dicatat lewat **Terima pembayaran** di invoice-nya.

**Muatan kendaraan** (saat **Berangkat**): setelah kendaraan dipilih, tampil bar **Berat** (dibanding daya angkut),
**Volume** (dibanding ruang bak), dan **Barang terpanjang**. Hijau = aman; kuning = hampir penuh (periksa setelah
dimuat); oranye = melewati batas wajar, **wajib tulis alasan** kenapa tetap aman (mis. ditumpuk di atas dinding,
diikat, ditutup terpal); merah = **ditolak**, tombol Berangkat mati: kurangi surat jalan atau pilih kendaraan lain.
Berat tidak pernah boleh melebihi daya angkut. Perhitungan butuh **Data muatan** barang: di *Data Barang › Ubah*,
kartu *Data muatan*, isi berat dan ukuran kemasan untuk 1 satuan dasar (boleh dalam g/kg/ton dan mm/cm/m; centang
*Barang curah* untuk pasir/batu dan isi volumenya).

**Mengisi data muatan banyak barang sekaligus** (Admin/Owner; *Data Barang* → **Data muatan Excel**):
1. Klik **Yang belum lengkap** (hanya barang aktif yang berat/ukurannya belum diisi) atau **Semua barang**. Berkas
   Excel terunduh, berisi kode, nama, satuan dasar, dan data muatan sekarang.
2. Di Excel, isi kolom `berat_kg`, `panjang_cm`, `lebar_cm`, `tinggi_cm` untuk **1 satuan dasar** (lihat kolom
   `satuan_dasar`). Tulis angka saja (kg/cm), atau angka dengan satuan: `500 g`, `1,2 ton`, `700 mm`, `0,7 m`.
   Panjang, lebar, tinggi diisi ketiganya atau dikosongkan ketiganya.
3. Pasir/batu/tanah: `curah` = **YA**, isi berat dan `volume_m3` (mis. `1` atau `500 L`); ukuran dikosongkan.
4. Jangan ubah kolom `kode`. Sel yang dikosongkan berarti datanya dihapus; kolom yang Anda hapus dari berkas tidak
   mengubah apa pun. Simpan berkas.
5. Kembali ke halaman tadi → **Pilih berkas .xlsx**. Tabel pratinjau menunjukkan tiap barang: **Berubah** (kolom
   *Perubahan* berisi nilai lama → baru), **Tetap**, atau **Galat** (merah, dengan sebabnya). Belum ada yang
   tersimpan.
6. Perbaiki baris bergalat di Excel lalu unggah lagi, atau klik ikon tempat sampah untuk membuang barisnya.
7. Klik **Simpan n perubahan**. Semua tersimpan sekaligus; tiap barang tercatat di log aktivitas.
Dari daftar barang, saring **Data muatan belum lengkap** lalu klik **Isi lewat Excel** untuk ke halaman yang sama.

**Kendaraan & Sopir** (*Logistik › Kendaraan & Sopir*): daftar kendaraan (plat seperti di STNK, mis. `S 1234 AB`,
jenis, **daya angkut** dari buku KIR/STNK, **ukuran bak** dalam cm, masa berlaku STNK/KIR) dan sopir (nama, No. HP). Admin/Owner menambah dan mengubahnya; kasir melihat. Klik angka di
kolom **Perjalanan** untuk melihat riwayat perjalanannya. Kendaraan/sopir yang tidak dipakai lagi dinonaktifkan
(tidak bisa selama masih di jalan). Plat dan nama sopir yang sudah ada tidak bisa didaftarkan dua kali.

**Servis berkala**: di data kendaraan isi **Tiap … km** dan/atau **Tiap … bulan** (mis. 5000 km atau 6 bulan). Kolom
*Odometer · servis · surat* di daftar kendaraan menunjukkan km terakhir yang tercatat, servis berikutnya (kuning bila
tinggal ≤ 500 km atau ≤ 14 hari, merah bila terlewat), dan tanda **STNK/KIR hampir habis** (≤ 30 hari) atau
**habis**. Pengingat yang sama muncul di lonceng notifikasi Admin/Owner. Kendaraan yang surat-suratnya habis tetap
bisa dipilih saat membuat rit, tetapi pilihannya bertanda *KIR habis*/*STNK habis*.

**Catat BBM** (Kasir, Admin, Owner; tab **BBM**): saat sopir kembali membawa struk SPBU, klik **Catat BBM** → pilih
kendaraan → tanggal → sopir (boleh kosong) → **Odometer** (angka km di dasbor saat mengisi) → **Liter** (boleh koma,
mis. 35,5) → **Total bayar** → centang **Tangki diisi penuh** bila penuh → **Simpan**. Odometer yang lebih kecil dari
catatan sebelumnya ditolak dan pesannya menyebut angka sebelumnya. Catatan ini tidak mengubah uang shift; bila BBM
dibayar dari laci, catat juga di Shift sebagai uang keluar.

**Catat servis** (Admin/Owner; tab **Servis**): **Catat servis** → kendaraan → tanggal → odometer → jenis servis
(mis. Ganti oli + filter) → biaya → bengkel → **Simpan**. Servis terakhir menjadi dasar servis berikutnya.

**Catatan salah**: klik ikon ⦸ di barisnya → tulis alasan → **Batalkan catatan** (Admin/Owner). Catatan tetap terlihat
bertanda *Batal* dan tidak dihitung lagi; lalu catat ulang dengan angka yang benar.

**Statistik** (Admin/Owner; tab **Statistik**): pilih tanggal **Dari** dan **sampai** (bawaan bulan ini). Per
kendaraan: jumlah rit dan surat jalan, total muatan dan rata-rata pemakaian daya angkut, rata-rata lama di jalan,
**tepat jadwal** (rit rencana yang berangkat paling lambat 30 menit dari jadwalnya), biaya BBM (liter) dan servis, km
tempuh (dari odometer catatan BBM/servis dalam periode), perkiraan km per liter, dan biaya per km. Per sopir: rit,
surat jalan, lama di jalan, tepat jadwal, dan surat jalan yang barangnya kembali/ditolak/rusak.

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
  4. Uang dikembalikan lewat transfer: pilih **rekening toko** asal uangnya dari daftar (tombol Transfer tidak
     aktif bila toko belum mendaftarkan rekening); rekening pembeli dan nomor referensi boleh diisi sebagai
     catatan, tidak wajib.
  5. **Ajukan & minta persetujuan**.
- **Persetujuan retur/void**: setelah diajukan muncul dialog *Persetujuan*. Tekan **Kirim kode ke atasan**:
  Admin/Owner menerima pesan Telegram/email berisi rincian permintaan dan **kode 6 angka**. Hubungi atasan; bila
  setuju ia menyebutkan kodenya → ketik → **Setujui dengan kode** (tercatat atas nama atasan; uang kembali dari
  uang shift). Kode berlaku 10 menit, sekali pakai. Belum bisa menghubungi atasan: **Nanti saja, tunggu
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

**Kembalian tidak diambil pembeli**: di layar bayar centang **Kembalian tidak diambil** (tombol **K**). Uangnya
tercatat masuk uang shift, bukan penjualan, jadi hitungan tetap cocok.

**Tutup shift** (*Shift & Clerical Check*, kotak **Tutup shift**):
1. **Order belum selesai** tampil di atas: pilih per order **Ke antrean**, **Simpan nanti**, **Ke draf**, atau
   **Batalkan**. Yang tidak diubah tetap di antrean.
   Kotak **Sebelum menutup** (bila ada) berisi:
   - **merah** — wajib diselesaikan dulu: *Pengajuan void belum diputuskan* (void hanya bisa disetujui selama
     shift transaksinya masih buka). Klik **Buka**, setujui/tolak/batalkan, lalu kembali ke sini;
   - **kuning** — tidak menghalangi, tetapi wajib dibaca: pembayaran di luar shift (sebelum shift ini dibuka, masuk
     catatan shift ini), non-tunai yang belum dicek masuk rekening, retur menunggu persetujuan, uang retur yang
     menunggu diserahkan tunai, dan barang bayar-saat-terima yang uangnya masih dibawa sopir. Centang
     **Sudah saya periksa**; tombol *Kirim hitungan* baru aktif setelah itu.
2. **Hitung dan kirim** semua uang shift. Angka sistem belum tampil (hitungan jujur). Setelah dikirim, shift
   berhenti menerima uang.
3. **Lihat hasil**: selisih (hijau cocok, abu-abu receh, merah kurang, kuning lebih), *Tinjauan shift*, dan
   *Bantuan mencari selisih* (mis. "sama dengan kembalian STR-…"). Selisih besar: **Hitung ulang (sekali)**.
   Masih berselisih: isi **Keterangan selisih**.
4. Isi **Uang ditinggal** (untuk besok; sisanya disetor) → **Tutup shift** → **Ya, tutup shift**.

- Bila toko mengatur jam tutup: 15 menit sebelumnya muncul pengingat biru di atas halaman; setelah lewat,
  peringatan kuning. Anda **masih bisa menjual** (pembeli yang datang terlambat tetap dilayani), tetapi tutuplah
  shift begitu pembeli terakhir selesai. Atasan ikut diberi tahu.
- Sistem **tidak pernah menutup shift sendiri**, karena menutup shift berarti menghitung uang shift. Shift
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
- **Promo / kampanye** (*Pengaturan › Promo*): klik **Buat promo**. Form terdiri dari lima bagian:
  1. **Waktu berlaku**: **Mulai** dan **Selesai** (tanggal dan jam-menit). Opsional: **Hanya hari** (klik Sen…Min;
     tidak ada yang dipilih = setiap hari) dan **Jam harian** mulai–sampai (mis. 13:00–15:00 untuk happy hour).
  2. **Barang**: **Semua barang**, atau **Per barang / Per kategori / Per merk (pilih beberapa)**: tambahkan satu
     per satu (barang lewat kotak cari, kategori/merk lewat daftar), hapus dengan ×. Minimal qty per baris (opsional).
     **Kombinasi kategori + merk + barang**: klik **Tambah kelompok**, lalu isi kategori, merk, dan/atau barang
     (kosong = semua). Di dalam satu kelompok semuanya harus cocok: kategori *Cat* + merk *Avian* = hanya cat merk
     Avian. Barang kena promo bila cocok dengan salah satu kelompok (tulisan ATAU di antara kelompok). Kotak barang
     hanya menampilkan barang dari kategori/merk yang dipilih di kelompok itu.
  3. **Manfaat**: **Potongan persen** (boleh batas rupiah per baris), **Potongan rupiah per satuan**, **Harga
     khusus (harga jadi)** (isi harga yang dibayar pembeli per satuan dasar, bukan besar potongannya: harga Rp
     50.000 diisi Rp 48.000 = hemat Rp 2.000; tidak berlaku bila harga biasanya sudah lebih murah), **Beli X gratis Y**
     (barang yang sama; mis. setiap beli 10 gratis 1), atau **Beli N potong Rp X** (setiap kelipatan N dipotong
     Rp X: beli 2 potong Rp 2.000, qty 5 dipotong Rp 4.000). Untuk keduanya pilih **Berlaku per baris**:
     **Tanpa batas**, **Sekali**, atau isi **paling banyak … kali** (mis. 2: qty 9 tetap dipotong dua kali saja). Untuk beli X gratis Y, kasir mengetik **semua** qty
     yang dibawa pembeli (mis. 11), yang gratis otomatis menjadi potongan.
  4. **Syarat** (opsional): minimal total belanja, pembeli tertentu, riwayat belanja pelanggan.
  5. **Batas uang** (opsional): anggaran dan batas per pembeli (lihat di bawah).
  **Templat kampanye**: di daftar promo klik ⋯ › **Simpan sebagai templat** (isinya disalin, waktunya tidak). Klik
  **Templat kampanye** di atas daftar untuk melihat templat; ⋯ › **Pakai templat (promo baru)** membuka form promo
  yang sudah terisi — cukup ubah nama dan waktunya lalu Simpan. Templat tidak pernah berlaku sendiri.
  **Untuk pembeli**: semua pembeli, satu golongan pelanggan, atau pelanggan tertentu; bisa juga disyaratkan "pelanggan sudah belanja
  minimal Rp … dalam … hari terakhir". Potongan promo dihitung dari harga tier yang berlaku (harga dasar, atau Grosir bila total belanja
  tercapai), jadi tier dan promo bisa terpakai bersama.
  Satu promo per baris (manfaat terbesar). Promo yang sudah terpakai tidak bisa diubah aturannya (nama, keterangan,
  waktu selesai, anggaran, dan batas per pembeli tetap bisa); untuk aturan lain nonaktifkan lalu buat promo baru
  (atau simpan dulu sebagai templat).
  - Kolom **Terpakai** = jumlah rupiah potongan promo itu di semua penjualan (penjualan yang di-void
    tidak dihitung). Bila promo punya anggaran, di bawahnya tertulis "sisa Rp … dari Rp …".
  - **Anggaran promo** (opsional): jumlah seluruh potongan yang boleh diberikan. Saat sisanya lebih kecil dari
    potongan sebuah barang, barang itu dipotong sebesar sisanya; setelah habis, promo berhenti sendiri. Void
    mengembalikan anggaran; retur tidak.
  - **Potongan paling banyak per pembeli** (opsional): supaya satu pembeli tidak menghabiskan anggaran.
    Pelanggan terdata dihitung dari semua transaksinya; pembeli umum (tanpa nama) dihitung per transaksi. Bila
    anggaran diisi, angka ini harus lebih kecil dari anggaran.
  - Anggaran dan batas per pembeli boleh diubah walau promo sudah terpakai; anggaran tidak boleh di bawah yang
    sudah diberikan.
- **No. HP** di semua form: pilih kode negara (bawaan **+62**), lalu ketik nomor **tanpa 0 di depan**, mis.
  `812 3456 7890`. Bila terketik `0812…`, angka 0 dibuang otomatis dan muncul pemberitahuan. Tersimpan sebagai
  `+6281234567890` (paling banyak 15 angka).
- **Data dobel dicegah**: saat menyimpan pelanggan, pemasok, atau barang yang namanya sama dengan data lain
  (huruf besar/kecil, spasi, tanda baca, dan awalan Toko/CV/PT/Pak/Bu diabaikan) atau No. HP-nya sama, muncul kotak
  kuning **"… yang mirip sudah ada"** berisi daftarnya. Pakai data yang sudah ada (tutup form), atau bila memang
  berbeda klik **Ini … berbeda, tetap simpan**.
  **Sama persis** (kotak merah: nama dan No. HP sama; barang: nama sama) tidak bisa disimpan. Pilih salah satu:
  ubah nama/No. HP di isian Anda; **Buka & ubah data itu**; atau **Hapus data itu** / **Hapus data yang sedang
  diubah ini** → **Ya, hapus permanen** (Admin/Owner). Hapus hanya berhasil untuk data yang belum pernah dipakai
  transaksi; bila sudah dipakai, ubah nama/No. HP-nya.
- **Pemeriksaan data** (*Pengaturan › Pemeriksaan data*, Admin/Owner): daftar data lama yang kemungkinan dobel dan
  yang formatnya salah. Klik kodenya untuk membuka data itu. **Rapikan No. HP** memperbaiki sekaligus semua No. HP
  yang bisa dirapikan (0812… → +62812…); sisanya tertulis "perbaiki manual".
- **Arsip tahunan** (*Pengaturan › Arsip tahunan*, Owner): satu kartu per tahun berisi ringkasan (penjualan, void,
  retur, penerimaan, piutang yang belum lunas) dan jumlah baris transaksinya.
  1. Awal tahun, selesaikan dulu semua dokumen tahun lalu: daftar **penghalang** (kotak kuning) menyebut apa yang
     belum selesai, mis. order belum selesai/batal, shift belum ditutup, retur menunggu persetujuan, surat jalan atau
     rit belum selesai.
  2. Klik **Tutup tahun …** → baca konfirmasinya → **Tutup tahun**. Semua transaksi tahun itu (termasuk void dan
     retur) disalin ke berkas arsip, dan tahun itu dikunci: tidak bisa mencatat atau mengubah apa pun bertanggal
     tahun itu. Data **tidak dihapus**: semua layar dan laporan tetap menampilkannya.
  3. Klik **Periksa**: "Berkas utuh dan sama dengan database" berarti arsip aman. **Unduh berkas** menyimpan salinannya
     (mis. ke flashdisk).
  4. Perlu koreksi? **Buka kembali** → tulis alasannya → koreksi → **Tutup tahun** lagi (berkas baru dibuat, yang lama
     tetap ada).
  Retur dan pelunasan atas nota tahun lalu tetap bisa dicatat setelah tahun ditutup, karena tercatat dengan tanggal
  hari ini.
- **Tentang aplikasi** (menu nama Anda di kanan atas): versi tampilan, versi server, status struktur database, dan
  daftar perubahan versi terbaru. Bila tertulis server sudah diperbarui, tekan **Ctrl+F5**.
- **Pelanggan & pemasok** (*Data Pelanggan*, *Data Pemasok*): golongan (untuk sasaran promo; kelola lewat tombol
  **Golongan**), term pembayaran, limit. Daftar Data Pelanggan menampilkan **limit kredit dan sisanya**,
  **tagihan berjalan** (jumlah rupiah dan banyaknya nota), dan **jatuh tempo terdekat** ("5 hari lagi",
  "jatuh tempo hari ini", "terlambat 3 hari"); tombol **?** menjelaskan tiap kolom. Admin/Owner mengubah
  pelanggan langsung. Kasir/Staf butuh kode Anda untuk mengubah atau menonaktifkan pelanggan: pesan yang Anda
  terima memuat rincian perubahannya; **baca dulu, sebutkan kodenya hanya bila setuju**.
- **Rekening penerimaan** (*Pengaturan › Pembayaran*): daftarkan sekali semua tempat toko menerima uang non-tunai,
  supaya kasir tinggal memilih. Cara bayar yang belum punya rekening di sini tidak bisa dipakai di kasir.
  1. Di kartu *Rekening bank / e-wallet (transfer)*, *Mesin EDC (kartu)*, atau *QRIS*, klik **Tambah**. E-wallet
     (OVO, GoPay, DANA, ShopeePay) didaftarkan di kartu pertama.
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
- **Menutup shift** saat kasir berhalangan: *Shift & Clerical Check* → kotak **Tutup shift** (langkah sama).
  Shift lama dari aturan "satu shift per pengguna" yang masih terbuka tampil merah di atas: tutup semuanya, lalu
  buka satu shift toko.
- **Menyetujui koreksi modal**: bila kasir meminta kode *Koreksi modal*, pesan Telegram/email memuat nomor shift,
  modal lama → baru, dan alasannya. Berikan kodenya hanya bila Anda yakin angka barunya benar (mis. sudah melihat
  sendiri uang shift). Admin/Owner juga bisa mengoreksi modal langsung tanpa kode selama shift masih berjalan.
- **Penjelasan selisih** (setelah shift ditutup): buka shift yang berselisih di tab *Riwayat*, isi **Penjelasan
  selisih (Admin/Owner)**, mis. "uang Rp 50.000 terselip di bawah laci, sudah disetor", lalu **Tandai
  terjelaskan**. Angka clerical tidak berubah; penjelasan, nama, dan waktunya tercatat.
- **Toleransi dan batas hitung** (*Pengaturan › Operasional*): **Toleransi selisih kas** (rupiah; selisih sampai
  angka ini tidak wajib keterangan) dan **Batas hitung susulan** (menit; untuk shift yang dibuka dengan *hitung
  nanti*).
- **Order pembelian** (*Persediaan › Order Pembelian*, Admin/Owner): pesanan ke pemasok sebelum barang datang.
  1. **Order pembelian baru** → pilih pemasok → cari barang → isi qty dan harga beli perkiraan → **Simpan draf**.
     Cara cepat: di *Stok Persediaan › Saran pesan* tekan **Buat order pembelian** pada kelompok pemasok; draf
     terisi barang dan jumlah sarannya.
  2. Periksa draf (boleh **Ubah**), lalu **Kirim ke pemasok**: nomor PO terbit dan isinya terkunci. Kirim ke
     pemasok dengan **Cetak** atau **Salin teks** (tempel di WhatsApp).
  3. Saat pemasok menjawab: **Konfirmasi pemasok** → isi tanggal janji kirim; ubah qty/harga hanya bila pemasok
     mengubahnya.
  4. Bila pemasok minta dibayar dulu: **Uang muka** (transfer atau tunai dari laci shift). Uang muka otomatis
     menjadi pembayaran faktur saat barang datang.
  5. Barang datang: **Terima barang** → halaman penerimaan terisi sisa barang PO; sesuaikan qty/harga dengan
     faktur → **Simpan penerimaan**. Boleh berkali-kali (sebagian). Semua datang = *Selesai*.
  6. Sisa tidak jadi dikirim: **Tutup sisa** (alasan). Belum ada barang datang dan batal: **Batalkan**. Bila ada
     sisa uang muka, catat cara pemasok mengembalikannya.
  7. Barang yang sudah dipesan tampil "+ … sudah dipesan" di Saran pesan dan tidak disarankan dua kali. Setelah 3
     order dari satu pemasok, lama kirimnya dihitung dari kenyataan ("aktual"). Lonceng memberi tahu order yang
     lewat tanggal janji kirim.
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
  6. **Metode hitung** (tombol di atas kotak status, atau tekan **1**–**4** saat kursor tidak di kotak isian):
     **A Rata-rata** (bawaan, seperti di atas); **B Statistik** (stok pengaman mengikuti naik-turun penjualan
     harian, pilih tingkat layanan 90/95/98%; butuh riwayat 30 hari); **C Min–maks** (pesan sampai *stok
     maksimum* bila stok turun ke *stok minimum*; isi keduanya di *Data Barang › Ubah*); **D Tren** (ikut arah
     penjualan naik/turun; butuh riwayat 14 hari). Barang yang belum memenuhi syarat metode pilihan dihitung
     dengan A dan diberi catatan kuning di kolom Status. Pilihan metode diingat di komputer ini. Penjelasan
     kelebihan dan batasan tiap metode ada di tombol **?**.
  7. Hasil hitung disimpan sementara di server (paling lama 10 menit) dan dihitung ulang otomatis bila ada
     transaksi atau perubahan data barang/pemasok. Saat berganti ke metode yang belum dihitung, tampil
     *Menghitung metode …*.
- **Stok rusak** (tab *Stok rusak* di *Stok Persediaan*): barang rusak tidak bisa dijual. Pindahkan dari stok
  baik lewat *Penyesuaian › Stok rusak*. Lalu pilih **Retur ke pemasok** (diklaim) atau **Musnahkan** (dibuang;
  alasan wajib).
- **Retur ke pemasok** (*Persediaan › Retur ke Pemasok*): pilih pemasok, barang (dari stok baik atau rusak), alasan,
  dan penyelesaian: **Potong hutang** (pilih penerimaan tempo yang dipotong), **Ganti barang** (barang pengganti
  langsung tercatat masuk), **Uang kembali** (tunai ke uang shift atau transfer), **Pengembalian titipan**
  (barang konsinyasi). Retur tidak bisa diubah setelah disimpan. **Cetak nota retur** untuk ditandatangani pemasok.
- **Hutang pemasok** (*Persediaan › Hutang Pemasok*): pembelian tempo yang belum lunas, umurnya, dan yang lewat
  jatuh tempo (juga muncul di lonceng). **Bayar**: transfer (isi rekening tujuan milik pemasok) atau tunai dari uang shift toko;
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
- **Hasil Penjualan** (*Transaksi › Hasil Penjualan*; Kasir, Admin, Owner): pilih periode cepat (Hari ini,
  Kemarin, 7 hari, 30 hari, Bulan ini, Bulan lalu, Tahun ini) atau isi tanggal Dari/Sampai. Kartu atas: omzet,
  jumlah transaksi, rata-rata per transaksi, penjualan bersih, laba kotor (Admin/Owner), void, dengan ▲▼ dibanding
  periode sebelumnya yang sama panjang. Di bawahnya grafik omzet, barang terlaris (kelas A = penyumbang ±80%
  penjualan, jangan sampai kehabisan), per kategori, pelanggan teratas, per kasir, uang masuk per cara bayar, jam
  dan hari ramai, promo, retur dan void. Untuk dicetak/Excel pakai **Laporan lengkap / cetak**.
- **Laporan lengkap**: stok rekap, kartu stok, stok minimum, nilai persediaan (termasuk informasi barang rusak),
  riwayat harga beli (bandingkan harga antarpemasok), promo, gross profit (laba kotor), hutang usaha, umur
  piutang, konsinyasi. Di bagian atas ada tiga tombol kelompok (**Laporan Persediaan**, **Laporan Penjualan**,
  **Laporan Keuangan**); klik salah satu lalu pilih jenis laporannya. Tombol kelompok laporan yang sedang dibuka
  berwarna biru. Pratinjau di bawahnya tampil per lembar A4 seperti hasil cetak (Halaman 1, 2, 3, …); deretan
  nomor di atas lembar pertama meloncat ke halaman itu.
- **Pengaturan**: profil toko & logo, struk & printer, penomoran, aturan operasional (termasuk jadwal shift),
  pembayaran (rekening penerimaan), harga dasar (cara menghitung harga jual otomatis, dengan kalkulator contoh),
  promo, keamanan, persetujuan, cadangan. Di **Harga dasar › Dasar markup** ada tiga pilihan: rata-rata
  tertimbang, harga beli terakhir, dan **stok tertua dulu (FIFO)**. Dengan FIFO, harga jual dihitung dari harga
  beli stok paling lama yang masih ada; setelah stok lama itu habis terjual, harga jual otomatis ikut naik ke harga
  stok berikutnya (bila turun, barangnya muncul di Tinjau Harga). Laporan laba tetap memakai rata-rata.
- **Mencetak laporan, invoice, atau surat jalan** (kertas A4): di jendela cetak, periksa kotak **Printer**
  lebih dulu. Peramban mengingat printer yang terakhir dipakai, jadi bila sebelumnya mencetak ke printer struk,
  ganti ke printer A4. Ukuran dan arah kertas sudah diatur tiap dokumen. Agar tidak perlu berganti-ganti,
  nyalakan cetak struk langsung (lihat *Kasir › Struk tanpa jendela cetak*): setelah itu jendela cetak hanya
  dipakai dokumen A4.

## Owner (pemilik)

Semua tugas admin, ditambah:

- **Data Pengguna**: tambah akun karyawan (password awal wajib diganti saat login pertama), reset password,
  nonaktifkan akun karyawan yang keluar (sesinya langsung berakhir).
- **Panduan penyiapan** (Pengaturan › tombol *Panduan penyiapan*, atau kotak biru di Dashboard): kerjakan
  langkah 1–9 dari atas. Tiap langkah menjelaskan gunanya, langkah pengisiannya, dan tombol **Buka …** ke layar
  yang tepat; tanda hijau *Selesai* muncul sendiri setelah datanya ada. Untuk mencoba aplikasi dulu: tombol
  **Isi 5 contoh …** membuat data contoh; setelah selesai mencoba, **Nonaktifkan semua contoh** › **Ya**.
- **Kode pemulihan** (untuk lupa password; terutama Owner): menu kanan atas › **Akun saya** › *Kode pemulihan* →
  isi password saat ini → **Buat kode** → **Salin**, **Unduh berkas**, atau **Cetak** → simpan di tempat aman di
  luar komputer → centang *Saya sudah menyimpan* → **Selesai**. Bila lupa password: halaman masuk › **Lupa
  password?** → isi username, kode pemulihan, password baru (2 kali) → **Ganti password** → simpan kode baru yang
  tampil → **Masuk sekarang**. Karyawan tanpa kode: minta Owner/Admin reset di Data Pengguna.
- **Log aktivitas** (*Pengaturan › Log aktivitas*): siapa melakukan apa dan kapan — termasuk persetujuan,
  perubahan harga, ekspor/cetak laporan. **Ekspor Excel**: isi cari/aksi bila perlu, pilih tanggal *Dari* dan
  *s.d.* (kosong = semua), tekan **Ekspor Excel**; berkas berisi waktu, pengguna, aksi, dokumen, ringkasan, IP,
  data lama/baru.
- **Log interaksi** (*Pengaturan › Log interaksi*, untuk penelitian): centang **Catat interaksi** → pilih
  **Rincian** (*Semua elemen yang diklik* atau *Tombol, tautan, menu saja*) → **Simpan**. Sejak itu setiap pengguna
  mendapat pemberitahuan sekali saat masuk, dan halaman, klik, pintasan, dialog, pencarian, serta galat yang mereka
  alami tercatat (isi ketikan, password, dan nominal tidak). Lihat di tabel di bawahnya (saring jenis, pengguna,
  halaman, tanggal), lalu **Ekspor Excel** atau **Ekspor CSV** untuk diolah. Kolom *Lama / hasil*: lama di halaman
  atau dialog (detik) dan jumlah hasil pencarian. Hilangkan centang lalu **Simpan** untuk berhenti mencatat.
- **Mengatur cadangan pertama kali** (Owner, *Pengaturan › Cadangan* › kotak **Atur cadangan**): colokkan disk kedua
  atau flashdisk/hardisk eksternal yang selalu terpasang → tulis folder lengkap, mis. `E:\BonsaiUrip-cadangan` →
  isi sandi (atau **Buat sandi**) dua kali → **catat sandi di kertas** dan simpan di tempat aman → centang *sudah
  dicatat* → **Simpan** → **Cadangkan sekarang**. Tanpa sandi itu cadangan tidak bisa dibuka. Mengganti folder:
  **Ubah folder/sandi**. Kotak kuning di atas memberi tahu bila folder ada di disk yang sama dengan data atau bila
  program cadangan belum terpasang.
- **Cadangan** (*Pengaturan › Cadangan*): pastikan *cadangan terakhir* hari ini/kemarin dan *berhasil* (lokal &
  cloud). Lihat panduan server bagian 7 untuk mengatur, bagian 8 untuk memulihkan.
- **Dashboard**: penjualan hari ini vs kemarin, grafik 7 hari, antrean, pengiriman aktif, peringatan stok.
- Dari luar toko: buka alamat Tailscale di HP (panduan server bagian 6).

## Tips umum

- **Cari apa saja**: tekan **Ctrl+K** (atau klik kotak *Cari* di atas). Ketik nama halaman, barang, pelanggan,
  pemasok, atau nomor dokumen (boleh sebagian, mis. `261024-0`). Panah atas/bawah memilih, **Enter** membuka,
  **Esc** menutup. Hasil hanya yang boleh Anda lihat.
- **"Sudah diubah orang lain sejak Anda membukanya"**: orang lain menyimpan data yang sama lebih dulu. Tutup jendela,
  muat ulang halaman (F5), buka lagi datanya (perubahan orang itu sudah tampil), lalu ulangi perubahan Anda.
- **Jaringan putus saat menyimpan**: tekan tombol simpan/bayar lagi. Bila kiriman pertama ternyata sudah sampai,
  aplikasi mengenalinya dan tidak mencatatnya dua kali.

- **Pengingat di atas halaman** (mis. jam tutup shift): klik **Ciutkan** untuk menyembunyikannya; ia berubah menjadi
  lencana kecil berdenyut di bagian atas layar. Klik lencananya untuk menampilkan lagi. Bila keadaannya makin
  penting (mis. dari biru menjadi kuning), pengingat tampil penuh lagi.
- **Daftar tombol keyboard** di bawah layar Order, Penjualan Langsung, Pengantaran, dan Pengiriman bisa diciutkan
  dengan **Ciutkan** atau **Ctrl+/** (tekan lagi untuk membuka). Di layar pendek ia mulai dalam keadaan tertutup.
  Di Penjualan Langsung dan Pengantaran daftar ini ada di sebelah kanan tab (*Kasir*, *Riwayat*, …).
- **Pindah dan gulir panel di layar kasir**: **Alt+←** pindah ke antrean (kiri), **Alt+→** pindah ke transaksi
  (kanan). **PgUp/PgDn** menggulir panel yang sedang aktif, mis. keranjang yang panjang. Dengan mouse cukup klik
  panelnya dan gulir dengan roda tetikus.
- **Pencarian dan saringan daftar diingat** (Data Barang, Pelanggan, Pemasok, Penerimaan, Piutang, Hutang, Order
  pembelian, Konsinyasi, Retur ke pemasok, Order, Riwayat penjualan): kembali dari halaman ubah/detail, daftar tetap
  memakai kata cari, kategori, saringan, dan halaman terakhir. **Klik menu di sidebar** untuk mulai dari awal (semua
  saringan kosong lagi). Ingatan hilang bila aplikasi dimuat ulang.
- **Teks yang terpotong** (catatan, alamat): klik **lihat semua** untuk membacanya utuh, **ringkas** untuk menutup.

- Jangan berbagi akun: setiap aksi tercatat atas nama pemilik akun.
- Transaksi yang sudah tersimpan tidak diedit; koreksi lewat void, retur, atau penyesuaian agar jejaknya jelas.
- Laporan: pilih periode (hari ini … tahun ini, atau rentang), lalu **Cetak / PDF** atau **Ekspor Excel**.
