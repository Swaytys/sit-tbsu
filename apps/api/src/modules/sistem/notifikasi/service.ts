import type { Izin, Notifikasi } from '@sit/shared';
import { jumlahOrderBasi } from '../../penjualan/order/service';
import { piutangJatuhTempo } from '../../penjualan/piutang/service';
import { peringatanStok } from '../../persediaan/stok/service';

/** Notifikasi topbar per pengguna (docs/05 ST2), disaring menurut izin. */
export async function notifikasiPengguna(izin: ReadonlySet<Izin>): Promise<Notifikasi[]> {
  const hasil: Notifikasi[] = [];
  if (izin.has('penjualan.order.lihat_semua')) {
    const basi = await jumlahOrderBasi();
    if (basi > 0) {
      hasil.push({
        jenis: 'ORDER_BASI',
        judul: 'Order basi',
        keterangan: `${basi} order menunggu terlalu lama dan masih menahan stok.`,
        jumlah: basi,
        tautan: '/order?status=MENUNGGU',
      });
    }
  }
  if (izin.has('penjualan.piutang.lihat')) {
    const p = await piutangJatuhTempo();
    if (p.terlambat > 0) {
      hasil.push({
        jenis: 'PIUTANG_TERLAMBAT',
        judul: 'Piutang terlambat',
        keterangan: `${p.terlambat} piutang melewati jatuh tempo.`,
        jumlah: p.terlambat,
        tautan: '/piutang?terlambat=true',
      });
    }
    if (p.segera > 0) {
      hasil.push({
        jenis: 'PIUTANG_JATUH_TEMPO',
        judul: 'Piutang segera jatuh tempo',
        keterangan: `${p.segera} piutang jatuh tempo dalam 3 hari.`,
        jumlah: p.segera,
        tautan: '/piutang',
      });
    }
  }
  if (izin.has('persediaan.stok.lihat')) {
    const s = await peringatanStok(0);
    if (s.habis > 0) {
      hasil.push({
        jenis: 'STOK_HABIS',
        judul: 'Stok habis',
        keterangan: `${s.habis} barang aktif stoknya 0.`,
        jumlah: s.habis,
        tautan: '/persediaan?tab=posisi&status=HABIS',
      });
    }
    if (s.kritis > 0) {
      hasil.push({
        jenis: 'STOK_KRITIS',
        judul: 'Stok kritis',
        keterangan: `${s.kritis} barang di bawah stok minimum.`,
        jumlah: s.kritis,
        tautan: '/persediaan?tab=posisi&status=KRITIS',
      });
    }
  }
  return hasil;
}
