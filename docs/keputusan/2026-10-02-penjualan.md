# Keputusan Penjualan (Fase 5) — 2 Oktober 2026

Melanjutkan penomoran dari `2026-10-01-persediaan.md`. Semua keputusan di berkas ini adalah keputusan teknis
Claude Code sesuai kewenangan yang diberikan pemilik proyek; aturan bisnis docs/05–06 tidak berubah, hanya
ditafsirkan atau diurutkan pengerjaannya.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-070 — Order, reservasi, dan antrean (R1–R9)
**Keputusan:**
1. `stok_dipesan` hanya diubah lewat `ubahReservasi()` di `persediaan/ledger.ts` (penulis tunggal `persediaan`):
   baris dikunci urut id barang, semua kekurangan dikumpulkan dalam satu pesan (R3). Audit `hitungUlangCache`
   (L9) kini juga membandingkan `stok_dipesan` dengan Σ qty order MENUNGGU/DIPROSES.
2. Hak mengubah order: DRAFT hanya pembuatnya; MENUNGGU pembuatnya atau pemegang `penjualan.checkout`;
   DIPROSES hanya kasir pemegang kunci (R4). Baris order diganti utuh; selisih qty diterapkan ke reservasi.
3. Harga baris yang barang & tier-nya tidak berubah tetap memakai harga saat order dibuat (P2); kasir dapat
   mencentang "Perbarui harga" per baris saat checkout (dicatat `ORDER_UBAH`).
4. Izin baru **`penjualan.order.lepas_paksa`** (Admin, Owner) untuk melepas kunci order milik kasir lain (R8).
5. Job order (R7 auto-batal basi bila diaktifkan, R8 lepas kunci) berjalan tiap 15 menit di proses API. Kunci
   dianggap kadaluarsa bila order DIPROSES tidak berubah (`diubah_pada`) lebih dari `batas_kunci_order_menit`.
   Log aksi otomatis memakai `id_pengguna` kosong (docs/03 §3.1 diperbarui).
6. Diskon persen diubah ke rupiah oleh server (U4); bila konfigurasi batas diskon belum ada, nilai bawaannya
   sama dengan seed (Staf 0, Kasir 0, Admin 100, Owner 100). Harga manual di bawah dasar modal (H9) wajib
   persetujuan eksplisit di layar dan dicatat log "di bawah modal".

**Alasan:** Satu penulis stok mencegah reservasi dan stok fisik tidak sinkron; aturan siapa boleh mengubah
order mengikuti alur kerja Staf → Kasir di laporan KP.
**Ditolak:** auto-lepas kunci dihitung dari waktu proses (perlu kolom baru; `diubah_pada` cukup sebagai
"aktivitas terakhir").

### K-071 — Checkout, pembayaran, dan shift di Fase 5 (P1–P13, K1)
**Keputusan:**
1. **Buka shift (K1) dibangun di Fase 5**, karena CHECK database mewajibkan pembayaran TUNAI terikat shift.
   Kas shift, tutup shift, dan clerical check tetap Fase 6 (sampai itu, shift yang terbuka belum bisa ditutup).
2. Tafsiran P12 saat `checkout_wajib_shift = true`: tunai selalu butuh shift BUKA milik pencatat; non-tunai
   tanpa shift hanya untuk pemegang `kas.shift.lihat_semua` (Admin/Owner).
3. Checkout satu transaksi: order (MENUNGGU otomatis dikunci kasir) → penjualan + detail (snapshot harga & HPP)
   → reservasi dilepas → mutasi PENJUALAN per baris (urut id barang) → pembayaran → cache status. Checkout
   langsung dari keranjang membuat order lalu menyelesaikannya dalam transaksi yang sama (P1).
4. Jenis pembayaran: pembayaran pertama = PENUH bila melunasi, selain itu DP; pembayaran berikutnya (termasuk
   metode kedua pada bayar campuran) = PELUNASAN (P8).
5. Jatuh tempo bawaan saat belum lunas: tanggal operasional + term pelanggan; term 0 → + `jatuh_tempo_default_hari`
   (P7). Helper `tambahHari()` di `lib/waktu.ts`.
6. Struk thermal 58/80 mm, invoice dan surat jalan A4 dicetak lewat `AreaCetak` (hanya dokumen itu yang tercetak).
   Cetak ulang dicatat `CETAK_ULANG`.

**Alasan:** Tanpa shift, kasir tidak bisa menerima uang tunai sama sekali di Fase 5.
**Ditolak:** menonaktifkan CHECK shift sementara (melemahkan clerical check Fase 6).

### K-072 — Surat jalan dan piutang (S1–S7, PT1–PT7)
**Keputusan:**
1. Qty kirim per baris ≤ qty − retur − qty di surat jalan non-BATAL (baris VOID = 0). Status pengiriman invoice
   dihitung ulang di transaksi yang sama setiap SJ dibuat, maju status, atau batal (S4).
2. Linimasa surat jalan di detail invoice: dicetak → dimuat → dikirim (sopir wajib) → diterima; batal hanya
   sebelum berangkat.
3. Halaman Piutang: daftar per penjualan (jatuh tempo terdekat dulu, terlambat ditandai), ringkasan per pelanggan,
   terima pembayaran langsung dari daftar. Pelanggan dengan piutang terlambat diberi peringatan di form order dan
   layar kasir (PT7), tidak diblokir.
4. Notifikasi topbar (ST2): order basi (`penjualan.order.lihat_semua`), piutang terlambat dan jatuh tempo ≤ 3 hari
   (`penjualan.piutang.lihat`).

