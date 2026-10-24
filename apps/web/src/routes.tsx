import type { Izin } from '@sit/shared';
import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { Layout } from '@/components/layout/layout';
import { WajibIzin, WajibLogin } from '@/components/penjaga-rute';
import {
  HalamanGantiPasswordAkun,
  HalamanWajibGantiPassword,
} from '@/features/auth/halaman-ganti-password';
import { HalamanLogin } from '@/features/auth/halaman-login';
import { HalamanGalat } from '@/features/umum/halaman-galat';
import { HalamanSegera } from '@/features/umum/halaman-segera';
import { HalamanTidakDitemukan } from '@/features/umum/halaman-tidak-ditemukan';
import { SEMUA_ITEM_MENU } from '@/lib/menu';

type MuatHalaman = () => Promise<ComponentType>;

/**
 * Halaman yang sudah dibangun, per path. Kode tiap halaman diunduh saat pertama dibuka (bundel awal kecil);
 * selama itu halaman sebelumnya tetap tampil. Path menu lain menampilkan "sedang disiapkan".
 */
const HALAMAN: Record<string, MuatHalaman> = {
  '/dashboard': () => import('@/features/beranda/halaman-beranda').then((m) => m.HalamanBeranda),
  '/barang': () => import('@/features/barang/halaman-barang').then((m) => m.HalamanBarang),
  '/harga-jual': () =>
    import('@/features/harga-jual/halaman-harga-jual').then((m) => m.HalamanHargaJual),
  '/referensi': () =>
    import('@/features/referensi/halaman-referensi').then((m) => m.HalamanReferensi),
  '/pelanggan': () =>
    import('@/features/pelanggan/halaman-pelanggan').then((m) => m.HalamanPelanggan),
  '/armada': () => import('@/features/armada/halaman-armada').then((m) => m.HalamanArmada),
  '/pengiriman': () =>
    import('@/features/pengiriman/halaman-pengiriman').then((m) => m.HalamanPengiriman),
  '/pemasok': () => import('@/features/pemasok/halaman-pemasok').then((m) => m.HalamanPemasok),
  '/pengguna': () => import('@/features/pengguna/halaman-pengguna').then((m) => m.HalamanPengguna),
  '/persediaan': () =>
    import('@/features/persediaan/halaman-persediaan').then((m) => m.HalamanPersediaan),
  '/penerimaan': () =>
    import('@/features/penerimaan/halaman-penerimaan').then((m) => m.HalamanPenerimaan),
  '/order': () => import('@/features/order/halaman-order').then((m) => m.HalamanOrder),
  '/retur': () => import('@/features/koreksi/halaman-retur').then((m) => m.HalamanRetur),
  '/void': () => import('@/features/koreksi/halaman-void').then((m) => m.HalamanVoid),
  '/shift': () => import('@/features/shift/halaman-shift').then((m) => m.HalamanShift),
  '/laporan': () => import('@/features/laporan/halaman-laporan').then((m) => m.HalamanLaporan),
  '/hutang': () => import('@/features/hutang/halaman-hutang').then((m) => m.HalamanHutang),
  '/konsinyasi': () =>
    import('@/features/konsinyasi/halaman-konsinyasi').then((m) => m.HalamanKonsinyasi),
  '/retur-pemasok': () =>
    import('@/features/retur-pemasok/halaman-retur-pemasok').then((m) => m.HalamanReturPemasok),
  '/piutang': () => import('@/features/piutang/halaman-piutang').then((m) => m.HalamanPiutang),
  '/penjualan-pengantaran': () =>
    import('@/features/pengantaran/halaman-penjualan-pengantaran').then(
      (m) => m.HalamanPenjualanPengantaran,
    ),
  '/penjualan-langsung': () =>
    import('@/features/kasir/halaman-penjualan-langsung').then((m) => m.HalamanPenjualanLangsung),
  '/pengaturan': () =>
    import('@/features/pengaturan/halaman-pengaturan').then((m) => m.HalamanPengaturan),
};

/** Rute berhalaman lazy yang dijaga izin. */
function ruteLazy(
  path: string,
  judul: string,
  izin: Izin | readonly Izin[],
  muat: MuatHalaman,
): RouteObject {
  return {
    path,
    handle: { judul },
    lazy: async () => {
      const Halaman = await muat();
      return {
        element: (
          <WajibIzin izin={izin}>
            <Halaman />
          </WajibIzin>
        ),
      };
    },
  };
}

const ruteMenu: RouteObject[] = SEMUA_ITEM_MENU.map((item) => {
  const muat = HALAMAN[item.path];
  if (muat) return ruteLazy(item.path.slice(1), item.label, item.izin, muat);
  return {
    path: item.path.slice(1),
    handle: { judul: item.label },
    element: (
      <WajibIzin izin={item.izin}>
        <HalamanSegera item={item} />
      </WajibIzin>
    ),
  };
});

