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

/**
 * Akhiran catatan pada tanda "Tidak masuk" yang dibuat tes (K-111). Penyiapan global mengenalinya dan
 * mengembalikan tanda itu menjadi "Sudah masuk", supaya lonceng pemilik tidak berisi sisa tes.
 */
export const CATATAN_UJI_E2E = '(uji e2e)';

/** Data master yang dibuat tes lewat API memakai nama/No. HP berulang antar-run: pencegah data ganda (K-137) dilewati. */
const MASTER_FIXTUR = /^\/(pelanggan|pemasok|barang)(\/\d+)?$/;

/**
 * Memanggil API memakai sesi halaman (cookie login `page`), untuk menyiapkan data tes tanpa lewat layar.
 * Header `origin` wajib agar lolos pemeriksaan CSRF; permintaan selain GET tanpa isi dikirim sebagai JSON
 * kosong. Gagal (bukan 2xx) = tes gagal dengan isi jawaban server.
 */
export async function api<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const isi =
    (method === 'POST' || method === 'PATCH') &&
    MASTER_FIXTUR.test(path) &&
    typeof data === 'object' &&
    data !== null
      ? { abaikanMirip: true, ...data }
      : data;
  const res = await page.request.fetch(`/api${path}`, {
    method,
    data: isi ?? (method === 'GET' ? undefined : {}),
    headers: { origin: new URL(page.url()).origin },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
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
  const kirim = (path: string, data: unknown) => api(page, path, 'PATCH', data);
  const semua = await api<TierUji[]>(page, '/tingkat-harga');
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

/**
 * Kode persetujuan sekali pakai terbaru yang dikirim ke `nama` (K-102). Di mode pengembangan pesan untuk
 * atasan juga masuk kotak keluar uji (`GET /api/auth/pesan-uji`), sehingga tes tidak butuh Telegram/email.
 */
export async function kodePersetujuan(page: Page, nama: string): Promise<string> {
  const pesan = await api<{ kepada: string; isi: string }[]>(page, '/auth/pesan-uji');
  const kode = /Kode: (\d{6})/.exec(pesan.find((x) => x.kepada === nama)?.isi ?? '')?.[1];
  if (!kode) throw new Error(`Tidak ada kode persetujuan untuk ${nama}; jalankan pnpm db:seed.`);
  return kode;
}

/** K-154: id rekening penerimaan AKTIF untuk pembayaran non-tunai lewat API (dipastikan ada oleh penyiapan global). */
export async function idRekening(page: Page, jenis: 'TRANSFER' | 'EDC' | 'QRIS' = 'TRANSFER') {
  const daftar = await api<{ id: number; jenis: string }[]>(page, '/rekening?status=AKTIF');
  const r = daftar.find((x) => x.jenis === jenis);
  if (!r) throw new Error(`Tidak ada rekening ${jenis} aktif`);
  return r.id;
}
