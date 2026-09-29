import type { JenisDimensi, StatusAktif } from '@sit/shared';

/** Label tampilan untuk nilai enum (nilai enum tetap UPPER_SNAKE di data). */
export const LABEL_JENIS_DIMENSI: Record<JenisDimensi, string> = {
  PANJANG: 'Panjang',
  LUAS: 'Luas',
  VOLUME: 'Volume',
  BERAT: 'Berat',
  DAYA: 'Daya',
  JUMLAH: 'Satuan hitung',
  LAINNYA: 'Lainnya',
};

export const LABEL_STATUS_AKTIF: Record<StatusAktif, string> = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
};
