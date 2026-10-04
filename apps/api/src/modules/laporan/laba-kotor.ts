import {
  hargaSatuanEfektif,
  keQty,
  kurangQty,
  subtotalRupiah,
  tambahQty,
  teksPeriode,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type KolomLaporan,
  type KondisiRetur,
  type SelLaporan,
  type skemaLaporanLabaKotor,
} from '@sit/shared';
import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import {
  barang,
  pelanggan,
  penjualan,
  penjualanDetail,
  returPenjualan,
  returPenjualanDetail,
  satuan,
} from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import {
  angka,
  KOSONG,
  persen,
  persenDari,
  qty,
  SATUAN_RUPIAH,
  susunDokumen,
  tanggal,
  teks,
  uang,
} from './umum';

/*
 * Laporan Gross Profit / Laba Kotor Penjualan (docs/05 §14):
 *   omzet = Σ (total_neto − total_void) penjualan status ≠ VOID (tanggal operasional penjualan);
 *   retur = Σ total_retur retur DISETUJUI REFUND/POTONG_TAGIHAN (tanggal operasional retur);
 *   HPP = Σ hpp_saat_transaksi × qty_dasar baris ≠ VOID − Σ hpp_saat_transaksi × qty_retur_dasar retur
 *         DISETUJUI kondisi BAIK (retur rusak/cacat tidak mengurangi HPP); tukar barang netral (K-079);
 *   laba kotor = (omzet − retur) − HPP; margin = laba kotor ÷ penjualan bersih.
 * Nilai HPP per baris dibulatkan ke rupiah utuh lalu dijumlahkan.
 */

export type DataLabaKotor = z.output<typeof skemaLaporanLabaKotor>;

type BarisJual = {
  idPenjualan: number;
  nomor: string;
  tanggal: string;
  idBarang: number;
  kode: string;
  namaBarang: string;
  kodeSatuan: string;
  qty: string;
  penjualan: number;
  hpp: number;
  hppSatuan: number;
};

type BarisRetur = {
  idRetur: number;
  nomorRetur: string;
  nomorPenjualan: string;
  tanggal: string;
  idBarang: number;
  kode: string;
  namaBarang: string;
  kodeSatuan: string;
  qty: string;
  kondisi: KondisiRetur;
  nilai: number;
  hpp: number;
  hppSatuan: number;
};

export type IkhtisarLaba = {
  penjualanBruto: number;
  diskon: number;
  ongkir: number;
  voidSebagian: number;
  omzet: number;
  retur: number;
  penjualanBersih: number;
  hppTerjual: number;
  hppRetur: number;
  hpp: number;
  labaKotor: number;
  margin: number | null;
};

export type HasilLabaKotor = {
  ikhtisar: IkhtisarLaba;
  transaksi: {
    id: number;
    nomor: string;
    tanggal: string;
    namaPembeli: string | null;
    omzet: number;
    diskonTransaksi: number;
    ongkir: number;
  }[];
  returDokumen: {
    id: number;
    nomor: string;
    nomorPenjualan: string;
    tanggal: string;
    nilai: number;
  }[];
  jual: BarisJual[];
  retur: BarisRetur[];
};

