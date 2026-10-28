# Daftar Uji Pemilik

Daftar hal yang perlu dicoba pemilik proyek di aplikasi, beserta hasilnya. Claude Code menambah baris baru setiap
kali fitur selesai dan memperbarui status dari hasil yang Anda laporkan. Laporan berikutnya cukup merujuk nomor di
sini, tidak menulis ulang langkahnya.

**Sebelum menguji:** matikan `pnpm dev` (`Ctrl+C`), jalankan lagi `pnpm dev`, lalu tekan `Ctrl+F5` di peramban.

**Cara melapor:** sebut nomornya, misalnya "U12 OK, U14 galat: …". Bila ada masalah, tulis apa yang Anda lakukan
dan apa yang tampil (tangkapan layar membantu).

Status: **Belum** = belum dicoba · **OK** = sesuai · **Masalah** = tidak sesuai (lihat catatan) · **Sebagian** =
sebagian sudah dicoba · **Diganti** = fitur diganti, lihat uji pengganti di catatan.

---

## Belum dicoba / perlu dicoba ulang

### Perbaikan hasil uji 23 Oktober (24 Oktober, K-152–K-159)

**Sebelum menguji:** `pnpm db:migrate` (migrasi 0024). Bila migrasi berhenti dengan pesan "Masih ada lebih dari satu
shift terbuka", tutup dulu shift-shift itu di halaman Shift, lalu ulangi.

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U60 | Halaman Shift tidak menimpa | Buka shift → halaman *Shift & Clerical Check*, coba juga dengan zoom peramban 125% dan 150% (`Ctrl` `+`) | Form kas (Jenis, Nominal / Keterangan + Catat) tidak masuk ke kotak *Tutup shift*; hitung pecahan jadi satu kolom bila sempit | Belum | Pengganti masalah foto 1 |
| U61 | Catatan panjang | *Cek uang non-tunai*: tandai *Tidak masuk* dengan catatan panjang | Catatan tampil satu baris + **lihat semua**; diklik terbuka penuh, **ringkas** menutupnya | Belum | Sama di Data Pelanggan, Data Pemasok, Promo |
| U62 | Tombol bayar campuran | Di kasir: lihat tombol **C** dan **D**; bayar campuran 2 bagian | C, D, *Hapus*, *Hapus semua* tampil sebagai tombol berbingkai | Belum | Masukan U14 |
| U63 | Rekening wajib dipilih | Nonaktifkan semua rekening EDC di *Pengaturan › Pembayaran* → di kasir tekan `E` | Tombol EDC putus-putus; pesan "belum bisa dipakai: rekening penerimaannya belum didaftarkan"; tidak ada kotak ketik rekening | Belum | Masukan U12 |
| U64 | No. referensi wajib | Di kasir pilih Transfer, kosongkan No. referensi → Enter | Ditolak "No. referensi wajib, 4–40 huruf/angka"; kursor ke kotak referensi | Belum | |
| U65 | Satu shift toko mutlak | Shift terbuka → login lain → **Buka shift** | Ditolak "Shift toko SHF-… sudah dibuka …"; tab *Riwayat* tidak punya tombol tutup (ada **Ke tab Shift toko**) | Belum | Pengganti U10 |
| U66 | Pengingat diciutkan | Atur jam tutup shift 10 menit dari sekarang → pita biru muncul → **Ciutkan** | Pita hilang, lencana berdenyut di topbar; klik lencana = pita kembali. Saat jadi kuning (lewat jam) pita tampil lagi | Belum | Masukan U9 |
| U67 | Order pas layar | *Order Penjualan* dengan zoom 125%: isi 3 barang | Tombol **Kirim ke antrean (F8)** terlihat, tidak tertutup; bilah pintasan bisa diciutkan (klik **Ciutkan** atau `Ctrl+/`) | Belum | Sama di Langsung dan Pengantaran |
| U68 | Dialog shift tidak muncul sendiri | Tanpa shift terbuka, buka *Penjualan Langsung* | Tidak ada dialog; pita kuning "Shift toko belum dibuka" dengan tombol **Buka shift** | Belum | K-130 |
| U69 | Harga dasar | *Pengaturan › Harga dasar*: tombol "?" dan kalkulator | Penjelasan Average, harga beli terakhir, LIFO, FIFO; kalkulator berubah saat angka diubah, baris metode toko disorot | Belum | |
| U70 | Cadangan | *Pengaturan › Cadangan*: **Salin alamat folder**, tombol "?" di kotak Lokasi | Alamat tersalin (tempel di File Explorer komputer server); penjelasan server toko vs cloud | Belum | |
| U71 | Cari universal | Tekan `Ctrl+K` di halaman mana pun → ketik `semen` → panah bawah → Enter | Daftar halaman/barang/pelanggan; Enter membuka barang itu (Admin) | Belum | Coba juga nomor dokumen, mis. sebagian nomor invoice |
| U72 | Dua admin mengubah data sama | Dua jendela (Admin dan Owner) membuka **Ubah** pemasok yang sama → Admin simpan → Owner simpan | Owner mendapat "sudah diubah orang lain…"; data Admin tidak tertimpa | Belum | |
| U73 | Kiriman tidak ganda | Di kasir, cabut kabel/Wi-Fi tepat setelah menekan Bayar, sambungkan lagi, tekan Bayar lagi | Hanya satu penjualan tercatat (cek Riwayat) | Belum | Opsional, sulit dipraktikkan |
| U74 | Data muatan barang | *Data Barang › Ubah* semen → kartu *Data muatan*: pilih **g**, isi 50000; pilih **mm**, isi 700 × 450 × 120 → Simpan | Tersimpan sebagai 50 kg dan 70 × 45 × 12 cm (buka lagi: angka tampil dalam kg/cm) | Belum | Coba juga *Barang curah* untuk pasir |
| U77 | Barang belum lengkap & pengaturan muatan | *Data Barang*: nyalakan **Data muatan belum lengkap**; *Pengaturan › Operasional*: ubah faktor isi/julur | Daftar hanya barang tanpa berat/ukuran; pengaturan tersimpan dan dipakai saat Berangkat | Belum | |
| U75 | Data kendaraan | *Kendaraan & Sopir* → ubah kendaraan: isi daya angkut, ukuran bak, STNK/KIR | Kolom *Daya angkut · bak* terisi | Belum | |
| U108 | Cari atribut sebagian | Kasir: ketik `pipa 1` (atau nama barang + sebagian angka ukurannya) | Barang dengan atribut 10 / 12,5 ikut ditemukan; yang cocok lewat nama tetap paling atas | Belum | |
| U109 | Label keterjualan & stok | Kasir: cari barang yang sering terjual dan yang tidak pernah terjual | Label *Laris* / *Tidak laku* / *Baru* di samping nama; angka stok tebal merah; arahkan kursor ke label = jumlah terjual | Belum | Diperbarui tiap 10 menit |
| U110 | Panel rincian | Sorot barang di hasil cari | Panel menampilkan label, terjual 30 hari, rata-rata/hari, terakhir terjual; tombol × dan Esc menutup | Belum | |
| U111 | Kepekatan struk | *Pengaturan › Struk & printer › Printer struk komputer ini › Pengaturan lanjutan*: Kepekatan **Paling tebal** → **Uji cetak** | Cetakan lebih hitam; tertulis "Kepekatan: Paling tebal". Tutup peramban, buka lagi: pilihan masih tersimpan | Belum | Printer lain boleh mengabaikan Paling tebal |
| U112 | Logo di struk | Unggah logo (Profil toko) → kartu Struk penjualan: nyalakan **Kop struk memakai logo toko** → Simpan → lihat *Logo di struk* → Uji cetak | Pratinjau hitam-putih tampil; logo keluar di atas uji cetak dan struk penjualan | Belum | Logo gelap berlatar putih paling jelas |
| U113 | Kertas & cetak otomatis invoice/surat jalan | Kartu **Invoice, surat jalan & kertas**: invoice *Tanya dulu*, surat jalan *Langsung cetak*, kertas A4 lanskap → Simpan; buat invoice pengantaran lalu **S** | Setelah invoice: pemberitahuan "Cetak invoice … sekarang?" dengan tombol Cetak; surat jalan langsung ke jendela cetak dengan kertas A4 lanskap | Belum | Tanpa jendela: ikuti langkah di kartu itu (mode kasir) |
| U114 | Metode saran pesan | *Stok Persediaan › Saran pesan*: klik **B · Statistik**, **C · Min–maks**, **D · Tren** (atau tekan 2, 3, 4); tombol **?** | Saat pertama berganti tampil "Menghitung metode …"; barang yang belum memenuhi syarat diberi catatan kuning ("dihitung dengan A"); penjelasan tiap metode di ? | Belum | Muat ulang halaman: metode terakhir tetap terpilih |
| U115 | Stok maksimum (metode C) | *Data Barang › Ubah* semen: stok minimum 50, **Stok maksimum** 200 → Simpan; Saran pesan metode C | Baris semen: titik pesan 50, "maks. 200"; bila tersedia ≤ 50 → Pesan sekarang dengan saran 200 − tersedia. Maksimum lebih kecil dari minimum ditolak | Belum | |
| U116 | Ekspor log | Login **Owner** → *Pengaturan › Log aktivitas*: pilih tanggal Dari/s.d. → **Ekspor Excel** | Berkas `log-aktivitas-….xlsx` terunduh berisi log rentang itu; log baru "Ekspor Excel log aktivitas (N baris)" tercatat | Belum | |
| U117 | Hasil Penjualan | *Transaksi › Hasil Penjualan* (Owner): coba **Hari ini**, **7 hari**, **Bulan lalu**, lalu isi tanggal sendiri; tombol **?** di Barang terlaris | Kartu omzet/transaksi/rata-rata/bersih/laba/void dengan ▲▼ dibanding periode lalu; grafik per hari; barang terlaris berkelas A/B/C; per kategori, pelanggan, kasir, cara bayar, jam, hari, promo, retur & void. Angka omzet sama dengan Laporan Penjualan per Periode periode yang sama | Belum | Login Kasir: tanpa laba; Staf: menu tidak ada |
| U118 | Order pembelian: buat, kirim, konfirmasi | *Persediaan › Order Pembelian* → **Order pembelian baru** (pemasok, 2 barang) → Simpan draf → **Kirim ke pemasok** → **Salin teks** dan **Cetak** → **Konfirmasi pemasok** (tanggal janji, ubah qty satu barang) | Nomor PO-… terbit setelah dikirim; draf tidak bisa diubah lagi; rincian menulis "pesan awal …" untuk qty yang diubah; teks tersalin bisa ditempel di WhatsApp | Belum | |
| U119 | Terima barang dari PO + uang muka | Pada PO tadi: **Uang muka** Rp 100.000 transfer → **Terima barang** → simpan penerimaan tempo sebagian (kurangi qty satu barang) → lalu terima sisanya | Form penerimaan terisi sisa barang; hutang penerimaan pertama sudah dibayar Rp 100.000; PO *Diterima sebagian* lalu *Selesai*; detail penerimaan menautkan nomor PO | Belum | |
| U120 | Saran pesan & PO | *Saran pesan* → **Buat order pembelian** di satu pemasok → kirim → kembali ke Saran pesan | Draf berisi barang + jumlah saran; setelah dikirim barangnya menulis "+ … sudah dipesan" dan sarannya turun | Belum | Tutup/Batal: coba juga **Batalkan** PO lain yang punya uang muka (wajib pilih cara pengembalian) |
| U121 | Perbaikan kecil sebelum deploy | (a) Persempit jendela: lencana shift di topbar tidak meluap; (b) tambah barang di order: tanda putar kecil di samping Total, bukan tulisan; (c) buka invoice dari *Pengiriman* lalu ←: kembali ke Pengiriman; (d) *Simpan untuk diambil nanti* order pelanggan terdaftar: No. HP terisi; (e) dialog batal order/PO/rit/surat jalan: klik saran alasan; (f) *Kendaraan & Sopir*: tanpa tab BBM/Servis/Statistik; (g) *Penerimaan Barang*: daftar order pembelian menunggu dengan tombol Terima; (h) shift terbuka lalu tutup tab peramban: muncul peringatan | Semua sesuai | Belum | K-171–K-186 |
| U122 | Surat jalan 2 rangkap | Cetak surat jalan (detail penjualan pengantaran atau tombol S) | Pratinjau cetak 2 halaman: bawahnya "ASLI - Arsip Toko (Kembali bersama Sopir)" dan "SALINAN - Arsip Customer / Penerima"; matikan *Cetak surat jalan 2 rangkap* di Pengaturan → 1 halaman | Belum | K-187 |
| U123 | Setup BonsaiUrip v2 | Hapus dulu BonsaiUrip lama (Setelan › Aplikasi › BonsaiUrip › Hapus, bila ada). Klik dua kali `Setup-BonsaiUrip.exe` (54 MB) → Next → Install → Finish | Tanpa jendela izin Administrator dan tanpa terminal; jendela "Menyiapkan BonsaiUrip..." lalu jendela akun pertama berisi password Owner (tersalin otomatis); peramban terbuka ke `localhost:7878`; masuk `owner` + password → diminta ganti password | Belum | Bila gagal: foto jendela galat; catatan di `%LOCALAPPDATA%\BonsaiUrip\log` |
| U124 | Surat jalan hanya di dalam rit | Buka detail invoice pengantaran → **Kirim dengan rit…** → **Rit baru** (Alt+N): pilih kendaraan & sopir → Enter → ubah qty jadi sebagian → **Enter** | Dialog meminta rit dulu (tanpa rit: "Pilih rit (kendaraan dan sopir)"); surat jalan tampil dengan nama sopir dan plat; sisa barang tetap di Backlog Pengiriman | Belum | K-174 |
| U125 | Kasir tombol S | Kasir pengantaran: buat invoice → tekan **S** → pilih rit → **Enter** | Dialog "Kirim … dengan rit" berisi semua barang; setelah Enter muncul "Surat jalan SJ-… masuk rit TRP-…", layar kembali ke antrean, tidak ada cetak | Belum | K-174 |
| U126 | Keluarkan dan batal rit | *Pengiriman*: kartu surat jalan di grup rit → **⋮ › Keluarkan ke Backlog** (atau seret ke kolom Backlog); lalu masukkan lagi dan **Batal rit** | Surat jalan hilang dari grup, order kembali di Backlog (surat jalan batal tercatat di log); batal rit juga mengembalikan order ke Backlog | Belum | Tidak ada lagi kotak *Belum direncanakan* |
| U127 | Cetak semua saat berangkat | Rit berisi 2 order → **Berangkat** → pilih **1 Cetak** (atau tekan 1) → **Enter**; ulangi rit lain dengan **2 Simpan PDF** | Satu jendela cetak berisi semua surat jalan rit (tiap surat jalan halaman baru, 2 rangkap bila aktif); pilihan PDF: nama berkas "Surat jalan TRP-…", pilih tujuan *Simpan sebagai PDF* | Belum | Cetak ulang: tombol **Cetak** di grup rit atau ikon printer di kartu *Di jalan* |
| U128 | Seret dengan keyboard | *Pengiriman*: Tab sampai pegangan ⋮⋮ kartu Backlog → **Spasi** → **panah kanan** (lalu atas/bawah sampai grup rit yang diinginkan berbingkai biru) → **Spasi** | Kartu masuk rit itu (surat jalan dibuat); Esc sebelum Spasi kedua = tidak terjadi apa-apa; dari grup rit, panah kiri ke Backlog lalu Spasi = surat jalan batal, order kembali | Belum | K-177 |
| U129 | Log interaksi: nyalakan | Login **Owner** → *Pengaturan › Log interaksi* → centang **Catat interaksi** → pilih rincian → **Simpan** | Status *menyala*; Log aktivitas mencatat "Log interaksi penelitian dinyalakan" | Belum | K-190; bawaan mati |
| U130 | Pemakaian tercatat | Jendela lain: login **Kasir** → klik beberapa menu, tekan **R** di Pengiriman lalu Esc, cari dengan Ctrl+K, ketik sesuatu di kotak isian | Muncul pemberitahuan "dicatat untuk penelitian" sekali; dalam ± 15 detik baris Halaman/Klik/Pintasan/Dialog/Cari muncul di tab Owner; isi ketikan tidak ada di mana pun | Belum | K-190 |
| U131 | Saring & ekspor | Tab Log interaksi: saring Pengguna = kasir, Jenis = Cari, tanggal hari ini → **Ekspor Excel** dan **Ekspor CSV** | Tabel tersaring; berkas `log-interaksi-….xlsx` / `.csv` berisi kolom Waktu, ID pengguna, Pengguna, Peran, Sesi, Jenis, Halaman, Elemen, Keterangan, Angka | Belum | Matikan lagi setelah uji bila belum turun lapangan |
| U132 | Lupa password dengan kode | *Akun saya* › **Kode pemulihan**: isi password saat ini → **Buat kode** → Salin/Unduh/Cetak → centang → Selesai. Keluar → **Lupa password?** → username + kode (boleh huruf kecil) + password baru | Password berganti, kode baru tampil untuk disimpan; masuk dengan password baru berhasil; kode lama tidak bisa dipakai lagi | Belum | K-191 |
| U133 | Kode salah / tanpa kode | **Lupa password?** dengan kode ngawur | "Username atau kode pemulihan salah."; petunjuk minta reset Owner/Admin tampil di atas form | Belum | K-191 |
| U134 | Akun pertama | Hanya pada pemasangan baru (Setup berikutnya, atau database kosong): buka aplikasi | Halaman **Buat akun pertama** (bukan jendela password); isi nama, username, password → akun Owner jadi, langsung masuk, lalu layar kode pemulihan | Belum | K-191; diuji pengembang di database kosong |
| U135 | Panduan penyiapan | Login Owner/Admin → Dashboard: kotak biru *Penyiapan toko belum selesai* → **Lanjutkan penyiapan** (atau Pengaturan › **Panduan penyiapan**) | 9 langkah dengan status Selesai/Belum dan jumlah data; tiap langkah berisi petunjuk dan tombol Buka; centang profil tersimpan | Belum | K-168 |
| U136 | Contoh data | Di Panduan penyiapan: **Isi 5 contoh pelanggan** (dan barang/pemasok/kendaraan) → lihat Data Pelanggan → kembali → **Nonaktifkan semua contoh** → **Ya** | Contoh muncul bertanda "Data contoh", tidak dihitung sebagai data asli; setelah dinonaktifkan hilang dari daftar aktif | Belum | K-168 |
| U137 | Hasil dengan alasan | Rit berangkat → *Catat hasil*: isi **Kembali utuh** 1 → pilih alasan **Kelebihan pesanan**; barang lain **Rusak** 1 → alasan **Rusak di jalan** → **Tagihan dikurangi** → Simpan | Tanpa alasan ditolak ("Pilih alasan…"); setelah disimpan sisa tagihan berkurang kedua barang; ringkasan hasil menyebut alasannya; tidak ada lagi kolom *Ditolak* | Belum | K-176 |
| U138 | Refund transfer | Invoice pengantaran sudah lunas → hasil kembali (kelebihan) → cara uang dikembalikan **Transfer** tanpa rekening → Simpan; lalu *Retur Penjualan › Refund transfer* → **Sudah ditransfer** → isi rekening + nomor referensi | Lonceng *Refund menunggu transfer*; tanpa nomor referensi ditolak; setelah dikonfirmasi pindah ke *Sudah ditransfer* lengkap dengan bukti dan petugasnya | Belum | K-176 |
| U139 | Penanda kartu | Papan Pengiriman, kolom *Di jalan* dan *Selesai hari ini* setelah hasil dicatat | Tiap surat jalan bertanda *Terkirim semua* / *Ada yang kembali* / *Ada yang rusak* | Belum | K-176 |
| U140 | Kartu Pengiriman | *Pengiriman*: lihat kartu Backlog; klik (i); bagi satu order (Kirim sebagian) lalu lihat sisanya; klik saringan *Hari ini* / *Lebih lama* | #nomor antrean tebal sama di sisa dan surat jalannya; info cepat berisi telepon/alamat/catatan/barang; sisa order bergaris kuning *Sisa dibagi*; saringan menyaring Backlog | Belum | K-173 |
| U141 | Saran alasan | Buka dialog: tolak retur/void, batalkan pengajuan, ajukan void, buka kembali arsip, kecualikan barang opname, koreksi modal shift, batalkan surat jalan (detail invoice) | Di bawah kotak alasan ada tombol-tombol saran; klik mengisi kotak (masih bisa diubah); batal surat jalan kini dialog, bukan kotak putih peramban | Belum | K-180 |
| U142 | Info cepat nomor | Klik (i) di samping nomor: linimasa kas (Shift), Aktivitas terkini (Dashboard), Riwayat penjualan, Retur, kartu Pengiriman | Pop-up ringkas: jenis, pembeli, status, total/sisa, barang; *Buka halaman lengkap*; Esc menutup; login Staf membuka invoice → "tidak berizin" | Belum | K-181 |
| U143 | Atribut ↔ data muatan | Data Barang › Ubah: isi Data muatan (berat, P×L×T) lalu Simpan; buka lagi. Barang lain: isi atribut Panjang/Lebar/Tinggi (mis. dalam mm) + Berat (g) saja lalu Simpan. Lalu ubah Berat atribut jadi angka lain → Simpan | Atribut terisi dari data muatan; data muatan terisi dari atribut (dalam cm/kg); angka berbeda ditolak dengan pesan menyebut keduanya | Belum | K-169 |
| U144 | Barang tanpa data muatan | Buat order pengantaran berisi barang tanpa berat/ukuran | Lonceng (Admin/Owner) *Barang kirim tanpa data muatan* → klik membuka Data Barang tersaring; kartu Backlog berlencana merah; Data Barang berlencana *Tanpa data muatan* | Belum | K-170 |
| U145 | Pemeriksaan data diperluas | *Pengaturan › Pemeriksaan data* | Kelompok *alamat sama*; kartu *Belum lengkap* berisi barang tanpa harga jual/data muatan, kategori/satuan nonaktif, pelanggan tanpa alamat, pemasok tanpa No. HP; klik nama membuka datanya | Belum | K-183 |
| U102 | No. HP format baru | Tambah pelanggan: ketik `0812 3456 7890` di kotak nomor | 0 dibuang dengan pemberitahuan, tersimpan `+6281234567890`; nomor 16 angka ditolak | Belum | Kode negara bisa diganti |
| U103 | Cegah pelanggan dobel | Tambah pelanggan "Toko Sumber Jaya"; lalu tambah "sumber jaya" (No. HP lain); lalu "Pak Andi" dengan No. HP sama | Dua yang terakhir: kotak kuning "Pelanggan yang mirip sudah ada"; klik **tetap simpan** baru tersimpan | Belum | Sama untuk pemasok dan barang (nama) |
| U104 | Pemeriksaan data | *Pengaturan › Pemeriksaan data* → **Rapikan No. HP** | Daftar kemungkinan dobel dan format salah; setelah dirapikan, No. HP lama jadi +62… | Belum | |
| U105 | Daftar order & penginput | *Order Penjualan* → **F10** (atau tombol Daftar order) → **Esc** kembali | Tanpa tab Input cepat; daftar bawaan **Semua**; kartu menulis "oleh <nama>"; order disimpan yang waktunya diambil tersemat di atas (bisa disembunyikan hari ini) | Belum | |
| U106 | Notifikasi rinci & dashboard | Klik lonceng; buka Dashboard | Tiap notifikasi menampilkan sampai 3 rincian (nomor, nama, nilai); dashboard punya bagian **Perlu perhatian** | Belum | |
| U107 | Label F9 kasir | Di kasir buka order dari antrean | Tombol tertulis *Tunda / kembalikan order (F9)*; tiket antrean menulis "oleh <nama>" | Belum | |
| U98 | Arsip tahunan: penghalang | Login Owner → *Pengaturan › Arsip tahunan* | Kartu 2026 "Belum ditutup", tombol Tutup mati, daftar kuning menyebut "Tahun berjalan belum selesai" dan dokumen yang belum selesai | Belum | |
| U99 | Tutup, periksa, unduh | (Butuh data tahun lalu) kartu tahun lalu → **Tutup tahun** → **Periksa** → **Unduh berkas** | "Ditutup"; "Berkas utuh dan sama dengan database"; berkas `arsip-<tahun>-….json.gz` terunduh | Belum | Bila belum ada data tahun lalu, cukup baca penjelasan "?" |
| U100 | Tahun terkunci & buka kembali | Setelah U99: *Kendaraan & Sopir › BBM* → catat BBM bertanggal tahun lalu; lalu **Buka kembali** (alasan) dan ulangi | Pertama ditolak "Tahun … sudah ditutup"; setelah dibuka berhasil; kartu "Dibuka kembali" | Belum | Tutup lagi sesudahnya |
| U101 | Tentang aplikasi & versi | Menu nama Anda (kanan atas) › **Tentang aplikasi** | Versi tampilan = versi server, struktur database N/N, daftar perubahan versi 1.14.0 | Belum | Setelah pembaruan server: tekan Ctrl+F5 bila versi berbeda |
| U93 | Promo per barang (beberapa) | *Pengaturan › Promo* → **Buat promo** → Berlaku untuk **Per barang (pilih beberapa)** → tambah 2 barang → 10% → Simpan; jual keduanya di kasir | Kedua baris mendapat "Promo …"; kolom *Berlaku untuk* menyebut kedua barang | Belum | |
| U94 | Beli X gratis Y | Promo baru: barang semen, **Beli X gratis Y** 10 dan 1 → kasir: semen qty 11, lalu 22 | Qty 11: potongan = harga 1 sak; qty 22: 2 sak; qty 10: tidak ada potongan | Belum | |
| U95 | Harga khusus | Promo baru: Per merk (pilih merk semen), **Harga khusus** di bawah harga Normal → kasir: 3 sak | Potongan = (harga Normal − harga khusus) × 3 | Belum | Harga khusus di atas harga Normal: promo tidak berlaku |
| U96 | Hari & jam berlaku | Promo baru: **Hanya hari** = hari ini, **Jam harian** = jam sekarang s.d. 1 jam lagi → coba di kasir; ubah jam harian ke nanti malam → coba lagi | Pertama berlaku; kedua tidak | Belum | Jam selesai sebelum jam mulai ditolak |
| U97 | Templat kampanye | ⋯ pada promo → **Simpan sebagai templat** → Simpan; klik **Templat kampanye** → ⋯ → **Pakai templat (promo baru)** → ubah nama → Simpan | Templat tampil di daftar Templat (tidak berlaku di kasir); promo baru terisi sama persis kecuali waktu | Belum | |
| U88 | Jadwal servis & KIR | *Logistik › Kendaraan & Sopir* → ubah kendaraan: **Tiap … km** 5000, **KIR berlaku sampai** = kemarin → Simpan | Kolom *Odometer · servis · surat*: "Belum ada catatan servis" dan lencana merah *KIR habis*; lonceng notifikasi: "STNK/KIR kendaraan sudah habis" | Belum | Di Pengiriman › Rit baru, kendaraan itu bertanda *KIR habis* |
| U89 | Catat servis | Tab **Servis** → **Catat servis** → kendaraan tadi, odometer 20000, *Ganti oli*, Rp 450.000 → Simpan | Baris servis muncul; di tab Kendaraan: "Servis berikutnya: 25.000 km" | Belum | |
| U90 | Catat BBM & odometer mundur | Login Kasir → tab **BBM** → **Catat BBM** → odometer 19500, 40,5 L, Rp 405.000 → Simpan; lalu ubah odometer 24700 → Simpan | Pertama ditolak "lebih kecil dari catatan sebelumnya (20.000 km)"; kedua tersimpan; tab Kendaraan: servis berikutnya kuning (tinggal 300 km) dan notifikasi Admin "Servis kendaraan sudah dekat" | Belum | Kasir tidak melihat tombol Catat servis |
| U91 | Batalkan catatan salah | Login Admin → tab **BBM** → ikon ⦸ pada catatan → alasan → **Batalkan catatan** | Baris bertanda *Batal: alasan*; tidak dihitung di statistik | Belum | |
| U92 | Statistik armada | Tab **Statistik** (bulan ini) | Per kendaraan: rit, muatan, tepat jadwal, BBM & servis, km dan km/L; per sopir: rit dan surat jalan bermasalah | Belum | Butuh ≥ 2 catatan odometer untuk km/L |
| U87 | Data muatan lewat Excel | *Data Barang* → **Data muatan Excel** → **Yang belum lengkap** → di Excel isi semen `berat_kg` = `50000 g`, ukuran `700 mm`, `45`, `12`; satu baris pasir `curah` = YA tanpa volume → unggah | Semen: *Berubah* "berat (kosong) → 50 kg …"; pasir: *Galat* "wajib punya volume"; tombol simpan mati sampai pasir diperbaiki/dibuang → simpan | Belum | Cek: semen hilang dari saring *Data muatan belum lengkap* |
| U76 | Muatan saat berangkat | *Logistik › Pengiriman*: buat rit dengan kendaraan kecil, isi dengan invoice berisi barang yang datanya sudah diisi → **Berangkat**; ulangi dengan kendaraan besar | Bar berat/volume/panjang berwarna; merah = tombol mati; oranye = wajib alasan | Belum | |

