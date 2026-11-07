/**
 * Semua enum status — SATU sumber untuk CHECK constraint DB (skema Drizzle), API, dan web.
 * Nilai dan urutannya identik dengan CHECK di docs/03-skema-database-v3.sql (lihat docs/03 §5).
 * Menambah nilai = migrasi baru (ubah CHECK) + ubah berkas ini.
 */

// --- Sistem & pengguna ---
export const PERAN = ['STAF_PENJUALAN', 'KASIR', 'ADMIN', 'OWNER'] as const;
export type Peran = (typeof PERAN)[number];

export const STATUS_AKTIF = ['AKTIF', 'NONAKTIF'] as const;
export type StatusAktif = (typeof STATUS_AKTIF)[number];

export const TIPE_KONFIGURASI = ['TEKS', 'ANGKA', 'BOOL', 'JSON'] as const;
export type TipeKonfigurasi = (typeof TIPE_KONFIGURASI)[number];

// --- Master ---
export const JENIS_DIMENSI = [
  'PANJANG',
  'LUAS',
  'VOLUME',
  'BERAT',
  'DAYA',
  'JUMLAH',
  'LAINNYA',
] as const;
export type JenisDimensi = (typeof JENIS_DIMENSI)[number];

/** Label tampilan jenis dimensi (dipakai pesan API dan web). */
export const LABEL_JENIS_DIMENSI: Record<JenisDimensi, string> = {
  PANJANG: 'Panjang',
  LUAS: 'Luas',
  VOLUME: 'Volume',
  BERAT: 'Berat',
  DAYA: 'Daya',
  JUMLAH: 'Satuan hitung',
  LAINNYA: 'Lainnya',
};

/** Dimensi fisik: tepat satu satuan basis per dimensi dan boleh dikonversi antar-satuan. */
export const JENIS_DIMENSI_FISIK = ['PANJANG', 'LUAS', 'VOLUME', 'BERAT', 'DAYA'] as const;

export const TIPE_NILAI = ['ANGKA', 'TEKS'] as const;
export type TipeNilai = (typeof TIPE_NILAI)[number];

export const KEPEMILIKAN = ['MILIK_SENDIRI', 'KONSINYASI'] as const;
export type Kepemilikan = (typeof KEPEMILIKAN)[number];

export const METODE_HARGA = ['IKUT_TIER', 'MARKUP', 'TETAP'] as const;
export type MetodeHarga = (typeof METODE_HARGA)[number];

/**
 * Manfaat promo. PERSEN/NOMINAL: potongan; K-163: HARGA_KHUSUS = harga per satuan dasar; GRATIS = beli X gratis Y
 * (barang yang sama, qty satuan dasar); K-185: BELI_POTONG = setiap beli N (satuan dasar) potong Rp X.
 */
export const JENIS_POTONGAN = [
  'PERSEN',
  'NOMINAL',
  'HARGA_KHUSUS',
  'GRATIS',
  'BELI_POTONG',
] as const;
export type JenisPotongan = (typeof JENIS_POTONGAN)[number];

/**
 * K-163: KATEGORI, MERK, dan BARANG boleh beberapa sekaligus (tabel `promo_sasaran`). K-185: KELOMPOK = beberapa
 * kelompok; satu kelompok = kategori DAN merk DAN barang (yang diisi saja), barang cocok bila memenuhi salah satu
 * kelompok.
 */
export const SASARAN_PROMO = ['SEMUA', 'KATEGORI', 'MERK', 'BARANG', 'KELOMPOK'] as const;
export type SasaranPromo = (typeof SASARAN_PROMO)[number];

/** K-097: pembeli yang berhak atas promo: semua, satu golongan pelanggan, atau pelanggan tertentu. */
export const SASARAN_PEMBELI = ['SEMUA', 'GOLONGAN', 'PELANGGAN'] as const;
export type SasaranPembeli = (typeof SASARAN_PEMBELI)[number];

/** PR1: status menurut tanggal (dihitung API dari tanggal operasional hari ini, tidak disimpan). */
export const STATUS_BERLAKU_PROMO = ['TERJADWAL', 'BERJALAN', 'BERAKHIR'] as const;
export type StatusBerlakuPromo = (typeof STATUS_BERLAKU_PROMO)[number];

