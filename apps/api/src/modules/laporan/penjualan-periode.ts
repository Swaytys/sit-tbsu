import {
  dariNomorHari,
  formatRupiah,
  jumlahHari,
  LABEL_JENIS_PENJUALAN,
  LABEL_METODE_PEMBAYARAN,
  LABEL_STATUS_PEMBAYARAN,
  NAMA_BULAN,
  nomorHari,
  teksPeriode,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type JenisPenjualan,
  type MetodePembayaran,
  type StatusPembayaran,
  type StatusTransaksi,
  type skemaLaporanPenjualan,
} from '@sit/shared';
import { and, asc, eq, gte, lte, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { pelanggan, pembayaranPenjualan, penjualan, returPenjualan } from '../../db/schema';
import { kolomPenuh } from '../../db/kolom-penuh';
import type { PenggunaAktif } from '../../lib/konteks';
import { angka, KOSONG, SATUAN_RUPIAH, susunDokumen, tanggal, teks, uang } from './umum';

/*
 * Laporan Penjualan per Periode (docs/05 §14): berdasarkan tanggal operasional.
 * Omzet = Σ (total_neto − total_void) penjualan status ≠ VOID; retur = Σ total_retur retur DISETUJUI
 * (REFUND + POTONG_TAGIHAN; tukar barang bernilai netral) menurut tanggal operasional retur;
 * penjualan bersih = omzet − retur.
 */

export type DataPenjualanPeriode = z.output<typeof skemaLaporanPenjualan>;

export type TransaksiPeriode = {
  id: number;
  nomor: string;
  tanggal: string;
  jenis: JenisPenjualan;
  namaPembeli: string | null;
  statusTransaksi: StatusTransaksi;
  statusPembayaran: StatusPembayaran;
  totalBruto: number;
  totalDiskon: number;
  ongkir: number;
  totalNeto: number;
  totalVoid: number;
  /** total_neto − total_void; 0 untuk transaksi VOID penuh. */
  omzet: number;
  metode: MetodePembayaran[];
};

export type IkhtisarPenjualan = {
  penjualanBruto: number;
  diskon: number;
  ongkir: number;
  jumlahPenjualan: number;
  voidSebagian: number;
  omzet: number;
  retur: number;
  penjualanBersih: number;
  jumlahTransaksi: number;
  perJenis: Record<JenisPenjualan, { jumlah: number; omzet: number }>;
  voidPenuh: { jumlah: number; nilai: number };
  perStatusBayar: Record<StatusPembayaran, number>;
};

export type HasilPenjualanPeriode = {
  ikhtisar: IkhtisarPenjualan;
  transaksi: TransaksiPeriode[];
  /** Retur per tanggal operasional retur. */
  returPerTanggal: Map<string, number>;
};

export async function hitungPenjualanPeriode(
  p: DataPenjualanPeriode,
): Promise<HasilPenjualanPeriode> {
  const rows = await db
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      tanggal: penjualan.tanggalOperasional,
      jenis: penjualan.jenisPenjualan,
      namaPembeli: sql<
        string | null
      >`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli})`,
      statusTransaksi: penjualan.statusTransaksi,
      statusPembayaran: penjualan.statusPembayaran,
      totalBruto: penjualan.totalBruto,
      totalDiskon: penjualan.totalDiskon,
      ongkir: penjualan.ongkir,
      totalNeto: penjualan.totalNeto,
      totalVoid: penjualan.totalVoid,
      metode: sql<
        string | null
      >`(select string_agg(distinct ${kolomPenuh(pembayaranPenjualan.metode)}, ',')
        from ${pembayaranPenjualan} where ${kolomPenuh(pembayaranPenjualan.idPenjualan)} = ${kolomPenuh(penjualan.id)})`,
    })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(
      and(
        gte(penjualan.tanggalOperasional, p.dari),
        lte(penjualan.tanggalOperasional, p.sampai),
        p.jenis === undefined ? undefined : eq(penjualan.jenisPenjualan, p.jenis),
      ),
    )
    .orderBy(asc(penjualan.tanggalOperasional), asc(penjualan.nomor));

  const retur = await db
    .select({
      tanggal: returPenjualan.tanggalOperasional,
      nilai: sql<string>`sum(${returPenjualan.totalRetur})::text`,
    })
    .from(returPenjualan)
    .innerJoin(penjualan, eq(penjualan.id, returPenjualan.idPenjualan))
    .where(
      and(
        eq(returPenjualan.status, 'DISETUJUI'),
        ne(returPenjualan.penyelesaian, 'TUKAR_BARANG'),
        gte(returPenjualan.tanggalOperasional, p.dari),
        lte(returPenjualan.tanggalOperasional, p.sampai),
        p.jenis === undefined ? undefined : eq(penjualan.jenisPenjualan, p.jenis),
      ),
    )
    .groupBy(returPenjualan.tanggalOperasional);
  const returPerTanggal = new Map(retur.map((r) => [r.tanggal, Number(r.nilai)]));

  const ik: IkhtisarPenjualan = {
    penjualanBruto: 0,
    diskon: 0,
    ongkir: 0,
    jumlahPenjualan: 0,
    voidSebagian: 0,
    omzet: 0,
    retur: [...returPerTanggal.values()].reduce((a, b) => a + b, 0),
    penjualanBersih: 0,
    jumlahTransaksi: 0,
    perJenis: { LANGSUNG: { jumlah: 0, omzet: 0 }, PENGANTARAN: { jumlah: 0, omzet: 0 } },
    voidPenuh: { jumlah: 0, nilai: 0 },
    perStatusBayar: { LUNAS: 0, DP: 0, BELUM_BAYAR: 0 },
  };
  const transaksi: TransaksiPeriode[] = rows.map((r) => {
    const batal = r.statusTransaksi === 'VOID';
    const omzet = batal ? 0 : r.totalNeto - r.totalVoid;
    if (batal) {
      ik.voidPenuh.jumlah += 1;
      ik.voidPenuh.nilai += r.totalNeto;
    } else {
      ik.penjualanBruto += r.totalBruto;
      ik.diskon += r.totalDiskon;
      ik.ongkir += r.ongkir;
      ik.jumlahPenjualan += r.totalNeto;
      ik.voidSebagian += r.totalVoid;
      ik.omzet += omzet;
      ik.jumlahTransaksi += 1;
      ik.perJenis[r.jenis].jumlah += 1;
      ik.perJenis[r.jenis].omzet += omzet;
      ik.perStatusBayar[r.statusPembayaran] += 1;
    }
    return {
      ...r,
      omzet,
      metode: (r.metode ? r.metode.split(',') : []) as MetodePembayaran[],
    };
  });
  ik.penjualanBersih = ik.omzet - ik.retur;
  return { ikhtisar: ik, transaksi, returPerTanggal };
}

