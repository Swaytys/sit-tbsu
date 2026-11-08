import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  KODE_DOKUMEN,
  USERNAME_DEMO,
  type JenisDimensi,
  type Peran,
  type TipeKonfigurasi,
  type TipeNilai,
} from '@sit/shared';
import { hashPassword } from '../lib/password';
import { sinkronkanKodeMaster, terbitkanKodeMaster } from '../modules/sistem/penomoran';
import type { Db, Tx } from './client';
import { jenisAtribut, kategori, konfigurasi, pengguna, satuan, tingkatHarga } from './schema';

/*
 * Data awal (docs/03 §6, docs/05 §15). Idempoten: baris yang kodenya sudah ada TIDAK ditimpa, sehingga
 * pengaturan yang sudah diubah Owner/Admin tetap aman bila seed dijalankan ulang.
 */

type BarisKonfigurasi = { kode: string; nilai: string; tipe: TipeKonfigurasi; deskripsi: string };

const PREFIX_DOKUMEN = KODE_DOKUMEN;

const KONFIGURASI: BarisKonfigurasi[] = [
  {
    kode: 'nama_toko',
    nilai: 'BonsaiUrip',
    tipe: 'TEKS',
    deskripsi: 'Nama tampil aplikasi dan kop dokumen (K-044)',
  },
  // K-207: identitas usaha diisi pemilik di setup awal (K-205); data awal tidak memuat toko tertentu.
  { kode: 'nama_badan_usaha', nilai: '', tipe: 'TEKS', deskripsi: 'Baris kedua kop' },
  {
    kode: 'jenis_usaha',
    nilai: 'BAHAN_BANGUNAN',
    tipe: 'TEKS',
    deskripsi: 'Jenis usaha dari setup awal (K-205)',
  },
  { kode: 'jenis_usaha_lain', nilai: '', tipe: 'TEKS', deskripsi: 'Jenis usaha bila Lainnya' },
  { kode: 'slogan_toko', nilai: '', tipe: 'TEKS', deskripsi: 'Slogan usaha di halaman masuk' },
  { kode: 'kota_toko', nilai: '', tipe: 'TEKS', deskripsi: 'Kota/kabupaten usaha' },
  { kode: 'alamat_toko', nilai: '', tipe: 'TEKS', deskripsi: 'Alamat pada kop' },
  { kode: 'telp_toko', nilai: '', tipe: 'TEKS', deskripsi: 'Telepon pada kop' },
  {
    kode: 'layanan_toko',
    nilai: 'LANGSUNG,ORDER,ANTAR',
    tipe: 'TEKS',
    deskripsi: 'Cara melayani pembeli (K-205): menyesuaikan panduan dan tur',
  },
  { kode: 'email_toko', nilai: '', tipe: 'TEKS', deskripsi: 'Email pada kop (boleh kosong)' },
  {
    kode: 'footer_struk',
    nilai: 'Terima kasih atas kepercayaan Anda.',
    tipe: 'TEKS',
    deskripsi: 'Baris penutup struk',
  },
  {
    kode: 'lebar_struk_mm',
    nilai: '80',
    tipe: 'ANGKA',
    deskripsi: 'Lebar kertas struk: 57, 58, atau 80',
  },
  {
    kode: 'struk_cetak',
    nilai: 'OTOMATIS',
    tipe: 'TEKS',
    deskripsi: 'Struk setelah bayar: OTOMATIS, TANYA, atau TIDAK (K-095)',
  },
  {
    kode: 'invoice_cetak',
    nilai: 'TIDAK',
    tipe: 'TEKS',
    deskripsi: 'Invoice pengantaran setelah dibuat: OTOMATIS, TANYA, atau TIDAK (K-124)',
  },
  {
    kode: 'surat_jalan_cetak',
    nilai: 'OTOMATIS',
    tipe: 'TEKS',
    deskripsi: 'Surat jalan setelah dibuat: OTOMATIS, TANYA, atau TIDAK (K-124)',
  },
  {
    kode: 'kertas_invoice',
    nilai: 'A4_LANSKAP',
    tipe: 'TEKS',
    deskripsi: 'Kertas invoice, mis. A4_LANSKAP atau A4_POTRET (K-124)',
  },
  {
    kode: 'kertas_surat_jalan',
    nilai: 'A4_LANSKAP',
    tipe: 'TEKS',
    deskripsi: 'Kertas surat jalan (K-124)',
  },
  {
    kode: 'kertas_dokumen_lain',
    nilai: 'A4_POTRET',
    tipe: 'TEKS',
    deskripsi: 'Kertas nota titip, retur pemasok, dan dokumen lembaran lain (K-124)',
  },
  {
    kode: 'surat_jalan_rangkap',
    nilai: 'true',
    tipe: 'BOOL',
    deskripsi: 'Surat jalan dicetak 2 rangkap: asli (arsip toko) dan salinan (penerima) (K-187)',
  },
  {
    kode: 'struk_tampilkan_nama',
    nilai: 'true',
    tipe: 'BOOL',
    deskripsi: 'Kop struk memakai nama toko (K-065)',
  },
  {
    kode: 'struk_tampilkan_logo',
    nilai: 'false',
    tipe: 'BOOL',
    deskripsi: 'Kop struk memakai logo toko (K-065)',
  },
  {
    kode: 'baris_per_halaman',
    nilai: '25',
    tipe: 'ANGKA',
    deskripsi: 'Jumlah baris per halaman tabel: 10, 25, 50, 100 (K-065)',
  },
  ...PREFIX_DOKUMEN.map((p): BarisKonfigurasi => ({
    kode: `prefix_${p}`,
    nilai: p,
    tipe: 'TEKS',
    deskripsi: `Prefix nomor dokumen ${p} (K-022, K-045)`,
  })),
  {
    kode: 'digit_nomor',
    nilai: '3',
    tipe: 'ANGKA',
    deskripsi: 'Digit urut nomor dokumen; melebar otomatis bila > 999/hari',
  },
  {
    kode: 'ambang_restock_persen',
    nilai: '20',
    tipe: 'ANGKA',
    deskripsi: 'Ambang status PERLU_RESTOCK (K-023)',
  },
  {
    kode: 'stok_minimum_default',
    nilai: '5',
    tipe: 'ANGKA',
    deskripsi: 'Stok minimum untuk barang baru',
  },
  {
    kode: 'batas_umur_order_jam',
    nilai: '24',
    tipe: 'ANGKA',
    deskripsi: 'Order MENUNGGU lebih lama dari ini = basi (K-007)',
  },
  {
    kode: 'auto_batal_order_basi',
    nilai: 'false',
    tipe: 'BOOL',
    deskripsi: 'Batalkan order basi otomatis (K-007)',
  },
  {
    kode: 'dasar_markup',
    nilai: 'HARGA_BELI_TERAKHIR',
    tipe: 'TEKS',
    deskripsi: 'HARGA_BELI_TERAKHIR, HPP_RATA2, atau FIFO (K-009, K-184)',
  },
  {
    kode: 'pembulatan_harga',
    nilai: '100',
    tipe: 'ANGKA',
    deskripsi: 'Kelipatan pembulatan harga ke atas, Rp (K-010)',
  },
  {
    kode: 'batas_diskon_persen_STAF_PENJUALAN',
    nilai: '0',
    tipe: 'ANGKA',
    deskripsi: 'Batas diskon Staf Penjualan (K-012)',
  },
  {
    kode: 'batas_diskon_persen_KASIR',
    nilai: '0',
    tipe: 'ANGKA',
    deskripsi: 'Batas diskon Kasir (K-012)',
  },
  {
    kode: 'batas_diskon_persen_ADMIN',
    nilai: '100',
    tipe: 'ANGKA',
    deskripsi: 'Batas diskon Admin (K-012)',
  },
  {
    kode: 'batas_diskon_persen_OWNER',
    nilai: '100',
    tipe: 'ANGKA',
    deskripsi: 'Batas diskon Owner (K-012)',
  },
  {
    kode: 'batas_retur_tanpa_persetujuan',
    nilai: '0',
    tipe: 'ANGKA',
    deskripsi: 'Nilai retur per transaksi tanpa persetujuan atasan, Rp; 0 = selalu butuh (K-099)',
  },
  {
    kode: 'batas_void_tanpa_persetujuan',
    nilai: '0',
    tipe: 'ANGKA',
    deskripsi: 'Nilai void per transaksi tanpa persetujuan atasan, Rp; 0 = selalu butuh (K-099)',
  },
  {
    kode: 'term_hari_default',
    nilai: '0',
    tipe: 'ANGKA',
    deskripsi: 'Term piutang pelanggan baru (hari)',
  },
  {
    kode: 'limit_kredit_default',
    nilai: '',
    tipe: 'ANGKA',
    deskripsi: 'Limit kredit pelanggan baru, Rp; kosong = tanpa limit (K-104)',
  },
  {
    kode: 'login_maks_gagal',
    nilai: '5',
    tipe: 'ANGKA',
    deskripsi: 'Gagal login berturut sebelum dikunci (docs/04 §7)',
  },
  {
    kode: 'login_kunci_menit',
    nilai: '15',
    tipe: 'ANGKA',
    deskripsi: 'Lama penguncian akun (menit)',
  },
  { kode: 'password_min', nilai: '8', tipe: 'ANGKA', deskripsi: 'Panjang minimal password' },
  {
    kode: 'checkout_wajib_shift',
    nilai: 'true',
    tipe: 'BOOL',
    deskripsi: 'Pembayaran TUNAI wajib shift terbuka',
  },
  // docs/05 §15
  {
    kode: 'batas_kunci_order_menit',
    nilai: '30',
    tipe: 'ANGKA',
    deskripsi: 'Order DIPROSES lebih lama dari ini kembali MENUNGGU (R8)',
  },
  {
    kode: 'jatuh_tempo_default_hari',
    nilai: '7',
    tipe: 'ANGKA',
    deskripsi: 'Jatuh tempo piutang bila term pelanggan 0 (P7)',
  },
  // K-109: jadwal shift toko (kosong = tanpa jadwal); dibekukan ke tiap shift saat dibuka
  { kode: 'shift_jam_buka', nilai: '', tipe: 'TEKS', deskripsi: 'Jam buka shift (HH:mm)' },
  { kode: 'shift_jam_tutup', nilai: '', tipe: 'TEKS', deskripsi: 'Jam tutup shift (HH:mm)' },
  // K-121: tutup shift (toleransi selisih receh) dan hitung susulan saat buka
  {
    kode: 'toleransi_selisih_kas',
    nilai: '1000',
    tipe: 'ANGKA',
    deskripsi: 'Selisih kas sampai nilai ini ditandai selisih receh (rupiah)',
  },
  {
    kode: 'batas_hitung_buka_menit',
    nilai: '60',
    tipe: 'ANGKA',
    deskripsi: 'Batas menit hitung susulan untuk cara buka "hitung nanti"',
  },
  // K-113: rekomendasi pemesanan ulang (docs/05 §17 RO1–RO4)
  {
    kode: 'saran_pesan_periode_hari',
    nilai: '30',
    tipe: 'ANGKA',
    deskripsi: 'Hari penjualan yang diamati untuk rata-rata jual per hari (RO1)',
  },
  {
    kode: 'saran_pesan_hari_pengaman',
    nilai: '2',
    tipe: 'ANGKA',
    deskripsi: 'Stok pengaman = rata-rata jual per hari × hari ini (RO2)',
  },
  {
    kode: 'saran_pesan_lama_kirim_default',
    nilai: '3',
    tipe: 'ANGKA',
    deskripsi: 'Lama kirim (hari) bila pemasok belum diisi (RO3)',
  },
  {
    kode: 'saran_pesan_jarak_belanja_default',
    nilai: '7',
    tipe: 'ANGKA',
    deskripsi: 'Jarak belanja (hari) bila pemasok belum diisi (RO4)',
  },
  {
    kode: 'muatan_faktor_isi_persen',
    nilai: '85',
    tipe: 'ANGKA',
    deskripsi: 'Bagian volume bak yang realistis terisi barang (K-161, docs/13 §3)',
  },
  {
    kode: 'muatan_toleransi_persen',
    nilai: '110',
    tipe: 'ANGKA',
    deskripsi:
      'Muatan di atas 100% sampai batas ini boleh berangkat dengan alasan; di atasnya ditolak (K-203)',
  },
  {
    kode: 'penerimaan_tanpa_po_dibatasi',
    nilai: 'true',
    tipe: 'BOOL',
    deskripsi: 'Pembelian tanpa order pembelian hanya tunai sampai batas (K-225)',
  },
  {
    kode: 'penerimaan_tanpa_po_batas',
    nilai: '500000',
    tipe: 'ANGKA',
    deskripsi: 'Batas nilai pembelian tunai tanpa order pembelian (K-225)',
  },
  {
    kode: 'hutang_batas_kepala_toko',
    nilai: '10000000',
    tipe: 'ANGKA',
    deskripsi:
      'Kepala Toko membayar hutang pemasok sampai nilai ini per pembayaran; di atasnya Owner (K-225)',
  },
  {
    kode: 'po_penerima_beda',
    nilai: 'true',
    tipe: 'BOOL',
    deskripsi: 'Penerima barang bukan pembuat order pembelian (K-225)',
  },
  {
    kode: 'po_batas_tanpa_persetujuan',
    nilai: '1000000',
    tipe: 'ANGKA',
    deskripsi: 'Order pembelian sampai nilai ini boleh dikirim tanpa persetujuan (K-225)',
  },
  {
    kode: 'po_batas_kepala_toko',
    nilai: '10000000',
    tipe: 'ANGKA',
    deskripsi: 'Kepala Toko menyetujui order pembelian sampai nilai ini; di atasnya Owner (K-225)',
  },
  {
    kode: 'po_ambang_naik_persen',
    nilai: '10',
    tipe: 'ANGKA',
    deskripsi:
      'Harga beli naik lebih dari persen ini dari harga beli terakhir wajib disetujui (K-225)',
  },
  {
    kode: 'muatan_julur_maks_cm',
    nilai: '100',
    tipe: 'ANGKA',
    deskripsi: 'Barang boleh lebih panjang dari bak sampai sekian cm, dengan alasan (K-161)',
  },
  // Rekening bawaan layar kasir (K-073) sejak K-111 ada di tabel rekening_toko (Pengaturan › Pembayaran).
];

