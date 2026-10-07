import type { Izin, Notifikasi } from '@sit/shared';
import { hutangJatuhTempo } from '../../hutang/service';
import { jumlahReturMenunggu } from '../../koreksi/retur/service';
import { jumlahVoidMenunggu } from '../../koreksi/void/service';
import { jumlahOrderBasi } from '../../penjualan/order/service';
import { piutangJatuhTempo } from '../../penjualan/piutang/service';
import { peringatanStok } from '../../persediaan/stok/service';
import { peringatanCadangan } from '../cadangan/service';

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
  if (izin.has('sistem.cadangan.kelola')) {
    const p = await peringatanCadangan();
    if (p.length > 0) {
      hasil.push({
        jenis: 'CADANGAN_BERMASALAH',
        judul: 'Cadangan data perlu diperiksa',
        keterangan: p[0]!,
        jumlah: p.length,
        tautan: '/pengaturan?tab=cadangan',
      });
    }
  }
  if (izin.has('void.setujui')) {
    const n = await jumlahVoidMenunggu();
    if (n > 0) {
      hasil.push({
        jenis: 'VOID_MENUNGGU',
        judul: 'Void menunggu persetujuan',
        keterangan: `${n} pengajuan void perlu diputuskan.`,
        jumlah: n,
        tautan: '/void?tab=persetujuan',
      });
    }
  }
  if (izin.has('retur.setujui')) {
    const n = await jumlahReturMenunggu();
    if (n > 0) {
      hasil.push({
        jenis: 'RETUR_MENUNGGU',
        judul: 'Retur menunggu persetujuan',
        keterangan: `${n} pengajuan retur perlu diputuskan.`,
        jumlah: n,
        tautan: '/retur?tab=persetujuan',
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
  if (izin.has('hutang.lihat')) {
    // HT4: hutang pemasok terlambat dan jatuh tempo dalam 3 hari.
    const h = await hutangJatuhTempo();
    if (h.terlambat > 0) {
      hasil.push({
        jenis: 'HUTANG_TERLAMBAT',
        judul: 'Hutang pemasok terlambat',
        keterangan: `${h.terlambat} hutang ke pemasok melewati jatuh tempo.`,
        jumlah: h.terlambat,
        tautan: '/hutang?terlambat=true',
      });
    }
    if (h.segera > 0) {
      hasil.push({
        jenis: 'HUTANG_JATUH_TEMPO',
        judul: 'Hutang pemasok segera jatuh tempo',
        keterangan: `${h.segera} hutang ke pemasok jatuh tempo dalam 3 hari.`,
        jumlah: h.segera,
        tautan: '/hutang',
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