**Alasan:** Pengiriman bertahap umum untuk pesanan proyek (K-024); piutang perlu terlihat sebelum memberi
kredit lagi.
**Ditolak:** blokir otomatis pelanggan terlambat (PT7: hanya peringatan); limit kredit (Fase 10).

### K-073 — Alur POS cepat: antrean tiket FIFO, input order cepat, keyboard penuh (masukan pemilik)
**Konteks:** Di jam ramai banyak order masuk tanpa nama pembeli; kasir harus mengenali order dari isi barangnya,
pembeli tidak datang ke kasir sesuai urutan order, dan layanan tidak boleh tersendat oleh sistem. Pemilik meminta
alur seefisien mungkin (Six Sigma/TQM), bisa dijalankan sepenuhnya dengan keyboard, tampilan minim tetapi
informatif, dan boleh berbeda dari halaman lain demi efisiensi.
**Keputusan:**
1. **Identitas order tanpa nama**: isi barang + total + **nomor antrean** (angka terakhir nomor ORD hari itu,
   mis. ORD-261002-057 → 57). Nama/ciri pembeli opsional.
2. **Papan antrean** di Penjualan Langsung dan Penjualan Pengantaran (tidak hanya di Order Penjualan). Tiket
   menampilkan nomor besar, lama menunggu (kuning ≥ 5 menit, merah ≥ 10), sampai 4 baris barang, total, pembuat;
   tiket yang dipegang kasir lain diredupkan. Kartu di Order Penjualan juga menampilkan isi barang.
3. **FIFO murni**: urut waktu masuk antrean, tiket terlama tersorot otomatis; kasir bebas memilih tiket lain.
   Prioritas TINGGI hanya penanda (mengganti urutan "prioritas dulu" pada K-070).
4. **Siaran langsung** (Server-Sent Events, `lib/siaran.ts`): setelah order berubah (commit), layar terbuka diberi
   tanda dan memuat ulang papan; tanpa polling per detik (cadangan muat ulang 60 detik). Tidak ada data bisnis di
   kanal siaran.
5. **Input order cepat** (tab bawaan Order Penjualan): kursor langsung di kotak cari; `3*semen` = qty 3; Enter
   menambah walau hasil belum tampil (mengetik cepat/scanner menunggu jawaban server); Enter di kotak kosong lalu
   Enter = kirim (dua langkah agar tidak salah kirim); F8 = kirim. Setelah kirim, nomor antrean tampil besar dan form
   kosong lagi. Daftar "Order saya" menunjukkan status order (live). Form lengkap tetap ada untuk tier/diskon/harga
   manual/prioritas.
6. **Keyboard penuh** — layar kasir & pengantaran: F2 cari barang, F3 antrean (ketik nomor + Enter = panggil nomor),
   F4 pelanggan, F8 bayar, F9 batal/kembalikan order ke antrean, Esc kembali, Ctrl+Z urungkan hapus. Daftar barang:
   + / − qty, angka = qty baru, % diskon, T tier, Del hapus. Kotak bayar: angka = uang diterima/nominal, Enter kosong =
   uang pas (pengantaran: tanpa pembayaran), T/B/E metode, C bayar campuran, D barang ditinggal, L isi lunas dan
   S bayar saat terima (pengantaran). Input order cepat: F2, F3 jenis, F4 pelanggan, F8 kirim, F9 kosongkan.
   Bilah tombol yang berlaku selalu tampil di bawah. F1, F6, F7, F10, F11, F12 tidak dipakai karena dicadangkan
   peramban (tidak bisa diambil alih halaman web).
7. Kasir boleh mengubah isi order antrean saat bayar; API checkout menerima `idOrder` + isi baru dan menjalankan
   ubah order (R4, reservasi disesuaikan) dan checkout dalam satu transaksi.
8. **Nominal kosong = lunasi sisa** (dihitung server): tunai memakai min(uang diterima, sisa). Kasir cukup mengetik
   uang yang diterima; tidak ada selisih bila harga final berbeda dari perkiraan layar. P6 (pembeli umum wajib lunas)
   diperiksa setelah pembayaran dihitung, dalam transaksi yang sama.
9. Struk dicetak otomatis tanpa jendela pratinjau, kembalian tampil besar sampai transaksi berikutnya. Pengantaran:
   invoice dicetak otomatis, S = buat surat jalan semua barang & cetak. Deploy: Chrome `--kiosk --kiosk-printing`
   (roadmap Fase 8).
10. Dialog buka shift muncul sendiri saat layar kasir dibuka tanpa shift (sekali sehari). Order yang sedang dibuka
    dikembalikan ke antrean bila kasir pindah halaman (selain itu job R8).
11. Rekening bawaan transfer/EDC di Pengaturan › Operasional (`rekening_transfer_default`, `rekening_edc_default`).

**Alasan:** Model keystroke (Card–Moran–Newell): satu aksi mouse ≈ 1,1 detik menunjuk + 0,4 detik memindah tangan,
sedangkan satu tombol ≈ 0,2–0,3 detik. Transaksi order dari antrean kini minimal: Enter → ketik uang → Enter. Papan
tiket FIFO mengikuti praktik layar dapur (KDS) restoran: pesanan terbaca sekilas, umur terlihat, adil.
**Ditolak:** wajib nama pembeli; urutan prioritas-dulu; polling tiap detik; dialog pratinjau struk; pintasan F7/F1.
