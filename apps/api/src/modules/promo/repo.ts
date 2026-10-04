import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { StatusAktif, StatusBerlakuPromo } from '@sit/shared';
import type { Executor, Tx } from '../../db/client';
import { barang, kategori, penjualanDetail, promo } from '../../db/schema';
import { polaCari } from '../../lib/paginasi';
import type { KandidatPromo } from './hitung';

const kolomKandidat = {
  id: promo.id,
  kode: promo.kode,
  nama: promo.nama,
  tanggalMulai: promo.tanggalMulai,
  tanggalSelesai: promo.tanggalSelesai,
  statusAktif: promo.statusAktif,
  jenisPotongan: promo.jenisPotongan,
  potonganPersen: promo.potonganPersen,
  potonganNominal: promo.potonganNominal,
  maksPotongan: promo.maksPotongan,
  sasaran: promo.sasaran,
  idKategori: promo.idKategori,
  idBarang: promo.idBarang,
  minQty: promo.minQty,
  minBelanja: promo.minBelanja,
};

/** PR1–PR2: promo AKTIF yang berlaku pada `tanggal` dan sasarannya bisa mengenai barang/kategori ini. */
export async function kandidatPromo(
  ex: Executor,
  tanggal: string,
  idBarang: number[],
  idKategori: number[],
): Promise<KandidatPromo[]> {
  if (idBarang.length === 0) return [];
  return ex
    .select(kolomKandidat)
    .from(promo)
    .where(
      and(
        eq(promo.statusAktif, 'AKTIF'),
        lte(promo.tanggalMulai, tanggal),
        gte(promo.tanggalSelesai, tanggal),
        or(
          eq(promo.sasaran, 'SEMUA'),
          and(eq(promo.sasaran, 'BARANG'), inArray(promo.idBarang, idBarang)),
          idKategori.length > 0
            ? and(eq(promo.sasaran, 'KATEGORI'), inArray(promo.idKategori, idKategori))
            : undefined,
        ),
      ),
    );
}

// --- Master promo ---

const pemakaian = sql<number>`(
  select count(*)::int from ${penjualanDetail} where ${penjualanDetail.idPromo} = ${promo.id}
)`;

const kolom = {
  ...kolomKandidat,
  namaKategori: kategori.nama,
  kodeBarang: barang.kode,
  namaBarang: barang.namaBarang,
  keterangan: promo.keterangan,
  jumlahPemakaian: pemakaian,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(promo)
    .leftJoin(kategori, eq(kategori.id, promo.idKategori))
    .leftJoin(barang, eq(barang.id, promo.idBarang));
}

export type SaringPromo = {
  cari?: string | undefined;
  status: StatusAktif | 'SEMUA';
  berlaku?: StatusBerlakuPromo | undefined;
  /** Tanggal operasional hari ini (untuk saringan berlaku). */
  hariIni: string;
};

function syarat(p: SaringPromo): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status === 'SEMUA' ? undefined : eq(promo.statusAktif, p.status),
    p.berlaku === 'TERJADWAL' ? gt(promo.tanggalMulai, p.hariIni) : undefined,
    p.berlaku === 'BERJALAN'
      ? and(lte(promo.tanggalMulai, p.hariIni), gte(promo.tanggalSelesai, p.hariIni))
      : undefined,
    p.berlaku === 'BERAKHIR' ? lt(promo.tanggalSelesai, p.hariIni) : undefined,
    pola ? or(ilike(promo.kode, pola), ilike(promo.nama, pola)) : undefined,
  );
}

export async function daftarPromo(
  ex: Executor,
  p: SaringPromo & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(promo.tanggalMulai), desc(promo.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(promo).where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function promoById(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(promo.id, id)).limit(1);
  return b;
}

export async function kunciPromo(tx: Tx, id: number) {
  const [b] = await tx
    .select({ ...kolomKandidat, keterangan: promo.keterangan })
    .from(promo)
    .where(eq(promo.id, id))
    .limit(1)
    .for('update');
  return b;
}

export async function jumlahPemakaian(ex: Executor, id: number): Promise<number> {
  const [b] = await ex
    .select({ n: count() })
    .from(penjualanDetail)
    .where(eq(penjualanDetail.idPromo, id));
  return b?.n ?? 0;
}

export type NilaiPromo = Omit<
  typeof promo.$inferInsert,
  'id' | 'kode' | 'dibuatPada' | 'diubahPada'
>;

export async function tambahPromo(tx: Tx, nilai: NilaiPromo & { kode: string }): Promise<number> {
  const [b] = await tx.insert(promo).values(nilai).returning({ id: promo.id });
  if (!b) throw new Error('insert promo tidak mengembalikan id');
  return b.id;
}

export async function ubahPromo(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiPromo>,
  waktu: Date,
): Promise<void> {
  await tx
    .update(promo)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(promo.id, id));
}

/** Kategori dan barang sasaran harus ada dan AKTIF bila baru dipilih. */
export async function statusSasaran(
  ex: Executor,
  p: { idKategori: number | null; idBarang: number | null },
) {
  const [k] =
    p.idKategori === null
      ? [undefined]
      : await ex
          .select({ status: kategori.statusAktif, nama: kategori.nama })
          .from(kategori)
          .where(eq(kategori.id, p.idKategori));
  const [b] =
    p.idBarang === null
      ? [undefined]
      : await ex
          .select({ status: barang.statusAktif, nama: barang.namaBarang })
          .from(barang)
          .where(eq(barang.id, p.idBarang));
  return { kategori: k, barang: b };
}

/** Nama promo untuk tampilan (struk, detail). */
export function namaPromo(ex: Executor, id: number[]) {
  if (id.length === 0) return Promise.resolve([]);
  return ex
    .select({ id: promo.id, kode: promo.kode, nama: promo.nama })
    .from(promo)
    .where(inArray(promo.id, id))
    .orderBy(asc(promo.id));
}
