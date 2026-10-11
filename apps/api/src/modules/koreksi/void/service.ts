import {
  formatRupiah,
  teksQty,
  type BarisVoid,
  type DaftarVoid,
  type DataKodePersetujuan,
  type DataSetujui,
  type DataVoid,
  type InfoKodePersetujuan,
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
  batalkanSuratJalanBelumBerangkat,
  catatRefund,
  kelebihanBayar,
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
 * Void transaksi (docs/05 §9 V1–V7, docs/04 §6). Pengajuan Kasir → MENUNGGU, kecuali disetujui atasan di tempat
 * atau nilainya di bawah batas bebas (K-099); Admin/Owner (void.setujui) langsung DISETUJUI (K-017). Efek hanya
 * saat DISETUJUI: stok kembali (mutasi VOID), baris VOID, total_void, refund kelebihan bayar, surat jalan belum
 * berangkat dibatalkan. Pengajuan yang masih MENUNGGU bisa dibatalkan pengajunya.
 */

/** K-099: nilai void per transaksi yang boleh diproses tanpa atasan (0 = selalu butuh persetujuan). */
const KUNCI_BATAS_BEBAS = 'batas_void_tanpa_persetujuan';

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
  const barisPer = new Map<number, Awaited<ReturnType<typeof repo.barisPenjualan>>>();
  for (const b of await repo.barisPenjualan(
    db,
    rows.map((r) => r.id),
  )) {
    barisPer.set(b.idPenjualan, [...(barisPer.get(b.idPenjualan) ?? []), b]);
  }
  const batas = await ambilAngka(KUNCI_BATAS_BEBAS, 0);
  const berjalan = await repo.nilaiBerjalan(
    db,
    rows.map((r) => r.id),
  );
  for (const r of rows) {
    const baris = barisPer.get(r.id) ?? [];
    hasil.push({
      ...r,
      tanggal: r.tanggal.toISOString(),
      sisaTagihan: r.sisaTagihan ?? 0,
      sisaBatasBebas: Math.max(0, batas - (berjalan.get(r.id) ?? 0)),
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
  if (idDetail.some((d) => h.detailDisetor.has(d))) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Barang titipan penjualan ${pj.nomor} sudah disetor ke pemasok; void tidak bisa.${saran}`,
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
  oleh: Persetujuan,
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
      idPengguna: oleh.idPenyetuju,
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
    pelaku: oleh.kasir,
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
    idPenyetuju: oleh.idPenyetuju,
    caraPersetujuan: oleh.cara,
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
  const berwenang = pelaku.izin.has('void.setujui');
  const id = await dalamTransaksi(async (tx) => {
    const pj = await pjRepo.kunciPenjualan(tx, input.idPenjualan);
    if (!pj) throw new AppError('TIDAK_DITEMUKAN', 'Penjualan tidak ditemukan.', 404);
    // V1 lebih dulu agar pesan menyebut alasannya (shift tutup, sudah diretur, sudah dikirim).
    await periksaSyarat(tx, pj, input.idDetail, null);
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
    const nominal = dipilih.reduce((t, b) => t + b.subtotal, 0);
    // K-099: batas bebas dihitung per transaksi (void sebelumnya ikut dijumlah), sebelum dokumen ini ditulis.
    const batas = await ambilAngka(KUNCI_BATAS_BEBAS, 0, tx);
    const berjalan = (await repo.nilaiBerjalan(tx, [pj.id])).get(pj.id) ?? 0;
    const langsung = persetujuanLangsung({
      pengaju: pelaku,
      berwenang,
      batasBebas: batas > 0 && berjalan + nominal <= batas ? batas : null,
    });
    const nomor = await terbitkanNomor(tx, 'VD', tanggalOperasional());
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
    if (langsung) {
      const h = await terapkan(tx, idVoid, nomor, input.persetujuan, langsung);
      await logSetujui(tx, idVoid, nomor, h, langsung, asal);
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
  oleh: Persetujuan,
  asal: AsalRequest,
) {
  await catatLog(tx, {
    aksi: 'VOID_SETUJUI',
    idPengguna: oleh.idPenyetuju,
    entitas: 'void_transaksi',
    idEntitas: idVoid,
    nomorDokumen: nomor,
    ringkasan:
      `Setujui void ${nomor} (${h.nomorPenjualan}): ${formatRupiah(h.nominalVoid)}` +
      (h.nominalRefund > 0 ? `, refund ${formatRupiah(h.nominalRefund)}` : '') +
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
): Promise<BarisVoid> {
  await dalamTransaksi(async (tx) => {
    const v = await repo.kunci(tx, id);
    if (!v) throw new AppError('TIDAK_DITEMUKAN', 'Void tidak ditemukan.', 404);
    if (v.status !== 'MENUNGGU') {
      throw new AppError('STATUS_TIDAK_VALID', `Void ${v.nomor} sudah diputuskan.`, 409);
    }
    // Kode sekali pakai hangus bersama persetujuannya (batal bersama bila transaksi gagal).
    if (kode) await pakaiKode(tx, kode);
    const h = await terapkan(tx, id, v.nomor, persetujuan, oleh);
    await logSetujui(tx, id, v.nomor, h, oleh, asal);
  });
  return detailVoid(id);
}

/** Atasan menyetujui dari akunnya sendiri (tab Persetujuan). */
export function setujuiVoid(
  id: number,
  persetujuan: DataSetujui,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisVoid> {
  return setujui(id, persetujuan, persetujuanAkunAtasan(pelaku), asal);
}

/** K-102: mengirim kode sekali pakai ke Admin/Owner untuk pengajuan MENUNGGU milik pengaju. */
export async function mintaKodeVoid(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<InfoKodePersetujuan> {
  const v = await detailVoid(id);
  pastikanBolehMintaKode(v, pelaku);
  const barang = v.baris
    .map((b) => `${b.namaBarang} ${teksQty(b.qtyDasar)} ${b.kodeSatuan}`)
    .join(', ');
  return mintaKode(
    {
      jenis: 'VOID',
      izin: 'void.setujui',
      pengaju: pelaku,
      rujukan: { idVoid: id },
      idEntitas: id,
      nomorDokumen: v.nomor,
      nilai: v.nominalVoid,
      ringkasan:
        `Void ${v.nomor} atas ${v.nomorPenjualan} ` +
        `(${v.lingkup === 'TRANSAKSI' ? 'seluruh transaksi' : 'sebagian barang'}): ${barang}. ` +
        `Nilai ${formatRupiah(v.nominalVoid)}. Alasan: ${v.alasan}.`,
    },
    asal,
  );
}

/** K-102: pengaju mengetik kode dari atasan; void disetujui atas nama pemilik kode itu. */
export async function setujuiVoidDenganKode(
  id: number,
  persetujuan: DataSetujui,
  kode: DataKodePersetujuan,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisVoid> {
  const sah = await periksaKode(
    {
      ...kode,
      jenis: 'VOID',
      izin: 'void.setujui',
      pengaju: pelaku,
      cocok: (m) => m.idVoid === id,
    },
    asal,
  );
  return setujui(id, persetujuan, persetujuanDiTempat(sah.atasan, pelaku), asal, sah);
}

/** K-099: pengajuan MENUNGGU ditarik (salah input); tanpa efek stok, kas, atau tagihan. */
export async function batalVoid(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<BarisVoid> {
  await dalamTransaksi(async (tx) => {
    const v = await repo.kunci(tx, id);
    if (!v) throw new AppError('TIDAK_DITEMUKAN', 'Void tidak ditemukan.', 404);
    pastikanBolehBatal(v, pelaku, pelaku.izin.has('void.setujui'));
    const waktu = sekarang();
    await repo.ubahHeader(tx, id, {
      status: 'DIBATALKAN',
      alasanPenolakan: alasan,
      idPenyetuju: pelaku.id,
      waktuPersetujuan: waktu,
      diubahPada: waktu,
    });
    await catatLog(tx, {
      aksi: 'VOID_BATAL',
      idPengguna: pelaku.id,
      entitas: 'void_transaksi',
      idEntitas: id,
      nomorDokumen: v.nomor,
      ringkasan: `Batalkan pengajuan void ${v.nomor}: ${alasan}`,
      ip: asal.ip,
    });
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