// --- Persediaan & pemasok ---
export const JENIS_PENERIMAAN = ['PEMBELIAN', 'KONSINYASI'] as const;
export type JenisPenerimaan = (typeof JENIS_PENERIMAAN)[number];

export const SYARAT_BAYAR = ['TUNAI', 'TEMPO'] as const;
export type SyaratBayar = (typeof SYARAT_BAYAR)[number];

export const STATUS_HUTANG = ['TIDAK_ADA', 'BELUM_LUNAS', 'SEBAGIAN', 'LUNAS'] as const;
export type StatusHutang = (typeof STATUS_HUTANG)[number];

export const JENIS_PENYESUAIAN = ['SALDO_AWAL', 'OPNAME', 'KOREKSI', 'RUSAK', 'MUSNAH'] as const;
export type JenisPenyesuaian = (typeof JENIS_PENYESUAIAN)[number];

export const STATUS_PENYESUAIAN = ['DRAFT', 'SELESAI', 'BATAL'] as const;
export type StatusPenyesuaian = (typeof STATUS_PENYESUAIAN)[number];

/** Bucket stok. */
export const KONDISI_STOK = ['BAIK', 'RUSAK'] as const;
export type KondisiStok = (typeof KONDISI_STOK)[number];

export const JENIS_MUTASI = [
  'SALDO_AWAL',
  'PENERIMAAN',
  'PENJUALAN',
  'RETUR_JUAL',
  'TUKAR_RETUR',
  'VOID',
  'PENYESUAIAN',
  'PINDAH_KONDISI',
  'RETUR_PEMASOK',
  'MUSNAH',
] as const;
export type JenisMutasi = (typeof JENIS_MUTASI)[number];

/** Dihitung dari stok, tidak disimpan (K-023). */
export const STATUS_STOK = ['HABIS', 'KRITIS', 'PERLU_RESTOCK', 'AMAN'] as const;
export type StatusStok = (typeof STATUS_STOK)[number];

/** RO6 (K-113): status rekomendasi pemesanan ulang per barang. */
export const STATUS_SARAN_PESAN = ['PESAN_SEKARANG', 'SEGERA', 'AMAN', 'TIDAK_LAKU'] as const;
export type StatusSaranPesan = (typeof STATUS_SARAN_PESAN)[number];

export const PENYELESAIAN_RETUR_PEMASOK = [
  'POTONG_HUTANG',
  'GANTI_BARANG',
  'REFUND',
  'PENGEMBALIAN_TITIPAN',
] as const;
export type PenyelesaianReturPemasok = (typeof PENYELESAIAN_RETUR_PEMASOK)[number];

export const METODE_PEMBAYARAN_PEMASOK = ['TUNAI', 'TRANSFER', 'KOMPENSASI'] as const;
export type MetodePembayaranPemasok = (typeof METODE_PEMBAYARAN_PEMASOK)[number];

// --- Penjualan ---
export const JENIS_PENJUALAN = ['LANGSUNG', 'PENGANTARAN'] as const;
export type JenisPenjualan = (typeof JENIS_PENJUALAN)[number];

export const PRIORITAS_ORDER = ['NORMAL', 'TINGGI'] as const;
export type PrioritasOrder = (typeof PRIORITAS_ORDER)[number];

/** K-122: DISIMPAN = pesan sekarang, diambil/dibayar nanti (menahan stok, tidak di antrean). */
export const STATUS_ORDER = [
  'DRAFT',
  'MENUNGGU',
  'DIPROSES',
  'DISIMPAN',
  'SELESAI',
  'BATAL',
] as const;
export type StatusOrder = (typeof STATUS_ORDER)[number];

export const STATUS_PEMBAYARAN = ['BELUM_BAYAR', 'DP', 'LUNAS'] as const;
export type StatusPembayaran = (typeof STATUS_PEMBAYARAN)[number];

export const STATUS_TRANSAKSI = ['SELESAI', 'VOID_SEBAGIAN', 'VOID'] as const;
export type StatusTransaksi = (typeof STATUS_TRANSAKSI)[number];

export const STATUS_PENGAMBILAN = ['DIAMBIL', 'BELUM_DIAMBIL'] as const;
export type StatusPengambilan = (typeof STATUS_PENGAMBILAN)[number];

/** Status pengiriman pada invoice (agregat dari surat jalan). */
export const STATUS_PENGIRIMAN = ['BELUM', 'SEBAGIAN', 'SELESAI'] as const;
export type StatusPengiriman = (typeof STATUS_PENGIRIMAN)[number];

