import type {
  AksiLog,
  JenisKasShift,
  JenisPenerimaan,
  StatusAktif,
  StatusHutang,
  StatusPengambilan,
  StatusPengiriman,
  StatusPenyesuaian,
} from '@sit/shared';

/** Label tampilan untuk nilai enum (nilai enum tetap UPPER_SNAKE di data). */
export {
  LABEL_JENIS_DIMENSI,
  LABEL_JENIS_MUTASI,
  LABEL_JENIS_PENYESUAIAN,
  LABEL_STATUS_PEMBAYARAN,
  LABEL_STATUS_STOK,
} from '@sit/shared';

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
  HARGA_TINJAU_TERAPKAN: 'Terapkan tinjau harga',
  HARGA_TINJAU_ABAIKAN: 'Abaikan tinjau harga',
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

export const LABEL_STATUS_PENYESUAIAN: Record<StatusPenyesuaian, string> = {
  DRAFT: 'Draf',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

export const LABEL_STATUS_PENGAMBILAN: Record<StatusPengambilan, string> = {
  DIAMBIL: 'Diambil',
  BELUM_DIAMBIL: 'Belum diambil',
};

export const LABEL_STATUS_PENGIRIMAN: Record<StatusPengiriman, string> = {
  BELUM: 'Belum dikirim',
  SEBAGIAN: 'Dikirim sebagian',
  SELESAI: 'Terkirim',
};

export const LABEL_JENIS_KAS: Record<JenisKasShift, string> = {
  KASBON: 'Kasbon',
  SETOR_OWNER: 'Setor ke owner',
  TARIK_OWNER: 'Tambahan dari owner',
  REFUND_RETUR: 'Refund retur',
  REFUND_VOID: 'Refund void',
  BAYAR_PEMASOK: 'Bayar pemasok',
  MASUK_LAIN: 'Kas masuk lain',
  KELUAR_LAIN: 'Kas keluar lain',
  KOREKSI_MODAL_TAMBAH: 'Koreksi modal (+)',
  KOREKSI_MODAL_KURANG: 'Koreksi modal (−)',
};
