import {
  keQty,
  LABEL_KONDISI_RETUR,
  LABEL_METODE_PEMBAYARAN,
  LABEL_PENYELESAIAN_RETUR,
  teksPeriode,
  teksTanggalAngka,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type KondisiRetur,
  type MetodeRefund,
  type PenyelesaianRetur,
  type StatusPersetujuan,
  type skemaLaporanRetur,
} from '@sit/shared';
import { and, asc, count, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import {
  barang,
  barangSatuanJual,
  pelanggan,
  penjualan,
  penjualanDetail,
  returPenjualan,
  returPenjualanDetail,
  satuan,
} from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { kodeSatuanBaris, satuanBaris } from '../penjualan/satuan-baris';
import { angka, KOSONG, qty, SATUAN_RUPIAH, susunDokumen, teks, uang } from './umum';

/*
 * Laporan Retur Penjualan (docs/05 §14): retur DISETUJUI menurut tanggal operasional retur.
 * "Retur periode" = Σ total_retur REFUND + POTONG_TAGIHAN (sama dengan baris retur pada Laporan Penjualan);
 * TUKAR_BARANG ditampilkan terpisah karena bernilai netral (T5).
 */

export type DataReturPenjualan = z.output<typeof skemaLaporanRetur>;

export type DokumenRetur = {
  nomor: string;
  tanggal: string;
  nomorPenjualan: string;
  namaPembeli: string | null;
  alasan: string;
  penyelesaian: PenyelesaianRetur;
  metodeRefund: MetodeRefund | null;
  totalRetur: number;
  baris: {
    kode: string;
    namaBarang: string;
    kodeSatuan: string;
    qty: string;
    kondisi: KondisiRetur;
    hargaSatuan: number;
    nominal: number;
  }[];
};

export type HasilReturPenjualan = {
  dokumen: DokumenRetur[];
  perPenyelesaian: Record<PenyelesaianRetur, { jumlah: number; nilai: number }>;
  /** REFUND + POTONG_TAGIHAN: mengurangi penjualan. */
  totalMengurangi: number;
  perKondisi: Record<KondisiRetur, number>;
  perStatusLain: Record<Exclude<StatusPersetujuan, 'DISETUJUI' | 'DIBATALKAN'>, number>;
};

export async function hitungReturPenjualan(p: DataReturPenjualan): Promise<HasilReturPenjualan> {
  const periode = and(
    gte(returPenjualan.tanggalOperasional, p.dari),
    lte(returPenjualan.tanggalOperasional, p.sampai),
  );
  const header = await db
    .select({
      id: returPenjualan.id,
      nomor: returPenjualan.nomor,
      tanggal: returPenjualan.tanggalOperasional,
      nomorPenjualan: penjualan.nomor,
      namaPembeli: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`,
      alasan: returPenjualan.alasan,
      penyelesaian: returPenjualan.penyelesaian,
      metodeRefund: returPenjualan.metodeRefund,
      totalRetur: returPenjualan.totalRetur,
    })
    .from(returPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, returPenjualan.idPenjualan))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(and(eq(returPenjualan.status, 'DISETUJUI'), periode))
    .orderBy(asc(returPenjualan.tanggalOperasional), asc(returPenjualan.nomor));

  const detail = header.length
    ? await db
        .select({
          idRetur: returPenjualanDetail.idRetur,
          kode: barang.kode,
          namaBarang: barang.namaBarang,
          kodeSatuan: kodeSatuanBaris,
          qty: returPenjualanDetail.qtyRetur,
          kondisi: returPenjualanDetail.kondisi,
          hargaSatuan: returPenjualanDetail.hargaSatuanEfektif,
          nominal: returPenjualanDetail.nominalRetur,
        })
        .from(returPenjualanDetail)
        .innerJoin(penjualanDetail, eq(penjualanDetail.id, returPenjualanDetail.idPenjualanDetail))
        .innerJoin(barang, eq(barang.id, returPenjualanDetail.idBarang))
        .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
        .leftJoin(barangSatuanJual, eq(barangSatuanJual.id, penjualanDetail.idSatuanJual))
        .leftJoin(satuanBaris, eq(satuanBaris.id, barangSatuanJual.idSatuan))
        .where(
          inArray(
            returPenjualanDetail.idRetur,
            header.map((h) => h.id),
          ),
        )
        .orderBy(asc(returPenjualanDetail.id))
    : [];

  const lain = await db
    .select({ status: returPenjualan.status, n: count() })
    .from(returPenjualan)
    .where(and(periode, sql`${returPenjualan.status} <> 'DISETUJUI'`))
    .groupBy(returPenjualan.status);

  const hasil: HasilReturPenjualan = {
    dokumen: [],
    perPenyelesaian: {
      REFUND: { jumlah: 0, nilai: 0 },
      POTONG_TAGIHAN: { jumlah: 0, nilai: 0 },
      TUKAR_BARANG: { jumlah: 0, nilai: 0 },
    },
    totalMengurangi: 0,
    perKondisi: { BAIK: 0, RUSAK: 0, CACAT: 0 },
    perStatusLain: { MENUNGGU: 0, DITOLAK: 0 },
  };
  for (const l of lain) {
    // Pengajuan yang dibatalkan pengajunya (K-099) tidak dilaporkan: tidak pernah diputuskan.
    if (l.status === 'MENUNGGU' || l.status === 'DITOLAK') hasil.perStatusLain[l.status] = l.n;
  }
  for (const h of header) {
    const baris = detail
      .filter((d) => d.idRetur === h.id)
      .map((d) => ({
        kode: d.kode,
        namaBarang: d.namaBarang,
        kodeSatuan: d.kodeSatuan,
        qty: keQty(d.qty),
        kondisi: d.kondisi,
        hargaSatuan: d.hargaSatuan,
        nominal: d.nominal,
      }));
    for (const b of baris) hasil.perKondisi[b.kondisi] += 1;
    hasil.perPenyelesaian[h.penyelesaian].jumlah += 1;
    hasil.perPenyelesaian[h.penyelesaian].nilai += h.totalRetur;
    if (h.penyelesaian !== 'TUKAR_BARANG') hasil.totalMengurangi += h.totalRetur;
    hasil.dokumen.push({
      nomor: h.nomor,
      tanggal: h.tanggal,
      nomorPenjualan: h.nomorPenjualan,
      namaPembeli: h.namaPembeli,
      alasan: h.alasan,
      penyelesaian: h.penyelesaian,
      metodeRefund: h.metodeRefund,
      totalRetur: h.totalRetur,
      baris,
    });
  }
  return hasil;
}

export async function laporanReturPenjualan(
  p: DataReturPenjualan,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungReturPenjualan(p);
  const isi: BarisTabelLaporan[] = [];
  let no = 0;
  for (const d of h.dokumen) {
    const penyelesaian =
      d.penyelesaian === 'REFUND' && d.metodeRefund
        ? `Refund ${LABEL_METODE_PEMBAYARAN[d.metodeRefund].toLowerCase()}`
        : LABEL_PENYELESAIAN_RETUR[d.penyelesaian];
    isi.push({
      gaya: 'grup',
      sel: [],
      label: `${d.nomor} · ${teksTanggalAngka(d.tanggal)} · atas ${d.nomorPenjualan} · ${d.namaPembeli ?? 'Pembeli umum'} · ${penyelesaian} · Alasan: ${d.alasan}`,
    });
    for (const b of d.baris) {
      isi.push({
        gaya: 'data',
        sel: [
          angka(++no),
          teks(b.kode, { mono: true }),
          teks(b.namaBarang),
          qty(b.qty),
          teks(b.kodeSatuan),
          teks(LABEL_KONDISI_RETUR[b.kondisi], {
            nada: b.kondisi === 'BAIK' ? undefined : 'peringatan',
          }),
          uang(b.hargaSatuan),
          uang(b.nominal),
        ],
      });
    }
    isi.push({
      gaya: 'subtotal',
      label:
        d.penyelesaian === 'TUKAR_BARANG'
          ? `Nilai tukar barang ${d.nomor} (netral)`
          : `Nilai retur ${d.nomor}`,
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(d.totalRetur)],
    });
  }
  if (h.dokumen.length > 0) {
    isi.push({
      gaya: 'total',
      label: 'Jumlah retur yang mengurangi penjualan (refund & potong tagihan)',
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(h.totalMengurangi)],
    });
  }

  const pp = h.perPenyelesaian;
  return susunDokumen('retur-penjualan', pelaku, {
    subjudul: [teksPeriode(p.dari, p.sampai), SATUAN_RUPIAH],
    orientasi: 'potret',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'I. Ikhtisar Retur',
        baris: [
          {
            label: `Refund (${pp.REFUND.jumlah} dokumen)`,
            nilai: uang(pp.REFUND.nilai),
            tingkat: 1,
          },
          {
            label: `Potong tagihan (${pp.POTONG_TAGIHAN.jumlah} dokumen)`,
            nilai: uang(pp.POTONG_TAGIHAN.nilai),
            tingkat: 1,
          },
          {
            label: 'Retur yang mengurangi penjualan',
            nilai: uang(h.totalMengurangi),
            gaya: 'total',
          },
          {
            label: `Tukar barang — nilai netral (${pp.TUKAR_BARANG.jumlah} dokumen)`,
            nilai: uang(pp.TUKAR_BARANG.nilai),
            tingkat: 1,
          },
        ],
      },
      {
        jenis: 'info',
        judul: 'Statistik',
        pasangan: [
          {
            label: 'Baris barang menurut kondisi',
            nilai: `Baik ${h.perKondisi.BAIK} · Rusak ${h.perKondisi.RUSAK} · Cacat ${h.perKondisi.CACAT}`,
          },
          {
            label: 'Pengajuan lain dalam periode',
            nilai: `Menunggu persetujuan ${h.perStatusLain.MENUNGGU} · Ditolak ${h.perStatusLain.DITOLAK}`,
          },
        ],
      },
      {
        jenis: 'tabel',
        judul: 'II. Rincian Retur Disetujui',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'Kode', jenis: 'teks', lebar: 12 },
            { judul: 'Nama Barang', jenis: 'teks', lebar: 30 },
            { judul: 'Qty', jenis: 'qty', lebar: 8 },
            { judul: 'Satuan', jenis: 'teks', lebar: 8 },
            { judul: 'Kondisi', jenis: 'teks', lebar: 9 },
            { judul: 'Harga Satuan', jenis: 'uang', lebar: 13 },
            { judul: 'Nilai', jenis: 'uang', lebar: 14 },
          ],
          baris: isi,
          kosong: 'Tidak ada retur yang disetujui dalam periode ini.',
        },
      },
    ],
    catatan: [
      'Retur dicatat menurut tanggal pengajuan; hanya retur yang sudah disetujui. Harga satuan = harga efektif baris penjualan asal (setelah diskon per barang).',
      'Nilai retur per dokumen dapat lebih kecil dari jumlah barisnya bila dibatasi sisa nilai transaksi (diskon transaksi).',
      'Tukar barang diganti dengan barang yang sama, tidak mengubah nilai penjualan; ditampilkan untuk penelusuran.',
      'Barang kondisi baik kembali ke stok jual; kondisi rusak/cacat masuk stok rusak.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
