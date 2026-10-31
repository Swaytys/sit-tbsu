import { z } from 'zod';
import { AKSI_LOG } from '../log';
import { KERTAS_DOKUMEN, STRUK_CETAK, type KertasDokumen, type StrukCetak } from '../enums';
import { KODE_DOKUMEN } from '../penomoran';
import { JENIS_USAHA, type JenisUsaha, type LayananToko } from './setup-awal';
import { skemaHalaman } from './umum';

/*
 * Pengaturan toko (roadmap Fase 2; nilai disimpan di tabel `konfigurasi`, docs/03 §6 dan docs/05 §15).
 * Dikelompokkan per bagian; tiap bagian disimpan sendiri lewat `PATCH /api/pengaturan`.
 */

const bulat = (label: string, min: number, maks: number) =>
  z.coerce
    .number(`${label} harus berupa angka.`)
    .int(`${label} harus bilangan bulat.`)
    .min(min, `${label} minimal ${min}.`)
    .max(maks, `${label} maksimal ${maks}.`);

const teks = (label: string, maks: number, wajib = false) => {
  const dasar = z.string().trim().max(maks, `${label} maksimal ${maks} karakter.`);
  return wajib ? dasar.min(1, `${label} wajib diisi.`) : dasar;
};

export const skemaProfilToko = z.object({
  namaToko: teks('Nama toko', 100, true),
  namaBadanUsaha: teks('Nama badan usaha', 100),
  /** K-205/K-207: jenis usaha, slogan, dan kota dari setup awal (tampil di halaman masuk dan kop). */
  jenisUsaha: z.enum(JENIS_USAHA, 'Jenis usaha tidak valid.'),
  jenisUsahaLain: teks('Jenis usaha', 60),
  sloganToko: teks('Slogan', 120),
  kotaToko: teks('Kota/kabupaten', 80),
  alamatToko: teks('Alamat', 255),
  telpToko: teks('Telepon', 50),
  emailToko: z.union([z.literal(''), z.email('Format email tidak valid.')]),
  footerStruk: teks('Teks footer struk', 255),
  lebarStrukMm: z.coerce
    .number()
    .refine((v) => v === 57 || v === 58 || v === 80, 'Lebar struk hanya 57, 58, atau 80 mm.'),
  /** Kop struk memakai nama toko / logo toko (K-065). */
  strukTampilkanNama: z.boolean(),
  strukTampilkanLogo: z.boolean(),
  /** K-095: cetak struk setelah bayar. */
  strukCetak: z.enum(STRUK_CETAK, 'Pilihan cetak struk tidak valid.'),
  /** K-124: cetak otomatis invoice pengantaran dan surat jalan setelah dibuat. */
  invoiceCetak: z.enum(STRUK_CETAK, 'Pilihan cetak invoice tidak valid.'),
  suratJalanCetak: z.enum(STRUK_CETAK, 'Pilihan cetak surat jalan tidak valid.'),
  /** K-124: kertas dokumen lembaran. */
  kertasInvoice: z.enum(KERTAS_DOKUMEN, 'Pilihan kertas tidak valid.'),
  kertasSuratJalan: z.enum(KERTAS_DOKUMEN, 'Pilihan kertas tidak valid.'),
  kertasDokumenLain: z.enum(KERTAS_DOKUMEN, 'Pilihan kertas tidak valid.'),
  /** K-187: surat jalan dicetak 2 rangkap (asli + salinan). */
  suratJalanRangkap: z.boolean(),
});

/** Pilihan jumlah baris per halaman tabel (K-065). */
export const PILIHAN_BARIS_PER_HALAMAN = [10, 25, 50, 100] as const;

export const skemaPrefixDokumen = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,5}$/, 'Prefix 2–5 huruf.');

