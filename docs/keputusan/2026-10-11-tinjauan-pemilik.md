# Keputusan Tinjauan Pemilik — 11 Oktober 2026

Melanjutkan penomoran dari `2026-10-10-limit-kredit-ditempat.md`. Butir **(pemilik)** diputuskan pemilik
proyek (dari masukan setelah mencoba aplikasi, sebagian lewat pilihan yang diajukan Claude Code); butir lain
keputusan teknis Claude Code.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-102 — Persetujuan atasan dengan kode sekali pakai (Telegram/email)

**Status:** menggantikan K-099 butir 1 dan 4 (password atasan diketik di layar kasir) dan K-101 (hal yang
sama untuk limit kredit). K-099 butir 2–3 dan 5–7 (batas tanpa persetujuan, cara persetujuan tersimpan, laci
refund, batalkan pengajuan) tetap berlaku. Mengubah docs/04 §6.

**Keputusan:**

1. **(pemilik) Password atasan tidak lagi diketik di komputer kasir.** Alasannya dari pemilik: atasan belum
   tentu ada di toko, dan password asli Owner/Admin yang diketik di perangkat kasir bisa terlihat atau
   diminta-minta. Sistem persetujuan tidak boleh bergantung pada kepercayaan.
2. **(pemilik) Kode sekali pakai dikirim sistem ke atasan** lewat **Telegram** (bot milik toko) dan/atau
   **email** (SMTP). WhatsApp ditawarkan dan tidak dipilih (lihat *Ditolak*). Alurnya:
   - Kasir menekan **Kirim kode ke atasan** pada retur/void yang menunggu, atau pada penjualan yang melewati
     limit kredit.
   - Sistem membuat kode 6 angka **berbeda untuk tiap Admin/Owner** yang berwenang dan punya kontak, lalu
     mengirimkannya beserta: siapa pengajunya, rincian yang diminta (nomor dokumen, barang, nilai, alasan;
     atau pelanggan, limit, piutang berjalan, tagihan baru), dan batas waktunya.
   - Atasan yang setuju menyebutkan kodenya ke kasir (telepon, pesan, langsung). Kasir mengetiknya.
   - Dokumen disetujui **atas nama pemilik kode** (`cara_persetujuan = DI_TEMPAT`, kini berarti "kode
     atasan"). Refund tunai tetap dari laci kasir yang login (K-099 butir 5).
3. **Sifat kode** (supaya tidak bisa diakali):
   - terikat pada **satu dokumen** retur/void, atau pada **satu pelanggan dan nilai tagihan baru** untuk
     limit kredit (checkout menolak bila tagihannya lebih besar dari yang dibaca atasan);
   - hanya bisa diminta dan dipakai **pengaju itu sendiri**;
   - berlaku **10 menit**, **sekali pakai**; meminta kode baru membatalkan kode lama;
   - **5 kali salah ketik** membatalkan kode; tiap salah ketik dicatat `PERSETUJUAN_GAGAL`;
   - permintaan kode dibatasi **5 per 5 menit per pengaju** (tiap permintaan mengirim pesan ke atasan);
   - yang disimpan hanya **hash** kodenya; kode tidak pernah masuk log; wewenang atasan diperiksa lagi saat
     kode dipakai (akun nonaktif atau turun peran = kode tidak berlaku).
4. **Isi pesan disusun server dari data tersimpan**, bukan dari teks kiriman peramban: retur/void diajukan
   dulu (status MENUNGGU) baru kodenya diminta, jadi atasan membaca persis dokumen yang akan disetujui.
   Karena itu tombol di form berubah menjadi **Ajukan & minta persetujuan**; dialog kode bisa ditutup
   ("Nanti saja, tunggu persetujuan") dan pengajuan tetap menunggu.
5. **Pengaturan:** tab baru **Pengaturan › Persetujuan** (token bot Telegram, akun SMTP, pesan uji, daftar
   atasan yang bisa menerima kode). Token dan sandi disimpan di `konfigurasi`, **tidak pernah dikembalikan
   API** dan tidak ditulis ke log. Tiap Admin/Owner mengatur kontaknya sendiri di **Akun saya**: email, dan
   **Hubungkan Telegram** (buka bot toko, tekan Start; kode tautan hanya diketahui pemilik akun yang login,
   sehingga chat orang lain tidak bisa ditempelkan ke akunnya).
6. **Tanpa internet atau tanpa saluran:** retur/void tetap bisa diajukan dan disetujui atasan dari akunnya
   sendiri (`AKUN_ATASAN`, juga dari luar toko lewat Tailscale) atau lewat batas tanpa persetujuan; penjualan
   yang melewati limit kredit tidak bisa dilanjutkan Kasir (terima pembayaran dulu). Admin/Owner yang sedang
   login tetap bisa melanjutkan sendiri (K-088).
7. **Skema (migrasi 0014):** `permintaan_persetujuan` (jenis, pengaju, rujukan, nilai, ringkasan, status,
   hitungan gagal, kadaluarsa, penyetuju), `kode_persetujuan` (satu baris per atasan penerima: hash kode,
   saluran terkirim), `pengguna.email`, `pengguna.telegram_chat_id`.
8. **Dependensi baru: `nodemailer` 10.0.14** (kirim email lewat SMTP; tanpa dependensi turunan). Telegram
   memakai `fetch` bawaan Node ke Bot API. Server toko tidak punya alamat publik, jadi pesan masuk bot dibaca
   dengan `getUpdates` saat pengguna menekan "Periksa", bukan webhook.
9. **Pengembangan dan tes:** di luar produksi, saluran yang belum diatur tidak menggagalkan pengiriman;
   pesannya masuk "kotak keluar uji" di memori (dan log server), terbaca lewat `GET /api/auth/pesan-uji`
   yang hanya terpasang saat `NODE_ENV=development`. Tes otomatis tidak pernah menyentuh jaringan. Akun demo
   diberi email contoh oleh seed.

*Alasan:* wewenang kini berpindah lewat sesuatu yang hanya sampai ke perangkat atasan dan hanya berlaku untuk
satu permintaan yang rinciannya ia baca. Kasir tidak pernah memegang rahasia yang bisa dipakai ulang; kode yang
bocor tidak berguna untuk dokumen lain, pengaju lain, atau setelah 10 menit.

*Ditolak:* **WhatsApp** (jalur resmi Meta butuh verifikasi bisnis dan templat pesan berbayar; gateway pihak
ketiga murah tetapi tidak resmi dan nomor pengirimnya bisa diblokir; pemilik memilih Telegram + email);
aplikasi autentikator/TOTP (bekerja tanpa internet, tetapi kodenya tidak terikat pada permintaan tertentu:
atasan tidak tahu apa yang ia setujui); tetap menyediakan password atasan sebagai cadangan (justru itu yang
ditolak pemilik); satu kode untuk semua atasan (tidak bisa mencatat siapa yang menyetujui); menyetujui dengan
membalas pesan Telegram (butuh server yang terus membaca pesan masuk; bisa menyusul bila server sudah online).

*Yang perlu dilakukan pemilik:* buat bot lewat @BotFather dan isi tokennya, dan/atau isi akun SMTP (Gmail
dengan sandi aplikasi) di Pengaturan › Persetujuan; lalu tiap Admin/Owner membuka Akun saya.

---

### K-103 — Struk langsung ke printer thermal (ESC/POS), tanpa jendela cetak

**Status:** melengkapi K-074 dan K-095 (cetak struk otomatis / tanya dulu / tidak). `buka-kasir.cmd` (Chrome
`--kiosk-printing`) tetap ada untuk printer yang hanya punya driver Windows. Menggantikan sebagian rencana
Fase 13.1 (cetak tanpa pratinjau): penyusun perintahnya dipakai ulang di aplikasi desktop.

**Keputusan:**

1. **(pemilik) Struk harus langsung tercetak** saat checkout, tanpa pratinjau dan tanpa mengatur kertas, dan
   printer yang ada (thermal Bluetooth 58 mm) harus bisa dipakai.
2. **Struk dikirim sebagai teks dan perintah ESC/POS**, bukan gambar halaman. Peramban mencetak lewat driver
   sebagai gambar, itulah yang membuat hasil di printer thermal buram dan bergantung pada ukuran kertas.
   Penyusun perintah ada di `packages/shared/src/escpos.ts` (rata tengah, tebal, huruf besar, kiri-kanan,
   bungkus teks, potong kertas, buka laci). Teks dijadikan ASCII agar tidak bergantung pada halaman kode
   printer. Lebar baris 32 karakter (kertas 57/58 mm) atau 48 (80 mm), bisa diubah per komputer.
3. **Jalur kirim: Web Serial** (`lib/printer-thermal.ts`). Printer Bluetooth yang sudah dipasangkan di
   Windows tampil sebagai port *Standard Serial over Bluetooth*; printer USB-serial juga bisa. Izin
   diberikan sekali per komputer. Hanya **Chrome/Edge**; di peramban lain (Firefox) struk tetap dicetak lewat
   jendela cetak.
4. **Pengaturan per komputer** (disimpan di peramban: preferensi perangkat, bukan data bisnis): nyala/mati
   cetak langsung, printer terpilih, karakter per baris, baud, potong kertas, buka laci uang. Ada **Uji
   cetak**. Laci hanya dibuka pada cetakan pertama penjualan yang menerima tunai.
5. **Bila printer gagal** (mati, di luar jangkauan): penjualan tetap tersimpan; kasir mendapat pemberitahuan
   dengan tombol **Jendela cetak**. Tidak ada cetak ganda otomatis.
6. **Tab baru Pengaturan › Struk & printer:** isi dan cara cetak struk (teks penutup, lebar kertas, cetak
   setelah bayar, nama/logo di kop, pratinjau) dipindah dari Profil toko supaya mudah ditemukan, bersama
   kartu printer komputer ini.
7. Logo tidak dicetak di jalur langsung (butuh gambar raster; menyusul bila diminta). Invoice, surat jalan,
   dan laporan tetap A4 lewat jendela cetak.

*Alasan:* satu-satunya cara mencetak tanpa jendela dari peramban biasa adalah berbicara langsung ke printer.
Hasilnya juga lebih tajam dan lebih cepat daripada mencetak halaman.

*Ditolak:* menunggu aplikasi desktop (pemilik memilih sekarang); agen cetak lokal terpisah (satu program
lagi untuk dipasang dan dijaga); WebUSB (printer berdriver Windows tidak bisa diambil alih peramban);
mencetak logo sebagai raster sekarang (menambah kerumitan untuk hal yang belum diminta).

*Belum diuji di perangkat sungguhan:* jalur ini diuji dengan printer tiruan. Uji dengan printer pemilik
(EPPOS EP5859, Bluetooth) dilakukan pemilik lewat tombol Uji cetak.

---

### K-104 — Halaman pengantaran, cara bayar, limit bawaan, cetakan bersih

**Keputusan:**

1. **(pemilik) Penjualan pengantaran bisa dibuat langsung di halamannya**, tanpa order dari Order Penjualan:
   pilih pelanggan, isi alamat kirim, ongkir, catatan kirim, tambah barang, buat invoice. Order dari antrean
   tetap bisa diproses seperti biasa; alamat/ongkir/catatan kirimnya kini bisa disunting saat dibayar.
2. **(pemilik) Pelanggan pengantaran wajib punya No. HP dan alamat kirim** (aturan **R10**, diperiksa API saat
   order dibuat atau diubah). Email tidak diwajibkan.
3. **(pemilik) Semua yang punya tombol pintas juga bisa diklik.** Pemilih pelanggan di kasir, pengantaran, dan
   input order cepat: nama pelanggan menjadi tombol (selain F4), daftar pelanggan tampil tanpa mengetik, tiap
   baris menampilkan No. HP dan alamat, ada tombol **Pelanggan baru** dan **Pembeli umum**.
4. **(pemilik) Cara bayar dipilih tegas** bila pembeli boleh belum lunas (pengantaran, atau penjualan langsung
   dengan pelanggan terdata): **Lunas** (L), **DP** (U), **Bayar nanti** (N), **Saat terima** (S, pengantaran).
   Sebelumnya "kotak bayar dikosongkan = piutang", yang tidak terbaca. Jatuh tempo tampil saat bukan Lunas.
   Mengetik angka pada Bayar nanti mengubahnya menjadi DP. Lunas dengan uang kurang ditolak dengan petunjuk
   memilih DP. Tombol bayar selalu terlihat di layar pendek. Nilai yang dikirim ke API tidak berubah.
5. **(pemilik) Limit kredit bawaan pelanggan baru:** form tambah pelanggan terisi limit bawaan dan punya
   centang *Jadikan limit ini bawaan untuk pelanggan baru berikutnya* (`konfigurasi.limit_kredit_default`;
   kosong = tanpa limit). Pelanggan yang dibuat tanpa mengirim limit memakai bawaan.
6. **Notifikasi tidak lagi ikut tercetak.** Bukti penerimaan, lembar penyesuaian/opname, dan kartu stok
   dicetak dari halamannya sendiri, sehingga toast yang masih tampil ikut ke kertas. Toast kini disembunyikan
   di semua cetakan, dan aturan "hanya dokumen yang tercetak" tidak lagi bergantung pada selector CSS
   `:has()` (peramban lama mencetak seluruh layar).

*Alasan:* masukan pemilik setelah mencoba penjualan pengantaran dan mencetak bukti penerimaan.

*Ditolak:* mewajibkan email pelanggan (banyak pembeli bahan bangunan tidak punya email; pemilik memilih No. HP
dan alamat); menebak cara bayar dari angka yang diketik (uang tunai yang kurang bisa berarti salah ketik atau
DP; kasir yang memutuskan).

---

### K-105 — Penyiapan terpandu: saluran kode dan printer struk; aturan menulis petunjuk

**Status:** melengkapi K-102 dan K-103 (cara menyiapkannya); tidak mengubah aturan bisnis maupun skema.

**Latar:** pemilik mencoba K-102 dan K-103 dan menemui empat hal: (a) petunjuk menyambungkan bot Telegram dan
email terlalu ringkas; (b) tombol "Kirim pesan uji ke saya" ternyata menguji email, dan melaporkan terkirim
padahal email belum diatur; (c) pemilih printer menampilkan banyak port tanpa keterangan, sehingga yang
terpilih modem laptop (EM7455); (d) struk yang dicetak lewat driver keluar menyamping, pudar, dan berantakan.
Printer toko: EPPOS RPP02, thermal 58 mm, Bluetooth SPP, Windows 11.

**Keputusan:**

1. **(pemilik) Aturan menulis petunjuk, berlaku seterusnya.** Setiap petunjuk, bantuan ("?"), dan panduan
   ditulis sampai tidak menyisakan pertanyaan: langkah bernomor berurutan; tiap langkah menyebut di mana
   mengeklik, apa yang diketik, dan **hasil yang benar**; tiap kegagalan menyebut penyebab dan langkah
   berikutnya; istilah yang belum dikenal dijelaskan di tempat. Ringkas bukan tujuan untuk teks bantuan.
2. **Penyiapan berurutan dengan tanda selesai.** Tab Persetujuan dan kartu Printer struk disusun sebagai
   langkah bernomor (komponen `Langkah`): lingkaran nomor berubah menjadi centang hijau saat langkahnya beres,
   sehingga terlihat apa yang belum dikerjakan. Hasil uji tampil menetap di layar (`KotakHasil`), bukan toast.
3. **Uji saluran dipisah dan jujur.** `POST /api/saluran/uji` menerima `{ saluran }` dan menguji **satu**
   saluran ke kontak pengguna yang login. Selalu pengiriman sungguhan (juga di mode pengembangan; hanya tes
   otomatis yang tidak menyentuh jaringan), dan jawabannya menyebut tepat apa yang kurang: token kosong, akun
   belum dihubungkan ke bot, isian akun pengirim yang kosong, alamat penerima kosong, atau pesan galat dari
   Telegram/SMTP beserta artinya.
4. **Simulasi di mode pengembangan diberi tahu.** Di luar produksi, saluran yang belum diatur tetap ditirukan
   (dibutuhkan tes e2e), tetapi dialog kasir kini menampilkan catatan bahwa kode untuk saluran itu tidak
   benar-benar dikirim (`InfoKodePersetujuan.simulasi`).
5. **Kontak penerima bisa diisi dari tab Persetujuan.** "Hubungkan Telegram saya" dan alamat email penerima
   (sebelumnya hanya di Akun saya) tampil sebagai Langkah 2 tiap saluran untuk akun yang sedang login; Akun
   saya tetap ada untuk atasan lain. Kode tautan Telegram boleh dikirim sebagai pesan biasa (tidak harus
   `/start KODE`), ada tombol salin, dan pesannya menjelaskan aturan Telegram (bot tidak boleh mengirim pesan
   ke orang yang belum menekan Start).
6. **Email:** status menyebut isian yang kosong (`email.kurang`); tiap saluran punya tombol simpan sendiri;
   spasi pada sandi aplikasi Google dibuang saat disimpan; galat SMTP diterjemahkan (ditolak login vs. tidak
   bisa dihubungi). Petunjuk membuat Sandi aplikasi Gmail ditulis langkah demi langkah.
7. **Printer:** kartu menjadi lima langkah (pasangkan di Windows, pilih port, lebar kertas, uji cetak, nyalakan).
   - Petunjuk memilih port menyebut nama yang benar dan yang salah, serta cara pasti lewat tab *Port COM*
     Windows. Perangkat USB yang dikenali sebagai modem/adaptor (`BUKAN_PRINTER`, menurut USB vendor id)
     ditolak dengan peringatan.
   - Memilih printer lagi **mencabut izin port lama** (`SerialPort.forget()`): port COM tidak punya ciri
     pembeda, jadi tanpa ini pilihan yang salah bisa terpakai lagi setelah halaman dimuat ulang.
   - Setelah uji cetak terkirim, aplikasi **menanyakan apa yang keluar** (tercetak / tidak keluar / huruf acak
     / baris turun / pudar) dan memberi saran sesuai jawabannya. Peramban tidak bisa mengetahui apakah kertas
     benar-benar keluar, jadi kepastian hanya bisa datang dari pengguna.
   - Lebar kertas dipilih tegas per komputer (58 mm = 32 karakter) alih-alih "Otomatis".
   - Batas tunggu membuka port 15 detik (sambungan Bluetooth dibuat saat port dibuka) dan jeda sebelum port
     ditutup agar ekor struk tidak terpotong.
8. **Hasil cetak:** struk ESC/POS selalu potret (`ESC V 0`), memakai font A bawaan printer (`ESC M 0`), dan
   bisa dicetak lebih tebal (`ESC G 1`, double-strike; pilihan "Cetak lebih tebal", bawaan nyala). Struk lewat
   jendela cetak peramban (cadangan): seluruh huruf tebal, dan tinggi halaman tidak pernah lebih kecil dari
   lebarnya supaya driver tidak menganggapnya lanskap.
9. **Panduan dan alat uji mandiri:** `docs/panduan/kode-persetujuan-telegram-email.md` (termasuk penjelasan
   teknis penautan akun lewat `getUpdates` dan uji dengan curl) dan `docs/panduan/printer-struk.md`;
   `scripts/uji/uji-telegram.py` dan `scripts/uji/uji-gmail.py` menguji token bot dan sandi aplikasi tanpa
   aplikasi (rahasia diketik saat dijalankan, tidak disimpan).

*Alasan:* penyiapan ini dikerjakan sekali oleh orang yang bukan teknisi, tanpa pendamping. Petunjuk yang
ringkas memindahkan pekerjaan ke pemilik (menebak, lalu bertanya lagi). Uji yang melaporkan "terkirim" padahal
tidak, lebih buruk daripada tidak ada uji.

*Ditolak:*
- **Menyaring pemilih port hanya ke perangkat Bluetooth** (`filters: [{ bluetoothServiceClassId }]`). Pada
  Windows, printer SPP yang dipasangkan tampil sebagai port COM biasa tanpa tanda Bluetooth, sehingga saringan
  itu bisa menyembunyikan printernya dan menampilkan daftar kosong.
- **Menampilkan nama/nomor COM port yang terpilih.** Web Serial tidak memberikannya kepada halaman; yang ada
  hanya USB vendor/product id. Di aplikasi desktop (Fase 13.1) printer bisa dipilih menurut namanya.
- **Mencoba semua port satu per satu secara otomatis.** Mengirim data ke perangkat yang bukan printer (modem)
  tanpa sepengetahuan pengguna, dan tetap butuh pengguna untuk memastikan kertas keluar.
- **Mematikan simulasi di mode pengembangan.** Tes e2e persetujuan bergantung padanya; cukup diberi tanda.
- **Cetak senyap lewat driver Windows dari peramban biasa.** Peramban selalu menampilkan jendela cetak; jalur
  tanpa jendela hanya ESC/POS langsung (K-103) atau `--kiosk-printing` (K-074), atau aplikasi desktop Fase 13.

