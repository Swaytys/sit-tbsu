import { z } from 'zod';
import {
  KONDISI_RETUR,
  METODE_REFUND,
  PENANGANAN_RUSAK,
  STATUS_PERJALANAN,
  type KondisiRetur,
  type PenangananRusak,
  type StatusAktif,
  type StatusPerjalanan,
  type StatusSuratJalan,
  type TingkatPengingat,
} from '../enums';
import { skemaQtyTeks } from './barang';
import { skemaTanggal } from './persediaan';
import { skemaHalaman, skemaNoHpOpsional, skemaRupiah, teksOpsional } from './umum';

/*
 * Kendaraan, sopir, perjalanan, dan hasil pengantaran (docs/05 §7 S8–S12; K-149–K-151).
 */

/** Plat nomor dirapikan: huruf besar, satu spasi antarbagian ("s1234 ab" tidak diterima, "s 1234 ab" → "S 1234 AB"). */
export const skemaPlat = z
  .string('Plat nomor wajib diisi.')
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, 'Plat nomor wajib diisi.')
      .regex(
        /^[A-Z]{1,2} \d{1,4}( [A-Z]{1,3})?$/,
        'Format plat: huruf, angka, huruf. Contoh S 1234 AB.',
      ),
  );

/** Ukuran bak dalam cm (bilangan bulat), boleh kosong. */
const ukuranBak = (label: string) =>
  z
    .number(`${label} harus angka (cm).`)
    .int(`${label} dalam cm bulat.`)
    .min(10, `${label} minimal 10 cm.`)
    .max(2_000, `${label} terlalu besar.`)
    .nullable()
    .default(null);

const tanggalOpsional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid.')
  .nullable()
  .default(null);

