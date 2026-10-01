import { and, eq, inArray } from 'drizzle-orm';
import { formatRupiah, keQty, persenKeRupiah, subtotalRupiah, type DataOrder } from '@sit/shared';
import type { Tx } from '../../db/client';
import { barang, pelanggan, persediaan, tingkatHarga } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';
import { hargaBarangDasar } from '../master/harga/repo';
import { dasarMarkup, muatKonteksHarga } from '../master/harga/service';
import { ambilAngka } from '../sistem/konfigurasi/service';

/*
 * Harga, diskon, dan total baris penjualan (docs/05 P2–P4, docs/06 H8–H9, D1–D5). Dipakai order dan checkout
 * agar aturan harga hanya ada di satu tempat.
 */

export type BarisSiap = {
  idBarang: number;
  namaBarang: string;
  qty: string;
  qtyDasar: string;
  idTingkatHarga: number | null;
  hargaSatuan: number;
  hargaManual: boolean;
  diskonBaris: number;
  subtotal: number;
  catatanItem: string | null;
  /** H9: harga manual di bawah dasar modal (untuk log). */
  diBawahModal: boolean;
  /** Harga tier bawaan sebagai pembanding harga manual (log). */
  hargaPembanding: number | null;
};

export type HasilHarga = {
  baris: BarisSiap[];
  subtotal: number;
  diskonTransaksi: number;
  ongkir: number;
  total: number;
};

/** Harga lama baris order (P2: harga yang dijanjikan tetap berlaku). */
export type HargaLama = Map<
  number,
  { idTingkatHarga: number | null; hargaSatuan: number; hargaManual: boolean }
>;

function galatBaris(i: number, kolom: string, pesan: string, kode: 'VALIDASI' = 'VALIDASI') {
  return new AppError(kode, `Baris ${i + 1}: ${pesan}`, 400, {
    kolom: { [`baris.${i}.${kolom}`]: [pesan] },
  });
}

/** Nilai bawaan bila konfigurasi belum ada (sama dengan seed K-012). */
const BATAS_DISKON_BAWAAN: Record<PenggunaAktif['peran'], number> = {
  STAF_PENJUALAN: 0,
  KASIR: 0,
  ADMIN: 100,
  OWNER: 100,
};

/** D2: batas diskon peran dalam persen (konfigurasi). */
async function batasDiskon(tx: Tx, pelaku: PenggunaAktif): Promise<number> {
  return ambilAngka(`batas_diskon_persen_${pelaku.peran}`, BATAS_DISKON_BAWAAN[pelaku.peran], tx);
}

/** D2 dengan bilangan bulat: diskon ÷ dasar × 100 > batas ⇔ diskon × 100 > batas × dasar. */
function melebihiBatas(diskon: number, dasar: number, batas: number): boolean {
  return diskon * 100 > batas * dasar;
}

/** Tier bawaan transaksi (P3): tier pelanggan bila aktif, selain itu tier default. */
export async function tierBawaan(tx: Tx, idPelanggan: number | null): Promise<number> {
  if (idPelanggan !== null) {
    const [p] = await tx
      .select({ idTier: pelanggan.idTingkatHarga, status: tingkatHarga.statusAktif })
      .from(pelanggan)
      .leftJoin(tingkatHarga, eq(tingkatHarga.id, pelanggan.idTingkatHarga))
      .where(eq(pelanggan.id, idPelanggan));
    if (p?.idTier && p.status === 'AKTIF') return p.idTier;
  }
  const [d] = await tx
    .select({ id: tingkatHarga.id })
    .from(tingkatHarga)
    .where(and(eq(tingkatHarga.isDefault, true), eq(tingkatHarga.statusAktif, 'AKTIF')));
  if (!d) throw new Error('Tier harga default tidak ada (H1 dilanggar)');
  return d.id;
}

/**
 * Menghitung baris penjualan dari input: menentukan tier & harga (snapshot P2), memeriksa izin tier/harga
 * manual/diskon, batas diskon per peran (D2), dan menjumlah total (P4). Tidak menulis apa pun.
 */
