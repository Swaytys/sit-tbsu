import {
  nomorHari,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type skemaLaporanPiutang,
} from '@sit/shared';
import { and, asc, eq, lt, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { pelanggan, penjualan } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import {
  angka,
  KOSONG,
  SATUAN_RUPIAH,
  susunDokumen,
  tanggal,
  teks,
  teksPerSaatIni,
  uang,
} from './umum';

/*
 * Laporan Piutang Usaha (docs/05 §14, docs/06 PT1): penjualan status ≠ VOID dan status pembayaran ≠ LUNAS,
 * per pelanggan: sisa tagihan, jatuh tempo, dan umur (hari lewat jatuh tempo). Posisi saat ini.
 * Pengelompokan umur 0–30/31–60/61–90/>90 hari menyusul di Fase 10 (PT5).
 */

export type DataPiutang = z.output<typeof skemaLaporanPiutang>;

export type BarisPiutang = {
  idPelanggan: number | null;
  namaPelanggan: string;
  kodePelanggan: string | null;
  noHp: string | null;
  nomor: string;
  tanggal: string;
  jatuhTempo: string | null;
  tagihan: number;
  dibayar: number;
  sisa: number;
  /** Hari lewat jatuh tempo (> 0 = terlambat; ≤ 0 = belum jatuh tempo); null bila tanpa jatuh tempo. */
  umurHari: number | null;
};

export type HasilPiutang = {
  baris: BarisPiutang[];
  total: number;
  belumJatuhTempo: number;
  lewatJatuhTempo: number;
  jumlahPelanggan: number;
};

export async function hitungPiutang(p: DataPiutang): Promise<HasilPiutang> {
  const hariIni = tanggalOperasional();
  const r = await db
    .select({
      idPelanggan: penjualan.idPelanggan,
      namaPelanggan: sql<string>`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli}, 'Pembeli umum')`,
      kodePelanggan: pelanggan.kode,
      noHp: pelanggan.noHp,
      nomor: penjualan.nomor,
      tanggal: penjualan.tanggalOperasional,
      jatuhTempo: penjualan.tanggalJatuhTempo,
      totalNeto: penjualan.totalNeto,
      totalVoid: penjualan.totalVoid,
      totalRetur: penjualan.totalRetur,
      totalDibayar: penjualan.totalDibayar,
      totalRefund: penjualan.totalRefund,
      sisa: sql<number>`${penjualan.sisaTagihan}`.mapWith(Number),
    })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(
      and(
        ne(penjualan.statusTransaksi, 'VOID'),
        ne(penjualan.statusPembayaran, 'LUNAS'),
        p.idPelanggan === undefined ? undefined : eq(penjualan.idPelanggan, p.idPelanggan),
        p.terlambat ? lt(penjualan.tanggalJatuhTempo, hariIni) : undefined,
      ),
    )
    .orderBy(
      asc(sql`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`),
      asc(penjualan.tanggalJatuhTempo),
      asc(penjualan.nomor),
    );

  const hasil: HasilPiutang = {
    baris: [],
    total: 0,
    belumJatuhTempo: 0,
    lewatJatuhTempo: 0,
    jumlahPelanggan: new Set(r.map((x) => x.idPelanggan ?? x.namaPelanggan)).size,
  };
  for (const x of r) {
    const umurHari = x.jatuhTempo ? nomorHari(hariIni) - nomorHari(x.jatuhTempo) : null;
    hasil.baris.push({
      idPelanggan: x.idPelanggan,
      namaPelanggan: x.namaPelanggan,
      kodePelanggan: x.kodePelanggan,
      noHp: x.noHp,
      nomor: x.nomor,
      tanggal: x.tanggal,
      jatuhTempo: x.jatuhTempo,
      tagihan: x.totalNeto - x.totalVoid - x.totalRetur,
      dibayar: x.totalDibayar - x.totalRefund,
      sisa: x.sisa,
      umurHari,
    });
    hasil.total += x.sisa;
    if (umurHari !== null && umurHari > 0) hasil.lewatJatuhTempo += x.sisa;
    else hasil.belumJatuhTempo += x.sisa;
  }
  return hasil;
}

function teksUmur(umur: number | null) {
  if (umur === null) return teks('—');
  if (umur > 0) return teks(`Lewat ${umur} hari`, { nada: 'bahaya', tebal: true });
  if (umur === 0) return teks('Jatuh tempo hari ini', { nada: 'peringatan', tebal: true });
  return teks(`${-umur} hari lagi`);
}

export async function laporanPiutang(
  p: DataPiutang,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungPiutang(p);
  const isi: BarisTabelLaporan[] = [];
  let no = 0;
  for (let i = 0; i < h.baris.length;) {
    const awal = h.baris[i]!;
    const kunci = awal.idPelanggan ?? awal.namaPelanggan;
    isi.push({
      gaya: 'grup',
      sel: [],
      label: [awal.namaPelanggan, awal.kodePelanggan, awal.noHp].filter(Boolean).join(' · '),
    });
    let sub = 0;
    for (
      ;
      i < h.baris.length && (h.baris[i]!.idPelanggan ?? h.baris[i]!.namaPelanggan) === kunci;
      i++
    ) {
      const b = h.baris[i]!;
      sub += b.sisa;
      isi.push({
        gaya: 'data',
        sel: [
          angka(++no),
          teks(b.nomor, { mono: true }),
          tanggal(b.tanggal),
          b.jatuhTempo ? tanggal(b.jatuhTempo) : teks('—'),
          uang(b.tagihan),
          uang(b.dibayar),
          uang(b.sisa),
          teksUmur(b.umurHari),
        ],
      });
    }
    isi.push({
      gaya: 'subtotal',
      label: `Jumlah ${awal.namaPelanggan}`,
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(sub), KOSONG],
    });
  }
  if (h.baris.length > 0) {
    isi.push({
      gaya: 'total',
      label: 'Jumlah piutang usaha',
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(h.total), KOSONG],
    });
  }
  return susunDokumen('piutang', pelaku, {
    subjudul: [
      teksPerSaatIni(),
      p.terlambat ? 'Hanya piutang yang lewat jatuh tempo' : 'Semua piutang belum lunas',
      SATUAN_RUPIAH,
    ],
    orientasi: 'potret',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'Ikhtisar',
        baris: [
          { label: 'Belum jatuh tempo', nilai: uang(h.belumJatuhTempo), tingkat: 1 },
          { label: 'Lewat jatuh tempo', nilai: uang(h.lewatJatuhTempo), tingkat: 1 },
          {
            label: `Jumlah piutang usaha (${h.baris.length} invoice, ${h.jumlahPelanggan} pelanggan)`,
            nilai: uang(h.total),
            gaya: 'total',
          },
        ],
      },
      {
        jenis: 'tabel',
        judul: 'Rincian per Pelanggan',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'No. Invoice', jenis: 'teks', lebar: 18 },
            { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
            { judul: 'Jatuh Tempo', jenis: 'tanggal', lebar: 11 },
            { judul: 'Tagihan', jenis: 'uang', lebar: 14 },
            { judul: 'Dibayar', jenis: 'uang', lebar: 14 },
            { judul: 'Sisa', jenis: 'uang', lebar: 14 },
            { judul: 'Umur', jenis: 'teks', lebar: 16 },
          ],
          baris: isi,
          kosong: 'Tidak ada piutang.',
        },
      },
    ],
    catatan: [
      'Tagihan = total invoice dikurangi void dan retur; dibayar = pembayaran diterima dikurangi refund; sisa = tagihan − dibayar.',
      'Umur dihitung dari tanggal jatuh tempo sampai hari ini.',
      'Pengelompokan umur piutang (0–30, 31–60, 61–90, > 90 hari) tersedia mulai Fase 10.',
    ],
    berkas: tanggalOperasional(),
  });
}
