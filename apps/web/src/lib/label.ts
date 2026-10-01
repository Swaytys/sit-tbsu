import type { AksiLog, JenisPenerimaan, StatusAktif, StatusHutang } from '@sit/shared';

/** Label tampilan untuk nilai enum (nilai enum tetap UPPER_SNAKE di data). */
export { LABEL_JENIS_DIMENSI } from '@sit/shared';

export const LABEL_STATUS_AKTIF: Record<StatusAktif, string> = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
};

const LABEL_AKSI: Partial<Record<AksiLog, string>> = {
  LOGIN_SUKSES: 'Login berhasil',
  LOGIN_GAGAL: 'Login gagal',
  LOGOUT: 'Keluar',
  PENGGUNA_BUAT: 'Tambah pengguna',
  PENGGUNA_UBAH: 'Ubah pengguna',
  PENGGUNA_NONAKTIF: 'Nonaktifkan pengguna',
  PENGGUNA_AKTIFKAN: 'Aktifkan pengguna',
  PENGGUNA_RESET_PASSWORD: 'Reset password',
  PENGGUNA_GANTI_PASSWORD: 'Ganti password',
  PENGGUNA_CABUT_SESI: 'Cabut sesi',
  PENGATURAN_UBAH: 'Ubah pengaturan',
};

/** Label aksi log; aksi tanpa label khusus ditampilkan dari kodenya ("BARANG_UBAH" → "Barang ubah"). */
export function labelAksi(aksi: string): string {
  const khusus = LABEL_AKSI[aksi as AksiLog];
  if (khusus) return khusus;
  const teks = aksi.toLowerCase().replaceAll('_', ' ');
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

export const LABEL_JENIS_PENERIMAAN: Record<JenisPenerimaan, string> = {
  PEMBELIAN: 'Pembelian',
  KONSINYASI: 'Konsinyasi',
};

export const LABEL_STATUS_HUTANG: Record<StatusHutang, string> = {
  TIDAK_ADA: 'Tidak ada hutang',
  BELUM_LUNAS: 'Belum lunas',
  SEBAGIAN: 'Sebagian',
  LUNAS: 'Lunas',
};
