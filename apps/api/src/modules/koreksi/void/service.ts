import {
  formatRupiah,
  type BarisVoid,
  type DaftarVoid,
  type DataSetujui,
  type DataVoid,
  type KandidatVoid,
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
import {
  batalkanSuratJalanBelumBerangkat,
  catatRefund,
  kelebihanBayar,
  simpanTagihan,
} from '../umum';
import * as repo from './repo';

/*
 * Void transaksi (docs/05 §9 V1–V7, docs/04 §6). Pengajuan Kasir → MENUNGGU; Admin/Owner (void.setujui)
 * langsung DISETUJUI (K-017). Efek hanya saat DISETUJUI: stok kembali (mutasi VOID), baris VOID, total_void,
 * refund kelebihan bayar, surat jalan belum berangkat dibatalkan.
 */

type Header = NonNullable<Awaited<ReturnType<typeof repo.byId>>>;

async function keRespons(rows: Header[]): Promise<BarisVoid[]> {
  const det = await repo.detail(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    tanggal: r.tanggal.toISOString(),
    waktuPersetujuan: r.waktuPersetujuan?.toISOString() ?? null,
    baris: det
      .filter((d) => d.idVoid === r.id)
      .map((d) => ({
        namaBarang: d.namaBarang,
        qtyDasar: d.qtyDasar,
        kodeSatuan: d.kodeSatuan,
        nominal: d.nominal,
      })),
  }));
}

export async function daftarVoid(
  p: repo.SaringVoid & { halaman: number; perHalaman: number },
): Promise<DaftarVoid> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: await keRespons(baris), meta: metaHalaman(total, p) };
}

export async function detailVoid(id: number): Promise<BarisVoid> {
  const h = await repo.byId(db, id);
  if (!h) throw new AppError('TIDAK_DITEMUKAN', 'Void tidak ditemukan.', 404);
  const [r] = await keRespons([h]);
  if (!r) throw new Error('void hilang');
  return r;
}

export async function kandidatVoid(cari: string | undefined): Promise<KandidatVoid[]> {
  const rows = await repo.kandidat(db, cari, tanggalOperasional());
  const hasil: KandidatVoid[] = [];
  for (const r of rows) {
    const baris = await repo.barisPenjualan(db, r.id);
    hasil.push({
      ...r,
      tanggal: r.tanggal.toISOString(),
      sisaTagihan: r.sisaTagihan ?? 0,
      baris: baris.map((b) => ({
        id: b.id,
        namaBarang: b.namaBarang,
        qty: b.qty,
        kodeSatuan: b.kodeSatuan,
        subtotal: b.subtotal,
        statusItem: b.statusItem,
      })),
    });
  }
  return hasil;
}

