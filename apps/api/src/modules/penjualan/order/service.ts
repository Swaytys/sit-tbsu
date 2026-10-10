import {
  formatRupiah,
  keQty,
  rapikanDesimal,
  kunciBaris,
  tambahQty,
  nomorAntrean,
  type BarisDaftarOrder,
  type BarisStokTertahan,
  type DataOrder,
  type DetailOrder,
  type JenisPenjualan,
  type MetaHalaman,
  type PratinjauOrder,
  type RingkasBarisOrder,
  type TiketAntrean,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { siarkan } from '../../../lib/siaran';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tambahJam, tambahMenit, tanggalOperasional } from '../../../lib/waktu';
import { ubahReservasi, type PerubahanReservasi } from '../../persediaan/ledger';
import { hargaBarangDasar } from '../../master/harga/repo';
import { atributPerBarang } from '../../master/barang/service';
import { muatSatuanJual, opsiSatuan } from '../../master/satuan-jual/service';
import { ambilAngka, ambilTeks } from '../../sistem/konfigurasi/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import { hitungBarisJual, type HargaLama, type HasilHarga, type OpsiHitung } from '../harga-baris';
import * as repo from './repo';

/*
 * Order penjualan & antrean (docs/05 §3 R1–R9, §5): DRAFT tidak menahan stok; MENUNGGU/DIPROSES menahan
 * `stok_dipesan` lewat `ubahReservasi()` (ledger.ts); DIPROSES dikunci satu kasir; batal melepas reservasi.
 */

type Header = NonNullable<Awaited<ReturnType<typeof repo.orderById>>>;

async function batasBasi(): Promise<Date> {
  return tambahJam(sekarang(), -(await ambilAngka('batas_umur_order_jam', 24)));
}

function keRespons(h: Header, basiSebelum: Date, ringkasan: RingkasBarisOrder[]): BarisDaftarOrder {
  return {
    id: h.id,
    nomor: h.nomor,
    tanggal: h.tanggal.toISOString(),
    jenisPenjualan: h.jenisPenjualan,
    status: h.status,
    prioritas: h.prioritas,
    idPelanggan: h.idPelanggan,
    namaPelanggan: h.namaPelanggan,
    namaPembeli: h.namaPembeli,
    idPengguna: h.idPengguna,
    namaPengguna: h.namaPengguna,
    idKasirProses: h.idKasirProses,
    namaKasirProses: h.namaKasirProses,
    jumlahItem: h.jumlahItem,
    total: h.total,
    waktuMasukAntrean: h.waktuMasukAntrean?.toISOString() ?? null,
    basi:
      h.status === 'MENUNGGU' && h.waktuMasukAntrean !== null && h.waktuMasukAntrean < basiSebelum,
    noAntrean: nomorAntrean(h.nomor),
    ringkasan,
    catatan: h.catatan,
  };
}

/** Isi (nama barang & qty) beberapa order sekaligus, untuk kartu/tiket antrean (K-073). */
async function ringkasanOrder(idOrder: number[]): Promise<Map<number, RingkasBarisOrder[]>> {
  const peta = new Map<number, RingkasBarisOrder[]>();
  for (const r of await repo.ringkasBaris(db, idOrder)) {
    const daftar = peta.get(r.idOrder) ?? [];
    daftar.push({ namaBarang: r.namaBarang, qty: r.qty, kodeSatuan: r.kodeSatuan });
    peta.set(r.idOrder, daftar);
  }
  return peta;
}

function tidakDitemukan(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Order tidak ditemukan.', 404);
}

/** Staf hanya melihat order miliknya kecuali `penjualan.order.lihat_semua` (docs/04 §4). */
function bolehLihat(h: { idPengguna: number }, pelaku: PenggunaAktif): boolean {
  return h.idPengguna === pelaku.id || pelaku.izin.has('penjualan.order.lihat_semua');
}