### Papan Pengiriman dan rit rencana (24 Oktober, K-160)

**Sebelum menguji:** `pnpm db:migrate` (migrasi 0027), lalu buat 2 invoice pengantaran. Login sebagai Kasir atau Admin.

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U78 | Menu dan papan | Sidebar **Logistik › Pengiriman** | Empat kolom pas layar: Backlog, Dijadwalkan, Di jalan, Selesai hari ini; kedua invoice ada di Backlog | Belum | *Kendaraan & Sopir* kini di menu Logistik |
| U79 | Rit baru | Tekan `R` → pilih kendaraan dan sopir → `Enter` | Grup rit baru di kolom Dijadwalkan bertuliskan "Seret order kirim ke sini" | Belum | Coba juga tombol **Rit baru** |
| U80 | Seret ke rit | Tarik invoice pertama lewat pegangan ⋮⋮ ke grup rit, lepas | Grup berbingkai biru saat di atasnya; setelah dilepas kartu pindah ke grup sebagai surat jalan, "1 surat jalan" | Belum | |
| U81 | Tanpa menyeret | Invoice kedua: klik **⋮** → pilih rit tadi | Masuk grup yang sama, "2 surat jalan"; bar muatan berubah | Belum | |
| U82 | Pindah dan keluarkan | Seret satu surat jalan ke grup rit lain; lalu seret ke kolom Backlog | Pindah rit (sopir/kendaraan di surat jalan ikut berganti); seret ke Backlog membatalkan surat jalan dan ordernya kembali ke Backlog | Belum | Diubah 26 Okt (K-174) |
| U83 | Dimuat → Berangkat | **Dimuat** → **Berangkat** → (alasan bila oranye) → **Berangkat** | Grup bertanda *Dimuat*; lalu pindah ke *Di jalan* | Belum | Kendaraan yang sedang jalan ditolak saat berangkat |
| U84 | Catat hasil sampai selesai | Di kolom *Di jalan*: **Catat hasil** tiap surat jalan; satu dengan *Kembali utuh* 1 | Rit pindah ke *Selesai hari ini*; invoice itu muncul lagi di Backlog bertanda *Kirim ulang* | Belum | |
| U85 | Batal rit | Buat rit, isi satu invoice, **Batal rit** → tulis alasan | Grup hilang; surat jalannya batal, invoice kembali di Backlog | Belum | Diubah 26 Okt (K-174) |
| U86 | Dua komputer | Dua jendela membuka papan; jendela A memberangkatkan rit, jendela B (tanpa muat ulang) menyeret kartu ke rit itu | B mendapat pesan "sudah berangkat; muat ulang halaman"; dalam 30 detik papan B ikut berubah | Belum | |

