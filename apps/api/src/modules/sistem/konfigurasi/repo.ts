import { db, type Executor } from '../../../db/client';
import { konfigurasi } from '../../../db/schema';

export function semuaKonfigurasi(ex: Executor = db) {
  return ex
    .select({ kode: konfigurasi.kode, nilai: konfigurasi.nilai, tipe: konfigurasi.tipe })
    .from(konfigurasi);
}
