import { formatRupiah, teksQty, type InfoCepat, type Izin } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import {
  orderPenjualan,
  penjualan,
  perjalanan,
  returPenjualan,
  suratJalan,
  voidTransaksi,
} from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { PenggunaAktif } from '../../../lib/konteks';
import { waktuTeks } from '../../laporan/umum';
import { detailRetur } from '../../koreksi/retur/service';
import { detailVoid } from '../../koreksi/void/service';
import { detailOrder } from '../../penjualan/order/service';
import { detailPenjualan } from '../../penjualan/penjualan/service';
import { daftarPerjalanan } from '../../penjualan/perjalanan/service';
import { detailSuratJalan } from '../../penjualan/surat-jalan/service';

/*
 * K-181: info cepat dokumen dari nomornya. Dokumen dicari per tabel (nomor unik), lalu izin dicek sama dengan
 * halaman detailnya, sehingga info cepat tidak membuka data yang tidak boleh dilihat (field sensitif ikut saringan
 * service detail).
 */

const MAKS_BARANG = 12;
const rp = (n: number) => formatRupiah(n);
const qty = (q: string, s: string) => `${teksQty(q)} ${s}`;

function tolak(): never {
  throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin melihat dokumen ini.', 403);
}

function wajib(izin: ReadonlySet<Izin>, ...perlu: Izin[]): void {
  if (!perlu.some((i) => izin.has(i))) tolak();
}

async function cari<T extends { id: number }>(q: Promise<T[]>): Promise<number | null> {
  const [b] = await q;
  return b?.id ?? null;
}

