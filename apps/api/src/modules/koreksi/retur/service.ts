import {
  bagiQty,
  bandingQty,
  formatRupiah,
  LABEL_PENYELESAIAN_RETUR,
  kaliQty,
  hargaSatuanEfektif,
  keQty,
  teksQty,
  kurangQty,
  subtotalRupiah,
  tambahQty,
  type BarisRetur,
  type TugasRefundTransfer,
  type DaftarRetur,
  type DataKodePersetujuan,
  type DataRetur,
  type DataSetujui,
  type InfoKodePersetujuan,
  type KandidatRetur,
  type MetodeRefund,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatMutasi } from '../../persediaan/ledger';
import { hitungTagihan } from '../../penjualan/pembayaran';
import * as pjRepo from '../../penjualan/penjualan/repo';
import * as sjRepo from '../../penjualan/surat-jalan/repo';
import {
  mintaKode,
  pakaiKode,
  periksaKode,
  type KodeSah,
} from '../../sistem/kode-persetujuan/service';
import { ambilAngka } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import {
  catatRefund,
  pastikanBolehBatal,
  pastikanBolehMintaKode,
  persetujuanAkunAtasan,
  persetujuanDiTempat,
  persetujuanLangsung,
  simpanTagihan,
  type Persetujuan,
} from '../umum';
import * as repo from './repo';

/*
 * Retur penjualan (docs/05 §8 T1–T10, docs/04 §6). Pengajuan Kasir → MENUNGGU, kecuali disetujui atasan di
 * tempat atau nilainya di bawah batas bebas (K-099); Admin/Owner langsung DISETUJUI (K-017). Efek hanya saat
 * DISETUJUI: barang masuk stok (BAIK) atau bucket rusak (RUSAK/CACAT), lalu penyelesaian REFUND /
 * TUKAR_BARANG / POTONG_TAGIHAN. Retur yang sudah disetujui tidak bisa diubah atau dibalik; pengajuan yang
 * masih MENUNGGU bisa dibatalkan pengajunya.
 */

/** K-099: nilai retur per transaksi yang boleh diproses tanpa atasan (0 = selalu butuh persetujuan). */
const KUNCI_BATAS_BEBAS = 'batas_retur_tanpa_persetujuan';

type Header = NonNullable<Awaited<ReturnType<typeof repo.byId>>>;

async function keRespons(rows: Header[]): Promise<BarisRetur[]> {
  const det = await repo.detail(
    db,
    rows.map((r) => r.id),
  );
  return rows.map(({ rekeningRefund: _r, referensiRefund: _f, ...r }) => ({
    ...r,
    tanggal: r.tanggal.toISOString(),
    waktuPersetujuan: r.waktuPersetujuan?.toISOString() ?? null,
    baris: det
      .filter((d) => d.idRetur === r.id)
      .map((d) => ({
        namaBarang: d.namaBarang,
        kodeSatuan: d.kodeSatuan,
        qtyRetur: d.qtyRetur,
        kondisi: d.kondisi,
        nominalRetur: d.nominalRetur,
      })),
  }));
}

export async function daftarRetur(
  p: repo.SaringRetur & { halaman: number; perHalaman: number },
): Promise<DaftarRetur> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: await keRespons(baris), meta: metaHalaman(total, p) };
}

export async function detailRetur(id: number): Promise<BarisRetur> {
  const h = await repo.byId(db, id);
  if (!h) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
  const [r] = await keRespons([h]);
  if (!r) throw new Error('retur hilang');
  return r;
}

/** Qty dasar yang masih bisa diretur = qty − sudah diretur − sedang diajukan (baris VOID = 0). */
function bisaRetur(b: {
  qtyDasar: string;
  qtyReturDasar: string;
  qtyMenunggu: string;
  statusItem: string;
}) {
  if (b.statusItem === 'VOID' || b.statusItem === 'RETUR') return '0.000';
  const sisa = kurangQty(kurangQty(b.qtyDasar, b.qtyReturDasar), b.qtyMenunggu);
  return bandingQty(sisa, 0) < 0 ? '0.000' : keQty(sisa);
}

