import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { golonganPelanggan, pelanggan } from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';

const jumlahPelanggan = sql<number>`(select count(*)::int from ${pelanggan}
  where ${kolomPenuh(pelanggan.idGolongan)} = ${kolomPenuh(golonganPelanggan.id)} and ${kolomPenuh(pelanggan.statusAktif)} = 'AKTIF')`;

const kolom = {
  id: golonganPelanggan.id,
  nama: golonganPelanggan.nama,
  keterangan: golonganPelanggan.keterangan,
  statusAktif: golonganPelanggan.statusAktif,
  jumlahPelanggan,
};

export function daftarGolongan(ex: Executor, status: StatusAktif | 'SEMUA') {
  return ex
    .select(kolom)
    .from(golonganPelanggan)
    .where(status === 'SEMUA' ? undefined : eq(golonganPelanggan.statusAktif, status))
    .orderBy(asc(golonganPelanggan.nama));
}

export async function golonganById(ex: Executor, id: number) {
  const [baris] = await ex
    .select(kolom)
    .from(golonganPelanggan)
    .where(eq(golonganPelanggan.id, id))
    .limit(1);
  return baris;
}

export async function kunciGolongan(tx: Tx, id: number) {
  const [baris] = await tx
    .select({
      id: golonganPelanggan.id,
      nama: golonganPelanggan.nama,
      keterangan: golonganPelanggan.keterangan,
      statusAktif: golonganPelanggan.statusAktif,
    })
    .from(golonganPelanggan)
    .where(eq(golonganPelanggan.id, id))
    .limit(1)
    .for('update');
  return baris;
}

/** Nama golongan dianggap sama tanpa membedakan huruf besar/kecil ("Tukang" = "tukang"). */
export async function namaDipakai(
  ex: Executor,
  nama: string,
  kecualiId?: number,
): Promise<boolean> {
  const [baris] = await ex
    .select({ id: golonganPelanggan.id })
    .from(golonganPelanggan)
    .where(
      and(
        sql`lower(${golonganPelanggan.nama}) = lower(${nama})`,
        kecualiId === undefined ? undefined : ne(golonganPelanggan.id, kecualiId),
      ),
    )
    .limit(1);
  return baris !== undefined;
}

export async function tambahGolongan(
  tx: Tx,
  nilai: { nama: string; keterangan: string | null },
): Promise<number> {
  const [baris] = await tx
    .insert(golonganPelanggan)
    .values(nilai)
    .returning({ id: golonganPelanggan.id });
  if (!baris) throw new Error('Golongan pelanggan gagal disimpan');
  return baris.id;
}

export async function ubahGolongan(
  tx: Tx,
  id: number,
  nilai: { nama?: string; keterangan?: string | null; statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(golonganPelanggan)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(golonganPelanggan.id, id));
}
