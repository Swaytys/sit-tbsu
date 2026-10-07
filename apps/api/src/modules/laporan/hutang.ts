import {
  LABEL_KELOMPOK_UMUR,
  type BarisHutang,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type skemaLaporanHutang,
} from '@sit/shared';
import type { z } from 'zod';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import { semuaBarisHutang } from '../hutang/service';
import { bagianUmur, ikhtisarUmur, kelompokkanUmur } from './umur';
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
 * Laporan Hutang Usaha (docs/06 HT5, K-088): hutang ke pemasok yang belum lunas — penerimaan pembelian
 * tempo dan penyelesaian konsinyasi — per pemasok, per dokumen, dan per kelompok umur. Posisi saat ini.
 */

export type DataLaporanHutang = z.output<typeof skemaLaporanHutang>;

export async function hitungLaporanHutang(p: DataLaporanHutang): Promise<BarisHutang[]> {
  return (await semuaBarisHutang(tanggalOperasional()))
    .filter(
      (b) =>
        (p.idPemasok === undefined || b.idPemasok === p.idPemasok) &&
        (!p.terlambat || (b.hariLewat !== null && b.hariLewat > 0)),
    )
    .sort(
      (a, b) =>
        a.namaPemasok.localeCompare(b.namaPemasok) ||
        a.idPemasok - b.idPemasok ||
        (a.tanggalJatuhTempo ?? '9999').localeCompare(b.tanggalJatuhTempo ?? '9999') ||
        a.nomor.localeCompare(b.nomor),
    );
}

function teksUmur(b: BarisHutang) {
  if (b.hariLewat === null) return teks('—');
  if (b.hariLewat > 0) {
    return teks(`Lewat ${b.hariLewat} hari`, { nada: 'bahaya', tebal: b.hariLewat > 30 });
  }
  if (b.hariLewat === 0) return teks('Jatuh tempo hari ini', { nada: 'peringatan' });
  return teks(`${-b.hariLewat} hari lagi`);
}

export async function laporanHutang(
  p: DataLaporanHutang,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const baris = await hitungLaporanHutang(p);
  const umur = kelompokkanUmur(
    baris,
    (b) => b.namaPemasok,
    (b) => b.hariLewat,
    (b) => b.sisa,
  );
  const isi: BarisTabelLaporan[] = [];
  let no = 0;
  for (let i = 0; i < baris.length;) {
    const awal = baris[i]!;
    isi.push({ gaya: 'grup', sel: [], label: awal.namaPemasok });
    let sub = 0;
    for (; i < baris.length && baris[i]!.idPemasok === awal.idPemasok; i++) {
      const b = baris[i]!;
      sub += b.sisa;
      isi.push({
        gaya: 'data',
        sel: [
          angka(++no),
          teks(b.nomor, { mono: true }),
          tanggal(b.tanggalOperasional),
          teks(b.noFaktur ?? (b.jenis === 'KONSINYASI' ? 'Konsinyasi' : '—')),
          b.tanggalJatuhTempo ? tanggal(b.tanggalJatuhTempo) : teks('—'),
          uang(b.total),
          uang(b.dibayar),
          uang(b.returPotong),
          uang(b.sisa),
          teksUmur(b),
        ],
      });
    }
    isi.push({
      gaya: 'subtotal',
      label: `Jumlah ${awal.namaPemasok}`,
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(sub), KOSONG],
    });
  }
  const total = baris.reduce((t, b) => t + b.sisa, 0);
  if (baris.length > 0) {
    isi.push({
      gaya: 'total',
      label: 'Jumlah hutang usaha',
      sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(total), KOSONG],
    });
  }
  const jumlahPemasok = new Set(baris.map((b) => b.idPemasok)).size;

  return susunDokumen('hutang', pelaku, {
    subjudul: [
      teksPerSaatIni(),
      p.terlambat ? 'Hanya hutang yang lewat jatuh tempo' : 'Semua hutang belum lunas',
      SATUAN_RUPIAH,
    ],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'Ikhtisar',
        baris: [
          ...ikhtisarUmur(umur.total),
          {
            label: `Jumlah hutang usaha (${baris.length} dokumen, ${jumlahPemasok} pemasok)`,
            nilai: uang(total),
            gaya: 'total',
          },
        ],
      },
      bagianUmur('Umur Hutang per Pemasok', 'Pemasok', umur.per, umur.total),
      {
        jenis: 'tabel',
        judul: 'Rincian per Pemasok',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'No. Dokumen', jenis: 'teks', lebar: 17 },
            { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
            { judul: 'No. Faktur', jenis: 'teks', lebar: 14 },
            { judul: 'Jatuh Tempo', jenis: 'tanggal', lebar: 11 },
            { judul: 'Total', jenis: 'uang', lebar: 13 },
            { judul: 'Dibayar', jenis: 'uang', lebar: 13 },
            { judul: 'Potong Retur', jenis: 'uang', lebar: 12 },
            { judul: 'Sisa', jenis: 'uang', lebar: 13 },
            { judul: 'Umur', jenis: 'teks', lebar: 16 },
          ],
          baris: isi,
          kosong: 'Tidak ada hutang.',
        },
      },
    ],
    catatan: [
      'Hutang = penerimaan pembelian tempo dan penyelesaian konsinyasi yang belum lunas; sisa = total − dibayar − potongan retur ke pemasok.',
      `Kelompok umur menurut hari lewat jatuh tempo (${Object.values(LABEL_KELOMPOK_UMUR).join(', ')}); jatuh tempo hari ini termasuk belum jatuh tempo. Penyelesaian konsinyasi tanpa jatuh tempo dihitung belum jatuh tempo.`,
    ],
    berkas: tanggalOperasional(),
  });
}
