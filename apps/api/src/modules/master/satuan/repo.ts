import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { JENIS_DIMENSI, type JenisDimensi, type StatusAktif } from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { barang, barangAtribut, barangSatuanJual, satuan } from '../../../db/schema';

/** Urutan dimensi mengikuti daftar enum (PANJANG, LUAS, ..., LAINNYA), bukan abjad. */
const urutanDimensi = sql`case ${satuan.jenisDimensi} ${sql.join(
  JENIS_DIMENSI.map((d, i) => sql`when ${d} then ${sql.raw(String(i))}`),
  sql` `,
)} end`;

/** Pemakaian satuan: satuan dasar barang, satuan atribut barang, satuan jual. */
const jumlahDipakai = sql<number>`(
  (select count(*) from ${barang} where ${barang.idSatuanDasar} = ${satuan.id})
  + (select count(*) from ${barangAtribut} where ${barangAtribut.idSatuan} = ${satuan.id})
  + (select count(*) from ${barangSatuanJual} where ${barangSatuanJual.idSatuan} = ${satuan.id})
)::int`;

const kolom = {
  id: satuan.id,
  kode: satuan.kode,
  nama: satuan.nama,
  jenisDimensi: satuan.jenisDimensi,
  faktorKeBasis: satuan.faktorKeBasis,
  isBasis: satuan.isBasis,
  statusAktif: satuan.statusAktif,
  jumlahDipakai,
};

/** Semua satuan: per dimensi, satuan basis dulu, lalu dari faktor terbesar. */
export function semuaSatuan(ex: Executor = db, status: StatusAktif | 'SEMUA' = 'SEMUA') {
  return ex
    .select(kolom)
    .from(satuan)
    .where(status === 'SEMUA' ? undefined : eq(satuan.statusAktif, status))
    .orderBy(urutanDimensi, desc(satuan.isBasis), desc(satuan.faktorKeBasis), asc(satuan.nama));
}

export async function satuanById(ex: Executor, id: number) {
  const [baris] = await ex.select(kolom).from(satuan).where(eq(satuan.id, id)).limit(1);
  return baris;
}

export async function kunciSatuan(tx: Tx, id: number) {
  const [baris] = await tx
    .select(kolom)
    .from(satuan)
    .where(eq(satuan.id, id))
    .limit(1)
    .for('update', { of: satuan });
  return baris;
}

export async function kodeDipakai(
  ex: Executor,
  kode: string,
  kecualiId?: number,
): Promise<boolean> {
  const [baris] = await ex
    .select({ id: satuan.id })
    .from(satuan)
    .where(
      and(eq(satuan.kode, kode), kecualiId === undefined ? undefined : ne(satuan.id, kecualiId)),
    )
    .limit(1);
  return baris !== undefined;
}

/** Satuan basis suatu dimensi (selain `kecualiId`), bila ada. */
export async function basisDimensi(ex: Executor, jenisDimensi: JenisDimensi, kecualiId?: number) {
  const [baris] = await ex
    .select({ id: satuan.id, kode: satuan.kode })
    .from(satuan)
    .where(
      and(
        eq(satuan.jenisDimensi, jenisDimensi),
        eq(satuan.isBasis, true),
        kecualiId === undefined ? undefined : ne(satuan.id, kecualiId),
      ),
    )
    .limit(1);
  return baris;
}

type NilaiSatuan = {
  kode: string;
  nama: string;
  jenisDimensi: JenisDimensi;
  faktorKeBasis: string;
  isBasis: boolean;
};

export async function tambahSatuan(tx: Tx, nilai: NilaiSatuan): Promise<number> {
  const [baris] = await tx.insert(satuan).values(nilai).returning({ id: satuan.id });
  if (!baris) throw new Error('Satuan gagal disimpan');
  return baris.id;
}

export async function ubahSatuan(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiSatuan> & { statusAktif?: StatusAktif },
  waktu: Date,
): Promise<void> {
  await tx
    .update(satuan)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(satuan.id, id));
}
