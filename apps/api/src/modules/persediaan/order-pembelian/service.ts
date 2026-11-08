import {
  bandingQty,
  formatRupiah,
  keQty,
  kekuranganKesepakatan,
  kurangQty,
  nomorHari,
  tambahQty,
  type BarisDaftarOrderPembelian,
  type BarisOrderPembelianDetail,
  type DataAkhiriOrderPembelian,
  type DataKonfirmasiOrderPembelian,
  type DataOrderPembelian,
  type DataUangMukaOrderPembelian,
  type DetailOrderPembelian,
  type Izin,
  type MetaHalaman,
  type skemaCariOrderPembelian,
  type StatusOrderPembelian,
  type TindakanTolak,
} from '@sit/shared';
import { eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { db, type Tx } from '../../../db/client';
import {
  barang,
  orderPembelian,
  orderPembelianDetail,
  pemasok,
  penerimaanBarangTolak,
} from '../../../db/schema';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatKas, shiftUntukCatat } from '../../kas/shift/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { pastikanDeposit } from '../../hutang/deposit';
import { pastikanRekeningPemasok } from '../../hutang/rekening';
import { tambahPembayaran } from '../penerimaan/repo';
import { hitungPersetujuan, infoPersetujuan, pastikanKesepakatan } from './persetujuan';
import * as repo from './repo';

/*
 * K-125 order pembelian ke pemasok (docs/05 §21 PO1–PO9). Alur: DRAF → DIPESAN (nomor terbit) → DIKONFIRMASI →
 * SEBAGIAN/SELESAI lewat Penerimaan Barang; DITUTUP (sisa tidak dikirim) atau BATAL (belum ada barang datang).
 * Stok tidak berubah oleh PO; hutang tetap lahir dari penerimaan.
 */

const BERJALAN: StatusOrderPembelian[] = ['DIPESAN', 'DIKONFIRMASI', 'SEBAGIAN'];

const bolehHarga = (izin: ReadonlySet<Izin>) => izin.has('master.barang.lihat_hpp');

function keBaris(b: repo.BarisPO, nilai: boolean, hariIni: string): BarisDaftarOrderPembelian {
  return {
    id: b.id,
    nomor: b.nomor,
    tanggal: b.tanggal.toISOString(),
    idPemasok: b.idPemasok,
    namaPemasok: b.namaPemasok,
    status: b.status,
    tanggalDipesan: b.tanggalDipesan,
    tanggalJanjiKirim: b.tanggalJanjiKirim,
    terlambat:
      BERJALAN.includes(b.status) && b.tanggalJanjiKirim !== null && b.tanggalJanjiKirim < hariIni,
    jumlahBarang: b.jumlahBarang,
    namaPembuat: b.namaPembuat,
    ...(nilai ? { totalPerkiraan: Math.round(Number(b.totalPerkiraan)) } : {}),
  };
}

