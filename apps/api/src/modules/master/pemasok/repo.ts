import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { pemasok } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

const kolom = {
  id: pemasok.id,
  kode: pemasok.kode,
  namaPemasok: pemasok.namaPemasok,
  noHp: pemasok.noHp,
  kontakPerson: pemasok.kontakPerson,
  alamat: pemasok.alamat,
  keterangan: pemasok.keterangan,
  lamaKirimHari: pemasok.lamaKirimHari,
  jarakBelanjaHari: pemasok.jarakBelanjaHari,
  tempoHari: pemasok.tempoHari,
  statusAktif: pemasok.statusAktif,
  dibuatPada: pemasok.dibuatPada,
  diubahPada: pemasok.diubahPada,
};

function syarat(p: { cari?: string | undefined; status: StatusAktif | 'SEMUA' }): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status === 'SEMUA' ? undefined : eq(pemasok.statusAktif, p.status),
    pola
      ? or(
          ilike(pemasok.namaPemasok, pola),
          ilike(pemasok.kode, pola),
          ilike(pemasok.noHp, pola),
          ilike(pemasok.kontakPerson, pola),
        )
      : undefined,
  );
}

export async function daftarPemasok(
  ex: Executor,
  p: { cari?: string | undefined; status: StatusAktif | 'SEMUA'; limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await ex
    .select(kolom)
    .from(pemasok)
    .where(where)
    .orderBy(asc(pemasok.namaPemasok), asc(pemasok.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(pemasok).where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function pemasokById(ex: Executor, id: number) {
  const [baris] = await ex.select(kolom).from(pemasok).where(eq(pemasok.id, id)).limit(1);
  return baris;
}

export async function kunciPemasok(tx: Tx, id: number) {
  const [baris] = await tx
    .select({
      namaPemasok: pemasok.namaPemasok,
      noHp: pemasok.noHp,
      kontakPerson: pemasok.kontakPerson,
      alamat: pemasok.alamat,
      keterangan: pemasok.keterangan,
      lamaKirimHari: pemasok.lamaKirimHari,
      jarakBelanjaHari: pemasok.jarakBelanjaHari,
      tempoHari: pemasok.tempoHari,
      statusAktif: pemasok.statusAktif,
    })
    .from(pemasok)
    .where(eq(pemasok.id, id))
    .limit(1)
    .for('update');
  return baris;
}

export type NilaiPemasok = {
  namaPemasok: string;
  noHp: string;
  kontakPerson: string | null;
  alamat: string | null;
  keterangan: string | null;
  lamaKirimHari: number | null;
  jarakBelanjaHari: number | null;
  tempoHari: number | null;
};

export async function tambahPemasok(
  tx: Tx,
  nilai: NilaiPemasok & { kode: string },
): Promise<number> {
  const [baris] = await tx.insert(pemasok).values(nilai).returning({ id: pemasok.id });
  if (!baris) throw new Error('insert pemasok tidak mengembalikan id');
  return baris.id;
}

export async function ubahPemasok(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiPemasok> & { statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(pemasok)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(pemasok.id, id));
}