export async function infoCepat(nomor: string, pelaku: PenggunaAktif): Promise<InfoCepat> {
  const n = nomor.trim().toUpperCase();
  const izin = pelaku.izin;

  const idPj = await cari(
    db.select({ id: penjualan.id }).from(penjualan).where(eq(penjualan.nomor, n)).limit(1),
  );
  if (idPj) {
    wajib(izin, 'penjualan.riwayat.lihat');
    const p = await detailPenjualan(idPj, izin);
    return {
      nomor: p.nomor,
      jenis: p.jenisPenjualan === 'PENGANTARAN' ? 'Invoice pengantaran' : 'Penjualan langsung',
      judul: p.namaPelanggan ?? p.namaPembeli ?? 'Pembeli umum',
      status: p.statusTransaksi === 'VOID' ? 'Void' : p.statusPembayaran,
      waktu: p.tanggal,
      ringkas: [
        { label: 'Total', nilai: rp(p.totalNeto) },
        { label: 'Dibayar', nilai: rp(p.totalDibayar) },
        { label: 'Sisa', nilai: rp(p.sisaTagihan) },
        { label: 'Kasir', nilai: p.namaKasir },
        ...(p.statusPengiriman ? [{ label: 'Pengiriman', nilai: p.statusPengiriman }] : []),
        ...(p.nomorOrder ? [{ label: 'Order', nilai: p.nomorOrder }] : []),
      ],
      barang: p.baris.slice(0, MAKS_BARANG).map((b) => ({
        nama: b.namaBarang,
        qty: qty(b.qty, b.kodeSatuan),
      })),
      tautan: `/penjualan/${p.id}`,
    };
  }

  const idOrd = await cari(
    db
      .select({ id: orderPenjualan.id })
      .from(orderPenjualan)
      .where(eq(orderPenjualan.nomor, n))
      .limit(1),
  );
  if (idOrd) {
    wajib(izin, 'penjualan.order.buat');
    const o = await detailOrder(idOrd, pelaku);
    return {
      nomor: o.nomor,
      jenis: 'Order penjualan',
      judul: o.namaPelanggan ?? o.namaPembeli ?? 'Pembeli umum',
      status: o.status,
      waktu: o.tanggal,
      ringkas: [
        { label: 'Total', nilai: rp(o.total) },
        { label: 'Dibuat', nilai: o.namaPengguna },
      ],
      barang: o.baris.slice(0, MAKS_BARANG).map((b) => ({
        nama: b.namaBarang,
        qty: qty(b.qty, b.kodeSatuan),
      })),
      tautan: `/order?id=${o.id}`,
    };
  }

  const idSj = await cari(
    db.select({ id: suratJalan.id }).from(suratJalan).where(eq(suratJalan.nomor, n)).limit(1),
  );
  if (idSj) {
    wajib(izin, 'penjualan.surat_jalan.kelola');
    const s = await detailSuratJalan(idSj);
    return {
      nomor: s.nomor,
      jenis: 'Surat jalan',
      judul: s.namaPenerima ?? s.namaPelanggan ?? 'Penerima',
      status: s.status,
      waktu: s.tanggal,
      ringkas: [
        { label: 'Invoice', nilai: s.nomorPenjualan },
        { label: 'Alamat', nilai: s.alamatKirim },
        { label: 'Sopir', nilai: s.sopir ?? '—' },
        { label: 'Kendaraan', nilai: s.kendaraan ?? '—' },
        ...(s.nomorPerjalanan ? [{ label: 'Rit', nilai: s.nomorPerjalanan }] : []),
      ],
      barang: s.baris.slice(0, MAKS_BARANG).map((b) => ({
        nama: b.namaBarang,
        qty: qty(b.qtyKirim, b.kodeSatuan),
      })),
      tautan: `/penjualan/${s.idPenjualan}`,
    };
  }

  const idRit = await cari(
    db.select({ id: perjalanan.id }).from(perjalanan).where(eq(perjalanan.nomor, n)).limit(1),
  );
  if (idRit) {
    wajib(izin, 'penjualan.surat_jalan.kelola');
    const [r] = (await daftarPerjalanan({ id: idRit, halaman: 1, perHalaman: 1 })).data;
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Dokumen tidak ditemukan.', 404);
    return {
      nomor: r.nomor,
      jenis: 'Rit pengantaran',
      judul: `${r.plat} · ${r.namaSopir}`,
      status: r.status,
      waktu: r.waktuBerangkat ?? r.jadwalBerangkat ?? '',
      ringkas: [
        { label: 'Surat jalan', nilai: String(r.suratJalan.length) },
        ...(r.waktuKembali ? [{ label: 'Kembali', nilai: waktuTeks(r.waktuKembali) }] : []),
      ],
      barang: r.suratJalan
        .slice(0, MAKS_BARANG)
        .map((s) => ({ nama: `${s.nomor} · ${s.namaPelanggan ?? '—'}`, qty: s.status })),
      tautan: '/pengiriman',
    };
  }

  const idRtr = await cari(
    db
      .select({ id: returPenjualan.id })
      .from(returPenjualan)
      .where(eq(returPenjualan.nomor, n))
      .limit(1),
  );
  if (idRtr) {
    wajib(izin, 'retur.ajukan');
    const r = await detailRetur(idRtr);
    return {
      nomor: r.nomor,
      jenis: 'Retur penjualan',
      judul: r.nomorPenjualan,
      status: r.status,
      waktu: r.tanggal,
      ringkas: [
        { label: 'Nilai', nilai: rp(r.totalRetur) },
        { label: 'Penyelesaian', nilai: r.penyelesaian },
        { label: 'Alasan', nilai: r.alasan },
        { label: 'Diajukan', nilai: r.namaPengaju },
      ],
      barang: r.baris.slice(0, MAKS_BARANG).map((b) => ({
        nama: b.namaBarang,
        qty: qty(b.qtyRetur, b.kodeSatuan),
      })),
      tautan: '/retur?tab=riwayat',
    };
  }

  const idVd = await cari(
    db
      .select({ id: voidTransaksi.id })
      .from(voidTransaksi)
      .where(eq(voidTransaksi.nomor, n))
      .limit(1),
  );
  if (idVd) {
    wajib(izin, 'void.ajukan');
    const v = await detailVoid(idVd);
    return {
      nomor: v.nomor,
      jenis: 'Void',
      judul: v.nomorPenjualan,
      status: v.status,
      waktu: v.tanggal,
      ringkas: [
        { label: 'Nilai', nilai: rp(v.nominalVoid) },
        { label: 'Refund', nilai: rp(v.nominalRefund) },
        { label: 'Alasan', nilai: v.alasan },
        { label: 'Diajukan', nilai: v.namaPengaju },
      ],
      barang: [],
      tautan: '/void?tab=riwayat',
    };
  }

  throw new AppError('TIDAK_DITEMUKAN', `Dokumen ${n} tidak ditemukan.`, 404);
}
