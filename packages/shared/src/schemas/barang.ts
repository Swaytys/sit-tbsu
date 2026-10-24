import { z } from 'zod';
import {
  KEPEMILIKAN,
  STATUS_AKTIF,
  type Kepemilikan,
  type MetodeHarga,
  type StatusAktif,
  type StatusStok,
  type TipeNilai,
} from '../enums';
import { POLA_QTY } from '../qty';
import { skemaHalaman, skemaRupiah, teksOpsional } from './umum';

/*
 * Barang, harga jual per tier, dan tingkat harga (docs/03 §3.2, docs/06 §1, K-047). Barang tidak dihapus;
 * dinonaktifkan (K-021). Field sensitif (harga modal, HPP, harga titip) hanya dikirim API ke pemegang
 * `master.barang.lihat_hpp` (CLAUDE.md aturan 6); di tipe respons ditandai opsional.
 */

const kosongJadiUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const angkaKeTeks = (v: unknown) =>
  typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : v;

/**
 * Angka desimal opsional untuk data muatan (K-161): kosong = `null`, koma boleh, `desimal` angka di belakang koma,
 * harus > 0 kecuali `bolehNol`.
 */
const angkaMuatan = (label: string, desimal: number, maks: number, bolehNol = false) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : angkaKeTeks(v)),
    z
      .string()
      .regex(
        new RegExp(String.raw`^\d+(\.\d{1,${desimal}})?$`),
        `${label} harus angka dengan paling banyak ${desimal} angka di belakang koma.`,
      )
      .refine((v) => (bolehNol ? Number(v) >= 0 : Number(v) > 0), `${label} harus lebih dari 0.`)
      .refine((v) => Number(v) <= maks, `${label} terlalu besar.`)
      .nullable(),
  );

/**
 * K-161: data muatan per satuan dasar (berat dan ukuran kemasan, untuk menghitung muatan kendaraan). Disimpan
 * dalam kg, cm, dan m³; form boleh memakai satuan lain yang sejenis lalu mengonversinya dengan `konversiKe`.
 */
export const skemaMuatanBarang = z
  .object({
    beratKg: angkaMuatan('Berat', 3, 100_000, true),
    panjangCm: angkaMuatan('Panjang', 1, 100_000),
    lebarCm: angkaMuatan('Lebar', 1, 100_000),
    tinggiCm: angkaMuatan('Tinggi', 1, 100_000),
    curah: z.boolean().default(false),
    volumeM3: angkaMuatan('Volume', 4, 10_000),
  })
  .superRefine((m, ctx) => {
    const ukuran = [m.panjangCm, m.lebarCm, m.tinggiCm];
    if (!m.curah && ukuran.some((u) => u !== null) && ukuran.some((u) => u === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['panjangCm'],
        message: 'Isi panjang, lebar, dan tinggi sekaligus (atau kosongkan ketiganya).',
      });
    }
    if (m.curah && m.volumeM3 === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['volumeM3'],
        message: 'Barang curah wajib punya volume per satuan dasar (mis. 1 m³).',
      });
    }
  });
export type InputMuatanBarang = z.input<typeof skemaMuatanBarang>;
export type DataMuatanBarang = z.output<typeof skemaMuatanBarang>;
export type MuatanBarang = DataMuatanBarang;

/** Kode barang: huruf besar, angka, titik, garis bawah, strip; maks. 12 (N5: boleh kode sendiri). */
export const skemaKodeBarang = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Kode barang wajib diisi.')
  .max(12, 'Kode barang maksimal 12 karakter.')
  .regex(/^[A-Z0-9._-]+$/, 'Kode hanya boleh huruf, angka, titik, garis bawah, atau strip.');

/** Qty dari form (boleh koma) → string desimal, mis. "2,5" → "2.5". */
export const skemaQtyTeks = (label: string) =>
  z.preprocess(
    angkaKeTeks,
    z
      .string(`${label} wajib diisi.`)
      .regex(POLA_QTY, `${label} harus angka ≥ 0, maksimal 3 desimal.`),
  );