export async function daftarPO(
  p: z.output<typeof skemaCariOrderPembelian>,
  izin: ReadonlySet<Izin>,
): Promise<{ data: BarisDaftarOrderPembelian[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  const hariIni = tanggalOperasional();
  return {
    data: baris.map((b) => keBaris(b, bolehHarga(izin), hariIni)),
    meta: metaHalaman(total, p),
  };
}

export async function detailPO(id: number, izin: ReadonlySet<Izin>): Promise<DetailOrderPembelian> {
  const b = await repo.satu(db, id);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', 'Order pembelian tidak ditemukan.', 404);
  const nilai = bolehHarga(izin);
  const [baris, um, terima, mentah] = await Promise.all([
    repo.detail(db, id),
    repo.uangMuka(db, id),
    repo.penerimaan(db, id),
    db.select().from(orderPembelian).where(eq(orderPembelian.id, id)),
  ]);
  const po = mentah[0];
  if (!po) throw new AppError('TIDAK_DITEMUKAN', 'Order pembelian tidak ditemukan.', 404);
  const hariIni = tanggalOperasional();
  const penerimaanPO = terima.map((t) => {
    const sisa = t.totalFaktur - t.dibayar - t.returPotong;
    const lewat =
      t.tanggalJatuhTempo && sisa > 0 ? nomorHari(hariIni) - nomorHari(t.tanggalJatuhTempo) : null;
    return {
      id: t.id,
      nomor: t.nomor,
      tanggal: t.tanggal,
      totalFaktur: nilai ? t.totalFaktur : 0,
      dibayar: nilai ? t.dibayar : 0,
      sisa: nilai ? sisa : 0,
      statusHutang: t.statusHutang,
      tanggalJatuhTempo: t.tanggalJatuhTempo,
      hariLewat: lewat,
      penyimpanganBayar: t.penyimpanganBayar,
    };
  });
  return {
    ...keBaris(b, nilai, tanggalOperasional()),
    persetujuan: await infoPersetujuan(db, po),
    kesepakatan: {
      syaratBayar: po.syaratBayar,
      tempoHari: po.tempoHari,
      uangMukaRencana: nilai ? po.uangMukaRencana : 0,
      tanggalKirimDiminta: po.tanggalKirimDiminta,
      caraKirim: po.caraKirim,
      metodeBayarRencana: po.metodeBayarRencana,
      tanggalJanjiAwal: po.tanggalJanjiAwal,
      jumlahUbahJanji: po.jumlahUbahJanji,
      kurang: ['DRAF', 'DIAJUKAN', 'DISETUJUI'].includes(po.status)
        ? kekuranganKesepakatan(po, (await hitungPersetujuan(db, id)).total, tanggalOperasional())
        : [],
    },
    catatan: b.catatan,
    alasanTutup: b.alasanTutup,
    baris: baris.map((d): BarisOrderPembelianDetail => {
      const berlaku = d.qtyKonfirmasi ?? d.qtyPesan;
      // K-237: sisa ditunggu = berlaku − diterima − bagian order yang dikurangi.
      const sisa = kurangQty(kurangQty(berlaku, d.qtyDiterima), d.qtyDipotong);
      return {
        id: d.id,
        idBarang: d.idBarang,
        kodeBarang: d.kodeBarang,
        namaBarang: d.namaBarang,
        kodeSatuan: d.kodeSatuan,
        qtyPesan: keQty(d.qtyPesan),
        qtyKonfirmasi: d.qtyKonfirmasi === null ? null : keQty(d.qtyKonfirmasi),
        qtyBerlaku: keQty(berlaku),
        qtyDiterima: keQty(d.qtyDiterima),
        qtyDitolak: keQty(d.qtyDitolak),
        qtyDipotong: keQty(d.qtyDipotong),
        qtySisa: bandingQty(sisa, 0) > 0 ? sisa : keQty(0),
        ...(nilai
          ? {
              hargaPerkiraan: d.hargaPerkiraan,
              hargaKonfirmasi: d.hargaKonfirmasi,
              hargaBerlaku: d.hargaKonfirmasi ?? d.hargaPerkiraan,
            }
          : {}),
      };
    }),
    uangMuka: nilai
      ? um.map((u) => ({
          nomor: u.nomor,
          tanggal: u.tanggal.toISOString(),
          nominal: u.nominal,
          metode: u.metode,
        }))
      : [],
    sisaUangMuka: nilai ? um.reduce((t, u) => t + u.nominal - Number(u.terpakai), 0) : 0,
    penerimaan: penerimaanPO,
    ringkasanUang: nilai ? ringkasan(penerimaanPO, um, Number(b.totalPerkiraan ?? 0)) : null,
    riwayat: (
      await repo.riwayat(
        db,
        id,
        terima.map((t) => t.id),
      )
    ).map((r) => ({
      waktu: r.waktu.toISOString(),
      aksi: r.aksi,
      nama: r.nama,
      ringkasan: r.ringkasan ?? '',
    })),
  };
}

async function pastikanPemasokDanBarang(tx: Tx, input: DataOrderPembelian) {
  const [pm] = await tx.select().from(pemasok).where(eq(pemasok.id, input.idPemasok));
  if (pm?.statusAktif !== 'AKTIF') {
    throw galatKolom('idPemasok', 'Pemasok tidak ditemukan atau nonaktif.');
  }
  const brg = await tx
    .select({
      id: barang.id,
      nama: barang.namaBarang,
      status: barang.statusAktif,
      kepemilikan: barang.kepemilikan,
    })
    .from(barang)
    .where(
      inArray(
        barang.id,
        input.baris.map((b) => b.idBarang),
      ),
    );
  const peta = new Map(brg.map((b) => [b.id, b]));
  input.baris.forEach((b, i) => {
    const x = peta.get(b.idBarang);
    if (x?.status !== 'AKTIF') {
      throw new AppError('VALIDASI', `Baris ${i + 1}: barang tidak ditemukan atau nonaktif.`, 400);
    }
    if (x.kepemilikan !== 'MILIK_SENDIRI') {
      throw new AppError(
        'VALIDASI',
        `Baris ${i + 1}: ${x.nama} barang titipan; tidak dipesan lewat order pembelian.`,
        400,
      );
    }
  });
  return pm;
}

/** K-236: kolom kesepakatan dari isian draf (DI_MUKA: uang muka rencana = seluruh nilai, tidak dipakai). */
function isianKesepakatan(input: DataOrderPembelian) {
  return {
    syaratBayar: input.syaratBayar,
    tempoHari: input.syaratBayar === 'TEMPO' ? input.tempoHari : null,
    uangMukaRencana: input.syaratBayar === 'DI_MUKA' ? 0 : input.uangMukaRencana,
    tanggalKirimDiminta: input.tanggalKirimDiminta,
    caraKirim: input.caraKirim,
    metodeBayarRencana: input.metodeBayarRencana,
  };
}

async function tulisBaris(tx: Tx, idPO: number, input: DataOrderPembelian) {
  await tx.insert(orderPembelianDetail).values(
    input.baris.map((b) => ({
      idOrderPembelian: idPO,
      idBarang: b.idBarang,
      qtyPesan: keQty(b.qty),
      hargaPerkiraan: b.harga,
    })),
  );
}

function pastikanHarga(pelaku: PenggunaAktif, input: DataOrderPembelian) {
  if (!bolehHarga(pelaku.izin) && input.baris.some((b) => b.harga > 0)) {
    throw new AppError('TIDAK_BERIZIN', 'Mengisi harga beli butuh izin melihat harga modal.', 403);
  }
}

/** K-238/K-235: ringkasan uang order untuk kartu rincian. */
function ringkasan(
  penerimaanPO: {
    totalFaktur: number;
    dibayar: number;
    sisa: number;
    tanggalJatuhTempo: string | null;
    hariLewat: number | null;
  }[],
  um: { nominal: number; terpakai: string | number }[],
  nilaiOrder: number,
): NonNullable<DetailOrderPembelian['ringkasanUang']> {
  const uangMukaDibayar = um.reduce((t, u) => t + u.nominal, 0);
  const uangMukaTerpakai = um.reduce((t, u) => t + Number(u.terpakai), 0);
  const nilaiDiterima = penerimaanPO.reduce((t, p) => t + p.totalFaktur, 0);
  const dibayarTotal = penerimaanPO.reduce((t, p) => t + p.dibayar, 0);
  const terbuka = penerimaanPO.filter((p) => p.sisa > 0);
  const jatuh = terbuka
    .map((p) => p.tanggalJatuhTempo)
    .filter((x): x is string => x !== null)
    .sort();
  const telat = terbuka.map((p) => p.hariLewat ?? -Infinity).filter((x) => x > 0);
  return {
    nilaiOrder,
    uangMukaDibayar,
    uangMukaTerpakai,
    uangMukaBelumTerpakai: uangMukaDibayar - uangMukaTerpakai,
    nilaiDiterima,
    dibayarSaatDatang: dibayarTotal - uangMukaTerpakai,
    sisaTagihan: terbuka.reduce((t, p) => t + p.sisa, 0),
    jatuhTempoTerdekat: jatuh[0] ?? null,
    terlambatHari: telat.length > 0 ? Math.max(...telat) : null,
  };
}

/** PO1: draf baru. */
export async function buatPO(
  input: DataOrderPembelian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrderPembelian> {
  pastikanHarga(pelaku, input);
  const id = await dalamTransaksi(async (tx) => {
    const pm = await pastikanPemasokDanBarang(tx, input);
    const [po] = await tx
      .insert(orderPembelian)
      .values({
        idPemasok: pm.id,
        idPembuat: pelaku.id,
        catatan: input.catatan ?? null,
        ...isianKesepakatan(input),
      })
      .returning({ id: orderPembelian.id });
    if (!po) throw new Error('insert order pembelian tidak mengembalikan id');
    await tulisBaris(tx, po.id, input);
    await catatLog(tx, {
      aksi: 'PO_BUAT',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: po.id,
      ringkasan: `Draf order pembelian ke ${pm.namaPemasok}: ${input.baris.length} barang`,
      ip: asal.ip,
    });
    return po.id;
  });
  return detailPO(id, pelaku.izin);
}

async function kunciPO(tx: Tx, id: number) {
  const po = await repo.kunci(tx, id);
  if (!po) throw new AppError('TIDAK_DITEMUKAN', 'Order pembelian tidak ditemukan.', 404);
  return po;
}

function wajibStatus(
  po: { status: StatusOrderPembelian },
  boleh: StatusOrderPembelian[],
  aksi: string,
) {
  if (!boleh.includes(po.status)) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      `Order pembelian berstatus ${po.status.toLowerCase()} tidak bisa ${aksi}.`,
      409,
    );
  }
}