export const STATUS_SURAT_JALAN = ['DIPROSES', 'DIMUAT', 'DIKIRIM', 'SELESAI', 'BATAL'] as const;
export type StatusSuratJalan = (typeof STATUS_SURAT_JALAN)[number];

/**
 * K-150, K-160: perjalanan (rit) pengantaran. DIRENCANAKAN = rit dijadwalkan (kendaraan, sopir, jam) dan diisi
 * surat jalan; JALAN = kendaraan dan sopirnya di jalan; SELESAI = hasil semua surat jalan dicatat; BATAL = rencana
 * dibatalkan sebelum berangkat.
 */
export const STATUS_PERJALANAN = ['DIRENCANAKAN', 'JALAN', 'SELESAI', 'BATAL'] as const;
export type StatusPerjalanan = (typeof STATUS_PERJALANAN)[number];

/** K-162: tingkat pengingat (servis, STNK, KIR): AMAN, SEGERA (≤ 14 hari/500 km; surat ≤ 30 hari), LEWAT. */
export const TINGKAT_PENGINGAT = ['AMAN', 'SEGERA', 'LEWAT'] as const;
export type TingkatPengingat = (typeof TINGKAT_PENGINGAT)[number];

/** K-151: pilihan pembeli untuk barang rusak di jalan. */
export const PENANGANAN_RUSAK = ['KIRIM_PENGGANTI', 'KURANGI_TAGIHAN'] as const;
export type PenangananRusak = (typeof PENANGANAN_RUSAK)[number];

export const JENIS_PEMBAYARAN = ['PENUH', 'DP', 'PELUNASAN'] as const;
export type JenisPembayaran = (typeof JENIS_PEMBAYARAN)[number];

export const METODE_PEMBAYARAN = ['TUNAI', 'TRANSFER', 'EDC', 'QRIS'] as const;
export type MetodePembayaran = (typeof METODE_PEMBAYARAN)[number];

/** K-111: jenis rekening toko = metode pembayaran non-tunai yang diterima toko. */
export const JENIS_REKENING = ['TRANSFER', 'EDC', 'QRIS'] as const;
export type JenisRekening = (typeof JENIS_REKENING)[number];

/** K-111: hasil pengecekan uang masuk untuk pembayaran non-tunai. */
export const STATUS_VERIFIKASI = ['BELUM_DICEK', 'SUDAH_MASUK', 'TIDAK_MASUK'] as const;
export type StatusVerifikasi = (typeof STATUS_VERIFIKASI)[number];

export const STATUS_ITEM = ['NORMAL', 'RETUR_SEBAGIAN', 'RETUR', 'VOID'] as const;
export type StatusItem = (typeof STATUS_ITEM)[number];

// --- Retur & void ---
/** Status persetujuan retur dan void. */
/** DIBATALKAN (K-099): pengajuan ditarik sebelum diputuskan; tanpa efek, seperti DITOLAK. */
export const STATUS_PERSETUJUAN = ['MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN'] as const;
export type StatusPersetujuan = (typeof STATUS_PERSETUJUAN)[number];

/**
 * Cara retur/void disetujui (docs/04 §6, K-099): SENDIRI = pengaju berwenang menyetujui; AKUN_ATASAN = atasan
 * menyetujui dari akunnya; DI_TEMPAT = disetujui di layar pengaju dengan kode sekali pakai milik atasan
 * (K-102; sebelumnya password atasan, K-099); BATAS_BEBAS = nilainya di bawah batas tanpa persetujuan di
 * Pengaturan.
 */
export const CARA_PERSETUJUAN = ['SENDIRI', 'AKUN_ATASAN', 'DI_TEMPAT', 'BATAS_BEBAS'] as const;
export type CaraPersetujuan = (typeof CARA_PERSETUJUAN)[number];

/**
 * K-102: kode sekali pakai yang dikirim ke atasan (docs/04 §6). Jenis = tindakan yang dimintakan
 * persetujuan; status DIGANTI = pengaju meminta kode baru untuk hal yang sama, GAGAL = terlalu banyak salah
 * ketik atau pesannya tidak terkirim.
 */
export const JENIS_KODE_PERSETUJUAN = [
  'RETUR',
  'VOID',
  'LIMIT_KREDIT',
  'UBAH_PELANGGAN',
  'KOREKSI_KAS',
] as const;
export type JenisKodePersetujuan = (typeof JENIS_KODE_PERSETUJUAN)[number];

