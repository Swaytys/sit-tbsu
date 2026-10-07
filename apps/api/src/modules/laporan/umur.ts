import {
  KELOMPOK_UMUR,
  kelompokUmur,
  LABEL_KELOMPOK_UMUR,
  type BagianLaporan,
  type BarisIkhtisar,
  type KelompokUmur,
} from '@sit/shared';
import { KOSONG, teks, uang } from './umum';

/*
 * Tabel umur piutang/hutang (docs/06 PT5, HT3, HT5): sisa per pihak per kelompok hari lewat jatuh tempo —
 * belum jatuh tempo (termasuk jatuh tempo hari ini), 1–30, 31–60, 61–90, > 90 hari (K-088).
 */

export type NilaiUmur = Record<KelompokUmur, number>;

export const umurKosong = (): NilaiUmur =>
  Object.fromEntries(KELOMPOK_UMUR.map((k) => [k, 0])) as NilaiUmur;

/** Kelompokkan sisa per pihak; `umurHari` null (tanpa jatuh tempo) masuk "belum jatuh tempo". */
export function kelompokkanUmur<T>(
  baris: T[],
  pihak: (b: T) => string,
  umurHari: (b: T) => number | null,
  sisa: (b: T) => number,
): { per: Map<string, NilaiUmur>; total: NilaiUmur } {
  const per = new Map<string, NilaiUmur>();
  const total = umurKosong();
  for (const b of baris) {
    const k = kelompokUmur(umurHari(b));
    const nama = pihak(b);
    const n = per.get(nama) ?? umurKosong();
    n[k] += sisa(b);
    total[k] += sisa(b);
    per.set(nama, n);
  }
  return { per, total };
}

const jumlah = (n: NilaiUmur) => KELOMPOK_UMUR.reduce((t, k) => t + n[k], 0);

export function bagianUmur(
  judul: string,
  labelPihak: string,
  per: Map<string, NilaiUmur>,
  total: NilaiUmur,
): BagianLaporan {
  return {
    jenis: 'tabel',
    judul,
    tabel: {
      kolom: [
        { judul: labelPihak, jenis: 'teks', lebar: 26 },
        ...KELOMPOK_UMUR.map((k) => ({
          judul: LABEL_KELOMPOK_UMUR[k],
          jenis: 'uang' as const,
          lebar: 13,
          ...(k === 'BELUM' ? {} : { grup: 'Lewat jatuh tempo' }),
        })),
        { judul: 'Jumlah', jenis: 'uang', lebar: 14 },
      ],
      baris: [
        ...[...per.entries()].map(([nama, n]) => ({
          gaya: 'data' as const,
          sel: [teks(nama), ...KELOMPOK_UMUR.map((k) => uang(n[k])), uang(jumlah(n))],
        })),
        ...(per.size > 0
          ? [
              {
                gaya: 'total' as const,
                label: 'Jumlah',
                sel: [KOSONG, ...KELOMPOK_UMUR.map((k) => uang(total[k])), uang(jumlah(total))],
              },
            ]
          : []),
      ],
      kosong: 'Tidak ada saldo.',
    },
  };
}

/** Baris ikhtisar per kelompok umur. */
export function ikhtisarUmur(total: NilaiUmur): BarisIkhtisar[] {
  return KELOMPOK_UMUR.map((k) => ({
    label: k === 'BELUM' ? LABEL_KELOMPOK_UMUR[k] : `Lewat jatuh tempo ${LABEL_KELOMPOK_UMUR[k]}`,
    nilai: uang(total[k]),
    tingkat: 1 as const,
  }));
}