export async function hitungBarisJual(
  tx: Tx,
  input: Pick<
    DataOrder,
    | 'baris'
    | 'idPelanggan'
    | 'ongkir'
    | 'diskonTransaksi'
    | 'diskonTransaksiPersen'
    | 'setujuDiBawahModal'
  >,
  pelaku: PenggunaAktif,
  hargaLama: HargaLama = new Map(),
): Promise<HasilHarga> {
  const idBarang = input.baris.map((b) => b.idBarang);
  const dataBarang = new Map(
    (
      await tx
        .select({
          id: barang.id,
          namaBarang: barang.namaBarang,
          statusAktif: barang.statusAktif,
          kepemilikan: barang.kepemilikan,
          hargaModalAwal: barang.hargaModalAwal,
          hargaTitip: barang.hargaTitip,
          hppRata2: persediaan.hppRata2,
          hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
          tanggalBeliTerakhir: persediaan.tanggalBeliTerakhir,
        })
        .from(barang)
        .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
        .where(inArray(barang.id, idBarang))
    ).map((b) => [b.id, b]),
  );
  const tierAktif = new Map(
    (
      await tx
        .select({ id: tingkatHarga.id, nama: tingkatHarga.nama })
        .from(tingkatHarga)
        .where(eq(tingkatHarga.statusAktif, 'AKTIF'))
    ).map((t) => [t.id, t.nama]),
  );
  const harga = new Map<string, number>();
  for (const h of await hargaBarangDasar(tx, idBarang)) {
    harga.set(`${h.idBarang}:${h.idTingkatHarga}`, h.hargaJual);
  }
  const bawaan = await tierBawaan(tx, input.idPelanggan);
  const konteks = await muatKonteksHarga(tx);
  const batas = await batasDiskon(tx, pelaku);
  const bolehDiskon = pelaku.izin.has('penjualan.diskon');

  const baris: BarisSiap[] = input.baris.map((b, i) => {
    const brg = dataBarang.get(b.idBarang);
    if (!brg) throw galatBaris(i, 'idBarang', 'Barang tidak ditemukan.');
    if (brg.statusAktif !== 'AKTIF') {
      throw galatBaris(i, 'idBarang', `${brg.namaBarang} nonaktif dan tidak bisa dijual.`);
    }
    const qty = keQty(b.qty);
    const pembanding = harga.get(`${b.idBarang}:${bawaan}`) ?? null;
    let idTier: number | null = null;
    let hargaSatuan: number;
    let diBawahModal = false;
    if (b.hargaManual) {
      if (!pelaku.izin.has('penjualan.harga_manual')) {
        throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin mengisi harga manual.', 403);
      }
      hargaSatuan = b.hargaSatuan ?? 0;
      const lama = hargaLama.get(b.idBarang);
      const sama = lama?.hargaManual && lama.hargaSatuan === hargaSatuan;
      // H9: di bawah dasar modal butuh persetujuan eksplisit (baris lama yang tidak berubah sudah disetujui).
      if (!sama && hargaSatuan < dasarMarkup(brg, konteks.modeDasar)) {
        diBawahModal = true;
        if (!input.setujuDiBawahModal) {
          throw new AppError(
            'KONFLIK',
            `Baris ${i + 1}: harga ${brg.namaBarang} di bawah modal. Centang persetujuan untuk melanjutkan.`,
            409,
            { kolom: { [`baris.${i}.hargaSatuan`]: ['Harga di bawah modal.'] } },
          );
        }
      }
    } else {
      idTier = b.idTingkatHarga ?? bawaan;
      if (!tierAktif.has(idTier)) throw galatBaris(i, 'idTingkatHarga', 'Tier harga tidak aktif.');
      if (idTier !== bawaan && !pelaku.izin.has('penjualan.tier.ubah')) {
        throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin mengganti tier harga.', 403);
      }
      const lama = hargaLama.get(b.idBarang);
      const kini = harga.get(`${b.idBarang}:${idTier}`);
      if (lama && !lama.hargaManual && lama.idTingkatHarga === idTier) {
        hargaSatuan = lama.hargaSatuan; // P2: harga yang dijanjikan saat order dibuat
      } else if (kini === undefined) {
        throw galatBaris(i, 'idTingkatHarga', `Harga ${brg.namaBarang} untuk tier ini belum ada.`);
      } else {
        hargaSatuan = kini;
      }
    }

    const bruto = subtotalRupiah(qty, hargaSatuan);
    const diskonBaris =
      b.diskonBarisPersen !== null ? persenKeRupiah(bruto, b.diskonBarisPersen) : b.diskonBaris;
    if (diskonBaris > 0) {
      if (!bolehDiskon) {
        throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin memberi diskon.', 403);
      }
      if (melebihiBatas(diskonBaris, bruto, batas)) {
        throw galatBaris(i, 'diskonBaris', `Diskon melebihi batas peran Anda (${batas}%).`);
      }
    }
    if (diskonBaris > bruto) {
      throw galatBaris(i, 'diskonBaris', 'Diskon melebihi harga baris.');
    }
    return {
      idBarang: b.idBarang,
      namaBarang: brg.namaBarang,
      qty,
      qtyDasar: qty, // M1: faktor satuan = 1 (U2)
      idTingkatHarga: idTier,
      hargaSatuan,
      hargaManual: b.hargaManual,
      diskonBaris,
      subtotal: bruto - diskonBaris,
      catatanItem: b.catatanItem ?? null,
      diBawahModal,
      hargaPembanding: b.hargaManual ? pembanding : null,
    };
  });

  const subtotal = baris.reduce((t, b) => t + b.subtotal, 0);
  const diskonTransaksi =
    input.diskonTransaksiPersen !== null
      ? persenKeRupiah(subtotal, input.diskonTransaksiPersen)
      : input.diskonTransaksi;
  if (diskonTransaksi > 0) {
    if (!bolehDiskon) {
      throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin memberi diskon.', 403);
    }
    if (melebihiBatas(diskonTransaksi, subtotal, batas)) {
      throw new AppError(
        'VALIDASI',
        `Diskon transaksi melebihi batas peran Anda (${batas}%).`,
        400,
        { kolom: { diskonTransaksi: [`Maksimal ${batas}%.`] } },
      );
    }
    if (diskonTransaksi > subtotal) {
      throw new AppError(
        'VALIDASI',
        `Diskon transaksi melebihi subtotal ${formatRupiah(subtotal)}.`,
        400,
        { kolom: { diskonTransaksi: ['Diskon melebihi subtotal.'] } },
      );
    }
  }
  return {
    baris,
    subtotal,
    diskonTransaksi,
    ongkir: input.ongkir,
    total: subtotal - diskonTransaksi + input.ongkir,
  };
}