/** Persen markup numeric(6,2): 0–999,99. */
export const skemaPersen = z.preprocess(
  angkaKeTeks,
  z
    .string('Persen wajib diisi.')
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Persen harus angka 0–999 dengan maksimal 2 desimal.'),
);

const idWajib = (pesan: string) => z.number(pesan).int(pesan).positive(pesan);

// --- Atribut dan harga di form barang ---

export const skemaAtributBarang = z.object({
  idJenisAtribut: idWajib('Jenis atribut wajib dipilih.'),
  /** Teks apa adanya untuk atribut TEKS; angka (boleh koma) untuk atribut ANGKA. */
  nilai: z
    .string('Nilai atribut wajib diisi.')
    .trim()
    .min(1, 'Nilai atribut wajib diisi.')
    .max(150, 'Nilai atribut maksimal 150 karakter.'),
  idSatuan: z.number().int().positive().nullable().optional(),
});
export type InputAtributBarang = z.input<typeof skemaAtributBarang>;

/**
 * Harga satu tier (docs/06 H4): `hargaTetap` angka = TETAP; `markupPersen` diisi = MARKUP (persen sendiri
 * untuk barang ini); keduanya kosong = IKUT_TIER (markup default tier, K-047). Hanya tier dasar yang boleh
 * TETAP/MARKUP; tier lain selalu IKUT_TIER untuk semua barang (K-098, ditegakkan API).
 */
const bentukHargaTier = z.object({
  idTingkatHarga: idWajib('Tier wajib dipilih.'),
  hargaTetap: skemaRupiah.nullable(),
  markupPersen: skemaPersen.nullable().optional(),
});

function cekHargaTier(
  h: { hargaTetap: number | null; markupPersen?: string | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (h.hargaTetap !== null && h.markupPersen !== null && h.markupPersen !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['markupPersen'],
      message: 'Pilih salah satu: harga tetap atau markup persen.',
    });
  }
}

export const skemaHargaTier = bentukHargaTier.superRefine(cekHargaTier);
export type InputHargaTier = z.input<typeof skemaHargaTier>;

// --- Barang ---

