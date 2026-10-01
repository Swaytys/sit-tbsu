# Keputusan Inti Persediaan (Fase 4) — 1 Oktober 2026

Melanjutkan penomoran dari `2026-09-30-data-master.md`. Semua keputusan di berkas ini adalah keputusan teknis
Claude Code sesuai kewenangan yang diberikan pemilik proyek; tidak ada yang mengubah aturan bisnis docs/05–06.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-066 — Penerimaan barang (E1–E6)
**Keputusan:**
1. Tanggal operasional penerimaan selalu hari ini (zona Asia/Jakarta); tidak ada input tanggal mundur (U6).
   Waktu faktur pemasok cukup dicatat lewat nomor faktur.
2. PEMBELIAN TUNAI langsung membuat `pembayaran_pemasok` (PBP) LUNAS dengan metode TRANSFER (bawaan) atau
   TUNAI. Selama Fase 4 kolom `id_shift` dibiarkan kosong karena shift kasir baru ada di Fase 6; mulai Fase 6,
   pembayaran TUNAI wajib terkait shift yang terbuka (E4).
3. Bukti terima dicetak dari halaman detail (tata letak cetak A4, sidebar/topbar disembunyikan saat cetak).
4. Komponen `PilihBarang` (cari kode/nama/barcode, ↑/↓/Enter/Esc) dipakai bersama oleh penerimaan dan
   penyesuaian, dan akan dipakai order/kasir di Fase 5.

**Alasan:** Tanggal mundur membuat HPP rata-rata dan saldo kartu stok tidak bisa diurutkan dengan benar; shift
belum ada sehingga memaksa shift akan memblokir penerimaan tunai sampai Fase 6.
**Ditolak:** menunda opsi TUNAI sampai Fase 6 (Admin tidak bisa mencatat pembelian tunai sama sekali).

### K-067 — Penyesuaian stok (A1–A7)
**Keputusan:**
1. Selama DRAFT, isi baris diganti seluruhnya setiap kali disimpan (`PUT /api/penyesuaian/:id`); jenis dokumen
   tidak bisa diubah. Aksi log baru `PENYESUAIAN_UBAH` (docs/05 §16).
2. **Lembar opname** dibuat dari tombol "Stok opname": draf OPNAME berisi semua barang aktif atau satu kategori.
   Lembar hitung dicetak dari draf; hasil hitung diisi di layar. Baris OPNAME yang belum diisi fisiknya menolak
   penyelesaian (hapus barisnya bila memang tidak dihitung), agar barang yang lupa dihitung tidak dianggap 0.
3. `qty_sistem` OPNAME diambil saat SELESAI di bawah kunci baris (A3); di DRAFT layar menampilkan stok sistem
   saat ini sebagai panduan.
4. **Import saldo awal**: templat berisi semua barang aktif dengan nilai per satuan = HPP saat ini (konsinyasi
   bertanda "titip"); hasil unggah adalah satu draf SALDO_AWAL yang diperiksa lalu diselesaikan di layar, tidak
   langsung mengubah stok. Log `IMPORT_SALDO_AWAL`.
5. SALDO_AWAL barang konsinyasi selalu bernilai harga titip (L7), apa pun isian nilai.

**Alasan:** Draf yang diganti utuh lebih sederhana dan aman daripada operasi per baris; import yang langsung
menulis stok tidak bisa diperiksa dulu.
**Ditolak:** opname dengan baris kosong dianggap fisik 0 (berbahaya: menghapus stok barang yang tidak dihitung).

### K-068 — Posisi stok, kartu stok, dan peringatan (ST1–ST3)
**Keputusan:**
1. ST1 didefinisikan **sekali** sebagai ekspresi SQL (`persediaan/stok/repo.ts`), dipakai posisi stok, saringan,
   ringkasan, peringatan, dan kolom "Status stok" di Data Barang. Ambang dari konfigurasi `ambang_restock_persen`.
