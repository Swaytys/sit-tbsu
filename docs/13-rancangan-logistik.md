# 13 — Rancangan Logistik: muatan, rit, dan papan pengiriman (K-160–K-162)

Status: **v2 (24 Oktober 2026)** — §3 dan §4 sudah dibangun; §5 belum. Dasar: keputusan pemilik K-160–K-162
(`keputusan/2026-10-24-masukan-uji-dan-fms-lanjutan.md`) dan FMS inti K-149–K-151 yang sudah berjalan (kendaraan,
sopir, perjalanan, hasil per barang). Angka ambang di bawah adalah **bawaan yang bisa diubah di Pengaturan**, bukan
aturan mati.

---

## 1. Istilah

| Istilah di aplikasi | Arti | Padanan umum |
|---|---|---|
| **Order kirim** | Barang invoice pengantaran yang masih harus diantar (satu kartu per invoice). | Delivery order (DO) |
| **Rit** | Satu kali jalan satu kendaraan + satu sopir, membawa satu atau lebih surat jalan. Sudah ada sebagai *perjalanan* (TRP). | Trip / load / manifest |
| **Muatan** | Total berat, volume, dan barang terpanjang dalam satu rit. | Load |
| **Daya angkut** | Berat barang maksimum yang boleh dibawa kendaraan (dari buku uji KIR / STNK). | Payload |
| **Bak** | Ruang muat kendaraan: panjang × lebar × tinggi dinding. | Cargo box |
| **Faktor isi** | Bagian volume bak yang realistis terisi (barang tidak pernah mengisi 100% rapat). | Fill rate |

## 2. Data yang ditambahkan (K-161)

### 2.1 Barang: data muatan

Per **satuan dasar** barang (opsional per satuan jual bila kemasannya beda):

| Kolom | Satuan simpan | Keterangan |
|---|---|---|
| `berat_kg` | kg, `numeric(12,3)` | Berat satu satuan dasar beserta kemasannya. Wajib agar barang bisa dijadwalkan. |
| `panjang_cm`, `lebar_cm`, `tinggi_cm` | cm, `numeric(10,1)` | Ukuran kemasan satu satuan dasar. Boleh kosong untuk barang **curah**. |
| `curah` | boolean | Pasir, batu, tanah: tidak punya ukuran per buah; volume dihitung dari `volume_m3`. |
| `volume_m3` | m³, `numeric(12,4)` | Hanya untuk curah (mis. 1 m³ pasir), atau isian manual bila bentuk tidak kotak. |

Form boleh diisi dalam satuan apa pun yang sejenis (mm/cm/dm/m, g/kg/ton, L/m³): dikonversi lewat
`satuan.faktor_ke_basis` yang sudah ada, lalu disimpan dalam satuan simpan di atas. Barang yang belum lengkap tampil di
laporan **Kelengkapan data muatan** (dan bisa diisi massal lewat Excel). Atribut spesifikasi barang (mis. keramik
40 × 40) tetap terpisah: itu ukuran produk, bukan ukuran kemasan kirim.

### 2.2 Kendaraan

| Kolom | Keterangan |
|---|---|
| `daya_angkut_kg` | Wajib. Diisi dari buku KIR/STNK (JBI dikurangi berat kosong). Menggantikan `kapasitas_kg`. |
| `bak_panjang_cm`, `bak_lebar_cm`, `bak_tinggi_cm` | Ukuran ruang muat. |
| `berlaku_stnk`, `berlaku_kir` | Tanggal; pengingat 30 hari sebelum habis (K-162). |

## 3. Perhitungan muatan per rit

Untuk semua baris surat jalan di satu rit (qty kirim × data barang per satuan):

- **Berat total** = Σ qty_dasar × berat_kg.
- **Volume total** = Σ qty_dasar × (p × l × t) (curah: × volume_m3).
- **Barang terpanjang** = sisi terpanjang kemasan yang paling panjang.
- **Volume bak terpakai** = volume total ÷ (volume bak × faktor isi). Faktor isi bawaan **85%**.

### 3.1 Tingkat peringatan

| Ukuran | Aman | Hampir penuh | Wajib konfirmasi | Ditolak |
|---|---|---|---|---|
| Berat (÷ daya angkut) | ≤ 90% | 90–100%: cek saat dimuat | — | **> 100%** |
| Volume (÷ bak × faktor isi) | ≤ 85% | 85–100% | 100–115%: alasan wajib | > 115% |
| Panjang (÷ panjang bak) | ≤ 100% | — | sampai + julur yang diizinkan: alasan wajib | lebih dari itu |

**Kenapa berat tanpa toleransi:** kelebihan berat adalah pelanggaran ODOL (*Over Dimension Over Load*, UU 22/2009 LLAJ)
dan langsung membahayakan rem, ban, dan sumbu. Volume dan panjang diberi ruang konfirmasi karena barang kadang
ditumpuk lebih tinggi dari dinding bak (terpal, diikat) atau menjulur sedikit; keputusan itu diserahkan kepada orang yang
memuat, dengan **alasan yang tercatat** (mis. "besi 12 m menjulur 80 cm, diberi bendera merah, rute dalam kota").
Julur yang diizinkan diatur di Pengaturan (`muatan_julur_maks_cm`, bawaan 100 cm; sesuaikan dengan kebijakan toko).

### 3.2 Saran efisiensi

- Berat dan volume di bawah 30% dan ada kendaraan lebih kecil yang menganggur dan muat: sarankan kendaraan itu.
- Muatan rendah dengan tujuan berjauhan: sarankan menunggu/menggabungkan order kirim lain ke arah yang sama.
- Saran tidak pernah menghalangi; hanya peringatan biasa.