### Pengantaran: kendaraan, sopir, hasil per barang (23 Oktober, K-149–K-151)

**Sebelum menguji:** jalankan `pnpm db:migrate` (migrasi 0023), lalu isi minimal 2 kendaraan dan 2 sopir di
*Data Master › Kendaraan & Sopir* (login Admin/Owner).

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U50 | Data kendaraan & sopir | Tambah kendaraan plat `s 1234 ab`; tambah lagi plat `S 1234 AB`; tambah sopir "Budi" lalu "budi" | Plat tersimpan `S 1234 AB`; yang kedua ditolak "sudah terdaftar"; "budi" ditolak "sudah ada" | Belum | |
| U51 | Papan Pengiriman aktif | — | — | Diganti | Tab ini diganti halaman *Logistik › Pengiriman* (K-160), uji U78 |
| U52 | Berangkat bersama | — | — | Diganti | Lewat rit di papan Pengiriman, uji U79–U83 |
| U53 | Kendaraan terkunci | Saat rit pertama di jalan, buat rit kedua dengan kendaraan yang sama, isi, **Berangkat** | Rit baru boleh dibuat (tertulis *sekarang di jalan*); **Berangkat** ditolak "sedang jalan sejak … (TRP-…)" | Belum | |
| U54 | Semua diterima | Di kartu TRP: **Catat hasil** surat jalan pertama → `Enter` | Surat jalan hilang dari kartu; kartu TRP masih ada (surat jalan kedua belum) | Belum | |
| U55 | Kembali utuh | Surat jalan kedua: **Catat hasil** → isi *Kembali utuh* 1 → **Simpan hasil** | Kolom *Diterima* berkurang otomatis; kartu TRP hilang; invoice muncul lagi di *Backlog* bertanda *Kirim ulang* qty 1; stok tidak berubah | Belum | |
| U56 | Rusak di jalan | Kirim lagi, lalu **Catat hasil** → *Rusak di jalan* 1 → pilih **Dikirim pengganti** → simpan | Stok jual −1, stok rusak +1, tagihan tetap, pengganti muncul di *Backlog* | Belum | Coba juga **Tagihan dikurangi**: sisa tagihan turun |
| U57 | Ditolak pembeli (kasir) | Login Kasir → catat hasil dengan *Ditolak* 1 → simpan | Toast "Retur RTR-… menunggu persetujuan atasan"; surat jalan menulis *menunggu atasan*; barang itu belum muncul di *Backlog* | Belum | Setujui/tolak di Retur Penjualan |
| U58 | Ditolak saat invoice lunas | Invoice lunas tunai → catat hasil *Ditolak* 1 tanpa memilih cara uang kembali | Ditolak "pilih cara uang dikembalikan"; pilih **Tunai** → berhasil, uang keluar dari uang shift | Belum | |
| U59 | Riwayat perjalanan | *Logistik › Kendaraan & Sopir* → klik angka di kolom **Perjalanan** | Daftar perjalanan: nomor, berangkat, kembali, surat jalan | Belum | |

