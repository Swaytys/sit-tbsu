import { EventEmitter } from 'node:events';

/*
 * Siaran perubahan di dalam proses API (K-073). Service memanggil `siarkan()` SETELAH transaksinya selesai
 * (commit), lalu rute SSE meneruskan tanda "berubah" ke layar yang sedang terbuka; layar itu memuat ulang
 * datanya sendiri. Isi siaran hanya nama topik — tidak ada data bisnis yang dikirim lewat kanal ini.
 */

export const TOPIK_SIARAN = ['antrean'] as const;
export type TopikSiaran = (typeof TOPIK_SIARAN)[number];

const pemancar = new EventEmitter();
// Satu pendengar per layar yang terbuka (kasir, staf, pengantaran); batas bawaan 10 terlalu kecil.
pemancar.setMaxListeners(500);

export function siarkan(topik: TopikSiaran): void {
  pemancar.emit(topik);
}

/** Mendaftarkan pendengar; mengembalikan fungsi untuk berhenti mendengar. */
export function dengarkan(topik: TopikSiaran, fn: () => void): () => void {
  pemancar.on(topik, fn);
  return () => {
    pemancar.off(topik, fn);
  };
}
