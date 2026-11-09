import {
  aliasedTable,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  notExists,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { JenisPenyesuaian, StatusPenyesuaian } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  kategori,
  pengguna,
  penjualan,
  penjualanDetail,
  penyesuaianStok,
  penyesuaianStokDetail,
  persediaan,
  satuan,
} from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';
import { polaCari } from '../../../lib/paginasi';

const penggunaKecuali = aliasedTable(pengguna, 'pengguna_kecuali');

const jumlahBaris = sql<number>`(select count(*)::int from ${penyesuaianStokDetail}
  where ${kolomPenuh(penyesuaianStokDetail.idPenyesuaian)} = ${kolomPenuh(penyesuaianStok.id)})`;

/** K-227: penghitung yang ditugaskan (lembar opname). */
const namaPenghitung = sql<string | null>`(select ${pengguna.namaPengguna} from ${pengguna}
  where ${pengguna.id} = ${kolomPenuh(penyesuaianStok.idPenghitung)})`;

const kolom = {
  id: penyesuaianStok.id,
  nomor: penyesuaianStok.nomor,
  tanggal: penyesuaianStok.tanggal,
  tanggalOperasional: penyesuaianStok.tanggalOperasional,
  jenis: penyesuaianStok.jenis,
  status: penyesuaianStok.status,
  alasan: penyesuaianStok.alasan,
  catatan: penyesuaianStok.catatan,
  waktuSelesai: penyesuaianStok.waktuSelesai,
  jumlahBaris,
  namaPengguna: pengguna.namaPengguna,
  idPengguna: penyesuaianStok.idPengguna,
  idPenghitung: penyesuaianStok.idPenghitung,
  namaPenghitung,
  waktuMulaiHitung: penyesuaianStok.waktuMulaiHitung,
};

export type SaringPenyesuaian = {
  cari?: string | undefined;
  jenis?: JenisPenyesuaian | undefined;
  status?: StatusPenyesuaian | undefined;
  /** K-227: sembunyikan draf opname yang ditugaskan ke orang lain (pengguna tanpa izin mengatur opname). */
  sembunyikanTugasLainDari?: number | undefined;
};

function syarat(p: SaringPenyesuaian): SQL | undefined {
  return and(
    p.jenis ? eq(penyesuaianStok.jenis, p.jenis) : undefined,
    p.status ? eq(penyesuaianStok.status, p.status) : undefined,
    p.cari ? ilike(penyesuaianStok.nomor, polaCari(p.cari)) : undefined,
    p.sembunyikanTugasLainDari === undefined
      ? undefined
      : sql`not (${penyesuaianStok.jenis} = 'OPNAME' and ${penyesuaianStok.status} = 'DRAFT'
          and ${penyesuaianStok.idPenghitung} is not null
          and ${penyesuaianStok.idPenghitung} <> ${p.sembunyikanTugasLainDari})`,
  );
}

