import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { JenisMutasi, Kepemilikan, KondisiStok, StatusStok } from '@sit/shared';
import type { Executor } from '../../../db/client';
import {
  barang,
  kategori,
  mutasiPersediaan,
  penerimaanBarang,
  penerimaanBarangDetail,
  pengguna,
  penjualan,
  penjualanDetail,
  penyesuaianStok,
  penyesuaianStokDetail,
  persediaan,
  returPemasok,
  returPemasokDetail,
  returPenjualan,
  returPenjualanDetail,
  satuan,
  voidTransaksi,
  voidTransaksiDetail,
} from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

/*
 * Bacaan posisi stok dan ledger (docs/05 ST1, docs/01 §6). Hanya SELECT; penulisan stok tetap
 * lewat `ledger.ts`.
 */

/**
 * ST1 sebagai ekspresi SQL — satu-satunya definisi status stok, dipakai daftar stok, daftar barang,
 * ringkasan, dan peringatan, agar penyaringan dan penghitungan memakai rumus yang sama.
 */
export function sqlStatusStok(ambangPersen: number) {
  return sql<StatusStok>`(case
    when ${persediaan.stokFisik} <= 0 then 'HABIS'
    when ${barang.stokMinimum} > 0 and ${persediaan.stokFisik} < ${barang.stokMinimum} then 'KRITIS'
    when ${barang.stokMinimum} > 0
      and ${persediaan.stokFisik} <= ${barang.stokMinimum} * (1 + ${ambangPersen}::numeric / 100)
      then 'PERLU_RESTOCK'
    else 'AMAN' end)`;
}

/** Urutan keparahan: HABIS, KRITIS, PERLU_RESTOCK, AMAN. */
function sqlUrutanStatus(ambangPersen: number) {
  return sql<number>`(case ${sqlStatusStok(ambangPersen)}
    when 'HABIS' then 0 when 'KRITIS' then 1 when 'PERLU_RESTOCK' then 2 else 3 end)`;
}

/** Nilai persediaan milik toko per barang (fisik × HPP, dibulatkan); konsinyasi bernilai 0 (L7). */
const sqlNilai = sql<number>`(case when ${barang.kepemilikan} = 'MILIK_SENDIRI'
  then round(${persediaan.stokFisik} * ${persediaan.hppRata2}) else 0 end)::bigint`;

export type SaringStok = {
  cari?: string | undefined;
  idKategori?: number | undefined;
  statusStok?: StatusStok | undefined;
  kepemilikan?: Kepemilikan | undefined;
};

function syaratStok(p: SaringStok, ambang: number): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    eq(barang.statusAktif, 'AKTIF'),
    p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
    p.kepemilikan === undefined ? undefined : eq(barang.kepemilikan, p.kepemilikan),
    p.statusStok === undefined ? undefined : sql`${sqlStatusStok(ambang)} = ${p.statusStok}`,
    pola
      ? or(ilike(barang.kode, pola), ilike(barang.namaBarang, pola), ilike(barang.barcode, pola))
      : undefined,
  );
}

function kolomStok(ambang: number) {
  return {
    idBarang: barang.id,
    kode: barang.kode,
    namaBarang: barang.namaBarang,
    namaKategori: kategori.nama,
    kodeSatuan: satuan.kode,
    kepemilikan: barang.kepemilikan,
    stokFisik: persediaan.stokFisik,
    stokDipesan: persediaan.stokDipesan,
    stokTersedia: sql<string>`${persediaan.stokTersedia}::text`,
    stokRusak: persediaan.stokRusak,
    stokMinimum: barang.stokMinimum,
    statusStok: sqlStatusStok(ambang),
    terakhirMutasi: persediaan.terakhirMutasi,
    hppRata2: persediaan.hppRata2,
    nilaiPersediaan: sql<number>`${sqlNilai}`.mapWith(Number),
  };
}

function dasarStok(ex: Executor, ambang: number) {
  return ex
    .select(kolomStok(ambang))
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar));
}

