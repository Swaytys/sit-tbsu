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
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { JenisPenjualan, StatusOrder } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  barangSatuanJual,
  orderPenjualan,
  orderPenjualanDetail,
  pelanggan,
  pengguna,
  persediaan,
  promo,
  satuan,
  tingkatHarga,
  penjualan,
  penjualanDetail,
} from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';
import { polaCari } from '../../../lib/paginasi';
import { kodeSatuanBaris, satuanBaris } from '../satuan-baris';

// Subkueri (bukan join kedua ke `pengguna`): Drizzle tidak bisa mengetik dua join ke tabel yang sama.
const namaKasirProses = sql<string | null>`(select k.nama_pengguna from ${pengguna} k
  where k.id = ${kolomPenuh(orderPenjualan.idKasirProses)})`;

const jumlahItem = sql<number>`(select count(*)::int from ${orderPenjualanDetail}
  where ${kolomPenuh(orderPenjualanDetail.idOrder)} = ${kolomPenuh(orderPenjualan.id)})`;

const kolom = {
  id: orderPenjualan.id,
  nomor: orderPenjualan.nomor,
  tanggal: orderPenjualan.tanggal,
  jenisPenjualan: orderPenjualan.jenisPenjualan,
  status: orderPenjualan.status,
  prioritas: orderPenjualan.prioritas,
  idPelanggan: orderPenjualan.idPelanggan,
  namaPelanggan: pelanggan.namaPelanggan,
  namaPembeli: orderPenjualan.namaPembeli,
  idPengguna: orderPenjualan.idPengguna,
  namaPengguna: pengguna.namaPengguna,
  idKasirProses: orderPenjualan.idKasirProses,
  namaKasirProses,
  jumlahItem,
  subtotal: orderPenjualan.subtotal,
  diskonTransaksi: orderPenjualan.diskonTransaksi,
  ongkir: orderPenjualan.ongkir,
  total: orderPenjualan.total,
  waktuMasukAntrean: orderPenjualan.waktuMasukAntrean,
  alamatKirim: orderPenjualan.alamatKirim,
  catatanKirim: orderPenjualan.catatanKirim,
  catatan: orderPenjualan.catatan,
  alasanBatal: orderPenjualan.alasanBatal,
  idPenjualan: orderPenjualan.idPenjualan,
  diubahPada: orderPenjualan.diubahPada,
  // K-180: tanpa No. HP pembeli, pakai No. HP pelanggan terdaftar (isian simpan order langsung terisi).
  noHpPembeli: sql<string | null>`coalesce(${orderPenjualan.noHpPembeli}, ${pelanggan.noHp})`,
  tanggalAmbil: orderPenjualan.tanggalAmbil,
};

/** Status yang menahan stok (R2 + K-122): antrean, sedang diproses, dan disimpan. */
export const STATUS_MENAHAN = ['MENUNGGU', 'DIPROSES', 'DISIMPAN'] as const;

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(orderPenjualan)
    .innerJoin(pengguna, eq(pengguna.id, orderPenjualan.idPengguna))
    .leftJoin(pelanggan, eq(pelanggan.id, orderPenjualan.idPelanggan));
}

export type SaringOrder = {
  cari?: string | undefined;
  status?: StatusOrder | 'AKTIF' | undefined;
  jenis?: JenisPenjualan | undefined;
  idPengguna?: number | undefined;
  /** Order DIPROSES yang dikunci pengguna ini. */
  idKasirProses?: number | undefined;
};

function syarat(p: SaringOrder): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status === 'AKTIF'
      ? inArray(orderPenjualan.status, ['MENUNGGU', 'DIPROSES'])
      : p.status
        ? eq(orderPenjualan.status, p.status)
        : undefined,
    p.jenis ? eq(orderPenjualan.jenisPenjualan, p.jenis) : undefined,
    p.idPengguna === undefined ? undefined : eq(orderPenjualan.idPengguna, p.idPengguna),
    p.idKasirProses === undefined
      ? undefined
      : and(
          eq(orderPenjualan.status, 'DIPROSES'),
          eq(orderPenjualan.idKasirProses, p.idKasirProses),
        ),
    pola
      ? or(
          ilike(orderPenjualan.nomor, pola),
          ilike(orderPenjualan.namaPembeli, pola),
          ilike(pelanggan.namaPelanggan, pola),
        )
      : undefined,
  );
}

