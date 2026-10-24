import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  differenceInSeconds,
  format,
  parseISO,
} from 'date-fns';

/** Zona waktu operasional toko (K-042). Database dan server tetap UTC. */
export const ZONA_TOKO = 'Asia/Jakarta';

/** Waktu sekarang. Satu pintu agar tes bisa memakai waktu tiruan (vi.useFakeTimers). */
export function sekarang(): Date {
  return new Date();
}

/** Tanggal operasional (tanggal lokal Asia/Jakarta) dalam format `YYYY-MM-DD` (docs/05 U6). */
export function tanggalOperasional(waktu: Date = sekarang()): string {
  return format(new TZDate(waktu, ZONA_TOKO), 'yyyy-MM-dd');
}

/** Jam:menit lokal Asia/Jakarta, mis. untuk pesan "terkunci sampai pukul 14:30". */
export function jamLokal(waktu: Date): string {
  return format(new TZDate(waktu, ZONA_TOKO), 'HH:mm');
}

/** Saat `jam` (`HH:mm`) pada `tanggal` (`YYYY-MM-DD`) menurut zona toko, mis. jam tutup shift hari itu. */
export function saatLokal(tanggal: string, jam: string): Date {
  const [tahun, bulan, hari] = tanggal.split('-').map(Number);
  const [j, m] = jam.split(':').map(Number);
  return new Date(
    new TZDate(tahun ?? 1970, (bulan ?? 1) - 1, hari ?? 1, j ?? 0, m ?? 0, ZONA_TOKO).getTime(),
  );
}

export function tambahMenit(waktu: Date, menit: number): Date {
  return addMinutes(waktu, menit);
}

export function tambahJam(waktu: Date, jam: number): Date {
  return addHours(waktu, jam);
}

/** Selisih detik `akhir − awal` (dibulatkan ke bawah). */
export function selisihDetik(akhir: Date, awal: Date): number {
  return differenceInSeconds(akhir, awal);
}

/** Tanggal kalender `YYYY-MM-DD` ditambah `hari` (mis. jatuh tempo = tanggal operasional + term). */
export function tambahHari(tanggal: string, hari: number): string {
  return format(addDays(parseISO(tanggal), hari), 'yyyy-MM-dd');
}

/** Tanggal kalender ditambah `bulan` (31 Jan + 1 bulan = 28/29 Feb), mis. servis berikutnya (K-162). */
export function tambahBulan(tanggal: string, bulan: number): string {
  return format(addMonths(parseISO(tanggal), bulan), 'yyyy-MM-dd');
}