### Diskon dihapus, mode ubah order, istilah uang shift (23 Oktober, K-146–K-148)

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U44 | Diskon manual hilang | Di Order, Langsung, dan Pengantaran: tambah barang → tombol ⋮ (atau `M`) di baris | Menu hanya berisi ubah qty, ganti satuan, lepas promo (bila ada), hapus; tidak ada *Diskon*, tombol `%` tidak berbuat apa-apa | Belum | Potongan harga lewat Pengaturan › Promo |
| U45 | Pengaturan tanpa batas diskon | Pengaturan › Harga | Bagian "batas diskon per peran" tidak ada lagi | Belum | |
| U46 | Ubah order dari Daftar order | Order Penjualan › Daftar order → pilih order *Menunggu kasir* → **Ubah** | Input cepat terbuka dengan pita kuning "Mengubah ORD-…"; tambah/kurangi barang → `F8` → "Perubahan order … disimpan"; antrean kasir ikut berubah | Belum | Form order lengkap sudah tidak ada |
| U47 | Buang perubahan | Seperti U46, ubah qty → `F9` → **Ya, buang perubahan** | Form kosong; order tetap seperti semula (cek di Daftar order) | Belum | |
| U48 | Istilah uang shift | Buka halaman Shift, kotak hitung, tutup shift, panel bayar tunai | Tulisan memakai "uang shift" (mis. *Hitung uang shift*, *Total uang shift*); kata "laci" hanya untuk laci kas printer | Belum | |
| U49 | Koreksi modal terkunci saat hitung susulan | **Buka shift** → `N` (hitung nanti) → `Enter` → lihat tombol **Koreksi modal** | Tombol nonaktif dengan keterangan "Tersedia setelah hitung uang shift disimpan"; aktif setelah **Simpan hasil** | Belum | |

