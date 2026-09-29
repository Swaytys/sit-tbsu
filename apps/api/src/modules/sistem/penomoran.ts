import { sql } from 'drizzle-orm';
import type { KodeDokumen, KodeMaster } from '@sit/shared';
import type { Tx } from '../../db/client';
import { penghitungNomor } from '../../db/schema';
import { ambilAngka, ambilTeks } from './konfigurasi/service';

/*
 * SATU-SATUNYA tempat nomor dokumen dan kode master diterbitkan (CLAUDE.md aturan 11, docs/05 §4).
 * Selalu dipanggil dengan `tx` yang sama dengan penyimpanan dokumennya.
 */

const TANGGAL_KODE_MASTER = '000000';
const DIGIT_KODE_MASTER = 5;

/**
 * Menaikkan penghitung (prefix, tanggal_kode) satu langkah dan mengembalikan nilainya. Baris penghitung
 * terkunci sampai transaksi selesai, jadi dua penerbitan bersamaan tidak pernah mendapat nomor sama (N3).
 */
async function naikkanPenghitung(tx: Tx, prefix: string, tanggalKode: string): Promise<number> {
  const [baris] = await tx
    .insert(penghitungNomor)
    .values({ prefix, tanggalKode, nilaiTerakhir: 1 })
    .onConflictDoUpdate({
      target: [penghitungNomor.prefix, penghitungNomor.tanggalKode],
      set: { nilaiTerakhir: sql`${penghitungNomor.nilaiTerakhir} + 1` },
    })
    .returning({ nilai: penghitungNomor.nilaiTerakhir });
  if (!baris)
    throw new Error(`Penerbitan nomor ${prefix}/${tanggalKode} tidak mengembalikan nilai`);
  return baris.nilai;
}

/** `2026-09-29` → `260929`. */
export function tanggalKode(tanggalOperasional: string): string {
  const cocok = /^\d{2}(\d{2})-(\d{2})-(\d{2})$/.exec(tanggalOperasional);
  if (!cocok) throw new Error(`Tanggal operasional tidak valid: ${tanggalOperasional}`);
  return `${cocok[1]}${cocok[2]}${cocok[3]}`;
}

/**
 * Nomor dokumen `PREFIX-YYMMDD-NNN` (N1). Prefix dari `konfigurasi.prefix_<KODE>` saat penerbitan (N2);
 * urutan mulai 001 tiap hari dan melebar otomatis setelah 999.
 */
export async function terbitkanNomor(
  tx: Tx,
  kode: KodeDokumen,
  tanggalOperasional: string,
): Promise<string> {
  const prefix = await ambilTeks(`prefix_${kode}`, kode, tx);
  const digit = await ambilAngka('digit_nomor', 3, tx);
  const tanggal = tanggalKode(tanggalOperasional);
  const nilai = await naikkanPenghitung(tx, prefix, tanggal);
  return `${prefix}-${tanggal}-${String(nilai).padStart(digit, '0')}`;
}

/** Kode master `PREFIX-NNNNN` tanpa reset harian (N5), mis. `USR-00002`. */
export async function terbitkanKodeMaster(tx: Tx, kode: KodeMaster): Promise<string> {
  const nilai = await naikkanPenghitung(tx, kode, TANGGAL_KODE_MASTER);
  return `${kode}-${String(nilai).padStart(DIGIT_KODE_MASTER, '0')}`;
}

/**
 * Memastikan penghitung kode master tidak di bawah `nilaiMinimal` (mis. kode yang sudah dipakai data
 * lama/seed), agar kode berikutnya tidak bentrok. Tidak pernah menurunkan penghitung.
 */
export async function sinkronkanKodeMaster(
  tx: Tx,
  kode: KodeMaster,
  nilaiMinimal: number,
): Promise<void> {
  if (nilaiMinimal <= 0) return;
  await tx
    .insert(penghitungNomor)
    .values({ prefix: kode, tanggalKode: TANGGAL_KODE_MASTER, nilaiTerakhir: nilaiMinimal })
    .onConflictDoUpdate({
      target: [penghitungNomor.prefix, penghitungNomor.tanggalKode],
      set: {
        nilaiTerakhir: sql`greatest(${penghitungNomor.nilaiTerakhir}, excluded.nilai_terakhir)`,
      },
    });
}