2. Posisi stok hanya barang AKTIF. Kartu ringkasan (jumlah per status, nilai persediaan) dihitung atas semua
   barang aktif, tidak ikut saringan tabel; klik kartu status = saring status.
3. **Nilai persediaan** = Σ bulat(`stok_fisik` × `hpp_rata2`) barang milik sendiri; konsinyasi dan stok rusak
   bernilai 0 (L7). Hanya dikirim ke pemegang `master.barang.lihat_hpp`, begitu pula HPP di mutasi/kartu/ekspor.
4. **Kartu stok** per barang, per kondisi (BAIK/RUSAK), per periode tanggal operasional: saldo awal = saldo
   sesudah mutasi terakhir sebelum tanggal awal; baris diurutkan menurut urutan ledger (id); API memeriksa saldo
   akhir hitungan = `saldo_setelah` baris terakhir (L3). Dokumen sumber ditautkan ke halaman detailnya.
5. **Notifikasi topbar**: `GET /api/notifikasi` untuk semua pengguna login, isinya disaring per izin di service
   (Fase 4: stok HABIS dan KRITIS untuk `persediaan.stok.lihat`); dihitung ulang tiap menit dan saat lonceng dibuka.
   Sumber lain ST2 ditambahkan ke endpoint yang sama di fase masing-masing.
6. **Kartu "Peringatan stok"** di beranda untuk `dashboard.dasar` (semua peran, ST3) lewat
   `GET /api/dashboard/peringatan-stok`: jumlah HABIS/KRITIS/PERLU_RESTOCK dan 5 barang teratas (HABIS, KRITIS
   lebih dulu). Tautan ke posisi stok hanya bagi pemegang `persediaan.stok.lihat`. Dashboard lengkap tetap Fase 7.
7. Tab "Stok tertahan" (order basi) menyusul di Fase 5 bersama order.

**Alasan:** Satu definisi status mencegah angka di dashboard, notifikasi, dan daftar barang berbeda; kartu stok
yang memeriksa dirinya terhadap ledger langsung ketahuan bila cache rusak.
**Ditolak:** menyimpan status stok sebagai kolom (K-023: dihitung, tidak disimpan); tabel notifikasi (ST2).

### K-069 — Barang di lembar opname dikecualikan, bukan dihapus (keputusan pemilik, 2 Oktober 2026)
**Keputusan (opsi A dipilih pemilik):**
1. Baris yang sudah tersimpan di dokumen OPNAME tidak bisa dihapus (API menolak). Barang yang tidak dihitung
   ditandai **dikecualikan** dengan alasan wajib; dicatat siapa dan kapan (bila draf disimpan ulang dengan alasan
   sama, pencatat awal dipertahankan). Bisa "disertakan lagi" selama DRAFT.
2. Barang dikecualikan tidak menghasilkan mutasi; stok sistem saat selesai tetap dicatat. Tampil sebagai
   "Dikecualikan: alasan" di lembar hitung cetak dan di dokumen selesai (dengan nama & waktu).
3. Log: PENYESUAIAN_UBAH menyebut barang yang dikecualikan/disertakan lagi beserta alasan; PENYESUAIAN_SELESAI
   menyebut jumlah dihitung, dikecualikan (nama: alasan), dan jumlah barang aktif di luar dokumen.
4. Baris yang belum pernah disimpan (baru ditambah di layar) tetap bisa dihapus, dengan tombol Urungkan.
5. Skema v3.3: kolom `dikecualikan`, `alasan_kecuali`, `id_pengguna_kecuali`, `waktu_kecuali` (migrasi 0003).

**Alasan:** Opname per kategori/bergilir tetap bisa, tetapi tidak ada barang yang hilang dari lembar tanpa jejak;
mencegah penyalahgunaan (menyembunyikan barang yang selisih).
**Ditolak:** opsi B (lembar tidak bisa dikurangi sama sekali) karena barang yang memang tidak bisa dihitung saat
itu akan memblokir seluruh opname. Modul opname terjadwal dan cakupan per periode: backlog v2 Sprint E.
