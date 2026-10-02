import { eq } from 'drizzle-orm';
import {
  formatRupiah,
  subtotalRupiah,
  type BarisDaftarPenjualan,
  type DataCheckout,
  type DataPembayaran,
  type DetailPenjualan,
  type Izin,
  type MetaHalaman,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import {
  orderPenjualan,
  orderPenjualanDetail,
  penjualan,
  penjualanDetail,
} from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { siarkan } from '../../../lib/siaran';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tambahHari, tanggalOperasional } from '../../../lib/waktu';
import { shiftBuka } from '../../kas/shift/service';
import { hargaBarangDasar } from '../../master/harga/repo';
import { catatMutasi, kunciPersediaan, ubahReservasi } from '../../persediaan/ledger';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import * as orderRepo from '../order/repo';
import { buatOrderTx, ubahOrderTx } from '../order/service';
import { catatPembayaran, hitungTagihan } from '../pembayaran';
import * as sjRepo from '../surat-jalan/repo';
import { sisaKirim, suratJalanPenjualan } from '../surat-jalan/service';
import * as repo from './repo';

/*
 * Checkout & penjualan (docs/05 P1–P13, R6). Satu transaksi: order DIPROSES → penjualan + detail (snapshot harga
 * & HPP) → reservasi dilepas → mutasi PENJUALAN → pembayaran → status cache. Penjualan tidak pernah diubah barisnya
 * (P13); koreksi lewat void/retur (Fase 6).
 */

type Header = NonNullable<Awaited<ReturnType<typeof repo.penjualanById>>>;

function keRespons(h: Header): BarisDaftarPenjualan {
  return {
    id: h.id,
    nomor: h.nomor,
    tanggal: h.tanggal.toISOString(),
    tanggalOperasional: h.tanggalOperasional,
    jenisPenjualan: h.jenisPenjualan,
    idPelanggan: h.idPelanggan,
    namaPelanggan: h.namaPelanggan,
    namaPembeli: h.namaPembeli,
    namaKasir: h.namaKasir,
    totalNeto: h.totalNeto,
    totalDibayar: h.totalDibayar,
    sisaTagihan: h.sisaTagihan ?? 0,
    statusPembayaran: h.statusPembayaran,
    statusTransaksi: h.statusTransaksi,
    statusPengambilan: h.statusPengambilan,
    statusPengiriman: h.statusPengiriman,
    tanggalJatuhTempo: h.tanggalJatuhTempo,
  };
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Penjualan tidak ditemukan.', 404);
}

