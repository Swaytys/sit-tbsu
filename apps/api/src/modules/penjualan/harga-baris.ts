import { and, eq, inArray } from 'drizzle-orm';
import {
  bandingQty,
  formatRupiah,
  kaliQty,
  keQty,
  kunciBaris,
  persenKeRupiah,
  subtotalRupiah,
  type DataOrder,
  type InfoTierBelanja,
  type SatuanJualBarang,
} from '@sit/shared';
import type { Tx } from '../../db/client';
import { barang, golonganPelanggan, pelanggan, persediaan, tingkatHarga } from '../../db/schema';
import { AppError, galatBaris } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import { hargaBarangDasar } from '../master/harga/repo';
import { dasarMarkup, muatKonteksHarga } from '../master/harga/service';
import { muatSatuanJual } from '../master/satuan-jual/service';
import { pakaiSisaPromo, petaSisaPromo, pilihPromo, type KandidatPromo } from '../promo/hitung';
import { kandidatPromo, kunciPromoBerbatas, type PembeliPromo } from '../promo/repo';

/*
 * Harga, promo, diskon, dan total baris penjualan (docs/05 P2–P4, docs/06 H8–H9, D1–D5, PR1–PR9). Dipakai
 * order, pratinjau, dan checkout agar aturan harga hanya ada di satu tempat. Urutan: nilai belanja transaksi
 * (harga normal) → tier transaksi (K-098) → per baris: harga (tier / snapshot / manual) → bruto → promo dari
 * harga tier (PR4, PR9; menurut barang dan pembeli) → diskon manual (D3) → subtotal. Tier selalu otomatis:
 * tidak ada tier pilihan kasir (K-099); pengecualian harga hanya lewat harga manual (H9) atau promo.
 */

export type BarisSiap = {
  idBarang: number;
  namaBarang: string;
  idKategori: number;
  /** K-091: satuan jual baris (`null` = satuan dasar) dan faktornya ke satuan dasar. */
  idSatuanJual: number | null;
  faktor: string;
  qty: string;
  qtyDasar: string;
  /** Tier yang dipakai baris (tier transaksi atau tier dasar, H8); `null` = harga manual. */
  idTingkatHarga: number | null;
  hargaSatuan: number;
  hargaManual: boolean;
  /** bulatkanRupiah(qty × harga satuan). */
  bruto: number;
  idPromo: number | null;
  namaPromo: string | null;
  diskonPromo: number;
  /** PR5: promo baris ini dilepas. */
  promoNonaktif: boolean;
  /** Promo yang tidak diberikan karena dilepas (log PENJUALAN_PROMO_LEPAS, tampilan). */
  promoDilepas: { idPromo: number; nama: string; potongan: number } | null;
  /** PR6: promo yang lebih besar tidak berlaku karena harga jadi di bawah modal. */
  promoDitolak: boolean;
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
  /** K-098: tier transaksi menurut total nilai belanja. */
  tierBelanja: InfoTierBelanja;
  totalBruto: number;
  totalDiskonPromo: number;
  totalDiskonBaris: number;
  /** Σ subtotal baris (setelah promo dan diskon baris). */
  subtotal: number;
  diskonTransaksi: number;
  ongkir: number;
  total: number;
};

/**
 * Baris order sebelum diubah: harga janji (P2), dan nilai yang sudah diberikan pelaku sebelumnya. Nilai yang
 * tidak berubah tidak diuji ulang terhadap izin/batas pelaku sekarang (mis. diskon dari Admin tetap sah saat
 * Kasir menyelesaikan order, K-087).
 */
export type BarisLama = {
  idSatuanJual: number | null;
  idTingkatHarga: number | null;
  hargaSatuan: number;
  hargaManual: boolean;
  diskonBaris: number;
  promoNonaktif: boolean;
};
/** Kunci: `kunciBaris(idBarang, idSatuanJual)` (K-095). */
export type HargaLama = Map<string, BarisLama>;

