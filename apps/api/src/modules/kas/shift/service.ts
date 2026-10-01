import { and, eq } from 'drizzle-orm';
import { formatRupiah, type ShiftAktif } from '@sit/shared';
import { db, type Executor } from '../../../db/client';
import { shiftKasir } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';

/*
 * Shift kasir (docs/05 K1). Fase 5 (K-070): buka shift dan membaca shift BUKA milik sendiri, karena pembayaran
 * TUNAI wajib terikat shift (P8/P12, CHECK DB). Kas shift, tutup shift, dan clerical check di Fase 6.
 */

/** Shift BUKA milik pengguna, atau `null`. */
export async function shiftBuka(ex: Executor, idPengguna: number) {
  const [s] = await ex
    .select({
      id: shiftKasir.id,
      nomor: shiftKasir.nomor,
      tanggalOperasional: shiftKasir.tanggalOperasional,
      waktuBuka: shiftKasir.waktuBuka,
      modalAwal: shiftKasir.modalAwal,
    })
    .from(shiftKasir)
    .where(and(eq(shiftKasir.idKasir, idPengguna), eq(shiftKasir.status, 'BUKA')))
    .limit(1);
  return s ?? null;
}

function keRespons(s: NonNullable<Awaited<ReturnType<typeof shiftBuka>>>): ShiftAktif {
  return { ...s, waktuBuka: s.waktuBuka.toISOString() };
}

export async function shiftSaya(pelaku: PenggunaAktif): Promise<ShiftAktif | null> {
  const s = await shiftBuka(db, pelaku.id);
  return s ? keRespons(s) : null;
}

/** K1: satu shift BUKA per pengguna; modal awal boleh 0. */
export async function bukaShift(
  modalAwal: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ShiftAktif> {
  await dalamTransaksi(async (tx) => {
    const ada = await shiftBuka(tx, pelaku.id);
    if (ada) {
      throw new AppError(
        'KONFLIK',
        `Anda masih punya shift terbuka (${ada.nomor}). Tutup shift itu dulu.`,
        409,
      );
    }
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'SHF', tanggal);
    const [s] = await tx
      .insert(shiftKasir)
      .values({ nomor, idKasir: pelaku.id, tanggalOperasional: tanggal, modalAwal })
      .returning({ id: shiftKasir.id });
    await catatLog(tx, {
      aksi: 'SHIFT_BUKA',
      idPengguna: pelaku.id,
      entitas: 'shift_kasir',
      idEntitas: s?.id,
      nomorDokumen: nomor,
      ringkasan: `Buka shift ${nomor}, modal awal ${formatRupiah(modalAwal)}`,
      ip: asal.ip,
    });
  });
  const s = await shiftBuka(db, pelaku.id);
  if (!s) throw new Error('shift baru tidak terbaca');
  return keRespons(s);
}
