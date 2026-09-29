import { eq, sql } from 'drizzle-orm';
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
  {
    kode: 'nama_badan_usaha',
    nilai: 'UD. Sumber Urip',
    tipe: 'TEKS',
    deskripsi: 'Baris kedua kop',
  },
  {
    kode: 'alamat_toko',
    nilai: 'Jl. Peterongan No. 104, Peterongan, Jombang 61483',
    tipe: 'TEKS',
    deskripsi: 'Alamat pada kop',
  },
  { kode: 'telp_toko', nilai: '(0321) 862620', tipe: 'TEKS', deskripsi: 'Telepon pada kop' },
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
    deskripsi: 'Lebar kertas struk: 58 atau 80',
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
    deskripsi: 'HARGA_BELI_TERAKHIR atau HPP_RATA2 (K-009)',
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
    kode: 'term_hari_default',
    nilai: '0',
    tipe: 'ANGKA',
    deskripsi: 'Term piutang pelanggan baru (hari)',
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
];

/** Akun demo per peran (hanya NODE_ENV=development; docs/03 §6, K-021). */
const NAMA_DEMO: Record<Peran, string> = {
  OWNER: 'Demo Owner',
  ADMIN: 'Demo Admin',
  KASIR: 'Demo Kasir',
  STAF_PENJUALAN: 'Demo Staf',
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

// Angka markup contoh; Admin mengubahnya dari halaman Pengaturan.
const TINGKAT_HARGA = [
  { kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', urutan: 1, isDefault: true },
  { kode: 'GROSIR', nama: 'Grosir', markupDefaultPersen: '20', urutan: 2, isDefault: false },
  {
    kode: 'DISTRIBUTOR',
    nama: 'Distributor',
    markupDefaultPersen: '15',
    urutan: 3,
    isDefault: false,
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
  opsi: { passwordOwner: string; akunDemo: boolean },
): Promise<RingkasanSeed> {
  // Hash dihitung di luar transaksi agar transaksi tetap singkat.
  const hashOwner = await hashPassword(opsi.passwordOwner);

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
    const owner = await pastikanPengguna(tx, {
      username: 'owner',
      namaPengguna: 'Owner',
      peran: 'OWNER',
      passwordHash: hashOwner,
      wajibGantiPassword: true,
    });
    if (owner) baruPengguna++;

    if (opsi.akunDemo) {
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