export async function hitungLabaKotor(p: DataLabaKotor): Promise<HasilLabaKotor> {
  const transaksi = await db
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      tanggal: penjualan.tanggalOperasional,
      namaPembeli: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`,
      totalBruto: penjualan.totalBruto,
      totalDiskon: penjualan.totalDiskon,
      diskonTransaksi: penjualan.diskonTransaksi,
      ongkir: penjualan.ongkir,
      totalNeto: penjualan.totalNeto,
      totalVoid: penjualan.totalVoid,
    })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(
      and(
        ne(penjualan.statusTransaksi, 'VOID'),
        gte(penjualan.tanggalOperasional, p.dari),
        lte(penjualan.tanggalOperasional, p.sampai),
      ),
    )
    .orderBy(asc(penjualan.tanggalOperasional), asc(penjualan.nomor));

  const jualDb = transaksi.length
    ? await db
        .select({
          idPenjualan: penjualanDetail.idPenjualan,
          idBarang: penjualanDetail.idBarang,
          kode: barang.kode,
          namaBarang: barang.namaBarang,
          kodeSatuan: satuan.kode,
          qty: penjualanDetail.qtyDasar,
          subtotal: penjualanDetail.subtotal,
          hppSatuan: penjualanDetail.hppSaatTransaksi,
        })
        .from(penjualanDetail)
        .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
        .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
        .where(
          and(
            inArray(
              penjualanDetail.idPenjualan,
              transaksi.map((t) => t.id),
            ),
            ne(penjualanDetail.statusItem, 'VOID'),
          ),
        )
        .orderBy(asc(penjualanDetail.idPenjualan), asc(penjualanDetail.id))
    : [];
  const infoTx = new Map(transaksi.map((t) => [t.id, t]));
  const jual: BarisJual[] = jualDb.map((b) => {
    const t = infoTx.get(b.idPenjualan)!;
    return {
      idPenjualan: b.idPenjualan,
      nomor: t.nomor,
      tanggal: t.tanggal,
      idBarang: b.idBarang,
      kode: b.kode,
      namaBarang: b.namaBarang,
      kodeSatuan: b.kodeSatuan,
      qty: keQty(b.qty),
      penjualan: b.subtotal,
      hpp: subtotalRupiah(b.qty, b.hppSatuan),
      hppSatuan: b.hppSatuan,
    };
  });

  const returDokumen = await db
    .select({
      id: returPenjualan.id,
      nomor: returPenjualan.nomor,
      nomorPenjualan: penjualan.nomor,
      tanggal: returPenjualan.tanggalOperasional,
      nilai: returPenjualan.totalRetur,
    })
    .from(returPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, returPenjualan.idPenjualan))
    .where(
      and(
        eq(returPenjualan.status, 'DISETUJUI'),
        ne(returPenjualan.penyelesaian, 'TUKAR_BARANG'),
        gte(returPenjualan.tanggalOperasional, p.dari),
        lte(returPenjualan.tanggalOperasional, p.sampai),
      ),
    )
    .orderBy(asc(returPenjualan.tanggalOperasional), asc(returPenjualan.nomor));
  const infoRetur = new Map(returDokumen.map((r) => [r.id, r]));
  const returDb = returDokumen.length
    ? await db
        .select({
          idRetur: returPenjualanDetail.idRetur,
          idBarang: returPenjualanDetail.idBarang,
          kode: barang.kode,
          namaBarang: barang.namaBarang,
          kodeSatuan: satuan.kode,
          qty: returPenjualanDetail.qtyReturDasar,
          kondisi: returPenjualanDetail.kondisi,
          nilai: returPenjualanDetail.nominalRetur,
          hppSatuan: penjualanDetail.hppSaatTransaksi,
        })
        .from(returPenjualanDetail)
        .innerJoin(penjualanDetail, eq(penjualanDetail.id, returPenjualanDetail.idPenjualanDetail))
        .innerJoin(barang, eq(barang.id, returPenjualanDetail.idBarang))
        .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
        .where(
          inArray(
            returPenjualanDetail.idRetur,
            returDokumen.map((r) => r.id),
          ),
        )
        .orderBy(asc(returPenjualanDetail.idRetur), asc(returPenjualanDetail.id))
    : [];
  const retur: BarisRetur[] = returDb.map((r) => {
    const d = infoRetur.get(r.idRetur)!;
    return {
      idRetur: r.idRetur,
      nomorRetur: d.nomor,
      nomorPenjualan: d.nomorPenjualan,
      tanggal: d.tanggal,
      idBarang: r.idBarang,
      kode: r.kode,
      namaBarang: r.namaBarang,
      kodeSatuan: r.kodeSatuan,
      qty: keQty(r.qty),
      kondisi: r.kondisi,
      nilai: r.nilai,
      // Retur rusak/cacat tidak mengurangi HPP: barangnya kehilangan nilai (docs/05 §14).
      hpp: r.kondisi === 'BAIK' ? subtotalRupiah(r.qty, r.hppSatuan) : 0,
      hppSatuan: r.hppSatuan,
    };
  });

  const ik: IkhtisarLaba = {
    penjualanBruto: 0,
    diskon: 0,
    ongkir: 0,
    voidSebagian: 0,
    omzet: 0,
    retur: returDokumen.reduce((t, r) => t + r.nilai, 0),
    penjualanBersih: 0,
    hppTerjual: jual.reduce((t, b) => t + b.hpp, 0),
    hppRetur: retur.reduce((t, r) => t + r.hpp, 0),
    hpp: 0,
    labaKotor: 0,
    margin: null,
  };
  for (const t of transaksi) {
    ik.penjualanBruto += t.totalBruto;
    ik.diskon += t.totalDiskon;
    ik.ongkir += t.ongkir;
    ik.voidSebagian += t.totalVoid;
    ik.omzet += t.totalNeto - t.totalVoid;
  }
  ik.penjualanBersih = ik.omzet - ik.retur;
  ik.hpp = ik.hppTerjual - ik.hppRetur;
  ik.labaKotor = ik.penjualanBersih - ik.hpp;
  ik.margin = persenDari(ik.labaKotor, ik.penjualanBersih);

  return {
    ikhtisar: ik,
    transaksi: transaksi.map((t) => ({
      id: t.id,
      nomor: t.nomor,
      tanggal: t.tanggal,
      namaPembeli: t.namaPembeli,
      omzet: t.totalNeto - t.totalVoid,
      diskonTransaksi: t.diskonTransaksi,
      ongkir: t.ongkir,
    })),
    returDokumen,
    jual,
    retur,
  };
}

const laba = (penjualan: number, hpp: number): SelLaporan[] => [
  uang(penjualan),
  uang(hpp),
  uang(penjualan - hpp),
  persen(persenDari(penjualan - hpp, penjualan)),
];

/**
 * Baris rekonsiliasi rincian per barang/baris ke ikhtisar: diskon transaksi dan ongkos kirim tidak
 * dialokasikan ke barang; selisih batas nilai void/retur (K-076/K-077) ditampilkan bila ada.
 */
function rekonsiliasi(h: HasilLabaKotor, jumlahPenjualanRincian: number, kosongAwal: number) {
  const pad = Array.from({ length: kosongAwal }, () => KOSONG);
  const diskon = h.transaksi.reduce((t, x) => t + x.diskonTransaksi, 0);
  const ongkir = h.transaksi.reduce((t, x) => t + x.ongkir, 0);
  const selisih = h.ikhtisar.penjualanBersih - (jumlahPenjualanRincian - diskon + ongkir);
  const baris: BarisTabelLaporan[] = [];
  if (diskon > 0) {
    baris.push({
      gaya: 'data',
      label: 'Diskon transaksi (tidak dialokasikan ke barang)',
      sel: [...pad, uang(-diskon), KOSONG, uang(-diskon), KOSONG],
    });
  }
  if (ongkir > 0) {
    baris.push({
      gaya: 'data',
      label: 'Ongkos kirim (tidak dialokasikan ke barang)',
      sel: [...pad, uang(ongkir), KOSONG, uang(ongkir), KOSONG],
    });
  }
  if (selisih !== 0) {
    baris.push({
      gaya: 'data',
      label: 'Penyesuaian batas nilai void/retur',
      sel: [...pad, uang(selisih), KOSONG, uang(selisih), KOSONG],
    });
  }
  return baris;
}

function tabelPerBarang(h: HasilLabaKotor) {
  const per = new Map<
    number,
    { kode: string; nama: string; satuan: string; qty: string; penjualan: number; hpp: number }
  >();
  const ambil = (id: number, kode: string, nama: string, sat: string) => {
    const x = per.get(id) ?? { kode, nama, satuan: sat, qty: '0', penjualan: 0, hpp: 0 };
    per.set(id, x);
    return x;
  };
  for (const b of h.jual) {
    const x = ambil(b.idBarang, b.kode, b.namaBarang, b.kodeSatuan);
    x.qty = tambahQty(x.qty, b.qty);
    x.penjualan += b.penjualan;
    x.hpp += b.hpp;
  }
  for (const r of h.retur) {
    const x = ambil(r.idBarang, r.kode, r.namaBarang, r.kodeSatuan);
    x.qty = kurangQty(x.qty, r.qty);
    x.penjualan -= r.nilai;
    x.hpp -= r.hpp;
  }
  const daftar = [...per.values()].sort(
    (a, b) => b.penjualan - b.hpp - (a.penjualan - a.hpp) || a.nama.localeCompare(b.nama, 'id'),
  );
  const jumlahPenjualan = daftar.reduce((t, x) => t + x.penjualan, 0);
  const jumlahHpp = daftar.reduce((t, x) => t + x.hpp, 0);
  const isi: BarisTabelLaporan[] = daftar.map((x, i) => ({
    gaya: 'data',
    sel: [
      angka(i + 1),
      teks(x.kode, { mono: true }),
      teks(x.nama),
      teks(x.satuan),
      qty(keQty(x.qty)),
      ...laba(x.penjualan, x.hpp),
    ],
  }));
  isi.push({
    gaya: 'subtotal',
    label: 'Jumlah per barang',
    sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, ...laba(jumlahPenjualan, jumlahHpp)],
  });
  isi.push(...rekonsiliasi(h, jumlahPenjualan, 5));
  isi.push(totalIkhtisar(h, 5));
  const kolom: KolomLaporan[] = [
    { judul: 'No', jenis: 'angka', lebar: 5 },
    { judul: 'Kode', jenis: 'teks', lebar: 12 },
    { judul: 'Nama Barang', jenis: 'teks', lebar: 28 },
    { judul: 'Satuan', jenis: 'teks', lebar: 8 },
    { judul: 'Qty Bersih', jenis: 'qty', lebar: 10 },
    ...KOLOM_LABA,
  ];
  return { kolom, baris: isi };
}

const KOLOM_LABA: KolomLaporan[] = [
  { judul: 'Penjualan', jenis: 'uang', lebar: 15 },
  { judul: 'HPP', jenis: 'uang', lebar: 15 },
  { judul: 'Laba Kotor', jenis: 'uang', lebar: 15 },
  { judul: 'Margin', jenis: 'persen', lebar: 9 },
];

function totalIkhtisar(h: HasilLabaKotor, kosongAwal: number): BarisTabelLaporan {
  return {
    gaya: 'total',
    label: 'Jumlah sesuai ikhtisar',
    sel: [
      ...Array.from({ length: kosongAwal }, () => KOSONG),
      ...laba(h.ikhtisar.penjualanBersih, h.ikhtisar.hpp),
    ],
  };
}

function tabelPerTransaksi(h: HasilLabaKotor) {
  const hppTx = new Map<number, number>();
  for (const b of h.jual) hppTx.set(b.idPenjualan, (hppTx.get(b.idPenjualan) ?? 0) + b.hpp);
  const hppRetur = new Map<number, number>();
  for (const r of h.retur) hppRetur.set(r.idRetur, (hppRetur.get(r.idRetur) ?? 0) + r.hpp);
  type Baris = { tanggal: string; nomor: string; ket: string; penjualan: number; hpp: number };
  const daftar: Baris[] = [
    ...h.transaksi.map((t) => ({
      tanggal: t.tanggal,
      nomor: t.nomor,
      ket: t.namaPembeli ?? 'Pembeli umum',
      penjualan: t.omzet,
      hpp: hppTx.get(t.id) ?? 0,
    })),
    ...h.returDokumen.map((r) => ({
      tanggal: r.tanggal,
      nomor: r.nomor,
      ket: `Retur atas ${r.nomorPenjualan}`,
      penjualan: -r.nilai,
      hpp: -(hppRetur.get(r.id) ?? 0),
    })),
  ].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nomor.localeCompare(b.nomor));
  const isi: BarisTabelLaporan[] = daftar.map((x, i) => ({
    gaya: 'data',
    sel: [
      angka(i + 1),
      tanggal(x.tanggal),
      teks(x.nomor, { mono: true }),
      teks(x.ket),
      ...laba(x.penjualan, x.hpp),
    ],
  }));
  isi.push(totalIkhtisar(h, 4));
  const kolom: KolomLaporan[] = [
    { judul: 'No', jenis: 'angka', lebar: 5 },
    { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
    { judul: 'No. Transaksi', jenis: 'teks', lebar: 18 },
    { judul: 'Pembeli / Keterangan', jenis: 'teks', lebar: 24 },
    ...KOLOM_LABA,
  ];
  return { kolom, baris: isi };
}

function tabelPerBaris(h: HasilLabaKotor) {
  type Baris = {
    tanggal: string;
    nomor: string;
    nama: string;
    qty: string;
    harga: number;
    hppSatuan: number;
    penjualan: number;
    hpp: number;
  };
  const daftar: Baris[] = [
    ...h.jual.map((b) => ({
      tanggal: b.tanggal,
      nomor: b.nomor,
      nama: b.namaBarang,
      qty: b.qty,
      harga: hargaSatuanEfektif(b.penjualan, b.qty),
      hppSatuan: b.hppSatuan,
      penjualan: b.penjualan,
      hpp: b.hpp,
    })),
    ...h.retur.map((r) => ({
      tanggal: r.tanggal,
      nomor: r.nomorRetur,
      nama: `${r.namaBarang} (retur ${r.nomorPenjualan}${r.kondisi === 'BAIK' ? '' : `, ${r.kondisi.toLowerCase()}`})`,
      qty: `-${r.qty}`,
      harga: hargaSatuanEfektif(r.nilai, r.qty),
      hppSatuan: r.kondisi === 'BAIK' ? r.hppSatuan : 0,
      penjualan: -r.nilai,
      hpp: -r.hpp,
    })),
  ].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nomor.localeCompare(b.nomor));
  const isi: BarisTabelLaporan[] = daftar.map((x, i) => ({
    gaya: 'data',
    sel: [
      angka(i + 1),
      tanggal(x.tanggal),
      teks(x.nomor, { mono: true }),
      teks(x.nama),
      qty(x.qty),
      uang(x.harga),
      uang(x.hppSatuan),
      ...laba(x.penjualan, x.hpp),
    ],
  }));
  const jumlahPenjualan = daftar.reduce((t, x) => t + x.penjualan, 0);
  const jumlahHpp = daftar.reduce((t, x) => t + x.hpp, 0);
  isi.push({
    gaya: 'subtotal',
    label: 'Jumlah per baris',
    sel: [
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      KOSONG,
      ...laba(jumlahPenjualan, jumlahHpp),
    ],
  });
  isi.push(...rekonsiliasi(h, jumlahPenjualan, 7));
  isi.push(totalIkhtisar(h, 7));
  const kolom: KolomLaporan[] = [
    { judul: 'No', jenis: 'angka', lebar: 5 },
    { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
    { judul: 'No. Dokumen', jenis: 'teks', lebar: 17 },
    { judul: 'Nama Barang', jenis: 'teks', lebar: 26 },
    { judul: 'Qty', jenis: 'qty', lebar: 8 },
    { judul: 'Harga Jual', jenis: 'uang', lebar: 12, grup: 'Per Satuan' },
    { judul: 'HPP', jenis: 'uang', lebar: 12, grup: 'Per Satuan' },
    ...KOLOM_LABA.map((k) => (k.jenis === 'persen' ? k : { ...k, grup: 'Jumlah' })),
  ];
  return { kolom, baris: isi };
}

const JUDUL_TAMPILAN = {
  BARANG: 'II. Rincian per Barang',
  TRANSAKSI: 'II. Rincian per Transaksi',
  BARIS: 'II. Rincian per Baris Penjualan',
} as const;

export async function laporanLabaKotor(
  p: DataLabaKotor,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungLabaKotor(p);
  const ik = h.ikhtisar;
  const tabel =
    p.tampilan === 'BARANG'
      ? tabelPerBarang(h)
      : p.tampilan === 'TRANSAKSI'
        ? tabelPerTransaksi(h)
        : tabelPerBaris(h);
  return susunDokumen('laba-kotor', pelaku, {
    subjudul: [teksPeriode(p.dari, p.sampai), SATUAN_RUPIAH],
    orientasi: p.tampilan === 'BARIS' ? 'lanskap' : 'potret',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'I. Ikhtisar Laba Kotor',
        baris: [
          { label: 'Penjualan', gaya: 'judul' },
          { label: 'Penjualan bruto', nilai: uang(ik.penjualanBruto), tingkat: 1 },
          { label: 'Diskon penjualan', nilai: uang(ik.diskon), tingkat: 1, gaya: 'kurang' },
          { label: 'Ongkos kirim', nilai: uang(ik.ongkir), tingkat: 1 },
          { label: 'Void sebagian', nilai: uang(ik.voidSebagian), tingkat: 1, gaya: 'kurang' },
          { label: 'Omzet (penjualan kotor)', nilai: uang(ik.omzet), tingkat: 1, gaya: 'subtotal' },
          { label: 'Retur penjualan', nilai: uang(ik.retur), tingkat: 1, gaya: 'kurang' },
          { label: 'Penjualan bersih', nilai: uang(ik.penjualanBersih), gaya: 'subtotal' },
          { label: 'Harga pokok penjualan (HPP)', gaya: 'judul' },
          { label: 'HPP barang terjual', nilai: uang(ik.hppTerjual), tingkat: 1 },
          {
            label: 'HPP barang retur kondisi baik',
            nilai: uang(ik.hppRetur),
            tingkat: 1,
            gaya: 'kurang',
          },
          { label: 'Jumlah HPP', nilai: uang(-ik.hpp), gaya: 'subtotal' },
          { label: 'LABA KOTOR (GROSS PROFIT)', nilai: uang(ik.labaKotor), gaya: 'total' },
          { label: 'Margin laba kotor', nilai: persen(ik.margin), tingkat: 1 },
        ],
      },
      {
        jenis: 'tabel',
        judul: JUDUL_TAMPILAN[p.tampilan],
        tabel: { ...tabel, kosong: 'Tidak ada penjualan dalam periode ini.' },
      },
    ],
    catatan: [
      'Laba kotor = penjualan bersih − harga pokok penjualan. Laporan ini bukan laporan laba rugi lengkap: beban operasional (gaji, listrik, sewa, transportasi) belum diperhitungkan.',
      'HPP memakai HPP rata-rata saat transaksi (snapshot di setiap baris penjualan), dibulatkan ke rupiah utuh per baris.',
      'Retur dicatat pada periode retur diajukan, termasuk retur atas penjualan periode sebelumnya. Retur kondisi rusak/cacat tidak mengurangi HPP karena barangnya tidak dapat dijual kembali. Tukar barang bernilai netral.',
      'Pada rincian per barang dan per baris, diskon transaksi dan ongkos kirim tidak dialokasikan ke barang sehingga ditampilkan sebagai baris rekonsiliasi.',
    ],
    berkas: `${p.dari}_${p.sampai}-${p.tampilan.toLowerCase()}`,
  });
}
