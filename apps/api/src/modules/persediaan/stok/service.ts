import {
  keQty,
  kurangQty,
  tambahQty,
  type BarisMutasi,
  type BarisPosisiStok,
  type DaftarPosisiStok,
  type Izin,
  type KartuStok,
  type KondisiStok,
  type MetaHalaman,
  type PeringatanStok,
  type StatusStok,
} from '@sit/shared';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import { headerUnduhan, keBytes, workbookBaru } from '../../../lib/excel';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import * as repo from './repo';

/*
 * Posisi stok, riwayat mutasi, kartu stok, dan peringatan stok (docs/05 ST1–ST3, docs/01 §6).
 * HPP dan nilai persediaan hanya untuk pemegang `master.barang.lihat_hpp` (CLAUDE.md aturan 6).
 */

const IZIN_HPP: Izin = 'master.barang.lihat_hpp';

function ambangRestock(): Promise<number> {
  return ambilAngka('ambang_restock_persen', 20);
}

type BarisStokDb = Awaited<ReturnType<typeof repo.semuaStok>>[number];

function keBarisStok(b: BarisStokDb, izin: ReadonlySet<Izin>): BarisPosisiStok {
  const { hppRata2, nilaiPersediaan, terakhirMutasi, ...umum } = b;
  const baris: BarisPosisiStok = {
    ...umum,
    stokTersedia: keQty(umum.stokTersedia),
    terakhirMutasi: terakhirMutasi?.toISOString() ?? null,
  };
  return izin.has(IZIN_HPP) ? { ...baris, hppRata2, nilaiPersediaan } : baris;
}

export async function daftarStok(
  p: repo.SaringStok & { halaman: number; perHalaman: number },
  izin: ReadonlySet<Izin>,
): Promise<DaftarPosisiStok> {
  const ambang = await ambangRestock();
  const { baris, total } = await repo.daftarStok(db, { ...p, ...batasHalaman(p) }, ambang);
  const r = await repo.ringkasanStok(db, ambang);
  const perStatus: Record<StatusStok, number> = { HABIS: 0, KRITIS: 0, PERLU_RESTOCK: 0, AMAN: 0 };
  for (const s of r.perStatus) perStatus[s.status] = s.jumlah;
  const jumlahBarang = Object.values(perStatus).reduce((a, b) => a + b, 0);
  return {
    data: baris.map((b) => keBarisStok(b, izin)),
    meta: metaHalaman(total, p),
    ringkasan: izin.has(IZIN_HPP)
      ? { jumlahBarang, perStatus, nilaiPersediaan: r.nilaiPersediaan }
      : { jumlahBarang, perStatus },
  };
}

const LABEL_STATUS: Record<StatusStok, string> = {
  HABIS: 'Habis',
  KRITIS: 'Kritis',
  PERLU_RESTOCK: 'Perlu restock',
  AMAN: 'Aman',
};