/** V1: syarat void dinilai saat pengajuan DAN saat persetujuan (keadaan bisa berubah di antaranya). */
async function periksaSyarat(
  tx: Tx,
  pj: NonNullable<Awaited<ReturnType<typeof pjRepo.kunciPenjualan>>>,
  idDetail: number[],
  idVoidSendiri: number | null,
) {
  const saran = ' Gunakan retur.';
  if (pj.statusTransaksi === 'VOID') {
    throw new AppError('STATUS_TIDAK_VALID', `Penjualan ${pj.nomor} sudah di-void.`, 409);
  }
  const h = await repo.halanganVoid(tx, pj.id, pj.idShift);
  if (pj.idShift ? h.statusShift !== 'BUKA' : pj.tanggalOperasional !== tanggalOperasional()) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Shift penjualan ${pj.nomor} sudah ditutup; void tidak bisa.${saran}`,
      409,
    );
  }
  if (h.adaRetur) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Penjualan ${pj.nomor} sudah punya retur.${saran}`,
      409,
    );
  }
  if (h.adaKirim) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Barang penjualan ${pj.nomor} sudah dikirim; void tidak bisa.${saran}`,
      409,
    );
  }
  if (idVoidSendiri === null && idDetail.some((d) => h.detailMenunggu.has(d))) {
    throw new AppError(
      'KONFLIK',
      'Sebagian barang ini sudah diajukan void dan masih menunggu persetujuan.',
      409,
    );
  }
}

/** V4/V5: efek void yang disetujui, dalam transaksi pemanggil. */
async function terapkan(
  tx: Tx,
  idVoid: number,
  nomorVoid: string,
  persetujuan: DataSetujui,
  pelaku: PenggunaAktif,
) {
  const v = await repo.kunci(tx, idVoid);
  if (!v) throw new AppError('TIDAK_DITEMUKAN', 'Void tidak ditemukan.', 404);
  const pj = await pjRepo.kunciPenjualan(tx, v.idPenjualan);
  if (!pj) throw new Error('penjualan hilang');
  const det = await repo.detail(tx, [idVoid]);
  await periksaSyarat(
    tx,
    pj,
    det.map((d) => d.idPenjualanDetail),
    idVoid,
  );
  const baris = await repo.barisPenjualan(tx, pj.id);
  const hpp = new Map(baris.map((b) => [b.id, b.hppSaatTransaksi]));
  const sudahVoid = baris.find((b) =>
    det.some((d) => d.idPenjualanDetail === b.id && b.statusItem !== 'NORMAL'),
  );
  if (sudahVoid) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `${sudahVoid.namaBarang} sudah tidak berstatus normal (void/retur).`,
      409,
    );
  }
  const tanggal = tanggalOperasional();
  for (const d of [...det].sort((a, b) => a.idBarang - b.idBarang)) {
    await catatMutasi(tx, {
      idBarang: d.idBarang,
      jenis: 'VOID',
      qtyMasuk: d.qtyDasar,
      hppSatuan: hpp.get(d.idPenjualanDetail) ?? 0,
      sumber: { idVoidDetail: await idDetailVoid(tx, idVoid, d.idPenjualanDetail) },
      idPengguna: pelaku.id,
      tanggalOperasional: tanggal,
      keterangan: `Void ${nomorVoid} (${pj.nomor})`,
    });
  }
  await repo.tandaiBarisVoid(
    tx,
    det.map((d) => d.idPenjualanDetail),
  );
  const semuaVoid = baris.every(
    (b) => b.statusItem === 'VOID' || det.some((d) => d.idPenjualanDetail === b.id),
  );
  // V2 + K-076: nominal = Σ subtotal baris; bila seluruh baris jadi VOID = seluruh sisa tagihan (termasuk
  // ongkir dan efek diskon transaksi) agar tagihan tepat 0 dan tidak melebihi total neto.
  const sisaBasis = pj.totalNeto - pj.totalVoid - pj.totalRetur;
  const nominalVoid = semuaVoid
    ? sisaBasis
    : Math.min(
        sisaBasis,
        det.reduce((t, d) => t + d.nominal, 0),
      );
  const nilai = { ...pj, totalVoid: pj.totalVoid + nominalVoid };
  const nominalRefund = kelebihanBayar(nilai);
  const idShift = await catatRefund(tx, {
    nominal: nominalRefund,
    persetujuan,
    pelaku,
    jenis: 'REFUND_VOID',
    nomorDokumen: nomorVoid,
    nomorPenjualan: pj.nomor,
    idVoid,
  });
  const akhir = { ...nilai, totalRefund: nilai.totalRefund + nominalRefund };
  await simpanTagihan(tx, pj.id, akhir, semuaVoid ? 'VOID' : 'VOID_SEBAGIAN');
  await batalkanSuratJalanBelumBerangkat(tx, pj.id, 'VOID');
  const waktu = sekarang();
  await repo.ubahHeader(tx, idVoid, {
    status: 'DISETUJUI',
    idPenyetuju: pelaku.id,
    waktuPersetujuan: waktu,
    nominalVoid,
    nominalRefund,
    metodeRefund: nominalRefund > 0 ? persetujuan.metodeRefund : null,
    idShift,
    keterangan:
      nominalRefund > 0 && persetujuan.metodeRefund === 'TRANSFER'
        ? `Refund ke ${persetujuan.rekeningRefund ?? '-'}${persetujuan.referensiRefund ? ` (${persetujuan.referensiRefund})` : ''}`.slice(
            0,
            150,
          )
        : null,
    diubahPada: waktu,
  });
  return { nominalVoid, nominalRefund, sisa: hitungTagihan(akhir).sisa, nomorPenjualan: pj.nomor };
}

async function idDetailVoid(tx: Tx, idVoid: number, idPenjualanDetail: number): Promise<number> {
  const id = (await repo.idDetail(tx, idVoid, idPenjualanDetail)) ?? null;
  if (id === null) throw new Error('detail void hilang');
  return id;
}

export async function ajukanVoid(
  input: DataVoid,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisVoid> {
  const id = await dalamTransaksi(async (tx) => {
    const pj = await pjRepo.kunciPenjualan(tx, input.idPenjualan);
    if (!pj) throw new AppError('TIDAK_DITEMUKAN', 'Penjualan tidak ditemukan.', 404);
    const baris = await repo.barisPenjualan(tx, pj.id);
    const normal = baris.filter((b) => b.statusItem === 'NORMAL');
    const dipilih =
      input.lingkup === 'TRANSAKSI'
        ? normal
        : input.idDetail.map((idD) => {
            const b = baris.find((x) => x.id === idD);
            if (!b) throw new AppError('VALIDASI', 'Barang tidak ada di transaksi ini.', 400);
            if (b.statusItem !== 'NORMAL') {
              throw new AppError(
                'STATUS_TIDAK_VALID',
                `${b.namaBarang} sudah di-void atau diretur.`,
                409,
              );
            }
            return b;
          });
    if (dipilih.length === 0) {
      throw new AppError('STATUS_TIDAK_VALID', 'Tidak ada barang yang bisa di-void.', 409);
    }
    await periksaSyarat(
      tx,
      pj,
      dipilih.map((b) => b.id),
      null,
    );
    const nomor = await terbitkanNomor(tx, 'VD', tanggalOperasional());
    const nominal = dipilih.reduce((t, b) => t + b.subtotal, 0);
    const idVoid = await repo.tambahHeader(tx, {
      nomor,
      idPenjualan: pj.id,
      lingkup: input.lingkup,
      tanggalOperasional: tanggalOperasional(),
      idPengaju: pelaku.id,
      alasan: input.alasan,
      nominalVoid: nominal,
    });
    await repo.tambahDetail(
      tx,
      dipilih.map((b) => ({
        idVoid,
        idPenjualanDetail: b.id,
        idBarang: b.idBarang,
        qtyDasar: b.qtyDasar,
        nominal: b.subtotal,
      })),
    );
    await catatLog(tx, {
      aksi: 'VOID_AJUKAN',
      idPengguna: pelaku.id,
      entitas: 'void_transaksi',
      idEntitas: idVoid,
      nomorDokumen: nomor,
      ringkasan: `Ajukan void ${input.lingkup.toLowerCase()} ${pj.nomor}: ${dipilih.length} barang, ${formatRupiah(nominal)} — ${input.alasan}`,
      ip: asal.ip,
    });
    // K-017: pengaju yang berhak menyetujui → langsung disetujui.
    if (pelaku.izin.has('void.setujui')) {
      const h = await terapkan(tx, idVoid, nomor, input.persetujuan, pelaku);
      await logSetujui(tx, idVoid, nomor, h, pelaku, asal, true);
    }
    return idVoid;
  });
  return detailVoid(id);
}

async function logSetujui(
  tx: Tx,
  idVoid: number,
  nomor: string,
  h: Awaited<ReturnType<typeof terapkan>>,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  otomatis: boolean,
) {
  await catatLog(tx, {
    aksi: 'VOID_SETUJUI',
    idPengguna: pelaku.id,
    entitas: 'void_transaksi',
    idEntitas: idVoid,
    nomorDokumen: nomor,
    ringkasan:
      `Setujui void ${nomor} (${h.nomorPenjualan}): ${formatRupiah(h.nominalVoid)}` +
      (h.nominalRefund > 0 ? `, refund ${formatRupiah(h.nominalRefund)}` : '') +
      (otomatis ? ' (diajukan & disetujui sendiri, K-017)' : ''),
    ip: asal.ip,
  });
}

export async function setujuiVoid(
  id: number,
  persetujuan: DataSetujui,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisVoid> {
  await dalamTransaksi(async (tx) => {
    const v = await repo.kunci(tx, id);
    if (!v) throw new AppError('TIDAK_DITEMUKAN', 'Void tidak ditemukan.', 404);
    if (v.status !== 'MENUNGGU') {
      throw new AppError('STATUS_TIDAK_VALID', `Void ${v.nomor} sudah diputuskan.`, 409);
    }
    const h = await terapkan(tx, id, v.nomor, persetujuan, pelaku);
    await logSetujui(tx, id, v.nomor, h, pelaku, asal, false);
  });
  return detailVoid(id);
}

/** V7: tolak dengan alasan; tidak ada efek. */
export async function tolakVoid(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisVoid> {
  await dalamTransaksi(async (tx) => {
    const v = await repo.kunci(tx, id);
    if (!v) throw new AppError('TIDAK_DITEMUKAN', 'Void tidak ditemukan.', 404);
    if (v.status !== 'MENUNGGU') {
      throw new AppError('STATUS_TIDAK_VALID', `Void ${v.nomor} sudah diputuskan.`, 409);
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
      aksi: 'VOID_TOLAK',
      idPengguna: pelaku.id,
      entitas: 'void_transaksi',
      idEntitas: id,
      nomorDokumen: v.nomor,
      ringkasan: `Tolak void ${v.nomor}: ${alasan}`,
      ip: asal.ip,
    });
  });
  return detailVoid(id);
}

export function jumlahVoidMenunggu(): Promise<number> {
  return repo.jumlahMenunggu(db);
}
