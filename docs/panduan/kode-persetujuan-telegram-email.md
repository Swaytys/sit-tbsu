# Panduan: Menyiapkan Kode Persetujuan lewat Telegram dan Email

Status: Final v1 · 2026-10-11 · Keputusan terkait: K-102, K-105

Panduan ini untuk Owner/Admin. Tujuannya: saat kasir meminta persetujuan (retur, void, penjualan yang
melewati limit kredit), sistem mengirim **kode 6 angka** ke Telegram dan/atau email Anda. Semua langkah
ditulis berurutan dan lengkap; kerjakan dari atas ke bawah. Tidak perlu menyiapkan keduanya: **satu saluran
sudah cukup**, dua saluran lebih aman bila salah satunya bermasalah.

Petunjuk yang sama (versi ringkas per langkah) tampil di aplikasi: *Pengaturan › Persetujuan*.

## Daftar isi

1. [Gambaran: siapa mengirim apa ke siapa](#1-gambaran-siapa-mengirim-apa-ke-siapa)
2. [Telegram](#2-telegram)
3. [Email (Gmail)](#3-email-gmail)
4. [Atasan lain (Admin/Owner kedua, ketiga, …)](#4-atasan-lain-adminowner-kedua-ketiga-)
5. [Mencoba alur sungguhan dari layar kasir](#5-mencoba-alur-sungguhan-dari-layar-kasir)
6. [Penjelasan teknis: cara akun dihubungkan dengan Telegram](#6-penjelasan-teknis-cara-akun-dihubungkan-dengan-telegram)
7. [Uji mandiri tanpa aplikasi (skrip dan curl)](#7-uji-mandiri-tanpa-aplikasi-skrip-dan-curl)
8. [Daftar masalah dan jalan keluarnya](#8-daftar-masalah-dan-jalan-keluarnya)

---

## 1. Gambaran: siapa mengirim apa ke siapa

Ada **dua jenis isian** yang sering tertukar. Keduanya wajib, dan letaknya berbeda:

| Isian | Milik siapa | Diisi di mana | Diisi oleh | Berapa kali |
|---|---|---|---|---|
| **Akun pengirim**: token bot Telegram, akun Gmail + sandi aplikasi | Toko | *Pengaturan › Persetujuan*, Langkah 1 tiap saluran | Owner/Admin, satu orang saja | Sekali untuk seluruh toko |
| **Kontak penerima**: Telegram dan alamat email tiap atasan | Tiap Admin/Owner | *Pengaturan › Persetujuan* Langkah 2, atau menu akun › *Akun saya* | **Masing-masing** atasan, dengan akunnya sendiri | Sekali per orang |

Perumpamaannya: akun pengirim adalah **kantor pos** toko; kontak penerima adalah **alamat rumah** tiap atasan.
Kantor pos tanpa alamat tujuan tidak bisa mengirim apa pun. Itulah sebabnya lencana "Bot aktif" atau "Akun
pengirim tersimpan" saja belum membuat kode terkirim: lencana itu hanya berarti kantor posnya ada.

Tiap saluran selesai bila **tiga langkahnya bercentang hijau**:

1. Akun pengirim toko terisi.
2. Kontak Anda (penerima) terisi.
3. Pesan uji benar-benar sampai.

Syarat umum: komputer server (yang menjalankan aplikasi) tersambung internet.

---

## 2. Telegram

### Langkah 1 — Buat bot toko dan isi tokennya

Bot adalah akun Telegram otomatis milik toko yang bertugas mengirim kode. Membuatnya gratis, sekitar 3 menit.

1. Buka aplikasi **Telegram** di HP atau komputer.
2. Di kolom pencarian (ikon kaca pembesar) ketik `BotFather`. Pilih akun bernama **BotFather** yang bercentang
   biru (akun resmi Telegram untuk membuat bot).
3. Tekan tombol **Start** (atau **Mulai**) di bagian bawah.
4. Kirim pesan: `/newbot`
5. BotFather bertanya nama bot. Ketik nama bebas, misalnya `Persetujuan Sumber Urip`, lalu kirim.
6. BotFather bertanya *username* bot. Aturannya: tanpa spasi, hanya huruf/angka/garis bawah, dan **harus
   diakhiri `bot`**. Contoh: `sumberurip_setuju_bot`. Bila dijawab "sudah dipakai", coba nama lain.
7. BotFather membalas dengan pesan panjang yang memuat **token**, bentuknya angka, titik dua, lalu huruf acak:
   `1234567890:AAHkExampleExampleExampleExample`. Tekan token itu untuk menyalinnya (salin seluruhnya, dari
   angka pertama sampai huruf terakhir).
8. Di aplikasi BonsaiUrip: buka *Pengaturan › Persetujuan*. Pada kartu **Telegram**, Langkah 1, tempel token
   di kolom **Token bot**, lalu tekan **Simpan token**.
9. Hasil yang benar: lencana di kanan atas kartu menjadi **Bot aktif · @nama_bot_anda**, dan lingkaran
   Langkah 1 berubah menjadi centang hijau.

Bila muncul "Token bot tidak dikenal Telegram": token tidak tersalin utuh. Salin ulang dari BotFather (kirim
`/mybots` › pilih botnya › **API Token**).

> Token adalah kunci bot. Siapa pun yang memegangnya bisa mengirim pesan atas nama bot. Jangan dibagikan dan
> jangan difoto. Bila bocor: di BotFather kirim `/revoke`, pilih botnya, lalu isi token barunya di aplikasi.
> Aplikasi tidak pernah menampilkan kembali token yang sudah disimpan.

### Langkah 2 — Hubungkan Telegram Anda ke bot

Ini langkah yang paling sering terlewat. **Telegram melarang bot mengirim pesan kepada orang yang belum
pernah menekan Start pada bot itu** (aturan anti-spam Telegram, tidak bisa diakali). Jadi selain token, sistem
harus tahu Telegram mana yang milik akun Anda, dan Anda harus pernah "menyapa" bot itu.

1. Pastikan Anda login di BonsaiUrip dengan **akun Anda sendiri** (nama di kanan atas). Kode nanti dikirim ke
   Telegram orang yang mengerjakan langkah ini.
2. Di kartu Telegram, Langkah 2, tekan **Hubungkan Telegram saya**.
3. Muncul kotak berisi empat langkah (a–d) dan sebuah **kode 10 karakter**, misalnya `3F9A1C7B2E`. Kode ini
   berlaku 10 menit dan hanya untuk akun Anda.
4. **(a) Buka bot toko di Telegram.**
   - Telegram ada di komputer yang sama: klik tautan **buka @nama_bot** di kotak itu.
   - Telegram ada di HP: buka Telegram di HP, ketik nama bot (yang tertulis di kotak, mis. `@testtbsubot`) di
     kolom pencarian, lalu pilih bot itu.
5. **(b) Tekan Start, lalu kirim kodenya.** Di layar percakapan bot tekan tombol **Start**/**Mulai** di bagian
   bawah. Setelah itu ketik (atau tempel; ada tombol **Salin kode** di aplikasi) kode 10 karakter tadi sebagai
   pesan biasa, lalu kirim. Bot **tidak membalas** pada tahap ini; itu wajar.
6. **(c) Tunggu sekitar 5 detik** sampai pesan Anda bercentang di Telegram.
7. **(d) Kembali ke BonsaiUrip dan tekan Periksa.**
8. Hasil yang benar: kotak berubah menjadi hijau **Telegram Anda sudah terhubung dengan bot toko**, Langkah 2
   bercentang, dan bot mengirim pesan sambutan "Terhubung dengan akun … di BonsaiUrip" ke Telegram Anda.

Bila muncul "Pesan dari Anda belum terbaca bot": kode belum terkirim, terkirim ke bot yang salah, atau sudah
lewat 10 menit. Periksa nama botnya, kirim ulang kodenya, tunggu beberapa detik, tekan **Periksa** lagi. Bila
sudah lewat 10 menit, tekan **buat kode baru** di kotak itu dan ulangi dari (b).

### Langkah 3 — Kirim pesan uji Telegram

1. Tekan **Kirim pesan uji Telegram**.
2. Hasil yang benar: kotak hijau "Berhasil. Pesan uji terkirim…", dan di Telegram Anda masuk pesan
   "BonsaiUrip: pesan uji".
3. Bila kotaknya merah, pesannya menyebut tepat apa yang kurang:
   - "Token bot belum diisi" → kerjakan Langkah 1.
   - "…belum dihubungkan ke bot itu" → kerjakan Langkah 2.
   - "Telegram tidak bisa dihubungi" → internet komputer server mati atau Telegram diblokir jaringan.
   - "bot was blocked by the user" / "chat not found" → Anda memblokir bot atau menghapus percakapannya.
     Buka blokir, tekan **Putuskan** di Langkah 2, lalu hubungkan lagi.

Tombol ini **hanya** menguji Telegram dan selalu mengirim pesan sungguhan. Email diuji dengan tombolnya
sendiri.

---

## 3. Email (Gmail)

Sistem mengirim email lewat akun Gmail toko. Google **tidak menerima password Gmail biasa** dari aplikasi;
yang dipakai adalah **Sandi aplikasi** (App password): sandi khusus 16 huruf yang dibuat Google untuk satu
aplikasi. Sandi aplikasi hanya tersedia bila **Verifikasi 2 Langkah** akun itu aktif.

Saran: buat satu akun Gmail khusus toko (mis. `sumberurip.toko@gmail.com`) sebagai pengirim, supaya tidak
bercampur dengan email pribadi.

### Langkah 1 — Isi akun email pengirim

**A. Aktifkan Verifikasi 2 Langkah** (lewati bila sudah aktif)

1. Di peramban, login ke akun Gmail yang akan menjadi pengirim.
2. Buka <https://myaccount.google.com/security> (atau: klik foto profil di kanan atas Gmail › **Kelola Akun
   Google** › tab **Keamanan**).
3. Gulir ke bagian **Cara Anda login ke Google**. Klik **Verifikasi 2 Langkah**.
4. Tekan **Aktifkan Verifikasi 2 Langkah** (atau **Mulai**). Google meminta password Gmail Anda lagi.
5. Masukkan nomor HP Anda, pilih menerima kode lewat **SMS**, tekan **Berikutnya**.
6. Ketik kode 6 angka dari SMS, tekan **Berikutnya**, lalu **Aktifkan**.
7. Hasil yang benar: di tab Keamanan, Verifikasi 2 Langkah bertuliskan **Aktif** beserta tanggalnya.

Mulai sekarang, login Gmail di perangkat baru akan meminta kode dari HP itu. Itu wajar dan membuat akun lebih
aman.

**B. Buat Sandi aplikasi**

1. Buka <https://myaccount.google.com/apppasswords>. Bila tautan tidak terbuka: buka halaman Akun Google, klik
   kotak pencarian di bagian atas, ketik `Sandi aplikasi` (atau `App passwords`), pilih hasilnya.
2. Google bisa meminta password Gmail Anda lagi. Masukkan.
3. Di kolom **Nama aplikasi** ketik `BonsaiUrip` (nama ini hanya label agar Anda ingat untuk apa).
4. Tekan **Buat**.
5. Muncul kotak **Sandi aplikasi yang dibuat** berisi **16 huruf dalam empat kelompok**, misalnya
   `abcd efgh ijkl mnop`. **Salin sekarang**: Google hanya menampilkannya sekali.
6. Tekan **Selesai**.

Bila halaman itu menulis *"Setelan yang Anda cari tidak tersedia untuk akun Anda"*:

- Verifikasi 2 Langkah belum aktif → kerjakan bagian A, tunggu 1–2 menit, buka lagi.
- Akun itu akun kantor/sekolah (Google Workspace) yang dikunci pengelolanya → pakai akun Gmail pribadi.
- Akun memakai Perlindungan Lanjutan (Advanced Protection) → fitur ini dimatikan Google; pakai akun lain.

**C. Isi di aplikasi**

1. Buka *Pengaturan › Persetujuan*, kartu **Email**, Langkah 1.
2. Isi kolom persis seperti ini:

   | Kolom | Isi |
   |---|---|
   | Server | `smtp.gmail.com` |
   | Port | `465` |
   | Nama pengguna (alamat Gmail pengirim) | alamat Gmail lengkap, mis. `sumberurip.toko@gmail.com` |
   | Sandi aplikasi (16 huruf) | 16 huruf dari bagian B, dengan atau tanpa spasi |
   | Nama pengirim (opsional) | boleh kosong, atau `BonsaiUrip <sumberurip.toko@gmail.com>` |

3. Tekan **Simpan akun email**.
4. Hasil yang benar: lencana kartu menjadi **Akun pengirim tersimpan** dan Langkah 1 bercentang. Bila lencana
   masih kuning, tulisannya menyebut kolom yang masih kosong, mis. *Belum lengkap: sandi aplikasi kosong*.

Kolom sandi selalu tampil kosong setelah disimpan (tertulis "Tersimpan"): aplikasi tidak pernah menampilkan
kembali sandi yang sudah disimpan. Kosongkan bila tidak ingin menggantinya.

### Langkah 2 — Isi alamat email Anda (penerima kode)

1. Di kartu Email, Langkah 2, isi **Alamat email Anda (tempat kode diterima)**. Pakai alamat yang Anda buka di
   HP supaya kode cepat terbaca. Boleh sama dengan alamat pengirim toko.
2. Tekan **Simpan**. Langkah 2 bercentang.

### Langkah 3 — Kirim email uji

1. Tekan **Kirim email uji**. Tunggu sampai 10 detik.
2. Hasil yang benar: kotak hijau "Berhasil. Email uji terkirim ke …". Buka kotak masuk alamat itu; bila tidak
   ada, lihat folder **Spam** dan tandai "Bukan spam".
3. Bila kotaknya merah, pesannya menyebut penyebabnya:
   - "Akun email pengirim belum lengkap (… masih kosong)" → lengkapi Langkah 1.
   - "…belum punya alamat email penerima" → kerjakan Langkah 2.
   - "Server email menolak nama pengguna atau sandi" → yang diisi password Gmail biasa, sandi aplikasi salah
     salin, atau Verifikasi 2 Langkah dimatikan lagi (mematikannya menghapus semua sandi aplikasi). Buat sandi
     aplikasi baru (bagian B) dan simpan ulang.
   - "Server email tidak bisa dihubungi" → internet mati, atau jaringan memblokir port 465.

---

## 4. Atasan lain (Admin/Owner kedua, ketiga, …)

Langkah 1 tiap saluran cukup dikerjakan sekali oleh satu orang. **Langkah 2 wajib dikerjakan tiap atasan
dengan akunnya sendiri**, karena kode dikirim ke orang, bukan ke toko:

1. Atasan itu login ke BonsaiUrip dengan akunnya sendiri (di HP atau komputer mana pun yang bisa membuka
   aplikasi).
2. Klik namanya di kanan atas › **Akun saya**.
3. Pada kartu **Penerima kode persetujuan**: tekan **Hubungkan Telegram saya** dan ikuti langkah a–d (sama
   dengan bagian 2 Langkah 2), dan/atau isi alamat email lalu **Simpan**.
4. Periksa hasilnya di *Pengaturan › Persetujuan*, bagian paling bawah **Admin/Owner yang sudah bisa menerima
   kode**: namanya tampil dengan lencana Telegram dan/atau Email.

Kasir hanya bisa meminta kode bila sedikitnya satu nama ada di daftar itu. Tiap atasan menerima kode yang
**berbeda**, sehingga tercatat siapa yang menyetujui.

---

## 5. Mencoba alur sungguhan dari layar kasir

1. Login sebagai **Kasir**. Buat penjualan tidak lunas untuk pelanggan yang piutangnya akan melewati limit
   kredit (atau ajukan retur/void).
2. Muncul dialog persetujuan. Tekan **Kirim kode ke atasan**.
3. Dialog menulis kepada siapa kode dikirim dan lewat saluran apa, mis. *Demo Owner (Telegram + email)*.
4. Di Telegram/email atasan masuk pesan berisi nama kasir, rincian permintaan, dan **Kode: 123456**.
5. Atasan yang setuju menyebutkan kodenya ke kasir. Kasir mengetiknya, tekan **Setujui dengan kode**.

Sifat kode: berlaku 10 menit, sekali pakai, hanya untuk permintaan yang tertulis di pesannya dan kasir yang
memintanya, hangus setelah 5 kali salah ketik. Meminta kode baru membuat kode lama tidak berlaku.

> Catatan mode pengembangan (komputer pemilik proyek, `pnpm dev`): bila sebuah saluran belum diatur, dialog
> kasir menampilkan catatan kuning bahwa kode untuk saluran itu **tidak benar-benar dikirim** (hanya tercatat
> di log server, agar pengujian otomatis tetap jalan). Di komputer toko (mode produksi) saluran yang belum
> diatur tidak dipakai sama sekali, dan tombol uji di *Pengaturan › Persetujuan* selalu mengirim sungguhan di
> mode mana pun.

---

## 6. Penjelasan teknis: cara akun dihubungkan dengan Telegram

**Token tidak menunjuk ke penerima mana pun.** Token hanya membuktikan "saya adalah bot X" kepada Telegram.
Untuk mengirim pesan, Bot API meminta dua hal: token (siapa pengirim) dan `chat_id` (percakapan tujuan):

```
POST https://api.telegram.org/bot<TOKEN>/sendMessage
{ "chat_id": 123456789, "text": "Kode: 482913" }
```

`chat_id` adalah nomor percakapan antara bot dan satu orang. Nomor itu **baru ada setelah orang tersebut
mengirim pesan pertama (Start) ke bot**, dan bot tidak bisa mencarinya dari nomor HP atau username. Tanpa
`chat_id`, tidak ada panggilan `sendMessage` yang bisa dibuat; tidak ada pesan gagal, tidak ada galat, memang
tidak ada yang dikirim. Inilah yang terjadi bila "Hubungkan Telegram" dilewati.

**Yang dikerjakan tombol Hubungkan Telegram saya** (`apps/api/src/modules/sistem/saluran/service.ts`):

1. `buatTautanTelegram`: server membuat kode acak 10 karakter heksadesimal, menyimpannya **di memori server**
   berpasangan dengan id akun yang sedang login, berlaku 10 menit. Kode hanya ditampilkan kepada pemilik akun
   itu.
2. Pengguna mengirim kode itu ke bot (sebagai `/start KODE` lewat tautan `t.me/<bot>?start=KODE`, atau sebagai
   pesan biasa).
3. `periksaTautanTelegram` (tombol **Periksa**): server memanggil `getUpdates`, yaitu "berikan semua pesan
   yang masuk ke bot dan belum saya baca". Dari tiap pesan pribadi, server mengambil 10 karakter terakhirnya
   dan mencocokkannya dengan kode yang menunggu.
4. Bila cocok, `chat.id` pengirim pesan itu disimpan di kolom `pengguna.telegram_chat_id` milik akun pemilik
   kode, dan dicatat di log aktivitas. Karena hanya pemilik akun yang melihat kodenya, Telegram orang lain
   tidak bisa ditempelkan ke akun itu.
5. Sejak itu, `kirimKePengguna` memanggil `sendMessage` dengan `chat_id` tersebut setiap kali kode persetujuan
   dibuat untuk akun itu.

**Mengapa *polling* (`getUpdates`), bukan *webhook*.** Webhook berarti Telegram yang menghubungi server kita
setiap ada pesan; itu butuh alamat internet publik ber-HTTPS. Server toko berada di jaringan lokal tanpa
alamat publik, jadi server yang bertanya ke Telegram, dan hanya saat tombol **Periksa** ditekan (tidak ada
proses yang berjalan terus-menerus). Akibatnya:

- Bot yang sama tidak boleh dipakai program lain yang memasang webhook atau ikut membaca `getUpdates`:
  Telegram akan menolak (HTTP 409) dan pesan bisa "dimakan" program lain. Pakai bot khusus toko.
- Kode tautan disimpan di memori: bila server dinyalakan ulang di antara "Hubungkan" dan "Periksa", kodenya
  hilang. Tekan **buat kode baru** dan ulangi.
- `telegram_chat_id` tersimpan di database, jadi hubungan yang sudah berhasil tidak hilang saat server
  dinyalakan ulang.

**Email tidak butuh langkah serupa** karena siapa pun boleh dikirimi email: cukup alamatnya
(`pengguna.email`). Yang dibutuhkan email adalah bukti bahwa pengirimnya sah, yaitu login SMTP dengan sandi
aplikasi.

**Penyimpanan rahasia.** Token bot dan sandi aplikasi disimpan di tabel `konfigurasi`, tidak pernah
dikembalikan API (hanya "terisi/kosong") dan tidak pernah ditulis ke log. Kode persetujuan disimpan sebagai
hash, bukan angka aslinya.

---

## 7. Uji mandiri tanpa aplikasi (skrip dan curl)

Gunanya memisahkan masalah: bila uji mandiri berhasil tetapi aplikasi gagal, masalahnya di isian aplikasi;
bila uji mandiri juga gagal, masalahnya di token/sandi/internet. Skrip tidak menyimpan token atau sandi.

### 7.1 Skrip Python (paling mudah)

Butuh Python 3 (sudah ada di komputer pengembangan). Buka **PowerShell**, lalu:

```powershell
python D:\sit-tbsu\scripts\uji\uji-telegram.py
```

Skrip meminta token (tidak tampil saat diketik/ditempel; klik kanan untuk menempel, lalu Enter), kemudian:

1. memeriksa token (`getMe`) dan menampilkan nama bot;
2. memeriksa apakah bot dipakai program lain (`getWebhookInfo`);
3. menampilkan daftar chat yang sudah mengirim pesan ke bot beserta `chat id`-nya;
4. bila Anda mengetik salah satu `chat id`, mengirim pesan uji ke sana.

Bila langkah 3 kosong: kirim pesan apa saja ke bot dari Telegram Anda, lalu jalankan lagi. (Pesan yang sudah
dibaca aplikasi lewat tombol Periksa tidak tampil lagi; kirim pesan baru.)

```powershell
python D:\sit-tbsu\scripts\uji\uji-gmail.py
```

Skrip meminta alamat Gmail pengirim, sandi aplikasi, dan alamat penerima, lalu mengirim satu email lewat
`smtp.gmail.com:465`. Jawaban `BERHASIL` berarti alamat dan sandi itu pasti bisa dipakai aplikasi.

### 7.2 Dengan curl (tanpa Python)

Windows 10/11 sudah punya `curl.exe`. Di **PowerShell**, ganti nilai di baris pertama. Jangan menyimpan
perintah berisi token ke berkas.

Token benar?

```powershell
$token = "1234567890:AAH...token-anda"
curl.exe -s "https://api.telegram.org/bot$token/getMe"
```

Jawaban yang benar: `{"ok":true,"result":{"id":…,"is_bot":true,"first_name":"…","username":"nama_bot"…}}`.
Jawaban `{"ok":false,"error_code":401,"description":"Unauthorized"}` berarti token salah.

Siapa yang sudah menyapa bot (mencari `chat id`)?

```powershell
curl.exe -s "https://api.telegram.org/bot$token/getUpdates"
```

Cari `"chat":{"id":123456789,…}`. Angka itu `chat id` Anda. Hasil `"result":[]` berarti belum ada pesan baru:
kirim pesan ke bot dulu.

Kirim pesan uji:

```powershell
curl.exe -s "https://api.telegram.org/bot$token/sendMessage" -d "chat_id=123456789" -d "text=Pesan uji curl"
```

Jawaban `{"ok":true,…}` dan pesan masuk di Telegram = bot berfungsi.

Gmail dengan curl (sandi aplikasi ditulis **tanpa spasi**):

```powershell
$gmail = "sumberurip.toko@gmail.com"
$sandi = "abcdefghijklmnop"
"From: $gmail`r`nTo: $gmail`r`nSubject: Uji curl`r`n`r`nPesan uji." | Set-Content -Encoding ascii "$env:TEMP\uji-email.txt"
curl.exe --ssl-reqd --url "smtps://smtp.gmail.com:465" --user "${gmail}:${sandi}" --mail-from $gmail --mail-rcpt $gmail --upload-file "$env:TEMP\uji-email.txt"
Remove-Item "$env:TEMP\uji-email.txt"
```

Tidak ada tulisan apa pun = terkirim (periksa kotak masuk). `curl: (67) Login denied` = alamat atau sandi
aplikasi salah. `curl: (28)` atau `(7)` = port 465 tidak bisa dicapai dari jaringan itu. Setelah selesai tutup
jendela PowerShell agar variabel `$token` dan `$sandi` hilang.

---

## 8. Daftar masalah dan jalan keluarnya

| Gejala | Penyebab | Jalan keluar |
|---|---|---|
| Lencana "Bot aktif" tetapi kode tidak pernah masuk Telegram | Langkah 2 belum dikerjakan oleh atasan itu | Bagian 2 Langkah 2 (tiap atasan, akunnya sendiri) |
| "Pesan dari Anda belum terbaca bot" | Kode dikirim ke bot lain, belum terkirim, atau lewat 10 menit | Periksa nama bot; kirim ulang; atau **buat kode baru** |
| "Bot ini sedang dipakai program lain" | Bot punya webhook / dibaca program lain | Buat bot baru khusus toko (`/newbot`), isi token barunya |
| "Token bot tidak dikenal Telegram" | Token salah salin atau sudah di-`/revoke` | Salin ulang dari BotFather › `/mybots` › API Token |
| Pesan uji gagal: "bot was blocked by the user" | Bot diblokir di Telegram Anda | Buka blokir, **Putuskan**, lalu hubungkan lagi |
| Lencana email "Belum lengkap: sandi aplikasi kosong" | Sandi aplikasi belum diisi/disimpan | Bagian 3 Langkah 1 B dan C |
| "Server email menolak nama pengguna atau sandi" | Password Gmail biasa, sandi salah, atau Verifikasi 2 Langkah dimatikan | Buat sandi aplikasi baru; simpan ulang |
| Email uji "Berhasil" tetapi tidak ada di kotak masuk | Masuk Spam, atau alamat penerima salah ketik | Lihat Spam; periksa alamat di Langkah 2 |
| Dialog kasir: "Belum ada Admin/Owner yang bisa menerima kode" | Tidak ada atasan dengan kontak + saluran aktif | Lihat daftar di bawah tab Persetujuan; kerjakan Langkah 2 |
| Catatan kuning "Mode pengembangan … tidak benar-benar dikirim" | Saluran itu belum diatur dan aplikasi berjalan dengan `pnpm dev` | Selesaikan tiga langkah saluran itu |
| Semua gagal dengan "tidak bisa dihubungi" | Internet komputer server mati atau diblokir | Buka `https://api.telegram.org` di peramban server; coba jaringan lain |
| Internet toko mati saat butuh persetujuan | Kode tidak bisa dikirim | Retur/void: atasan menyetujui dari akunnya sendiri (tab *Menunggu persetujuan*). Limit kredit: terima pembayaran dulu |

## Riwayat revisi

- 2026-10-11 — v1: panduan dibuat (K-105).
