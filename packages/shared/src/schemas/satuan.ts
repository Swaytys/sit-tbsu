import { z } from 'zod';
import { JENIS_DIMENSI, STATUS_AKTIF } from '../enums';

/** Satuan seperti dikirim API (`GET /api/satuan`). */
export const skemaSatuan = z.object({
  id: z.number().int(),
  kode: z.string(),
  nama: z.string(),
  jenisDimensi: z.enum(JENIS_DIMENSI),
  /** Desimal eksak dari numeric(18,6), dikirim sebagai string agar tidak menjadi float. */
  faktorKeBasis: z.string(),
  isBasis: z.boolean(),
  statusAktif: z.enum(STATUS_AKTIF),
});

export type Satuan = z.infer<typeof skemaSatuan>;