export const STATUS_KODE_PERSETUJUAN = ['MENUNGGU', 'DIPAKAI', 'GAGAL', 'DIGANTI'] as const;
export type StatusKodePersetujuan = (typeof STATUS_KODE_PERSETUJUAN)[number];

/** Saluran pengiriman pesan ke atasan. */
export const SALURAN_PESAN = ['TELEGRAM', 'EMAIL'] as const;
export type SaluranPesan = (typeof SALURAN_PESAN)[number];

export const PENYELESAIAN_RETUR = ['REFUND', 'TUKAR_BARANG', 'POTONG_TAGIHAN'] as const;
export type PenyelesaianRetur = (typeof PENYELESAIAN_RETUR)[number];

export const METODE_REFUND = ['TUNAI', 'TRANSFER'] as const;

/**
 * K-192: penyelesaian nilai barang kembali/rusak dari hasil pengantaran, menurut status bayar pembeli: belum bayar →
 * hanya POTONG_TAGIHAN; sudah bayar sebagian → keduanya; lunas → hanya KEMBALIKAN_UANG.
 */
export const PENYELESAIAN_UANG_HASIL = ['POTONG_TAGIHAN', 'KEMBALIKAN_UANG'] as const;
export type PenyelesaianUangHasil = (typeof PENYELESAIAN_UANG_HASIL)[number];
export type MetodeRefund = (typeof METODE_REFUND)[number];

export const KONDISI_RETUR = ['BAIK', 'RUSAK', 'CACAT'] as const;
export type KondisiRetur = (typeof KONDISI_RETUR)[number];

export const LINGKUP_VOID = ['TRANSAKSI', 'ITEM'] as const;
export type LingkupVoid = (typeof LINGKUP_VOID)[number];

// --- Akses perangkat (K-229) ---
/** Perangkat (HP/tablet) yang membuka aplikasi lewat mode LAN toko. */
export const STATUS_PERANGKAT = ['MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DICABUT'] as const;
export type StatusPerangkat = (typeof STATUS_PERANGKAT)[number];

// --- Kas ---
/** K-121: DIHITUNG = hitungan tutup sudah dikirim, menunggu keterangan/uang ditinggal; uang baru ditolak. */
export const STATUS_SHIFT = ['BUKA', 'DIHITUNG', 'TUTUP'] as const;
export type StatusShift = (typeof STATUS_SHIFT)[number];

export const JENIS_KAS_SHIFT = [
  'KASBON',
  'SETOR_OWNER',
  'TARIK_OWNER',
  'REFUND_RETUR',
  'REFUND_VOID',
  'BAYAR_PEMASOK',
  'MASUK_LAIN',
  'KELUAR_LAIN',
  /** K-121: koreksi modal awal (salah ketik, hitung susulan); modal awal sendiri tidak diubah. */
  'KOREKSI_MODAL_TAMBAH',
  'KOREKSI_MODAL_KURANG',
  /** K-141: pembeli tidak mengambil kembaliannya (bukan penjualan; laci tetap cocok). */
  'KEMBALIAN_DITINGGAL',
  /** K-223: uang keluar untuk pihak lain atas kesepakatan tertentu (jamuan, komisi, tanda terima kasih). */
  'BIAYA_ENTERTAIN',
] as const;
export type JenisKasShift = (typeof JENIS_KAS_SHIFT)[number];

/** K-095: struk penjualan langsung setelah bayar: langsung dicetak, ditanya dulu, atau tidak dicetak. */
export const STRUK_CETAK = ['OTOMATIS', 'TANYA', 'TIDAK'] as const;
export type StrukCetak = (typeof STRUK_CETAK)[number];

/** K-124: pilihan yang sama dipakai untuk invoice pengantaran dan surat jalan setelah dibuat. */
export const LABEL_CARA_CETAK: Record<StrukCetak, string> = {
  OTOMATIS: 'Langsung cetak',
  TANYA: 'Tanya dulu',
  TIDAK: 'Tidak dicetak',
};