export const skemaBarang = z
  .object({
    /** Kosong = otomatis `BRG-00001` (N5). */
    kode: z.preprocess(kosongJadiUndefined, skemaKodeBarang.optional()),
    barcode: teksOpsional(64, 'Barcode maksimal 64 karakter.').refine(
      (v) => v === null || v === undefined || /^[\x21-\x7E]+$/.test(v),
      'Barcode tidak boleh berisi spasi atau karakter khusus.',
    ),
    namaBarang: z
      .string('Nama barang wajib diisi.')
      .trim()
      .min(1, 'Nama barang wajib diisi.')
      .max(150, 'Nama barang maksimal 150 karakter.')
      // Tanda * dipakai kasir untuk qty ("3*semen" / "semen*3").
      .refine((v) => !v.includes('*'), 'Nama barang tidak boleh memakai tanda *.'),
    idKategori: idWajib('Kategori wajib dipilih.'),
    /** `null` = tanpa merk (K-063). */
    idMerk: z.number().int().positive().nullable().optional(),
    idSatuanDasar: idWajib('Satuan dasar wajib dipilih.'),
    /** Kosong = `konfigurasi.stok_minimum_default` untuk barang baru; nilai lama untuk ubah. */
    stokMinimum: z.preprocess(kosongJadiUndefined, skemaQtyTeks('Stok minimum').optional()),
    hargaModalAwal: z.preprocess((v) => (v === null || v === '' ? 0 : v), skemaRupiah).default(0),
    kepemilikan: z.enum(KEPEMILIKAN).default('MILIK_SENDIRI'),
    idPemasokKonsinyasi: z.number().int().positive().nullable().optional(),
    hargaTitip: skemaRupiah.nullable().optional(),
    keterangan: teksOpsional(255, 'Keterangan maksimal 255 karakter.'),
    atribut: z.array(skemaAtributBarang).max(30, 'Maksimal 30 atribut.').default([]),
    /** Saat tambah: tier yang tidak dikirim ikut markup tier. Saat ubah: tidak dikirim = tidak diubah. */
    hargaTier: z.array(skemaHargaTier).optional(),
    /**
     * H7: harga IKUT_TIER/MARKUP mengikuti perubahan dasar secara otomatis (naik langsung, turun ditinjau;
     * K-086). Tidak dikirim = tetap (barang baru: otomatis, K-094). Mengubahnya butuh `master.harga.kelola`.
     */
    hargaOtomatis: z.boolean().optional(),
    /** K-161: data muatan; tidak dikirim saat ubah = tidak diubah. */
    muatan: skemaMuatanBarang.optional(),
    /** K-164: versi data yang dimuat form (waktu ubah terakhir); beda dengan versi sekarang = ditolak. */
    versi: z.string().max(40).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.kepemilikan === 'KONSINYASI') {
      if (!d.idPemasokKonsinyasi) {
        ctx.addIssue({
          code: 'custom',
          path: ['idPemasokKonsinyasi'],
          message: 'Pemasok konsinyasi wajib dipilih.',
        });
      }
      if (d.hargaTitip === null || d.hargaTitip === undefined) {
        ctx.addIssue({ code: 'custom', path: ['hargaTitip'], message: 'Harga titip wajib diisi.' });
      }
    }
    const terlihat = new Set<number>();
    d.atribut.forEach((a, i) => {
      if (terlihat.has(a.idJenisAtribut)) {
        ctx.addIssue({
          code: 'custom',
          path: ['atribut', i, 'idJenisAtribut'],
          message: 'Atribut ini sudah ada di baris lain.',
        });
      }
      terlihat.add(a.idJenisAtribut);
    });
  });
export type InputBarang = z.input<typeof skemaBarang>;
export type DataBarang = z.output<typeof skemaBarang>;

export const skemaCariBarang = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idKategori: z.coerce.number().int().positive().optional(),
  idMerk: z.coerce.number().int().positive().optional(),
  status: z.enum([...STATUS_AKTIF, 'SEMUA']).default('SEMUA'),
  perluTinjau: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  kepemilikan: z.enum(KEPEMILIKAN).optional(),
  /** Hanya barang yang punya stok rusak (tab Stok Rusak, SR1). */
  adaRusak: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** K-161: hanya barang yang data muatannya (berat, ukuran/volume) belum lengkap. */
  muatanBelum: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ParamCariBarang = z.input<typeof skemaCariBarang>;

export type HargaTierBarang = {
  idTingkatHarga: number;
  metode: MetodeHarga;
  hargaTetap: number | null;
  hargaJual: number;
  /** Persen markup sendiri (metode MARKUP); hanya untuk pemegang `master.barang.lihat_hpp`. */
  markupPersen?: string | null;
  /** H12: (harga jual − D) ÷ harga jual dalam persen, 2 desimal; hanya untuk `master.barang.lihat_hpp`. */
  margin?: number | null;
};

/** Satuan jual barang (K-091) beserta harga per tier yang berlaku (tetap, atau otomatis dari satuan dasar). */
export type SatuanJualBarang = {
  id: number;
  idSatuan: number;
  kodeSatuan: string;
  namaSatuan: string;
  /** Faktor ke satuan dasar, teks desimal (mis. "12", "0.25"). */
  faktor: string;
  barcode: string | null;
  isDefaultJual: boolean;
  statusAktif: StatusAktif;
  harga: { idTingkatHarga: number; hargaJual: number; tetap: boolean }[];
};