export const skemaKendaraan = z.object({
  plat: skemaPlat,
  jenis: z
    .string('Jenis kendaraan wajib diisi.')
    .trim()
    .min(1, 'Jenis kendaraan wajib diisi.')
    .max(30, 'Jenis kendaraan maksimal 30 karakter.'),
  /** Daya angkut (kg) dari buku uji KIR/STNK: JBI dikurangi berat kosong (K-161). */
  kapasitasKg: z
    .number('Daya angkut harus angka.')
    .int('Daya angkut harus bilangan bulat (kg).')
    .min(1, 'Daya angkut minimal 1 kg.')
    .max(100_000, 'Daya angkut terlalu besar.')
    .nullable()
    .default(null),
  bakPanjangCm: ukuranBak('Panjang bak'),
  bakLebarCm: ukuranBak('Lebar bak'),
  bakTinggiCm: ukuranBak('Tinggi bak'),
  berlakuStnk: tanggalOpsional,
  berlakuKir: tanggalOpsional,
  /** K-162: jadwal servis berkala (salah satu atau keduanya). */
  servisTiapKm: z
    .number('Jarak servis harus angka (km).')
    .int('Jarak servis dalam km bulat.')
    .min(100, 'Jarak servis minimal 100 km.')
    .max(100_000, 'Jarak servis terlalu besar.')
    .nullable()
    .default(null),
  servisTiapBulan: z
    .number('Jarak servis harus angka (bulan).')
    .int('Jarak servis dalam bulan bulat.')
    .min(1, 'Jarak servis minimal 1 bulan.')
    .max(60, 'Jarak servis maksimal 60 bulan.')
    .nullable()
    .default(null),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export type InputKendaraan = z.input<typeof skemaKendaraan>;
export type DataKendaraan = z.output<typeof skemaKendaraan>;

export const skemaSopir = z.object({
  nama: z
    .string('Nama sopir wajib diisi.')
    .trim()
    .min(2, 'Nama sopir minimal 2 huruf.')
    .max(100, 'Nama sopir maksimal 100 karakter.'),
  noHp: skemaNoHpOpsional,
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export type InputSopir = z.input<typeof skemaSopir>;
export type DataSopir = z.output<typeof skemaSopir>;

/** Perjalanan yang sedang berjalan (kendaraan/sopir "sedang jalan"). */
export type SedangJalan = { idPerjalanan: number; nomor: string; waktuBerangkat: string };

export type Kendaraan = {
  id: number;
  plat: string;
  jenis: string;
  kapasitasKg: number | null;
  bakPanjangCm: number | null;
  bakLebarCm: number | null;
  bakTinggiCm: number | null;
  berlakuStnk: string | null;
  berlakuKir: string | null;
  servisTiapKm: number | null;
  servisTiapBulan: number | null;
  catatan: string | null;
  statusAktif: StatusAktif;
  jumlahPerjalanan: number;
  sedangJalan: SedangJalan | null;
  kesehatan: KesehatanKendaraan;
};

/** K-162: odometer terakhir, servis berikutnya, dan masa berlaku surat (docs/13 §5.2). */
export type KesehatanKendaraan = {
  odometerKm: number | null;
  odometerTanggal: string | null;
  servisTerakhir: { tanggal: string; odometerKm: number | null; jenis: string } | null;
  /** `null` bila jadwal servis belum diatur atau belum ada catatan servis. */
  servisBerikut: { km: number | null; tanggal: string | null; tingkat: TingkatPengingat } | null;
  stnk: TingkatPengingat | null;
  kir: TingkatPengingat | null;
};

export type Sopir = {
  id: number;
  nama: string;
  noHp: string | null;
  catatan: string | null;
  statusAktif: StatusAktif;
  jumlahPerjalanan: number;
  sedangJalan: SedangJalan | null;
};

// --- Perjalanan ---

export type TingkatMuatan = 'AMAN' | 'HAMPIR_PENUH' | 'KONFIRMASI' | 'DITOLAK' | 'TIDAK_DIKETAHUI';

/** Hasil hitung muatan satu rit (docs/13 §3); dihitung API. */
export type Muatan = {
  beratKg: string;
  volumeM3: string;
  /** Sisi kemasan terpanjang (cm); `null` bila tidak ada data ukuran. */
  terpanjangCm: string | null;
  dayaAngkutKg: number | null;
  /** Volume bak × faktor isi (m³); `null` bila ukuran bak belum diisi. */
  volumeBakM3: string | null;
  panjangBakCm: number | null;
  julurMaksCm: number;
  faktorIsiPersen: number;
  persenBerat: number | null;
  persenVolume: number | null;
  tingkat: { berat: TingkatMuatan; volume: TingkatMuatan; panjang: TingkatMuatan };
  /** Tingkat terburuk: menentukan boleh berangkat, perlu alasan, atau ditolak. */
  kesimpulan: Exclude<TingkatMuatan, 'TIDAK_DIKETAHUI'>;
  /** Barang yang berat/ukurannya belum diisi (dihitung 0). */
  barangTanpaData: string[];
  pesan: string[];
  saran: string[];
};

export const skemaCariPerjalanan = skemaHalaman.extend({
  status: z.enum(STATUS_PERJALANAN).optional(),
  idKendaraan: z.coerce.number().int().positive().optional(),
  idSopir: z.coerce.number().int().positive().optional(),
});

/** K-160: rencana rit (kendaraan, sopir, jadwal) sebelum diisi surat jalan dan berangkat. */
export const skemaRencanaRit = z.object({
  idKendaraan: z.number('Pilih kendaraan.').int().positive('Pilih kendaraan.'),
  idSopir: z.number('Pilih sopir.').int().positive('Pilih sopir.'),
  /** Tanggal-jam rencana berangkat (ISO). */
  jadwalBerangkat: z.iso.datetime({ offset: true, message: 'Isi tanggal dan jam berangkat.' }),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export type InputRencanaRit = z.input<typeof skemaRencanaRit>;
export type DataRencanaRit = z.output<typeof skemaRencanaRit>;

/** Isi rit: surat jalan yang sudah ada, atau invoice (dibuatkan surat jalan untuk semua sisa barangnya). */
export const skemaIsiRit = z
  .object({
    idSuratJalan: z.number().int().positive().optional(),
    idPenjualan: z.number().int().positive().optional(),
  })
  .refine((d) => (d.idSuratJalan === undefined) !== (d.idPenjualan === undefined), {
    message: 'Pilih satu: surat jalan atau invoice.',
  });

export const skemaBerangkatRit = z.object({
  alasanMuatan: teksOpsional(500, 'Alasan maksimal 500 karakter.'),
});

export const skemaBatalRit = z.object({
  alasan: z.string().trim().min(3, 'Alasan wajib diisi (min. 3 huruf).').max(255),
});

export type Perjalanan = {
  id: number;
  nomor: string;
  status: StatusPerjalanan;
  idKendaraan: number;
  plat: string;
  jenisKendaraan: string;
  idSopir: number;
  namaSopir: string;
  noHpSopir: string | null;
  /** `null` untuk rit yang masih direncanakan/batal. */
  waktuBerangkat: string | null;
  waktuKembali: string | null;
  /** K-160: jadwal berangkat rit rencana. */
  jadwalBerangkat: string | null;
  alasanBatal: string | null;
  /** K-161: muatan rit rencana dihitung dari isinya sekarang; rit lain `null` (lihat muatanBeratKg). */
  muatan: Muatan | null;
  muatanBeratKg: string | null;
  muatanVolumeM3: string | null;
  catatan: string | null;
  namaPengguna: string;
  suratJalan: {
    id: number;
    nomor: string;
    status: StatusSuratJalan;
    idPenjualan: number;
    nomorPenjualan: string;
    namaPelanggan: string | null;
    alamatKirim: string;
  }[];
};

// --- Hasil pengantaran (S10) ---

export const skemaHasilSuratJalan = z.object({
  /** Satu baris per baris surat jalan; jumlah keempat qty = qty kirim. */
  baris: z
    .array(
      z.object({
        idPenjualanDetail: z.number().int().positive(),
        qtyDiterima: skemaQtyTeks('Qty diterima'),
        qtyKembali: skemaQtyTeks('Qty kembali utuh'),
        qtyRusak: skemaQtyTeks('Qty rusak'),
        qtyDitolak: skemaQtyTeks('Qty ditolak'),
        kondisiDitolak: z.enum(KONDISI_RETUR).default('BAIK'),
      }),
    )
    .min(1, 'Isi hasil minimal satu barang.'),
  /** Wajib bila ada qty rusak (K-151): pilihan pembeli. */
  penangananRusak: z.enum(PENANGANAN_RUSAK).nullable().default(null),
  /** Dipakai bila nilai barang ditolak/rusak melebihi sisa tagihan (uang dikembalikan). */
  metodeRefund: z.enum(METODE_REFUND).nullable().default(null),
  rekeningRefund: teksOpsional(60, 'Rekening maksimal 60 karakter.'),
  namaPenerima: teksOpsional(100, 'Nama penerima maksimal 100 karakter.'),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export type InputHasilSuratJalan = z.input<typeof skemaHasilSuratJalan>;
export type DataHasilSuratJalan = z.output<typeof skemaHasilSuratJalan>;

export type HasilSuratJalan = {
  waktu: string;
  namaPengguna: string;
  namaPenerima: string | null;
  penangananRusak: PenangananRusak | null;
  catatan: string | null;
  returTukar: { id: number; nomor: string; status: string } | null;
  returUang: { id: number; nomor: string; status: string } | null;
  baris: {
    idPenjualanDetail: number;
    qtyDiterima: string;
    qtyKembali: string;
    qtyRusak: string;
    qtyDitolak: string;
    kondisiDitolak: KondisiRetur | null;
  }[];
};

// --- Catatan BBM dan servis (K-162, docs/13 §5) ---

const odometer = z
  .number('Odometer harus angka (km).')
  .int('Odometer dalam km bulat.')
  .min(0, 'Odometer tidak boleh negatif.')
  .max(9_999_999, 'Odometer terlalu besar.')
  .nullable()
  .default(null);

const idOpsional = z.number().int().positive().nullable().default(null);

export const skemaCatatBbm = z.object({
  idKendaraan: z.number('Kendaraan wajib dipilih.').int().positive('Kendaraan wajib dipilih.'),
  tanggal: skemaTanggal('Tanggal'),
  idSopir: idOpsional,
  idPerjalanan: idOpsional,
  odometerKm: odometer,
  liter: z.preprocess(
    (v) =>
      typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : v,
    z
      .string('Liter wajib diisi.')
      .regex(/^\d{1,4}(\.\d{1,2})?$/, 'Liter: angka dengan paling banyak 2 angka di belakang koma.')
      .refine((v) => Number(v) > 0, 'Liter harus lebih dari 0.'),
  ),
  totalRp: skemaRupiah,
  penuh: z.boolean().default(false),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export type InputCatatBbm = z.input<typeof skemaCatatBbm>;
export type DataCatatBbm = z.output<typeof skemaCatatBbm>;

export const skemaCatatServis = z.object({
  idKendaraan: z.number('Kendaraan wajib dipilih.').int().positive('Kendaraan wajib dipilih.'),
  tanggal: skemaTanggal('Tanggal'),
  odometerKm: odometer,
  jenis: z
    .string('Jenis servis wajib diisi.')
    .trim()
    .min(3, 'Jenis servis minimal 3 huruf, mis. Ganti oli.')
    .max(100, 'Jenis servis maksimal 100 karakter.'),
  biayaRp: skemaRupiah,
  bengkel: teksOpsional(100, 'Nama bengkel maksimal 100 karakter.'),
  catatan: teksOpsional(255, 'Catatan maksimal 255 karakter.'),
});
export type InputCatatServis = z.input<typeof skemaCatatServis>;
export type DataCatatServis = z.output<typeof skemaCatatServis>;

export const skemaBatalCatatan = z.object({
  alasan: z.string().trim().min(3, 'Alasan wajib diisi (min. 3 huruf).').max(255),
});

export const skemaCariCatatanArmada = skemaHalaman.extend({
  idKendaraan: z.coerce.number().int().positive().optional(),
});

type Batal = { batalPada: string | null; alasanBatal: string | null };

export type CatatanBbm = Batal & {
  id: number;
  idKendaraan: number;
  plat: string;
  tanggal: string;
  namaSopir: string | null;
  nomorPerjalanan: string | null;
  odometerKm: number | null;
  liter: string;
  totalRp: number;
  penuh: boolean;
  catatan: string | null;
  pencatat: string;
  dibuatPada: string;
};

export type CatatanServis = Batal & {
  id: number;
  idKendaraan: number;
  plat: string;
  tanggal: string;
  odometerKm: number | null;
  jenis: string;
  biayaRp: number;
  bengkel: string | null;
  catatan: string | null;
  pencatat: string;
  dibuatPada: string;
};

// --- Statistik armada (K-162, docs/13 §5.3) ---

export const skemaPeriodeStatistik = z
  .object({ dari: skemaTanggal('Tanggal awal'), sampai: skemaTanggal('Tanggal akhir') })
  .refine((p) => p.dari <= p.sampai, {
    message: 'Tanggal awal setelah tanggal akhir.',
    path: ['dari'],
  });

type StatistikRit = {
  rit: number;
  suratJalan: number;
  /** Rata-rata lama di jalan rit yang sudah kembali (menit). */
  rataLamaMenit: number | null;
  /** Rit rencana yang berangkat paling lambat 30 menit dari jadwal. */
  tepatWaktu: number;
  /** Rit rencana (punya jadwal) yang sudah berangkat. */
  berjadwal: number;
};

export type StatistikKendaraan = StatistikRit & {
  idKendaraan: number;
  plat: string;
  jenis: string;
  muatanKg: string;
  /** Rata-rata berat muatan dibanding daya angkut (persen bulat); null bila daya angkut kosong. */
  rataPakaiPersen: number | null;
  bbmLiter: string;
  bbmRp: number;
  /** Selisih odometer terbesar–terkecil dalam periode (dari catatan BBM/servis). */
  kmTempuh: number | null;
  /** Perkiraan: km tempuh / liter BBM. */
  kmPerLiter: string | null;
  servisRp: number;
  /** (BBM + servis) / km tempuh, rupiah bulat. */
  biayaPerKm: number | null;
};

export type StatistikSopir = StatistikRit & {
  idSopir: number;
  nama: string;
  /** Surat jalan dengan barang kembali, ditolak, atau rusak. */
  suratJalanBermasalah: number;
};

export type StatistikArmada = {
  dari: string;
  sampai: string;
  kendaraan: StatistikKendaraan[];
  sopir: StatistikSopir[];
};
