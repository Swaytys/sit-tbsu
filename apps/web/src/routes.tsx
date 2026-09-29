import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from '@/components/layout/layout';
import { HalamanSatuan } from '@/features/satuan/halaman-satuan';
import { HalamanTidakDitemukan } from '@/features/umum/halaman-tidak-ditemukan';

/** Semua halaman. `handle.judul` tampil di topbar dan judul tab browser. */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/satuan" replace /> },
      { path: 'satuan', element: <HalamanSatuan />, handle: { judul: 'Satuan' } },
      { path: '*', element: <HalamanTidakDitemukan />, handle: { judul: 'Tidak ditemukan' } },
    ],
  },
]);
