/** Kode error API (docs/02 §4, error model). Dipakai API untuk mengirim dan web untuk membaca. */
export const KODE_ERROR = [
  'VALIDASI',
  'BELUM_LOGIN',
  'TIDAK_BERIZIN',
  /** 403: pengguna harus mengganti password sebelum memakai fitur lain (K-054). */
  'WAJIB_GANTI_PASSWORD',
  'TIDAK_DITEMUKAN',
  'STATUS_TIDAK_VALID',
  'STOK_TIDAK_CUKUP',
  'KONFLIK',
  'LIMIT_TERLAMPAUI',
  /** 429: rate limit login per IP (docs/04 §7, K-054). */
  'TERLALU_BANYAK_PERCOBAAN',
  'INTERNAL',
] as const;
export type KodeError = (typeof KODE_ERROR)[number];

/** Bentuk respons gagal: `{ error: { kode, pesan, detail? } }`. */
export type ResponsGalat = {
  error: { kode: KodeError; pesan: string; detail?: unknown };
};

/** Metadata daftar berhalaman (docs/02 §4). */
export type MetaHalaman = { total: number; halaman: number; perHalaman: number };
