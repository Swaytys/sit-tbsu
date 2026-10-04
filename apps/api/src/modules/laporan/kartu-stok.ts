import {
  keQty,
  kurangQty,
  LABEL_JENIS_MUTASI,
  LABEL_JENIS_PENYESUAIAN,
  subtotalRupiah,
  tambahQty,
  teksPeriode,
  teksQty,
  teksTanggalPanjang,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type JenisMutasi,
  type KolomLaporan,
  type skemaLaporanKartuStok,
} from '@sit/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import {
  barang,
  kategori,
  pelanggan,
  pemasok,
  penerimaanBarang,
  penjualan,
  penyesuaianStok,
  returPenjualan,
  satuan,
  voidTransaksi,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';
import * as stokRepo from '../persediaan/stok/repo';
import {
  bolehLihatNilai,
  KOSONG,
  qty,
  SATUAN_RUPIAH,
  susunDokumen,
  tanggal,
  teks,
  uang,
} from './umum';

/*
 * Laporan Kartu Stok (docs/05 §14): semua mutasi satu barang (bucket BAIK) dalam periode, kronologis,
 * dengan nomor dokumen sumber dan keterangan pihak terkait ("Jual ke …", "Terima dari …"). Pemegang izin
 * nilai melihat format kartu persediaan perpetual: masuk/keluar/saldo × harga × jumlah (metode rata-rata
 * tertimbang, K-008).
 */

export type DataKartuStok = z.output<typeof skemaLaporanKartuStok>;

export type BarisKartuStok = {
  tanggal: string;
  nomorDokumen: string | null;
  jenis: JenisMutasi;
  keterangan: string;
  qtyMasuk: string;
  qtyKeluar: string;
  saldo: string;
  hppSatuan: number;
  hppSetelah: number;
};

export type HasilKartuStok = {
  barang: {
    kode: string;
    namaBarang: string;
    namaKategori: string;
    kodeSatuan: string;
    kepemilikan: 'MILIK_SENDIRI' | 'KONSINYASI';
    stokMinimum: string;
  };
  saldoAwal: string;
  hppAwal: number;
  totalMasuk: string;
  totalKeluar: string;
  saldoAkhir: string;
  hppAkhir: number;
  baris: BarisKartuStok[];
};

/** Nama pembeli per penjualan (pelanggan terdata, nama bebas, atau pembeli umum). */
async function pembeli(idPenjualan: number[]) {
  if (idPenjualan.length === 0) return new Map<number, { nomor: string; nama: string }>();
  const r = await db
    .select({
      id: penjualan.id,
      nomor: penjualan.nomor,
      nama: sql<string>`coalesce(${pelanggan.namaPelanggan}, ${penjualan.namaPembeli}, 'pembeli umum')`,
    })
    .from(penjualan)
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(inArray(penjualan.id, idPenjualan));
  return new Map(r.map((x) => [x.id, { nomor: x.nomor, nama: x.nama }]));
}