export async function daftarOrder(
  p: repo.SaringOrder & { halaman: number; perHalaman: number; milikSaya?: boolean | undefined },
  pelaku: PenggunaAktif,
): Promise<{ data: BarisDaftarOrder[]; meta: MetaHalaman }> {
  const sendiri = p.milikSaya || !pelaku.izin.has('penjualan.order.lihat_semua');
  const { baris, total } = await repo.daftarOrder(db, {
    ...p,
    idPengguna: sendiri ? pelaku.id : undefined,
    ...batasHalaman(p),
  });
  const basi = await batasBasi();
  const isi = await ringkasanOrder(baris.map((b) => b.id));
  return {
    data: baris.map((b) => keRespons(b, basi, isi.get(b.id) ?? [])),
    meta: metaHalaman(total, p),
  };
}

/**
 * Papan antrean kasir/pengantaran (K-073): order MENUNGGU & DIPROSES satu jenis, urut FIFO (yang paling
 * lama masuk antrean di depan), lengkap dengan isi barang agar langsung terbaca tanpa membuka detail.
 */
export async function papanAntrean(jenis: JenisPenjualan): Promise<TiketAntrean[]> {
  const { baris } = await repo.daftarOrder(db, { status: 'AKTIF', jenis, limit: 200, offset: 0 });
  const basi = await batasBasi();
  const isi = await ringkasanOrder(baris.map((b) => b.id));
  return baris.map((b) => ({
    ...keRespons(b, basi, isi.get(b.id) ?? []),
    alamatKirim: b.alamatKirim,
  }));
}

export async function detailOrder(id: number, pelaku: PenggunaAktif): Promise<DetailOrder> {
  const h = await repo.orderById(db, id);
  if (!h || !bolehLihat(h, pelaku)) throw tidakDitemukan();
  const rows = await repo.detailOrder(db, id);
  const idBarang = rows.map((r) => r.idBarang);
  const hargaTier = new Map<number, { idTingkatHarga: number; hargaJual: number }[]>();
  for (const x of await hargaBarangDasar(db, idBarang)) {
    const daftar = hargaTier.get(x.idBarang) ?? [];
    daftar.push({ idTingkatHarga: x.idTingkatHarga, hargaJual: x.hargaJual });
    hargaTier.set(x.idBarang, daftar);
  }
  // K-091: pilihan satuan per baris dan harga tier untuk satuan baris.
  const satuanJual = await muatSatuanJual(db, idBarang);
  const atribut = await atributPerBarang(idBarang);
  const menahan = h.status === 'MENUNGGU' || h.status === 'DIPROSES';
  return {
    ...keRespons(
      h,
      await batasBasi(),
      rows.map((r) => ({ namaBarang: r.namaBarang, qty: r.qty, kodeSatuan: r.kodeSatuan })),
    ),
    alamatKirim: h.alamatKirim,
    catatanKirim: h.catatanKirim,
    alasanBatal: h.alasanBatal,
    idPenjualan: h.idPenjualan,
    subtotal: h.subtotal,
    diskonTransaksi: h.diskonTransaksi,
    ongkir: h.ongkir,
    baris: rows.map((r) => {
      const opsi = opsiSatuan(
        r.kodeSatuanDasar,
        hargaTier.get(r.idBarang) ?? [],
        satuanJual.get(r.idBarang) ?? [],
      );
      return {
        ...r,
        faktor: rapikanDesimal(r.faktor),
        // Stok tersedia "untuk order ini" (satuan dasar) = tersedia + yang ditahan order ini sendiri.
        stokTersedia: keQty(menahan ? tambahQty(r.stokTersedia, r.qtyDasar) : r.stokTersedia),
        hargaTier: opsi.find((o) => o.idSatuanJual === r.idSatuanJual)?.hargaTier ?? [],
        opsiSatuan: opsi,
        ringkasAtribut: atribut.get(r.idBarang) ?? [],
      };
    }),
  };
}

