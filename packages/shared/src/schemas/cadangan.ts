import { z } from 'zod';
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
  /** Repositori lokal dan sandi sudah diatur (layar atau .env). */
  aktif: boolean;
  /** K-198: asal pengaturan: dari Pengaturan › Cadangan (`LAYAR`) atau berkas .env lama (`ENV`). */
  sumberAturan: 'LAYAR' | 'ENV' | null;
  /** K-198: program cadangan (restic) bisa dijalankan di server. */
  programAda: boolean;
  /** K-198: folder cadangan berada di disk yang sama dengan data (kurang aman). */
  diskSama: boolean;
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

/** K-198: atur folder dan sandi cadangan dari layar (Owner). */
export const skemaAturCadangan = z
  .object({
    repoLokal: z
      .string('Folder cadangan wajib diisi.')
      .trim()
      .min(3, 'Folder cadangan wajib diisi.')
      .max(260, 'Lokasi folder terlalu panjang.'),
    sandi: z
      .string('Sandi cadangan wajib diisi.')
      .min(8, 'Sandi cadangan minimal 8 karakter.')
      .max(100, 'Sandi cadangan maksimal 100 karakter.'),
    sandiUlang: z.string('Ulangi sandi.'),
    sudahDicatat: z.literal(true, 'Centang bahwa sandi sudah dicatat di tempat aman.'),
  })
  .refine((d) => d.sandi === d.sandiUlang, {
    path: ['sandiUlang'],
    message: 'Ulangan sandi tidak sama.',
  });
export type InputAturCadangan = z.input<typeof skemaAturCadangan>;