export async function kandidatRetur(cari: string): Promise<KandidatRetur[]> {
  const rows = await repo.kandidat(db, cari.trim());
  const hasil: KandidatRetur[] = [];
  const barisPer = new Map<number, Awaited<ReturnType<typeof repo.barisPenjualan>>>();
  for (const b of await repo.barisPenjualan(
    db,
    rows.map((r) => r.id),
  )) {
    barisPer.set(b.idPenjualan, [...(barisPer.get(b.idPenjualan) ?? []), b]);
  }
  const idPj = rows.map((r) => r.id);
  const batas = await ambilAngka(KUNCI_BATAS_BEBAS, 0);
  const berjalan = await repo.nilaiBerjalan(db, idPj);
  const riwayat = await keRespons(await repo.perPenjualan(db, idPj));
  for (const r of rows) {
    const baris = barisPer.get(r.id) ?? [];
    hasil.push({
      id: r.id,
      nomor: r.nomor,
      tanggal: r.tanggal.toISOString(),
      jenisPenjualan: r.jenisPenjualan,
      statusTransaksi: r.statusTransaksi,
      namaPembeli: r.namaPembeli,
      totalNeto: r.totalNeto,
      sisaTagihan: r.sisaTagihan ?? 0,
      dibayarBersih: r.totalDibayar - r.totalRefund,
      sisaBatasBebas: Math.max(0, batas - (berjalan.get(r.id) ?? 0)),
      baris: baris.map((b) => ({
        id: b.id,
        namaBarang: b.namaBarang,
        kodeSatuan: b.kodeSatuan,
        qty: b.qty,
        // K-091: dalam satuan baris (satuan jual), dihitung dari satuan dasar.
        qtyDiretur: bagiQty(b.qtyReturDasar, b.faktor),
        qtyMenunggu: bagiQty(b.qtyMenunggu, b.faktor),
        qtyBisaRetur: bagiQty(bisaRetur(b), b.faktor),
        hargaSatuanEfektif: hargaSatuanEfektif(b.subtotal, b.qty),
        statusItem: b.statusItem,
      })),
      retur: riwayat
        .filter((x) => x.idPenjualan === r.id)
        .map((x) => ({
          id: x.id,
          nomor: x.nomor,
          tanggal: x.tanggal,
          status: x.status,
          totalRetur: x.totalRetur,
          ringkasan: x.baris
            .map((b) => `${b.namaBarang} ${teksQty(b.qtyRetur)} ${b.kodeSatuan}`)
            .join(', '),
        })),
    });
  }
  return hasil;
}

function statusTidakBisa(nomor: string): AppError {
  return new AppError(
    'STATUS_TIDAK_VALID',
    `Penjualan ${nomor} tidak bisa diretur (sudah di-void seluruhnya).`,
    409,
  );
}

