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