async function validasiPelanggan(tx: Tx, input: DataOrder) {
  if (input.idPelanggan === null) return;
  const p = await repo.pelangganUntukOrder(tx, input.idPelanggan);
  if (!p) {
    throw new AppError('VALIDASI', 'Pelanggan tidak ditemukan.', 400, {
      kolom: { idPelanggan: ['Pelanggan tidak ditemukan.'] },
    });
  }
  if (p.statusAktif !== 'AKTIF') {
    throw new AppError('VALIDASI', `Pelanggan ${p.namaPelanggan} nonaktif.`, 400, {
      kolom: { idPelanggan: ['Pelanggan nonaktif.'] },
    });
  }
}

function nilaiHeader(input: DataOrder, h: HasilHarga) {
  return {
    jenisPenjualan: input.jenisPenjualan,
    idPelanggan: input.idPelanggan,
    namaPembeli: input.namaPembeli ?? null,
    prioritas: input.prioritas,
    alamatKirim: input.alamatKirim ?? null,
    catatanKirim: input.catatanKirim ?? null,
    catatan: input.catatan ?? null,
    ongkir: h.ongkir,
    subtotal: h.subtotal,
    diskonTransaksi: h.diskonTransaksi,
    total: h.total,
  };
}

function nilaiDetail(h: HasilHarga) {
  return h.baris.map((b) => ({
    idBarang: b.idBarang,
    idSatuanJual: b.idSatuanJual,
    faktor: b.faktor,
    qty: b.qty,
    qtyDasar: b.qtyDasar,
    idTingkatHarga: b.idTingkatHarga,
    hargaSatuan: b.hargaSatuan,
    hargaManual: b.hargaManual,
    diskonBaris: b.diskonBaris,
    idPromo: b.idPromo,
    diskonPromo: b.diskonPromo,
    promoNonaktif: b.promoNonaktif,
    subtotal: b.subtotal,
    catatanItem: b.catatanItem,
  }));
}

/**
 * Log harga manual (H9) dan diskon (D5) untuk setiap baris yang memakainya, dan promo yang baru dilepas
 * (PR5, hanya saat berubah).
 */
async function logHargaDiskon(
  tx: Tx,
  h: HasilHarga,
  nomor: string,
  idOrder: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
  lama: HargaLama = new Map(),
) {
  for (const b of h.baris) {
    if (b.promoDilepas && !lama.get(kunciBaris(b.idBarang, b.idSatuanJual))?.promoNonaktif) {
      await catatLog(tx, {
        aksi: 'PENJUALAN_PROMO_LEPAS',
        idPengguna: pelaku.id,
        entitas: 'order_penjualan',
        idEntitas: idOrder,
        nomorDokumen: nomor,
        ringkasan:
          `Promo ${b.promoDilepas.nama} dilepas dari ${b.namaBarang} ` +
          `(potongan ${formatRupiah(b.promoDilepas.potongan)} tidak diberikan)`,
        ip: asal.ip,
      });
    }
    if (b.hargaManual) {
      await catatLog(tx, {
        aksi: 'PENJUALAN_HARGA_MANUAL',
        idPengguna: pelaku.id,
        entitas: 'order_penjualan',
        idEntitas: idOrder,
        nomorDokumen: nomor,
        ringkasan:
          `Harga manual ${b.namaBarang}: ${formatRupiah(b.hargaSatuan)} ` +
          `(tier bawaan ${b.hargaPembanding === null ? '-' : formatRupiah(b.hargaPembanding)})` +
          (b.diBawahModal ? ' — di bawah modal' : ''),
        ip: asal.ip,
      });
    }
    if (b.diskonBaris > 0) {
      await catatLog(tx, {
        aksi: 'PENJUALAN_DISKON',
        idPengguna: pelaku.id,
        entitas: 'order_penjualan',
        idEntitas: idOrder,
        nomorDokumen: nomor,
        ringkasan: `Diskon ${b.namaBarang}: ${formatRupiah(b.diskonBaris)} (${pelaku.peran})`,
        ip: asal.ip,
      });
    }
  }
  if (h.diskonTransaksi > 0) {
    await catatLog(tx, {
      aksi: 'PENJUALAN_DISKON',
      idPengguna: pelaku.id,
      entitas: 'order_penjualan',
      idEntitas: idOrder,
      nomorDokumen: nomor,
      ringkasan: `Diskon transaksi: ${formatRupiah(h.diskonTransaksi)} (${pelaku.peran})`,
      ip: asal.ip,
    });
  }
}