/**
 * Antrean: murni FIFO — yang paling lama masuk antrean di depan (K-073: adil; prioritas hanya penanda).
 * Selain antrean: terbaru dulu.
 */
export async function daftarOrder(
  ex: Executor,
  p: SaringOrder & { limit: number; offset: number },
) {
  const where = syarat(p);
  const urutan =
    p.status === 'AKTIF' || p.status === 'MENUNGGU'
      ? [asc(orderPenjualan.waktuMasukAntrean), asc(orderPenjualan.id)]
      : p.status === 'DISIMPAN'
        ? [asc(orderPenjualan.tanggalAmbil), asc(orderPenjualan.id)]
        : [desc(orderPenjualan.tanggal), desc(orderPenjualan.id)];
  const baris = await dasar(ex)
    .where(where)
    .orderBy(...urutan)
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(orderPenjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, orderPenjualan.idPelanggan))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function orderById(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(orderPenjualan.id, id)).limit(1);
  return b;
}

export async function kunciOrder(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: orderPenjualan.id,
      nomor: orderPenjualan.nomor,
      status: orderPenjualan.status,
      idPengguna: orderPenjualan.idPengguna,
      idKasirProses: orderPenjualan.idKasirProses,
      jenisPenjualan: orderPenjualan.jenisPenjualan,
      diskonTransaksi: orderPenjualan.diskonTransaksi,
    })
    .from(orderPenjualan)
    .where(eq(orderPenjualan.id, id))
    .limit(1)
    .for('update');
  return b;
}

