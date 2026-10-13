import { and, count, desc, eq, gte, ilike, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { StatusVerifikasi } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { pelanggan, pembayaranPenjualan, pengguna, penjualan } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

const pemeriksa = alias(pengguna, 'pemeriksa');

const kolom = {
  id: pembayaranPenjualan.id,
  nomor: pembayaranPenjualan.nomor,
  tanggal: pembayaranPenjualan.tanggal,
  tanggalOperasional: pembayaranPenjualan.tanggalOperasional,
  idPenjualan: penjualan.id,
  nomorPenjualan: penjualan.nomor,
  namaPembeli: sql<string | null>`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`,
  metode: pembayaranPenjualan.metode,
  rekening: pembayaranPenjualan.rekening,
  referensi: pembayaranPenjualan.referensi,
  nominal: pembayaranPenjualan.nominal,
  namaKasir: pengguna.namaPengguna,
  statusVerifikasi: pembayaranPenjualan.statusVerifikasi,
  catatanVerifikasi: pembayaranPenjualan.catatanVerifikasi,
  namaPemeriksa: pemeriksa.namaPengguna,
  diverifikasiPada: pembayaranPenjualan.diverifikasiPada,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(pembayaranPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, pembayaranPenjualan.idPenjualan))
    .innerJoin(pengguna, eq(pengguna.id, pembayaranPenjualan.idPengguna))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .leftJoin(pemeriksa, eq(pemeriksa.id, pembayaranPenjualan.diverifikasiOleh));
}

export type SaringNonTunai = {
  status?: StatusVerifikasi | undefined;
  idRekening?: number | undefined;
  dari?: string | undefined;
  sampai?: string | undefined;
  cari?: string | undefined;
};

function syarat(p: SaringNonTunai): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    ne(pembayaranPenjualan.metode, 'TUNAI'),
    p.status ? eq(pembayaranPenjualan.statusVerifikasi, p.status) : undefined,
    p.idRekening === undefined ? undefined : eq(pembayaranPenjualan.idRekening, p.idRekening),
    p.dari ? gte(pembayaranPenjualan.tanggalOperasional, p.dari) : undefined,
    p.sampai ? lte(pembayaranPenjualan.tanggalOperasional, p.sampai) : undefined,
    pola
      ? or(
          ilike(pembayaranPenjualan.nomor, pola),
          ilike(penjualan.nomor, pola),
          ilike(pembayaranPenjualan.referensi, pola),
          ilike(penjualan.namaPembeli, pola),
          ilike(pelanggan.namaPelanggan, pola),
        )
      : undefined,
  );
}

export async function daftar(ex: Executor, p: SaringNonTunai & { limit: number; offset: number }) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(pembayaranPenjualan.tanggal), desc(pembayaranPenjualan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [h] = await ex
    .select({ total: count() })
    .from(pembayaranPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, pembayaranPenjualan.idPenjualan))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(where);
  // Jumlah dan total per rekening untuk saringan yang sama: angka yang dicocokkan dengan mutasi.
  const ringkasan = await ex
    .select({
      rekening: sql<string>`coalesce(${pembayaranPenjualan.rekening}, '(tanpa rekening)')`,
      jumlah: count(),
      total: sql<number>`coalesce(sum(${pembayaranPenjualan.nominal}), 0)::bigint`.mapWith(Number),
    })
    .from(pembayaranPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, pembayaranPenjualan.idPenjualan))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(where)
    .groupBy(sql`coalesce(${pembayaranPenjualan.rekening}, '(tanpa rekening)')`)
    .orderBy(sql`coalesce(${pembayaranPenjualan.rekening}, '(tanpa rekening)')`);
  return { baris, total: h?.total ?? 0, ringkasan };
}

export async function byId(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(pembayaranPenjualan.id, id)).limit(1);
  return b;
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: pembayaranPenjualan.id,
      nomor: pembayaranPenjualan.nomor,
      idPenjualan: pembayaranPenjualan.idPenjualan,
      metode: pembayaranPenjualan.metode,
      nominal: pembayaranPenjualan.nominal,
      rekening: pembayaranPenjualan.rekening,
      statusVerifikasi: pembayaranPenjualan.statusVerifikasi,
      catatanVerifikasi: pembayaranPenjualan.catatanVerifikasi,
    })
    .from(pembayaranPenjualan)
    .where(eq(pembayaranPenjualan.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** Hanya kolom status pengecekan yang berubah; isi pembayaran tetap (tabel append-only). */
export async function simpanVerifikasi(
  tx: Tx,
  id: number,
  nilai: {
    statusVerifikasi: StatusVerifikasi;
    diverifikasiOleh: number | null;
    diverifikasiPada: Date | null;
    catatanVerifikasi: string | null;
  },
): Promise<void> {
  await tx.update(pembayaranPenjualan).set(nilai).where(eq(pembayaranPenjualan.id, id));
}

export async function jumlahPerStatus(ex: Executor, status: StatusVerifikasi): Promise<number> {
  const [h] = await ex
    .select({ total: count() })
    .from(pembayaranPenjualan)
    .where(eq(pembayaranPenjualan.statusVerifikasi, status));
  return h?.total ?? 0;
}