/** PO1: draf boleh diubah (baris diganti seluruhnya). */
export async function ubahPO(
  id: number,
  input: DataOrderPembelian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrderPembelian> {
  pastikanHarga(pelaku, input);
  await dalamTransaksi(async (tx) => {
    const po = await kunciPO(tx, id);
    wajibStatus(po, ['DRAF'], 'diubah');
    const pm = await pastikanPemasokDanBarang(tx, input);
    await tx.delete(orderPembelianDetail).where(eq(orderPembelianDetail.idOrderPembelian, id));
    await tulisBaris(tx, id, input);
    await tx
      .update(orderPembelian)
      .set({
        idPemasok: pm.id,
        catatan: input.catatan ?? null,
        ...isianKesepakatan(input),
        diubahPada: sekarang(),
      })
      .where(eq(orderPembelian.id, id));
    await catatLog(tx, {
      aksi: 'PO_UBAH',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      ringkasan: `Ubah draf order pembelian ke ${pm.namaPemasok}: ${input.baris.length} barang`,
      ip: asal.ip,
    });
  });
  return detailPO(id, pelaku.izin);
}

/**
 * PO2: kirim ke pemasok: nomor terbit, isi terkunci, tanggal pesan dicatat. K-225: draf yang wajib disetujui harus
 * diajukan dan disetujui dulu (Owner boleh langsung mengirim).
 */
export async function kirimPO(id: number, pelaku: PenggunaAktif, asal: AsalRequest) {
  await dalamTransaksi(async (tx) => {
    const po = await kunciPO(tx, id);
    wajibStatus(po, ['DRAF', 'DISETUJUI'], 'dikirim');
    const h = await hitungPersetujuan(tx, id);
    pastikanKesepakatan(po, h.total, 'dikirim');
    if (po.status === 'DRAF' && pelaku.peran !== 'OWNER') {
      if (h.alasan.length > 0) {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          `Order ini wajib disetujui dulu (tekan Ajukan persetujuan). ${h.alasan.join(' ')}`,
          409,
        );
      }
    }
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'PO', tanggal);
    await tx
      .update(orderPembelian)
      .set({ status: 'DIPESAN', nomor, tanggalDipesan: tanggal, diubahPada: sekarang() })
      .where(eq(orderPembelian.id, id));
    await catatLog(tx, {
      aksi: 'PO_KIRIM',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      nomorDokumen: nomor,
      ringkasan: `Order pembelian ${nomor} dikirim ke pemasok`,
      ip: asal.ip,
    });
  });
  return detailPO(id, pelaku.izin);
}

