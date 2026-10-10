import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { JenisDimensi, StatusAktif, TipeNilai } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { barangAtribut, jenisAtribut } from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';

const jumlahBarang = sql<number>`(select count(*)::int from ${barangAtribut} where ${kolomPenuh(barangAtribut.idJenisAtribut)} = ${kolomPenuh(jenisAtribut.id)})`;

const kolom = {
  id: jenisAtribut.id,
  kode: jenisAtribut.kode,
  nama: jenisAtribut.nama,
  tipeNilai: jenisAtribut.tipeNilai,
  jenisDimensi: jenisAtribut.jenisDimensi,
  urutan: jenisAtribut.urutan,
  statusAktif: jenisAtribut.statusAktif,
  jumlahBarang,
};

export function daftarJenisAtribut(ex: Executor, status: StatusAktif | 'SEMUA') {
  return ex
    .select(kolom)
    .from(jenisAtribut)
    .where(status === 'SEMUA' ? undefined : eq(jenisAtribut.statusAktif, status))
    .orderBy(asc(jenisAtribut.urutan), asc(jenisAtribut.nama));
}

export async function jenisAtributById(ex: Executor, id: number) {
  const [baris] = await ex.select(kolom).from(jenisAtribut).where(eq(jenisAtribut.id, id)).limit(1);
  return baris;
}

export async function kunciJenisAtribut(tx: Tx, id: number) {
  const [baris] = await tx
    .select(kolom)
    .from(jenisAtribut)
    .where(eq(jenisAtribut.id, id))
    .limit(1)
    .for('update', { of: jenisAtribut });
  return baris;
}

export async function kodeDipakai(
  ex: Executor,
  kode: string,
  kecualiId?: number,
): Promise<boolean> {
  const [baris] = await ex
    .select({ id: jenisAtribut.id })
    .from(jenisAtribut)
    .where(
      and(
        eq(jenisAtribut.kode, kode),
        kecualiId === undefined ? undefined : ne(jenisAtribut.id, kecualiId),
      ),
    )
    .limit(1);
  return baris !== undefined;
}

type Nilai = {
  kode: string;
  nama: string;
  tipeNilai: TipeNilai;
  jenisDimensi: JenisDimensi | null;
  urutan: number;
};

export async function tambahJenisAtribut(tx: Tx, nilai: Nilai): Promise<number> {
  const [baris] = await tx.insert(jenisAtribut).values(nilai).returning({ id: jenisAtribut.id });
  if (!baris) throw new Error('Jenis atribut gagal disimpan');
  return baris.id;
}

export async function ubahJenisAtribut(
  tx: Tx,
  id: number,
  nilai: Partial<Nilai> & { statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(jenisAtribut)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(jenisAtribut.id, id));
}
