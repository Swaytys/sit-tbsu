import { z } from 'zod';

/*
 * K-145: tombol pintasan layar kerja yang bisa diganti per pengguna. Disimpan di akun (bukan peramban) sehingga ikut
 * ke komputer/tablet mana pun pengguna masuk. Hanya tombol F yang tidak dipakai peramban untuk hal penting
 * (F5 = muat ulang, F11 = layar penuh, F12 = alat pengembang tidak boleh dipakai).
 */

export const LAYAR_PINTASAN = ['KASIR', 'ORDER'] as const;
export type LayarPintasan = (typeof LAYAR_PINTASAN)[number];

export const LABEL_LAYAR_PINTASAN: Record<LayarPintasan, string> = {
  KASIR: 'Penjualan Langsung & Pengantaran (kasir)',
  ORDER: 'Order Penjualan',
};

export const AKSI_PINTASAN = {
  KASIR_CARI: { layar: 'KASIR', label: 'Cari barang', bawaan: 'F2' },
  KASIR_ANTREAN: { layar: 'KASIR', label: 'Antrean', bawaan: 'F3' },
  KASIR_PELANGGAN: { layar: 'KASIR', label: 'Pelanggan', bawaan: 'F4' },
  KASIR_BAYAR: { layar: 'KASIR', label: 'Bayar', bawaan: 'F8' },
  KASIR_MULAI: { layar: 'KASIR', label: 'Mulai dari awal / tunda order', bawaan: 'F9' },
  ORDER_CARI: { layar: 'ORDER', label: 'Cari barang', bawaan: 'F2' },
  ORDER_JENIS: { layar: 'ORDER', label: 'Ganti langsung / pengantaran', bawaan: 'F3' },
  ORDER_PELANGGAN: { layar: 'ORDER', label: 'Pelanggan', bawaan: 'F4' },
  ORDER_SIMPAN_NANTI: { layar: 'ORDER', label: 'Simpan untuk nanti', bawaan: 'F7' },
  ORDER_KIRIM: { layar: 'ORDER', label: 'Kirim ke antrean / simpan perubahan', bawaan: 'F8' },
  ORDER_MULAI: { layar: 'ORDER', label: 'Mulai dari awal', bawaan: 'F9' },
  ORDER_DAFTAR: { layar: 'ORDER', label: 'Daftar order', bawaan: 'F10' },
} as const satisfies Record<string, { layar: LayarPintasan; label: string; bawaan: string }>;

export type AksiPintasan = keyof typeof AKSI_PINTASAN;
export const DAFTAR_AKSI_PINTASAN = Object.keys(AKSI_PINTASAN) as AksiPintasan[];

/** F1 tetap untuk tanda kali (qty) di kotak cari. */
export const TOMBOL_PINTASAN = ['F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10'] as const;
export type TombolPintasan = (typeof TOMBOL_PINTASAN)[number];

/** Pintasan yang diubah pengguna; aksi yang tidak ada memakai bawaan. */
export type PintasanPengguna = Partial<Record<AksiPintasan, TombolPintasan>>;

// Zod 4: `record` dengan kunci enum mewajibkan semua kunci; `partialRecord` tidak.
export const skemaPintasan = z
  .partialRecord(
    z.enum(
      DAFTAR_AKSI_PINTASAN as [AksiPintasan, ...AksiPintasan[]],
      'Aksi pintasan tidak dikenal.',
    ),
    z.enum(TOMBOL_PINTASAN, 'Tombol harus salah satu dari F2, F3, F4, F6, F7, F8, F9, F10.'),
  )
  .superRefine((p, ctx) => {
    const lengkap = pintasanLengkap(p);
    for (const layar of LAYAR_PINTASAN) {
      const dipakai = new Map<string, AksiPintasan>();
      for (const a of DAFTAR_AKSI_PINTASAN) {
        if (AKSI_PINTASAN[a].layar !== layar) continue;
        const k = lengkap[a];
        const lain = dipakai.get(k);
        if (lain) {
          ctx.addIssue({
            code: 'custom',
            path: [a],
            message: `${k} sudah dipakai untuk "${AKSI_PINTASAN[lain].label}" di layar ${LABEL_LAYAR_PINTASAN[layar]}.`,
          });
        }
        dipakai.set(k, a);
      }
    }
  });

/** Semua aksi dengan tombolnya (ubahan pengguna, selain itu bawaan). */
export function pintasanLengkap(
  p: PintasanPengguna | null | undefined,
): Record<AksiPintasan, string> {
  const hasil = {} as Record<AksiPintasan, string>;
  for (const a of DAFTAR_AKSI_PINTASAN) hasil[a] = p?.[a] ?? AKSI_PINTASAN[a].bawaan;
  return hasil;
}