export async function ajukanRetur(
  input: DataRetur,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisRetur> {
  const { id } = await dalamTransaksi((tx) => ajukanReturTx(tx, input, pelaku, asal));
  return detailRetur(id);
}

/**
 * Pengajuan retur di dalam transaksi pemanggil (juga dipakai hasil pengantaran, docs/05 S10). `disetujui` = retur
 * langsung diterapkan (pengaju berwenang atau di bawah batas bebas, K-099).
 */
export async function ajukanReturTx(
  tx: Tx,
  input: DataRetur,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  /** K-192/K-193: dipakai hasil pengantaran. */
  opsi: { pengembalianDitunda?: boolean; potongDulu?: boolean } = {},
): Promise<{ id: number; nomor: string; disetujui: boolean }> {
  const berwenang = pelaku.izin.has('retur.setujui');
  const pj = await pjRepo.kunciPenjualan(tx, input.idPenjualan);
  if (!pj) throw new AppError('TIDAK_DITEMUKAN', 'Penjualan tidak ditemukan.', 404);
  if (pj.statusTransaksi === 'VOID') throw statusTidakBisa(pj.nomor);
  if (input.penyelesaian === 'REFUND' && !input.persetujuan.metodeRefund) {
    throw new AppError('VALIDASI', 'Pilih cara pengembalian uang (tunai/transfer).', 400, {
      kolom: { metodeRefund: ['Pilih metode refund.'] },
    });
  }
  const baris = await repo.barisPenjualan(tx, pj.id);
  const terlihat = new Set<number>();
  const isi = input.baris.map((r, i) => {
    const b = baris.find((x) => x.id === r.idPenjualanDetail);
    if (!b || terlihat.has(r.idPenjualanDetail)) {
      throw new AppError('VALIDASI', `Baris ${i + 1}: barang tidak ada di transaksi ini.`, 400);
    }
    terlihat.add(b.id);
    const sisaDasar = bisaRetur(b);
    const qty = keQty(r.qtyRetur);
    // K-091: qty retur dalam satuan baris; batas diperiksa dalam satuan dasar.
    const qtyDasar = kaliQty(qty, b.faktor);
    if (bandingQty(qtyDasar, sisaDasar) > 0) {
      const sisa = bagiQty(sisaDasar, b.faktor);
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `${b.namaBarang}: qty retur ${teksQty(qty)} melebihi yang bisa diretur ` +
          `(${teksQty(sisa)} ${b.kodeSatuan}).`,
        409,
        { kolom: { [`baris.${i}.qtyRetur`]: [`Maksimal ${teksQty(sisa)} ${b.kodeSatuan}.`] } },
      );
    }
    const hse = hargaSatuanEfektif(b.subtotal, b.qty);
    return { r, b, qty, qtyDasar, hse, nominal: subtotalRupiah(qty, hse) };
  });
  // K-149: barang yang masih di surat jalan berjalan diselesaikan lewat catat hasil pengantaran (S10), bukan
  // retur biasa, supaya qty kirim dan qty retur tidak saling tumpang.
  if (pj.jenisPenjualan === 'PENGANTARAN') {
    const kirim = new Map((await sjRepo.qtyBaris(tx, pj.id)).map((k) => [k.id, k]));
    for (const x of isi) {
      const jalan = kirim.get(x.b.id)?.qtyDalamPerjalanan ?? '0';
      if (bandingQty(jalan, 0) <= 0) continue;
      const bebasDasar = kurangQty(bisaRetur(x.b), kaliQty(jalan, x.b.faktor));
      if (bandingQty(x.qtyDasar, bebasDasar) > 0) {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          `${x.b.namaBarang}: ${teksQty(keQty(jalan))} ${x.b.kodeSatuan} masih di surat jalan yang belum selesai. ` +
            'Catat hasil pengantarannya (Pengiriman aktif) atau batalkan surat jalannya dulu.',
          409,
        );
      }
    }
  }
  // T5: tukar butuh stok baik untuk barang pengganti. Dicek sejak pengajuan agar kasir langsung tahu;
  // bila stok kurang, tukar sebagian dan ajukan sisanya sebagai retur uang kembali/potong tagihan.
  if (input.penyelesaian === 'TUKAR_BARANG') {
    for (const x of isi) {
      const tersedia = await repo.stokTersedia(tx, x.b.idBarang);
      if (bandingQty(x.qtyDasar, tersedia) > 0) {
        const bisa = bagiQty(tersedia, x.b.faktor);
        throw new AppError(
          'STOK_TIDAK_CUKUP',
          `Stok ${x.b.namaBarang} untuk pengganti tinggal ${teksQty(bisa)} ${x.b.kodeSatuan}. ` +
            `Ajukan tukar ${teksQty(bisa)} saja, lalu sisanya sebagai retur dengan uang kembali atau potong tagihan.`,
          409,
        );
      }
    }
  }
  const total = isi.reduce((t, x) => t + x.nominal, 0);
  if (input.penyelesaian === 'POTONG_TAGIHAN' && total > hitungTagihan(pj).sisa) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Nilai retur ${formatRupiah(total)} melebihi sisa tagihan ${formatRupiah(hitungTagihan(pj).sisa)}; gunakan refund.`,
      409,
    );
  }
  // K-099: batas bebas dihitung per transaksi (retur sebelumnya ikut dijumlah), sebelum dokumen ini ditulis.
  const batas = await ambilAngka(KUNCI_BATAS_BEBAS, 0, tx);
  const berjalan = (await repo.nilaiBerjalan(tx, [pj.id])).get(pj.id) ?? 0;
  const langsung = persetujuanLangsung({
    pengaju: pelaku,
    berwenang,
    batasBebas: batas > 0 && berjalan + total <= batas ? batas : null,
  });
  const tanggal = tanggalOperasional();
  const nomor = await terbitkanNomor(tx, 'RTR', tanggal);
  const p = input.persetujuan;
  const idRetur = await repo.tambahHeader(tx, {
    nomor,
    idPenjualan: pj.id,
    tanggalOperasional: tanggal,
    idPengaju: pelaku.id,
    alasan: input.alasan,
    penyelesaian: input.penyelesaian,
    totalRetur: total,
    metodeRefund: input.penyelesaian === 'REFUND' ? p.metodeRefund : null,
    rekeningRefund: input.penyelesaian === 'REFUND' ? (p.rekeningRefund ?? null) : null,
    referensiRefund: input.penyelesaian === 'REFUND' ? (p.referensiRefund ?? null) : null,
    catatan: input.catatan ?? null,
    pengembalianDitunda: opsi.pengembalianDitunda ?? false,
    potongDulu: opsi.potongDulu ?? false,
  });
  await repo.tambahDetail(
    tx,
    isi.map((x) => ({
      idRetur,
      idPenjualanDetail: x.b.id,
      idBarang: x.b.idBarang,
      qtyRetur: x.qty,
      qtyReturDasar: x.qtyDasar,
      hargaSatuanEfektif: x.hse,
      nominalRetur: x.nominal,
      kondisi: x.r.kondisi,
      // T5: tukar hanya barang yang sama dengan qty sama.
      idBarangPengganti: input.penyelesaian === 'TUKAR_BARANG' ? x.b.idBarang : null,
      qtyPenggantiDasar: input.penyelesaian === 'TUKAR_BARANG' ? x.qtyDasar : null,
      keterangan: x.r.keterangan ?? null,
    })),
  );
  await catatLog(tx, {
    aksi: 'RETUR_AJUKAN',
    idPengguna: pelaku.id,
    entitas: 'retur_penjualan',
    idEntitas: idRetur,
    nomorDokumen: nomor,
    ringkasan: `Ajukan retur ${pj.nomor} (${input.penyelesaian.toLowerCase().replace('_', ' ')}): ${isi.length} barang, ${formatRupiah(total)} — ${input.alasan}`,
    ip: asal.ip,
  });
  if (langsung) {
    const h = await terapkan(tx, idRetur, input.persetujuan, langsung);
    await logSetujui(tx, idRetur, nomor, h, langsung, asal);
  }
  return { id: idRetur, nomor, disetujui: langsung !== null };
}

/** T4–T8: efek retur yang disetujui, dalam transaksi pemanggil. */
async function terapkan(tx: Tx, idRetur: number, persetujuan: DataSetujui, oleh: Persetujuan) {
  const r = await repo.kunci(tx, idRetur);
  if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
  const pj = await pjRepo.kunciPenjualan(tx, r.idPenjualan);
  if (!pj) throw new Error('penjualan hilang');
  if (pj.statusTransaksi === 'VOID') throw statusTidakBisa(pj.nomor);
  const det = await repo.detail(tx, [idRetur]);
  const baris = new Map((await repo.barisPenjualan(tx, pj.id)).map((b) => [b.id, b]));
  const tukar = r.penyelesaian === 'TUKAR_BARANG';
  const tanggal = tanggalOperasional();
  const umum = {
    idPengguna: oleh.idPenyetuju,
    tanggalOperasional: tanggal,
    keterangan: `Retur ${r.nomor} (${pj.nomor})`,
  };

  for (const d of [...det].sort((a, b) => a.idBarang - b.idBarang)) {
    const b = baris.get(d.idPenjualanDetail);
    if (!b) throw new Error('baris penjualan hilang');
    // T1 saat persetujuan: hanya terhadap retur yang sudah disetujui.
    const sisa = kurangQty(b.qtyDasar, b.qtyReturDasar);
    if (b.statusItem === 'VOID' || bandingQty(d.qtyReturDasar, sisa) > 0) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `${b.namaBarang} sudah di-void/diretur sehingga retur ini tidak bisa disetujui.`,
        409,
      );
    }
    // T4: kondisi BAIK kembali ke stok jual; RUSAK/CACAT ke bucket rusak.
    await catatMutasi(tx, {
      ...umum,
      idBarang: d.idBarang,
      jenis: 'RETUR_JUAL',
      kondisi: d.kondisi === 'BAIK' ? 'BAIK' : 'RUSAK',
      qtyMasuk: d.qtyReturDasar,
      hppSatuan: b.hppSaatTransaksi,
      sumber: { idReturDetail: d.id },
    });
    if (tukar) {
      // T5: barang pengganti (sama) keluar dari stok jual.
      await catatMutasi(tx, {
        ...umum,
        idBarang: d.idBarang,
        jenis: 'TUKAR_RETUR',
        qtyKeluar: d.qtyPenggantiDasar ?? d.qtyReturDasar,
        sumber: { idReturDetail: d.id },
      });
    } else {
      const qtyBaru = tambahQty(b.qtyReturDasar, d.qtyReturDasar);
      await repo.ubahBarisPenjualan(tx, b.id, {
        qtyReturDasar: qtyBaru,
        statusItem: bandingQty(qtyBaru, b.qtyDasar) >= 0 ? 'RETUR' : 'RETUR_SEBAGIAN',
        diubahPada: sekarang(),
      });
    }
  }

  const dokumen = det.reduce((t, d) => t + d.nominalRetur, 0);
  let nilaiRetur = 0;
  let refund = 0;
  let idShift: number | null = null;
  let catatanTambahan = '';
  const metode = persetujuan.metodeRefund ?? r.metodeRefund;
  const setuju: DataSetujui = {
    metodeRefund: metode,
    rekeningRefund: persetujuan.rekeningRefund ?? r.rekeningRefund,
    referensiRefund: persetujuan.referensiRefund ?? r.referensiRefund,
  };
  if (!tukar) {
    // K-077: nilai retur tidak boleh membuat void+retur melebihi total neto (efek diskon transaksi).
    nilaiRetur = Math.min(dokumen, pj.totalNeto - pj.totalVoid - pj.totalRetur);
    const { sisa, dibayarBersih } = hitungTagihan(pj);
    if (r.penyelesaian === 'POTONG_TAGIHAN' && nilaiRetur > sisa) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Nilai retur ${formatRupiah(nilaiRetur)} melebihi sisa tagihan ${formatRupiah(sisa)}; gunakan refund.`,
        409,
      );
    }
    if (r.penyelesaian === 'REFUND') {
      // T6: refund dibatasi uang yang sudah dibayar; sisanya menjadi potong tagihan. K-192 potong dulu: sisa
      // tagihan dipotong lebih dulu, hanya kelebihannya yang dikembalikan.
      const bisaKembali = Math.max(0, dibayarBersih);
      refund = r.potongDulu
        ? Math.min(Math.max(0, nilaiRetur - Math.max(0, sisa)), bisaKembali)
        : Math.min(nilaiRetur, bisaKembali);
      if (refund < nilaiRetur) {
        catatanTambahan = r.potongDulu
          ? `Potong tagihan ${formatRupiah(nilaiRetur - refund)}; uang dikembalikan ${formatRupiah(refund)}.`
          : `Refund dibatasi ${formatRupiah(refund)}; ${formatRupiah(nilaiRetur - refund)} menjadi potong tagihan.`;
      }
      if (!r.pengembalianDitunda) {
        idShift = await catatRefund(tx, {
          nominal: refund,
          persetujuan: setuju,
          pelaku: oleh.kasir,
          jenis: 'REFUND_RETUR',
          nomorDokumen: r.nomor,
          nomorPenjualan: pj.nomor,
          idRetur,
          rekeningBolehNanti: true,
        });
      } else if (refund > 0 && !metode) {
        throw new AppError('VALIDASI', 'Pilih cara pengembalian uang (tunai/transfer).', 400, {
          kolom: { metodeRefund: ['Pilih metode refund.'] },
        });
      }
    }
    await simpanTagihan(tx, pj.id, {
      ...pj,
      totalRetur: pj.totalRetur + nilaiRetur,
      totalRefund: pj.totalRefund + refund,
    });
  }
  const waktu = sekarang();
  await repo.ubahHeader(tx, idRetur, {
    status: 'DISETUJUI',
    idPenyetuju: oleh.idPenyetuju,
    caraPersetujuan: oleh.cara,
    waktuPersetujuan: waktu,
    totalRetur: tukar ? dokumen : nilaiRetur,
    ...(r.penyelesaian === 'REFUND'
      ? {
          metodeRefund: metode,
          rekeningRefund: setuju.rekeningRefund ?? null,
          referensiRefund: setuju.referensiRefund ?? null,
          nominalRefund: refund,
          // K-176: transfer dikerjakan belakangan dan dikonfirmasi dengan bukti. K-193: pengembalian yang ditunda
          // (tunai maupun transfer) juga menunggu konfirmasi.
          statusTransfer:
            refund > 0 && (metode === 'TRANSFER' || r.pengembalianDitunda)
              ? ('MENUNGGU' as const)
              : null,
        }
      : {}),
    idShift,
    ...(catatanTambahan ? { catatan: catatanTambahan.slice(0, 255) } : {}),
    diubahPada: waktu,
  });
  return { nilaiRetur: tukar ? dokumen : nilaiRetur, refund, nomorPenjualan: pj.nomor, tukar };
}

