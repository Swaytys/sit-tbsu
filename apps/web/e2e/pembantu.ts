import { expect, type Page } from '@playwright/test';

export const LABEL_TOMBOL_PERAN = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  KASIR: 'Kasir',
  STAF_PENJUALAN: 'Staf Penjualan',
} as const;

/** Masuk dengan tombol "masuk cepat" (hanya ada di mode pengembangan). */
export async function masukCepat(page: Page, peran: keyof typeof LABEL_TOMBOL_PERAN) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`^${LABEL_TOMBOL_PERAN[peran]}`) }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export function menuUtama(page: Page) {
  return page.getByRole('navigation', { name: 'Menu utama' });
}

type TierUji = {
  id: number;
  kode: string;
  nama: string;
  markupDefaultPersen: string;
  urutan: number;
  minBelanja: number | null;
  statusAktif: string;
};

/**
 * Mengaktifkan tier Grosir dengan syarat belanja tertentu selama sebuah tes (seed membuatnya nonaktif, dan
 * tes lain menghitung dengan harga Normal). Mengembalikan fungsi pemulih yang wajib dipanggil di `finally`.
 * Halaman harus sudah login sebagai Admin/Owner.
 */
export async function aktifkanTierGrosir(page: Page, minBelanja: number) {
  const origin = new URL(page.url()).origin;
  const kirim = async (path: string, data?: unknown) => {
    const res = await page.request.fetch(`/api${path}`, {
      method: data === undefined ? 'GET' : 'PATCH',
      data,
      headers: { origin },
    });
    expect(res.ok(), `${path}: ${await res.text()}`).toBe(true);
    return ((await res.json()) as { data: unknown }).data;
  };
  const semua = (await kirim('/tingkat-harga')) as TierUji[];
  const g = semua.find((t) => t.kode === 'GROSIR');
  if (!g) throw new Error('Tier GROSIR tidak ada; jalankan pnpm db:seed.');
  const isi = (min: number | null) => ({
    kode: g.kode,
    nama: g.nama,
    markupDefaultPersen: g.markupDefaultPersen,
    urutan: g.urutan,
    minBelanja: min,
  });
  await kirim(`/tingkat-harga/${g.id}`, isi(minBelanja));
  if (g.statusAktif !== 'AKTIF') {
    await kirim(`/tingkat-harga/${g.id}/status`, { statusAktif: 'AKTIF' });
  }
  return {
    tier: g,
    pulihkan: async () => {
      if (g.statusAktif !== 'AKTIF') {
        await kirim(`/tingkat-harga/${g.id}/status`, { statusAktif: 'NONAKTIF' });
      }
      await kirim(`/tingkat-harga/${g.id}`, isi(g.minBelanja));
    },
  };
}