/** Akun demo per peran (hanya NODE_ENV=development; docs/03 §6, K-021). */
const NAMA_DEMO: Record<Peran, string> = {
  OWNER: 'Demo Owner',
  ADMIN: 'Demo Admin',
  KASIR: 'Demo Kasir',
  STAF_PENJUALAN: 'Demo Staf',
  ADMIN_SISTEM: 'Demo Administrator Sistem',
  ADMIN_PERSEDIAAN: 'Demo Admin Persediaan',
  PETUGAS_GUDANG: 'Demo Petugas Gudang',
};

type BarisSatuan = {
  kode: string;
  nama: string;
  jenisDimensi: JenisDimensi;
  faktorKeBasis: string;
  isBasis: boolean;
};

const SATUAN_HITUNG = [
  ['buah', 'Buah'],
  ['sak', 'Sak'],
  ['batang', 'Batang'],
  ['roll', 'Roll'],
  ['dus', 'Dus'],
  ['lembar', 'Lembar'],
  ['kaleng', 'Kaleng'],
  ['pail', 'Pail'],
  ['pasang', 'Pasang'],
  ['set', 'Set'],
  ['kotak', 'Kotak'],
] as const;

const SATUAN: BarisSatuan[] = [
  { kode: 'm', nama: 'Meter', jenisDimensi: 'PANJANG', faktorKeBasis: '1', isBasis: true },
  {
    kode: 'cm',
    nama: 'Sentimeter',
    jenisDimensi: 'PANJANG',
    faktorKeBasis: '0.01',
    isBasis: false,
  },
  {
    kode: 'mm',
    nama: 'Milimeter',
    jenisDimensi: 'PANJANG',
    faktorKeBasis: '0.001',
    isBasis: false,
  },
  { kode: 'dm', nama: 'Desimeter', jenisDimensi: 'PANJANG', faktorKeBasis: '0.1', isBasis: false },
  {
    kode: 'm2',
    nama: 'Meter persegi (m²)',
    jenisDimensi: 'LUAS',
    faktorKeBasis: '1',
    isBasis: true,
  },
  {
    kode: 'm3',
    nama: 'Meter kubik (m³)',
    jenisDimensi: 'VOLUME',
    faktorKeBasis: '1',
    isBasis: true,
  },
  { kode: 'L', nama: 'Liter', jenisDimensi: 'VOLUME', faktorKeBasis: '0.001', isBasis: false },
  { kode: 'kg', nama: 'Kilogram', jenisDimensi: 'BERAT', faktorKeBasis: '1', isBasis: true },
  { kode: 'g', nama: 'Gram', jenisDimensi: 'BERAT', faktorKeBasis: '0.001', isBasis: false },
  { kode: 'W', nama: 'Watt', jenisDimensi: 'DAYA', faktorKeBasis: '1', isBasis: true },
  // Satuan hitung berdiri sendiri; konversinya per barang (barang_satuan_jual).
  ...SATUAN_HITUNG.map(([kode, nama]): BarisSatuan => ({
    kode,
    nama,
    jenisDimensi: 'JUMLAH',
    faktorKeBasis: '1',
    isBasis: true,
  })),
];

