import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { Layout } from '@/components/layout/layout';
import { WajibIzin, WajibLogin } from '@/components/penjaga-rute';
import {
  HalamanGantiPasswordAkun,
  HalamanWajibGantiPassword,
} from '@/features/auth/halaman-ganti-password';
import { HalamanLogin } from '@/features/auth/halaman-login';
import { HalamanBarang } from '@/features/barang/halaman-barang';
import { HalamanFormBarang } from '@/features/barang/halaman-form-barang';
import { HalamanImportBarang } from '@/features/barang/halaman-import-barang';
import { HalamanBeranda } from '@/features/beranda/halaman-beranda';
import { HalamanHargaJual } from '@/features/harga-jual/halaman-harga-jual';
import { HalamanPelanggan } from '@/features/pelanggan/halaman-pelanggan';
import { HalamanPemasok } from '@/features/pemasok/halaman-pemasok';
import { HalamanPengaturan } from '@/features/pengaturan/halaman-pengaturan';
import { HalamanPengguna } from '@/features/pengguna/halaman-pengguna';
import { HalamanReferensi } from '@/features/referensi/halaman-referensi';
import { HalamanSegera } from '@/features/umum/halaman-segera';
import { HalamanTidakDitemukan } from '@/features/umum/halaman-tidak-ditemukan';
import { SEMUA_ITEM_MENU } from '@/lib/menu';

/** Halaman yang sudah dibangun, per path menu. Path lain menampilkan "sedang disiapkan". */
const HALAMAN: Record<string, ReactNode> = {
  '/dashboard': <HalamanBeranda />,
  '/barang': <HalamanBarang />,
  '/harga-jual': <HalamanHargaJual />,
  '/kategori-satuan': <HalamanReferensi />,
  '/pelanggan': <HalamanPelanggan />,
  '/pemasok': <HalamanPemasok />,
  '/pengguna': <HalamanPengguna />,
  '/pengaturan': <HalamanPengaturan />,
};

const ruteMenu: RouteObject[] = SEMUA_ITEM_MENU.map((item) => ({
  path: item.path.slice(1),
  handle: { judul: item.label },
  element: (
    <WajibIzin izin={item.izin}>{HALAMAN[item.path] ?? <HalamanSegera item={item} />}</WajibIzin>
  ),
}));

/** Semua halaman. `handle.judul` tampil di topbar dan judul tab browser. */
export const router = createBrowserRouter([
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
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...ruteMenu,
      {
        path: 'barang/import',
        handle: { judul: 'Data Barang' },
        element: (
          <WajibIzin izin="master.import.jalankan">
            <HalamanImportBarang />
          </WajibIzin>
        ),
      },
      ...['barang/baru', 'barang/:id'].map((path) => ({
        path,
        handle: { judul: 'Data Barang' },
        element: (
          <WajibIzin izin="master.barang.kelola">
            <HalamanFormBarang />
          </WajibIzin>
        ),
      })),
      {
        path: 'akun/password',
        element: <HalamanGantiPasswordAkun />,
        handle: { judul: 'Ganti password' },
      },
      { path: '*', element: <HalamanTidakDitemukan />, handle: { judul: 'Tidak ditemukan' } },
    ],
  },
]);