async function keteranganDokumen(
  baris: Awaited<ReturnType<typeof stokRepo.mutasiKartu>>,
): Promise<Map<number, string>> {
  const id = (jenis: string) => [
    ...new Set(baris.filter((b) => b.jenisDokumen === jenis).map((b) => b.idDokumen ?? 0)),
  ];
  const idPenerimaan = id('PENERIMAAN');
  const idPenyesuaian = id('PENYESUAIAN');
  const idRetur = id('RETUR');
  const idVoid = id('VOID');

  const terima = new Map(
    (idPenerimaan.length
      ? await db
          .select({ id: penerimaanBarang.id, nama: pemasok.namaPemasok })
          .from(penerimaanBarang)
          .innerJoin(pemasok, eq(pemasok.id, penerimaanBarang.idPemasok))
          .where(inArray(penerimaanBarang.id, idPenerimaan))
      : []
    ).map((r) => [r.id, r.nama]),
  );
  const sesuai = new Map(
    (idPenyesuaian.length
      ? await db
          .select({
            id: penyesuaianStok.id,
            jenis: penyesuaianStok.jenis,
            alasan: penyesuaianStok.alasan,
          })
          .from(penyesuaianStok)
          .where(inArray(penyesuaianStok.id, idPenyesuaian))
      : []
    ).map((r) => [r.id, r]),
  );
  const retur = new Map(
    (idRetur.length
      ? await db
          .select({ id: returPenjualan.id, idPenjualan: returPenjualan.idPenjualan })
          .from(returPenjualan)
          .where(inArray(returPenjualan.id, idRetur))
      : []
    ).map((r) => [r.id, r.idPenjualan]),
  );
  const batal = new Map(
    (idVoid.length
      ? await db
          .select({ id: voidTransaksi.id, idPenjualan: voidTransaksi.idPenjualan })
          .from(voidTransaksi)
          .where(inArray(voidTransaksi.id, idVoid))
      : []
    ).map((r) => [r.id, r.idPenjualan]),
  );
  const pj = await pembeli([...id('PENJUALAN'), ...retur.values(), ...batal.values()]);

  const hasil = new Map<number, string>();
  for (const b of baris) {
    const d = b.idDokumen ?? 0;
    let k: string | null = null;
    if (b.jenisDokumen === 'PENJUALAN') k = `Jual ke ${pj.get(d)?.nama ?? '—'}`;
    else if (b.jenisDokumen === 'PENERIMAAN') k = `Terima dari ${terima.get(d) ?? '—'}`;
    else if (b.jenisDokumen === 'RETUR') {
      const p = pj.get(retur.get(d) ?? 0);
      k =
        b.jenis === 'TUKAR_RETUR'
          ? `Barang pengganti tukar retur ${p?.nomor ?? ''}`.trim()
          : `Retur dari ${p?.nama ?? '—'} (${p?.nomor ?? '—'})`;
    } else if (b.jenisDokumen === 'VOID') {
      k = `Void penjualan ${pj.get(batal.get(d) ?? 0)?.nomor ?? '—'}`;
    } else if (b.jenisDokumen === 'PENYESUAIAN') {
      const s = sesuai.get(d);
      k = s ? [LABEL_JENIS_PENYESUAIAN[s.jenis], s.alasan].filter(Boolean).join(': ') : null;
    } else if (b.jenisDokumen === 'RETUR_PEMASOK') k = 'Retur ke pemasok';
    hasil.set(b.id, k ?? b.keterangan ?? LABEL_JENIS_MUTASI[b.jenis]);
  }
  return hasil;
}

export async function hitungKartuStok(p: DataKartuStok): Promise<HasilKartuStok> {
  const [b] = await db
    .select({
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      kepemilikan: barang.kepemilikan,
      stokMinimum: barang.stokMinimum,
    })
    .from(barang)
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(eq(barang.id, p.idBarang))
    .limit(1);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Barang tidak ditemukan.', 404);

  const awal = await stokRepo.posisiSebelum(db, p.idBarang, 'BAIK', p.dari);
  const mutasi = await stokRepo.mutasiKartu(db, p.idBarang, 'BAIK', p.dari, p.sampai);
  const ket = await keteranganDokumen(mutasi);

  const saldoAwal = keQty(awal.saldo ?? '0');
  const hppAwal = awal.hpp ?? 0;
  let totalMasuk = '0';
  let totalKeluar = '0';
  for (const m of mutasi) {
    totalMasuk = tambahQty(totalMasuk, m.qtyMasuk);
    totalKeluar = tambahQty(totalKeluar, m.qtyKeluar);
  }
  const saldoAkhir = kurangQty(tambahQty(saldoAwal, totalMasuk), totalKeluar);
  const terakhir = mutasi.at(-1);
  if (terakhir && keQty(terakhir.saldoSetelah) !== saldoAkhir) {
    throw new Error(`Kartu stok barang ${p.idBarang} tidak konsisten dengan ledger (L3)`);
  }
  return {
    barang: b,
    saldoAwal,
    hppAwal,
    totalMasuk: keQty(totalMasuk),
    totalKeluar: keQty(totalKeluar),
    saldoAkhir,
    hppAkhir: terakhir?.hppSetelah ?? hppAwal,
    baris: mutasi.map((m) => ({
      tanggal: m.tanggalOperasional,
      nomorDokumen: m.nomorDokumen,
      jenis: m.jenis,
      keterangan: ket.get(m.id) ?? '',
      qtyMasuk: keQty(m.qtyMasuk),
      qtyKeluar: keQty(m.qtyKeluar),
      saldo: keQty(m.saldoSetelah),
      hppSatuan: m.hppSatuan,
      hppSetelah: m.hppSetelah,
    })),
  };
}