/** Baris daftar barang. Kolom bertanda `?` hanya untuk pemegang `master.barang.lihat_hpp`. */
export type BarisBarang = {
  id: number;
  kode: string;
  barcode: string | null;
  namaBarang: string;
  idKategori: number;
  namaKategori: string;
  idMerk: number | null;
  namaMerk: string | null;
  idSatuanDasar: number;
  kodeSatuan: string;
  stokMinimum: string;
  stokFisik: string;
  stokTersedia: string;
  /** Stok kondisi rusak (bucket RUSAK): tidak bisa dijual, menunggu retur pemasok atau dimusnahkan. */
  stokRusak: string;
  /** ST1, dihitung API dari stok fisik dan minimum. */
  statusStok: StatusStok;
  kepemilikan: Kepemilikan;
  idPemasokKonsinyasi: number | null;
  namaPemasokKonsinyasi: string | null;
  perluTinjauHarga: boolean;
  /** H7: harga IKUT_TIER/MARKUP mengikuti dasar markup secara otomatis. */
  hargaOtomatis: boolean;
  /** URL gambar (dilayani API dengan izin), `null` bila belum ada. */
  gambar: string | null;
  statusAktif: StatusAktif;
  /** Harga per tier (satuan dasar). */
  harga: HargaTierBarang[];
  /** K-091: satuan jual (aktif dan nonaktif); transaksi hanya memakai yang aktif. */
  satuanJual: SatuanJualBarang[];
  /** Pencarian tepat sama dengan barcode satuan jual: satuan jual itu (pindai barcode dus, dsb.). */
  idSatuanJualCocok: number | null;
  /** Atribut ringkas (pembeda barang mirip di hasil cari), mis. { nama: 'Panjang', nilai: '6 m' }. */
  ringkasAtribut: RingkasAtribut[];
  hargaModalAwal?: number;
  hargaTitip?: number | null;
  hppRata2?: number;
  hargaBeliTerakhir?: number;
  /** Dasar markup `D` saat ini (docs/06 H3). */
  dasarMarkup?: number;
};

export type RingkasAtribut = { nama: string; nilai: string };

export type AtributBarang = {
  idJenisAtribut: number;
  kodeJenis: string;
  namaJenis: string;
  tipeNilai: TipeNilai;
  /** Angka sebagai teks desimal (tanpa nol di belakang) atau teks. */
  nilai: string;
  idSatuan: number | null;
  kodeSatuan: string | null;
};

export type DetailBarang = BarisBarang & {
  keterangan: string | null;
  atribut: AtributBarang[];
  /** Sudah ada mutasi stok: satuan dasar dan harga modal awal dikunci (K-060). */
  sudahAdaMutasi: boolean;
  /** K-161: data muatan per satuan dasar. */
  muatan: MuatanBarang;
  /** K-164: waktu ubah terakhir (ISO), dikirim balik saat menyimpan perubahan. */
  versi: string;
};

// --- Harga jual massal (halaman Harga Jual, H13) ---

export const skemaSimpanHarga = z.object({
  perubahan: z
    .array(
      bentukHargaTier
        .extend({ idBarang: idWajib('Barang tidak valid.') })
        .superRefine(cekHargaTier),
    )
    .min(1, 'Tidak ada perubahan harga.')
    .max(1000, 'Maksimal 1000 perubahan sekali simpan.'),
});
export type InputSimpanHarga = z.input<typeof skemaSimpanHarga>;
export type DataSimpanHarga = z.output<typeof skemaSimpanHarga>;

/** H7 (K-094): nyalakan/matikan harga otomatis beberapa barang sekaligus dari halaman Harga Jual. */
export const skemaHargaOtomatis = z.object({
  idBarang: z
    .array(idWajib('Barang tidak valid.'))
    .min(1, 'Pilih barang.')
    .max(1000, 'Maksimal 1000 barang sekali ubah.'),
  hargaOtomatis: z.boolean(),
});
export type InputHargaOtomatis = z.input<typeof skemaHargaOtomatis>;

