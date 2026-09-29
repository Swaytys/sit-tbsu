import { db, type Tx } from '../db/client';

/**
 * Menjalankan `fn` di dalam satu transaksi database. Bila `fn` melempar kesalahan, semua perubahan
 * dibatalkan (rollback). Wajib dipakai service yang menulis ke lebih dari satu tabel (docs/02 §4).
 */
export function dalamTransaksi<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
