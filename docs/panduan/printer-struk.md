# Panduan: Printer Struk Thermal (cetak langsung tanpa jendela cetak)

Status: Final v2 · 2026-10-17 · Keputusan terkait: K-103, K-105, K-115

Panduan ini untuk siapa pun yang menyiapkan komputer kasir, **apa pun merek printernya**. Berlaku untuk printer
struk thermal 58 mm atau 80 mm yang memakai bahasa perintah **ESC/POS**: hampir semua printer struk di pasaran,
misalnya EPPOS RPP02, POS-58, Xprinter, Panda, Iware, Epson TM, dan sejenisnya. Contoh layar memakai
**Windows 11**. Kerjakan dari atas ke bawah; setiap langkah menyebut hasil yang benar.

Petunjuk ringkas yang sama tampil di aplikasi: *Pengaturan › Struk & printer › Printer struk komputer ini*.

## Daftar isi

1. [Dua cara mencetak struk, dan mana yang dipakai](#1-dua-cara-mencetak-struk-dan-mana-yang-dipakai)
2. [Kenali printer Anda dulu](#2-kenali-printer-anda-dulu)
3. [Yang harus siap](#3-yang-harus-siap)
4. [Langkah 1A — Printer Bluetooth: pasangkan dan buat port COM keluar](#4-langkah-1a--printer-bluetooth-pasangkan-dan-buat-port-com-keluar)
5. [Langkah 1B — Printer kabel USB](#5-langkah-1b--printer-kabel-usb)
6. [Langkah 2 — Pilih printer di peramban](#6-langkah-2--pilih-printer-di-peramban)
7. [Langkah 3 — Lebar kertas](#7-langkah-3--lebar-kertas)
8. [Langkah 4 — Uji cetak](#8-langkah-4--uji-cetak)
9. [Langkah 5 — Nyalakan cetak langsung dan cetak otomatis](#9-langkah-5--nyalakan-cetak-langsung-dan-cetak-otomatis)
10. [Pengaturan lanjutan](#10-pengaturan-lanjutan)
11. [Penjelasan teknis](#11-penjelasan-teknis)
12. [Daftar masalah dan jalan keluarnya](#12-daftar-masalah-dan-jalan-keluarnya)
13. [Cadangan: mencetak lewat jendela cetak](#13-cadangan-mencetak-lewat-jendela-cetak)
14. [Catatan per merek](#14-catatan-per-merek)

---

## 1. Dua cara mencetak struk, dan mana yang dipakai

| | **Cetak langsung** (dianjurkan) | Jendela cetak peramban |
|---|---|---|
| Yang dikirim ke printer | Teks + perintah printer (ESC/POS) | Gambar halaman lewat driver Windows |
| Jendela pratinjau | Tidak ada; struk keluar seketika | Selalu muncul (kecuali lewat `buka-kasir.cmd`) |
| Arah cetak | Selalu tegak (potret) | Tergantung ukuran kertas di driver; bisa menyamping |
| Ketajaman | Huruf bawaan printer: tajam dan hitam | Gambar titik: bisa pudar/putus-putus |
| Butuh driver printer | **Tidak** | Ya |
| Peramban | Chrome atau Edge di komputer (bukan HP/tablet) | Semua |

**Cetak langsung tidak butuh driver printer.** Karena itu tulisan *Driver is unavailable* (*Driver tidak
tersedia*) di bawah nama printer pada Setelan Windows **tidak menjadi masalah**. Yang dibutuhkan hanya sebuah
**port COM** untuk printer itu (Langkah 1).

## 2. Kenali printer Anda dulu

Lihat label di bawah printer, kotaknya, atau buku petunjuknya, lalu cocokkan:

| Ciri printer | Jalur yang dipakai | Langkah |
|---|---|---|
| Bluetooth "biasa" (Bluetooth 2.x/4.x SPP, dipasangkan dengan PIN `0000`/`1234`), mis. RPP02, POS-58 BT | Cetak langsung lewat port COM Bluetooth | 1A |
| Kabel USB, dan di *Device Manager* muncul di **Ports (COM & LPT)** | Cetak langsung lewat port COM USB | 1B |
| Kabel USB, tetapi hanya muncul di **Printers** / **Print queues** (tidak ada port COM) | Pasang driver *USB virtual COM* dari pembuatnya, lalu cetak langsung; bila tidak ada, jendela cetak | 1B |
| Hanya **Bluetooth Low Energy** / hanya bisa dipakai lewat aplikasi HP (banyak printer mini "label"/"sticker") | Tidak bisa cetak langsung dari komputer | 13 |
| Printer kertas A4 biasa (tinta/laser) | Tidak untuk struk; hanya invoice, surat jalan, laporan | — |

Tidak yakin? Kerjakan Langkah 1A sampai butir 6. Bila Windows bisa membuat **port COM keluar** untuk printer
itu, printer Anda bisa dipakai cetak langsung.

## 3. Yang harus siap

- Printer menyala, baterai terisi, gulungan kertas thermal terpasang (sisi mengilap menghadap kepala cetak).
  Tes cepat: matikan printer, tahan tombol *Feed* (FEED/↑) sambil menyalakan; kebanyakan printer mencetak
  halaman uji sendiri. Bila halaman uji keluar, printernya sehat.
- Komputer kasir memakai **Google Chrome** atau **Microsoft Edge** versi terbaru.
- Aplikasi dibuka dari alamat `http://localhost…` atau `https://…` (cetak langsung tidak tersedia di alamat
  `http://` biasa selain localhost).
- Anda login sebagai Owner atau Admin (yang boleh membuka *Pengaturan*).

**Pengaturan ini per komputer dan per jendela peramban.** Kerjakan di komputer kasir, di peramban yang
benar-benar dipakai untuk menjual. Bila kasir dibuka lewat `scripts/kasir/buka-kasir.cmd`, kerjakan panduan ini
**di dalam jendela itu**.

## 4. Langkah 1A — Printer Bluetooth: pasangkan dan buat port COM keluar

Cukup sekali per komputer.

**Pasangkan:**

1. Nyalakan printer (tahan tombol daya sampai lampu menyala).
2. Klik **Start** › **Setelan** (Settings) › **Bluetooth & perangkat**. Pastikan sakelar **Bluetooth** **Aktif**.
3. Bila printer belum ada di daftar: klik **Tambahkan perangkat** › **Bluetooth**. Tunggu nama printer muncul
   (biasanya nama modelnya, mis. `RPP02`, `RPP02N`, `BlueTooth Printer`, `MTP-II`, `Printer001`), lalu klik.
4. Bila diminta PIN: ketik `0000`. Bila ditolak, `1234`. Tunggu sampai printer tercantum di daftar.
5. Di **Bluetooth & perangkat › Perangkat**, printer mungkin bertuliskan *Driver is unavailable* atau tampil
   di bagian *Other devices*. **Biarkan.** Jangan klik *Remove*.

**Buat port COM keluar** (langkah yang paling sering terlewat; tanpa ini printer tidak muncul di Langkah 2):

6. Masih di **Bluetooth & perangkat › Perangkat**, gulir ke paling bawah, klik **Setelan Bluetooth lainnya**
   (*More Bluetooth settings*). Jendela kecil *Bluetooth Settings* terbuka.
7. Buka tab **Port COM** (*COM Ports*).
8. Lihat tabelnya:
   - Ada baris berarah **Keluar** (*Outgoing*) yang kolom namanya memuat nama printer (mis.
     `RPP02 'Serial Port'` atau `RPP02 'SPP slave'`)? Catat nomornya (mis. **COM5**) dan lanjut ke Langkah 2.
   - Tidak ada? Klik **Tambah…** (*Add…*) › pilih **Keluar** (*Outgoing*) › pada daftar
     **Perangkat yang akan memakai port COM** pilih printer Anda › (bila ada pilihan layanan, pilih
     **Serial Port** / **SPP**) › **OK**. Tunggu beberapa detik sampai baris baru muncul, lalu **OK**.
     Catat nomornya.
9. Baris berarah **Masuk** (*Incoming*) **tidak dipakai** untuk mencetak; boleh dibiarkan.

Hasil yang benar: tab Port COM memuat satu baris **Keluar** dengan nama printer Anda.

Bila daftar perangkat di butir 8 tidak memuat printer Anda, atau muncul pesan bahwa perangkat tidak mendukung
port serial, printer itu kemungkinan hanya **Bluetooth Low Energy** (lihat bagian 2): pakai jendela cetak
(bagian 13) atau printer lain.

**Tentang "tersambung terus":** printer Bluetooth jenis ini **tidak perlu tersambung terus**. Lampunya boleh
tetap berkedip. Setiap kali struk dicetak, aplikasi membuka port COM itu; Windows menyambungkan printer dalam
1–5 detik, struk dikirim, lalu sambungan dilepas lagi. Pilihan printer diingat peramban, jadi kasir tidak perlu
melakukan apa-apa: struk otomatis ke printer itu.

## 5. Langkah 1B — Printer kabel USB

1. Colokkan kabel USB printer ke komputer dan nyalakan printer.
2. Klik kanan **Start** › **Device Manager** (Pengelola Perangkat).
3. Buka **Ports (COM & LPT)**. Ada baris baru, mis. `USB-SERIAL CH340 (COM3)` atau `USB Serial Device (COM4)`,
   yang muncul saat printer dicolokkan? Bila ya, lanjut ke Langkah 2 dan pilih baris itu.
4. Bila printer hanya muncul di **Printers** / **Print queues** dan tidak ada di **Ports (COM & LPT)**: printer
   memakai jalur USB-printer, bukan serial. Cari di CD/situs pembuatnya driver bernama *virtual COM*,
   *USB to COM*, atau *VCP*; setelah dipasang, ulangi butir 3. Bila tidak tersedia, pakai jendela cetak
   (bagian 13).

## 6. Langkah 2 — Pilih printer di peramban

1. Buka aplikasi › *Pengaturan* › tab **Struk & printer** › kartu **Printer struk komputer ini**.
2. Pada Langkah 2 tekan **Pilih printer…**.
3. Peramban menampilkan jendela kecil "…ingin terhubung ke port serial". Daftar ini memuat **semua** port
   serial di komputer, bukan hanya printer:

   | Baris di daftar | Apa itu | Dipilih? |
   |---|---|---|
   | `Standard Serial over Bluetooth link (COM5)` dengan nomor COM dari Langkah 1A | Port keluar ke printer Bluetooth | **Ya** |
   | `SPP slave`, `Spp1`, `SerialPort`, atau nama printer | Nama lain port printer Bluetooth (tergantung merek) | **Ya** |
   | `USB-SERIAL CH340 (COM3)`, `USB Serial Device (COM4)` | Printer kabel (Langkah 1B) | **Ya** (printer kabel) |
   | `EM7455`, nama berbau *modem*/*WWAN*/*LTE* | Modem seluler laptop | **Jangan** |
   | `Bluetooth Peripheral Device` | Port *Masuk* Windows; tidak bisa mencetak | **Jangan** |

4. Klik satu baris yang benar, lalu **Hubungkan** (Connect).
5. Hasil yang benar: *Terpilih sekarang* bertuliskan **Port serial (COM) Bluetooth atau kabel** (atau
   *Perangkat Bluetooth*), dan Langkah 2 bercentang hijau.

Ada dua calon baris? Pilih salah satu, lanjut Uji cetak (Langkah 4); bila kertas tidak keluar, kembali dan pilih
yang lain. Salah pilih tidak merusak apa pun; tiap kali memilih lagi, izin pilihan lama dicabut otomatis.

Daftarnya kosong atau printer tidak ada? Port COM keluar belum dibuat (Langkah 1A butir 6–8) atau Bluetooth
komputer mati.

## 7. Langkah 3 — Lebar kertas

1. Ukur lebar gulungan kertas dengan penggaris.
2. Pada **Lebar kertas / karakter per baris** pilih **Kertas 57/58 mm (32 karakter per baris)** atau
   **Kertas 80 mm (48 karakter per baris)**.
3. Di kartu **Struk penjualan** (tab yang sama) samakan **Lebar kertas struk** lalu **Simpan** (dipakai saat
   mencetak lewat jendela cetak).

## 8. Langkah 4 — Uji cetak

1. Tekan **Uji cetak**. Cetakan pertama bisa menunggu 3–10 detik (sambungan Bluetooth dibuat saat itu).
2. Aplikasi bertanya **Apa yang keluar dari printer?** Jawab sesuai kenyataan:

| Jawaban | Arti | Yang dikerjakan |
|---|---|---|
| **Tercetak dan terbaca jelas** | Printer dan pengaturan benar | Selesai. Cetak langsung dinyalakan otomatis |
| **Tidak keluar apa-apa** | Yang dipilih di Langkah 2 bukan printernya, atau printer mati | Periksa lampu/kertas; Langkah 2, **Pilih printer lain…**, pilih baris lain; uji lagi |
| **Keluar huruf acak** | Kecepatan port tidak cocok (printer kabel), atau printer bukan ESC/POS | *Pengaturan lanjutan* › Kecepatan port: coba 115200, lalu 19200, 38400, 57600 |
| **Baris angka turun / ada ruang kosong** | Karakter per baris tidak cocok dengan kertas | Langkah 3: turun → angka lebih kecil (32, lalu 30); ruang kosong → lebih besar (48) |
| **Tercetak tetapi pudar** | Baterai lemah, kertas jelek, atau cetak tebal mati | *Pengaturan lanjutan* › **Cetak lebih tebal**; isi daya; ganti kertas |

Halaman uji yang benar (kertas 58 mm):

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
        17/10/2026 14:30
```

## 9. Langkah 5 — Nyalakan cetak langsung dan cetak otomatis

1. Sakelar **Cetak struk langsung ke printer thermal** menyala (otomatis setelah Anda menjawab "Tercetak dan
   terbaca jelas").
2. Kartu **Struk penjualan** › **Cetak struk setelah bayar**: **Langsung cetak**, **Tanya dulu** (Enter = cetak,
   Esc = tidak), atau **Tidak dicetak**. Tekan **Simpan**.
3. Uji sungguhan: *Penjualan Langsung*, jual satu barang, bayar. Struk keluar tanpa jendela apa pun.

Bila printer mati saat menjual, **penjualan tetap tersimpan**. Kasir melihat pemberitahuan "Struk tidak
tercetak: …" dengan tombol **Jendela cetak**; setelah printer menyala, struk bisa dicetak ulang dari layar hasil
atau dari halaman *Detail Penjualan* (**Cetak ulang struk**).

## 10. Pengaturan lanjutan

| Pilihan | Bawaan | Kegunaan |
|---|---|---|
| Cetak lebih tebal | Nyala | Tiap titik dicetak dua kali agar hitam pekat. Matikan bila ingin lebih cepat/hemat baterai |
| Potong kertas otomatis | Nyala | Untuk printer berpemotong. Printer tanpa pemotong mengabaikannya; sobek di gerigi |
| Buka laci uang | Mati | Laci yang tersambung ke printer terbuka saat struk penjualan tunai dicetak |
| Kecepatan port (baud) | 9600 | Tidak berpengaruh pada Bluetooth. Untuk printer kabel bila hasil uji huruf acak |

## 11. Penjelasan teknis

- **Jalur data.** Peramban membuka port serial lewat Web Serial API (`navigator.serial`), mengirim byte
  ESC/POS, lalu menutupnya. Printer Bluetooth memakai profil SPP (Serial Port Profile); Windows menampilkannya
  sebagai **port COM virtual berarah keluar**, dan sambungan radio dibuat saat port dibuka (*on-demand*). Port
  dibuka dan ditutup untuk tiap struk, dengan batas tunggu 15 detik. Kode: `apps/web/src/lib/printer-thermal.ts`.
- **Mengapa tidak butuh driver.** Driver printer Windows mengubah halaman menjadi gambar untuk dicetak. Cetak
  langsung tidak melewati driver: yang dikirim adalah teks dan perintah ESC/POS ke port COM, sehingga status
  *Driver is unavailable* tidak berpengaruh.
- **Mengapa port COM keluar kadang harus dibuat sendiri.** Windows 11 tidak selalu membuat port COM untuk
  perangkat Bluetooth yang dikenalnya sebagai "printer"; yang dibuat kadang hanya port *Masuk*. Port *Keluar*
  (komputer yang memulai sambungan) itulah yang dipakai untuk mencetak.
- **Isi struk.** `packages/shared/src/escpos.ts` menyusun byte: `ESC @` (reset), `ESC V 0` (selalu potret),
  `ESC M 0` (font A), `ESC G 1` (cetak tebal), lalu baris teks ASCII selebar tepat 32/48 karakter.
- **Penyimpanan.** Pilihan di kartu printer disimpan di peramban komputer itu (`localStorage`, kunci
  `tbsu:printer-struk`): preferensi perangkat, bukan data bisnis. Izin port diingat peramban untuk alamat
  aplikasi itu. Membersihkan data peramban menghapus keduanya: ulangi Langkah 2–5.
- **Batas.** Logo toko tidak dicetak di jalur langsung (hanya teks). Huruf non-ASCII diganti padanannya.

## 12. Daftar masalah dan jalan keluarnya

| Gejala | Penyebab | Jalan keluar |
|---|---|---|
| *Driver is unavailable* di Setelan Windows | Windows tidak punya driver printer untuk model itu | **Abaikan.** Pastikan port COM **Keluar** sudah dibuat (Langkah 1A butir 6–8) |
| Printer tidak muncul di daftar Langkah 2 | Belum ada port COM keluar | Langkah 1A butir 6–8 |
| Tombol **Tambah…** di tab Port COM tidak menampilkan printer | Printer belum dipasangkan, mati, atau hanya Bluetooth Low Energy | Nyalakan, pasangkan ulang (butir 3–4); bila tetap tidak ada, lihat bagian 2 |
| "Peramban ini tidak bisa mencetak langsung" | Bukan Chrome/Edge, dibuka di HP/tablet, atau alamat `http://` bukan localhost | Pakai Chrome/Edge di komputer; alamat HTTPS toko |
| Uji cetak: tidak keluar apa-apa, tanpa pesan galat | Port yang dipilih bukan printer | Langkah 2, pilih baris lain; cocokkan nomor COM dengan tab Port COM |
| "Printer tidak menjawab dalam 15 detik" | Printer mati, baterai habis, terlalu jauh (>5–8 m), atau Bluetooth komputer mati | Nyalakan, dekatkan, isi daya; coba lagi |
| "Port printer tidak bisa dibuka" | Port sedang dipakai program lain (aplikasi printer bawaan, antrean cetak driver) | Tutup aplikasi printer lain; batalkan antrean cetak di *Printer & pemindai*; matikan-nyalakan printer |
| Huruf acak | Baud tidak cocok (kabel), atau printer bukan ESC/POS | Bagian 10; bila semua baud gagal, jendela cetak |
| Baris turun / terpotong di kanan | Karakter per baris terlalu besar | Langkah 3: 32, lalu 30 |
| Cetakan pudar | Baterai lemah; kertas lama; cetak tebal mati; kepala cetak kotor | Isi daya; ganti kertas; Cetak lebih tebal; bersihkan kepala cetak dengan kapas beralkohol saat printer mati |
| Kemarin bisa, hari ini tidak keluar | Printer dipasangkan ulang sehingga nomor COM berganti, atau data peramban dibersihkan | Ulangi Langkah 1A butir 6–8, lalu Langkah 2 dan 4 |
| Di jendela kasir (`buka-kasir.cmd`) tetap muncul jendela cetak | Pengaturan dibuat di jendela peramban lain | Ulangi Langkah 2–5 di dalam jendela kasir itu |
| Struk keluar dua kali | Cetak langsung nyala **dan** tombol Cetak struk ditekan | Wajar; cetakan kedua tercatat sebagai cetak ulang |

## 13. Cadangan: mencetak lewat jendela cetak

Dipakai bila cetak langsung tidak mungkin (peramban lain, printer tanpa port COM, printer Bluetooth Low Energy).
Matikan sakelar **Cetak struk langsung ke printer thermal**, lalu:

1. Pasang driver printer dari pembuatnya sampai printer muncul di **Setelan › Bluetooth & perangkat ›
   Printer & pemindai**.
2. Klik printer itu › **Preferensi pencetakan**: ukuran kertas 58 mm atau 80 mm, orientasi **Potret**. Simpan.
3. Di aplikasi, kartu **Struk penjualan**: **Lebar kertas struk** sesuai kertas, **Simpan**.
4. Saat jendela cetak muncul: **Tujuan** = printer struk; **Setelan lainnya**: **Margin** = Tidak ada,
   **Skala** = 100, hilangkan centang **Header dan footer**.
5. Agar jendela cetak tidak muncul, jalankan kasir lewat `scripts/kasir/buka-kasir.cmd`.

## 14. Catatan per merek

Bagian ini diisi setiap kali sebuah merek berhasil diuji di toko. Langkah 1–5 di atas tetap berlaku.

| Merek / model | Sambungan | Catatan |
|---|---|---|
| EPPOS RPP02 / RPP02N (58 mm) | Bluetooth SPP, PIN `0000` | Windows 11 menampilkan *Driver is unavailable*: wajar. Port COM keluar harus dibuat lewat Langkah 1A butir 6–8. Tanpa pemotong kertas. Status uji di toko: belum diuji (17 Okt 2026). |
| Printer berlabel POS-58 / "BlueTooth Printer" (58 mm) | Bluetooth SPP, PIN `0000`/`1234` | Sama dengan RPP02. |
| Epson TM-T82 / TM-T20 (80 mm) | USB | Driver Epson memasang antrean printer, bukan port COM; pasang *TM Virtual Port Driver* dari Epson agar muncul port COM, atau pakai jendela cetak. |

## Riwayat revisi

- 2026-10-11 — v1: panduan dibuat (K-105), contoh EPPOS RPP02.
- 2026-10-17 — v2: dibuat umum untuk semua printer ESC/POS; langkah membuat port COM keluar (penyebab printer
  tidak muncul saat Windows menulis *Driver is unavailable*); printer kabel USB; tabel cara mengenali printer;
  catatan per merek (K-115).
