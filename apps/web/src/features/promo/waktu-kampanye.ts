import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { ZONA_TOKO } from '@/lib/format';

/*
 * K-163: waktu promo di form disimpan sebagai ISO berzona toko (`2026-11-01T08:00:00+07:00`); Asia/Jakarta tidak
 * memakai musim panas sehingga +07:00 tetap.
 */

/** "2026-11-01T08:00" (isian datetime-local) → ISO berzona toko. */
export function dariIsianWaktu(v: string): string {
  return `${v}:00+07:00`;
}

/** ISO berzona toko (bentuk form) → nilai datetime-local. */
export function keIsianWaktu(iso: string | undefined): string {
  return iso ? iso.slice(0, 16) : '';
}

/** Waktu dari API (UTC) → ISO berzona toko untuk form. */
export function isoLokal(iso: string | Date): string {
  return format(new TZDate(new Date(iso), ZONA_TOKO), "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
}

export const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const;