/** K-124: ukuran dan arah kertas dokumen lembaran (invoice, surat jalan, dokumen lain). */
export const KERTAS_DOKUMEN = [
  'A4_LANSKAP',
  'A4_POTRET',
  'A5_LANSKAP',
  'A5_POTRET',
  'F4_POTRET',
  'F4_LANSKAP',
  'LETTER_POTRET',
  'LETTER_LANSKAP',
] as const;
export type KertasDokumen = (typeof KERTAS_DOKUMEN)[number];

export const LABEL_KERTAS_DOKUMEN: Record<KertasDokumen, string> = {
  A4_LANSKAP: 'A4 lanskap (mendatar)',
  A4_POTRET: 'A4 potret (tegak)',
  A5_LANSKAP: 'A5 lanskap (setengah A4)',
  A5_POTRET: 'A5 potret',
  F4_POTRET: 'F4/Folio potret',
  F4_LANSKAP: 'F4/Folio lanskap',
  LETTER_POTRET: 'Letter potret',
  LETTER_LANSKAP: 'Letter lanskap',
};

/** Nilai `size` aturan CSS `@page` untuk pilihan kertas. F4 = 215 × 330 mm. */
export function ukuranKertasCss(k: KertasDokumen): string {
  const [ukuran, arah] = k.split('_') as [string, string];
  const dasar = ukuran === 'F4' ? '215mm 330mm' : ukuran === 'LETTER' ? 'letter' : ukuran;
  if (arah === 'POTRET') return ukuran === 'F4' ? dasar : `${dasar} portrait`;
  return ukuran === 'F4' ? '330mm 215mm' : `${dasar} landscape`;
}

/** K-125: status order pembelian ke pemasok (docs/05 §21). */
export const STATUS_ORDER_PEMBELIAN = [
  'DRAF',
  'DIPESAN',
  'DIKONFIRMASI',
  'SEBAGIAN',
  'SELESAI',
  'DITUTUP',
  'BATAL',
] as const;
export type StatusOrderPembelian = (typeof STATUS_ORDER_PEMBELIAN)[number];

export const LABEL_STATUS_ORDER_PEMBELIAN: Record<StatusOrderPembelian, string> = {
  DRAF: 'Draf',
  DIPESAN: 'Dipesan',
  DIKONFIRMASI: 'Dikonfirmasi',
  SEBAGIAN: 'Diterima sebagian',
  SELESAI: 'Selesai',
  DITUTUP: 'Ditutup',
  BATAL: 'Batal',
};

/** PO yang masih menunggu barang: sisa qty-nya dihitung "sudah dipesan" di saran pesan. */
export const STATUS_PO_BERJALAN: readonly StatusOrderPembelian[] = [
  'DIPESAN',
  'DIKONFIRMASI',
  'SEBAGIAN',
];

/** K-125: pemakaian uang muka PO: dipakai membayar penerimaan, atau dikembalikan pemasok. */
export const JENIS_ALOKASI_UANG_MUKA = ['DIPAKAI', 'DIKEMBALIKAN'] as const;
export type JenisAlokasiUangMuka = (typeof JENIS_ALOKASI_UANG_MUKA)[number];

/** K-127: metode rekomendasi pemesanan ulang (docs/05 RO9–RO12). */
export const METODE_SARAN_PESAN = ['RATA', 'STATISTIK', 'MIN_MAKS', 'TREN'] as const;
export type MetodeSaranPesan = (typeof METODE_SARAN_PESAN)[number];

export const LABEL_METODE_SARAN_PESAN: Record<MetodeSaranPesan, string> = {
  RATA: 'A · Rata-rata',
  STATISTIK: 'B · Statistik',
  MIN_MAKS: 'C · Min–maks',
  TREN: 'D · Tren',
};

/** K-127 metode B: tingkat layanan (%) dan nilai Z distribusi normal satu sisi. */
export const TINGKAT_LAYANAN_SARAN = [90, 95, 98] as const;
export type TingkatLayananSaran = (typeof TINGKAT_LAYANAN_SARAN)[number];
export const Z_TINGKAT_LAYANAN: Record<TingkatLayananSaran, string> = {
  90: '1.2816',
  95: '1.6449',
  98: '2.0537',
};

/** K-121: cara membuka shift. */
export const CARA_BUKA_SHIFT = ['SAMA_KEMARIN', 'HITUNG', 'HITUNG_NANTI'] as const;
export type CaraBukaShift = (typeof CARA_BUKA_SHIFT)[number];