export type OpsiHitung = {
  lama?: HargaLama;
  /** Diskon transaksi tersimpan di order (tidak diuji ulang bila tidak berubah). */
  diskonTransaksiLama?: number;
  /** Tanggal operasional penentu promo (PR1); bawaan hari ini. */
  tanggal?: string;
};

/** K-146: diskon manual tidak ada lagi; harga khusus hanya lewat Promo. */
const POTONGAN_LEWAT_PROMO = 'Potongan harga hanya lewat Promo (Pengaturan › Promo).';

/** Tier dasar (P3, K-098): harga semua transaksi sebelum nilai belanja tier lain tercapai. */
export async function tierDefault(tx: Tx): Promise<number> {
  const [d] = await tx
    .select({ id: tingkatHarga.id })
    .from(tingkatHarga)
    .where(and(eq(tingkatHarga.isDefault, true), eq(tingkatHarga.statusAktif, 'AKTIF')));
  if (!d) throw new Error('Tier harga default tidak ada (H1 dilanggar)');
  return d.id;
}

/** K-097: pembeli untuk syarat promo; pelanggan nonaktif/golongan nonaktif tidak membuka promo golongan. */
async function pembeliPromo(tx: Tx, idPelanggan: number | null): Promise<PembeliPromo> {
  if (idPelanggan === null) return { idPelanggan: null, idGolongan: null };
  const [p] = await tx
    .select({ idGolongan: pelanggan.idGolongan, statusGolongan: golonganPelanggan.statusAktif })
    .from(pelanggan)
    .leftJoin(golonganPelanggan, eq(golonganPelanggan.id, pelanggan.idGolongan))
    .where(eq(pelanggan.id, idPelanggan));
  return {
    idPelanggan,
    idGolongan: p?.statusGolongan === 'AKTIF' ? p.idGolongan : null,
  };
}

/** Data barang untuk harga baris: status, kategori (promo), dan dasar modal `D` (H9, PR6). */
async function dataBarang(tx: Tx, idBarang: number[]) {
  const baris = await tx
    .select({
      id: barang.id,
      namaBarang: barang.namaBarang,
      statusAktif: barang.statusAktif,
      idKategori: barang.idKategori,
      kepemilikan: barang.kepemilikan,
      hargaModalAwal: barang.hargaModalAwal,
      hargaTitip: barang.hargaTitip,
      hppRata2: persediaan.hppRata2,
      hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
      tanggalBeliTerakhir: persediaan.tanggalBeliTerakhir,
    })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(inArray(barang.id, idBarang));
  return new Map(baris.map((b) => [b.id, b]));
}

/**
 * H8 (K-098): tier harga transaksi menurut total nilai belanja, berlaku untuk semua barang. Dari tier aktif
 * yang `min_belanja`-nya tercapai dipakai yang syaratnya paling tinggi (syarat sama → markup terkecil); bila
 * tidak ada yang tercapai dipakai tier dasar. Tier lain tanpa `min_belanja` (hanya mungkin saat nonaktif) tidak ikut.
 * `berikut` = tier terdekat yang belum tercapai beserta kekurangan belanjanya.
 */
export function pilihTierBelanja(
  idDefault: number,
  tierAktif: { id: number; minBelanja: number | null; markupDefaultPersen: string }[],
  nilaiBelanja: number,
): InfoTierBelanja {
  const bersyarat = tierAktif
    .flatMap((t) =>
      t.id === idDefault || t.minBelanja === null
        ? []
        : [{ id: t.id, min: t.minBelanja, markup: t.markupDefaultPersen }],
    )
    .sort((a, b) => a.min - b.min || bandingQty(b.markup, a.markup));
  let idTingkatHarga = idDefault;
  let berikut: InfoTierBelanja['berikut'] = null;
  for (const t of bersyarat) {
    if (nilaiBelanja >= t.min) idTingkatHarga = t.id;
    else {
      berikut = { idTingkatHarga: t.id, kurang: t.min - nilaiBelanja };
      break;
    }
  }
  return { nilaiBelanja, idTingkatHarga, berikut };
}