### Satu shift toko dan perbaikan uji (19 Oktober, K-132–K-142)

**Catatan:** 3 shift terbuka dari aturan lama (Owner, Admin, Kasir) sudah ditutup oleh persiapan tes otomatis
dengan uang fisik = saldo sistem (selisih 0) dan keterangan "ditutup otomatis … tes e2e" / "uji sendiri" (lihat
*Riwayat*). Bila masih ada shift ganda, halaman Shift menampilkannya dalam kotak merah dengan tombol tutup.

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U35 | Satu shift toko | Kasir membuka shift; lalu login Admin di jendela lain dan coba **Buka shift** | Admin ditolak: "Shift toko SHF-… sudah dibuka Demo Kasir"; penjualan tunai Admin masuk shift yang sama | Belum | |
| U36 | Indikator shift untuk Staf | Login **Staf** | Di atas layar tampil *Shift buka* / *Shift tutup* | Belum | |
| U37 | Hitung nanti dua langkah | **Buka shift** → `N` → `Enter` → jual tunai → di kotak *Hitung uang shift* isi laci (sengaja beda) → **Kirim hitungan** → **Ya, kirim** | Hasil berangka: laci − uang masuk = modal saat buka, dibanding uang kemarin; **Hitung ulang (sekali)**; **Simpan hasil**; Koreksi modal baru aktif setelah disimpan | Belum | |
| U38 | Hitung per pecahan | Di kotak hitung: ketik angka, `↑` `↓`, `+` `−`, `Del`, `Shift+Del`, tombol −/+ dan × | Pindah/ubah/kosongkan sesuai tombol; tombol −/+/× tidak ikut `Tab` | Belum | |
| U39 | Tutup shift dengan order di antrean | Staf mengirim 1 order ke antrean; lalu buka kotak *Tutup shift* | Kotak "1 order belum selesai" dengan pilihan **Simpan nanti / Ke draf / Batalkan** (dan **Ke antrean** bila sedang di kasir) | Belum | Pengganti U34 |
| U40 | Retur menunggu saat tutup | Ajukan retur tunai (jangan disetujui), lalu lihat kotak *Tutup shift* | Kotak biru "retur/void menunggu persetujuan"; uangnya belum dihitung keluar | Belum | |
| U41 | Kembalian tidak diambil | Di kasir: barang Rp 62.000, uang 100.000 → tekan `K` → bayar; lalu lihat kas di halaman Shift | Kembalian tercoret; kas "Kembalian tidak diambil Rp 38.000" tercatat; omzet tetap Rp 62.000 | Belum | |
| U42 | Kode atasan dilanjutkan | Koreksi modal setelah ada transaksi tunai → **Minta persetujuan…** → **Kirim kode ke atasan** → `Esc` → **Minta persetujuan…** lagi | Langsung ke isian kode ("berlaku sampai …"), tanpa kirim kode baru | Belum | |
| U43 | Notifikasi bisa digulir | Klik lonceng saat notifikasi banyak | Daftar bisa digulir sampai bawah | Belum | Rincian tiap notifikasi dan bagian dashboard menyusul (K-131) |