export async function daftarPenjualan(
  p: repo.SaringPenjualan & { halaman: number; perHalaman: number },
): Promise<{ data: BarisDaftarPenjualan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftarPenjualan(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

export async function detailPenjualan(
  id: number,
  izin: ReadonlySet<Izin>,
): Promise<DetailPenjualan> {
  const h = await repo.penjualanById(db, id);
  if (!h) throw tidakDitemukan();
  const lihatHpp = izin.has('master.barang.lihat_hpp');
  const kirim = new Map((await sjRepo.qtyBaris(db, id)).map((b) => [b.id, b]));
  const baris = (await repo.detailPenjualan(db, id)).map(({ hppSaatTransaksi, ...b }) => {
    const k = kirim.get(b.id);
    const umum = {
      ...b,
      qtyDikirim: k?.qtyDikirim ?? '0.000',
      qtyTerkirim: k?.qtyTerkirim ?? '0.000',
      qtyBelumDikirim: k ? sisaKirim(k) : '0.000',
    };
    return lihatHpp ? { ...umum, hppSaatTransaksi } : umum;
  });
  const bayar = await repo.pembayaran(db, id);
  return {
    ...keRespons(h),
    nomorOrder: h.nomorOrder,
    idOrder: h.idOrder,
    nomorShift: h.nomorShift,
    alamatKirim: h.alamatKirim,
    catatanKirim: h.catatanKirim,
    catatan: h.catatan,
    bayarSaatTerima: h.bayarSaatTerima,
    noHpPelanggan: h.noHpPelanggan,
    totalBruto: h.totalBruto,
    totalDiskon: h.totalDiskon,
    diskonTransaksi: h.diskonTransaksi,
    ongkir: h.ongkir,
    totalVoid: h.totalVoid,
    totalRetur: h.totalRetur,
    totalRefund: h.totalRefund,
    baris,
    pembayaran: bayar.map((b) => ({ ...b, tanggal: b.tanggal.toISOString() })),
    suratJalan: h.jenisPenjualan === 'PENGANTARAN' ? await suratJalanPenjualan(id) : [],
  };
}

/** Order yang akan di-checkout: dikunci, milik kasir ini (MENUNGGU otomatis dikunci untuknya, R8). */
async function siapkanOrder(tx: Tx, input: DataCheckout, pelaku: PenggunaAktif, asal: AsalRequest) {
  let idOrder: number;
  if (input.idOrder !== null) {
    idOrder = input.idOrder;
    // K-073: kasir mengubah isi order saat checkout (R4) dalam transaksi yang sama.
    if (input.order) await ubahOrderTx(tx, idOrder, input.order, pelaku, asal);
  } else if (input.order) {
    idOrder = (await buatOrderTx(tx, input.order, { kirim: true }, pelaku, asal)).id;
  } else {
    throw new AppError('VALIDASI', 'Pilih order dari antrean atau isi keranjang.', 400);
  }
  const o = await orderRepo.kunciOrder(tx, idOrder);
  if (!o) throw new AppError('TIDAK_DITEMUKAN', 'Order tidak ditemukan.', 404);
  if (o.status === 'DIPROSES' && o.idKasirProses !== pelaku.id) {
    throw new AppError('KONFLIK', `Order ${o.nomor} sedang diproses kasir lain.`, 409);
  }
  if (o.status !== 'MENUNGGU' && o.status !== 'DIPROSES') {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Order ${o.nomor} berstatus ${o.status.toLowerCase()}; tidak bisa di-checkout.`,
      409,
    );
  }
  const h = await orderRepo.orderById(tx, idOrder);
  if (!h) throw new Error('order hilang setelah dikunci');
  const rows = await orderRepo.detailOrder(tx, idOrder);
  return { o, h, rows };
}

/**
 * P2: "Perbarui harga" per baris — harga tier dibaca ulang dari master; subtotal & total order dihitung ulang.
 * Dicatat log ORDER_UBAH. Harga manual tidak ikut diperbarui.
 */
async function perbaruiHarga(
  tx: Tx,
  ctx: Awaited<ReturnType<typeof siapkanOrder>>,
  idBarang: number[],
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  if (idBarang.length === 0) return ctx.rows;
  const kini = new Map(
    (await hargaBarangDasar(tx, idBarang)).map((h) => [`${h.idBarang}:${h.idTingkatHarga}`, h]),
  );
  const catatan: string[] = [];
  const rows = [];
  for (const r of ctx.rows) {
    const h = kini.get(`${r.idBarang}:${r.idTingkatHarga}`);
    if (!idBarang.includes(r.idBarang) || r.hargaManual || !h || h.hargaJual === r.hargaSatuan) {
      rows.push(r);
      continue;
    }
    const bruto = subtotalRupiah(r.qty, h.hargaJual);
    if (r.diskonBaris > bruto) {
      throw new AppError('VALIDASI', `Diskon ${r.namaBarang} melebihi harga baru.`, 400);
    }
    const subtotal = bruto - r.diskonBaris;
    await tx
      .update(orderPenjualanDetail)
      .set({ hargaSatuan: h.hargaJual, subtotal, diubahPada: sekarang() })
      .where(eq(orderPenjualanDetail.id, r.id));
    catatan.push(`${r.namaBarang} ${formatRupiah(r.hargaSatuan)} → ${formatRupiah(h.hargaJual)}`);
    rows.push({ ...r, hargaSatuan: h.hargaJual, subtotal });
  }
  if (catatan.length > 0) {
    const sub = rows.reduce((t, r) => t + r.subtotal, 0);
    if (ctx.h.diskonTransaksi > sub) {
      throw new AppError(
        'VALIDASI',
        'Diskon transaksi melebihi subtotal setelah harga diperbarui.',
        400,
      );
    }
    await tx
      .update(orderPenjualan)
      .set({
        subtotal: sub,
        total: sub - ctx.h.diskonTransaksi + ctx.h.ongkir,
        diubahPada: sekarang(),
      })
      .where(eq(orderPenjualan.id, ctx.o.id));
    await catatLog(tx, {
      aksi: 'ORDER_UBAH',
      idPengguna: pelaku.id,
      entitas: 'order_penjualan',
      idEntitas: ctx.o.id,
      nomorDokumen: ctx.o.nomor,
      ringkasan: `Perbarui harga saat checkout: ${catatan.join('; ')}`,
      ip: asal.ip,
    });
  }
  return rows;
}

/** P7: jatuh tempo bawaan = tanggal operasional + term pelanggan (term 0 → + jatuh_tempo_default_hari). */
async function jatuhTempoBawaan(tx: Tx, idPelanggan: number, tanggal: string): Promise<string> {
  const term = await repo.termPelanggan(tx, idPelanggan);
  const hari = term > 0 ? term : await ambilAngka('jatuh_tempo_default_hari', 7, tx);
  return tambahHari(tanggal, hari);
}

export async function checkout(
  input: DataCheckout,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenjualan> {
  const id = await dalamTransaksi(async (tx) => {
    const ctx = await siapkanOrder(tx, input, pelaku, asal);
    const rows = await perbaruiHarga(tx, ctx, input.perbaruiHarga, pelaku, asal);
    const { h } = ctx;
    const jenis = h.jenisPenjualan;

    const totalBruto = rows.reduce((t, r) => t + subtotalRupiah(r.qty, r.hargaSatuan), 0);
    const diskonBaris = rows.reduce((t, r) => t + r.diskonBaris, 0);
    const totalNeto = totalBruto - diskonBaris - h.diskonTransaksi + h.ongkir;
    if (input.bayarSaatTerima && jenis !== 'PENGANTARAN') {
      throw new AppError('VALIDASI', 'Bayar saat terima hanya untuk pengantaran.', 400);
    }

    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, jenis === 'LANGSUNG' ? 'STR' : 'INV', tanggal);
    const shift = await shiftBuka(tx, pelaku.id, true);
    const [pj] = await tx
      .insert(penjualan)
      .values({
        nomor,
        tanggalOperasional: tanggal,
        jenisPenjualan: jenis,
        idOrder: h.id,
        idPelanggan: h.idPelanggan,
        namaPembeli: h.namaPembeli,
        idKasir: pelaku.id,
        idShift: shift?.id ?? null,
        totalBruto,
        totalDiskon: diskonBaris + h.diskonTransaksi,
        diskonTransaksi: h.diskonTransaksi,
        ongkir: h.ongkir,
        totalNeto,
        bayarSaatTerima: input.bayarSaatTerima,
        statusPengambilan: jenis === 'LANGSUNG' ? input.statusPengambilan : null,
        statusPengiriman: jenis === 'PENGANTARAN' ? 'BELUM' : null,
        alamatKirim: h.alamatKirim,
        catatanKirim: h.catatanKirim,
        catatan: input.catatan ?? h.catatan,
      })
      .returning({ id: penjualan.id });
    if (!pj) throw new Error('insert penjualan tidak mengembalikan id');

    // R6: lepas reservasi, lalu potong stok fisik per baris (urut id barang agar urutan kunci konsisten).
    await ubahReservasi(
      tx,
      rows.map((r) => ({ idBarang: r.idBarang, delta: `-${r.qtyDasar}` })),
    );
    for (const r of [...rows].sort((a, b) => a.idBarang - b.idBarang)) {
      const p = await kunciPersediaan(tx, r.idBarang);
      const [d] = await tx
        .insert(penjualanDetail)
        .values({
          idPenjualan: pj.id,
          idBarang: r.idBarang,
          qty: r.qty,
          qtyDasar: r.qtyDasar,
          idTingkatHarga: r.idTingkatHarga,
          hargaSatuan: r.hargaSatuan,
          hargaManual: r.hargaManual,
          diskonBaris: r.diskonBaris,
          subtotal: r.subtotal,
          // P5: HPP saat checkout (konsinyasi: hpp_rata2 = harga titip, L7).
          hppSaatTransaksi: p.hppRata2,
        })
        .returning({ id: penjualanDetail.id });
      if (!d) throw new Error('insert detail penjualan tidak mengembalikan id');
      await catatMutasi(tx, {
        idBarang: r.idBarang,
        jenis: 'PENJUALAN',
        qtyKeluar: r.qtyDasar,
        sumber: { idPenjualanDetail: d.id },
        idPengguna: pelaku.id,
        tanggalOperasional: tanggal,
        keterangan: `Penjualan ${nomor}`,
      });
    }

    const waktu = sekarang();
    await tx
      .update(orderPenjualan)
      .set({ status: 'SELESAI', idPenjualan: pj.id, idKasirProses: pelaku.id, diubahPada: waktu })
      .where(eq(orderPenjualan.id, h.id));

    const hasil = await catatPembayaran(
      tx,
      { id: pj.id, nomor, totalNeto, totalVoid: 0, totalRetur: 0, totalDibayar: 0, totalRefund: 0 },
      input.pembayaran,
      pelaku,
      asal,
    );
    if (hasil.statusPembayaran !== 'LUNAS' && h.idPelanggan === null) {
      // P6: pembeli umum wajib lunas saat checkout (seluruh transaksi dibatalkan).
      throw new AppError(
        'VALIDASI',
        `Pembeli umum wajib lunas: kurang ${formatRupiah(hitungTagihan(hasil).sisa)}. Pilih pelanggan terdata untuk piutang.`,
        400,
      );
    }
    if (hasil.statusPembayaran !== 'LUNAS') {
      // PT2: jatuh tempo wajib bila belum lunas (default P7).
      const jatuhTempo =
        input.tanggalJatuhTempo ?? (await jatuhTempoBawaan(tx, h.idPelanggan ?? 0, tanggal));
      await tx
        .update(penjualan)
        .set({ tanggalJatuhTempo: jatuhTempo })
        .where(eq(penjualan.id, pj.id));
    }
    await catatLog(tx, {
      aksi: 'PENJUALAN_CHECKOUT',
      idPengguna: pelaku.id,
      entitas: 'penjualan',
      idEntitas: pj.id,
      nomorDokumen: nomor,
      ringkasan:
        `Checkout ${nomor} dari order ${h.nomor}: ${rows.length} barang, ${formatRupiah(totalNeto)}, ` +
        `${hasil.statusPembayaran.toLowerCase().replace('_', ' ')}`,
      ip: asal.ip,
    });
    return pj.id;
  });
  siarkan('antrean');
  return detailPenjualan(id, pelaku.izin);
}

/** P8: pembayaran susulan (DP lanjutan / pelunasan / bayar saat terima). */
export async function bayarPenjualan(
  id: number,
  input: DataPembayaran,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenjualan> {
  await dalamTransaksi(async (tx) => {
    const pj = await repo.kunciPenjualan(tx, id);
    if (!pj) throw tidakDitemukan();
    if (pj.statusTransaksi === 'VOID') {
      throw new AppError('STATUS_TIDAK_VALID', `Penjualan ${pj.nomor} sudah di-void.`, 409);
    }
    if (hitungTagihan(pj).sisa <= 0) {
      throw new AppError('STATUS_TIDAK_VALID', `Penjualan ${pj.nomor} sudah lunas.`, 409);
    }
    await catatPembayaran(tx, pj, [input], pelaku, asal);
  });
  return detailPenjualan(id, pelaku.izin);
}

/** P11: barang yang ditinggal di toko sudah diambil pembeli. */
export async function tandaiDiambil(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenjualan> {
  await dalamTransaksi(async (tx) => {
    const pj = await repo.kunciPenjualan(tx, id);
    if (!pj) throw tidakDitemukan();
    if (pj.statusPengambilan !== 'BELUM_DIAMBIL') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Penjualan ${pj.nomor} tidak berstatus belum diambil.`,
        409,
      );
    }
    await tx
      .update(penjualan)
      .set({ statusPengambilan: 'DIAMBIL', diubahPada: sekarang() })
      .where(eq(penjualan.id, id));
    await catatLog(tx, {
      aksi: 'PENJUALAN_DIAMBIL',
      idPengguna: pelaku.id,
      entitas: 'penjualan',
      idEntitas: id,
      nomorDokumen: pj.nomor,
      ringkasan: `Barang ${pj.nomor} sudah diambil pembeli`,
      ip: asal.ip,
    });
  });
  return detailPenjualan(id, pelaku.izin);
}

/** P10: cetak ulang struk/invoice dicatat log. */
export async function catatCetakUlang(id: number, pelaku: PenggunaAktif, asal: AsalRequest) {
  const h = await repo.penjualanById(db, id);
  if (!h) throw tidakDitemukan();
  await catatLog(db, {
    aksi: 'CETAK_ULANG',
    idPengguna: pelaku.id,
    entitas: 'penjualan',
    idEntitas: id,
    nomorDokumen: h.nomor,
    ringkasan: `Cetak ulang ${h.jenisPenjualan === 'LANGSUNG' ? 'struk' : 'invoice'} ${h.nomor}`,
    ip: asal.ip,
  });
}