// --- Tinjau Harga (docs/06 H6, K-086) ---

export const skemaCariTinjauHarga = skemaHalaman.extend({
  cari: z.string().trim().max(100).optional(),
  idKategori: z.coerce.number().int().positive().optional(),
});
export type ParamCariTinjauHarga = z.input<typeof skemaCariTinjauHarga>;

/** Satu tier di baris Tinjau Harga. Semua angka dihitung API (hanya untuk pemegang lihat_hpp). */
export type TierTinjauHarga = {
  idTingkatHarga: number;
  namaTier: string;
  isDefault: boolean;
  metode: MetodeHarga;
  /** Persen yang dipakai usulan: markup tier (IKUT_TIER dan tier default) atau markup barang (MARKUP). */
  markupPersen: string | null;
  hargaSekarang: number;
  /** D saat harga sekarang dihitung (IKUT_TIER/MARKUP); `null` untuk TETAP. */
  dasarLama: number | null;
  /** Harga usulan (H4); `null` = tanpa usulan (harga tetap tier selain default). */
  hargaUsulan: number | null;
  /** Margin harga sekarang dan usulan terhadap dasar baru (H12). */
  marginSekarang: number | null;
  marginUsulan: number | null;
};

export type BarisTinjauHarga = {
  id: number;
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  kepemilikan: Kepemilikan;
  hargaOtomatis: boolean;
  /** Dasar markup `D` sekarang (H3). */
  dasarBaru: number;
  tier: TierTinjauHarga[];
};

export const skemaTerapkanTinjau = z.object({
  /** `dasar` = dasar baru yang terlihat di layar; bila sudah berubah, penerapan ditolak (muat ulang). */
  barang: z
    .array(z.object({ idBarang: idWajib('Barang tidak valid.'), dasar: skemaRupiah }))
    .min(1, 'Pilih barang yang akan diterapkan.')
    .max(1000, 'Maksimal 1000 barang sekali terapkan.'),
  /** Usulan tier default ikut menggantikan harga tetapnya (K-086). */
  termasukTierDefault: z.boolean().default(true),
});
export type InputTerapkanTinjau = z.input<typeof skemaTerapkanTinjau>;
export type DataTerapkanTinjau = z.output<typeof skemaTerapkanTinjau>;

export const skemaAbaikanTinjau = z.object({
  idBarang: z
    .array(idWajib('Barang tidak valid.'))
    .min(1, 'Pilih barang yang akan diabaikan.')
    .max(1000, 'Maksimal 1000 barang sekali abaikan.'),
});
export type InputAbaikanTinjau = z.input<typeof skemaAbaikanTinjau>;

export type HasilTinjauHarga = { jumlahBarang: number; jumlahPerubahan: number };

// --- Tingkat harga (tier) ---

export const skemaTingkatHargaInput = z.object({
  kode: z
    .string('Kode tier wajib diisi.')
    .trim()
    .toUpperCase()
    .min(1, 'Kode tier wajib diisi.')
    .max(20, 'Kode tier maksimal 20 karakter.')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Kode tier huruf besar/angka/garis bawah, diawali huruf.'),
  nama: z
    .string('Nama tier wajib diisi.')
    .trim()
    .min(1, 'Nama tier wajib diisi.')
    .max(50, 'Nama tier maksimal 50 karakter.'),
  markupDefaultPersen: skemaPersen,
  /**
   * K-098: total nilai belanja transaksi (rupiah, dihitung dengan harga tier dasar) agar tier dipakai otomatis
   * untuk semua barang; tier dasar selalu kosong; tier lain wajib terisi selama aktif (K-099).
   */
  minBelanja: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    skemaRupiah.refine((v) => v > 0, 'Mulai belanja harus lebih dari Rp 0.').nullable(),
  ),
  urutan: z.coerce
    .number('Urutan harus berupa angka.')
    .int('Urutan harus bilangan bulat.')
    .min(0, 'Urutan minimal 0.')
    .max(9999, 'Urutan maksimal 9999.')
    .default(0),
});
export type InputTingkatHarga = z.input<typeof skemaTingkatHargaInput>;
export type DataTingkatHarga = z.output<typeof skemaTingkatHargaInput>;