/** PO3: jawaban pemasok: tanggal janji kirim; qty/harga baris bila berubah (angka pesanan tetap tersimpan). */
export async function konfirmasiPO(
  id: number,
  input: DataKonfirmasiOrderPembelian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  if (input.baris.some((b) => b.harga !== undefined) && !bolehHarga(pelaku.izin)) {
    throw new AppError('TIDAK_BERIZIN', 'Mengubah harga beli butuh izin melihat harga modal.', 403);
  }
  await dalamTransaksi(async (tx) => {
    const po = await kunciPO(tx, id);
    wajibStatus(po, ['DIPESAN', 'DIKONFIRMASI', 'SEBAGIAN'], 'dikonfirmasi');
    const baris = new Map((await repo.kunciDetail(tx, id)).map((d) => [d.id, d]));
    const berubah: string[] = [];
    for (const b of input.baris) {
      const d = baris.get(b.id);
      if (!d) throw new AppError('VALIDASI', 'Baris order pembelian tidak dikenal.', 400);
      const qty = b.qty === undefined ? d.qtyKonfirmasi : keQty(b.qty);
      if (qty !== null && bandingQty(qty, d.qtyDiterima) < 0) {
        throw new AppError(
          'VALIDASI',
          'Qty konfirmasi tidak boleh lebih kecil dari yang sudah diterima.',
          400,
        );
      }
      const harga = b.harga === undefined ? d.hargaKonfirmasi : b.harga;
      if (qty !== d.qtyKonfirmasi || harga !== d.hargaKonfirmasi) {
        berubah.push(`baris ${d.id}: qty ${d.qtyPesan}→${qty ?? d.qtyPesan}`);
        await tx
          .update(orderPembelianDetail)
          .set({ qtyKonfirmasi: qty, hargaKonfirmasi: harga })
          .where(eq(orderPembelianDetail.id, d.id));
      }
    }
    await tx
      .update(orderPembelian)
      .set({
        status: po.status === 'DIPESAN' ? 'DIKONFIRMASI' : po.status,
        tanggalJanjiKirim: input.tanggalJanjiKirim,
        // K-238: janji pertama disimpan; setiap perubahan janji dihitung (ketepatan pemasok).
        tanggalJanjiAwal: po.tanggalJanjiAwal ?? input.tanggalJanjiKirim,
        jumlahUbahJanji:
          po.tanggalJanjiKirim !== null && po.tanggalJanjiKirim !== input.tanggalJanjiKirim
            ? po.jumlahUbahJanji + 1
            : po.jumlahUbahJanji,
        diubahPada: sekarang(),
      })
      .where(eq(orderPembelian.id, id));
    await catatLog(tx, {
      aksi: 'PO_KONFIRMASI',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      nomorDokumen: po.nomor ?? undefined,
      ringkasan:
        `Konfirmasi ${po.nomor}: janji kirim ${input.tanggalJanjiKirim}` +
        (berubah.length ? `; ${berubah.length} baris berubah` : ''),
      dataBaru: berubah.length ? { berubah } : undefined,
      ip: asal.ip,
    });
  });
  return detailPO(id, pelaku.izin);
}