const nol = (q: string) => /^0(\.0+)?$/.test(q);

export async function laporanKartuStok(
  p: DataKartuStok,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const k = await hitungKartuStok(p);
  const nilai = bolehLihatNilai(pelaku.izin);

  const kolom: KolomLaporan[] = nilai
    ? [
        { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
        { judul: 'No. Dokumen', jenis: 'teks', lebar: 17 },
        { judul: 'Keterangan', jenis: 'teks', lebar: 30 },
        { judul: 'Qty', jenis: 'qty', lebar: 8, grup: 'Masuk' },
        { judul: 'Harga', jenis: 'uang', lebar: 11, grup: 'Masuk' },
        { judul: 'Jumlah', jenis: 'uang', lebar: 13, grup: 'Masuk' },
        { judul: 'Qty', jenis: 'qty', lebar: 8, grup: 'Keluar' },
        { judul: 'Harga', jenis: 'uang', lebar: 11, grup: 'Keluar' },
        { judul: 'Jumlah', jenis: 'uang', lebar: 13, grup: 'Keluar' },
        { judul: 'Qty', jenis: 'qty', lebar: 8, grup: 'Saldo' },
        { judul: 'HPP Rata²', jenis: 'uang', lebar: 11, grup: 'Saldo' },
        { judul: 'Jumlah', jenis: 'uang', lebar: 14, grup: 'Saldo' },
      ]
    : [
        { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
        { judul: 'No. Dokumen', jenis: 'teks', lebar: 18 },
        { judul: 'Jenis Mutasi', jenis: 'teks', lebar: 13 },
        { judul: 'Keterangan', jenis: 'teks', lebar: 34 },
        { judul: 'Masuk', jenis: 'qty', lebar: 10 },
        { judul: 'Keluar', jenis: 'qty', lebar: 10 },
        { judul: 'Saldo', jenis: 'qty', lebar: 10 },
      ];

  const nilaiAwal = subtotalRupiah(k.saldoAwal, k.hppAwal);
  let jumlahMasuk = 0;
  let jumlahKeluar = 0;
  const isi: BarisTabelLaporan[] = [];
  isi.push({
    gaya: 'subtotal',
    label: `Saldo awal per ${teksTanggalPanjang(p.dari)}`,
    sel: nilai
      ? [
          KOSONG,
          KOSONG,
          KOSONG,
          KOSONG,
          KOSONG,
          KOSONG,
          KOSONG,
          KOSONG,
          KOSONG,
          qty(k.saldoAwal),
          uang(k.hppAwal),
          uang(nilaiAwal),
        ]
      : [KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, KOSONG, qty(k.saldoAwal)],
  });
  for (const m of k.baris) {
    const nMasuk = subtotalRupiah(m.qtyMasuk, m.hppSatuan);
    const nKeluar = subtotalRupiah(m.qtyKeluar, m.hppSatuan);
    jumlahMasuk += nMasuk;
    jumlahKeluar += nKeluar;
    const umum = [tanggal(m.tanggal), teks(m.nomorDokumen ?? '—', { mono: true })];
    isi.push({
      gaya: 'data',
      sel: nilai
        ? [
            ...umum,
            teks(m.keterangan),
            nol(m.qtyMasuk) ? KOSONG : qty(m.qtyMasuk),
            nol(m.qtyMasuk) ? KOSONG : uang(m.hppSatuan),
            nol(m.qtyMasuk) ? KOSONG : uang(nMasuk),
            nol(m.qtyKeluar) ? KOSONG : qty(m.qtyKeluar),
            nol(m.qtyKeluar) ? KOSONG : uang(m.hppSatuan),
            nol(m.qtyKeluar) ? KOSONG : uang(nKeluar),
            qty(m.saldo),
            uang(m.hppSetelah),
            uang(subtotalRupiah(m.saldo, m.hppSetelah)),
          ]
        : [
            ...umum,
            teks(LABEL_JENIS_MUTASI[m.jenis]),
            teks(m.keterangan),
            nol(m.qtyMasuk) ? KOSONG : qty(m.qtyMasuk),
            nol(m.qtyKeluar) ? KOSONG : qty(m.qtyKeluar),
            qty(m.saldo),
          ],
    });
  }
  const nilaiAkhir = subtotalRupiah(k.saldoAkhir, k.hppAkhir);
  isi.push({
    gaya: 'total',
    label: `Jumlah mutasi & saldo akhir per ${teksTanggalPanjang(p.sampai)}`,
    sel: nilai
      ? [
          KOSONG,
          KOSONG,
          KOSONG,
          qty(k.totalMasuk),
          KOSONG,
          uang(jumlahMasuk),
          qty(k.totalKeluar),
          KOSONG,
          uang(jumlahKeluar),
          qty(k.saldoAkhir),
          uang(k.hppAkhir),
          uang(nilaiAkhir),
        ]
      : [KOSONG, KOSONG, KOSONG, KOSONG, qty(k.totalMasuk), qty(k.totalKeluar), qty(k.saldoAkhir)],
  });

  const titipan = k.barang.kepemilikan === 'KONSINYASI';
  return susunDokumen('kartu-stok', pelaku, {
    subjudul: [teksPeriode(p.dari, p.sampai), ...(nilai ? [SATUAN_RUPIAH] : [])],
    orientasi: nilai ? 'lanskap' : 'potret',
    bagian: [
      {
        jenis: 'info',
        pasangan: [
          { label: 'Kode barang', nilai: k.barang.kode },
          { label: 'Kategori', nilai: k.barang.namaKategori },
          { label: 'Nama barang', nilai: k.barang.namaBarang },
          { label: 'Satuan', nilai: k.barang.kodeSatuan },
          { label: 'Kepemilikan', nilai: titipan ? 'Titipan (konsinyasi)' : 'Milik sendiri' },
          {
            label: 'Stok minimum',
            nilai: `${teksQty(k.barang.stokMinimum)} ${k.barang.kodeSatuan}`,
          },
        ],
      },
      {
        jenis: 'tabel',
        tabel: { kolom, baris: isi, kosong: 'Tidak ada mutasi dalam periode ini.' },
      },
    ],
    catatan: [
      'Mutasi diurutkan sesuai urutan pencatatan di buku persediaan; tanggal adalah tanggal operasional (WIB). Hanya stok kondisi baik.',
      ...(nilai
        ? [
            `Metode penilaian: rata-rata tertimbang bergerak (moving average). HPP rata-rata dihitung ulang setiap barang masuk; barang keluar dinilai dengan HPP rata-rata saat itu.${titipan ? ' Barang titipan dinilai dengan harga titip.' : ''}`,
            'Jumlah = kuantitas × harga, dibulatkan ke rupiah utuh per baris.',
          ]
        : []),
    ],
    berkas: `${k.barang.kode}-${p.dari}_${p.sampai}`,
  });
}