export async function daftarPenyesuaian(
  ex: Executor,
  p: SaringPenyesuaian & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await ex
    .select(kolom)
    .from(penyesuaianStok)
    .innerJoin(pengguna, eq(pengguna.id, penyesuaianStok.idPengguna))
    .where(where)
    .orderBy(desc(penyesuaianStok.tanggal), desc(penyesuaianStok.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(penyesuaianStok).where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function penyesuaianById(ex: Executor, id: number) {
  const [b] = await ex
    .select(kolom)
    .from(penyesuaianStok)
    .innerJoin(pengguna, eq(pengguna.id, penyesuaianStok.idPengguna))
    .where(eq(penyesuaianStok.id, id))
    .limit(1);
  return b;
}

export async function kunciPenyesuaian(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: penyesuaianStok.id,
      nomor: penyesuaianStok.nomor,
      jenis: penyesuaianStok.jenis,
      status: penyesuaianStok.status,
      alasan: penyesuaianStok.alasan,
      idPengguna: penyesuaianStok.idPengguna,
      idPenghitung: penyesuaianStok.idPenghitung,
      waktuMulaiHitung: penyesuaianStok.waktuMulaiHitung,
    })
    .from(penyesuaianStok)
    .where(eq(penyesuaianStok.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** Baris detail beserta data barang dan stok sistem saat ini. */
export function detailPenyesuaian(ex: Executor, idPenyesuaian: number) {
  return ex
    .select({
      id: penyesuaianStokDetail.id,
      idBarang: penyesuaianStokDetail.idBarang,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      kondisi: penyesuaianStokDetail.kondisi,
      qtySistem: penyesuaianStokDetail.qtySistem,
      qtyFisik: penyesuaianStokDetail.qtyFisik,
      qtySelisih: penyesuaianStokDetail.qtySelisih,
      hppSatuan: penyesuaianStokDetail.hppSatuan,
      keterangan: penyesuaianStokDetail.keterangan,
      dikecualikan: penyesuaianStokDetail.dikecualikan,
      alasanKecuali: penyesuaianStokDetail.alasanKecuali,
      namaPenggunaKecuali: penggunaKecuali.namaPengguna,
      waktuKecuali: penyesuaianStokDetail.waktuKecuali,
      sebabSelisih: penyesuaianStokDetail.sebabSelisih,
      stokFisikKini: persediaan.stokFisik,
      stokRusakKini: persediaan.stokRusak,
      hppKini: persediaan.hppRata2,
      jenisDimensi: satuan.jenisDimensi,
      timbangJumlahSampel: barang.timbangJumlahSampel,
      timbangBeratSampelGram: barang.timbangBeratSampelGram,
      ujiPetik: penyesuaianStokDetail.ujiPetik,
      qtySegelKini: persediaan.qtySegel,
      // K-227: kemasan tersegel aktif barang (isi dan kode satuannya).
      segelIsi: sql<string | null>`(select bsj.faktor_ke_dasar::text from barang_satuan_jual bsj
        where bsj.id_barang = ${kolomPenuh(penyesuaianStokDetail.idBarang)}
          and bsj.kemasan_segel and bsj.status_aktif = 'AKTIF')`,
      segelKode: sql<
        string | null
      >`(select s.kode from barang_satuan_jual bsj join satuan s on s.id = bsj.id_satuan
        where bsj.id_barang = ${kolomPenuh(penyesuaianStokDetail.idBarang)}
          and bsj.kemasan_segel and bsj.status_aktif = 'AKTIF')`,
    })
    .from(penyesuaianStokDetail)
    .innerJoin(barang, eq(barang.id, penyesuaianStokDetail.idBarang))
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .innerJoin(persediaan, eq(persediaan.idBarang, penyesuaianStokDetail.idBarang))
    .leftJoin(penggunaKecuali, eq(penggunaKecuali.id, penyesuaianStokDetail.idPenggunaKecuali))
    .where(eq(penyesuaianStokDetail.idPenyesuaian, idPenyesuaian))
    .orderBy(asc(kategori.nama), asc(barang.namaBarang));
}

/**
 * A3: qty barang terjual yang belum diambil pembeli (penjualan LANGSUNG BELUM_DIAMBIL), per barang.
 * Barangnya masih di toko tetapi sudah keluar dari stok sistem.
 */
export async function qtyBelumDiambil(ex: Executor, idBarang: number[]) {
  if (idBarang.length === 0) return new Map<number, string>();
  const baris = await ex
    .select({
      idBarang: penjualanDetail.idBarang,
      qty: sql<string>`coalesce(sum(${penjualanDetail.qtyDasar} - ${penjualanDetail.qtyReturDasar}), 0)::text`,
    })
    .from(penjualanDetail)
    .innerJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .where(
      and(
        inArray(penjualanDetail.idBarang, idBarang),
        eq(penjualan.jenisPenjualan, 'LANGSUNG'),
        eq(penjualan.statusPengambilan, 'BELUM_DIAMBIL'),
        ne(penjualan.statusTransaksi, 'VOID'),
        ne(penjualanDetail.statusItem, 'VOID'),
      ),
    )
    .groupBy(penjualanDetail.idBarang);
  return new Map(baris.map((b) => [b.idBarang, b.qty]));
}

export function barangUntukPenyesuaian(ex: Executor, id: number[]) {
  if (id.length === 0) return Promise.resolve([]);
  return ex
    .select({
      id: barang.id,
      namaBarang: barang.namaBarang,
      statusAktif: barang.statusAktif,
      kepemilikan: barang.kepemilikan,
      hargaTitip: barang.hargaTitip,
    })
    .from(barang)
    .where(inArray(barang.id, id));
}

/** Barang aktif untuk lembar opname (semua atau satu kategori). */
export function barangAktifUntukOpname(ex: Executor, idKategori: number | null) {
  return ex
    .select({ id: barang.id })
    .from(barang)
    .where(
      and(
        eq(barang.statusAktif, 'AKTIF'),
        idKategori === null ? undefined : eq(barang.idKategori, idKategori),
      ),
    )
    .orderBy(asc(barang.namaBarang));
}

export async function tambahHeader(tx: Tx, nilai: typeof penyesuaianStok.$inferInsert) {
  const [b] = await tx.insert(penyesuaianStok).values(nilai).returning({ id: penyesuaianStok.id });
  if (!b) throw new Error('insert penyesuaian tidak mengembalikan id');
  return b.id;
}

export async function ubahHeader(
  tx: Tx,
  id: number,
  nilai: Partial<typeof penyesuaianStok.$inferInsert>,
) {
  await tx.update(penyesuaianStok).set(nilai).where(eq(penyesuaianStok.id, id));
}

/** A1: baris DRAFT disimpan ulang seluruhnya (tabel detail boleh berubah selama DRAFT). */
export async function gantiDetail(
  tx: Tx,
  idPenyesuaian: number,
  baris: Omit<typeof penyesuaianStokDetail.$inferInsert, 'idPenyesuaian'>[],
) {
  await tx
    .delete(penyesuaianStokDetail)
    .where(eq(penyesuaianStokDetail.idPenyesuaian, idPenyesuaian));
  for (let i = 0; i < baris.length; i += 1000) {
    await tx
      .insert(penyesuaianStokDetail)
      .values(baris.slice(i, i + 1000).map((b) => ({ ...b, idPenyesuaian })));
  }
}

export async function ubahDetail(
  tx: Tx,
  id: number,
  nilai: Partial<typeof penyesuaianStokDetail.$inferInsert>,
) {
  await tx.update(penyesuaianStokDetail).set(nilai).where(eq(penyesuaianStokDetail.id, id));
}

export function detailUntukSelesai(tx: Tx, idPenyesuaian: number) {
  return tx
    .select({
      id: penyesuaianStokDetail.id,
      idBarang: penyesuaianStokDetail.idBarang,
      kondisi: penyesuaianStokDetail.kondisi,
      qtyFisik: penyesuaianStokDetail.qtyFisik,
      qtySelisih: penyesuaianStokDetail.qtySelisih,
      hppSatuan: penyesuaianStokDetail.hppSatuan,
      keterangan: penyesuaianStokDetail.keterangan,
      dikecualikan: penyesuaianStokDetail.dikecualikan,
      alasanKecuali: penyesuaianStokDetail.alasanKecuali,
      sebabSelisih: penyesuaianStokDetail.sebabSelisih,
      namaBarang: barang.namaBarang,
      statusAktif: barang.statusAktif,
    })
    .from(penyesuaianStokDetail)
    .innerJoin(barang, eq(barang.id, penyesuaianStokDetail.idBarang))
    .where(eq(penyesuaianStokDetail.idPenyesuaian, idPenyesuaian))
    .orderBy(asc(penyesuaianStokDetail.idBarang));
}

/** Baris tersimpan sebuah draf: dasar aturan K-069 (baris opname tidak boleh hilang diam-diam). */
export function barisTersimpan(tx: Tx, idPenyesuaian: number) {
  return tx
    .select({
      idBarang: penyesuaianStokDetail.idBarang,
      namaBarang: barang.namaBarang,
      dikecualikan: penyesuaianStokDetail.dikecualikan,
      alasanKecuali: penyesuaianStokDetail.alasanKecuali,
      idPenggunaKecuali: penyesuaianStokDetail.idPenggunaKecuali,
      waktuKecuali: penyesuaianStokDetail.waktuKecuali,
      qtyFisik: penyesuaianStokDetail.qtyFisik,
      sebabSelisih: penyesuaianStokDetail.sebabSelisih,
      ujiPetik: penyesuaianStokDetail.ujiPetik,
    })
    .from(penyesuaianStokDetail)
    .innerJoin(barang, eq(barang.id, penyesuaianStokDetail.idBarang))
    .where(eq(penyesuaianStokDetail.idPenyesuaian, idPenyesuaian));
}

/** Jumlah barang aktif yang tidak ada di dokumen (dicatat di log saat opname selesai). */
export async function jumlahBarangAktifDiLuar(tx: Tx, idPenyesuaian: number): Promise<number> {
  const [h] = await tx
    .select({ total: count() })
    .from(barang)
    .where(
      and(
        eq(barang.statusAktif, 'AKTIF'),
        notExists(
          tx
            .select({ satu: sql`1` })
            .from(penyesuaianStokDetail)
            .where(
              and(
                eq(penyesuaianStokDetail.idPenyesuaian, idPenyesuaian),
                eq(penyesuaianStokDetail.idBarang, barang.id),
              ),
            ),
        ),
      ),
    );
  return h?.total ?? 0;
}
