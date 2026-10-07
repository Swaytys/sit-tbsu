import {
  bagiQty,
  bandingQty,
  formatRupiah,
  kaliQty,
  hargaSatuanEfektif,
  keQty,
  kurangQty,
  subtotalRupiah,
  tambahQty,
  type BarisRetur,
  type DaftarRetur,
  type DataRetur,
  type DataSetujui,
  type KandidatRetur,
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
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { catatRefund, simpanTagihan } from '../umum';
import * as repo from './repo';

/*
 * Retur penjualan (docs/05 §8 T1–T10, docs/04 §6). Pengajuan Kasir → MENUNGGU; Admin/Owner langsung DISETUJUI
 * (K-017). Efek hanya saat DISETUJUI: barang masuk stok (BAIK) atau bucket rusak (RUSAK/CACAT), lalu
 * penyelesaian REFUND / TUKAR_BARANG / POTONG_TAGIHAN.
 */

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
  if (!cari.trim()) return [];
  const rows = await repo.kandidat(db, cari.trim());
  const hasil: KandidatRetur[] = [];
  const barisPer = new Map<number, Awaited<ReturnType<typeof repo.barisPenjualan>>>();
  for (const b of await repo.barisPenjualan(
    db,
    rows.map((r) => r.id),
  )) {
    barisPer.set(b.idPenjualan, [...(barisPer.get(b.idPenjualan) ?? []), b]);
  }
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
      baris: baris.map((b) => ({
        id: b.id,
        namaBarang: b.namaBarang,
        kodeSatuan: b.kodeSatuan,
        qty: b.qty,
        // K-091: dalam satuan baris (satuan jual), dihitung dari satuan dasar.
        qtyBisaRetur: bagiQty(bisaRetur(b), b.faktor),
        hargaSatuanEfektif: hargaSatuanEfektif(b.subtotal, b.qty),
        statusItem: b.statusItem,
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
  const id = await dalamTransaksi(async (tx) => {
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
          `${b.namaBarang}: qty retur ${qty} melebihi yang bisa diretur (${sisa}).`,
          409,
          { kolom: { [`baris.${i}.qtyRetur`]: [`Maksimal ${sisa}.`] } },
        );
      }
      const hse = hargaSatuanEfektif(b.subtotal, b.qty);
      return { r, b, qty, qtyDasar, hse, nominal: subtotalRupiah(qty, hse) };
    });
    // T5: tukar butuh stok baik untuk barang pengganti. Dicek sejak pengajuan agar kasir langsung tahu;
    // bila stok kurang, tukar sebagian dan ajukan sisanya sebagai retur uang kembali/potong tagihan.
    if (input.penyelesaian === 'TUKAR_BARANG') {
      for (const x of isi) {
        const tersedia = await repo.stokTersedia(tx, x.b.idBarang);
        if (bandingQty(x.qtyDasar, tersedia) > 0) {
          const bisa = bagiQty(tersedia, x.b.faktor);
          throw new AppError(
            'STOK_TIDAK_CUKUP',
            `Stok ${x.b.namaBarang} untuk pengganti tinggal ${keQty(bisa)} ${x.b.kodeSatuan}. ` +
              `Ajukan tukar ${keQty(bisa)} saja, lalu sisanya sebagai retur dengan uang kembali atau potong tagihan.`,
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
    if (pelaku.izin.has('retur.setujui')) {
      const h = await terapkan(tx, idRetur, input.persetujuan, pelaku);
      await logSetujui(tx, idRetur, nomor, h, pelaku, asal, true);
    }
    return idRetur;
  });
  return detailRetur(id);
}

/** T4–T8: efek retur yang disetujui, dalam transaksi pemanggil. */
async function terapkan(tx: Tx, idRetur: number, persetujuan: DataSetujui, pelaku: PenggunaAktif) {
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
    idPengguna: pelaku.id,
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
      // T6: refund dibatasi uang yang sudah dibayar; sisanya menjadi potong tagihan.
      refund = Math.min(nilaiRetur, Math.max(0, dibayarBersih));
      if (refund < nilaiRetur) {
        catatanTambahan = `Refund dibatasi ${formatRupiah(refund)}; ${formatRupiah(nilaiRetur - refund)} menjadi potong tagihan.`;
      }
      idShift = await catatRefund(tx, {
        nominal: refund,
        persetujuan: setuju,
        pelaku,
        jenis: 'REFUND_RETUR',
        nomorDokumen: r.nomor,
        nomorPenjualan: pj.nomor,
        idRetur,
      });
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
    idPenyetuju: pelaku.id,
    waktuPersetujuan: waktu,
    totalRetur: tukar ? dokumen : nilaiRetur,
    ...(r.penyelesaian === 'REFUND'
      ? {
          metodeRefund: metode,
          rekeningRefund: setuju.rekeningRefund ?? null,
          referensiRefund: setuju.referensiRefund ?? null,
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
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  otomatis: boolean,
) {
  await catatLog(tx, {
    aksi: 'RETUR_SETUJUI',
    idPengguna: pelaku.id,
    entitas: 'retur_penjualan',
    idEntitas: idRetur,
    nomorDokumen: nomor,
    ringkasan:
      `Setujui retur ${nomor} (${h.nomorPenjualan}): ${formatRupiah(h.nilaiRetur)}` +
      (h.tukar ? ', tukar barang' : '') +
      (h.refund > 0 ? `, refund ${formatRupiah(h.refund)}` : '') +
      (otomatis ? ' (diajukan & disetujui sendiri, K-017)' : ''),
    ip: asal.ip,
  });
}

export async function setujuiRetur(
  id: number,
  persetujuan: DataSetujui,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisRetur> {
  await dalamTransaksi(async (tx) => {
    const r = await repo.kunci(tx, id);
    if (!r) throw new AppError('TIDAK_DITEMUKAN', 'Retur tidak ditemukan.', 404);
    if (r.status !== 'MENUNGGU') {
      throw new AppError('STATUS_TIDAK_VALID', `Retur ${r.nomor} sudah diputuskan.`, 409);
    }
    const h = await terapkan(tx, id, persetujuan, pelaku);
    await logSetujui(tx, id, r.nomor, h, pelaku, asal, false);
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