/**
 * Menghitung baris penjualan dari input: tier harga transaksi menurut total nilai belanja (H8, K-098) dengan
 * harga janji order (P2), promo menurut barang dan pembeli yang dipotong dari harga tier (PR1–PR6, PR9),
 * diskon manual (D1–D4), dan total (P4). Memeriksa izin tier/harga manual/diskon/lepas promo untuk nilai yang
 * diubah pelaku. Tidak menulis apa pun.
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
  opsi: OpsiHitung = {},
): Promise<HasilHarga> {
  const lamaPer = opsi.lama ?? new Map<string, BarisLama>();
  const tanggal = opsi.tanggal ?? tanggalOperasional();
  const idBarang = input.baris.map((b) => b.idBarang);
  const brgPer = await dataBarang(tx, idBarang);
  const tierAktif = await tx
    .select({
      id: tingkatHarga.id,
      minBelanja: tingkatHarga.minBelanja,
      markupDefaultPersen: tingkatHarga.markupDefaultPersen,
    })
    .from(tingkatHarga)
    .where(eq(tingkatHarga.statusAktif, 'AKTIF'));
  const harga = new Map<string, number>();
  for (const h of await hargaBarangDasar(tx, idBarang)) {
    harga.set(`${h.idBarang}:${h.idTingkatHarga}`, h.hargaJual);
  }
  // K-091: harga satuan jual per tier (tetap atau otomatis dari satuan dasar × faktor).
  const satuanJual = new Map<number, { idBarang: number; s: SatuanJualBarang }>();
  for (const [idBrg, daftar] of await muatSatuanJual(tx, idBarang)) {
    for (const s of daftar) {
      satuanJual.set(s.id, { idBarang: idBrg, s });
      for (const h of s.harga) harga.set(`${s.id}#${h.idTingkatHarga}`, h.hargaJual);
    }
  }
  /** Harga tier untuk satuan baris (satuan dasar: `idBarang:tier`, satuan jual: `idSatuanJual#tier`). */
  const hargaUntuk = (idBrg: number, idSj: number | null, idTier: number) =>
    harga.get(idSj === null ? `${idBrg}:${idTier}` : `${idSj}#${idTier}`);
  const idDefault = await tierDefault(tx);
  const konteks = await muatKonteksHarga(tx);
  // PR6: pelaku yang boleh menjual di bawah modal (izin harga manual, H9) tidak dibatasi modal.
  const bebasModal = pelaku.izin.has('penjualan.harga_manual');

  /**
   * Harga satuan tier untuk baris: harga janji order bila tier dan satuan baris sama (P2), selain itu harga
   * master; `null` = harga belum ada (harga modal belum diketahui, K-095).
   */
  const hargaTierBaris = (
    b: (typeof input.baris)[number],
    lama: BarisLama | undefined,
    idTier: number,
  ): number | null => {
    const janji =
      lama !== undefined &&
      !lama.hargaManual &&
      lama.idTingkatHarga === idTier &&
      lama.idSatuanJual === b.idSatuanJual;
    if (janji) return lama.hargaSatuan;
    const kini = hargaUntuk(b.idBarang, b.idSatuanJual, idTier);
    return kini === undefined || kini <= 0 ? null : kini;
  };

  // Tahap 1: validasi baris, satuan, dan harga normal (tier dasar) setiap baris.
  const dasarBaris = input.baris.map((b, i) => {
    const brg = brgPer.get(b.idBarang);
    if (!brg) throw galatBaris(i, 'idBarang', 'Barang tidak ditemukan.');
    if (brg.statusAktif !== 'AKTIF') {
      throw galatBaris(i, 'idBarang', `${brg.namaBarang} nonaktif dan tidak bisa dijual.`);
    }
    const qty = keQty(b.qty);
    const lama = lamaPer.get(kunciBaris(b.idBarang, b.idSatuanJual));
    let faktor = '1';
    if (b.idSatuanJual !== null) {
      const sj = satuanJual.get(b.idSatuanJual);
      if (!sj || sj.idBarang !== b.idBarang) {
        throw galatBaris(i, 'idSatuanJual', `Satuan jual bukan milik ${brg.namaBarang}.`);
      }
      if (sj.s.statusAktif !== 'AKTIF') {
        throw galatBaris(
          i,
          'idSatuanJual',
          `Satuan ${sj.s.kodeSatuan} untuk ${brg.namaBarang} sudah nonaktif.`,
        );
      }
      faktor = sj.s.faktor;
      // K-094: kemasan dijual utuh; sebagian kemasan dijual dalam satuan dasar.
      if (!/^\d+(\.0+)?$/.test(qty)) {
        throw galatBaris(
          i,
          'qty',
          `Qty ${sj.s.kodeSatuan} harus bilangan bulat. Untuk sebagian ${sj.s.kodeSatuan}, jual dalam satuan dasar.`,
        );
      }
    }
    const qtyDasar = kaliQty(qty, faktor);
    if (!/[1-9]/.test(qtyDasar)) {
      throw galatBaris(i, 'qty', 'Qty terlalu kecil untuk satuan ini.');
    }
    return {
      b,
      brg,
      qty,
      qtyDasar,
      faktor,
      lama,
      // Dasar modal per satuan baris (H9, PR6): D × faktor.
      dasar: subtotalRupiah(faktor, dasarMarkup(brg, konteks.modeDasar)),
      hargaNormal: hargaTierBaris(b, lama, idDefault),
    };
  });

  // K-098: nilai belanja = Σ qty × harga normal semua baris (sebelum promo dan diskon), sehingga tier tidak
  // bergantung pada harga yang dihasilkannya sendiri. Baris harga manual dinilai dengan harga normalnya.
  const nilaiBelanja = dasarBaris.reduce(
    (t, x) =>
      t + subtotalRupiah(x.qty, x.hargaNormal ?? (x.b.hargaManual ? (x.b.hargaSatuan ?? 0) : 0)),
    0,
  );
  const tierBelanja = pilihTierBelanja(idDefault, tierAktif, nilaiBelanja);

  // Tahap 2: tier dan harga setiap baris.
  const tahap1 = dasarBaris.map((x, i) => {
    const { b, brg, qty, lama, dasar } = x;
    let idTier: number | null = null;
    let hargaSatuan: number;
    let diBawahModal = false;
    if (b.hargaManual) {
      hargaSatuan = b.hargaSatuan ?? 0;
      const sama = lama?.hargaManual === true && lama.hargaSatuan === hargaSatuan;
      if (!sama && !pelaku.izin.has('penjualan.harga_manual')) {
        throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin mengisi harga manual.', 403);
      }
      // H9: di bawah dasar modal butuh persetujuan eksplisit (baris lama yang tidak berubah sudah disetujui).
      if (!sama && hargaSatuan < dasar) {
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
      idTier = tierBelanja.idTingkatHarga;
      let hargaTier = hargaTierBaris(b, lama, idTier);
      // Tier transaksi tidak boleh lebih mahal dari harga normal (mis. harga normal diisi Rp tetap rendah):
      // pembeli yang belanjanya lebih besar tidak membayar lebih mahal.
      if (
        idTier !== idDefault &&
        (hargaTier === null || (x.hargaNormal !== null && hargaTier > x.hargaNormal))
      ) {
        idTier = idDefault;
        hargaTier = x.hargaNormal;
      }
      if (hargaTier === null) {
        throw galatBaris(
          i,
          'idTingkatHarga',
          `Harga ${brg.namaBarang} belum ada (harga modal belum diketahui). ` +
            'Catat penerimaan barangnya, atau isi harganya (Rp) di Data Barang.',
        );
      }
      hargaSatuan = hargaTier;
    }
    return {
      ...x,
      idTier,
      hargaSatuan,
      diBawahModal,
      bruto: subtotalRupiah(qty, hargaSatuan),
    };
  });
  const totalBruto = tahap1.reduce((t, x) => t + x.bruto, 0);
  const kandidat: KandidatPromo[] = await kandidatPromo(
    tx,
    tanggal,
    idBarang,
    [...new Set(tahap1.map((x) => x.brg.idKategori))],
    await pembeliPromo(tx, input.idPelanggan),
  );
  // PR10/PR11: sisa anggaran dan batas per pembeli dibagi ke baris secara berurutan.
  const sisaPromo = petaSisaPromo(kandidat);

  // Tahap 3: promo (dipotong dari harga tier, PR9), diskon manual, subtotal, dan saran tier per baris.
  const baris: BarisSiap[] = tahap1.map((x, i) => {
    const { b, brg, qty, qtyDasar, lama, bruto } = x;
    const tanpaPromo = b.tanpaPromo;
    if (tanpaPromo !== (lama?.promoNonaktif ?? false) && !pelaku.izin.has('penjualan.checkout')) {
      throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin melepas atau memasang promo.', 403);
    }
    // Promo tidak berlaku untuk harga manual (keputusan pemilik, K-087). Diskon rupiah yang sudah ada
    // membatasi potongan promo agar subtotal tidak negatif.
    const pilih = b.hargaManual
      ? { promo: null, potongan: 0, ditolakDiBawahModal: false }
      : pilihPromo(
          kandidat,
          {
            idBarang: b.idBarang,
            idKategori: brg.idKategori,
            qty: qtyDasar,
            qtyHarga: qty,
            hargaSatuan: x.hargaSatuan,
            bruto,
            batasBawah: bebasModal ? null : subtotalRupiah(qty, x.dasar),
            ...(b.diskonBarisPersen === null
              ? { batasPotongan: Math.max(0, bruto - b.diskonBaris) }
              : {}),
          },
          totalBruto,
          tanggal,
          sisaPromo,
        );
    const promoDipakai = !tanpaPromo && pilih.promo !== null;
    const diskonPromo = promoDipakai ? pilih.potongan : 0;
    if (promoDipakai && pilih.promo) pakaiSisaPromo(sisaPromo, pilih.promo.id, diskonPromo);

    // D1/D3: diskon manual atas subtotal setelah promo; D2 batas peran untuk nilai yang diubah pelaku.
    const dasarManual = bruto - diskonPromo;
    const diskonBaris =
      b.diskonBarisPersen !== null
        ? persenKeRupiah(dasarManual, b.diskonBarisPersen)
        : b.diskonBaris;
    const diskonSama = lama !== undefined && lama.diskonBaris === diskonBaris;
    // K-146: diskon manual dihapus; potongan hanya lewat Promo. Diskon yang sudah tersimpan sebelumnya tetap sah.
    if (diskonBaris > 0 && !diskonSama) {
      throw galatBaris(i, 'diskonBaris', POTONGAN_LEWAT_PROMO);
    }
    if (diskonBaris > dasarManual) {
      throw galatBaris(i, 'diskonBaris', 'Diskon melebihi harga baris.');
    }

    return {
      idBarang: b.idBarang,
      namaBarang: brg.namaBarang,
      idKategori: brg.idKategori,
      idSatuanJual: b.idSatuanJual,
      faktor: x.faktor,
      qty,
      qtyDasar,
      idTingkatHarga: x.idTier,
      hargaSatuan: x.hargaSatuan,
      hargaManual: b.hargaManual,
      bruto,
      idPromo: promoDipakai ? (pilih.promo?.id ?? null) : null,
      namaPromo: promoDipakai ? (pilih.promo?.nama ?? null) : null,
      diskonPromo,
      promoNonaktif: tanpaPromo,
      promoDilepas:
        tanpaPromo && pilih.promo
          ? { idPromo: pilih.promo.id, nama: pilih.promo.nama, potongan: pilih.potongan }
          : null,
      promoDitolak: pilih.ditolakDiBawahModal,
      diskonBaris,
      subtotal: dasarManual - diskonBaris,
      catatanItem: b.catatanItem ?? null,
      diBawahModal: x.diBawahModal,
      hargaPembanding: b.hargaManual
        ? (hargaUntuk(b.idBarang, b.idSatuanJual, idDefault) ?? null)
        : null,
    };
  });

  const subtotal = baris.reduce((t, b) => t + b.subtotal, 0);
  const diskonTransaksi =
    input.diskonTransaksiPersen !== null
      ? persenKeRupiah(subtotal, input.diskonTransaksiPersen)
      : input.diskonTransaksi;
  if (diskonTransaksi > 0) {
    if (diskonTransaksi !== opsi.diskonTransaksiLama) {
      throw new AppError('VALIDASI', POTONGAN_LEWAT_PROMO, 400, {
        kolom: { diskonTransaksi: [POTONGAN_LEWAT_PROMO] },
      });
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
    tierBelanja,
    totalBruto,
    totalDiskonPromo: baris.reduce((t, b) => t + b.diskonPromo, 0),
    totalDiskonBaris: baris.reduce((t, b) => t + b.diskonBaris, 0),
    subtotal,
    diskonTransaksi,
    ongkir: input.ongkir,
    total: subtotal - diskonTransaksi + input.ongkir,
  };
}

// --- Evaluasi ulang promo saat checkout (PR5) ---

export type BarisCheckout = {
  idBarang: number;
  idKategori: number;
  namaBarang: string;
  qty: string;
  /** qty × faktor satuan jual (K-091). */
  qtyDasar: string;
  hargaSatuan: number;
  hargaManual: boolean;
  diskonBaris: number;
  promoNonaktif: boolean;
};

export type HasilPromoCheckout = {
  idPromo: number | null;
  namaPromo: string | null;
  diskonPromo: number;
  subtotal: number;
};

/**
 * PR5: promo dievaluasi ulang dengan tanggal checkout, pelaku checkout (PR6), dan pembeli order (K-097).
 * Harga, diskon manual, dan pelepasan promo yang tersimpan di order dipakai apa adanya (tidak diuji ulang
 * terhadap izin kasir); potongan promo dibatasi agar subtotal tidak negatif. Promo dipotong dari harga baris
 * yang tersimpan (harga tier, PR9).
 */
export async function hitungPromoCheckout(
  tx: Tx,
  rows: BarisCheckout[],
  pelaku: PenggunaAktif,
  tanggal: string,
  idPelanggan: number | null,
): Promise<HasilPromoCheckout[]> {
  const idBarang = rows.map((r) => r.idBarang);
  const brgPer = await dataBarang(tx, idBarang);
  const konteks = await muatKonteksHarga(tx);
  const bebasModal = pelaku.izin.has('penjualan.harga_manual');
  const bruto = rows.map((r) => subtotalRupiah(r.qty, r.hargaSatuan));
  const totalBruto = bruto.reduce((t, x) => t + x, 0);
  // PR10/PR11: promo berbatas dikunci dulu, baru sisanya dibaca (dua checkout bersamaan jadi berurutan).
  await kunciPromoBerbatas(tx, tanggal);
  const kandidat = await kandidatPromo(
    tx,
    tanggal,
    idBarang,
    [...new Set(rows.map((r) => r.idKategori))],
    await pembeliPromo(tx, idPelanggan),
  );
  const sisaPromo = petaSisaPromo(kandidat);
  return rows.map((r, i) => {
    const b = bruto[i] ?? 0;
    const brg = brgPer.get(r.idBarang);
    if (r.hargaManual || r.promoNonaktif || !brg) {
      return { idPromo: null, namaPromo: null, diskonPromo: 0, subtotal: b - r.diskonBaris };
    }
    const pilih = pilihPromo(
      kandidat,
      {
        idBarang: r.idBarang,
        idKategori: r.idKategori,
        qty: r.qtyDasar,
        qtyHarga: r.qty,
        hargaSatuan: r.hargaSatuan,
        bruto: b,
        batasBawah: bebasModal
          ? null
          : subtotalRupiah(r.qtyDasar, dasarMarkup(brg, konteks.modeDasar)),
        batasPotongan: Math.max(0, b - r.diskonBaris),
      },
      totalBruto,
      tanggal,
      sisaPromo,
    );
    if (pilih.promo) pakaiSisaPromo(sisaPromo, pilih.promo.id, pilih.potongan);
    return {
      idPromo: pilih.promo?.id ?? null,
      namaPromo: pilih.promo?.nama ?? null,
      diskonPromo: pilih.potongan,
      subtotal: b - pilih.potongan - r.diskonBaris,
    };
  });
}