/** Selisih reservasi antara baris lama dan baru (R4). */
function selisihReservasi(
  lama: { idBarang: number; qtyDasar: string }[],
  baru: { idBarang: number; qtyDasar: string }[],
): PerubahanReservasi[] {
  return [
    ...lama.map((b) => ({ idBarang: b.idBarang, delta: `-${b.qtyDasar}` })),
    ...baru.map((b) => ({ idBarang: b.idBarang, delta: b.qtyDasar })),
  ];
}

async function masukAntrean(
  tx: Tx,
  id: number,
  nomor: string,
  baris: { idBarang: number; qtyDasar: string }[],
  pelaku: PenggunaAktif,
  asal: AsalRequest,
) {
  await ubahReservasi(
    tx,
    baris.map((b) => ({ idBarang: b.idBarang, delta: b.qtyDasar })),
  );
  const waktu = sekarang();
  await repo.ubahHeader(tx, id, {
    status: 'MENUNGGU',
    waktuMasukAntrean: waktu,
    diubahPada: waktu,
  });
  await catatLog(tx, {
    aksi: 'ORDER_ANTREAN',
    idPengguna: pelaku.id,
    entitas: 'order_penjualan',
    idEntitas: id,
    nomorDokumen: nomor,
    ringkasan: `Order ${nomor} masuk antrean (${baris.length} barang)`,
    ip: asal.ip,
  });
}

/**
 * Membuat order DRAFT di dalam `tx`; `kirim` langsung memasukkannya ke antrean (R3). Dipakai juga checkout
 * langsung (P1) yang membuat order lalu menyelesaikannya dalam transaksi yang sama.
 */
export async function buatOrderTx(
  tx: Tx,
  input: DataOrder,
  opsi: { kirim: boolean },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ id: number; nomor: string }> {
  await validasiPelanggan(tx, input);
  const harga = await hitungBarisJual(tx, input, pelaku);
  const tanggal = tanggalOperasional();
  const nomor = await terbitkanNomor(tx, 'ORD', tanggal);
  const id = await repo.tambahHeader(tx, {
    nomor,
    tanggalOperasional: tanggal,
    idPengguna: pelaku.id,
    status: 'DRAFT',
    ...nilaiHeader(input, harga),
  });
  await repo.gantiDetail(tx, id, nilaiDetail(harga));
  await catatLog(tx, {
    aksi: 'ORDER_BUAT',
    idPengguna: pelaku.id,
    entitas: 'order_penjualan',
    idEntitas: id,
    nomorDokumen: nomor,
    ringkasan: `Order ${nomor} (${input.jenisPenjualan.toLowerCase()}): ${harga.baris.length} barang, ${formatRupiah(harga.total)}`,
    ip: asal.ip,
  });
  await logHargaDiskon(tx, harga, nomor, id, pelaku, asal);
  if (opsi.kirim) await masukAntrean(tx, id, nomor, harga.baris, pelaku, asal);
  return { id, nomor };
}