const JENIS_ATRIBUT: {
  kode: string;
  nama: string;
  tipeNilai: TipeNilai;
  jenisDimensi: JenisDimensi | null;
}[] = [
  { kode: 'PANJANG', nama: 'Panjang', tipeNilai: 'ANGKA', jenisDimensi: 'PANJANG' },
  { kode: 'LEBAR', nama: 'Lebar', tipeNilai: 'ANGKA', jenisDimensi: 'PANJANG' },
  { kode: 'TINGGI', nama: 'Tinggi', tipeNilai: 'ANGKA', jenisDimensi: 'PANJANG' },
  { kode: 'TEBAL', nama: 'Tebal', tipeNilai: 'ANGKA', jenisDimensi: 'PANJANG' },
  { kode: 'DIAMETER', nama: 'Diameter', tipeNilai: 'ANGKA', jenisDimensi: 'PANJANG' },
  { kode: 'LUAS', nama: 'Luas', tipeNilai: 'ANGKA', jenisDimensi: 'LUAS' },
  { kode: 'VOLUME', nama: 'Volume', tipeNilai: 'ANGKA', jenisDimensi: 'VOLUME' },
  { kode: 'BERAT', nama: 'Berat', tipeNilai: 'ANGKA', jenisDimensi: 'BERAT' },
  { kode: 'DAYA', nama: 'Daya', tipeNilai: 'ANGKA', jenisDimensi: 'DAYA' },
  { kode: 'WARNA', nama: 'Warna', tipeNilai: 'TEKS', jenisDimensi: null },
  { kode: 'BENTUK', nama: 'Bentuk', tipeNilai: 'TEKS', jenisDimensi: null },
  { kode: 'TEKSTUR', nama: 'Tekstur', tipeNilai: 'TEKS', jenisDimensi: null },
  { kode: 'FUNGSI', nama: 'Fungsi', tipeNilai: 'TEKS', jenisDimensi: null },
  { kode: 'UKURAN_TEKS', nama: 'Ukuran (teks)', tipeNilai: 'TEKS', jenisDimensi: null },
];

