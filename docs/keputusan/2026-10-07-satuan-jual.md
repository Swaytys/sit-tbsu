# Keputusan Multi-Satuan Jual (Fase 12, bagian 2) — 7 Oktober 2026

Melanjutkan penomoran dari `2026-10-07-label-katalog.md`. Keputusan teknis Claude Code sesuai kewenangan yang
diberikan pemilik proyek (sesi kerja mandiri). Butir **(tinjau pemilik)** menyangkut alur bisnis dan sebaiknya
dikonfirmasi sebelum dipakai di toko.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-091 — Satuan jual per barang, harga per satuan jual, dan transaksi dengan satuan jual

**Keputusan:**

1. **Satuan jual diatur di form Data Barang** (bagian "Satuan jual"): satuan, faktor ke satuan dasar (mis. dus =
   12 pcs → 12; roll = 50 m → 50), barcode sendiri (opsional), satuan bawaan saat dijual, status aktif. Satuan
   jual yang sudah dipakai transaksi tidak dihapus, hanya dinonaktifkan (data master, aturan 4). Bila satuan jual
   dan satuan dasar berdimensi fisik sama (mis. m dan cm), faktor dihitung otomatis dari tabel satuan.
2. **(tinjau pemilik) Harga per satuan jual (H11):** bawaan = `bulatkanHarga(harga satuan dasar tier itu ×
   faktor)` dan **dihitung saat dibaca**, sehingga selalu mengikuti perubahan harga satuan dasar; Admin bisa
   menetapkan **harga tetap per tier** untuk satuan jual tertentu (mis. dus lebih murah dari 12 × harga pcs).
   Harga tetap tidak ditimpa perubahan harga satuan dasar. Baris `harga_barang` satuan jual hanya menyimpan
   harga tetap (metode TETAP); mengembalikan ke otomatis mengubah metodenya menjadi IKUT_TIER (baris tidak
   dihapus) dan harga dihitung lagi dari satuan dasar. *Alasan:* tidak ada cache harga yang bisa basi.
   *Ditolak:* menyimpan harga hasil hitung untuk setiap satuan jual (harus disinkronkan di setiap pemicu harga).
3. **(tinjau pemilik) Satu barang satu baris per transaksi**: setiap baris order/penjualan memilih satu satuan
   (satuan dasar atau satuan jual). Pembeli yang mengambil 1 dus + 3 pcs dicatat dalam satuan yang sama
   (mis. 15 pcs) atau dua transaksi. *Alasan:* seluruh aturan harga janji, reservasi, retur, dan promo berbasis
   barang; dua baris per barang menggandakan risiko kesalahan. Bisa dibuka di versi berikut bila perlu.
4. **Kuantitas:** `qty` dalam satuan jual baris, `qty_dasar = qty × faktor` (3 desimal, U2); stok, reservasi,
   HPP, laba, dan setoran konsinyasi selalu memakai `qty_dasar`. Harga satuan, subtotal, struk, invoice, surat
   jalan, dan retur memakai satuan jual baris (yang dilihat pembeli). Faktor disalin ke baris transaksi
   (snapshot), jadi perubahan faktor master tidak mengubah transaksi lama.
5. **Promo:** syarat minimal qty dan potongan nominal "per satuan" dihitung dalam **satuan dasar** (`qty_dasar`);
   potongan persen dari harga baris. Batas modal (PR6, H9) = `qty_dasar × D`.
6. **Saran tier (H8)** membandingkan `qty_dasar` dengan syarat qty tier dan harga tier untuk satuan yang sama.
7. **Retur & surat jalan:** qty diisi dalam satuan jual baris; sisa dihitung dalam satuan dasar lalu
   dikonversi untuk tampilan. `qty_retur_dasar = qty_retur × faktor`.
8. **Pindai barcode satuan jual** di layar kasir/order langsung memilih barang dengan satuan itu.
9. Penerimaan barang, penyesuaian, dan opname tetap dalam satuan dasar (tidak berubah di fase ini).
