import { eq } from 'drizzle-orm';
import {
  bagiQty,
  bandingQty,
  keQty,
  kurangQty,
  type BarisSuratJalan,
  type DataSuratJalan,
  type MetaHalaman,
  type StatusPengiriman,
} from '@sit/shared';
import { db, type Executor, type Tx } from '../../../db/client';
import { penjualan, suratJalan, suratJalanDetail } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import * as pjRepo from '../penjualan/repo';
import * as repo from './repo';

/*
 * Surat jalan (docs/05 §7, S1–S7; K-024): banyak SJ per invoice, qty kirim per baris tidak melebihi sisa,
 * status maju satu langkah, status pengiriman invoice = agregat (cache, diperbarui di transaksi yang sama).
 */

/** Qty retur dalam satuan baris (K-091: qty retur dasar ÷ faktor satuan jual). */
function qtyReturBaris(b: { qtyReturDasar: string; faktor: string }): string {
  return bagiQty(b.qtyReturDasar, b.faktor);
}

/** S2: qty yang masih boleh dikirim per baris = qty − retur − di SJ non-BATAL (baris VOID = 0). */
export function sisaKirim(b: {
  qty: string;
  qtyReturDasar: string;
  faktor: string;
  statusItem: string;
  qtyDikirim: string;
}): string {
  if (b.statusItem === 'VOID') return '0.000';
  const sisa = kurangQty(kurangQty(b.qty, qtyReturBaris(b)), b.qtyDikirim);
  return bandingQty(sisa, 0) < 0 ? '0.000' : keQty(sisa);
}

/** S4: hitung ulang `penjualan.status_pengiriman` dari surat jalannya. */
export async function sinkronStatusPengiriman(
  tx: Tx,
  idPenjualan: number,
): Promise<StatusPengiriman> {
  let status: StatusPengiriman;
  if (!(await repo.adaSuratJalanAktif(tx, idPenjualan))) {
    status = 'BELUM';
  } else {
    const baris = await repo.qtyBaris(tx, idPenjualan);
    const semua = baris.every(
      (b) =>
        b.statusItem === 'VOID' ||
        bandingQty(b.qtyTerkirim, kurangQty(b.qty, qtyReturBaris(b))) >= 0,
    );
    status = semua ? 'SELESAI' : 'SEBAGIAN';
  }
  await tx
    .update(penjualan)
    .set({ statusPengiriman: status, diubahPada: sekarang() })
    .where(eq(penjualan.id, idPenjualan));
  return status;
}

type Header = NonNullable<Awaited<ReturnType<typeof repo.byId>>>;

async function keRespons(ex: Executor, rows: Header[]): Promise<BarisSuratJalan[]> {
  const detail = await repo.detail(
    ex,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    tanggal: r.tanggal.toISOString(),
    waktuDimuat: r.waktuDimuat?.toISOString() ?? null,
    waktuDikirim: r.waktuDikirim?.toISOString() ?? null,
    waktuSelesai: r.waktuSelesai?.toISOString() ?? null,
    baris: detail.filter((d) => d.idSuratJalan === r.id).map(({ idSuratJalan: _, ...d }) => d),
  }));
}

export async function daftarSuratJalan(
  p: repo.SaringSuratJalan & { halaman: number; perHalaman: number },
): Promise<{ data: BarisSuratJalan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: await keRespons(db, baris), meta: metaHalaman(total, p) };
}

export async function suratJalanPenjualan(idPenjualan: number): Promise<BarisSuratJalan[]> {
  const { baris } = await repo.daftar(db, { idPenjualan, limit: 100, offset: 0 });
  return keRespons(db, baris);
}

export async function detailSuratJalan(id: number): Promise<BarisSuratJalan> {
  const h = await repo.byId(db, id);
  if (!h) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
  const [hasil] = await keRespons(db, [h]);
  if (!hasil) throw new Error('surat jalan hilang');
  return hasil;
}