### Order disimpan, kembali ke draf, draf lain (18 Oktober, K-122)

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U30 | Kasir memproses order disimpan (coba ulang) | Login **Kasir** → *Penjualan Langsung*: di atas antrean tertulis "1 disimpan" → klik → pilih order → **Proses ke pembayaran** | Order terbuka di layar kasir dan bisa dibayar seperti order antrean | Masalah | 18 Okt: tombol *Proses ke pembayaran* tidak terlihat (terpotong); tombol *Kirim ke antrean (F8)* di input cepat juga terpotong. Diperbaiki di K-129 |
| U34 | Tutup shift dengan order dipegang | Kasir membuka satu order dari antrean (jangan dibayar), lalu ke *Shift & Clerical Check* | Kotak kuning "1 order masih Anda pegang" dengan tombol Ke antrean / Simpan untuk nanti / Ke draf / Batalkan | Masalah | 18 Okt: order yang masih di antrean tidak ditampilkan, shift tetap bisa ditutup tanpa peringatan. Diubah di K-133: semua order belum selesai ditampilkan |

### Shift & Clerical Check baru (18 Oktober, K-121)

Login sebagai **Kasir** (atau Owner). Bila masih ada shift terbuka, tutup dulu. *Catatan:* U22–U27 dan U10 akan
berubah langkahnya setelah satu shift untuk toko (K-132); tunggu versi baru sebelum mencoba.

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U22 | Tutup shift dua langkah | Kotak **Tutup shift & clerical check** → hitung uang (sengaja salah, mis. kurang Rp 50.000) → **Kirim hitungan** → **Ya, kirim** | Angka sistem baru tampil setelah dikirim; selisih merah "Kurang"; kotak *Bantuan mencari selisih* (mis. "1 lembar Rp 50.000"); *Tinjauan shift* di kanan | Belum | |
| U23 | Hitung ulang sekali, keterangan, uang ditinggal | Lanjutan U22: buka **Hitung ulang (sekali)** → kirim angka benar → isi **Uang ditinggal** → **Tutup shift** → **Ya, tutup shift** | Hitung ulang hanya sekali; bila masih selisih di luar Rp 1.000 keterangan wajib; hasil clerical tampil | Belum | |
| U24 | Uang ditinggal jadi usulan modal | Setelah U23: **Buka shift** lagi | Pilihan `Enter` menulis "Sama dengan uang ditinggal kemarin: Rp …" sesuai isian U23 | Belum | |
| U25 | Buka dulu, hitung nanti | **Buka shift** → `N` → `Enter`; lakukan satu penjualan tunai; lalu di kotak kuning **Hitung uang shift** isi total laci → **Kirim hitungan susulan** → **Ya, kirim** | Spanduk kuning "Hitung uang shift belum dikirim" muncul di semua halaman sampai dikirim; bila laci berbeda dari modal sementara + penjualan, tampil "Modal saat buka dikoreksi … (selisih semalam)" | Belum | |
| U26 | Penjelasan selisih (Owner/Admin) | *Semua shift* → klik shift yang berselisih → isi **Penjelasan selisih** → **Tandai terjelaskan** | Penjelasan, nama, dan waktu tersimpan; angka tidak berubah | Belum | |
| U27 | Pengaturan toleransi | *Pengaturan › Operasional*: ubah **Toleransi selisih kas** dan **Batas hitung susulan** | Tersimpan; selisih di bawah toleransi ditandai "Selisih receh" tanpa keterangan wajib | Belum | |