export async function daftarStok(
  ex: Executor,
  p: SaringStok & { limit: number; offset: number },
  ambang: number,
) {
  const where = syaratStok(p, ambang);
  const baris = await dasarStok(ex, ambang)
    .where(where)
    .orderBy(asc(barang.namaBarang), asc(barang.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export function semuaStok(ex: Executor, p: SaringStok, ambang: number) {
  return dasarStok(ex, ambang)
    .where(syaratStok(p, ambang))
    .orderBy(asc(barang.namaBarang), asc(barang.id));
}

/** Jumlah barang aktif per status dan total nilai persediaan milik toko. */
export async function ringkasanStok(ex: Executor, ambang: number) {
  const status = sqlStatusStok(ambang);
  const perStatus = await ex
    .select({ status, jumlah: count() })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(eq(barang.statusAktif, 'AKTIF'))
    // Kelompokkan menurut kolom pertama: ekspresi status memuat parameter terikat, sehingga
    // menulis ulang ekspresinya di GROUP BY tidak dikenali sama oleh PostgreSQL.
    .groupBy(sql`1`);
  const [nilai] = await ex
    .select({ total: sql<number>`coalesce(sum(${sqlNilai}), 0)::bigint`.mapWith(Number) })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(eq(barang.statusAktif, 'AKTIF'));
  return { perStatus, nilaiPersediaan: nilai?.total ?? 0 };
}

/** Barang aktif berstatus selain AMAN, HABIS/KRITIS lebih dulu (ST2/ST3, docs/05 §15). */
export function barangPeringatan(ex: Executor, ambang: number, batas: number) {
  return ex
    .select({
      idBarang: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      stokFisik: persediaan.stokFisik,
      stokMinimum: barang.stokMinimum,
      statusStok: sqlStatusStok(ambang),
    })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(and(eq(barang.statusAktif, 'AKTIF'), sql`${sqlStatusStok(ambang)} <> 'AMAN'`))
    .orderBy(sqlUrutanStatus(ambang), asc(barang.namaBarang))
    .limit(batas);
}

// --- Mutasi (ledger) ---

/** Nomor dan jenis dokumen sumber mutasi, dari kolom sumber yang terisi (tepat satu). */
const sqlNomorDokumen = sql<string | null>`coalesce(${penerimaanBarang.nomor},
  ${penyesuaianStok.nomor}, ${penjualan.nomor}, ${returPenjualan.nomor}, ${voidTransaksi.nomor},
  ${returPemasok.nomor})`;
const sqlJenisDokumen = sql<string | null>`(case
  when ${mutasiPersediaan.idPenerimaanDetail} is not null then 'PENERIMAAN'
  when ${mutasiPersediaan.idPenyesuaianDetail} is not null then 'PENYESUAIAN'
  when ${mutasiPersediaan.idPenjualanDetail} is not null then 'PENJUALAN'
  when ${mutasiPersediaan.idReturDetail} is not null then 'RETUR'
  when ${mutasiPersediaan.idVoidDetail} is not null then 'VOID'
  when ${mutasiPersediaan.idReturPemasokDetail} is not null then 'RETUR_PEMASOK'
  end)`;
const sqlIdDokumen = sql<number | null>`coalesce(${penerimaanBarang.id}, ${penyesuaianStok.id},
  ${penjualan.id}, ${returPenjualan.id}, ${voidTransaksi.id}, ${returPemasok.id})`;

const kolomMutasi = {
  id: mutasiPersediaan.id,
  waktu: mutasiPersediaan.waktu,
  tanggalOperasional: mutasiPersediaan.tanggalOperasional,
  idBarang: mutasiPersediaan.idBarang,
  kodeBarang: barang.kode,
  namaBarang: barang.namaBarang,
  kodeSatuan: satuan.kode,
  jenis: mutasiPersediaan.jenisMutasi,
  kondisi: mutasiPersediaan.kondisi,
  qtyMasuk: mutasiPersediaan.qtyMasuk,
  qtyKeluar: mutasiPersediaan.qtyKeluar,
  saldoSetelah: mutasiPersediaan.saldoSetelah,
  hppSatuan: mutasiPersediaan.hppSatuan,
  hppSetelah: mutasiPersediaan.hppSetelah,
  nomorDokumen: sqlNomorDokumen,
  jenisDokumen: sqlJenisDokumen,
  idDokumen: sql<number | null>`${sqlIdDokumen}`.mapWith((v) => (v === null ? null : Number(v))),
  namaPengguna: pengguna.namaPengguna,
  keterangan: mutasiPersediaan.keterangan,
};

function dasarMutasi(ex: Executor) {
  const m = mutasiPersediaan;
  return ex
    .select(kolomMutasi)
    .from(m)
    .innerJoin(barang, eq(barang.id, m.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .innerJoin(pengguna, eq(pengguna.id, m.idPengguna))
    .leftJoin(penerimaanBarangDetail, eq(penerimaanBarangDetail.id, m.idPenerimaanDetail))
    .leftJoin(penerimaanBarang, eq(penerimaanBarang.id, penerimaanBarangDetail.idPenerimaan))
    .leftJoin(penyesuaianStokDetail, eq(penyesuaianStokDetail.id, m.idPenyesuaianDetail))
    .leftJoin(penyesuaianStok, eq(penyesuaianStok.id, penyesuaianStokDetail.idPenyesuaian))
    .leftJoin(penjualanDetail, eq(penjualanDetail.id, m.idPenjualanDetail))
    .leftJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .leftJoin(returPenjualanDetail, eq(returPenjualanDetail.id, m.idReturDetail))
    .leftJoin(returPenjualan, eq(returPenjualan.id, returPenjualanDetail.idRetur))
    .leftJoin(voidTransaksiDetail, eq(voidTransaksiDetail.id, m.idVoidDetail))
    .leftJoin(voidTransaksi, eq(voidTransaksi.id, voidTransaksiDetail.idVoid))
    .leftJoin(returPemasokDetail, eq(returPemasokDetail.id, m.idReturPemasokDetail))
    .leftJoin(returPemasok, eq(returPemasok.id, returPemasokDetail.idReturPemasok));
}

export type SaringMutasi = {
  cari?: string | undefined;
  idBarang?: number | undefined;
  jenis?: JenisMutasi | undefined;
  dari?: string | undefined;
  sampai?: string | undefined;
};

function syaratMutasi(p: SaringMutasi): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.idBarang === undefined ? undefined : eq(mutasiPersediaan.idBarang, p.idBarang),
    p.jenis === undefined ? undefined : eq(mutasiPersediaan.jenisMutasi, p.jenis),
    p.dari === undefined ? undefined : gte(mutasiPersediaan.tanggalOperasional, p.dari),
    p.sampai === undefined ? undefined : lte(mutasiPersediaan.tanggalOperasional, p.sampai),
    pola ? or(ilike(barang.kode, pola), ilike(barang.namaBarang, pola)) : undefined,
  );
}

export async function daftarMutasi(
  ex: Executor,
  p: SaringMutasi & { limit: number; offset: number },
) {
  const where = syaratMutasi(p);
  const baris = await dasarMutasi(ex)
    .where(where)
    .orderBy(desc(mutasiPersediaan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(mutasiPersediaan)
    .innerJoin(barang, eq(barang.id, mutasiPersediaan.idBarang))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

// --- Kartu stok ---

export async function barangKartu(ex: Executor, idBarang: number) {
  const [b] = await ex
    .select({
      id: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      kepemilikan: barang.kepemilikan,
      stokMinimum: barang.stokMinimum,
    })
    .from(barang)
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(eq(barang.id, idBarang))
    .limit(1);
  return b;
}

/** Mutasi terakhir sebelum tanggal `dari` (saldo per kondisi; HPP dari mutasi apa pun). */
export async function posisiSebelum(
  ex: Executor,
  idBarang: number,
  kondisi: KondisiStok,
  dari: string,
) {
  const sebelum = and(
    eq(mutasiPersediaan.idBarang, idBarang),
    lt(mutasiPersediaan.tanggalOperasional, dari),
  );
  const [saldo] = await ex
    .select({ saldo: mutasiPersediaan.saldoSetelah })
    .from(mutasiPersediaan)
    .where(and(sebelum, eq(mutasiPersediaan.kondisi, kondisi)))
    .orderBy(desc(mutasiPersediaan.id))
    .limit(1);
  const [hpp] = await ex
    .select({ hpp: mutasiPersediaan.hppSetelah })
    .from(mutasiPersediaan)
    .where(sebelum)
    .orderBy(desc(mutasiPersediaan.id))
    .limit(1);
  return { saldo: saldo?.saldo ?? null, hpp: hpp?.hpp ?? null };
}

export function mutasiKartu(
  ex: Executor,
  idBarang: number,
  kondisi: KondisiStok,
  dari: string,
  sampai: string,
) {
  return dasarMutasi(ex)
    .where(
      and(
        eq(mutasiPersediaan.idBarang, idBarang),
        eq(mutasiPersediaan.kondisi, kondisi),
        gte(mutasiPersediaan.tanggalOperasional, dari),
        lte(mutasiPersediaan.tanggalOperasional, sampai),
      ),
    )
    .orderBy(asc(mutasiPersediaan.id));
}

/** Status stok (ST1) untuk sekumpulan barang, misalnya baris daftar Master Barang. */
export async function statusStokBarang(
  ex: Executor,
  idBarang: number[],
  ambang: number,
): Promise<Map<number, StatusStok>> {
  if (idBarang.length === 0) return new Map();
  const baris = await ex
    .select({ id: barang.id, status: sqlStatusStok(ambang) })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(inArray(barang.id, idBarang));
  return new Map(baris.map((b) => [b.id, b.status]));
}
