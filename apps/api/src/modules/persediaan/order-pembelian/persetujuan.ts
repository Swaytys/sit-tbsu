import {
  bulatkanRupiah,
  formatRupiah,
  kaliQty,
  kekuranganKesepakatan,
  type PersetujuanOrderPembelian,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import { db, type Executor, type Tx } from '../../../db/client';
import {
  barang,
  orderPembelian,
  orderPembelianDetail,
  pengguna,
  persediaan,
} from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import * as repo from './repo';

/*
 * K-225: persetujuan order pembelian (pemisahan tugas siklus pembelian). Order wajib disetujui bila nilainya di atas
 * batas tanpa persetujuan, memuat barang yang ditandai wajib disetujui Owner, harga beli naik melewati ambang dari
 * harga beli terakhir, atau harga belum diisi. Kepala Toko menyetujui sampai batasnya; di atas itu dan barang khusus
 * hanya Owner. Penyetuju tidak boleh pembuat order (kecuali Owner, pemilik usaha).
 */

/** K-236: tolak bila kesepakatan belum lengkap sebelum diajukan/dikirim. */
export function pastikanKesepakatan(
  po: Parameters<typeof kekuranganKesepakatan>[0],
  total: number,
  aksi: string,
) {
  const kurang = kekuranganKesepakatan(po, total, tanggalOperasional());
  if (kurang.length > 0) {
    throw new AppError(
      'VALIDASI',
      `Lengkapi kesepakatan sebelum ${aksi} (tekan Ubah): ${kurang.join(' ')}`,
      400,
      { kurang },
    );
  }
}

export type HasilPersetujuan = { alasan: string[]; perluOwner: boolean; total: number };

export async function hitungPersetujuan(ex: Executor, idPO: number): Promise<HasilPersetujuan> {
  const baris = await ex
    .select({
      nama: barang.namaBarang,
      khusus: barang.perluPersetujuanBeli,
      qty: orderPembelianDetail.qtyPesan,
      harga: orderPembelianDetail.hargaPerkiraan,
      terakhir: persediaan.hargaBeliTerakhir,
    })
    .from(orderPembelianDetail)
    .innerJoin(barang, eq(barang.id, orderPembelianDetail.idBarang))
    .innerJoin(persediaan, eq(persediaan.idBarang, orderPembelianDetail.idBarang))
    .where(eq(orderPembelianDetail.idOrderPembelian, idPO));
  const batas = await ambilAngka('po_batas_tanpa_persetujuan', 1_000_000, ex);
  const batasKepala = await ambilAngka('po_batas_kepala_toko', 10_000_000, ex);
  const ambang = await ambilAngka('po_ambang_naik_persen', 10, ex);
  const alasan: string[] = [];
  let total = 0;
  const tanpaHarga: string[] = [];
  const naik: string[] = [];
  const khusus: string[] = [];
  for (const b of baris) {
    total += bulatkanRupiah(kaliQty(b.qty, b.harga));
    if (b.harga <= 0) tanpaHarga.push(b.nama);
    if (b.khusus) khusus.push(b.nama);
    if (b.terakhir > 0 && b.harga > b.terakhir * (1 + ambang / 100)) {
      naik.push(`${b.nama} (${formatRupiah(b.terakhir)} → ${formatRupiah(b.harga)})`);
    }
  }
  if (total > batas)
    alasan.push(`Nilai order ${formatRupiah(total)} di atas ${formatRupiah(batas)}.`);
  if (khusus.length > 0) alasan.push(`Barang wajib disetujui Owner: ${khusus.join(', ')}.`);
  if (naik.length > 0) {
    alasan.push(
      `Harga beli naik lebih dari ${ambang}% dari harga beli terakhir: ${naik.join('; ')}.`,
    );
  }
  if (tanpaHarga.length > 0) alasan.push(`Harga beli belum diisi: ${tanpaHarga.join(', ')}.`);
  return { alasan, perluOwner: khusus.length > 0 || total > batasKepala, total };
}

/** Keadaan persetujuan untuk layar detail. */
export async function infoPersetujuan(
  ex: Executor,
  po: {
    id: number;
    idPembuat: number;
    status: string;
    alasanPersetujuan: string | null;
    idPenyetuju: number | null;
    disetujuiPada: Date | null;
    catatanPersetujuan: string | null;
  },
): Promise<PersetujuanOrderPembelian> {
  const h = await hitungPersetujuan(ex, po.id);
  const tersimpan = po.alasanPersetujuan ? po.alasanPersetujuan.split('\n') : [];
  let namaPenyetuju: string | null = null;
  if (po.idPenyetuju !== null) {
    const [u] = await ex
      .select({ nama: pengguna.namaPengguna })
      .from(pengguna)
      .where(eq(pengguna.id, po.idPenyetuju));
    namaPenyetuju = u?.nama ?? null;
  }
  return {
    alasan: po.status === 'DRAF' ? h.alasan : tersimpan,
    perluOwner: h.perluOwner,
    idPembuat: po.idPembuat,
    namaPenyetuju,
    disetujuiPada: po.disetujuiPada?.toISOString() ?? null,
    catatan: po.catatanPersetujuan,
  };
}

async function kunciDanCek(tx: Tx, id: number, status: string[], aksi: string) {
  const po = await repo.kunci(tx, id);
  if (!po) throw new AppError('TIDAK_DITEMUKAN', 'Order pembelian tidak ditemukan.', 404);
  if (!status.includes(po.status)) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Order pembelian berstatus ${po.status.toLowerCase()} tidak bisa ${aksi}.`,
      409,
    );
  }
  return po;
}

/** DRAF → DIAJUKAN. Alasan persetujuan dihitung dan disimpan saat diajukan. */
export async function ajukanPO(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const po = await kunciDanCek(tx, id, ['DRAF'], 'diajukan');
    const h = await hitungPersetujuan(tx, id);
    pastikanKesepakatan(po, h.total, 'diajukan');
    if (h.alasan.length === 0) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        'Order ini tidak perlu persetujuan; langsung kirim ke pemasok.',
        409,
      );
    }
    await tx
      .update(orderPembelian)
      .set({
        status: 'DIAJUKAN',
        alasanPersetujuan: h.alasan.join('\n').slice(0, 500),
        idPenyetuju: null,
        disetujuiPada: null,
        catatanPersetujuan: null,
        diubahPada: sekarang(),
      })
      .where(eq(orderPembelian.id, po.id));
    await catatLog(tx, {
      aksi: 'PO_AJUKAN',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      ringkasan: `Order pembelian diajukan untuk disetujui (${formatRupiah(h.total)}): ${h.alasan.join(' ')}`,
      ip: asal.ip,
    });
  });
}

/** DIAJUKAN → DISETUJUI oleh Kepala Toko (sampai batasnya) atau Owner; bukan pembuat order. */
export async function setujuiPO(
  id: number,
  catatan: string | null,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const po = await kunciDanCek(tx, id, ['DIAJUKAN'], 'disetujui');
    if (po.idPembuat === pelaku.id && pelaku.peran !== 'OWNER') {
      throw new AppError(
        'TIDAK_BERIZIN',
        'Order pembelian buatan sendiri harus disetujui orang lain (Kepala Toko lain atau Owner).',
        403,
      );
    }
    const h = await hitungPersetujuan(tx, id);
    if (h.perluOwner && !pelaku.izin.has('pembelian.setujui_semua')) {
      throw new AppError(
        'TIDAK_BERIZIN',
        'Order ini hanya bisa disetujui Owner (di atas batas Kepala Toko atau memuat barang khusus).',
        403,
      );
    }
    await tx
      .update(orderPembelian)
      .set({
        status: 'DISETUJUI',
        idPenyetuju: pelaku.id,
        disetujuiPada: sekarang(),
        catatanPersetujuan: catatan,
        diubahPada: sekarang(),
      })
      .where(eq(orderPembelian.id, id));
    await catatLog(tx, {
      aksi: 'PO_SETUJUI',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      ringkasan: `Order pembelian disetujui (${formatRupiah(h.total)})${catatan ? `: ${catatan}` : ''}`,
      ip: asal.ip,
    });
  });
}

/** DIAJUKAN → DRAF dengan alasan penolakan (pembuat memperbaiki lalu mengajukan lagi). */
export async function tolakPO(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    await kunciDanCek(tx, id, ['DIAJUKAN'], 'ditolak');
    await tx
      .update(orderPembelian)
      .set({
        status: 'DRAF',
        idPenyetuju: pelaku.id,
        disetujuiPada: null,
        catatanPersetujuan: `Ditolak: ${alasan}`.slice(0, 255),
        diubahPada: sekarang(),
      })
      .where(eq(orderPembelian.id, id));
    await catatLog(tx, {
      aksi: 'PO_TOLAK',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      ringkasan: `Order pembelian dikembalikan ke draf: ${alasan}`,
      ip: asal.ip,
    });
  });
}

/** K-225: jumlah order DIAJUKAN yang boleh disetujui pengguna ini (bukan buatannya; batas Owner dihormati). */
export async function jumlahPOMenunggu(pelaku: PenggunaAktif): Promise<number> {
  const daftar = await db
    .select({ id: orderPembelian.id, idPembuat: orderPembelian.idPembuat })
    .from(orderPembelian)
    .where(eq(orderPembelian.status, 'DIAJUKAN'));
  const owner = pelaku.izin.has('pembelian.setujui_semua');
  let n = 0;
  for (const po of daftar) {
    if (owner) {
      n += 1;
      continue;
    }
    if (po.idPembuat === pelaku.id) continue;
    const h = await hitungPersetujuan(db, po.id);
    if (!h.perluOwner) n += 1;
  }
  return n;
}

/** K-225: hanya Owner yang menandai/melepas barang "pembelian wajib disetujui Owner". */
export async function aturBarangKhusus(
  idBarang: number,
  perlu: boolean,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const [b] = await tx
      .update(barang)
      .set({ perluPersetujuanBeli: perlu })
      .where(eq(barang.id, idBarang))
      .returning({ nama: barang.namaBarang });
    if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Barang tidak ditemukan.', 404);
    await catatLog(tx, {
      aksi: 'BARANG_UBAH',
      idPengguna: pelaku.id,
      entitas: 'barang',
      idEntitas: idBarang,
      ringkasan: `${b.nama}: pembelian ${perlu ? 'wajib' : 'tidak lagi wajib'} disetujui Owner`,
      ip: asal.ip,
    });
  });
}