export const skemaPenomoran = z
  .object({
    prefix: z.object(
      Object.fromEntries(KODE_DOKUMEN.map((k) => [k, skemaPrefixDokumen])) as Record<
        (typeof KODE_DOKUMEN)[number],
        typeof skemaPrefixDokumen
      >,
    ),
    digitNomor: bulat('Digit nomor urut', 3, 6),
  })
  .superRefine((v, ctx) => {
    // Prefix harus unik agar nomor dokumen berbeda jenis tidak tertukar (docs/05 N1–N2).
    const dipakai = new Map<string, string>();
    for (const [kode, prefix] of Object.entries(v.prefix)) {
      const pemilik = dipakai.get(prefix);
      if (pemilik) {
        ctx.addIssue({
          code: 'custom',
          path: ['prefix', kode],
          message: `Prefix ${prefix} sudah dipakai ${pemilik}.`,
        });
      }
      dipakai.set(prefix, kode);
    }
  });

/** Jam `HH:mm` (00:00–23:59) atau kosong. */
const jamAtauKosong = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d)?$/, `${label} harus berbentuk JJ:MM, mis. 09:00.`);

export const skemaOperasional = z
  .object({
    ambangRestockPersen: bulat('Ambang restock', 0, 100),
    stokMinimumDefault: bulat('Stok minimum bawaan', 0, 1_000_000),
    batasUmurOrderJam: bulat('Batas umur order', 1, 720),
    autoBatalOrderBasi: z.boolean(),
    batasKunciOrderMenit: bulat('Batas kunci order', 5, 1440),
    termHariDefault: bulat('Term piutang bawaan', 0, 365),
    jatuhTempoDefaultHari: bulat('Jatuh tempo bawaan', 0, 365),
    checkoutWajibShift: z.boolean(),
    /**
     * K-109: jadwal shift toko (`HH:mm`, zona Asia/Jakarta; kosong = tanpa jadwal). Dibekukan ke tiap shift
     * saat shift itu dibuka, jadi perubahan di sini baru berlaku untuk shift yang dibuka sesudahnya.
     */
    shiftJamBuka: jamAtauKosong('Jam buka shift'),
    shiftJamTutup: jamAtauKosong('Jam tutup shift'),
    /** K-121: selisih kas yang dianggap selisih receh (rupiah). */
    toleransiSelisihKas: bulat('Toleransi selisih kas', 0, 100_000),
    /** K-121: batas menit hitung susulan untuk cara buka "hitung nanti". */
    batasHitungBukaMenit: bulat('Batas hitung susulan', 5, 480),
    /** K-113 (RO1–RO3): parameter rekomendasi pemesanan ulang. */
    saranPesanPeriodeHari: bulat('Periode pengamatan penjualan', 7, 365),
    saranPesanHariPengaman: bulat('Hari stok pengaman', 0, 60),
    saranPesanLamaKirim: bulat('Lama kirim bawaan', 0, 365),
    saranPesanJarakBelanja: bulat('Jarak belanja bawaan', 1, 365),
    /** K-161: muatan kendaraan (docs/13 §3). */
    muatanFaktorIsiPersen: bulat('Faktor isi bak', 40, 100),
    muatanJulurMaksCm: bulat('Julur maksimum', 0, 300),
    /** K-203: muatan (berat/ruang) di atas 100% sampai batas ini boleh berangkat dengan alasan; di atasnya ditolak. */
    muatanToleransiPersen: bulat('Batas toleransi muatan', 100, 150),
    /**
     * K-099: nilai retur/void per transaksi yang boleh diproses Kasir tanpa persetujuan Admin/Owner
     * (rupiah; 0 = selalu butuh persetujuan).
     */
    batasReturTanpaSetuju: bulat('Batas retur tanpa persetujuan', 0, 1_000_000_000),
    batasVoidTanpaSetuju: bulat('Batas void tanpa persetujuan', 0, 1_000_000_000),
    barisPerHalaman: z.coerce
      .number('Jumlah baris harus berupa angka.')
      .refine(
        (v) => (PILIHAN_BARIS_PER_HALAMAN as readonly number[]).includes(v),
        'Pilih 10, 25, 50, atau 100 baris.',
      ),
  })
  .refine(
    (d) => d.shiftJamBuka === '' || d.shiftJamTutup === '' || d.shiftJamBuka < d.shiftJamTutup,
    { path: ['shiftJamTutup'], message: 'Jam tutup shift harus setelah jam buka.' },
  );