export async function buatOrder(
  input: DataOrder,
  opsi: { kirim: boolean },
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrder> {
  const { id } = await dalamTransaksi((tx) => buatOrderTx(tx, input, opsi, pelaku, asal));
  if (opsi.kirim) siarkan('antrean');
  return detailOrder(id, pelaku);
}

async function kunci(tx: Tx, id: number, pelaku: PenggunaAktif) {
  const h = await repo.kunciOrder(tx, id);
  if (!h || !bolehLihat(h, pelaku)) throw tidakDitemukan();
  return h;
}

function statusTidakValid(nomor: string, status: string, aksi: string): AppError {
  return new AppError(
    'STATUS_TIDAK_VALID',
    `Order ${nomor} berstatus ${status.toLowerCase()}; tidak bisa ${aksi}.`,
    409,
  );
}

/**
 * R4: mengubah order di dalam `tx`. DRAFT: hanya pembuatnya. MENUNGGU: pembuat atau pemegang
 * `penjualan.checkout`, reservasi disesuaikan dengan selisih qty. DIPROSES: hanya kasir pemegang kunci.
 * Dipakai juga checkout yang sekaligus mengubah isi order (K-073).
 */
export async function ubahOrderTx(
  tx: Tx,
  id: number,
  input: DataOrder,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  const h = await kunci(tx, id, pelaku);
  const pembuat = h.idPengguna === pelaku.id;
  if (h.status === 'DRAFT' && !pembuat) {
    throw new AppError('TIDAK_BERIZIN', 'Hanya pembuat order yang bisa mengubah draf.', 403);
  }
  if (h.status === 'MENUNGGU' && !pembuat && !pelaku.izin.has('penjualan.checkout')) {
    throw new AppError('TIDAK_BERIZIN', 'Anda tidak bisa mengubah order orang lain.', 403);
  }
  if (h.status === 'DIPROSES' && h.idKasirProses !== pelaku.id) {
    throw new AppError(
      'KONFLIK',
      `Order ${h.nomor} sedang diproses kasir lain; hanya kasir itu yang bisa mengubahnya.`,
      409,
    );
  }
  if (h.status === 'SELESAI' || h.status === 'BATAL') {
    throw statusTidakValid(h.nomor, h.status, 'diubah');
  }
  await validasiPelanggan(tx, input);
  const lama = await repo.barisReservasi(tx, id);
  const hargaLama: HargaLama = new Map(
    lama.map((b) => [kunciBaris(b.idBarang, b.idSatuanJual), b]),
  );
  const harga = await hitungBarisJual(tx, input, pelaku, {
    lama: hargaLama,
    diskonTransaksiLama: h.diskonTransaksi,
  });
  if (h.status !== 'DRAFT') {
    await ubahReservasi(tx, selisihReservasi(lama, harga.baris));
  }
  await repo.ubahHeader(tx, id, { ...nilaiHeader(input, harga), diubahPada: sekarang() });
  await repo.gantiDetail(tx, id, nilaiDetail(harga));
  await catatLog(tx, {
    aksi: 'ORDER_UBAH',
    idPengguna: pelaku.id,
    entitas: 'order_penjualan',
    idEntitas: id,
    nomorDokumen: h.nomor,
    ringkasan: `Mengubah order ${h.nomor}: ${harga.baris.length} barang, ${formatRupiah(harga.total)}`,
    ip: asal.ip,
  });
  await logHargaDiskon(tx, harga, h.nomor, id, pelaku, asal, hargaLama);
}

export async function ubahOrder(
  id: number,
  input: DataOrder,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrder> {
  await dalamTransaksi((tx) => ubahOrderTx(tx, id, input, pelaku, asal));
  siarkan('antrean');
  return detailOrder(id, pelaku);
}

/**
 * PR5: pratinjau harga, promo, diskon, saran tier, dan total tanpa menyimpan apa pun. Untuk order yang sedang
 * diubah, harga janji (P2) dan nilai yang sudah diberikan pelaku lain dipakai seperti saat menyimpan.
 */
export async function pratinjauOrder(
  input: { idOrder: number | null; order: Parameters<typeof hitungBarisJual>[1] },
  pelaku: PenggunaAktif,
): Promise<PratinjauOrder> {
  return dalamTransaksi(async (tx) => {
    const opsi: OpsiHitung = {};
    if (input.idOrder !== null) {
      const h = await repo.orderById(tx, input.idOrder);
      if (!h || !bolehLihat(h, pelaku)) throw tidakDitemukan();
      opsi.lama = new Map(
        (await repo.barisReservasi(tx, input.idOrder)).map((b) => [
          kunciBaris(b.idBarang, b.idSatuanJual),
          b,
        ]),
      );
      opsi.diskonTransaksiLama = h.diskonTransaksi;
    }
    const harga = await hitungBarisJual(tx, input.order, pelaku, opsi);
    return {
      baris: harga.baris.map((b) => ({
        idBarang: b.idBarang,
        idSatuanJual: b.idSatuanJual,
        idTingkatHarga: b.idTingkatHarga,
        hargaSatuan: b.hargaSatuan,
        bruto: b.bruto,
        idPromo: b.idPromo,
        namaPromo: b.namaPromo,
        diskonPromo: b.diskonPromo,
        promoNonaktif: b.promoNonaktif,
        promoDilepas: b.promoDilepas
          ? { nama: b.promoDilepas.nama, potongan: b.promoDilepas.potongan }
          : null,
        promoDitolak: b.promoDitolak,
        diskonBaris: b.diskonBaris,
        subtotal: b.subtotal,
      })),
      tierBelanja: harga.tierBelanja,
      totalBruto: harga.totalBruto,
      totalDiskonPromo: harga.totalDiskonPromo,
      totalDiskonBaris: harga.totalDiskonBaris,
      subtotal: harga.subtotal,
      diskonTransaksi: harga.diskonTransaksi,
      ongkir: harga.ongkir,
      total: harga.total,
    };
  });
}

/** R3: DRAFT → MENUNGGU (hanya pembuat). */
export async function kirimOrder(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrder> {
  await dalamTransaksi(async (tx) => {
    const h = await kunci(tx, id, pelaku);
    if (h.status !== 'DRAFT') throw statusTidakValid(h.nomor, h.status, 'dikirim ke antrean');
    if (h.idPengguna !== pelaku.id) {
      throw new AppError('TIDAK_BERIZIN', 'Hanya pembuat order yang bisa mengirimnya.', 403);
    }
    await masukAntrean(tx, id, h.nomor, await repo.barisReservasi(tx, id), pelaku, asal);
  });
  siarkan('antrean');
  return detailOrder(id, pelaku);
}

/** MENUNGGU → DIPROSES: kasir mengunci order (R8). Membuka ulang order yang dikunci sendiri tidak apa-apa. */
export async function prosesOrder(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrder> {
  await dalamTransaksi(async (tx) => {
    const h = await kunci(tx, id, pelaku);
    if (h.status === 'DIPROSES') {
      if (h.idKasirProses === pelaku.id) return;
      const o = await repo.orderById(tx, id);
      throw new AppError(
        'KONFLIK',
        `Order ${h.nomor} sedang diproses oleh ${o?.namaKasirProses ?? 'kasir lain'}.`,
        409,
      );
    }
    if (h.status !== 'MENUNGGU') throw statusTidakValid(h.nomor, h.status, 'diproses');
    await repo.ubahHeader(tx, id, {
      status: 'DIPROSES',
      idKasirProses: pelaku.id,
      diubahPada: sekarang(),
    });
    await catatLog(tx, {
      aksi: 'ORDER_PROSES',
      idPengguna: pelaku.id,
      entitas: 'order_penjualan',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: `Order ${h.nomor} diproses`,
      ip: asal.ip,
    });
  });
  siarkan('antrean');
  return detailOrder(id, pelaku);
}

/** DIPROSES → MENUNGGU oleh pemegang kunci, atau paksa oleh `penjualan.order.lepas_paksa` (R8). */
export async function lepasOrder(
  id: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrder> {
  await dalamTransaksi(async (tx) => {
    const h = await kunci(tx, id, pelaku);
    if (h.status !== 'DIPROSES') throw statusTidakValid(h.nomor, h.status, 'dilepas');
    const paksa = h.idKasirProses !== pelaku.id;
    if (paksa && !pelaku.izin.has('penjualan.order.lepas_paksa')) {
      throw new AppError(
        'TIDAK_BERIZIN',
        'Hanya kasir yang memproses (atau Admin/Owner) yang bisa melepas order ini.',
        403,
      );
    }
    await repo.ubahHeader(tx, id, {
      status: 'MENUNGGU',
      idKasirProses: null,
      diubahPada: sekarang(),
    });
    await catatLog(tx, {
      aksi: 'ORDER_LEPAS',
      idPengguna: pelaku.id,
      entitas: 'order_penjualan',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: `Order ${h.nomor} dikembalikan ke antrean${paksa ? ' (dilepas paksa)' : ''}`,
      ip: asal.ip,
    });
  });
  siarkan('antrean');
  return detailOrder(id, pelaku);
}

/** Membatalkan order; reservasi dilepas hanya bila order menahan stok (draf tidak menahan, R2). */
async function lepasDanBatal(tx: Tx, id: number, alasan: string, menahan: boolean) {
  if (menahan) {
    const baris = await repo.barisReservasi(tx, id);
    await ubahReservasi(
      tx,
      baris.map((b) => ({ idBarang: b.idBarang, delta: `-${b.qtyDasar}` })),
    );
  }
  await repo.ubahHeader(tx, id, {
    status: 'BATAL',
    alasanBatal: alasan,
    idKasirProses: null,
    diubahPada: sekarang(),
  });
}

/** R5: batal + lepas reservasi. Pembuat boleh membatalkan miliknya yang DRAFT/MENUNGGU (`batal_sendiri`). */
export async function batalOrder(
  id: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailOrder> {
  await dalamTransaksi(async (tx) => {
    const h = await kunci(tx, id, pelaku);
    if (h.status === 'SELESAI' || h.status === 'BATAL') {
      throw statusTidakValid(h.nomor, h.status, 'dibatalkan');
    }
    const sendiri =
      h.idPengguna === pelaku.id &&
      (h.status === 'DRAFT' || h.status === 'MENUNGGU') &&
      pelaku.izin.has('penjualan.order.batal_sendiri');
    if (!sendiri && !pelaku.izin.has('penjualan.order.batal')) {
      throw new AppError(
        'TIDAK_BERIZIN',
        h.idPengguna === pelaku.id
          ? 'Order yang sedang diproses kasir tidak bisa Anda batalkan.'
          : 'Anda hanya bisa membatalkan order buatan sendiri.',
        403,
      );
    }
    if (h.status === 'DIPROSES' && h.idKasirProses !== pelaku.id) {
      if (!pelaku.izin.has('penjualan.order.lepas_paksa')) {
        throw new AppError('KONFLIK', `Order ${h.nomor} sedang diproses kasir lain.`, 409);
      }
    }
    await lepasDanBatal(tx, id, alasan, h.status !== 'DRAFT');
    await catatLog(tx, {
      aksi: 'ORDER_BATAL',
      idPengguna: pelaku.id,
      entitas: 'order_penjualan',
      idEntitas: id,
      nomorDokumen: h.nomor,
      ringkasan: `Order ${h.nomor} dibatalkan: ${alasan}`,
      ip: asal.ip,
    });
  });
  siarkan('antrean');
  return detailOrder(id, pelaku);
}

/**
 * Job berkala (R7, R8; tiap 15 menit): auto-batal order basi bila `auto_batal_order_basi = true`, dan
 * mengembalikan order DIPROSES tanpa aktivitas lebih dari `batas_kunci_order_menit` ke antrean.
 * Dicatat log tanpa pengguna (aksi sistem).
 */
export async function jalankanJobOrder(): Promise<{ dibatalkan: string[]; dilepas: string[] }> {
  const dibatalkan: string[] = [];
  const dilepas: string[] = [];
  const auto = (await ambilTeks('auto_batal_order_basi', 'false')) === 'true';
  if (auto) {
    const basi = await batasBasi();
    for (const o of await repo.orderBasi(db, basi)) {
      await dalamTransaksi(async (tx) => {
        const h = await repo.kunciOrder(tx, o.id);
        if (h?.status !== 'MENUNGGU') return;
        await lepasDanBatal(tx, o.id, 'KADALUARSA', true);
        await catatLog(tx, {
          aksi: 'ORDER_BATAL',
          idPengguna: null,
          entitas: 'order_penjualan',
          idEntitas: o.id,
          nomorDokumen: o.nomor,
          ringkasan: `Order ${o.nomor} dibatalkan otomatis: KADALUARSA (order basi)`,
        });
        dibatalkan.push(o.nomor);
      });
    }
  }
  const menit = await ambilAngka('batas_kunci_order_menit', 30);
  for (const o of await repo.kunciKadaluarsa(db, tambahMenit(sekarang(), -menit))) {
    await dalamTransaksi(async (tx) => {
      const h = await repo.kunciOrder(tx, o.id);
      if (h?.status !== 'DIPROSES') return;
      await repo.ubahHeader(tx, o.id, {
        status: 'MENUNGGU',
        idKasirProses: null,
        diubahPada: sekarang(),
      });
      await catatLog(tx, {
        aksi: 'ORDER_LEPAS',
        idPengguna: null,
        entitas: 'order_penjualan',
        idEntitas: o.id,
        nomorDokumen: o.nomor,
        ringkasan: `Order ${o.nomor} dikembalikan ke antrean otomatis (kunci lebih dari ${menit} menit)`,
      });
      dilepas.push(o.nomor);
    });
  }
  if (dibatalkan.length + dilepas.length > 0) siarkan('antrean');
  return { dibatalkan, dilepas };
}

/** Stok tertahan per barang (R7). */
export async function stokTertahan(): Promise<BarisStokTertahan[]> {
  const basi = await batasBasi();
  const hasil = new Map<number, BarisStokTertahan>();
  for (const r of await repo.stokTertahan(db)) {
    let b = hasil.get(r.idBarang);
    if (!b) {
      b = {
        idBarang: r.idBarang,
        kodeBarang: r.kodeBarang,
        namaBarang: r.namaBarang,
        kodeSatuan: r.kodeSatuan,
        stokFisik: r.stokFisik,
        stokDipesan: r.stokDipesan,
        order: [],
      };
      hasil.set(r.idBarang, b);
    }
    // K-095: beberapa baris satuan untuk barang yang sama dalam satu order digabung.
    const sama = b.order.find((o) => o.id === r.idOrder);
    if (sama) {
      sama.qtyDasar = tambahQty(sama.qtyDasar, r.qtyDasar);
      continue;
    }
    b.order.push({
      id: r.idOrder,
      nomor: r.nomor,
      status: r.status,
      qtyDasar: r.qtyDasar,
      namaPengguna: r.namaPengguna,
      namaPelanggan: r.namaPelanggan,
      waktuMasukAntrean: r.waktuMasukAntrean?.toISOString() ?? null,
      basi: r.status === 'MENUNGGU' && r.waktuMasukAntrean !== null && r.waktuMasukAntrean < basi,
    });
  }
  return [...hasil.values()];
}

/** Jumlah order basi (notifikasi ST2). */
export async function jumlahOrderBasi(): Promise<number> {
  return (await repo.orderBasi(db, await batasBasi())).length;
}
