import { akhirBulan, dariNomorHari, nomorHari } from '@sit/shared';
import { tanggalHariIni } from '@/lib/format';

/*
 * Pilihan periode laporan (docs/01 §5.9): hari ini, kemarin, minggu ini, bulan ini, bulan lalu,
 * tahun ini, atau rentang bebas. Dihitung dari tanggal kalender (tanpa aritmatika Date).
 */

export const PRESET_PERIODE = [
  { kode: 'hari-ini', label: 'Hari ini' },
  { kode: 'kemarin', label: 'Kemarin' },
  { kode: 'minggu-ini', label: 'Minggu ini' },
  { kode: 'bulan-ini', label: 'Bulan ini' },
  { kode: 'bulan-lalu', label: 'Bulan lalu' },
  { kode: 'tahun-ini', label: 'Tahun ini' },
  { kode: 'rentang', label: 'Rentang tanggal' },
] as const;
export type KodePreset = (typeof PRESET_PERIODE)[number]['kode'];

export function rentangPreset(
  kode: Exclude<KodePreset, 'rentang'>,
  hariIni = tanggalHariIni(),
): { dari: string; sampai: string } {
  const n = nomorHari(hariIni);
  const [t, b] = hariIni.split('-');
  switch (kode) {
    case 'hari-ini':
      return { dari: hariIni, sampai: hariIni };
    case 'kemarin': {
      const k = dariNomorHari(n - 1);
      return { dari: k, sampai: k };
    }
    case 'minggu-ini':
      // 1970-01-01 hari Kamis: (n + 3) mod 7 = jarak ke Senin sebelumnya.
      return { dari: dariNomorHari(n - ((((n + 3) % 7) + 7) % 7)), sampai: hariIni };
    case 'bulan-ini':
      return { dari: `${t}-${b}-01`, sampai: hariIni };
    case 'bulan-lalu': {
      const awalIni = nomorHari(`${t}-${b}-01`);
      const akhirLalu = dariNomorHari(awalIni - 1);
      return { dari: `${akhirLalu.slice(0, 7)}-01`, sampai: akhirBulan(akhirLalu) };
    }
    case 'tahun-ini':
      return { dari: `${t}-01-01`, sampai: hariIni };
  }
}

/** Preset yang cocok dengan rentang tertentu (untuk menandai tombol aktif), atau `rentang`. */
export function presetDari(dari: string, sampai: string, hariIni = tanggalHariIni()): KodePreset {
  for (const p of PRESET_PERIODE) {
    if (p.kode === 'rentang') continue;
    const r = rentangPreset(p.kode, hariIni);
    if (r.dari === dari && r.sampai === sampai) return p.kode;
  }
  return 'rentang';
}