/** Dasar markup harga jual otomatis (docs/06 H3). K-184: FIFO = harga beli lapisan stok tertua yang masih ada. */
export const DASAR_MARKUP = ['HARGA_BELI_TERAKHIR', 'HPP_RATA2', 'FIFO'] as const;
export type DasarMarkup = (typeof DASAR_MARKUP)[number];

export const skemaHargaDiskon = z.object({
  dasarMarkup: z.enum(DASAR_MARKUP),
  pembulatanHarga: bulat('Pembulatan harga', 1, 100_000),
});

export const skemaKeamanan = z.object({
  loginMaksGagal: bulat('Batas gagal login', 3, 20),
  loginKunciMenit: bulat('Lama kunci akun', 1, 1440),
  passwordMin: bulat('Panjang minimal password', 8, 64),
});

export const skemaPengaturan = z.object({
  profil: skemaProfilToko,
  penomoran: skemaPenomoran,
  operasional: skemaOperasional,
  harga: skemaHargaDiskon,
  keamanan: skemaKeamanan,
});
export type Pengaturan = z.output<typeof skemaPengaturan>;
export type BagianPengaturan = keyof Pengaturan;

/** Satu atau beberapa bagian sekaligus. */
export const skemaUbahPengaturan = skemaPengaturan
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada pengaturan yang dikirim.');
export type InputUbahPengaturan = z.input<typeof skemaUbahPengaturan>;

/** Identitas toko dan preferensi tampilan yang boleh dibaca semua pengguna login (K-065). */
export type TampilanToko = {
  namaToko: string;
  namaBadanUsaha: string;
  jenisUsaha: JenisUsaha;
  sloganToko: string;
  kotaToko: string;
  /** K-205: cara toko melayani pembeli (menyesuaikan tur). */
  layananToko: LayananToko[];
  /** URL logo (dilayani API), `null` bila belum ada. */
  logo: string | null;
  barisPerHalaman: number;
  /** Kop & kaki struk/invoice (P14). */
  alamatToko: string;
  telpToko: string;
  /** Kop laporan (Fase 7); boleh kosong. */
  emailToko: string;
  footerStruk: string;
  lebarStrukMm: 57 | 58 | 80;
  strukTampilkanNama: boolean;
  strukTampilkanLogo: boolean;
  strukCetak: StrukCetak;
  invoiceCetak: StrukCetak;
  suratJalanCetak: StrukCetak;
  kertasInvoice: KertasDokumen;
  kertasSuratJalan: KertasDokumen;
  kertasDokumenLain: KertasDokumen;
  suratJalanRangkap: boolean;
};

// --- Log aktivitas (Pengaturan › tab Log Aktivitas, izin sistem.log.lihat; docs/04 §8) ---

export const skemaCariLog = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  aksi: z.enum(AKSI_LOG).optional(),
});
export type ParamCariLog = z.input<typeof skemaCariLog>;

const tanggalLog = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} harus berformat tanggal.`)
    .optional();

/** Ekspor log ke Excel (Owner): saringan sama dengan layar ditambah rentang tanggal (WIB). */
export const skemaEksporLog = z
  .object({
    cari: z.string().trim().max(100).optional(),
    aksi: z.enum(AKSI_LOG).optional(),
    dari: tanggalLog('Tanggal awal'),
    sampai: tanggalLog('Tanggal akhir'),
  })
  .refine((v) => !v.dari || !v.sampai || v.dari <= v.sampai, {
    message: 'Tanggal awal tidak boleh setelah tanggal akhir.',
    path: ['sampai'],
  });
export type ParamEksporLog = z.input<typeof skemaEksporLog>;

/** Batas baris satu berkas ekspor log; lebih dari itu persempit tanggal. */
export const BATAS_EKSPOR_LOG = 50000;

export type BarisLog = {
  id: number;
  waktu: string;
  idPengguna: number | null;
  namaPengguna: string | null;
  usernamePercobaan: string | null;
  aksi: string;
  entitas: string | null;
  idEntitas: number | null;
  nomorDokumen: string | null;
  ringkasan: string | null;
  dataLama: unknown;
  dataBaru: unknown;
  ip: string | null;
};
