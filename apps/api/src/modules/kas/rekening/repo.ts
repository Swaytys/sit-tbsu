import { and, asc, eq, ne } from 'drizzle-orm';
import type { JenisRekening, StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { rekeningToko } from '../../../db/schema';

const kolom = {
  id: rekeningToko.id,
  jenis: rekeningToko.jenis,
  bank: rekeningToko.bank,
  nomor: rekeningToko.nomor,
  atasNama: rekeningToko.atasNama,
  nama: rekeningToko.nama,
  isDefault: rekeningToko.isDefault,
  statusAktif: rekeningToko.statusAktif,
};

export function daftar(ex: Executor, status: StatusAktif | 'SEMUA') {
  return ex
    .select(kolom)
    .from(rekeningToko)
    .where(status === 'SEMUA' ? undefined : eq(rekeningToko.statusAktif, status))
    .orderBy(asc(rekeningToko.jenis), asc(rekeningToko.bank), asc(rekeningToko.id));
}

export async function byId(ex: Executor, id: number) {
  const [b] = await ex.select(kolom).from(rekeningToko).where(eq(rekeningToko.id, id)).limit(1);
  return b;
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx
    .select(kolom)
    .from(rekeningToko)
    .where(eq(rekeningToko.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** Rekening lain yang labelnya sama pada jenis yang sama (mencegah baris kembar). */
export async function kembar(ex: Executor, jenis: JenisRekening, nama: string, kecuali?: number) {
  const [b] = await ex
    .select({ id: rekeningToko.id })
    .from(rekeningToko)
    .where(
      and(
        eq(rekeningToko.jenis, jenis),
        eq(rekeningToko.nama, nama),
        kecuali === undefined ? undefined : ne(rekeningToko.id, kecuali),
      ),
    )
    .limit(1);
  return b;
}

export type NilaiRekening = {
  jenis: JenisRekening;
  bank: string;
  nomor: string | null;
  atasNama: string | null;
  nama: string;
  isDefault: boolean;
};

export async function tambah(tx: Tx, nilai: NilaiRekening): Promise<number> {
  const [b] = await tx.insert(rekeningToko).values(nilai).returning({ id: rekeningToko.id });
  if (!b) throw new Error('insert rekening_toko tidak mengembalikan id');
  return b.id;
}

export async function ubah(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiRekening> & { statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(rekeningToko)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(rekeningToko.id, id));
}

/** Melepas tanda bawaan dari rekening lain pada jenis yang sama (satu bawaan per jenis). */
export async function lepasBawaan(
  tx: Tx,
  jenis: JenisRekening,
  kecuali: number | null,
  waktu: Date,
): Promise<void> {
  await tx
    .update(rekeningToko)
    .set({ isDefault: false, diubahPada: waktu })
    .where(
      and(
        eq(rekeningToko.jenis, jenis),
        eq(rekeningToko.isDefault, true),
        kecuali === null ? undefined : ne(rekeningToko.id, kecuali),
      ),
    );
}
