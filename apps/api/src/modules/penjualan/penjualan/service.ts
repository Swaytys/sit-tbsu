import { eq } from 'drizzle-orm';
import {
  formatRupiah,
  rapikanDesimal,
  subtotalRupiah,
  type BarisDaftarPenjualan,
  type DataCheckout,
  type DataMintaKodeLimit,
  type DataPembayaran,
  type DetailPenjualan,
  type InfoKodePersetujuan,
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
import { mintaKode, pakaiKode, periksaKode } from '../../sistem/kode-persetujuan/service';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import * as orderRepo from '../order/repo';
import { muatSatuanJual } from '../../master/satuan-jual/service';
import { hitungPromoCheckout } from '../harga-baris';
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
      faktor: rapikanDesimal(b.faktor),
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

type BarisOrder = Awaited<ReturnType<typeof siapkanOrder>>['rows'][number];

/**
 * P2: "Perbarui harga" per baris — harga tier barang terpilih dibaca ulang dari master (harga manual tidak).
 * Belum menulis apa pun; penulisan bersama hasil promo di `selaraskanOrder()`.
 */
async function hargaTerkini(tx: Tx, rows: BarisOrder[], idBarang: number[]) {
  const catatan: string[] = [];
  if (idBarang.length === 0) return { rows, catatan };
  const kini = new Map(
    (await hargaBarangDasar(tx, idBarang)).map((h) => [
      `${h.idBarang}:${h.idTingkatHarga}`,
      h.hargaJual,
    ]),
  );
  // K-091: harga satuan jual (tetap, atau otomatis dari satuan dasar × faktor).
  for (const daftar of (await muatSatuanJual(tx, idBarang)).values()) {
    for (const s of daftar)
      for (const h of s.harga) kini.set(`${s.id}#${h.idTingkatHarga}`, h.hargaJual);
  }
  const hasil = rows.map((r) => {
    const hargaBaru = kini.get(
      r.idSatuanJual === null
        ? `${r.idBarang}:${r.idTingkatHarga}`
        : `${r.idSatuanJual}#${r.idTingkatHarga}`,
    );
    if (
      !idBarang.includes(r.idBarang) ||
      r.hargaManual ||
      hargaBaru === undefined ||
      hargaBaru === r.hargaSatuan
    ) {
      return r;
    }
    if (r.diskonBaris > subtotalRupiah(r.qty, hargaBaru)) {
      throw new AppError('VALIDASI', `Diskon ${r.namaBarang} melebihi harga baru.`, 400);
    }
    catatan.push(`${r.namaBarang} ${formatRupiah(r.hargaSatuan)} → ${formatRupiah(hargaBaru)}`);
    return { ...r, hargaSatuan: hargaBaru };
  });
  return { rows: hasil, catatan };
}

/**
 * Baris order yang berubah karena "perbarui harga" (P2) atau evaluasi ulang promo (PR5) ditulis ke order
 * dalam transaksi checkout yang sama (aturan 15), beserta subtotal/total header. Log ORDER_UBAH untuk
 * perubahan harga.
 */
async function selaraskanOrder(
  tx: Tx,
  ctx: Awaited<ReturnType<typeof siapkanOrder>>,
  rows: BarisOrder[],
  catatanHarga: string[],
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  const awal = new Map(ctx.rows.map((r) => [r.id, r]));
  const waktu = sekarang();
  let berubah = false;
  for (const r of rows) {
    const a = awal.get(r.id);
    if (
      a &&
      a.hargaSatuan === r.hargaSatuan &&
      a.idPromo === r.idPromo &&
      a.diskonPromo === r.diskonPromo &&
      a.subtotal === r.subtotal
    ) {
      continue;
    }
    berubah = true;
    await tx
      .update(orderPenjualanDetail)
      .set({
        hargaSatuan: r.hargaSatuan,
        idPromo: r.idPromo,
        diskonPromo: r.diskonPromo,
        subtotal: r.subtotal,
        diubahPada: waktu,
      })
      .where(eq(orderPenjualanDetail.id, r.id));
  }
  if (berubah) {
    const sub = rows.reduce((t, r) => t + r.subtotal, 0);
    await tx
      .update(orderPenjualan)
      .set({ subtotal: sub, total: sub - ctx.h.diskonTransaksi + ctx.h.ongkir, diubahPada: waktu })
      .where(eq(orderPenjualan.id, ctx.o.id));
  }
  if (catatanHarga.length > 0) {
    await catatLog(tx, {
      aksi: 'ORDER_UBAH',
      idPengguna: pelaku.id,
      entitas: 'order_penjualan',
      idEntitas: ctx.o.id,
      nomorDokumen: ctx.o.nomor,
      ringkasan: `Perbarui harga saat checkout: ${catatanHarga.join('; ')}`,
      ip: asal.ip,
    });
  }
}

/**
 * PT6 (K-102): Kasir meminta kode sekali pakai kepada Admin/Owner untuk penjualan tidak lunas yang melewati
 * limit kredit. Limit dan piutang berjalan dibaca dari database; `tagihanBaru` adalah batas atas yang
 * disetujui (checkout menolak bila tagihannya ternyata lebih besar).
 */
export async function mintaKodeLimit(
  input: DataMintaKodeLimit,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<InfoKodePersetujuan> {
  const kredit = await dalamTransaksi((tx) => repo.posisiKredit(tx, input.idPelanggan, 0));
  if (kredit.limit === null || kredit.piutangBerjalan + input.tagihanBaru <= kredit.limit) {
    throw new AppError(
      'VALIDASI',
      'Penjualan ini tidak melewati limit kredit pelanggan; kode tidak diperlukan.',
      400,
    );
  }
  return mintaKode(
    {
      jenis: 'LIMIT_KREDIT',
      izin: 'master.pelanggan.atur_kredit',
      pengaju: pelaku,
      rujukan: { idPelanggan: input.idPelanggan },
      idEntitas: input.idPelanggan,
      nomorDokumen: null,
      nilai: input.tagihanBaru,
      ringkasan:
        `Penjualan tidak lunas untuk ${kredit.nama} melewati limit kredit: ` +
        `limit ${formatRupiah(kredit.limit)}, piutang berjalan ${formatRupiah(kredit.piutangBerjalan)}, ` +
        `tagihan baru ${formatRupiah(input.tagihanBaru)} ` +
        `(piutang menjadi ${formatRupiah(kredit.piutangBerjalan + input.tagihanBaru)}).`,
    },
    asal,
  );
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
  const bolehLimit = pelaku.izin.has('master.pelanggan.atur_kredit');
  // PT6 (K-102): kode sekali pakai dari atasan diperiksa di luar transaksi agar hitungan salah ketiknya
  // tidak ikut dibatalkan; baru dianggap terpakai di dalam transaksi penjualan ini.
  const kodeLimit =
    !bolehLimit && input.kodeLimit
      ? await periksaKode(
          {
            ...input.kodeLimit,
            jenis: 'LIMIT_KREDIT',
            izin: 'master.pelanggan.atur_kredit',
            pengaju: pelaku,
            cocok: () => true,
          },
          asal,
        )
      : null;
  const id = await dalamTransaksi(async (tx) => {
    // PR5: tanggal checkout yang menentukan promo.
    const tanggal = tanggalOperasional();
    const ctx = await siapkanOrder(tx, input, pelaku, asal);
    const { h } = ctx;
    const jenis = h.jenisPenjualan;
    if (input.bayarSaatTerima && jenis !== 'PENGANTARAN') {
      throw new AppError('VALIDASI', 'Bayar saat terima hanya untuk pengantaran.', 400);
    }
    const terkini = await hargaTerkini(tx, ctx.rows, input.perbaruiHarga);
    const promo = await hitungPromoCheckout(tx, terkini.rows, pelaku, tanggal, h.idPelanggan);
    const rows = terkini.rows.map((r, i) => ({ ...r, ...promo[i] }));
    const subtotalOrder = rows.reduce((t, r) => t + r.subtotal, 0);
    if (h.diskonTransaksi > subtotalOrder) {
      throw new AppError(
        'VALIDASI',
        `Diskon transaksi melebihi subtotal ${formatRupiah(subtotalOrder)} setelah harga/promo terbaru.`,
        400,
      );
    }
    await selaraskanOrder(tx, ctx, rows, terkini.catatan, pelaku, asal);

    const totalBruto = rows.reduce((t, r) => t + subtotalRupiah(r.qty, r.hargaSatuan), 0);
    const diskonBaris = rows.reduce((t, r) => t + r.diskonBaris, 0);
    const diskonPromo = rows.reduce((t, r) => t + r.diskonPromo, 0);
    // P4/D3: total diskon = diskon baris + diskon promo + diskon transaksi.
    const totalDiskon = diskonBaris + diskonPromo + h.diskonTransaksi;
    const totalNeto = totalBruto - totalDiskon + h.ongkir;

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
        totalDiskon,
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
          idSatuanJual: r.idSatuanJual,
          faktor: r.faktor,
          qty: r.qty,
          qtyDasar: r.qtyDasar,
          idTingkatHarga: r.idTingkatHarga,
          hargaSatuan: r.hargaSatuan,
          hargaManual: r.hargaManual,
          diskonBaris: r.diskonBaris,
          idPromo: r.idPromo,
          diskonPromo: r.diskonPromo,
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
    if (hasil.statusPembayaran !== 'LUNAS' && h.idPelanggan !== null) {
      // PT6: limit kredit pelanggan; pemegang `master.pelanggan.atur_kredit` boleh melanjutkan (K-088),
      // dari akunnya sendiri, atau lewat kode sekali pakai yang dikirim kepadanya (K-102).
      const kredit = await repo.posisiKredit(tx, h.idPelanggan, pj.id);
      const tagihanBaru = hitungTagihan(hasil).sisa;
      if (kredit.limit !== null && kredit.piutangBerjalan + tagihanBaru > kredit.limit) {
        const rinci =
          `limit ${formatRupiah(kredit.limit)}, piutang berjalan ${formatRupiah(kredit.piutangBerjalan)}, ` +
          `tagihan baru ${formatRupiah(tagihanBaru)}`;
        // Kode berlaku untuk pelanggan itu dan tagihan baru paling banyak sebesar yang dibaca atasan.
        const kodeCocok =
          kodeLimit !== null &&
          kodeLimit.permintaan.idPelanggan === h.idPelanggan &&
          tagihanBaru <= kodeLimit.permintaan.nilai;
        if (kodeLimit && !kodeCocok) {
          throw new AppError(
            'LIMIT_TERLAMPAUI',
            `Kode itu disetujui untuk tagihan baru sampai ${formatRupiah(kodeLimit.permintaan.nilai)}; ` +
              `sekarang ${formatRupiah(tagihanBaru)} (${kredit.nama}). Minta kode baru.`,
            409,
            {
              limit: kredit.limit,
              piutangBerjalan: kredit.piutangBerjalan,
              tagihanBaru,
              bolehLanjut: false,
            },
          );
        }
        const penyetuju = bolehLimit && input.setujuLimit ? pelaku : (kodeLimit?.atasan ?? null);
        if (!penyetuju) {
          throw new AppError(
            'LIMIT_TERLAMPAUI',
            `Limit kredit ${kredit.nama} terlampaui: ${rinci}.`,
            409,
            {
              limit: kredit.limit,
              piutangBerjalan: kredit.piutangBerjalan,
              tagihanBaru,
              bolehLanjut: bolehLimit,
            },
          );
        }
        if (kodeLimit && penyetuju !== pelaku) await pakaiKode(tx, kodeLimit);
        await catatLog(tx, {
          aksi: 'PENJUALAN_LIMIT_OVERRIDE',
          idPengguna: penyetuju.id,
          entitas: 'penjualan',
          idEntitas: pj.id,
          nomorDokumen: nomor,
          ringkasan:
            `Melewati limit kredit ${kredit.nama} pada ${nomor}: ${rinci}` +
            (kodeLimit ? ` (kode sekali pakai, sesi ${pelaku.username})` : ''),
          ip: asal.ip,
        });
      }
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
        (diskonPromo > 0 ? `promo ${formatRupiah(diskonPromo)}, ` : '') +
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
