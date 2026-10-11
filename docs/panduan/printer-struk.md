# Panduan: Printer Struk Thermal (cetak langsung tanpa jendela cetak)

Status: Final v1 · 2026-10-11 · Keputusan terkait: K-103, K-105

Panduan ini untuk siapa pun yang menyiapkan komputer kasir. Contohnya memakai printer toko, **EPPOS RPP02**
(thermal 58 mm, Bluetooth) di **Windows 11**, tetapi berlaku untuk printer struk Bluetooth/USB-serial lain yang
memakai bahasa ESC/POS. Kerjakan dari atas ke bawah; tiap langkah menyebut hasil yang benar.

Petunjuk yang sama (versi ringkas per langkah) tampil di aplikasi: *Pengaturan › Struk & printer › Printer
struk komputer ini*.

## Daftar isi

1. [Dua cara mencetak struk, dan mana yang dipakai](#1-dua-cara-mencetak-struk-dan-mana-yang-dipakai)
2. [Yang harus siap](#2-yang-harus-siap)
3. [Langkah 1 — Pasangkan printer dengan Windows](#3-langkah-1--pasangkan-printer-dengan-windows)
4. [Langkah 2 — Pilih printer di peramban](#4-langkah-2--pilih-printer-di-peramban)
5. [Langkah 3 — Lebar kertas](#5-langkah-3--lebar-kertas)
6. [Langkah 4 — Uji cetak](#6-langkah-4--uji-cetak)
7. [Langkah 5 — Nyalakan cetak langsung dan cetak otomatis](#7-langkah-5--nyalakan-cetak-langsung-dan-cetak-otomatis)
8. [Pengaturan lanjutan](#8-pengaturan-lanjutan)
9. [Penjelasan teknis](#9-penjelasan-teknis)
10. [Daftar masalah dan jalan keluarnya](#10-daftar-masalah-dan-jalan-keluarnya)
11. [Cadangan: mencetak lewat jendela cetak](#11-cadangan-mencetak-lewat-jendela-cetak)

---

## 1. Dua cara mencetak struk, dan mana yang dipakai

| | **Cetak langsung** (dianjurkan) | Jendela cetak peramban |
|---|---|---|
| Yang dikirim ke printer | Teks + perintah printer (ESC/POS) | Gambar halaman lewat driver Windows |
| Jendela pratinjau | Tidak ada; struk keluar seketika | Selalu muncul (kecuali lewat `buka-kasir.cmd`) |
| Arah cetak | Selalu tegak (potret) | Tergantung ukuran kertas di driver; bisa menyamping |
| Ketajaman | Huruf bawaan printer: tajam dan hitam | Gambar titik: bisa pudar/putus-putus |
| Kerapian kolom | Lebar tetap 32/48 karakter, angka rata kanan | Tergantung skala dan margin |
| Butuh driver printer | Tidak | Ya |
| Peramban | Chrome atau Edge di komputer (bukan HP) | Semua |

Keluhan "tercetak menyamping, buram, dan berantakan" berasal dari cara kedua: driver `POS58 Printer` menerima
halaman sebagai gambar dan ukuran kertasnya tidak cocok. **Cetak langsung** menghilangkan ketiga masalah itu
karena tidak melewati driver sama sekali.

## 2. Yang harus siap

- Printer menyala, baterai terisi, gulungan kertas thermal terpasang (sisi mengilap menghadap kepala cetak).
- Komputer kasir memakai **Google Chrome** atau **Microsoft Edge** versi terbaru.
- Aplikasi dibuka dari alamat `http://localhost…` atau `https://…` (cetak langsung tidak tersedia di alamat
  `http://` biasa selain localhost; lihat `docs/panduan/fase-8-pasang-server.md` untuk HTTPS toko).
- Anda login sebagai Owner atau Admin (yang boleh membuka *Pengaturan*).

**Penting — pengaturan ini per komputer dan per jendela peramban.** Kerjakan di komputer kasir, di peramban
yang benar-benar dipakai untuk menjual. Bila kasir dibuka lewat `scripts/kasir/buka-kasir.cmd`, jendela itu
memakai profil peramban tersendiri: kerjakan panduan ini **di dalam jendela itu** (buka *Pengaturan* dari menu
di jendela yang sama).

## 3. Langkah 1 — Pasangkan printer dengan Windows

Cukup sekali per komputer.

1. Nyalakan printer (tahan tombol daya sampai lampu menyala).
2. Klik **Start** › **Setelan** (Settings) › **Bluetooth & perangkat**.
3. Pastikan sakelar **Bluetooth** di bagian atas **Aktif**.
4. Lihat daftar perangkat. Bila printer (mis. `RPP02` atau `RPP02N`) sudah ada dengan tulisan **Dipasangkan**
   (Paired), langkah ini selesai.
5. Bila belum: klik **Tambahkan perangkat** › **Bluetooth**. Tunggu nama printer muncul, klik.
6. Bila diminta PIN: ketik `0000`. Bila ditolak, `1234`. Tunggu sampai tertulis **Dipasangkan**.

Hasil yang benar: printer tampil di daftar perangkat sebagai *Dipasangkan*. Lampu Bluetooth printer mungkin
tetap berkedip; itu wajar, karena printer jenis ini baru tersambung saat ada yang dicetak lalu memutus lagi.

Saat dipasangkan, Windows membuat **port COM** untuk printer (mis. COM8 dan COM9). Driver `POS58 Printer` yang
sudah terpasang boleh dibiarkan; cetak langsung tidak memakainya.

Printer kabel USB: tidak perlu dipasangkan. Colokkan, nyalakan, lanjut ke Langkah 2.

## 4. Langkah 2 — Pilih printer di peramban

1. Buka aplikasi › *Pengaturan* › tab **Struk & printer** › gulir ke kartu **Printer struk komputer ini**.
2. Pada Langkah 2 tekan **Pilih printer…**.
3. Peramban menampilkan jendela kecil "…ingin terhubung ke port serial" berisi daftar. Daftar ini memuat
   **semua** perangkat serial di komputer, bukan hanya printer. Pada laptop toko daftarnya kira-kira:

   | Baris di daftar | Apa itu | Dipilih? |
   |---|---|---|
   | `SPP slave`, `Spp1`, `SerialPort`, `Standard Serial over Bluetooth link (COM…)`, atau `RPP02` | Sambungan serial ke perangkat Bluetooth; salah satunya printer | **Ya** |
   | `EM7455` (bisa muncul dua kali) | Modem seluler bawaan laptop | **Jangan** |
   | `Bluetooth Peripheral Device` | Port "masuk" buatan Windows; tidak bisa mencetak | **Jangan** |

4. Klik satu baris yang benar, lalu tekan **Hubungkan** (Connect).
5. Hasil yang benar: di aplikasi, *Terpilih sekarang* bertuliskan **Port serial (COM) Bluetooth atau kabel**
   (atau *Perangkat Bluetooth*), dan Langkah 2 bercentang hijau.

Bila tertulis **Salah pilih. Yang dipilih adalah modem seluler…**: Anda memilih `EM7455`. Tekan **Pilih printer
lain…** dan pilih baris lain.

**Cara pasti mengetahui baris mana printernya** (bila ada dua calon, mis. `SPP slave` dan `Spp1`):

1. **Setelan** › **Bluetooth & perangkat** › **Perangkat**.
2. Gulir ke bawah, klik **Setelan Bluetooth lainnya** (More Bluetooth settings).
3. Buka tab **Port COM**.
4. Cari baris yang kolom **Arah**-nya **Keluar** (Outgoing) dan kolom **Nama**-nya memuat nama printer, mis.
   `RPP02 'SPP slave'`. Teks di dalam tanda kutip (`SPP slave`) adalah nama baris yang harus dipilih di daftar
   peramban. Baris berarah **Masuk** (Incoming) adalah yang tampil sebagai `Bluetooth Peripheral Device`.

Peramban tidak memberi tahu aplikasi nama atau nomor COM port yang Anda pilih, jadi aplikasi tidak bisa
menampilkannya. Kepastiannya didapat dari uji cetak (Langkah 4). Salah pilih tidak merusak apa pun; tiap kali
memilih lagi, izin untuk pilihan lama dicabut otomatis sehingga tidak tertukar.

Daftarnya kosong? Printer belum dipasangkan atau Bluetooth komputer mati: ulangi Langkah 1.

## 5. Langkah 3 — Lebar kertas

1. Ukur lebar gulungan kertas dengan penggaris.
2. Pada **Lebar kertas / karakter per baris** pilih:
   - kertas 57 atau 58 mm (RPP02 dan printer genggam lain): **Kertas 57/58 mm (32 karakter per baris)**;
   - kertas 80 mm (printer meja besar): **Kertas 80 mm (48 karakter per baris)**.
3. Hasil yang benar: Langkah 3 bercentang.

Di kartu **Struk penjualan** (di atas, tab yang sama) ada juga **Lebar kertas struk**. Itu dipakai saat mencetak
lewat jendela cetak dan berlaku untuk semua komputer. Samakan dengan kertas toko (58 mm) lalu tekan **Simpan**.

## 6. Langkah 4 — Uji cetak

1. Tekan **Uji cetak**. Sambungan Bluetooth dibuat saat itu, jadi cetakan pertama bisa menunggu 3–10 detik.
2. Aplikasi bertanya **Apa yang keluar dari printer?** Jawab sesuai kenyataan:

| Jawaban | Arti | Yang dikerjakan |
|---|---|---|
| **Tercetak dan terbaca jelas** | Printer dan pengaturan benar | Selesai. Cetak langsung dinyalakan otomatis |
| **Tidak keluar apa-apa** | Yang dipilih di Langkah 2 bukan printernya, atau printer mati | Periksa lampu/kertas; kembali ke Langkah 2, **Pilih printer lain…**, pilih baris lain; uji lagi |
| **Keluar huruf acak** | Kecepatan port tidak cocok (printer kabel) | *Pengaturan lanjutan* › Kecepatan port: coba 115200, lalu 19200, 38400, 57600 |
| **Baris angka turun / ada ruang kosong** | Jumlah karakter per baris tidak cocok dengan kertas | Langkah 3: turun → pilih angka lebih kecil (32, lalu 30); ruang kosong → lebih besar (48) |
| **Tercetak tetapi pudar** | Baterai lemah, kertas jelek, atau cetak tebal mati | *Pengaturan lanjutan* › nyalakan **Cetak lebih tebal**; isi daya; ganti kertas |

Halaman uji yang benar terlihat seperti ini (kertas 58 mm):

```
           BonsaiUrip
        UJI CETAK STRUK
--------------------------------
32 karakter per baris. Baris
angka di bawah harus pas satu
baris, tidak turun.
12345678901234567890123456789012
--------------------------------
Cetak tebal: NYALA
Semen Gresik 40 kg
  2 sak x 55.000         110.000
TOTAL                 Rp 110.000
--------------------------------
Bila semua baris di atas terbaca
jelas dan tegak, printer siap
dipakai.
        11/10/2026 14:30
```

Nama toko di baris pertama dicetak dengan huruf besar (dua kali ukuran). Yang diperiksa: tulisan tegak (bukan
menyamping), baris `1234…` pas satu baris, angka rupiah rata kanan, garis putus-putus penuh selebar kertas.

Bila muncul kotak merah **Uji cetak tidak terkirim**, pesannya menyebut penyebab (printer tidak menjawab, port
tidak bisa dibuka). Lihat bagian 10.

## 7. Langkah 5 — Nyalakan cetak langsung dan cetak otomatis

1. Sakelar **Cetak struk langsung ke printer thermal** harus menyala (otomatis menyala setelah Anda menjawab
   "Tercetak dan terbaca jelas").
2. Gulir ke kartu **Struk penjualan** di atas. Pada **Cetak struk setelah bayar (penjualan langsung)** pilih:
   - **Langsung cetak**: struk keluar sendiri begitu pembayaran selesai, tanpa ditanya;
   - **Tanya dulu**: muncul pertanyaan, Enter = cetak, Esc = tidak;
   - **Tidak dicetak**: hanya dicetak bila tombol *Cetak struk* di layar hasil ditekan.
3. Tekan **Simpan** di kartu itu.
4. Uji sungguhan: buka *Penjualan Langsung*, jual satu barang, bayar. Struk harus keluar tanpa jendela apa pun.

Bila printer mati saat menjual, **penjualan tetap tersimpan**. Kasir melihat pemberitahuan "Struk tidak
tercetak: …" dengan tombol **Jendela cetak**; setelah printer menyala, struk bisa dicetak ulang dari layar hasil
(tombol *Cetak struk*) atau dari halaman *Detail Penjualan* (tombol **Cetak ulang struk**).

## 8. Pengaturan lanjutan

Di kartu yang sama, buka **Pengaturan lanjutan**:

| Pilihan | Bawaan | Kegunaan |
|---|---|---|
| Cetak lebih tebal | Nyala | Tiap titik dicetak dua kali (double-strike) agar hitam pekat. Matikan bila ingin lebih cepat/hemat baterai |
| Potong kertas otomatis | Nyala | Untuk printer berpemotong. RPP02 tidak punya pemotong dan mengabaikannya; sobek di gerigi |
| Buka laci uang | Mati | Laci yang tersambung ke printer terbuka saat struk penjualan tunai dicetak (bukan saat cetak ulang) |
| Kecepatan port (baud) | 9600 | Tidak berpengaruh pada Bluetooth. Hanya untuk printer kabel bila hasil uji huruf acak |

## 9. Penjelasan teknis

- **Jalur data.** Peramban membuka port serial lewat Web Serial API (`navigator.serial`), mengirim byte
  ESC/POS, lalu menutupnya. Printer Bluetooth memakai profil SPP (Serial Port Profile); Windows menampilkannya
  sebagai port COM virtual, dan sambungan radio dibuat saat port dibuka (*on-demand*). Karena itu port dibuka
  dan ditutup untuk tiap struk, dengan batas tunggu 15 detik dan jeda singkat sebelum ditutup agar ekor struk
  tidak terpotong. Kode: `apps/web/src/lib/printer-thermal.ts`.
- **Isi struk.** `packages/shared/src/escpos.ts` menyusun byte: `ESC @` (reset), `ESC V 0` (matikan putaran 90°,
  jadi selalu potret), `ESC M 0` (font A bawaan printer, 12×24 titik), `ESC G 1` (double-strike bila "Cetak lebih
  tebal" nyala), lalu baris teks ASCII selebar tepat 32/48 karakter. Kolom dibuat dengan spasi (nama di kiri,
  angka rata kanan), pemisah dengan 32/48 tanda `-`. Tidak ada gambar yang dikirim, jadi tidak ada yang bisa
  buram karena skala. Susunan struk: `apps/web/src/lib/struk-escpos.ts`.
- **Tanpa pratinjau.** Mencetak lewat jalur ini tidak memanggil `window.print()`, jadi peramban tidak punya
  jendela untuk ditampilkan. Izin memakai port diberikan sekali lewat jendela pemilih (Langkah 2) dan diingat
  peramban untuk alamat aplikasi itu.
- **Penyimpanan.** Pilihan di kartu ini (nyala/mati, lebar, tebal, potong, laci, baud) disimpan di peramban
  komputer itu (`localStorage`, kunci `tbsu:printer-struk`); ini preferensi perangkat, bukan data bisnis.
  Membersihkan data peramban menghapusnya dan izin portnya: ulangi Langkah 2–5.
- **Batas.** Logo toko tidak dicetak di jalur langsung (hanya teks). Huruf non-ASCII diganti padanannya
  (é → e). Invoice dan surat jalan A4 tetap lewat jendela cetak ke printer biasa.

## 10. Daftar masalah dan jalan keluarnya

| Gejala | Penyebab | Jalan keluar |
|---|---|---|
| "Peramban ini tidak bisa mencetak langsung" | Bukan Chrome/Edge, atau dibuka di HP/tablet, atau alamatnya `http://` bukan localhost | Pakai Chrome/Edge di komputer; buka lewat alamat HTTPS toko |
| Daftar port kosong | Printer belum dipasangkan; Bluetooth mati | Langkah 1 |
| Terpilih "Perangkat kabel USB (kode 1199:9075)" + peringatan merah | Yang dipilih modem laptop EM7455 | **Pilih printer lain…**, pilih `SPP slave`/`Spp1` |
| Uji cetak: tidak keluar apa-apa, tanpa pesan galat | Port yang dipilih bukan printer (data terkirim ke perangkat lain) | Langkah 2, pilih baris lain; pakai tab Port COM untuk memastikan |
| "Printer tidak menjawab dalam 15 detik" | Printer mati, baterai habis, terlalu jauh (>5–8 m), atau Bluetooth komputer mati | Nyalakan, dekatkan, isi daya; coba lagi |
| "Port printer tidak bisa dibuka" | Port sedang dipakai program lain | Tutup aplikasi printer bawaan; batalkan antrean cetak `POS58 Printer` (Setelan › Printer & pemindai › POS58 › Buka antrean cetak › batalkan semua); matikan-nyalakan printer |
| Huruf acak | Baud tidak cocok (printer kabel), atau printer bukan ESC/POS | Bagian 8; bila semua baud gagal, pakai jendela cetak |
| Baris turun / terpotong di kanan | Karakter per baris terlalu besar | Langkah 3: 32, lalu 30 |
| Cetakan pudar | Baterai lemah; kertas lama; cetak tebal mati; kepala cetak kotor | Isi daya; ganti kertas; nyalakan Cetak lebih tebal; bersihkan kepala cetak dengan kapas beralkohol saat printer mati |
| Struk berhenti di tengah | Baterai lemah atau printer menjauh saat mencetak | Isi daya; jangan pindahkan printer saat mencetak |
| Kemarin bisa, hari ini tidak keluar | Printer dinyalakan setelah aplikasi; atau printer dipasangkan ulang sehingga port berganti | Nyalakan printer dulu; ulangi Langkah 2 dan 4 |
| Sudah diatur, tetapi di jendela kasir (`buka-kasir.cmd`) tetap muncul jendela cetak | Pengaturan dibuat di jendela peramban lain (profil berbeda) | Ulangi Langkah 2–5 di dalam jendela kasir itu |
| Struk keluar dua kali | Cetak langsung nyala **dan** kasir menekan tombol Cetak struk | Wajar; cetakan kedua tercatat sebagai cetak ulang |

## 11. Cadangan: mencetak lewat jendela cetak

Dipakai bila cetak langsung tidak mungkin (peramban lain, printer bukan ESC/POS). Matikan sakelar **Cetak
struk langsung ke printer thermal**. Agar hasilnya tegak dan terbaca:

1. Pastikan driver printer terpasang (mis. `POS58 Printer`) dan muncul di **Setelan › Bluetooth & perangkat ›
   Printer & pemindai**.
2. Klik printer itu › **Preferensi pencetakan**: ukuran kertas **58 mm** (mis. `58(48) x 210 mm` atau
   `58 x 3276 mm`), orientasi **Potret**. Simpan.
3. Di aplikasi, kartu **Struk penjualan**: **Lebar kertas struk** = 58 mm, **Simpan**.
4. Saat jendela cetak muncul: **Tujuan** = printer struk; buka **Setelan lainnya**: **Margin** = Tidak ada,
   **Skala** = 100, hilangkan centang **Header dan footer**.
5. Agar jendela cetak tidak muncul sama sekali di jalur ini, jalankan kasir lewat
   `scripts/kasir/buka-kasir.cmd` (lihat `scripts/kasir/README.md`).

Struk di jalur ini dicetak dengan huruf tebal seluruhnya dan halaman yang selalu lebih tinggi daripada lebarnya,
supaya tidak dianggap lanskap oleh driver. Hasilnya tetap tidak setajam cetak langsung.

## Riwayat revisi

- 2026-10-11 — v1: panduan dibuat (K-105).