async function logSetujui(
  tx: Tx,
  idRetur: number,
  nomor: string,
  h: Awaited<ReturnType<typeof terapkan>>,
  oleh: Persetujuan,
  asal: AsalRequest,
) {
  await catatLog(tx, {
    aksi: 'RETUR_SETUJUI',
    idPengguna: oleh.idPenyetuju,
    entitas: 'retur_penjualan',
    idEntitas: idRetur,
    nomorDokumen: nomor,
    ringkasan:
      `Setujui retur ${nomor} (${h.nomorPenjualan}): ${formatRupiah(h.nilaiRetur)}` +
      (h.tukar ? ', tukar barang' : '') +
      (h.refund > 0 ? `, refund ${formatRupiah(h.refund)}` : '') +
      oleh.catatanLog,
    ip: asal.ip,
  });
}

async function setujui(
  id: number,
  persetujuan: DataSetujui,
  oleh: Persetujuan,
  asal: AsalRequest,
  kode?: KodeSah,
): Promise<BarisRetur> {
  await dalamTransaksi(async (tx) => {
    const r = await repo.kunci(tx, id);
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
    if (r.status !== 'MENUNGGU') {
      throw new AppError('STATUS_TIDAK_VALID', `Retur ${r.nomor} sudah diputuskan.`, 409);
    }
    // Kode sekali pakai hangus bersama persetujuannya (batal bersama bila transaksi gagal).
    if (kode) await pakaiKode(tx, kode);
    const h = await terapkan(tx, id, persetujuan, oleh);
    await logSetujui(tx, id, r.nomor, h, oleh, asal);
  });
  return detailRetur(id);
}