/** S1/S2: membuat surat jalan (DIPROSES) untuk invoice pengantaran. */
export async function buatSuratJalan(
  idPenjualan: number,
  input: DataSuratJalan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisSuratJalan> {
  const id = await dalamTransaksi(async (tx) => {
    const pj = await pjRepo.kunciPenjualan(tx, idPenjualan);
    if (!pj) throw new AppError('TIDAK_DITEMUKAN', 'Penjualan tidak ditemukan.', 404);
    if (pj.jenisPenjualan !== 'PENGANTARAN') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        'Surat jalan hanya untuk penjualan pengantaran.',
        409,
      );
    }
    if (pj.statusTransaksi === 'VOID') {
      throw new AppError('STATUS_TIDAK_VALID', `Penjualan ${pj.nomor} sudah di-void.`, 409);
    }
    const baris = new Map((await repo.qtyBaris(tx, idPenjualan)).map((b) => [b.id, b]));
    const terlihat = new Set<number>();
    for (const [i, r] of input.baris.entries()) {
      const b = baris.get(r.idPenjualanDetail);
      if (!b || terlihat.has(r.idPenjualanDetail)) {
        throw new AppError('VALIDASI', `Baris ${i + 1}: barang tidak ada di invoice ini.`, 400);
      }
      terlihat.add(r.idPenjualanDetail);
      const sisa = sisaKirim(b);
      if (bandingQty(r.qtyKirim, sisa) > 0) {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          `${b.namaBarang}: qty kirim ${keQty(r.qtyKirim)} melebihi sisa yang belum dikirim (${sisa}).`,
          409,
          { kolom: { [`baris.${i}.qtyKirim`]: [`Maksimal ${sisa}.`] } },
        );
      }
    }
    const [info] = await tx
      .select({ alamatKirim: penjualan.alamatKirim })
      .from(penjualan)
      .where(eq(penjualan.id, idPenjualan));
    const nomor = await terbitkanNomor(tx, 'SJ', tanggalOperasional());
    const [sj] = await tx
      .insert(suratJalan)
      .values({
        nomor,
        idPenjualan,
        idPengguna: pelaku.id,
        alamatKirim: input.alamatKirim ?? info?.alamatKirim ?? '-',
        namaPenerima: input.namaPenerima ?? null,
        noHpPenerima: input.noHpPenerima ?? null,
        sopir: input.sopir ?? null,
        kendaraan: input.kendaraan ?? null,
        catatan: input.catatan ?? null,
      })
      .returning({ id: suratJalan.id });
    if (!sj) throw new Error('insert surat jalan tidak mengembalikan id');
    await tx.insert(suratJalanDetail).values(
      input.baris.map((r) => ({
        idSuratJalan: sj.id,
        idPenjualanDetail: r.idPenjualanDetail,
        qtyKirim: keQty(r.qtyKirim),
      })),
    );
    await sinkronStatusPengiriman(tx, idPenjualan);
    await catatLog(tx, {
      aksi: 'SURAT_JALAN_BUAT',
      idPengguna: pelaku.id,
      entitas: 'surat_jalan',
      idEntitas: sj.id,
      nomorDokumen: nomor,
      ringkasan: `Surat jalan ${nomor} untuk ${pj.nomor}: ${input.baris.length} barang`,
      ip: asal.ip,
    });
    return sj.id;
  });
  return detailSuratJalan(id);
}

const LANGKAH = { DIPROSES: 'DIMUAT', DIMUAT: 'DIKIRIM', DIKIRIM: 'SELESAI' } as const;

/** S3: maju satu langkah; DIKIRIM wajib sopir; setiap langkah mengisi waktunya dan dicatat log. */
export async function ubahStatusSuratJalan(
  id: number,
  input: {
    status: 'DIMUAT' | 'DIKIRIM' | 'SELESAI';
    sopir?: string | null;
    kendaraan?: string | null;
  },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisSuratJalan> {
  await dalamTransaksi(async (tx) => {
    const sj = await repo.kunci(tx, id);
    if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
    const berikut = sj.status in LANGKAH ? LANGKAH[sj.status as keyof typeof LANGKAH] : null;
    if (berikut !== input.status) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Surat jalan ${sj.nomor} berstatus ${sj.status.toLowerCase()}; tidak bisa menjadi ${input.status.toLowerCase()}.`,
        409,
      );
    }
    const sopir = input.sopir ?? sj.sopir;
    if (input.status === 'DIKIRIM' && !sopir) {
      throw new AppError('VALIDASI', 'Nama sopir wajib diisi sebelum barang dikirim.', 400, {
        kolom: { sopir: ['Nama sopir wajib diisi.'] },
      });
    }
    const waktu = sekarang();
    await tx
      .update(suratJalan)
      .set({
        status: input.status,
        sopir,
        kendaraan: input.kendaraan ?? sj.kendaraan,
        ...(input.status === 'DIMUAT' ? { waktuDimuat: waktu } : {}),
        ...(input.status === 'DIKIRIM' ? { waktuDikirim: waktu } : {}),
        ...(input.status === 'SELESAI' ? { waktuSelesai: waktu } : {}),
        diubahPada: waktu,
      })
      .where(eq(suratJalan.id, id));
    await sinkronStatusPengiriman(tx, sj.idPenjualan);
    await catatLog(tx, {
      aksi: 'SURAT_JALAN_STATUS',
      idPengguna: pelaku.id,
      entitas: 'surat_jalan',
      idEntitas: id,
      nomorDokumen: sj.nomor,
      ringkasan: `Surat jalan ${sj.nomor}: ${sj.status.toLowerCase()} → ${input.status.toLowerCase()}${input.status === 'DIKIRIM' ? ` (sopir ${sopir})` : ''}`,
      ip: asal.ip,
    });
  });
  return detailSuratJalan(id);
}

/** S5: batal hanya dari DIPROSES/DIMUAT dengan alasan; tidak dihitung lagi di S2/S4. */
export async function batalSuratJalan(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisSuratJalan> {
  await dalamTransaksi(async (tx) => {
    const sj = await repo.kunci(tx, id);
    if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
    if (sj.status !== 'DIPROSES' && sj.status !== 'DIMUAT') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Surat jalan ${sj.nomor} sudah ${sj.status === 'BATAL' ? 'batal' : 'berangkat'}; tidak bisa dibatalkan.`,
        409,
      );
    }
    await tx
      .update(suratJalan)
      .set({ status: 'BATAL', alasanBatal: alasan, diubahPada: sekarang() })
      .where(eq(suratJalan.id, id));
    await sinkronStatusPengiriman(tx, sj.idPenjualan);
    await catatLog(tx, {
      aksi: 'SURAT_JALAN_BATAL',
      idPengguna: pelaku.id,
      entitas: 'surat_jalan',
      idEntitas: id,
      nomorDokumen: sj.nomor,
      ringkasan: `Surat jalan ${sj.nomor} dibatalkan: ${alasan}`,
      ip: asal.ip,
    });
  });
  return detailSuratJalan(id);
}