/** Ekspor posisi stok (filter yang sama dengan layar, tanpa halaman). */
export async function eksporStok(
  p: repo.SaringStok,
  izin: ReadonlySet<Izin>,
): Promise<{ isi: Uint8Array<ArrayBuffer>; header: Record<string, string> }> {
  const lihatHpp = izin.has(IZIN_HPP);
  const baris = await repo.semuaStok(db, p, await ambangRestock());
  const wb = workbookBaru();
  const ws = wb.addWorksheet('Posisi Stok', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Kode', key: 'kode', width: 14 },
    { header: 'Nama barang', key: 'nama', width: 40 },
    { header: 'Kategori', key: 'kategori', width: 18 },
    { header: 'Satuan', key: 'satuan', width: 9 },
    { header: 'Kepemilikan', key: 'kepemilikan', width: 14 },
    { header: 'Fisik', key: 'fisik', width: 11 },
    { header: 'Dipesan', key: 'dipesan', width: 11 },
    { header: 'Tersedia', key: 'tersedia', width: 11 },
    { header: 'Rusak', key: 'rusak', width: 10 },
    { header: 'Minimum', key: 'minimum', width: 10 },
    { header: 'Status', key: 'status', width: 14 },
    ...(lihatHpp
      ? [
          { header: 'HPP rata-rata', key: 'hpp', width: 14 },
          { header: 'Nilai persediaan', key: 'nilai', width: 16 },
        ]
      : []),
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  for (const b of baris) {
    ws.addRow({
      kode: b.kode,
      nama: b.namaBarang,
      kategori: b.namaKategori,
      satuan: b.kodeSatuan,
      kepemilikan: b.kepemilikan === 'KONSINYASI' ? 'Konsinyasi' : 'Milik sendiri',
      // Qty ditulis sebagai angka agar bisa dijumlah di Excel; nilai numeric(14,3) aman sebagai double.
      fisik: Number(b.stokFisik),
      dipesan: Number(b.stokDipesan),
      tersedia: Number(b.stokTersedia),
      rusak: Number(b.stokRusak),
      minimum: Number(b.stokMinimum),
      status: LABEL_STATUS[b.statusStok],
      ...(lihatHpp ? { hpp: b.hppRata2, nilai: b.nilaiPersediaan } : {}),
    });
  }
  for (const k of ['fisik', 'dipesan', 'tersedia', 'rusak', 'minimum']) {
    ws.getColumn(k).numFmt = '#,##0.###';
  }
  if (lihatHpp) {
    ws.getColumn('hpp').numFmt = '#,##0';
    ws.getColumn('nilai').numFmt = '#,##0';
  }
  return { isi: await keBytes(wb), header: headerUnduhan('posisi-stok.xlsx') };
}

// --- Mutasi ---

type BarisMutasiDb = Awaited<ReturnType<typeof repo.mutasiKartu>>[number];

function keBarisMutasi(m: BarisMutasiDb, izin: ReadonlySet<Izin>): BarisMutasi {
  const { hppSatuan, hppSetelah, waktu, jenisDokumen, ...umum } = m;
  const baris: BarisMutasi = {
    ...umum,
    waktu: waktu.toISOString(),
    jenisDokumen: jenisDokumen as BarisMutasi['jenisDokumen'],
  };
  return izin.has(IZIN_HPP) ? { ...baris, hppSatuan, hppSetelah } : baris;
}

export async function daftarMutasi(
  p: repo.SaringMutasi & { halaman: number; perHalaman: number },
  izin: ReadonlySet<Izin>,
): Promise<{ data: BarisMutasi[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarMutasi(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map((m) => keBarisMutasi(m, izin)), meta: metaHalaman(total, p) };
}

/**
 * Kartu stok satu barang untuk satu kondisi dan periode tanggal operasional: saldo awal (saldo
 * sesudah mutasi terakhir sebelum periode), baris mutasi berurutan ledger, total masuk/keluar,
 * dan saldo akhir. Saldo akhir dihitung ulang dari baris dan harus sama dengan `saldo_setelah`
 * baris terakhir (L3).
 */
export async function kartuStok(
  idBarang: number,
  p: { kondisi: KondisiStok; dari: string; sampai: string },
  izin: ReadonlySet<Izin>,
): Promise<KartuStok> {
  if (p.dari > p.sampai) {
    throw new AppError('VALIDASI', 'Tanggal awal tidak boleh setelah tanggal akhir.', 400);
  }
  const b = await repo.barangKartu(db, idBarang);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Barang tidak ditemukan.', 404);
  const awal = await repo.posisiSebelum(db, idBarang, p.kondisi, p.dari);
  const baris = await repo.mutasiKartu(db, idBarang, p.kondisi, p.dari, p.sampai);

  const saldoAwal = keQty(awal.saldo ?? '0');
  let totalMasuk = '0';
  let totalKeluar = '0';
  for (const m of baris) {
    totalMasuk = tambahQty(totalMasuk, m.qtyMasuk);
    totalKeluar = tambahQty(totalKeluar, m.qtyKeluar);
  }
  const saldoAkhir = kurangQty(tambahQty(saldoAwal, totalMasuk), totalKeluar);
  const terakhir = baris.at(-1);
  if (terakhir && keQty(terakhir.saldoSetelah) !== saldoAkhir) {
    throw new Error(`Kartu stok barang ${idBarang} tidak konsisten dengan ledger (L3)`);
  }

  const kartu: KartuStok = {
    barang: b,
    kondisi: p.kondisi,
    dari: p.dari,
    sampai: p.sampai,
    saldoAwal,
    totalMasuk,
    totalKeluar,
    saldoAkhir,
    baris: baris.map((m) => keBarisMutasi(m, izin)),
  };
  if (!izin.has(IZIN_HPP)) return kartu;
  return { ...kartu, hppAwal: awal.hpp, hppAkhir: terakhir?.hppSetelah ?? awal.hpp };
}

// --- Peringatan ---

/** ST2/ST3: jumlah barang aktif per status bermasalah dan beberapa barang teratas. */
export async function peringatanStok(batas = 8): Promise<PeringatanStok> {
  const ambang = await ambangRestock();
  const r = await repo.ringkasanStok(db, ambang);
  const jumlah = (s: StatusStok) => r.perStatus.find((x) => x.status === s)?.jumlah ?? 0;
  return {
    habis: jumlah('HABIS'),
    kritis: jumlah('KRITIS'),
    perluRestock: jumlah('PERLU_RESTOCK'),
    barang: batas > 0 ? await repo.barangPeringatan(db, ambang, batas) : [],
  };
}

/** ST1 untuk barang-barang tertentu (dipakai daftar & detail Master Barang). */
export async function statusStokBarang(idBarang: number[]): Promise<Map<number, StatusStok>> {
  return repo.statusStokBarang(db, idBarang, await ambangRestock());
}
