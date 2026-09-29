/** Kode error API (docs/02 §4, error model). Dipakai API untuk mengirim dan web untuk membaca. */
export const KODE_ERROR = [
  'VALIDASI',
  'BELUM_LOGIN',
  'TIDAK_BERIZIN',
  'TIDAK_DITEMUKAN',
  'STATUS_TIDAK_VALID',
  'STOK_TIDAK_CUKUP',
  'KONFLIK',
  'LIMIT_TERLAMPAUI',
  'INTERNAL',
] as const;
export type KodeError = (typeof KODE_ERROR)[number];

/** Bentuk respons gagal: `{ error: { kode, pesan, detail? } }`. */
export type ResponsGalat = {
  error: { kode: KodeError; pesan: string; detail?: unknown };
};