export function detailOrder(ex: Executor, idOrder: number) {
  return ex
    .select({
      id: orderPenjualanDetail.id,
      idBarang: orderPenjualanDetail.idBarang,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      idKategori: barang.idKategori,
      kodeSatuan: kodeSatuanBaris,
      kodeSatuanDasar: satuan.kode,
      idSatuanJual: orderPenjualanDetail.idSatuanJual,
      faktor: orderPenjualanDetail.faktor,
      kepemilikan: barang.kepemilikan,
      qty: orderPenjualanDetail.qty,
      qtyDasar: orderPenjualanDetail.qtyDasar,
      idTingkatHarga: orderPenjualanDetail.idTingkatHarga,
      namaTier: tingkatHarga.nama,
      hargaSatuan: orderPenjualanDetail.hargaSatuan,
      hargaManual: orderPenjualanDetail.hargaManual,
      diskonBaris: orderPenjualanDetail.diskonBaris,
      idPromo: orderPenjualanDetail.idPromo,
      namaPromo: promo.nama,
      diskonPromo: orderPenjualanDetail.diskonPromo,
      promoNonaktif: orderPenjualanDetail.promoNonaktif,
      subtotal: orderPenjualanDetail.subtotal,
      catatanItem: orderPenjualanDetail.catatanItem,
      stokTersedia: sql<string>`${persediaan.stokTersedia}::text`,
    })
    .from(orderPenjualanDetail)
    .innerJoin(barang, eq(barang.id, orderPenjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, orderPenjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
    .innerJoin(persediaan, eq(persediaan.idBarang, orderPenjualanDetail.idBarang))
    .leftJoin(tingkatHarga, eq(tingkatHarga.id, orderPenjualanDetail.idTingkatHarga))
    .leftJoin(promo, eq(promo.id, orderPenjualanDetail.idPromo))
    .where(eq(orderPenjualanDetail.idOrder, idOrder))
    .orderBy(asc(orderPenjualanDetail.id));
}

export async function tambahHeader(tx: Tx, nilai: typeof orderPenjualan.$inferInsert) {
  const [b] = await tx.insert(orderPenjualan).values(nilai).returning({ id: orderPenjualan.id });
  if (!b) throw new Error('insert order tidak mengembalikan id');
  return b.id;
}

export async function ubahHeader(
  tx: Tx,
  id: number,
  nilai: Partial<typeof orderPenjualan.$inferInsert>,
) {
  await tx.update(orderPenjualan).set(nilai).where(eq(orderPenjualan.id, id));
}

/** Baris order boleh diganti selama DRAFT/MENUNGGU/DIPROSES (docs/03); reservasi diurus service. */
export async function gantiDetail(
  tx: Tx,
  idOrder: number,
  baris: Omit<typeof orderPenjualanDetail.$inferInsert, 'idOrder'>[],
) {
  await tx.delete(orderPenjualanDetail).where(eq(orderPenjualanDetail.idOrder, idOrder));
  if (baris.length > 0) {
    await tx.insert(orderPenjualanDetail).values(baris.map((b) => ({ ...b, idOrder })));
  }
}

export function barisReservasi(tx: Tx, idOrder: number) {
  return tx
    .select({
      idBarang: orderPenjualanDetail.idBarang,
      idSatuanJual: orderPenjualanDetail.idSatuanJual,
      qtyDasar: orderPenjualanDetail.qtyDasar,
      idTingkatHarga: orderPenjualanDetail.idTingkatHarga,
      hargaSatuan: orderPenjualanDetail.hargaSatuan,
      hargaManual: orderPenjualanDetail.hargaManual,
      diskonBaris: orderPenjualanDetail.diskonBaris,
      promoNonaktif: orderPenjualanDetail.promoNonaktif,
    })
    .from(orderPenjualanDetail)
    .where(eq(orderPenjualanDetail.idOrder, idOrder));
}

/** R7: order MENUNGGU yang masuk antrean sebelum `batas`. */
export function orderBasi(tx: Executor, batas: Date) {
  return tx
    .select({ id: orderPenjualan.id, nomor: orderPenjualan.nomor })
    .from(orderPenjualan)
    .where(and(eq(orderPenjualan.status, 'MENUNGGU'), lt(orderPenjualan.waktuMasukAntrean, batas)))
    .orderBy(asc(orderPenjualan.id));
}

/** R8: order DIPROSES tanpa aktivitas sejak `batas`. */
export function kunciKadaluarsa(tx: Executor, batas: Date) {
  return tx
    .select({ id: orderPenjualan.id, nomor: orderPenjualan.nomor })
    .from(orderPenjualan)
    .where(and(eq(orderPenjualan.status, 'DIPROSES'), lt(orderPenjualan.diubahPada, batas)))
    .orderBy(asc(orderPenjualan.id));
}

/** Stok tertahan (R7): baris order yang menahan stok (MENUNGGU/DIPROSES/DISIMPAN) per barang. */
export function stokTertahan(ex: Executor) {
  return ex
    .select({
      idBarang: barang.id,
      kodeBarang: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      stokFisik: persediaan.stokFisik,
      stokDipesan: persediaan.stokDipesan,
      idOrder: orderPenjualan.id,
      nomor: orderPenjualan.nomor,
      status: orderPenjualan.status,
      qtyDasar: orderPenjualanDetail.qtyDasar,
      namaPengguna: pengguna.namaPengguna,
      namaPelanggan: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${orderPenjualan.namaPembeli})`,
      waktuMasukAntrean: orderPenjualan.waktuMasukAntrean,
    })
    .from(orderPenjualanDetail)
    .innerJoin(orderPenjualan, eq(orderPenjualan.id, orderPenjualanDetail.idOrder))
    .innerJoin(barang, eq(barang.id, orderPenjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .innerJoin(pengguna, eq(pengguna.id, orderPenjualan.idPengguna))
    .leftJoin(pelanggan, eq(pelanggan.id, orderPenjualan.idPelanggan))
    .where(inArray(orderPenjualan.status, [...STATUS_MENAHAN]))
    .orderBy(asc(barang.namaBarang), asc(orderPenjualan.waktuMasukAntrean));
}

export async function pelangganUntukOrder(ex: Executor, id: number) {
  const [p] = await ex
    .select({
      id: pelanggan.id,
      namaPelanggan: pelanggan.namaPelanggan,
      noHp: pelanggan.noHp,
      statusAktif: pelanggan.statusAktif,
    })
    .from(pelanggan)
    .where(eq(pelanggan.id, id));
  return p;
}

/** Isi singkat beberapa order (nama barang, qty, satuan) untuk kartu/tiket antrean (K-073). */
export function ringkasBaris(ex: Executor, idOrder: number[]) {
  if (idOrder.length === 0) return Promise.resolve([]);
  return ex
    .select({
      idOrder: orderPenjualanDetail.idOrder,
      namaBarang: barang.namaBarang,
      qty: orderPenjualanDetail.qty,
      kodeSatuan: kodeSatuanBaris,
    })
    .from(orderPenjualanDetail)
    .innerJoin(barang, eq(barang.id, orderPenjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, orderPenjualanDetail.idSatuanJual))
    .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
    .where(inArray(orderPenjualanDetail.idOrder, idOrder))
    .orderBy(asc(orderPenjualanDetail.id));
}

/** K-122 butir 4: draf lain yang memuat barang ini (qty satuan dasar digabung per draf). */
export function drafBarang(ex: Executor, idBarang: number, kecuali: number | undefined) {
  return ex
    .select({
      id: orderPenjualan.id,
      nomor: orderPenjualan.nomor,
      idPengguna: orderPenjualan.idPengguna,
      namaPengguna: pengguna.namaPengguna,
      namaPembeli: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${orderPenjualan.namaPembeli})`,
      qtyDasar: sql<string>`sum(${orderPenjualanDetail.qtyDasar})::text`,
      diubahPada: orderPenjualan.diubahPada,
    })
    .from(orderPenjualanDetail)
    .innerJoin(orderPenjualan, eq(orderPenjualan.id, orderPenjualanDetail.idOrder))
    .innerJoin(pengguna, eq(pengguna.id, orderPenjualan.idPengguna))
    .leftJoin(pelanggan, eq(pelanggan.id, orderPenjualan.idPelanggan))
    .where(
      and(
        eq(orderPenjualanDetail.idBarang, idBarang),
        eq(orderPenjualan.status, 'DRAFT'),
        kecuali === undefined ? undefined : ne(orderPenjualan.id, kecuali),
      ),
    )
    .groupBy(
      orderPenjualan.id,
      orderPenjualan.nomor,
      orderPenjualan.idPengguna,
      pengguna.namaPengguna,
      pelanggan.namaPelanggan,
      orderPenjualan.namaPembeli,
      orderPenjualan.diubahPada,
    )
    .orderBy(asc(orderPenjualan.diubahPada));
}

export async function stokBarang(ex: Executor, idBarang: number) {
  const [b] = await ex
    .select({
      stokTersedia: sql<string>`${persediaan.stokTersedia}::text`,
      kodeSatuanDasar: satuan.kode,
    })
    .from(barang)
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(eq(barang.id, idBarang));
  return b;
}

/** K-122: order DISIMPAN yang tanggal ambilnya sebelum `hariIni` (opsional: buatan satu pengguna). */
export async function jumlahDisimpanLewat(
  ex: Executor,
  hariIni: string,
  idPengguna: number | undefined,
) {
  const [r] = await ex
    .select({ n: count() })
    .from(orderPenjualan)
    .where(
      and(
        eq(orderPenjualan.status, 'DISIMPAN'),
        lt(orderPenjualan.tanggalAmbil, hariIni),
        idPengguna === undefined ? undefined : eq(orderPenjualan.idPengguna, idPengguna),
      ),
    );
  return r?.n ?? 0;
}

/** K-200: qty dasar terbanyak per barang dalam satu baris penjualan (bukan void) 90 hari terakhir. */
export async function qtyTerbanyak(ex: Executor, idBarang: number[]): Promise<Map<number, string>> {
  if (idBarang.length === 0) return new Map();
  const r = await ex
    .select({
      idBarang: penjualanDetail.idBarang,
      maks: sql<string>`max(${penjualanDetail.qtyDasar})::text`,
    })
    .from(penjualanDetail)
    .innerJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .where(
      and(
        inArray(penjualanDetail.idBarang, idBarang),
        ne(penjualanDetail.statusItem, 'VOID'),
        ne(penjualan.statusTransaksi, 'VOID'),
        gte(penjualan.tanggal, sql`now() - interval '90 days'`),
      ),
    )
    .groupBy(penjualanDetail.idBarang);
  return new Map(r.map((x) => [x.idBarang, x.maks]));
}