/** PO4: uang muka (pembayaran pemasok terhubung PO). TUNAI keluar dari laci shift terbuka. */
export async function uangMukaPO(
  id: number,
  input: DataUangMukaOrderPembelian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  await dalamTransaksi(async (tx) => {
    const po = await kunciPO(tx, id);
    // K-238: uang muka hanya sebelum barang pertama datang; sesudahnya bayar lewat tagihan (Hutang Pemasok).
    if (po.status === 'SEBAGIAN') {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        'Barang order ini sudah datang. Pembayaran berikutnya lewat tagihan (Bayar tagihan / Hutang Pemasok).',
        409,
      );
    }
    wajibStatus(po, ['DIPESAN', 'DIKONFIRMASI'], 'diberi uang muka');
    const shift = input.metode === 'TUNAI' ? await shiftUntukCatat(tx) : null;
    if (input.metode === 'TUNAI' && !shift) {
      throw new AppError(
        'KONFLIK',
        'Bayar tunai butuh shift toko terbuka. Buka shift dulu, atau pilih transfer.',
        409,
        { kolom: { metode: ['Butuh shift terbuka.'] } },
      );
    }
    if (input.metode === 'DEPOSIT') await pastikanDeposit(tx, po.idPemasok, input.nominal);
    if (input.metode === 'TRANSFER') {
      await pastikanRekeningPemasok(tx, po.idPemasok, input.rekening, pelaku);
    }
    const tanggal = tanggalOperasional();
    const nomor = await terbitkanNomor(tx, 'PBP', tanggal);
    const idBayar = await tambahPembayaran(tx, {
      nomor,
      tanggalOperasional: tanggal,
      idPemasok: po.idPemasok,
      idOrderPembelian: id,
      idPengguna: pelaku.id,
      idShift: shift?.id ?? null,
      nominal: input.nominal,
      metode: input.metode,
      rekening: input.rekening ?? null,
      referensi: input.referensi ?? null,
      catatan: `Uang muka ${po.nomor ?? ''}`,
    });
    if (shift) {
      await catatKas(tx, {
        jenis: 'BAYAR_PEMASOK',
        nominal: input.nominal,
        pelaku,
        keterangan: `${nomor}: uang muka ${po.nomor ?? ''}`,
        idPembayaranPemasok: idBayar,
      });
    }
    await catatLog(tx, {
      aksi: 'PO_UANG_MUKA',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      nomorDokumen: nomor,
      ringkasan: `Uang muka ${po.nomor}: ${formatRupiah(input.nominal)} ${input.metode.toLowerCase()}`,
      ip: asal.ip,
    });
  });
  return detailPO(id, pelaku.izin);
}

