import {
  teksQty,
  teksTanggalAngka,
  type JenisKolomLaporan,
  type NadaSel,
  type SelLaporan,
} from '@sit/shared';

/*
 * Format angka dokumen laporan bergaya laporan keuangan (K-078): tanpa "Rp" per sel (satuan mata uang
 * disebut di bawah judul), pemisah ribuan titik, negatif dalam kurung, nol sebagai tanda pisah.
 */

function ribuan(n: number): string {
  return Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const NOL_QTY = /^-?0(\.0*)?$/;

export function teksSel(s: SelLaporan): string {
  switch (s.j) {
    case 'teks':
      return s.v;
    case 'uang':
    case 'angka':
      if (s.v === 0) return '–';
      return s.v < 0 ? `(${ribuan(s.v)})` : ribuan(s.v);
    case 'qty':
      if (NOL_QTY.test(s.v)) return '–';
      return s.v.startsWith('-') ? `(${teksQty(s.v.slice(1))})` : teksQty(s.v);
    case 'persen': {
      if (s.v === null) return '–';
      const t = `${Math.abs(s.v).toFixed(1).replace('.', ',')}%`;
      return s.v < 0 ? `(${t})` : t;
    }
    case 'tanggal':
      return teksTanggalAngka(s.v);
    case 'kosong':
      return '';
  }
}

/** Nilai pengurang di ikhtisar: selalu dalam kurung (kecuali nol). */
export function teksPengurang(s: SelLaporan): string {
  if (s.j === 'uang' && s.v !== 0) return `(${ribuan(s.v)})`;
  return teksSel(s);
}

export function rataKolom(j: JenisKolomLaporan): string {
  if (j === 'teks') return 'text-left';
  if (j === 'tanggal') return 'text-center';
  return 'text-right';
}

export const WARNA_NADA: Record<NadaSel, string> = {
  baik: 'text-green-700',
  peringatan: 'text-amber-700',
  bahaya: 'text-red-700',
  info: 'text-blue-700',
};

/** Teks aman di dalam string CSS `content: "…"`. */
export function teksCss(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}