### 3.3 Barang yang datanya belum lengkap

Dihitung terpisah dan ditampilkan "n barang belum punya berat/ukuran": rit tetap boleh dijadwalkan dengan peringatan
kuning, kecuali tidak ada satu pun barang yang punya berat (perhitungan tidak berarti).

## 4. Papan Pengiriman (K-160)

Menu baru **Logistik**: *Pengiriman* (papan) dan *Kendaraan & Sopir* (pindah dari Data Master; riwayat rit ada di
halaman ini per kendaraan/sopir). Aturan bisnis: docs/05 S14.

### 4.1 Kolom (yang dibangun)

| Kolom | Isi | Masuk dengan |
|---|---|---|
| **Backlog** | Order kirim (invoice pengantaran dengan barang belum dikirim), termasuk lencana *Kirim ulang* (barang kembali utuh) dan *Bayar di tempat*. | Otomatis setelah checkout atau setelah hasil kirim dicatat. |
| **Dijadwalkan** | Grup **rit rencana** (nomor, plat, jam, sopir, catatan, bar muatan berwarna §3.1, lencana *Dimuat*) yang bisa dibuka-tutup, lalu kotak *Belum direncanakan* untuk surat jalan tanpa rit. | Seret kartu ke grup, atau menu kartu ⋮ › *Masukkan ke rit*. Kartu Backlog yang masuk rit langsung dibuatkan surat jalan untuk seluruh sisanya. |
| **Di jalan** | Rit JALAN: lama di jalan (kuning bila > 6 jam atau beda hari), nomor HP sopir, tombol *Catat hasil* per surat jalan. | Tombol *Berangkat* pada grup (dialog muatan, alasan bila perlu). |
| **Selesai hari ini** | Rit yang semua hasilnya dicatat hari ini. | *Catat hasil* surat jalan terakhir. |

Perbedaan dari rancangan v1, dengan alasan:
- **Dimuat** tidak dijadikan kolom sendiri, tetapi lencana pada grup dan kartu. Rit yang sudah dimuat tetap rit
  rencana yang sama; kolom terpisah hanya memindahkan kartu tanpa arti baru dan memakan lebar layar 1280 px.
- **Perlu tindak lanjut** tidak dijadikan kolom: barang kembali utuh langsung muncul lagi di Backlog dengan lencana
  *Kirim ulang*, dan retur yang menunggu atasan sudah punya antrean sendiri di halaman Retur.
- Peringatan jadwal bertabrakan untuk kendaraan yang sama belum dibuat (usulan lanjutan); penguncian sebenarnya
  tetap saat berangkat (S9).

Aturan papan:
- Status kartu **selalu dari dokumen** (surat jalan dan perjalanan); tidak ada status tampilan terpisah. Menyeret
  menjalankan aksi yang sama dengan menu kartu, sehingga S1–S14 tetap berlaku.
- Seret ke *Belum direncanakan*: kartu Backlog membuka dialog surat jalan (bisa sebagian); surat jalan di rit keluar
  dari rit. Seret surat jalan ke *Backlog* membuka dialog batal surat jalan (alasan wajib). Mundur hanya sebelum
  berangkat.
- Setiap aksi seret punya padanan klik dan keyboard: menu kartu ⋮ (masukkan/pindah/keluarkan/batalkan), tombol
  *Rit baru* (pintasan **R**), dan pegangan seret yang bisa diangkat dengan Spasi lalu dipindah dengan panah.
- Papan menyegarkan data berkala; aksi pada rit yang sudah berubah di komputer lain ditolak dengan pesan
  "muat ulang halaman" (kunci baris di DB, docs/02).

### 4.2 Perubahan data

- `perjalanan.status`: tambah **DIRENCANAKAN** dan **BATAL**, kolom `jadwal_berangkat` dan `alasan_batal`;
  `waktu_berangkat` kosong sampai berangkat. Indeks unik "satu perjalanan JALAN per kendaraan/sopir" tetap
  (migrasi 0027).
- `surat_jalan.id_perjalanan` diisi saat masuk rit rencana (bukan lagi hanya saat berangkat).
- Dependency baru: `@dnd-kit/core` 6.3.1 (seret-lepas dengan dukungan keyboard dan pembaca layar). `@dnd-kit/sortable`
  tidak dipakai karena urutan kartu dalam kolom tidak bermakna bisnis.

## 5. FMS pendukung (K-162, setelah papan)

Dashboard Logistik: rit per hari, rata-rata utilisasi berat/volume, lama di jalan, rit per sopir, kendaraan yang
STNK/KIR-nya hampir habis, jadwal servis (km atau tanggal), catatan BBM per rit (liter, rupiah, odometer).

## 6. Urutan pengerjaan

1. Data muatan barang + kendaraan, konversi satuan, perhitungan muatan per rit + uji (K-161) — **selesai 24 Okt**;
   laporan kelengkapan dan isi massal lewat Excel menyusul.
2. Rit rencana (DIRENCANAKAN) + papan Pengiriman dengan seret-lepas (K-160) — **selesai 24 Okt**.
3. STNK/KIR, servis, BBM, dashboard (K-162).

## Riwayat

- 2026-10-24 — v1 dibuat (rancangan K-160–K-162).
- 2026-10-24 — Langkah 1 (K-161) selesai sebagian; julur bawaan 100 cm.
- 2026-10-24 — v2: langkah 2 (K-160) selesai; §4 disesuaikan dengan yang dibangun (Dimuat = lencana, tindak lanjut
  lewat Backlog *Kirim ulang*).
