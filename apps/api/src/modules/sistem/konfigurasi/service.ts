import { db, type Executor } from '../../../db/client';
import * as repo from './repo';

/*
 * Konfigurasi toko dibaca sangat sering (penomoran, login, harga) tetapi jarang diubah, jadi disimpan
 * di memori. Setiap perubahan lewat service pengaturan memanggil `invalidasiKonfigurasi()`.
 *
 * PENTING: di dalam transaksi, teruskan `tx` sebagai argumen `ex`. Bila cache kosong, nilai dimuat lewat
 * koneksi transaksi itu sendiri; memuat lewat pool saat semua koneksi sedang dipegang transaksi akan
 * membuat semuanya saling menunggu (deadlock kumpulan koneksi).
 */
let cache: Promise<Map<string, string | null>> | null = null;

function muat(ex: Executor): Promise<Map<string, string | null>> {
  cache ??= repo
    .semuaKonfigurasi(ex)
    .then((baris) => new Map(baris.map((b) => [b.kode, b.nilai])))
    .catch((err: unknown) => {
      cache = null;
      throw err;
    });
  return cache;
}

/** Wajib dipanggil setelah nilai konfigurasi berubah (dan oleh tes yang mengosongkan tabel). */
export function invalidasiKonfigurasi(): void {
  cache = null;
}

export async function ambilTeks(kode: string, bawaan: string, ex: Executor = db): Promise<string> {
  const nilai = (await muat(ex)).get(kode);
  return nilai ?? bawaan;
}

export async function ambilAngka(kode: string, bawaan: number, ex: Executor = db): Promise<number> {
  const nilai = (await muat(ex)).get(kode);
  if (nilai === undefined || nilai === null || !/^-?\d+$/.test(nilai.trim())) return bawaan;
  return Number.parseInt(nilai, 10);
}

/** Semua nilai (untuk halaman Pengaturan). */
export async function semuaNilai(ex: Executor = db): Promise<ReadonlyMap<string, string | null>> {
  return muat(ex);
}
