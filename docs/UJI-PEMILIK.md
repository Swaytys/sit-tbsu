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
| U28 | Simpan untuk diambil nanti | Login **Staf** → *Order Penjualan* → tambah barang → **Simpan untuk nanti** (`F7`) → isi nama, No. HP, pilih **Besok** → `Enter` | Form kosong lagi; order tampil di *Daftar order › Disimpan* dengan tanggal ambil dan No. HP; stok tersedia barang itu berkurang; order **tidak** muncul di antrean kasir | Belum | |
| U29 | Validasi simpan | Ulangi U28 tanpa nama / dengan HP `12` / tanggal lebih dari 14 hari | Pesan merah di bawah isian yang salah; order tidak tersimpan | Belum | |
| U30 | Kasir memproses order disimpan | Login **Kasir** → *Penjualan Langsung*: di atas antrean tertulis "1 disimpan" → klik → pilih order → **Proses ke pembayaran** | Order terbuka di layar kasir dan bisa dibayar seperti order antrean | Belum | |
| U31 | Pembeli lupa dompet (F9) | Di layar kasir dengan order terbuka tekan `F9` → coba `A`, lalu buka lagi dan `D`, lalu buka order lain dan `S` | `A` = kembali ke antrean; `D` = order kembali jadi draf milik staf pembuatnya (stok dilepas, barang tetap); `S` = dialog simpan untuk nanti | Belum | |
| U32 | Peringatan draf lain | Staf A membuat draf (jangan dikirim) berisi barang dengan stok sedikit; Staf B (atau akun lain) menambahkan barang yang sama sampai melebihi stok | Muncul "… juga ada di draf lain" menyebut draf, pembeli, pembuat, qty; `Esc` menghapus lagi; `Enter` membiarkan; `B` membuka draf milik sendiri | Belum | |
| U33 | Buka draf otomatis | Di *Order saya* hilangkan centang **Buka draf otomatis**, muat ulang halaman; lalu centang lagi, muat ulang | Mati: form selalu kosong; nyala: draf terakhir terbuka sendiri | Belum | |
| U34 | Tutup shift dengan order dipegang | Kasir membuka satu order dari antrean (jangan dibayar), lalu ke *Shift & Clerical Check* | Kotak kuning "1 order masih Anda pegang" dengan tombol Ke antrean / Simpan untuk nanti / Ke draf / Batalkan | Belum | |

### Shift & Clerical Check baru (18 Oktober, K-121)

Login sebagai **Kasir** (atau Owner). Bila masih ada shift terbuka, tutup dulu.

| No | Yang dicoba | Langkah | Yang seharusnya terjadi | Status | Catatan |
|---|---|---|---|---|---|
| U18 | Esc di dialog buka shift | *Shift & Clerical Check* → **Buka shift** → langsung tekan `Esc` | Jendela tertutup tanpa perlu mengklik apa pun | Belum | |
| U19 | Buka shift dengan hitung per pecahan | **Buka shift** → tekan `H` → isi jumlah lembar per pecahan → `Enter` → di konfirmasi tekan `Esc` → `Enter` → `Enter` | Total terhitung otomatis; `Esc` kembali ke hitungan tanpa menghapus angka; konfirmasi menampilkan modal dengan huruf besar; shift terbuka | Belum | |
| U20 | Koreksi modal tanpa kode | Sebelum ada penjualan tunai: **Koreksi modal** → isi modal benar + alasan → **Simpan koreksi** | Modal berubah, tertulis "(dikoreksi Rp …)"; koreksi tampil di daftar kas | Belum | |
| U21 | Koreksi modal dengan kode | Lakukan satu penjualan tunai dulu, lalu **Koreksi modal** → **Minta persetujuan…** → **Kirim kode ke atasan** → ketik kode dari Telegram/email → **Setujui dengan kode** | Tanpa kode tidak bisa; pesan atasan memuat modal lama → baru dan alasan; setelah kode benar, koreksi tercatat dengan nama atasan | Belum | |
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
| U17 | Email akun tidak tertukar | Login Owner, lalu Admin, bergantian | Email di *Akun saya* sesuai akun masing-masing | Belum | |

---

## Sudah dicoba

| No | Yang dicoba | Hasil | Tanggal lapor | Catatan |
|---|---|---|---|---|
| U1 | Semua tab Pengaturan terlihat tanpa digeser | OK | 18 Okt | |
| U2 | Panel rincian barang menutupi antrean saat barang disorot | OK | 18 Okt | Masukan: tombol X + pintasan, info penjualan (K-123) |
| U6 | Printer RPP02 lewat port COM keluar | OK | 18 Okt | Berhasil setelah disambungkan sebagai SPP Slave. Masukan: logo, cetak lebih pekat (K-124) |
| U8 | Cari barang lewat ciri (`pipa 3 inch putih`) dan pilihan kategori | OK | 18 Okt | Masukan: atribut dicocokkan sebagian, "1" menemukan 10, "c" menemukan cm (K-123) |
| U15 | **Mulai dari awal** (`F9`) di Order, Langsung, Pengantaran | OK | 18 Okt | |

---

## Riwayat

- 2026-10-18 — Dibuat atas permintaan pemilik: daftar uji 17 Oktober (U1–U17) dan shift baru K-121 (U18–U27).
- 2026-10-18 — U28–U34 order disimpan, kembali ke draf, peringatan draf lain (K-122).
