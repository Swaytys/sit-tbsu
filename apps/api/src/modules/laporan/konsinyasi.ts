import {
  teksPeriode,
  teksTanggalAngka,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type skemaLaporanKonsinyasi,
  type StatusHutang,
} from '@sit/shared';
import type { z } from 'zod';
import { db } from '../../db/client';
import type { PenggunaAktif } from '../../lib/konteks';
import * as repo from '../konsinyasi/repo';
import { ringkasanKonsinyasi } from '../konsinyasi/service';
import { angka, KOSONG, SATUAN_RUPIAH, susunDokumen, tanggal, teks, uang } from './umum';

/*
 * Laporan Konsinyasi (docs/06 KS8, K-089): posisi barang titipan per pemasok (stok titipan, penjualan belum
 * disetor, sisa hutang konsinyasi — posisi saat ini) dan penyelesaian/pembayaran dalam periode.
 */

const LABEL_STATUS: Record<StatusHutang, string> = {
  TIDAK_ADA: '—',
  BELUM_LUNAS: 'Belum lunas',
  SEBAGIAN: 'Sebagian',
  LUNAS: 'Lunas',
};

export type DataLaporanKonsinyasi = z.output<typeof skemaLaporanKonsinyasi>;

export async function laporanKonsinyasi(
  p: DataLaporanKonsinyasi,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const posisi = (await ringkasanKonsinyasi()).filter(
    (r) => p.idPemasok === undefined || r.idPemasok === p.idPemasok,
  );
  const setoran = await repo.penyelesaianPeriode(db, p);
  const dibayar = await repo.bayarPeriode(db, p);

  const jumlah = (f: (r: (typeof posisi)[number]) => number) =>
    posisi.reduce((t, r) => t + f(r), 0);
  const nilaiStok = jumlah((r) => r.nilaiStokTitipan);
  const belum = jumlah((r) => r.nilaiBelumDisetor);
  const sisa = jumlah((r) => r.sisaHutang);
  const totalSetoran = setoran.reduce((t, s) => t + s.total, 0);

  const barisPosisi: BarisTabelLaporan[] = posisi.map((r, i) => ({
    gaya: 'data',
    sel: [
      angka(i + 1),
      teks(r.namaPemasok),
      angka(r.jumlahBarang),
      uang(r.nilaiStokTitipan),
      uang(r.nilaiBelumDisetor),
      uang(r.sisaHutang),
      r.terakhirDisetor ? tanggal(r.terakhirDisetor) : teks('Belum pernah'),
    ],
  }));
  if (posisi.length > 0) {
    barisPosisi.push({
      gaya: 'total',
      label: 'Jumlah',
      sel: [KOSONG, KOSONG, KOSONG, uang(nilaiStok), uang(belum), uang(sisa), KOSONG],
    });
  }

  const barisSetoran: BarisTabelLaporan[] = setoran.map((s, i) => ({
    gaya: 'data',
    sel: [
      angka(i + 1),
      teks(s.nomor, { mono: true }),
      tanggal(s.tanggalOperasional),
      teks(s.namaPemasok),
      teks(`${teksTanggalAngka(s.periodeMulai)} – ${teksTanggalAngka(s.periodeSelesai)}`),
      uang(s.total),
      uang(s.totalDibayar),
      uang(s.sisaHutang ?? s.total - s.totalDibayar),
      teks(LABEL_STATUS[s.statusHutang]),
    ],
  }));
  if (setoran.length > 0) {
    barisSetoran.push({
      gaya: 'total',
      label: 'Jumlah',
      sel: [
        KOSONG,
        KOSONG,
        KOSONG,
        KOSONG,
        KOSONG,
        uang(totalSetoran),
        uang(setoran.reduce((t, s) => t + s.totalDibayar, 0)),
        uang(setoran.reduce((t, s) => t + (s.sisaHutang ?? s.total - s.totalDibayar), 0)),
        KOSONG,
      ],
    });
  }

  return susunDokumen('konsinyasi', pelaku, {
    subjudul: [`Periode ${teksPeriode(p.dari, p.sampai)}`, SATUAN_RUPIAH],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'Ikhtisar',
        baris: [
          {
            label: 'Nilai stok titipan saat ini (harga titip) — informasi, bukan aset toko',
            nilai: uang(nilaiStok),
          },
          { label: 'Penjualan titipan belum disetor (sebelum retur)', nilai: uang(belum) },
          {
            label: `Disetor dalam periode (${setoran.length} penyelesaian)`,
            nilai: uang(totalSetoran),
          },
          { label: 'Dibayar ke pemasok dalam periode', nilai: uang(dibayar) },
          { label: 'Sisa hutang konsinyasi saat ini', nilai: uang(sisa), gaya: 'total' },
        ],
      },
      {
        jenis: 'tabel',
        judul: 'A. Posisi per Pemasok (saat ini)',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'Pemasok', jenis: 'teks', lebar: 30 },
            { judul: 'Barang Titipan', jenis: 'angka', lebar: 10 },
            { judul: 'Nilai Stok Titipan', jenis: 'uang', lebar: 15 },
            { judul: 'Belum Disetor', jenis: 'uang', lebar: 15 },
            { judul: 'Sisa Hutang', jenis: 'uang', lebar: 15 },
            { judul: 'Disetor s/d', jenis: 'tanggal', lebar: 12 },
          ],
          baris: barisPosisi,
          kosong: 'Tidak ada pemasok penitip.',
        },
      },
      {
        jenis: 'tabel',
        judul: 'B. Penyelesaian Konsinyasi dalam Periode',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'No. Dokumen', jenis: 'teks', lebar: 17 },
            { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
            { judul: 'Pemasok', jenis: 'teks', lebar: 22 },
            { judul: 'Periode Penjualan', jenis: 'teks', lebar: 22 },
            { judul: 'Total', jenis: 'uang', lebar: 13 },
            { judul: 'Dibayar', jenis: 'uang', lebar: 13 },
            { judul: 'Sisa', jenis: 'uang', lebar: 13 },
            { judul: 'Status', jenis: 'teks', lebar: 11 },
          ],
          baris: barisSetoran,
          kosong: 'Tidak ada penyelesaian dalam periode ini.',
        },
      },
    ],
    catatan: [
      'Setoran = (qty terjual − qty retur pelanggan kondisi baik) × harga titip saat barang dijual. Retur atas penjualan yang sudah disetor dikoreksi pada setoran berikutnya.',
      'Posisi per pemasok adalah keadaan saat laporan dibuat; tabel B dan pembayaran mengikuti periode.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
