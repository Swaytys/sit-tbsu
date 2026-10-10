import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { barang, kategori } from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';

const jumlahBarang = sql<number>`(select count(*)::int from ${barang} where ${kolomPenuh(barang.idKategori)} = ${kolomPenuh(kategori.id)})`;

const kolom = {
  id: kategori.id,
  nama: kategori.nama,
  keterangan: kategori.keterangan,
  urutan: kategori.urutan,
  statusAktif: kategori.statusAktif,
  jumlahBarang,
};

export function daftarKategori(ex: Executor, status: StatusAktif | 'SEMUA') {
  return ex
    .select(kolom)
    .from(kategori)
    .where(status === 'SEMUA' ? undefined : eq(kategori.statusAktif, status))
    .orderBy(asc(kategori.urutan), asc(kategori.nama));
}

export async function kategoriById(ex: Executor, id: number) {
  const [baris] = await ex.select(kolom).from(kategori).where(eq(kategori.id, id)).limit(1);
  return baris;
}

export async function kunciKategori(tx: Tx, id: number) {
  const [baris] = await tx
    .select({
      id: kategori.id,
      nama: kategori.nama,
      keterangan: kategori.keterangan,
      urutan: kategori.urutan,
      statusAktif: kategori.statusAktif,
    })
    .from(kategori)
    .where(eq(kategori.id, id))
    .limit(1)
    .for('update');
  return baris;
}

/** Nama kategori dianggap sama tanpa membedakan huruf besar/kecil ("Semen" = "semen"). */
export async function namaDipakai(
  ex: Executor,
  nama: string,
  kecualiId?: number,
): Promise<boolean> {
  const [baris] = await ex
    .select({ id: kategori.id })
    .from(kategori)
    .where(
      and(
        sql`lower(${kategori.nama}) = lower(${nama})`,
        kecualiId === undefined ? undefined : ne(kategori.id, kecualiId),
      ),
    )
    .limit(1);
  return baris !== undefined;
}

export async function tambahKategori(
  tx: Tx,
  nilai: { nama: string; keterangan: string | null; urutan: number },
): Promise<number> {
  const [baris] = await tx.insert(kategori).values(nilai).returning({ id: kategori.id });
  if (!baris) throw new Error('Kategori gagal disimpan');
  return baris.id;
}

export async function ubahKategori(
  tx: Tx,
  id: number,
  nilai: { nama?: string; keterangan?: string | null; urutan?: number; statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(kategori)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(kategori.id, id));
}
