import React from 'react';
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MasterBarang } from './pages/MasterBarang';
import { DataPelanggan } from './pages/DataPelanggan';
import { DataPemasok } from './pages/DataPemasok';
import { DataPengguna } from './pages/DataPengguna';
import { OrderPenjualan } from './pages/OrderPenjualan';
import { PenjualanLangsung } from './pages/PenjualanLangsung';
import { PenjualanPengantaran } from './pages/PenjualanPengantaran';
import { ReturPenjualan } from './pages/ReturPenjualan';
import { VoidTransaksi } from './pages/VoidTransaksi';
import { Persediaan } from './pages/Persediaan';
import { PenerimaanBarang } from './pages/PenerimaanBarang';
import { ClericalCheck } from './pages/ClericalCheck';
import { LaporanOperasional } from './pages/LaporanOperasional';
import { Pengaturan } from './pages/Pengaturan';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Dashboard /> },
      // Data Master
      { path: 'master-barang', element: <MasterBarang /> },
      { path: 'data-pelanggan', element: <DataPelanggan /> },
      { path: 'data-pemasok', element: <DataPemasok /> },
      { path: 'data-pengguna', element: <DataPengguna /> },
      // Transaksi Penjualan
      { path: 'order-penjualan', element: <OrderPenjualan /> },
      { path: 'penjualan-langsung', element: <PenjualanLangsung /> },
      { path: 'penjualan-pengantaran', element: <PenjualanPengantaran /> },
      { path: 'retur', element: <ReturPenjualan /> },
      { path: 'void-transaksi', element: <VoidTransaksi /> },
      // Persediaan
      { path: 'penerimaan', element: <PenerimaanBarang /> },
      { path: 'persediaan', element: <Persediaan /> },
      // Lainnya
      { path: 'clerical-check', element: <ClericalCheck /> },
      { path: 'laporan', element: <LaporanOperasional /> },
      { path: 'pengaturan', element: <Pengaturan /> },
    ],
  },
]);
