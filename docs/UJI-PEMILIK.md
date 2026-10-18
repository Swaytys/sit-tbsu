# Daftar Uji Pemilik

Daftar hal yang perlu dicoba pemilik proyek di aplikasi, beserta hasilnya. Claude Code menambah baris baru setiap
kali fitur selesai dan memperbarui status dari hasil yang Anda laporkan. Laporan berikutnya cukup merujuk nomor di
sini, tidak menulis ulang langkahnya.

**Sebelum menguji:** matikan `pnpm dev` (`Ctrl+C`), jalankan lagi `pnpm dev`, lalu tekan `Ctrl+F5` di peramban.

**Cara melapor:** sebut nomornya, misalnya "U12 OK, U14 galat: …". Bila ada masalah, tulis apa yang Anda lakukan
dan apa yang tampil (tangkapan layar membantu).

Status: **Belum** = belum dicoba · **OK** = sesuai · **Masalah** = tidak sesuai (lihat catatan) · **Sebagian** =
sebagian sudah dicoba.

---

## Belum dicoba / perlu dicoba ulang

### Order disimpan, kembali ke draf, draf lain (18 Oktober, K-122)

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U30 | Kasir memproses order disimpan | Login **Kasir** → *Penjualan Langsung*: di atas antrean tertulis "1 disimpan" → klik → pilih order → **Proses ke pembayaran** | Order terbuka di layar kasir dan bisa dibayar seperti order antrean | Masalah | 18 Okt: tombol *Proses ke pembayaran* tidak terlihat (terpotong); tombol *Kirim ke antrean (F8)* di input cepat juga terpotong. Diperbaiki di K-129 |
| U34 | Tutup shift dengan order dipegang | Kasir membuka satu order dari antrean (jangan dibayar), lalu ke *Shift & Clerical Check* | Kotak kuning "1 order masih Anda pegang" dengan tombol Ke antrean / Simpan untuk nanti / Ke draf / Batalkan | Masalah | 18 Okt: order yang masih di antrean tidak ditampilkan, shift tetap bisa ditutup tanpa peringatan. Diubah di K-133: semua order belum selesai ditampilkan |

### Shift & Clerical Check baru (18 Oktober, K-121)

Login sebagai **Kasir** (atau Owner). Bila masih ada shift terbuka, tutup dulu. *Catatan:* U22–U27 dan U10 akan
berubah langkahnya setelah satu shift untuk toko (K-132); tunggu versi baru sebelum mencoba.

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U22 | Tutup shift dua langkah | Kotak **Tutup shift & clerical check** → hitung uang (sengaja salah, mis. kurang Rp 50.000) → **Kirim hitungan** → **Ya, kirim** | Angka sistem baru tampil setelah dikirim; selisih merah "Kurang"; kotak *Bantuan mencari selisih* (mis. "1 lembar Rp 50.000"); *Tinjauan shift* di kanan | Belum | |
| U23 | Hitung ulang sekali, keterangan, uang ditinggal | Lanjutan U22: buka **Hitung ulang (sekali)** → kirim angka benar → isi **Uang ditinggal di laci** → **Tutup shift** → **Ya, tutup shift** | Hitung ulang hanya sekali; bila masih selisih di luar Rp 1.000 keterangan wajib; hasil clerical tampil | Belum | |
| U24 | Uang ditinggal jadi usulan modal | Setelah U23: **Buka shift** lagi | Pilihan `Enter` menulis "Sama dengan uang ditinggal kemarin: Rp …" sesuai isian U23 | Belum | |
| U25 | Buka dulu, hitung nanti | **Buka shift** → `N` → `Enter`; lakukan satu penjualan tunai; lalu di kotak kuning **Hitung uang laci** isi total laci → **Kirim hitungan susulan** → **Ya, kirim** | Spanduk kuning "Hitung uang laci belum dikirim" muncul di semua halaman sampai dikirim; bila laci berbeda dari modal sementara + penjualan, tampil "Modal saat buka dikoreksi … (selisih semalam)" | Belum | |
| U26 | Penjelasan selisih (Owner/Admin) | *Semua shift* → klik shift yang berselisih → isi **Penjelasan selisih** → **Tandai terjelaskan** | Penjelasan, nama, dan waktu tersimpan; angka tidak berubah | Belum | |
| U27 | Pengaturan toleransi | *Pengaturan › Operasional*: ubah **Toleransi selisih kas** dan **Batas hitung susulan** | Tersimpan; selisih di bawah toleransi ditandai "Selisih receh" tanpa keterangan wajib | Belum | |

### Dari 17 Oktober

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U3 | Lama kirim pemasok | *Data Pemasok* → **Ubah** → isi **Lama kirim** dan **Belanja tiap** | Tersimpan; dipakai di Saran pesan | Belum | |
| U4 | Saran pesan | *Stok Persediaan › Saran pesan*: klik kotak status, saringan pemasok, tombol "?", **Cetak / Excel** | Daftar tersaring; "?" menjelaskan rumus; cetak dan Excel berisi angka yang sama. Penjualan hari ini belum dihitung (periode sampai kemarin) | Sebagian | Masukan 18 Okt (metode lain, "?" kelebihan/kekurangan) dikerjakan di K-127 |
| U5 | Isian Saran pesan | *Pengaturan › Operasional*: empat isian "Saran pesan" | Tersimpan dan mengubah hasil Saran pesan | Belum | |

### Dari 12 Oktober

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U7 | Ubah pelanggan dengan kode | Login Kasir → *Data Pelanggan* → **Ubah** → **Simpan dengan persetujuan…** → kode dari Telegram/email | Tanpa kode tidak tersimpan; kolom limit, tagihan, jatuh tempo tampil | Belum | |
| U9 | Jadwal shift | *Pengaturan › Operasional › Jadwal shift*: isi jam tutup ±10 menit dari sekarang, tutup lalu buka shift baru | Pengingat biru 15 menit sebelum, lalu kuning setelah lewat | Belum | |
| U10 | Menutup shift orang lain | *Shift & Clerical Check › Semua shift* → centang **Hanya yang perlu ditutup** → klik shift → tutup | Shift tertutup atas nama Anda (alur dua langkah yang sama dengan U22–U23) | Belum | |
| U11 | Promo | *Pengaturan › Promo*: kolom *Potongan diberikan*, isian *Anggaran* dan *Batas per pembeli* | Tersimpan; promo berhenti saat anggaran habis | Belum | |
| U12 | Rekening toko | *Pengaturan › Pembayaran*: tambah rekening, lalu di kasir tekan `B` atau `Q` | Rekening bawaan terpilih otomatis | Belum | |
| U13 | Cek uang non-tunai | *Shift & Clerical Check › Cek uang non-tunai*: tandai *Sudah masuk* / *Tidak masuk* | Status berubah; *Tidak masuk* wajib catatan | Belum | |
| U14 | Bayar campuran | Di kasir, bayar dengan dua cara, lalu hapus satu bagian | Galat tampil di bawah kotak bayar | Belum | |
| U16 | Retur | *Retur Penjualan*: daftar transaksi langsung tampil | *Potong tagihan* hanya muncul bila ada sisa tagihan | Belum | |

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

---

## Riwayat

- 2026-10-18 — Dibuat atas permintaan pemilik: daftar uji 17 Oktober (U1–U17) dan shift baru K-121 (U18–U27).
- 2026-10-18 — U28–U34 order disimpan, kembali ke draf, peringatan draf lain (K-122).
- 2026-10-18 — Hasil uji pemilik: U17–U21, U28, U29, U31–U33 OK; U30, U34 Masalah; masukan dicatat K-128–K-145.
