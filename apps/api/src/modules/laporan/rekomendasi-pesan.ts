import {
  LABEL_STATUS_SARAN_PESAN,
  teksTanggalPanjang,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type KolomLaporan,
  type NadaSel,
  type StatusSaranPesan,
  type skemaLaporanRekomendasiPesan,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { pemasok } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import { daftarSaranPesan } from '../persediaan/saran-pesan/service';
import { namaKategori } from './stok-rekap';
import {
  angka,
  bolehLihatNilai,
  KOSONG,
  qty,
  SATUAN_RUPIAH,
  susunDokumen,
  teks,
  teksPerSaatIni,
  uang,
} from './umum';

/*
 * Laporan Rekomendasi Pemesanan Ulang (K-113, docs/05 §17). Memakai perhitungan yang sama dengan tab Saran Pesan
 * (satu sumber), dikelompokkan per pemasok agar bisa langsung dipakai untuk belanja.
 */

export type DataRekomendasiPesan = z.output<typeof skemaLaporanRekomendasiPesan>;

const NADA: Record<StatusSaranPesan, NadaSel> = {
  PESAN_SEKARANG: 'bahaya',
  SEGERA: 'peringatan',
  AMAN: 'baik',
  TIDAK_LAKU: 'info',
};

export async function laporanRekomendasiPesan(
  p: DataRekomendasiPesan,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await daftarSaranPesan(
    { tampil: p.tampil, idKategori: p.idKategori, idPemasok: p.idPemasok },
    pelaku.izin,
  );
  const nilai = bolehLihatNilai(pelaku.izin);
  const prm = h.parameter;

  const kolom: KolomLaporan[] = [
    { judul: 'No', jenis: 'angka', lebar: 5 },
    { judul: 'Kode', jenis: 'teks', lebar: 11 },
    { judul: 'Nama Barang', jenis: 'teks', lebar: 28 },
    { judul: 'Sat.', jenis: 'teks', lebar: 6 },
    { judul: 'Terjual', jenis: 'qty', lebar: 9, grup: 'Penjualan' },
    { judul: 'Rata/Hari', jenis: 'qty', lebar: 9, grup: 'Penjualan' },
    { judul: 'Tersedia', jenis: 'qty', lebar: 9, grup: 'Stok' },
    { judul: 'Cukup (hari)', jenis: 'qty', lebar: 9, grup: 'Stok' },
    { judul: 'Titik Pesan', jenis: 'qty', lebar: 9 },
    { judul: 'Saran Pesan', jenis: 'qty', lebar: 10 },
    { judul: 'Kemasan', jenis: 'teks', lebar: 14 },
    ...(nilai ? [{ judul: 'Perkiraan Biaya', jenis: 'uang' as const, lebar: 13 }] : []),
    { judul: 'Status', jenis: 'teks', lebar: 12 },
  ];

  const urutPemasok = [...new Set(h.baris.map((b) => b.namaPemasok ?? 'Belum pernah dibeli'))].sort(
    (a, b) => a.localeCompare(b, 'id'),
  );
  const isi: BarisTabelLaporan[] = [];
  let no = 0;
  for (const nama of urutPemasok) {
    const grup = h.baris.filter((b) => (b.namaPemasok ?? 'Belum pernah dibeli') === nama);
    const contoh = grup[0];
    isi.push({
      gaya: 'grup',
      sel: [],
      label: contoh
        ? `${nama} — lama kirim ${contoh.lamaKirimHari} hari, belanja tiap ${contoh.jarakBelanjaHari} hari`
        : nama,
    });
    for (const b of grup) {
      no += 1;
      isi.push({
        gaya: 'data',
        sel: [
          angka(no),
          teks(b.kode, { mono: true }),
          teks(b.namaBarang),
          teks(b.kodeSatuan),
          qty(b.terjual),
          qty(b.rataPerHari),
          qty(b.stokTersedia),
          b.hariCukup === null ? KOSONG : qty(b.hariCukup),
          qty(b.titikPesan),
          qty(b.saranPesan),
          b.saranKemasan ? teks(b.saranKemasan) : KOSONG,
          ...(nilai ? [uang(b.perkiraanBiaya ?? 0)] : []),
          teks(LABEL_STATUS_SARAN_PESAN[b.status], { tebal: true, nada: NADA[b.status] }),
        ],
      });
    }
  }

  const totalBiaya = h.perPemasok.reduce((t, g) => t + (g.perkiraanBiaya ?? 0), 0);
  const namaPemasok =
    p.idPemasok === undefined
      ? 'semua'
      : ((
          await db
            .select({ n: pemasok.namaPemasok })
            .from(pemasok)
            .where(eq(pemasok.id, p.idPemasok))
            .limit(1)
        )[0]?.n ?? '—');

  return susunDokumen('rekomendasi-pesan', pelaku, {
    subjudul: [
      teksPerSaatIni(),
      `Penjualan diamati: ${teksTanggalPanjang(prm.dari)} s.d. ${teksTanggalPanjang(prm.sampai)} (${prm.periodeHari} hari)`,
      `Kategori: ${(await namaKategori(p.idKategori)) ?? 'semua'} · Pemasok: ${namaPemasok}`,
      `(Kuantitas dalam satuan dasar barang${nilai ? `; ${SATUAN_RUPIAH.slice(1, -1).toLowerCase()}` : ''})`,
    ],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'Ringkasan',
        baris: [
          {
            label: 'Pesan sekarang (stok di titik pesan ulang)',
            nilai: angka(h.jumlah.PESAN_SEKARANG),
            tingkat: 1,
          },
          {
            label: 'Segera pesan (habis sebelum belanja berikutnya)',
            nilai: angka(h.jumlah.SEGERA),
            tingkat: 1,
          },
          { label: 'Aman', nilai: angka(h.jumlah.AMAN), tingkat: 1 },
          {
            label: `Tidak laku ${prm.periodeHari} hari terakhir`,
            nilai: angka(h.jumlah.TIDAK_LAKU),
            tingkat: 1,
          },
          ...(nilai
            ? [
                {
                  label: 'Perkiraan biaya belanja (yang perlu dipesan)',
                  nilai: uang(totalBiaya),
                  gaya: 'total' as const,
                },
              ]
            : []),
        ],
      },
      {
        jenis: 'tabel',
        judul: p.tampil === 'SEMUA' ? 'Semua Barang' : 'Barang yang Perlu Dipesan',
        tabel: {
          kolom,
          baris: isi,
          kosong: 'Tidak ada barang yang perlu dipesan saat ini.',
        },
      },
    ],
    catatan: [
      `Rata/hari = terjual bersih (penjualan − retur − void) selama hari amatan ÷ hari amatan; barang yang lebih baru dari ${prm.periodeHari} hari diamati sejak mutasi pertamanya.`,
      `Stok pengaman = rata/hari × ${prm.hariPengaman} hari. Titik pesan = rata/hari × lama kirim + stok pengaman.`,
      'Saran pesan = rata/hari × (lama kirim + jarak belanja) + stok pengaman − stok tersedia, dibulatkan ke atas; kemasan = saran ÷ isi kemasan, dibulatkan ke atas.',
      `Lama kirim dan jarak belanja diambil dari Data Pemasok (pemasok pembelian terakhir); bila kosong dipakai bawaan ${prm.lamaKirimBawaan} dan ${prm.jarakBelanjaBawaan} hari (Pengaturan › Operasional).`,
      'Barang titipan (konsinyasi) tidak disarankan karena diisi penitipnya.',
      ...(nilai
        ? [
            'Perkiraan biaya = saran pesan × harga beli terakhir (atau HPP rata-rata bila belum pernah dibeli).',
          ]
        : []),
    ],
    berkas: tanggalOperasional(),
  });
}