// --- Import Excel barang (K-056: hanya menambah barang baru) ---

export const STATUS_BARIS_IMPORT = ['SIAP', 'DILEWATI', 'GALAT', 'DISIMPAN'] as const;
export type StatusBarisImport = (typeof STATUS_BARIS_IMPORT)[number];

export type BarisImportBarang = {
  /** Nomor baris di lembar Excel (seperti yang terlihat di Excel). */
  nomorBaris: number;
  kode: string | null;
  namaBarang: string;
  status: StatusBarisImport;
  pesan: string[];
};

export type HasilImportBarang = {
  baris: BarisImportBarang[];
  ringkasan: { total: number; siap: number; dilewati: number; galat: number; disimpan: number };
  disimpan: boolean;
};

/** Jenis isian kolom import (menentukan kontrol di layar sunting baris). */
export const JENIS_KOLOM_IMPORT = [
  'TEKS',
  'RUPIAH',
  'QTY',
  'KATEGORI',
  'MERK',
  'SATUAN',
  'KEPEMILIKAN',
  'PEMASOK',
  'STATUS',
] as const;
export type JenisKolomImport = (typeof JENIS_KOLOM_IMPORT)[number];

export type KolomImportBarang = {
  /** Kunci kolom huruf kecil, mis. `nama_barang`, `harga_normal`, `atribut_panjang`. */
  kunci: string;
  label: string;
  jenis: JenisKolomImport;
  wajib: boolean;
  petunjuk: string;
};

/** Satu baris berkas: isi sel sebagai teks per kunci kolom (kosong tidak dikirim). */
export const skemaBarisImport = z.object({
  nomorBaris: z.number().int().positive(),
  nilai: z.record(z.string().max(60), z.string().max(255)),
});
export type BarisImportMentah = z.infer<typeof skemaBarisImport>;

/** Hasil membaca berkas: kolom yang dikenali, baris, dan peringatan (kolom tak dikenal diabaikan). */
export type BacaImportBarang = {
  namaBerkas: string;
  kolom: KolomImportBarang[];
  baris: BarisImportMentah[];
  peringatan: string[];
};

export const skemaProsesImport = z.object({
  namaBerkas: z.string().trim().max(100).default('berkas'),
  baris: z.array(skemaBarisImport).min(1, 'Tidak ada baris.').max(2000, 'Maksimal 2000 baris.'),
  /** Kode di baris lain berkas (untuk cek kode ganda saat hanya sebagian baris diperiksa ulang). */
  kodeLain: z.array(z.string().max(12)).max(2000).default([]),
});
export type InputProsesImport = z.input<typeof skemaProsesImport>;

// --- Isi massal data muatan lewat Excel (K-161) ---

/** BERUBAH = akan/bisa disimpan, SAMA = tidak ada perubahan, DISIMPAN = sudah disimpan. */
export const STATUS_BARIS_MUATAN = ['BERUBAH', 'SAMA', 'GALAT', 'DISIMPAN'] as const;
export type StatusBarisMuatan = (typeof STATUS_BARIS_MUATAN)[number];

export type BarisImportMuatan = {
  nomorBaris: number;
  kode: string | null;
  namaBarang: string;
  status: StatusBarisMuatan;
  /** Mis. "berat 0,5 → 50 kg". */
  perubahan: string[];
  pesan: string[];
};

export type HasilImportMuatan = {
  baris: BarisImportMuatan[];
  ringkasan: { total: number; berubah: number; sama: number; galat: number; disimpan: number };
  disimpan: boolean;
};

