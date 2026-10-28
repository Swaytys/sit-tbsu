import { z } from 'zod';

/** K-181: info cepat satu dokumen dari nomornya (pop-up ringkas di mana pun nomor itu tampil). */
export const skemaInfoCepat = z.object({
  nomor: z.string().trim().min(2, 'Nomor wajib diisi.').max(40),
});

export type InfoCepat = {
  nomor: string;
  /** Jenis dokumen untuk judul, mis. "Invoice pengantaran". */
  jenis: string;
  /** Pihak utama: pembeli/pemasok/rit. */
  judul: string;
  status: string;
  waktu: string;
  /** Pasangan label–nilai ringkas (total, sisa, pengguna, dsb.) yang sudah diformat. */
  ringkas: { label: string; nilai: string }[];
  /** Paling banyak 12 baris barang. */
  barang: { nama: string; qty: string }[];
  /** Halaman lengkap dokumen ini (null bila tidak ada halaman detail). */
  tautan: string | null;
};
