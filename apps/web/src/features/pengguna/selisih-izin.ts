import type { Izin } from '@sit/shared';

/** K-243: selisih izin akhir terhadap bawaan: yang ditambah dan yang dicabut (urut). */
export function selisihIzin(dasar: ReadonlySet<Izin>, akhir: ReadonlySet<Izin>) {
  return {
    tambah: [...akhir].filter((i) => !dasar.has(i)).sort(),
    cabut: [...dasar].filter((i) => !akhir.has(i)).sort(),
  };
}
