import {
  skemaPersen,
  type HargaTierBarang,
  type MetodeHarga,
  type TingkatHarga,
} from '@sit/shared';
import { formatDesimal } from '@/lib/format';

/*
 * Isian harga satu tier (docs/06 H4). Metode disimpan eksplisit agar sel "Tetap" yang dikosongkan tidak
 * diam-diam menjadi "Ikut tier". Harga hasil markup dihitung API saat disimpan (CLAUDE.md aturan 1).
 */

export type IsianHarga = {
  metode: MetodeHarga;
  hargaTetap: number | null;
  markupPersen: string | null;
};

/** "12.00" → "12", "18.50" → "18.5" (tampilan isian; nilai tetap teks desimal bertitik). */
export function rapikanPersen(persen: string | null | undefined): string | null {
  if (persen === null || persen === undefined) return null;
  return persen.includes('.') ? persen.replace(/0+$/, '').replace(/\.$/, '') : persen;
}

export function isianDari(h: HargaTierBarang | undefined): IsianHarga {
  if (!h) return { metode: 'IKUT_TIER', hargaTetap: null, markupPersen: null };
  return {
    metode: h.metode,
    hargaTetap: h.metode === 'TETAP' ? h.hargaTetap : null,
    markupPersen: h.metode === 'MARKUP' ? rapikanPersen(h.markupPersen) : null,
  };
}

export function isianSama(a: IsianHarga, b: IsianHarga): boolean {
  if (a.metode !== b.metode) return false;
  if (a.metode === 'TETAP') return a.hargaTetap === b.hargaTetap;
  // Perbandingan tampilan saja (bukan hitungan uang/qty): "18.5" sama dengan "18.50".
  if (a.metode === 'MARKUP') return Number(a.markupPersen) === Number(b.markupPersen);
  return true;
}

/** Sama dengan aturan API: TETAP wajib angka; MARKUP wajib persen sah (skemaPersen bersama). */
export function isianSah(i: IsianHarga): boolean {
  if (i.metode === 'TETAP') return i.hargaTetap !== null;
  if (i.metode === 'MARKUP') return skemaPersen.safeParse(i.markupPersen).success;
  return true;
}

/** Bentuk kirim ke API: angka = TETAP, persen = MARKUP, keduanya kosong = IKUT_TIER. */
export function keKirim(i: IsianHarga): { hargaTetap: number | null; markupPersen: string | null } {
  return {
    hargaTetap: i.metode === 'TETAP' ? i.hargaTetap : null,
    markupPersen: i.metode === 'MARKUP' ? i.markupPersen : null,
  };
}

/** Ganti metode; nilai awal diambil dari harga yang berlaku agar tidak mengetik ulang. */
export function gantiMetode(
  isi: IsianHarga,
  metode: MetodeHarga,
  h: HargaTierBarang | undefined,
  t: TingkatHarga,
): IsianHarga {
  if (metode === 'TETAP') {
    return { metode, hargaTetap: isi.hargaTetap ?? h?.hargaJual ?? null, markupPersen: null };
  }
  if (metode === 'MARKUP') {
    return {
      metode,
      hargaTetap: null,
      markupPersen: isi.markupPersen ?? rapikanPersen(h?.markupPersen ?? t.markupDefaultPersen),
    };
  }
  return { metode, hargaTetap: null, markupPersen: null };
}

export function teksMargin(margin: number): string {
  return `${formatDesimal(String(margin))}%`;
}
