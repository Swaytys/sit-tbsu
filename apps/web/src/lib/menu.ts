import type { Izin, PenggunaSaya } from '@sit/shared';
import {
  Boxes,
  Building2,
  Calculator,
  Car,
  Download,
  FileText,
  HandCoins,
  KanbanSquare,
  Handshake,
  LayoutDashboard,
  Package,
  PackageX,
  Ruler,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  Truck,
  Undo2,
  UserCheck,
  Users,
  Wallet,
  Warehouse,
  XCircle,
  type LucideIcon,
  ChartColumnBig,
  ClipboardList,
} from 'lucide-react';

/*
 * Menu sidebar dan izin pembukanya (docs/04 §4). Menu hanya menyembunyikan; API tetap penjaga utama.
 * `fase` diisi untuk halaman yang belum dibangun: rutenya menampilkan "sedang disiapkan".
 */

export type ItemMenu = {
  path: string;
  label: string;
  ikon: LucideIcon;
  /** Satu izin, atau daftar izin yang cukup salah satunya dimiliki. */
  izin: Izin | readonly Izin[];
  fase?: number;
};

export type GrupMenu = { id: string; label: string; ikon: LucideIcon; item: ItemMenu[] };

export type EntriMenu = ({ jenis: 'item' } & ItemMenu) | ({ jenis: 'grup' } & GrupMenu);

export const MENU: EntriMenu[] = [
  {
    jenis: 'item',
    path: '/dashboard',
    label: 'Dashboard',
    ikon: LayoutDashboard,
    izin: 'dashboard.dasar',
  },
  {
    jenis: 'grup',
    id: 'data-master',
    label: 'Data Master',
    ikon: Package,
    item: [
      { path: '/barang', label: 'Data Barang', ikon: Boxes, izin: 'master.barang.kelola', fase: 3 },
      {
        path: '/pelanggan',
        label: 'Data Pelanggan',
        ikon: UserCheck,
        izin: 'master.pelanggan.lihat',
        fase: 3,
      },
      {
        path: '/pemasok',
        label: 'Data Pemasok',
        ikon: Building2,
        izin: 'master.pemasok.lihat',
        fase: 3,
      },
      {
        path: '/pengguna',
        label: 'Data Pengguna',
        ikon: Users,
        izin: 'master.pengguna.kelola',
      },
      {
        path: '/referensi',
        label: 'Referensi Barang',
        ikon: Ruler,
        izin: 'master.kategori.kelola',
      },
      { path: '/harga-jual', label: 'Harga Jual', ikon: Tag, izin: 'master.harga.kelola', fase: 3 },
    ],
  },
  {
    jenis: 'grup',
    id: 'transaksi',
    label: 'Transaksi',
    ikon: ShoppingCart,
    item: [
      {
        path: '/order',
        label: 'Order Penjualan',
        ikon: ShoppingCart,
        izin: 'penjualan.order.buat',
        fase: 5,
      },
      {
        path: '/penjualan-langsung',
        label: 'Penjualan Langsung',
        ikon: Store,
        izin: 'penjualan.checkout',
        fase: 5,
      },
      {
        path: '/penjualan-pengantaran',
        label: 'Penjualan Pengantaran',
        ikon: Truck,
        izin: 'penjualan.checkout',
        fase: 5,
      },
      {
        path: '/piutang',
        label: 'Piutang',
        ikon: Wallet,
        izin: 'penjualan.piutang.lihat',
        fase: 5,
      },
      {
        path: '/hasil-penjualan',
        label: 'Hasil Penjualan',
        ikon: ChartColumnBig,
        izin: 'laporan.penjualan',
        fase: 14,
      },
      { path: '/retur', label: 'Retur Penjualan', ikon: Undo2, izin: 'retur.ajukan', fase: 6 },
      { path: '/void', label: 'Void Transaksi', ikon: XCircle, izin: 'void.ajukan', fase: 6 },
    ],
  },
  {
    jenis: 'grup',
    id: 'logistik',
    label: 'Logistik',
    ikon: Truck,
    item: [
      {
        path: '/pengiriman',
        label: 'Pengiriman',
        ikon: KanbanSquare,
        izin: 'penjualan.surat_jalan.kelola',
      },
      {
        path: '/armada',
        label: 'Kendaraan & Sopir',
        ikon: Car,
        izin: ['master.armada.kelola', 'penjualan.surat_jalan.kelola'],
      },
    ],
  },
  {
    jenis: 'grup',
    id: 'persediaan',
    label: 'Persediaan',
    ikon: Warehouse,
    item: [
      {
        path: '/order-pembelian',
        label: 'Order Pembelian',
        ikon: ClipboardList,
        izin: 'persediaan.penerimaan.kelola',
        fase: 14,
      },
      {
        path: '/penerimaan',
        label: 'Penerimaan Barang',
        ikon: Download,
        izin: 'persediaan.penerimaan.kelola',
        fase: 4,
      },
      {
        path: '/persediaan',
        label: 'Stok Persediaan',
        ikon: Boxes,
        izin: 'persediaan.stok.lihat',
        fase: 4,
      },
      {
        path: '/retur-pemasok',
        label: 'Retur ke Pemasok',
        ikon: PackageX,
        izin: 'persediaan.retur_pemasok.kelola',
      },
      { path: '/hutang', label: 'Hutang Pemasok', ikon: HandCoins, izin: 'hutang.lihat' },
      { path: '/konsinyasi', label: 'Konsinyasi', ikon: Handshake, izin: 'konsinyasi.kelola' },
    ],
  },
  {
    jenis: 'item',
    path: '/shift',
    label: 'Shift & Clerical Check',
    ikon: Calculator,
    izin: 'kas.shift.kelola_sendiri',
    fase: 6,
  },
  {
    jenis: 'item',
    path: '/laporan',
    label: 'Laporan',
    ikon: FileText,
    izin: ['laporan.penjualan', 'laporan.persediaan'],
  },
  {
    jenis: 'item',
    path: '/pengaturan',
    label: 'Pengaturan',
    ikon: Settings,
    // K-225: Administrator Sistem membuka Pengaturan untuk Cadangan dan Akses HP/tablet.
    izin: ['sistem.pengaturan.kelola', 'sistem.cadangan.kelola', 'sistem.akses.kelola'],
  },
];

/** Semua halaman menu dalam satu daftar datar. */
export const SEMUA_ITEM_MENU: ItemMenu[] = MENU.flatMap((e) => (e.jenis === 'grup' ? e.item : [e]));

/** Pengguna memiliki izin (atau salah satu dari daftar izin). */
export function bolehAkses(pengguna: PenggunaSaya, izin: Izin | readonly Izin[]): boolean {
  const daftar: readonly Izin[] = typeof izin === 'string' ? [izin] : izin;
  return daftar.some((i) => pengguna.izin.includes(i));
}

/** Menu yang tampil untuk pengguna: item tanpa izin disembunyikan, grup kosong dihilangkan. */
export function menuUntuk(pengguna: PenggunaSaya): EntriMenu[] {
  return MENU.flatMap((e): EntriMenu[] => {
    if (e.jenis === 'item') return bolehAkses(pengguna, e.izin) ? [e] : [];
    const item = e.item.filter((i) => bolehAkses(pengguna, i.izin));
    return item.length > 0 ? [{ ...e, item }] : [];
  });
}

export const NAMA_FASE: Record<number, string> = {
  2: 'Akses dasar',
  3: 'Data master',
  4: 'Inti persediaan',
  5: 'Penjualan',
  6: 'Koreksi dan kontrol',
  7: 'Laporan dan dashboard',
};