### Dari 17 Oktober

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U3 | Lama kirim pemasok | *Data Pemasok* → **Ubah** → isi **Lama kirim** dan **Belanja tiap** | Tersimpan; dipakai di Saran pesan | Belum | |
| U4 | Saran pesan | *Stok Persediaan › Saran pesan*: klik kotak status, saringan pemasok, tombol "?", **Cetak / Excel** | Daftar tersaring; "?" menjelaskan rumus; cetak dan Excel berisi angka yang sama. Penjualan hari ini belum dihitung (periode sampai kemarin) | Sebagian | Masukan 18 Okt (metode lain, "?" kelebihan/kekurangan) dikerjakan di K-127 |
| U5 | Isian Saran pesan | *Pengaturan › Operasional*: empat isian "Saran pesan" | Tersimpan dan mengubah hasil Saran pesan | Belum | |

---

## Sudah dicoba

| No | Yang dicoba | Hasil | Tanggal lapor | Catatan |
|---|---|---|---|---|
| U1 | Semua tab Pengaturan terlihat tanpa digeser | OK | 18 Okt | |
| U2 | Panel rincian barang menutupi antrean saat barang disorot | OK | 18 Okt | Masukan: tombol X + pintasan, info penjualan (K-123) |
| U6 | Printer RPP02 lewat port COM keluar | OK | 18 Okt | Berhasil setelah disambungkan sebagai SPP Slave. Masukan: logo, cetak lebih pekat (K-124) |
| U8 | Cari barang lewat ciri (`pipa 3 inch putih`) dan pilihan kategori | OK | 18 Okt | Masukan: atribut dicocokkan sebagian, "1" menemukan 10, "c" menemukan cm (K-123) |
| U15 | **Mulai dari awal** (`F9`) di Order, Langsung, Pengantaran | OK | 18 Okt | |
| U17 | Email akun tidak tertukar | OK | 18 Okt | |
| U18 | Esc di dialog buka shift | OK | 18 Okt | Masukan: dialog jangan muncul sendiri, ganti kartu pojok kanan bawah (K-130); kata lebih ringkas (K-128) |
| U19 | Buka shift dengan hitung per pecahan | OK | 18 Okt | Masukan: tombol −/+, Hapus, Hapus semua + hotkey (K-135) |
| U20 | Koreksi modal tanpa kode | OK | 18 Okt | |
| U21 | Koreksi modal dengan kode | OK | 18 Okt | Masalah kecil: dialog kode ditutup tidak bisa dilanjutkan (K-136) |
| U28 | Simpan untuk diambil nanti | OK | 18 Okt | Masukan: pilih pelanggan yang ada, cegah data ganda (K-137) |
| U29 | Validasi simpan | OK | 18 Okt | Masukan: format No. HP tanpa 0 dengan kode negara (K-137) |
| U31 | Kasir F9 dengan order terbuka (A/S/D) | OK | 18 Okt | |
| U32 | Peringatan draf lain | OK | 18 Okt | Masukan: tampilkan siapa penginput di semua halaman bersama (K-138) |
| U33 | Buka draf otomatis | OK | 18 Okt | |
| U7 | Ubah pelanggan dengan kode | OK | 23 Okt | |
| U9 | Jadwal shift (pengingat biru/kuning) | OK | 23 Okt | Masukan: pengingat bisa diciutkan jadi lencana → K-156, uji U66 |
| U10 | Menutup shift orang lain | Tidak relevan | 23 Okt | Satu shift toko (K-132, K-155): tidak ada shift orang lain; diganti U65 |
| U11 | Promo (anggaran, batas per pembeli) | OK | 23 Okt | Masukan besar: editor kampanye (syarat + manfaat, jam-menit, banyak barang, templat) → K-163 |
| U12 | Rekening toko | OK | 23 Okt | Masukan: tanpa rekening terdaftar non-tunai tidak boleh; istilah e-wallet → K-154, uji U63–U64 |
| U13 | Cek uang non-tunai | OK | 23 Okt | Masukan: catatan terpotong → K-153, uji U61 |
| U14 | Bayar campuran | OK | 23 Okt | Masukan: tombol diperjelas → K-157, uji U62 |
| U16 | Retur | OK | 23 Okt | |

