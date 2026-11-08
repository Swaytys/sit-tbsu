import { formatRupiah } from '@sit/shared';
import { eq, sql } from 'drizzle-orm';
import { db, type Executor, type Tx } from '../../db/client';
import { pemasok } from '../../db/schema';
import { AppError } from '../../lib/errors';

/*
 * K-237: deposit pemasok = kelebihan uang muka order yang ditutup dan tidak diminta kembali (alokasi_uang_muka
 * DIKEMBALIKAN metode DEPOSIT), dikurangi pemakaiannya (pembayaran_pemasok metode DEPOSIT untuk uang muka order
 * lain atau pembayaran hutang). Tidak ada uang yang berpindah; saldo dihitung dari dua tabel append-only itu.
 */

export async function saldoDeposit(ex: Executor, idPemasok: number): Promise<number> {
  const r = await ex.execute<{ saldo: string }>(sql`
    select (coalesce((select sum(a.nominal) from alokasi_uang_muka a
                        join pembayaran_pemasok p on p.id = a.id_pembayaran_pemasok
                       where p.id_pemasok = ${idPemasok} and a.jenis = 'DIKEMBALIKAN'
                         and a.metode_kembali = 'DEPOSIT'), 0)
          - coalesce((select sum(p.nominal) from pembayaran_pemasok p
                       where p.id_pemasok = ${idPemasok} and p.metode = 'DEPOSIT'), 0))::text saldo`);
  return Number(r.rows[0]?.saldo ?? 0);
}

/** Saldo deposit untuk layar (Hutang Pemasok, kartu order). */
export function saldoDepositPemasok(idPemasok: number): Promise<number> {
  return saldoDeposit(db, idPemasok);
}

/**
 * Pastikan deposit cukup sebelum dipakai. Baris pemasok dikunci agar dua pemakaian bersamaan tidak sama-sama
 * lolos (pola L11).
 */
export async function pastikanDeposit(tx: Tx, idPemasok: number, nominal: number): Promise<void> {
  await tx.select({ id: pemasok.id }).from(pemasok).where(eq(pemasok.id, idPemasok)).for('update');
  const saldo = await saldoDeposit(tx, idPemasok);
  if (nominal > saldo) {
    throw new AppError(
      'VALIDASI',
      `Deposit pemasok hanya ${formatRupiah(saldo)}; tidak cukup untuk ${formatRupiah(nominal)}.`,
      400,
      { kolom: { metode: ['Deposit tidak cukup.'] } },
    );
  }
}