/**
 * PO5 (dipanggil dari simpan penerimaan, di transaksi yang sama): kunci PO, cocokkan baris, perbarui cache
 * qty_diterima dan status, lalu pakai sisa uang muka untuk faktur ini. Mengembalikan nominal uang muka terpakai.
 */
export async function terimaDariPO(
  tx: Tx,
  k: {
    idPO: number;
    idPemasok: number;
    idPenerimaan: number;
    totalFaktur: number;
    baris: {
      idOrderPembelianDetail?: number | null | undefined;
      idBarang: number;
      qty: string;
      /** K-237: datang tetapi ditolak. */
      ditolak?: string;
      alasanTolak?: string | null;
      tindakanTolak?: TindakanTolak | null;
    }[];
    pelaku: PenggunaAktif;
    tanggal: string;
  },
): Promise<{ nomorPO: string; uangMukaTerpakai: number }> {
  const po = await kunciPO(tx, k.idPO);
  if (po.idPemasok !== k.idPemasok) {
    throw galatKolom('idOrderPembelian', 'Order pembelian ini untuk pemasok lain.');
  }
  wajibStatus(po, BERJALAN, 'diterima barangnya');
  const detail = await repo.kunciDetail(tx, k.idPO);
  const peta = new Map(detail.map((d) => [d.id, d]));
  for (const [i, b] of k.baris.entries()) {
    const tolak = keQty(b.ditolak ?? '0');
    if (!b.idOrderPembelianDetail) {
      if (bandingQty(tolak, 0) > 0) {
        throw new AppError('VALIDASI', `Baris ${i + 1}: barang ditolak harus baris order.`, 400);
      }
      continue;
    }
    const d = peta.get(b.idOrderPembelianDetail);
    if (d?.idBarang !== b.idBarang) {
      throw new AppError('VALIDASI', `Baris ${i + 1}: tidak cocok dengan order pembelian.`, 400);
    }
    const diterima = tambahQty(d.qtyDiterima, b.qty);
    // K-237: ditolak dicatat (append-only) dan cache baris order diperbarui di transaksi yang sama.
    let ditolak = d.qtyDitolak;
    let dipotong = d.qtyDipotong;
    if (bandingQty(tolak, 0) > 0) {
      await tx.insert(penerimaanBarangTolak).values({
        idPenerimaan: k.idPenerimaan,
        idBarang: b.idBarang,
        idOrderPembelianDetail: d.id,
        qty: tolak,
        alasan: b.alasanTolak ?? '',
        tindakan: b.tindakanTolak ?? 'GANTI',
      });
      ditolak = tambahQty(ditolak, tolak);
      if (b.tindakanTolak === 'POTONG') dipotong = tambahQty(dipotong, tolak);
    }
    await tx
      .update(orderPembelianDetail)
      .set({ qtyDiterima: diterima, qtyDitolak: ditolak, qtyDipotong: dipotong })
      .where(eq(orderPembelianDetail.id, d.id));
    d.qtyDiterima = diterima;
    d.qtyDipotong = dipotong;
  }
  // Lengkap bila diterima + bagian order yang dikurangi sudah mencapai qty berlaku.
  const lengkap = detail.every(
    (d) => bandingQty(tambahQty(d.qtyDiterima, d.qtyDipotong), d.qtyKonfirmasi ?? d.qtyPesan) >= 0,
  );
  await tx
    .update(orderPembelian)
    .set({ status: lengkap ? 'SELESAI' : 'SEBAGIAN', diubahPada: sekarang() })
    .where(eq(orderPembelian.id, k.idPO));

  // Uang muka dipakai berurutan (yang paling lama dulu) sampai faktur tertutup.
  let sisaFaktur = k.totalFaktur;
  let terpakai = 0;
  for (const u of await repo.uangMuka(tx, k.idPO)) {
    const sisa = u.nominal - Number(u.terpakai);
    if (sisa <= 0 || sisaFaktur <= 0) continue;
    const pakai = Math.min(sisa, sisaFaktur);
    await repo.tambahAlokasi(tx, {
      idPembayaranPemasok: u.id,
      jenis: 'DIPAKAI',
      idPenerimaan: k.idPenerimaan,
      nominal: pakai,
      idPengguna: k.pelaku.id,
      tanggalOperasional: k.tanggal,
    });
    sisaFaktur -= pakai;
    terpakai += pakai;
  }
  return { nomorPO: po.nomor ?? '', uangMukaTerpakai: terpakai };
}

