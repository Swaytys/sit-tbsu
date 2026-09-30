import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { barang, merk } from '../../../db/schema';

const jumlahBarang = sql<number>`(select count(*)::int from ${barang} where ${barang.idMerk} = ${merk.id})`;

const kolom = {
  id: merk.id,
  nama: merk.nama,
  keterangan: merk.keterangan,
  statusAktif: merk.statusAktif,
  jumlahBarang,
};

export function daftarMerk(ex: Executor, status: StatusAktif | 'SEMUA') {
  return ex
    .select(kolom)
    .from(merk)
    .where(status === 'SEMUA' ? undefined : eq(merk.statusAktif, status))
    .orderBy(asc(merk.nama));
}

export async function merkById(ex: Executor, id: number) {
  const [baris] = await ex.select(kolom).from(merk).where(eq(merk.id, id)).limit(1);
  return baris;
}

export async function kunciMerk(tx: Tx, id: number) {
  const [baris] = await tx
    .select({
      id: merk.id,
      nama: merk.nama,
      keterangan: merk.keterangan,
      statusAktif: merk.statusAktif,
    })
    .from(merk)
    .where(eq(merk.id, id))
    .limit(1)
    .for('update');
  return baris;
}

/** Nama merk dianggap sama tanpa membedakan huruf besar/kecil ("Semen" = "semen"). */
export async function namaDipakai(
  ex: Executor,
  nama: string,
  kecualiId?: number,
): Promise<boolean> {
  const [baris] = await ex
    .select({ id: merk.id })
    .from(merk)
    .where(
      and(
        sql`lower(${merk.nama}) = lower(${nama})`,
        kecualiId === undefined ? undefined : ne(merk.id, kecualiId),
      ),
    )
    .limit(1);
  return baris !== undefined;
}

export async function tambahMerk(
  tx: Tx,
  nilai: { nama: string; keterangan: string | null },
): Promise<number> {
  const [baris] = await tx.insert(merk).values(nilai).returning({ id: merk.id });
  if (!baris) throw new Error('Merk gagal disimpan');
  return baris.id;
}

export async function ubahMerk(
  tx: Tx,
  id: number,
  nilai: { nama?: string; keterangan?: string | null; statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(merk)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(merk.id, id));
}
