import { and, asc, eq, ne } from 'drizzle-orm';
import type { StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { tingkatHarga } from '../../../db/schema';

const kolom = {
  id: tingkatHarga.id,
  kode: tingkatHarga.kode,
  nama: tingkatHarga.nama,
  markupDefaultPersen: tingkatHarga.markupDefaultPersen,
  minBelanja: tingkatHarga.minBelanja,
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

export async function tingkatHargaById(ex: Executor, id: number) {
  const [baris] = await ex.select(kolom).from(tingkatHarga).where(eq(tingkatHarga.id, id)).limit(1);
  return baris;
}

export async function kunciTingkatHarga(tx: Tx, id: number) {
  const [baris] = await tx
    .select(kolom)
    .from(tingkatHarga)
    .where(eq(tingkatHarga.id, id))
    .limit(1)
    .for('update');
  return baris;
}

export async function kodeDipakai(ex: Executor, kode: string, kecualiId?: number) {
  const [baris] = await ex
    .select({ id: tingkatHarga.id })
    .from(tingkatHarga)
    .where(
      and(
        eq(tingkatHarga.kode, kode),
        kecualiId === undefined ? undefined : ne(tingkatHarga.id, kecualiId),
      ),
    )
    .limit(1);
  return baris !== undefined;
}

export type NilaiTingkatHarga = {
  kode: string;
  nama: string;
  markupDefaultPersen: string;
  minBelanja: number | null;
  urutan: number;
};

export async function tambahTingkatHarga(tx: Tx, nilai: NilaiTingkatHarga): Promise<number> {
  const [baris] = await tx.insert(tingkatHarga).values(nilai).returning({ id: tingkatHarga.id });
  if (!baris) throw new Error('insert tingkat_harga tidak mengembalikan id');
  return baris.id;
}

export async function ubahTingkatHarga(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiTingkatHarga> & { statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(tingkatHarga)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(tingkatHarga.id, id));
}
