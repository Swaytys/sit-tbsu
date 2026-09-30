import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { pelanggan, tingkatHarga } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

const kolom = {
  id: pelanggan.id,
  kode: pelanggan.kode,
  namaPelanggan: pelanggan.namaPelanggan,
  noHp: pelanggan.noHp,
  email: pelanggan.email,
  alamat: pelanggan.alamat,
  keterangan: pelanggan.keterangan,
  idTingkatHarga: pelanggan.idTingkatHarga,
  namaTingkatHarga: tingkatHarga.nama,
  termHari: pelanggan.termHari,
  limitKredit: pelanggan.limitKredit,
  statusAktif: pelanggan.statusAktif,
  dibuatPada: pelanggan.dibuatPada,
};

function syarat(p: { cari?: string | undefined; status: StatusAktif | 'SEMUA' }): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status === 'SEMUA' ? undefined : eq(pelanggan.statusAktif, p.status),
    pola
      ? or(
          ilike(pelanggan.namaPelanggan, pola),
          ilike(pelanggan.kode, pola),
          ilike(pelanggan.noHp, pola),
        )
      : undefined,
  );
}

export async function daftarPelanggan(
  ex: Executor,
  p: { cari?: string | undefined; status: StatusAktif | 'SEMUA'; limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await ex
    .select(kolom)
    .from(pelanggan)
    .leftJoin(tingkatHarga, eq(pelanggan.idTingkatHarga, tingkatHarga.id))
    .where(where)
    .orderBy(asc(pelanggan.namaPelanggan), asc(pelanggan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(pelanggan).where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function pelangganById(ex: Executor, id: number) {
  const [baris] = await ex
    .select(kolom)
    .from(pelanggan)
    .leftJoin(tingkatHarga, eq(pelanggan.idTingkatHarga, tingkatHarga.id))
    .where(eq(pelanggan.id, id))
    .limit(1);
  return baris;
}

export async function kunciPelanggan(tx: Tx, id: number) {
  const [baris] = await tx
    .select({
      namaPelanggan: pelanggan.namaPelanggan,
      noHp: pelanggan.noHp,
      email: pelanggan.email,
      alamat: pelanggan.alamat,
      keterangan: pelanggan.keterangan,
      idTingkatHarga: pelanggan.idTingkatHarga,
      termHari: pelanggan.termHari,
      limitKredit: pelanggan.limitKredit,
      statusAktif: pelanggan.statusAktif,
    })
    .from(pelanggan)
    .where(eq(pelanggan.id, id))
    .limit(1)
    .for('update');
  return baris;
}

export type NilaiPelanggan = {
  namaPelanggan: string;
  noHp: string;
  email: string | null;
  alamat: string | null;
  keterangan: string | null;
  idTingkatHarga: number | null;
  termHari: number;
  limitKredit: number | null;
};

export async function tambahPelanggan(
  tx: Tx,
  nilai: NilaiPelanggan & { kode: string },
): Promise<number> {
  const [baris] = await tx.insert(pelanggan).values(nilai).returning({ id: pelanggan.id });
  if (!baris) throw new Error('insert pelanggan tidak mengembalikan id');
  return baris.id;
}

export async function ubahPelanggan(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiPelanggan> & { statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(pelanggan)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(pelanggan.id, id));
}