/** PO6: tutup sisa (sudah ada barang datang) atau batal (belum ada). Sisa uang muka dicatat dikembalikan. */
export async function akhiriPO(
  id: number,
  jenis: 'TUTUP' | 'BATAL',
  input: DataAkhiriOrderPembelian,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  await dalamTransaksi(async (tx) => {
    const po = await kunciPO(tx, id);
    if (jenis === 'BATAL') {
      wajibStatus(po, ['DRAF', 'DIAJUKAN', 'DISETUJUI', 'DIPESAN', 'DIKONFIRMASI'], 'dibatalkan');
      if ((await repo.penerimaan(tx, id)).length > 0) {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          'Sudah ada barang diterima dari order ini; pakai Tutup sisa.',
          409,
        );
      }
    } else {
      wajibStatus(po, ['SEBAGIAN'], 'ditutup');
    }
    const tanggal = tanggalOperasional();
    const um = await repo.uangMuka(tx, id);
    const sisa = um.reduce((t, u) => t + u.nominal - Number(u.terpakai), 0);
    if (sisa > 0) {
      if (!input.metodeKembali) {
        throw galatKolom(
          'metodeKembali',
          `Ada sisa uang muka ${formatRupiah(sisa)}: pilih cara pemasok mengembalikannya.`,
        );
      }
      const shift = input.metodeKembali === 'TUNAI' ? await shiftUntukCatat(tx) : null;
      if (input.metodeKembali === 'TUNAI' && !shift) {
        throw new AppError(
          'KONFLIK',
          'Uang kembali tunai butuh shift toko terbuka. Buka shift dulu, atau pilih transfer.',
          409,
        );
      }
      for (const u of um) {
        const s = u.nominal - Number(u.terpakai);
        if (s <= 0) continue;
        await repo.tambahAlokasi(tx, {
          idPembayaranPemasok: u.id,
          jenis: 'DIKEMBALIKAN',
          nominal: s,
          metodeKembali: input.metodeKembali,
          idShift: shift?.id ?? null,
          idPengguna: pelaku.id,
          tanggalOperasional: tanggal,
        });
      }
      if (shift) {
        await catatKas(tx, {
          jenis: 'MASUK_LAIN',
          nominal: sisa,
          pelaku,
          keterangan: `Pengembalian uang muka ${po.nomor ?? ''} dari pemasok`,
        });
      }
    }
    await tx
      .update(orderPembelian)
      .set({
        status: jenis === 'BATAL' ? 'BATAL' : 'DITUTUP',
        alasanTutup: input.alasan,
        diubahPada: sekarang(),
      })
      .where(eq(orderPembelian.id, id));
    await catatLog(tx, {
      aksi: jenis === 'BATAL' ? 'PO_BATAL' : 'PO_TUTUP',
      idPengguna: pelaku.id,
      entitas: 'order_pembelian',
      idEntitas: id,
      nomorDokumen: po.nomor ?? undefined,
      ringkasan:
        `${jenis === 'BATAL' ? 'Batal' : 'Tutup sisa'} ${po.nomor ?? `draf #${id}`}: ${input.alasan}` +
        (sisa > 0
          ? `; uang muka ${formatRupiah(sisa)} ${input.metodeKembali === 'DEPOSIT' ? 'menjadi deposit pemasok' : 'dikembalikan'}`
          : ''),
      ip: asal.ip,
    });
  });
  return detailPO(id, pelaku.izin);
}

/** Notifikasi: PO berjalan yang lewat tanggal janji kirim. */
export async function jumlahPOTerlambat(): Promise<number> {
  const { baris } = await repo.daftar(db, { status: 'BERJALAN', limit: 1000, offset: 0 });
  const hariIni = tanggalOperasional();
  return baris.filter((b) => b.tanggalJanjiKirim !== null && b.tanggalJanjiKirim < hariIni).length;
}