/*
 * Angka markup dan syarat belanja contoh. Tier selain Normal dibuat NONAKTIF: belum dipakai sampai pemilik
 * memeriksa "Mulai belanja"-nya di Harga Jual › Kelola tier lalu mengaktifkannya (K-099).
 */
const TINGKAT_HARGA: (typeof tingkatHarga.$inferInsert)[] = [
  { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
  {
    kode: 'GROSIR',
    nama: 'Grosir',
    markupDefaultPersen: '20',
    urutan: 2,
    minBelanja: 1_000_000,
    statusAktif: 'NONAKTIF',
  },
  {
    kode: 'DISTRIBUTOR',
    nama: 'Distributor',
    markupDefaultPersen: '15',
    urutan: 3,
    minBelanja: 5_000_000,
    statusAktif: 'NONAKTIF',
  },
];

const KATEGORI = [
  'Semen',
  'Agregat',
  'Bata & Blok',
  'Besi & Baja',
  'Cat & Pelapis',
  'Keramik',
  'Pipa & Sanitasi',
  'Atap',
  'Kayu',
  'Alat Tukang',
  'Kelistrikan',
  'Kamar Mandi',
  'Aksesoris',
];

/** Jumlah baris BARU per tabel (baris yang sudah ada dilewati). */
export type RingkasanSeed = Record<
  'konfigurasi' | 'satuan' | 'jenisAtribut' | 'tingkatHarga' | 'kategori' | 'pengguna',
  number
>;

/**
 * Menyamakan penghitung kode USR dengan kode tertinggi yang sudah ada (mis. `USR-00001` dari seed
 * Fase 1 yang ditulis sebelum penomoran ada), agar kode pengguna berikutnya tidak bentrok (docs/05 N5).
 */
async function sinkronkanPenghitungPengguna(tx: Tx): Promise<void> {
  const hasil = await tx.execute<{ maks: number | null }>(
    sql`select max(substring(${pengguna.kode} from 5)::int) as maks from ${pengguna} where ${pengguna.kode} ~ '^USR-[0-9]+$'`,
  );
  await sinkronkanKodeMaster(tx, 'USR', hasil.rows[0]?.maks ?? 0);
}

/** Membuat pengguna bila username belum ada. Kode diterbitkan lewat penomoran (N5). */
async function pastikanPengguna(
  tx: Tx,
  nilai: {
    username: string;
    namaPengguna: string;
    peran: Peran;
    passwordHash: string;
    wajibGantiPassword: boolean;
  },
): Promise<boolean> {
  const [ada] = await tx
    .select({ id: pengguna.id })
    .from(pengguna)
    .where(eq(pengguna.username, nilai.username))
    .limit(1);
  if (ada) return false;
  await tx.insert(pengguna).values({ ...nilai, kode: await terbitkanKodeMaster(tx, 'USR') });
  return true;
}

export async function isiDataAwal(
  db: Db,
  /**
   * `passwordOwner` null (K-191): akun Owner tidak dibuat di sini; pemakaian pertama membuka halaman "Buat akun
   * pertama". Akun demo (hanya pengembangan) tetap butuh password.
   */
  opsi: { passwordOwner: string | null; akunDemo: boolean },
): Promise<RingkasanSeed> {
  if (opsi.passwordOwner === null && opsi.akunDemo) {
    throw new Error('Akun demo butuh SEED_OWNER_PASSWORD.');
  }
  // Hash dihitung di luar transaksi agar transaksi tetap singkat.
  const hashOwner = opsi.passwordOwner === null ? null : await hashPassword(opsi.passwordOwner);

  return db.transaction(async (tx) => {
    const baruKonfigurasi = await tx
      .insert(konfigurasi)
      .values(KONFIGURASI)
      .onConflictDoNothing({ target: konfigurasi.kode })
      .returning({ id: konfigurasi.id });

    const baruSatuan = await tx
      .insert(satuan)
      .values(SATUAN)
      .onConflictDoNothing({ target: satuan.kode })
      .returning({ id: satuan.id });

    const baruJenisAtribut = await tx
      .insert(jenisAtribut)
      .values(JENIS_ATRIBUT.map((j, i) => ({ ...j, urutan: i + 1 })))
      .onConflictDoNothing({ target: jenisAtribut.kode })
      .returning({ id: jenisAtribut.id });

    const baruTingkatHarga = await tx
      .insert(tingkatHarga)
      .values(TINGKAT_HARGA)
      .onConflictDoNothing({ target: tingkatHarga.kode })
      .returning({ id: tingkatHarga.id });

    const baruKategori = await tx
      .insert(kategori)
      .values(KATEGORI.map((nama, i) => ({ nama, urutan: i + 1 })))
      .onConflictDoNothing({ target: kategori.nama })
      .returning({ id: kategori.id });

    await sinkronkanPenghitungPengguna(tx);
    let baruPengguna = 0;
    if (hashOwner !== null) {
      const owner = await pastikanPengguna(tx, {
        username: 'owner',
        namaPengguna: 'Owner',
        peran: 'OWNER',
        passwordHash: hashOwner,
        wajibGantiPassword: true,
      });
      if (owner) baruPengguna++;
    }

    if (opsi.akunDemo && hashOwner !== null) {
      // Akun demo memakai password yang sama dengan SEED_OWNER_PASSWORD dan tidak wajib ganti.
      for (const peran of Object.keys(USERNAME_DEMO) as Peran[]) {
        const baru = await pastikanPengguna(tx, {
          username: USERNAME_DEMO[peran],
          namaPengguna: NAMA_DEMO[peran],
          peran,
          passwordHash: hashOwner,
          wajibGantiPassword: false,
        });
        if (baru) baruPengguna++;
      }
      // K-102: akun demo punya email contoh agar alur kode persetujuan bisa dicoba; di pengembangan tanpa
      // SMTP, pesannya hanya masuk kotak keluar uji (tidak ada email yang benar-benar terkirim).
      for (const peran of Object.keys(USERNAME_DEMO) as Peran[]) {
        await tx
          .update(pengguna)
          .set({ email: `${USERNAME_DEMO[peran]}@contoh.test` })
          .where(and(eq(pengguna.username, USERNAME_DEMO[peran]), isNull(pengguna.email)));
      }
      // K-243: kasir demo juga mengurus pengantaran (contoh izin tambahan per akun; bisa dicabut Owner).
      await tx
        .update(pengguna)
        .set({ izinTambah: ['penjualan.surat_jalan.kelola'] })
        .where(eq(pengguna.username, USERNAME_DEMO.KASIR));
    }

    return {
      konfigurasi: baruKonfigurasi.length,
      satuan: baruSatuan.length,
      jenisAtribut: baruJenisAtribut.length,
      tingkatHarga: baruTingkatHarga.length,
      kategori: baruKategori.length,
      pengguna: baruPengguna,
    };
  });
}
