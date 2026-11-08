import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/** Zona tampilan (K-042): data waktu dari API dalam UTC, ditampilkan waktu Jakarta. */
export const ZONA_TOKO = 'Asia/Jakarta';

/**
 * Menampilkan desimal dari API (string, mis. "1250.500000") dengan gaya Indonesia: "1.250,5".
 * Diolah sebagai teks, tanpa diubah ke float, sehingga tidak ada pembulatan diam-diam.
 */
export function formatDesimal(nilai: string): string {
  const [bulat = '0', pecahan = ''] = nilai.split('.');
  const pecahanRingkas = pecahan.replace(/0+$/, '');
  const bulatBertitik = bulat.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return pecahanRingkas ? `${bulatBertitik},${pecahanRingkas}` : bulatBertitik;
}

/** Waktu ISO dari API → `19/09/2026 14:30` (Asia/Jakarta). Kosong → `—`. */
export function formatWaktu(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(new TZDate(new Date(iso), ZONA_TOKO), 'dd/MM/yyyy HH:mm');
}

/** Tanggal kalender `2026-10-01` → `01/10/2026`. Kosong → `—`. */
export function formatTanggal(tanggal: string | null | undefined): string {
  if (!tanggal) return '—';
  const [t, b, h] = tanggal.slice(0, 10).split('-');
  return `${h}/${b}/${t}`;
}

/** Tanggal hari ini di zona toko, `YYYY-MM-DD` (nilai awal saringan tanggal). */
export function tanggalHariIni(): string {
  return format(new TZDate(new Date(), ZONA_TOKO), 'yyyy-MM-dd');
}

/** `YYYY-MM-DD` + n hari (isian bawaan form; aturan tanggal bisnis tetap di API). */
export function tambahHariTanggal(tanggal: string, n: number): string {
  const [t, b, h] = tanggal.split('-').map(Number);
  return format(new Date(t ?? 1970, (b ?? 1) - 1, (h ?? 1) + n), 'yyyy-MM-dd');
}

/** Tanggal 1 bulan berjalan di zona toko, `YYYY-MM-DD`. */
export function awalBulanIni(): string {
  return format(new TZDate(new Date(), ZONA_TOKO), 'yyyy-MM-01');
}

/** Ukuran berkas/data yang mudah dibaca (KB, MB, GB). */
export function ukuranTeks(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  if (byte < 1024 * 1024 * 1024) return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${(byte / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} GB`;
}
