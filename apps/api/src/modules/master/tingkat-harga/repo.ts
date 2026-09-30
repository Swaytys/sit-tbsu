import { and, asc, eq } from 'drizzle-orm';
import type { Executor } from '../../../db/client';
import { tingkatHarga } from '../../../db/schema';

const kolom = {
  id: tingkatHarga.id,
  kode: tingkatHarga.kode,
  nama: tingkatHarga.nama,
  markupDefaultPersen: tingkatHarga.markupDefaultPersen,
  urutan: tingkatHarga.urutan,
  isDefault: tingkatHarga.isDefault,
  statusAktif: tingkatHarga.statusAktif,
};

export function daftarTingkatHarga(ex: Executor) {
  return ex
    .select(kolom)
    .from(tingkatHarga)
    .orderBy(asc(tingkatHarga.urutan), asc(tingkatHarga.nama));
}

/** Tier aktif dengan id tertentu (untuk validasi pilihan tier pelanggan). */
export async function tingkatHargaAktif(ex: Executor, id: number) {
  const [baris] = await ex
    .select(kolom)
    .from(tingkatHarga)
    .where(and(eq(tingkatHarga.id, id), eq(tingkatHarga.statusAktif, 'AKTIF')))
    .limit(1);
  return baris;
}
