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
| U76 | Muatan saat berangkat | *Logistik › Pengiriman*: buat rit dengan kendaraan kecil, isi dengan invoice berisi barang yang datanya sudah diisi → **Berangkat**; ulangi dengan kendaraan besar | Bar berat/volume/panjang berwarna; merah = tombol mati; oranye = wajib alasan | Belum | |

### Papan Pengiriman dan rit rencana (24 Oktober, K-160)

**Sebelum menguji:** `pnpm db:migrate` (migrasi 0027), lalu buat 2 invoice pengantaran. Login sebagai Kasir atau Admin.

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U78 | Menu dan papan | Sidebar **Logistik › Pengiriman** | Empat kolom pas layar: Backlog, Dijadwalkan, Di jalan, Selesai hari ini; kedua invoice ada di Backlog | Belum | *Kendaraan & Sopir* kini di menu Logistik |
| U79 | Rit baru | Tekan `R` → pilih kendaraan dan sopir → `Enter` | Grup rit baru di kolom Dijadwalkan bertuliskan "Seret order kirim ke sini" | Belum | Coba juga tombol **Rit baru** |
| U80 | Seret ke rit | Tarik invoice pertama lewat pegangan ⋮⋮ ke grup rit, lepas | Grup berbingkai biru saat di atasnya; setelah dilepas kartu pindah ke grup sebagai surat jalan, "1 surat jalan" | Belum | |
| U81 | Tanpa menyeret | Invoice kedua: klik **⋮** → pilih rit tadi | Masuk grup yang sama, "2 surat jalan"; bar muatan berubah | Belum | |
| U82 | Pindah, keluarkan, batal | Seret satu surat jalan ke kotak *Belum direncanakan*, lalu kembalikan; seret ke Backlog | Keluar/masuk rit; seret ke Backlog membuka dialog batal (tekan Batal: tidak terjadi apa-apa) | Belum | |
| U83 | Dimuat → Berangkat | **Dimuat** → **Berangkat** → (alasan bila oranye) → **Berangkat** | Grup bertanda *Dimuat*; lalu pindah ke *Di jalan* | Belum | Kendaraan yang sedang jalan ditolak saat berangkat |
| U84 | Catat hasil sampai selesai | Di kolom *Di jalan*: **Catat hasil** tiap surat jalan; satu dengan *Kembali utuh* 1 | Rit pindah ke *Selesai hari ini*; invoice itu muncul lagi di Backlog bertanda *Kirim ulang* | Belum | |
| U85 | Batal rit | Buat rit, isi satu invoice, **Batal rit** → tulis alasan | Grup hilang; surat jalannya ada di *Belum direncanakan* | Belum | |
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
- 2026-10-24 — U78–U86 papan Pengiriman dan rit rencana (K-160); U51–U52 diganti, U53, U55–U57, U59, U76 disesuaikan.