const muatFormBarang: MuatHalaman = () =>
  import('@/features/barang/halaman-form-barang').then((m) => m.HalamanFormBarang);

/**
 * Semua halaman. `handle.judul` tampil di topbar dan judul tab browser. `errorElement` dipasang dua lapis:
 * galat di satu halaman tampil di dalam kerangka (menu samping tetap bisa dipakai untuk pindah halaman),
 * sedangkan galat di kerangka, login, atau penjaga rute tampil sebagai halaman penuh.
 */
export const router = createBrowserRouter([
  {
    errorElement: <HalamanGalat />,
    children: [
      { path: '/login', element: <HalamanLogin /> },
      {
        path: '/ganti-password',
        element: (
          <WajibLogin bolehWajibGanti>
            <HalamanWajibGantiPassword />
          </WajibLogin>
        ),
      },
      {
        path: '/',
        element: (
          <WajibLogin>
            <Layout />
          </WajibLogin>
        ),
        children: [
          {
            errorElement: <HalamanGalat />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              // K-110: Promo pindah ke Pengaturan › Promo; alamat lama tetap sampai ke sana.
              { path: 'promo', element: <Navigate to="/pengaturan?tab=promo" replace /> },
              ...ruteMenu,
              ruteLazy('barang/import', 'Data Barang', 'master.import.jalankan', () =>
                import('@/features/barang/halaman-import-barang').then(
                  (m) => m.HalamanImportBarang,
                ),
              ),
              ruteLazy('penerimaan/baru', 'Penerimaan Barang', 'persediaan.penerimaan.kelola', () =>
                import('@/features/penerimaan/halaman-form-penerimaan').then(
                  (m) => m.HalamanFormPenerimaan,
                ),
              ),
              ruteLazy('penerimaan/:id', 'Penerimaan Barang', 'persediaan.penerimaan.kelola', () =>
                import('@/features/penerimaan/halaman-detail-penerimaan').then(
                  (m) => m.HalamanDetailPenerimaan,
                ),
              ),
              ruteLazy('konsinyasi/baru', 'Konsinyasi', 'konsinyasi.kelola', () =>
                import('@/features/konsinyasi/halaman-form-konsinyasi').then(
                  (m) => m.HalamanFormKonsinyasi,
                ),
              ),
              ruteLazy('konsinyasi/:id', 'Konsinyasi', 'konsinyasi.kelola', () =>
                import('@/features/konsinyasi/halaman-detail-konsinyasi').then(
                  (m) => m.HalamanDetailKonsinyasi,
                ),
              ),
              ruteLazy(
                'retur-pemasok/baru',
                'Retur ke Pemasok',
                'persediaan.retur_pemasok.kelola',
                () =>
                  import('@/features/retur-pemasok/halaman-form-retur-pemasok').then(
                    (m) => m.HalamanFormReturPemasok,
                  ),
              ),
              ruteLazy(
                'retur-pemasok/:id',
                'Retur ke Pemasok',
                'persediaan.retur_pemasok.kelola',
                () =>
                  import('@/features/retur-pemasok/halaman-detail-retur-pemasok').then(
                    (m) => m.HalamanDetailReturPemasok,
                  ),
              ),
              ruteLazy(
                'persediaan/penyesuaian/baru',
                'Stok Persediaan',
                'persediaan.penyesuaian.kelola',
                () =>
                  import('@/features/persediaan/halaman-penyesuaian').then(
                    (m) => m.HalamanPenyesuaian,
                  ),
              ),
              ruteLazy(
                'persediaan/penyesuaian/:id',
                'Stok Persediaan',
                'persediaan.stok.lihat',
                () =>
                  import('@/features/persediaan/halaman-penyesuaian').then(
                    (m) => m.HalamanPenyesuaian,
                  ),
              ),
              ruteLazy('penjualan/:id', 'Detail Penjualan', 'penjualan.riwayat.lihat', () =>
                import('@/features/kasir/halaman-detail-penjualan').then(
                  (m) => m.HalamanDetailPenjualan,
                ),
              ),
              ruteLazy('barang/label', 'Data Barang', 'master.barang.kelola', () =>
                import('@/features/barang/halaman-label').then((m) => m.HalamanLabel),
              ),
              ruteLazy('barang/baru', 'Data Barang', 'master.barang.kelola', muatFormBarang),
              ruteLazy('barang/:id', 'Data Barang', 'master.barang.kelola', muatFormBarang),
              {
                path: 'akun/password',
                element: <HalamanGantiPasswordAkun />,
                handle: { judul: 'Akun saya' },
              },
              {
                path: '*',
                element: <HalamanTidakDitemukan />,
                handle: { judul: 'Tidak ditemukan' },
              },
            ],
          },
        ],
      },
    ],
  },
]);
