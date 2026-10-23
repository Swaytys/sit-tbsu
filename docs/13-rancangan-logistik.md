# 13 — Rancangan Logistik: muatan, rit, dan papan pengiriman (K-160–K-162)

Status: **rancangan v1 (24 Oktober 2026)**. Dasar: keputusan pemilik K-160–K-162
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

Menu baru **Logistik**: *Pengiriman* (papan), *Kendaraan & Sopir* (pindah dari Data Master), *Riwayat rit*.

### 4.1 Kolom

| Kolom | Isi | Masuk dengan |
|---|---|---|
| **Backlog** | Order kirim baru (invoice pengantaran dengan barang belum dikirim). | Otomatis setelah checkout. |
| **Dijadwalkan** | Kartu dikelompokkan per **rit rencana** (kendaraan, sopir, tanggal-jam berangkat). Kartu tanpa rit ditandai *belum direncanakan* dan tidak bisa maju. | Seret kartu ke grup rit, atau tombol/pintasan *Jadwalkan*. Membuat surat jalan. |
| **Dimuat** | Rit yang sudah dimuat; peringatan muatan dicek ulang. | Tombol *Dimuat* pada grup. |
| **Di jalan** | Rit berangkat. | *Berangkat* pada grup. |
| **Selesai** | Hasil semua barang dicatat (hari ini; lebih lama di Riwayat rit). | *Catat hasil*. |
| **Perlu tindak lanjut** | Kembali utuh, pengganti rusak, retur menunggu atasan. | Otomatis dari hasil. |

Aturan papan:
- Status kartu **selalu dari dokumen** (surat jalan dan perjalanan), tidak ada status tampilan terpisah. Menggeser kartu
  menjalankan aksi yang sama dengan tombolnya, sehingga semua aturan S1–S12 tetap berlaku.
- Mundur hanya sebelum berangkat (Dijadwalkan → Backlog = surat jalan dibatalkan dengan alasan).
- Grup rit bisa dibuka-tutup seperti grup tab peramban; header grup: kendaraan, sopir, jam, bar berat/volume
  berwarna sesuai §3.1.
- Semua aksi seret-lepas punya padanan tombol dan keyboard (K: [[ui-mouse-keyboard-eksplisit]]).
- Kendaraan boleh punya beberapa rit rencana di jam berbeda; jam yang bertabrakan diperingatkan.

### 4.2 Perubahan data

- `perjalanan.status`: tambah **DIRENCANAKAN** (sebelum JALAN) dan kolom `jadwal_berangkat`; indeks unik "satu
  perjalanan JALAN per kendaraan/sopir" tetap.
- Surat jalan dibuat saat kartu masuk rit (qty = semua sisa; bisa dipecah dengan tombol *Pecah*).
- Dependency baru: `@dnd-kit/core` + `@dnd-kit/sortable` (seret-lepas yang mendukung keyboard dan pembaca layar).

## 5. FMS pendukung (K-162, setelah papan)

Dashboard Logistik: rit per hari, rata-rata utilisasi berat/volume, lama di jalan, rit per sopir, kendaraan yang
STNK/KIR-nya hampir habis, jadwal servis (km atau tanggal), catatan BBM per rit (liter, rupiah, odometer).

## 6. Urutan pengerjaan

1. Data muatan barang + kendaraan, konversi satuan, perhitungan muatan per rit + uji (K-161) — **selesai 24 Okt**;
   laporan kelengkapan dan isi massal lewat Excel menyusul.
2. Rit rencana (DIRENCANAKAN) + papan Pengiriman dengan seret-lepas (K-160).
3. STNK/KIR, servis, BBM, dashboard (K-162).

## Riwayat

- 2026-10-24 — v1 dibuat (rancangan K-160–K-162).
- 2026-10-24 — Langkah 1 (K-161) selesai sebagian; julur bawaan 100 cm.
