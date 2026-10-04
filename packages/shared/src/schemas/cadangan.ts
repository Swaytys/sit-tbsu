import type { JenisCadangan, PemicuCadangan, StatusCadangan, StatusTujuanCadangan } from '../enums';

/*
 * Cadangan data (docs/07 Fase 8, K-084): pg_dump + folder unggahan disimpan sebagai snapshot restic
 * terenkripsi dan terdeduplikasi di disk lokal dan cloud; uji pulih berkala.
 */

export type BarisCadangan = {
  id: number;
  jenis: JenisCadangan;
  status: StatusCadangan;
  pemicu: PemicuCadangan;
  namaPengguna: string | null;
  waktuMulai: string;
  waktuSelesai: string | null;
  /** Ukuran dump database (byte). */
  ukuranDump: number | null;
  snapshotLokal: string | null;
  statusLokal: StatusTujuanCadangan | null;
  snapshotCloud: string | null;
  statusCloud: StatusTujuanCadangan | null;
  pesan: string | null;
};

export type StatusCadanganData = {
  /** Repositori lokal sudah diisi di .env. */
  aktif: boolean;
  cloudAktif: boolean;
  /** Lokasi repositori (tanpa kata sandi). */
  repoLokal: string | null;
  repoCloud: string | null;
  /** Jam cadangan harian (WIB). */
  jam: number;
  retensi: string;
  sedangBerjalan: boolean;
  terakhirBerhasil: BarisCadangan | null;
  ujiPulihTerakhir: BarisCadangan | null;
  riwayat: BarisCadangan[];
  /** Pesan bila ada yang perlu ditindaklanjuti (gagal, terlewat, cloud gagal). */
  peringatan: string[];
};