---

## Riwayat

- 2026-10-18 — Dibuat atas permintaan pemilik: daftar uji 17 Oktober (U1–U17) dan shift baru K-121 (U18–U27).
- 2026-10-18 — U28–U34 order disimpan, kembali ke draf, peringatan draf lain (K-122).
- 2026-10-18 — Hasil uji pemilik: U17–U21, U28, U29, U31–U33 OK; U30, U34 Masalah; masukan dicatat K-128–K-145.
- 2026-10-19 — U35–U43 satu shift toko dan perbaikan uji (K-132–K-142); U30 diperbaiki, coba ulang.
- 2026-10-23 — U44–U49 diskon manual dihapus, mode ubah order, istilah uang shift, koreksi modal saat hitung susulan (K-146–K-148).
- 2026-10-23 — U50–U59 kendaraan & sopir, papan Pengiriman aktif, hasil per barang (K-149–K-151).
- 2026-10-24 — Hasil uji 23 Okt: U7, U9, U11–U14, U16 OK; U10 tidak relevan (satu shift toko). U60–U70 perbaikan K-152–K-159.
- 2026-10-24 — U71–U73 pencarian universal, cek versi, kiriman tidak ganda (K-164, K-167).
- 2026-10-24 — U74–U76 data muatan dan pemeriksaan muatan (K-161).
- 2026-10-24 — U108–U110 cari sebagian, label keterjualan, panel rincian (K-123).
- 2026-10-24 — U111–U113 kepekatan, logo struk, kertas dan cetak otomatis invoice/surat jalan (K-124).
- 2026-10-25 — U121 perbaikan kecil sebelum deploy, U122 surat jalan 2 rangkap.
- 2026-10-28 — U145 pemeriksaan data diperluas (K-183).
- 2026-10-28 — U143–U144 data muatan (K-169, K-170).
- 2026-10-28 — U142 info cepat nomor dokumen (K-181).
- 2026-10-28 — U141 saran alasan di semua dialog (K-180).
- 2026-10-28 — U140 kartu Pengiriman (K-173).
- 2026-10-28 — U137–U139 penyelesaian hasil pengantaran (K-176).
- 2026-10-28 — U135–U136 panduan penyiapan dan contoh data (K-168).
- 2026-10-26 — U132–U134 akun pertama dan lupa password (K-191).
- 2026-10-26 — U129–U131 log interaksi penelitian (K-190).
- 2026-10-26 — U128 seret kartu dengan keyboard (K-177).
- 2026-10-26 — U124–U127 surat jalan hanya di dalam rit, cetak semua saat berangkat (K-174); U82, U85 disesuaikan.
- 2026-10-24 — U118–U120 order pembelian (K-125).
- 2026-10-24 — U117 Hasil Penjualan (K-126).
- 2026-10-24 — U116 ekspor log.
- 2026-10-24 — U114–U115 metode saran pesan dan stok maksimum (K-127).
- 2026-10-24 — U102–U107 No. HP, cegah dobel, pemeriksaan data, daftar order, notifikasi rinci, label F9 (K-129–K-143).
- 2026-10-24 — U98–U101 arsip tahunan, Tentang aplikasi (K-165, K-166).
- 2026-10-24 — U93–U97 kampanye promo (K-163 bagian 1).
- 2026-10-24 — U88–U92 BBM, servis, pengingat, statistik armada (K-162).
- 2026-10-24 — U87 isi massal data muatan lewat Excel (K-161).
- 2026-10-24 — U78–U86 papan Pengiriman dan rit rencana (K-160); U51–U52 diganti, U53, U55–U57, U59, U76 disesuaikan.