/** Atasan menyetujui dari akunnya sendiri (tab Persetujuan). */
export function setujuiRetur(
  id: number,
  persetujuan: DataSetujui,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisRetur> {
  return setujui(id, persetujuan, persetujuanAkunAtasan(pelaku), asal);
}

/**
 * K-102: mengirim kode sekali pakai ke Admin/Owner untuk pengajuan MENUNGGU milik pengaju. Isi pesan disusun
 * dari dokumen yang tersimpan, jadi atasan membaca persis apa yang akan ia setujui.
 */
export async function mintaKodeRetur(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<InfoKodePersetujuan> {
  const r = await detailRetur(id);
  pastikanBolehMintaKode(r, pelaku);
  const barang = r.baris
    .map((b) => `${b.namaBarang} ${teksQty(b.qtyRetur)} ${b.kodeSatuan}`)
    .join(', ');
  return mintaKode(
    {
      jenis: 'RETUR',
      izin: 'retur.setujui',
      pengaju: pelaku,
      rujukan: { idRetur: id },
      idEntitas: id,
      nomorDokumen: r.nomor,
      nilai: r.totalRetur,
      ringkasan:
        `Retur ${r.nomor} atas ${r.nomorPenjualan}: ${barang}. ` +
        `Nilai ${formatRupiah(r.totalRetur)}, ${LABEL_PENYELESAIAN_RETUR[r.penyelesaian].toLowerCase()}. ` +
        `Alasan: ${r.alasan}.`,
    },
    asal,
  );
}

/** K-102: pengaju mengetik kode dari atasan; retur disetujui atas nama pemilik kode itu. */
export async function setujuiReturDenganKode(
  id: number,
  persetujuan: DataSetujui,
  kode: DataKodePersetujuan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisRetur> {
  const sah = await periksaKode(
    {
      ...kode,
      jenis: 'RETUR',
      izin: 'retur.setujui',
      pengaju: pelaku,
      cocok: (m) => m.idRetur === id,
    },
    asal,
  );
  return setujui(id, persetujuan, persetujuanDiTempat(sah.atasan, pelaku), asal, sah);
}

/** K-099: pengajuan MENUNGGU ditarik (salah input); tanpa efek stok, kas, atau tagihan. */
export async function batalRetur(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisRetur> {
  await dalamTransaksi(async (tx) => {
    const r = await repo.kunci(tx, id);
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
    pastikanBolehBatal(r, pelaku, pelaku.izin.has('retur.setujui'));
    const waktu = sekarang();
    await repo.ubahHeader(tx, id, {
      status: 'DIBATALKAN',
      alasanPenolakan: alasan,
      idPenyetuju: pelaku.id,
      waktuPersetujuan: waktu,
      diubahPada: waktu,
    });
    await catatLog(tx, {
      aksi: 'RETUR_BATAL',
      idPengguna: pelaku.id,
      entitas: 'retur_penjualan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `Batalkan pengajuan retur ${r.nomor}: ${alasan}`,
      ip: asal.ip,
    });
  });
  return detailRetur(id);
}

/** T10: tolak dengan alasan; tidak ada efek. */
export async function tolakRetur(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisRetur> {
  await dalamTransaksi(async (tx) => {
    const r = await repo.kunci(tx, id);
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
    if (r.status !== 'MENUNGGU') {
      throw new AppError('STATUS_TIDAK_VALID', `Retur ${r.nomor} sudah diputuskan.`, 409);
    }
    const waktu = sekarang();
    await repo.ubahHeader(tx, id, {
      status: 'DITOLAK',
      alasanPenolakan: alasan,
      idPenyetuju: pelaku.id,
      waktuPersetujuan: waktu,
      diubahPada: waktu,
    });
    await catatLog(tx, {
      aksi: 'RETUR_TOLAK',
      idPengguna: pelaku.id,
      entitas: 'retur_penjualan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `Tolak retur ${r.nomor}: ${alasan}`,
      ip: asal.ip,
    });
  });
  return detailRetur(id);
}

export function jumlahReturMenunggu(): Promise<number> {
  return repo.jumlahMenunggu(db);
}

// --- K-176: tugas refund transfer ---

export async function daftarRefundTransfer(
  status: 'MENUNGGU' | 'SELESAI',
  metode?: MetodeRefund,
): Promise<TugasRefundTransfer[]> {
  const baris = await repo.daftarRefundTransfer(db, status, metode);
  return baris.map((b) => ({
    ...b,
    tanggal: b.tanggal.toISOString(),
    waktuTransfer: b.waktuTransfer?.toISOString() ?? null,
    statusTransfer: b.statusTransfer ?? status,
    metodeRefund: b.metodeRefund ?? 'TRANSFER',
  }));
}

/**
 * K-193: uang retur sudah dikembalikan. TUNAI keluar dari kas shift yang sedang buka (izin retur.ajukan cukup:
 * nilainya sudah disetujui); TRANSFER memakai rekening toko sehingga butuh izin retur.setujui. Cara yang dipakai
 * boleh berbeda dari pilihan semula.
 */
export async function konfirmasiPengembalian(
  id: number,
  input: { metode: MetodeRefund; rekeningRefund?: string | null; referensiRefund?: string | null },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TugasRefundTransfer[]> {
  if (input.metode === 'TRANSFER' && !pelaku.izin.has('retur.setujui')) {
    throw new AppError(
      'TIDAK_BERIZIN',
      'Pengembalian lewat transfer dikonfirmasi Admin/Owner yang memegang rekening toko.',
      403,
    );
  }
  await dalamTransaksi(async (tx) => {
    const r = await repo.kunciRetur(tx, id);
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
    if (r.statusTransfer !== 'MENUNGGU') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        r.statusTransfer === 'SELESAI'
          ? `Uang retur ${r.nomor} sudah dikembalikan.`
          : `Retur ${r.nomor} tidak punya pengembalian uang yang menunggu.`,
        409,
      );
    }
    const pj = await pjRepo.kunciPenjualan(tx, r.idPenjualan);
    const idShift =
      input.metode === 'TUNAI'
        ? await catatRefund(tx, {
            nominal: r.nominalRefund,
            persetujuan: { metodeRefund: 'TUNAI', rekeningRefund: null, referensiRefund: null },
            pelaku,
            jenis: 'REFUND_RETUR',
            nomorDokumen: r.nomor,
            nomorPenjualan: pj?.nomor ?? '',
            idRetur: id,
          })
        : null;
    const waktu = sekarang();
    await repo.ubahHeader(tx, id, {
      statusTransfer: 'SELESAI',
      metodeRefund: input.metode,
      rekeningRefund: input.metode === 'TRANSFER' ? (input.rekeningRefund ?? null) : null,
      referensiRefund: input.metode === 'TRANSFER' ? (input.referensiRefund ?? null) : null,
      ...(idShift ? { idShift } : {}),
      waktuTransfer: waktu,
      idPenggunaTransfer: pelaku.id,
      diubahPada: waktu,
    });
    const ganti =
      r.metodeRefund && r.metodeRefund !== input.metode
        ? ` (semula ${r.metodeRefund.toLowerCase()})`
        : '';
    await catatLog(tx, {
      aksi: input.metode === 'TUNAI' ? 'RETUR_KEMBALI_TUNAI' : 'RETUR_TRANSFER',
      idPengguna: pelaku.id,
      entitas: 'retur_penjualan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan:
        input.metode === 'TUNAI'
          ? `Uang retur ${formatRupiah(r.nominalRefund)} diserahkan tunai dari kas shift${ganti}`
          : `Refund ${formatRupiah(r.nominalRefund)} sudah ditransfer ke ${input.rekeningRefund ?? '-'} (ref. ${input.referensiRefund ?? '-'})${ganti}`,
      ip: asal.ip,
    });
  });
  return daftarRefundTransfer('MENUNGGU');
}

/** K-193: ganti cara pengembalian selama masih menunggu (salah pilih), dengan alasan di log. */
export async function gantiCaraPengembalian(
  id: number,
  input: { metode: MetodeRefund; alasan: string },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TugasRefundTransfer[]> {
  await dalamTransaksi(async (tx) => {
    const r = await repo.kunciRetur(tx, id);
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
    if (r.statusTransfer !== 'MENUNGGU') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Cara pengembalian ${r.nomor} tidak bisa diganti: tidak sedang menunggu.`,
        409,
      );
    }
    if (r.metodeRefund === input.metode) return;
    const waktu = sekarang();
    await repo.ubahHeader(tx, id, { metodeRefund: input.metode, diubahPada: waktu });
    await catatLog(tx, {
      aksi: 'RETUR_GANTI_CARA',
      idPengguna: pelaku.id,
      entitas: 'retur_penjualan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `Cara pengembalian ${formatRupiah(r.nominalRefund)} diganti ${String(r.metodeRefund).toLowerCase()} → ${input.metode.toLowerCase()}: ${input.alasan}`,
      dataLama: { metodeRefund: r.metodeRefund },
      dataBaru: { metodeRefund: input.metode },
      ip: asal.ip,
    });
  });
  return daftarRefundTransfer('MENUNGGU');
}

/**
 * Menandai refund transfer sudah dikirim: rekening tujuan (boleh baru diisi sekarang) dan bukti/nomor referensi
 * bank wajib. Hanya sekali; yang sudah SELESAI ditolak.
 */
export async function konfirmasiTransfer(
  id: number,
  input: { rekeningRefund: string; referensiRefund: string },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TugasRefundTransfer[]> {
  await dalamTransaksi(async (tx) => {
    const r = await repo.kunciRetur(tx, id);
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
    if (r.statusTransfer !== 'MENUNGGU') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        r.statusTransfer === 'SELESAI'
          ? `Refund ${r.nomor} sudah dikonfirmasi ditransfer.`
          : `Retur ${r.nomor} tidak punya tugas refund transfer.`,
        409,
      );
    }
    const waktu = sekarang();
    await repo.ubahHeader(tx, id, {
      statusTransfer: 'SELESAI',
      rekeningRefund: input.rekeningRefund,
      referensiRefund: input.referensiRefund,
      waktuTransfer: waktu,
      idPenggunaTransfer: pelaku.id,
      diubahPada: waktu,
    });
    await catatLog(tx, {
      aksi: 'RETUR_TRANSFER',
      idPengguna: pelaku.id,
      entitas: 'retur_penjualan',
      idEntitas: id,
      nomorDokumen: r.nomor,
      ringkasan: `Refund ${formatRupiah(r.nominalRefund)} sudah ditransfer ke ${input.rekeningRefund} (ref. ${input.referensiRefund})`,
      ip: asal.ip,
    });
  });
  return daftarRefundTransfer('MENUNGGU');
}
