import {
  teksPeriode,
  teksTanggalAngka,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type skemaLaporanPromo,
} from '@sit/shared';
import { and, asc, eq, gte, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { barang, penjualan, penjualanDetail, promo, satuan } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { uraianPotongan } from '../promo/service';
import {
  angka,
  KOSONG,
  persen,
  persenDari,
  qty,
  SATUAN_RUPIAH,
  susunDokumen,
  teks,
  uang,
} from './umum';

/*
 * Laporan Promo (docs/06 PR7, K-087): pemakaian setiap promo dalam periode — transaksi, baris, penjualan
 * bruto baris berpromo, potongan promo, dan penjualan bersihnya. Dasar: penjualan_detail ber-id_promo
 * dengan status_item ≠ VOID pada tanggal operasional penjualan dalam periode.
 */

export type DataLaporanPromo = z.output<typeof skemaLaporanPromo>;

export type BarisPromoLaporan = {
  id: number;
  kode: string;
  nama: string;
  potongan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  statusAktif: string;
  transaksi: number;
  baris: number;
  bruto: number;
  diskonPromo: number;
  bersih: number;
};

export type BarisBarangPromo = {
  idPromo: number;
  kode: string;
  namaBarang: string;
  kodeSatuan: string;
  qty: string;
  bruto: number;
  diskonPromo: number;
  bersih: number;
};

export type HasilLaporanPromo = {
  promo: BarisPromoLaporan[];
  barang: BarisBarangPromo[];
  /** Σ subtotal seluruh baris penjualan (bukan void) dalam periode, untuk porsi baris berpromo. */
  penjualanBarang: number;
  transaksiBerpromo: number;
};

const dalamPeriode = (p: DataLaporanPromo) =>
  and(
    ne(penjualanDetail.statusItem, 'VOID'),
    gte(penjualan.tanggalOperasional, p.dari),
    lte(penjualan.tanggalOperasional, p.sampai),
  );

export async function hitungLaporanPromo(p: DataLaporanPromo): Promise<HasilLaporanPromo> {
  const bruto = sql<string>`sum(${penjualanDetail.subtotal} + ${penjualanDetail.diskonBaris} + ${penjualanDetail.diskonPromo})::text`;
  const pakai = await db
    .select({
      idPromo: sql<number>`${penjualanDetail.idPromo}`,
      transaksi: sql<number>`count(distinct ${penjualanDetail.idPenjualan})::int`,
      baris: sql<number>`count(*)::int`,
      bruto,
      diskonPromo: sql<string>`sum(${penjualanDetail.diskonPromo})::text`,
      bersih: sql<string>`sum(${penjualanDetail.subtotal})::text`,
    })
    .from(penjualanDetail)
    .innerJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .where(and(dalamPeriode(p), isNotNull(penjualanDetail.idPromo)))
    .groupBy(penjualanDetail.idPromo);
  const perPromo = new Map(pakai.map((x) => [Number(x.idPromo), x]));

  // Promo terpakai, ditambah promo yang masa berlakunya beririsan dengan periode walau belum terpakai.
  const daftar = await db
    .select({
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
    })
    .from(promo)
    .where(
      or(
        perPromo.size > 0 ? inArray(promo.id, [...perPromo.keys()]) : undefined,
        and(lte(promo.tanggalMulai, p.sampai), gte(promo.tanggalSelesai, p.dari)),
      ),
    )
    .orderBy(asc(promo.kode));

  const rincian = await db
    .select({
      idPromo: sql<number>`${penjualanDetail.idPromo}`,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: satuan.kode,
      qty: sql<string>`sum(${penjualanDetail.qtyDasar})::text`,
      bruto,
      diskonPromo: sql<string>`sum(${penjualanDetail.diskonPromo})::text`,
      bersih: sql<string>`sum(${penjualanDetail.subtotal})::text`,
    })
    .from(penjualanDetail)
    .innerJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(and(dalamPeriode(p), isNotNull(penjualanDetail.idPromo)))
    .groupBy(penjualanDetail.idPromo, barang.id, satuan.kode)
    .orderBy(
      asc(penjualanDetail.idPromo),
      sql`sum(${penjualanDetail.diskonPromo}) desc`,
      asc(barang.namaBarang),
    );

  const [semua] = await db
    .select({
      nilai: sql<string>`coalesce(sum(${penjualanDetail.subtotal}), 0)::text`,
      transaksiPromo: sql<number>`count(distinct ${penjualanDetail.idPenjualan}) filter (where ${penjualanDetail.idPromo} is not null)::int`,
    })
    .from(penjualanDetail)
    .innerJoin(penjualan, eq(penjualan.id, penjualanDetail.idPenjualan))
    .where(dalamPeriode(p));

  return {
    promo: daftar.map((x) => {
      const u = perPromo.get(x.id);
      return {
        id: x.id,
        kode: x.kode,
        nama: x.nama,
        potongan: uraianPotongan(x),
        tanggalMulai: x.tanggalMulai,
        tanggalSelesai: x.tanggalSelesai,
        statusAktif: x.statusAktif,
        transaksi: u?.transaksi ?? 0,
        baris: u?.baris ?? 0,
        bruto: Number(u?.bruto ?? 0),
        diskonPromo: Number(u?.diskonPromo ?? 0),
        bersih: Number(u?.bersih ?? 0),
      };
    }),
    barang: rincian.map((r) => ({
      idPromo: Number(r.idPromo),
      kode: r.kode,
      namaBarang: r.namaBarang,
      kodeSatuan: r.kodeSatuan,
      qty: r.qty,
      bruto: Number(r.bruto),
      diskonPromo: Number(r.diskonPromo),
      bersih: Number(r.bersih),
    })),
    penjualanBarang: Number(semua?.nilai ?? 0),
    transaksiBerpromo: semua?.transaksiPromo ?? 0,
  };
}

/** "01/10 – 31/10/2026" (tahun sama) atau "15/12/2026 – 15/01/2027". */
function masa(mulai: string, selesai: string): string {
  const akhir = teksTanggalAngka(selesai);
  if (mulai === selesai) return akhir;
  const awal = teksTanggalAngka(mulai);
  return mulai.slice(0, 4) === selesai.slice(0, 4)
    ? `${awal.slice(0, 5)} – ${akhir}`
    : `${awal} – ${akhir}`;
}

export async function laporanPromo(
  p: DataLaporanPromo,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungLaporanPromo(p);
  const jumlah = h.promo.reduce(
    (t, x) => ({
      baris: t.baris + x.baris,
      bruto: t.bruto + x.bruto,
      diskonPromo: t.diskonPromo + x.diskonPromo,
      bersih: t.bersih + x.bersih,
    }),
    { baris: 0, bruto: 0, diskonPromo: 0, bersih: 0 },
  );

  const isiPromo: BarisTabelLaporan[] = h.promo.map((x) => ({
    gaya: 'data',
    sel: [
      teks(x.kode, { mono: true }),
      teks(x.nama, { tebal: x.diskonPromo > 0 }),
      teks(x.potongan),
      teks(masa(x.tanggalMulai, x.tanggalSelesai)),
      teks(x.statusAktif === 'AKTIF' ? 'Aktif' : 'Nonaktif', {
        nada: x.statusAktif === 'AKTIF' ? undefined : 'peringatan',
      }),
      angka(x.transaksi),
      angka(x.baris),
      uang(x.bruto),
      uang(x.diskonPromo),
      uang(x.bersih),
      persen(persenDari(x.diskonPromo, x.bruto)),
    ],
  }));
  isiPromo.push({
    gaya: 'total',
    label: `Jumlah (${h.promo.length} promo)`,
    sel: [
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      angka(h.transaksiBerpromo),
      angka(jumlah.baris),
      uang(jumlah.bruto),
      uang(jumlah.diskonPromo),
      uang(jumlah.bersih),
      persen(persenDari(jumlah.diskonPromo, jumlah.bruto)),
    ],
  });

  const isiBarang: BarisTabelLaporan[] = [];
  for (const x of h.promo) {
    const milik = h.barang.filter((b) => b.idPromo === x.id);
    if (milik.length === 0) continue;
    isiBarang.push({ gaya: 'grup', sel: [], label: `${x.kode} — ${x.nama} (${x.potongan})` });
    for (const b of milik) {
      isiBarang.push({
        gaya: 'data',
        sel: [
          teks(b.kode, { mono: true }),
          teks(b.namaBarang),
          teks(b.kodeSatuan),
          qty(b.qty),
          uang(b.bruto),
          uang(b.diskonPromo),
          uang(b.bersih),
        ],
      });
    }
    isiBarang.push({
      gaya: 'subtotal',
      label: `Subtotal ${x.kode}`,
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, uang(x.bruto), uang(x.diskonPromo), uang(x.bersih)],
    });
  }

  return susunDokumen('promo', pelaku, {
    subjudul: [teksPeriode(p.dari, p.sampai), SATUAN_RUPIAH],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'Ikhtisar',
        baris: [
          { label: 'Penjualan barang (seluruh transaksi)', nilai: uang(h.penjualanBarang) },
          { label: 'Penjualan bersih barang berpromo', nilai: uang(jumlah.bersih), tingkat: 1 },
          {
            label: 'Porsi penjualan berpromo',
            nilai: persen(persenDari(jumlah.bersih, h.penjualanBarang)),
            tingkat: 1,
          },
          {
            label: 'Potongan promo yang diberikan',
            nilai: uang(jumlah.diskonPromo),
            gaya: 'kurang',
          },
          {
            label: 'Transaksi yang memakai promo',
            nilai: angka(h.transaksiBerpromo),
            gaya: 'total',
          },
        ],
      },
      {
        jenis: 'tabel',
        judul: 'Ringkasan per Promo',
        tabel: {
          kolom: [
            { judul: 'Kode', jenis: 'teks', lebar: 10 },
            { judul: 'Nama Promo', jenis: 'teks', lebar: 22 },
            { judul: 'Potongan', jenis: 'teks', lebar: 14 },
            { judul: 'Masa Promo', jenis: 'teks', lebar: 17 },
            { judul: 'Status', jenis: 'teks', lebar: 8 },
            { judul: 'Transaksi', jenis: 'angka', lebar: 8 },
            { judul: 'Baris', jenis: 'angka', lebar: 6 },
            { judul: 'Penjualan Bruto', jenis: 'uang', lebar: 13 },
            { judul: 'Potongan Promo', jenis: 'uang', lebar: 13 },
            { judul: 'Penjualan Bersih', jenis: 'uang', lebar: 13 },
            { judul: 'Rasio Potongan', jenis: 'persen', lebar: 8 },
          ],
          baris: isiPromo,
          kosong: 'Tidak ada promo dalam periode ini.',
        },
      },
      {
        jenis: 'tabel',
        judul: 'Rincian per Barang',
        tabel: {
          kolom: [
            { judul: 'Kode', jenis: 'teks', lebar: 12 },
            { judul: 'Nama Barang', jenis: 'teks', lebar: 34 },
            { judul: 'Satuan', jenis: 'teks', lebar: 8 },
            { judul: 'Qty', jenis: 'qty', lebar: 10 },
            { judul: 'Penjualan Bruto', jenis: 'uang', lebar: 15 },
            { judul: 'Potongan Promo', jenis: 'uang', lebar: 15 },
            { judul: 'Penjualan Bersih', jenis: 'uang', lebar: 15 },
          ],
          baris: isiBarang,
          kosong: 'Belum ada barang yang terjual dengan promo dalam periode ini.',
        },
      },
    ],
    catatan: [
      'Penjualan bruto = harga × kuantitas baris berpromo; potongan promo dihitung per baris saat pembayaran (satu promo per baris, potongan terbesar).',
      'Penjualan bersih = penjualan bruto − potongan promo − diskon manual per baris; belum dikurangi diskon transaksi, ongkos kirim, maupun retur. Baris yang di-void tidak dihitung.',
      'Promo yang masa berlakunya beririsan dengan periode ditampilkan walau belum terpakai. Rasio potongan = potongan promo ÷ penjualan bruto baris berpromo.',
      'Qty dalam satuan dasar barang.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