/** Kunci rekap: per hari bila periode ≤ 31 hari, selain itu per bulan. */
function kunciRekap(tgl: string, harian: boolean) {
  return harian ? tgl : tgl.slice(0, 7);
}

function labelBulan(kunci: string) {
  const [t, b] = kunci.split('-');
  return `${NAMA_BULAN[Number(b) - 1] ?? '?'} ${t}`;
}

function teksMetode(m: MetodePembayaran[]): string {
  if (m.length === 0) return '—';
  if (m.length === 1) return LABEL_METODE_PEMBAYARAN[m[0]!];
  return `Campuran (${m.map((x) => LABEL_METODE_PEMBAYARAN[x]).join(', ')})`;
}

export async function laporanPenjualanPeriode(
  p: DataPenjualanPeriode,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungPenjualanPeriode(p);
  const ik = h.ikhtisar;
  const harian = jumlahHari(p.dari, p.sampai) <= 31;

  // Rekap per hari/bulan: semua hari/bulan dalam periode tercantum (nol ditulis "–").
  const rekap = new Map<string, { jumlah: number; omzet: number; retur: number }>();
  for (let n = nomorHari(p.dari); n <= nomorHari(p.sampai); n++) {
    const k = kunciRekap(dariNomorHari(n), harian);
    if (!rekap.has(k)) rekap.set(k, { jumlah: 0, omzet: 0, retur: 0 });
  }
  for (const t of h.transaksi) {
    if (t.statusTransaksi === 'VOID') continue;
    const r = rekap.get(kunciRekap(t.tanggal, harian))!;
    r.jumlah += 1;
    r.omzet += t.omzet;
  }
  for (const [tgl, nilai] of h.returPerTanggal) rekap.get(kunciRekap(tgl, harian))!.retur += nilai;

  const barisRekap: BarisTabelLaporan[] = [...rekap.entries()].map(([k, r]) => ({
    gaya: 'data',
    sel: [
      harian ? tanggal(k) : teks(labelBulan(k)),
      angka(r.jumlah),
      uang(r.omzet),
      uang(-r.retur),
      uang(r.omzet - r.retur),
    ],
  }));
  barisRekap.push({
    gaya: 'total',
    label: 'Jumlah',
    sel: [
      KOSONG,
      angka(ik.jumlahTransaksi),
      uang(ik.omzet),
      uang(-ik.retur),
      uang(ik.penjualanBersih),
    ],
  });

  const barisTransaksi: BarisTabelLaporan[] = h.transaksi.map((t, i) => {
    const batal = t.statusTransaksi === 'VOID';
    return {
      gaya: 'data',
      sel: [
        angka(i + 1),
        tanggal(t.tanggal),
        teks(t.nomor, { mono: true }),
        teks(t.namaPembeli ?? 'Pembeli umum'),
        teks(LABEL_JENIS_PENJUALAN[t.jenis]),
        teks(teksMetode(t.metode)),
        batal ? KOSONG : uang(t.omzet),
        batal
          ? teks('Void', { nada: 'bahaya', tebal: true })
          : teks(
              t.statusTransaksi === 'VOID_SEBAGIAN'
                ? `${LABEL_STATUS_PEMBAYARAN[t.statusPembayaran]} · void sebagian`
                : LABEL_STATUS_PEMBAYARAN[t.statusPembayaran],
              {
                tebal: true,
                nada:
                  t.statusPembayaran === 'LUNAS'
                    ? 'baik'
                    : t.statusPembayaran === 'DP'
                      ? 'peringatan'
                      : 'bahaya',
              },
            ),
      ],
    };
  });
  barisTransaksi.push({
    gaya: 'total',
    label: 'Jumlah omzet',
    sel: [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, uang(ik.omzet), KOSONG],
  });

  const rata = ik.jumlahTransaksi > 0 ? Math.round(ik.omzet / ik.jumlahTransaksi) : 0;
  return susunDokumen('penjualan', pelaku, {
    subjudul: [
      teksPeriode(p.dari, p.sampai),
      `Jenis penjualan: ${p.jenis === undefined ? 'semua' : LABEL_JENIS_PENJUALAN[p.jenis]}`,
      SATUAN_RUPIAH,
    ],
    orientasi: 'potret',
    bagian: [
      {
        jenis: 'ikhtisar',
        judul: 'I. Ikhtisar Penjualan',
        baris: [
          {
            label: 'Penjualan bruto (harga × kuantitas)',
            nilai: uang(ik.penjualanBruto),
            tingkat: 1,
          },
          { label: 'Diskon penjualan', nilai: uang(ik.diskon), tingkat: 1, gaya: 'kurang' },
          { label: 'Ongkos kirim', nilai: uang(ik.ongkir), tingkat: 1 },
          { label: 'Jumlah penjualan', nilai: uang(ik.jumlahPenjualan), gaya: 'subtotal' },
          { label: 'Void sebagian', nilai: uang(ik.voidSebagian), tingkat: 1, gaya: 'kurang' },
          { label: 'Omzet (penjualan kotor)', nilai: uang(ik.omzet), gaya: 'subtotal' },
          { label: 'Retur penjualan', nilai: uang(ik.retur), tingkat: 1, gaya: 'kurang' },
          { label: 'PENJUALAN BERSIH', nilai: uang(ik.penjualanBersih), gaya: 'total' },
        ],
      },
      {
        jenis: 'info',
        judul: 'Statistik Transaksi',
        pasangan: [
          { label: 'Jumlah transaksi', nilai: `${ik.jumlahTransaksi}` },
          {
            label: 'Penjualan langsung',
            nilai: `${ik.perJenis.LANGSUNG.jumlah} transaksi · omzet ${formatRupiah(ik.perJenis.LANGSUNG.omzet)}`,
          },
          {
            label: 'Penjualan pengantaran',
            nilai: `${ik.perJenis.PENGANTARAN.jumlah} transaksi · omzet ${formatRupiah(ik.perJenis.PENGANTARAN.omzet)}`,
          },
          { label: 'Rata-rata per transaksi', nilai: formatRupiah(rata) },
          {
            label: 'Status pembayaran (saat ini)',
            nilai: `Lunas ${ik.perStatusBayar.LUNAS} · DP ${ik.perStatusBayar.DP} · Belum bayar ${ik.perStatusBayar.BELUM_BAYAR}`,
          },
          {
            label: 'Transaksi void penuh',
            nilai: `${ik.voidPenuh.jumlah} transaksi (${formatRupiah(ik.voidPenuh.nilai)}, tidak dihitung)`,
          },
        ],
      },
      {
        jenis: 'tabel',
        judul: harian ? 'II. Rekap Harian' : 'II. Rekap Bulanan',
        tabel: {
          kolom: [
            { judul: harian ? 'Tanggal' : 'Bulan', jenis: harian ? 'tanggal' : 'teks', lebar: 14 },
            { judul: 'Jumlah Transaksi', jenis: 'angka', lebar: 12 },
            { judul: 'Omzet', jenis: 'uang', lebar: 16 },
            { judul: 'Retur', jenis: 'uang', lebar: 14 },
            { judul: 'Penjualan Bersih', jenis: 'uang', lebar: 16 },
          ],
          baris: barisRekap,
        },
      },
      {
        jenis: 'tabel',
        judul: 'III. Rincian Transaksi',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
            { judul: 'No. Transaksi', jenis: 'teks', lebar: 18 },
            { judul: 'Pembeli', jenis: 'teks', lebar: 22 },
            { judul: 'Jenis', jenis: 'teks', lebar: 11 },
            { judul: 'Metode Bayar', jenis: 'teks', lebar: 14 },
            { judul: 'Total', jenis: 'uang', lebar: 14 },
            { judul: 'Status', jenis: 'teks', lebar: 12 },
          ],
          baris: barisTransaksi,
          kosong: 'Tidak ada transaksi dalam periode ini.',
        },
      },
    ],
    catatan: [
      'Transaksi dikelompokkan menurut tanggal operasional (WIB). Total per transaksi = total invoice dikurangi void sebagian.',
      'Diskon penjualan mencakup diskon per barang dan diskon transaksi.',
      'Retur penjualan adalah retur yang disetujui dalam periode ini (refund dan potong tagihan) menurut tanggal pengajuan retur, termasuk retur atas penjualan periode sebelumnya; tukar barang tidak mengubah nilai penjualan. Rinciannya pada Laporan Retur Penjualan.',
      'Transaksi void penuh dicantumkan untuk penelusuran tetapi tidak dihitung dalam omzet.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