/** Kolom data di berkas muatan. Kolom yang tidak ada di berkas tidak mengubah data barang. */
export const KOLOM_MUATAN_EXCEL = [
  'berat_kg',
  'panjang_cm',
  'lebar_cm',
  'tinggi_cm',
  'curah',
  'volume_m3',
] as const;
export type KolomMuatanExcel = (typeof KOLOM_MUATAN_EXCEL)[number];

export type BacaImportMuatan = {
  namaBerkas: string;
  /** Kolom data yang ada di berkas. */
  kolom: KolomMuatanExcel[];
  baris: BarisImportMentah[];
  peringatan: string[];
};

export const skemaProsesMuatan = z.object({
  namaBerkas: z.string().trim().max(100).default('berkas'),
  kolom: z.array(z.enum(KOLOM_MUATAN_EXCEL)).min(1, 'Berkas tidak berisi kolom data muatan.'),
  baris: z.array(skemaBarisImport).min(1, 'Tidak ada baris.').max(2000, 'Maksimal 2000 baris.'),
});
export type InputProsesMuatan = z.input<typeof skemaProsesMuatan>;

export const skemaUnduhMuatan = z.object({
  /** `1` = hanya barang aktif yang data muatannya belum lengkap. */
  belum: z.enum(['0', '1']).default('0'),
});

// --- Satuan jual per barang (Fase 12, K-091) ---

const POLA_FAKTOR = /^\d{1,8}(\.\d{1,4})?$/;

export const skemaBarisSatuanJual = z.object({
  idSatuan: idWajib('Satuan wajib dipilih.'),
  faktor: z
    .string('Faktor wajib diisi.')
    .trim()
    .transform((v) => v.replace(',', '.'))
    .refine((v) => POLA_FAKTOR.test(v), 'Faktor berupa angka, paling banyak 4 desimal.')
    .refine((v) => /[1-9]/.test(v), 'Faktor harus lebih dari 0.'),
  barcode: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z
      .string()
      .trim()
      .max(64, 'Barcode maksimal 64 karakter.')
      .regex(/^[\x21-\x7E]+$/, 'Barcode tanpa spasi.')
      .nullable()
      .default(null),
  ),
  isDefaultJual: z.boolean().default(false),
  statusAktif: z.enum(STATUS_AKTIF).default('AKTIF'),
  /** Harga tetap per tier; `null` = otomatis (harga satuan dasar × faktor). Butuh `master.harga.kelola`. */
  hargaTetap: z
    .array(
      z.object({
        idTingkatHarga: idWajib('Tier wajib dipilih.'),
        harga: z.preprocess((v) => (v === '' ? null : v), skemaRupiah.nullable()),
      }),
    )
    .default([]),
});
export type InputBarisSatuanJual = z.input<typeof skemaBarisSatuanJual>;

export const skemaSimpanSatuanJual = z
  .object({ baris: z.array(skemaBarisSatuanJual).max(10, 'Maksimal 10 satuan jual per barang.') })
  .superRefine((d, ctx) => {
    const terlihat = new Map<number, number>();
    d.baris.forEach((b, i) => {
      const lain = terlihat.get(b.idSatuan);
      if (lain !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['baris', i, 'idSatuan'],
          message: `Satuan sama dengan baris ${lain + 1}.`,
        });
      }
      terlihat.set(b.idSatuan, i);
    });
    const bawaan = d.baris.filter((b) => b.isDefaultJual && b.statusAktif === 'AKTIF');
    if (bawaan.length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['baris'],
        message: 'Hanya satu satuan jual yang boleh menjadi bawaan.',
      });
    }
  });
export type InputSimpanSatuanJual = z.input<typeof skemaSimpanSatuanJual>;
export type DataSimpanSatuanJual = z.output<typeof skemaSimpanSatuanJual>;