/** K-121: jenis hitungan uang laci yang tercatat (hanya-tambah). */
export const JENIS_HITUNG_KAS = ['BUKA', 'BUKA_SUSULAN', 'TUTUP', 'TUTUP_ULANG'] as const;
export type JenisHitungKas = (typeof JENIS_HITUNG_KAS)[number];

export const ARAH_KAS = ['MASUK', 'KELUAR'] as const;
export type ArahKas = (typeof ARAH_KAS)[number];

// --- Cadangan data (Fase 8, K-084) ---
export const JENIS_CADANGAN = ['CADANGAN', 'UJI_PULIH'] as const;
export type JenisCadangan = (typeof JENIS_CADANGAN)[number];

export const STATUS_CADANGAN = ['BERJALAN', 'BERHASIL', 'GAGAL'] as const;
export type StatusCadangan = (typeof STATUS_CADANGAN)[number];

export const PEMICU_CADANGAN = ['JADWAL', 'MANUAL', 'SEBELUM_PEMBARUAN'] as const;
export type PemicuCadangan = (typeof PEMICU_CADANGAN)[number];

/** Hasil per tujuan cadangan (lokal / cloud). */
export const STATUS_TUJUAN_CADANGAN = ['BERHASIL', 'GAGAL', 'NONAKTIF'] as const;
export type StatusTujuanCadangan = (typeof STATUS_TUJUAN_CADANGAN)[number];

/** K-165: status tutup tahun (arsip tahunan). DIBUKA = pernah ditutup lalu dibuka kembali oleh Owner. */
export const STATUS_TUTUP_TAHUN = ['DITUTUP', 'DIBUKA'] as const;
export type StatusTutupTahun = (typeof STATUS_TUTUP_TAHUN)[number];

/** K-123: label keterjualan barang dari penjualan 30 hari terakhir (dihitung server). */
export const LABEL_KETERJUALAN = ['LARIS', 'LAMBAT', 'TIDAK_LAKU', 'BARU'] as const;
export type LabelKeterjualan = (typeof LABEL_KETERJUALAN)[number];

/** K-190: jenis kejadian log interaksi (penelitian). */
export const JENIS_INTERAKSI = ['HALAMAN', 'KLIK', 'TOMBOL', 'CARI', 'DIALOG', 'GALAT'] as const;
export type JenisInteraksi = (typeof JENIS_INTERAKSI)[number];

/** K-190: SEMUA = setiap elemen yang bisa diklik; BERMAKNA = tombol, tautan, dan item menu saja. */
export const TINGKAT_LOG_INTERAKSI = ['SEMUA', 'BERMAKNA'] as const;
export type TingkatLogInteraksi = (typeof TINGKAT_LOG_INTERAKSI)[number];

/**
 * K-176: alasan barang kembali utuh dari pengantaran. KIRIM_ULANG = barang tetap milik pembeli dan dikirim lagi;
 * selain itu barang dikembalikan pembeli → tagihan dikurangi otomatis (retur kondisi baik, stok kembali).
 */
export const ALASAN_KEMBALI = ['KIRIM_ULANG', 'KELEBIHAN', 'SALAH_BARANG', 'BATAL_BELI'] as const;
export type AlasanKembali = (typeof ALASAN_KEMBALI)[number];
export const LABEL_ALASAN_KEMBALI: Record<AlasanKembali, string> = {
  KIRIM_ULANG: 'Kirim ulang nanti (penerima tidak ada/ditunda)',
  KELEBIHAN: 'Kelebihan pesanan (kembali ke stok)',
  SALAH_BARANG: 'Salah barang (kembali ke stok)',
  BATAL_BELI: 'Pembeli batal (kembali ke stok)',
};

/** K-176: alasan barang rusak; keduanya ditanggung toko (S11). */
export const ALASAN_RUSAK = ['RUSAK_DI_JALAN', 'RUSAK_SAAT_DICEK'] as const;
export type AlasanRusak = (typeof ALASAN_RUSAK)[number];
export const LABEL_ALASAN_RUSAK: Record<AlasanRusak, string> = {
  RUSAK_DI_JALAN: 'Rusak di jalan',
  RUSAK_SAAT_DICEK: 'Rusak/cacat saat dicek pembeli',
};

/** K-176: tugas pengembalian uang lewat transfer. */
export const STATUS_TRANSFER = ['MENUNGGU', 'SELESAI'] as const;
export type StatusTransfer = (typeof STATUS_TRANSFER)[number];
