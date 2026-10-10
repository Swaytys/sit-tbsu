import { and, eq, inArray } from 'drizzle-orm';
import {
  bandingQty,
  formatRupiah,
  kaliQty,
  keQty,
  kunciBaris,
  persenKeRupiah,
  subtotalRupiah,
  tambahQty,
  type DataOrder,
  type SatuanJualBarang,
} from '@sit/shared';
import type { Tx } from '../../db/client';
import { barang, golonganPelanggan, pelanggan, persediaan, tingkatHarga } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import { hargaBarangDasar } from '../master/harga/repo';
import { dasarMarkup, muatKonteksHarga } from '../master/harga/service';
import { muatSatuanJual } from '../master/satuan-jual/service';
import { pilihPromo, type KandidatPromo } from '../promo/hitung';
import { kandidatPromo, type PembeliPromo } from '../promo/repo';
import { ambilAngka } from '../sistem/konfigurasi/service';

/*
 * Harga, promo, diskon, dan total baris penjualan (docs/05 P2–P4, docs/06 H8–H9, D1–D5, PR1–PR9). Dipakai
 * order, pratinjau, dan checkout agar aturan harga hanya ada di satu tempat. Urutan per baris: harga (tier
 * menurut qty / snapshot / manual) → bruto → promo atas harga normal (PR4, menurut barang dan pembeli) →
 * harga termurah antara tier qty dan normal + promo (K-097) → diskon manual (D3) → subtotal.
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
  idTingkatHarga: number | null;
  /** K-094: tier dipilih kasir (tombol T); `false` = otomatis (syarat qty, K-097). */
  tierDipilih: boolean;
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
  /** H8: tier pilihan kasir lebih mahal dari tier yang syarat qty-nya terpenuhi (saran, tidak memaksa). */
  idTingkatHargaSaran: number | null;
};

export type HasilHarga = {
  baris: BarisSiap[];
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

/** Tier default (P3, K-097): harga bawaan semua pembeli sebelum syarat qty tier lain terpenuhi. */
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
 * H8 (K-094, K-097): tier otomatis baris = yang termurah di antara tier default dan tier aktif yang syarat
 * qty-nya terpenuhi oleh total satuan dasar barang itu. Syarat qty = `harga_barang.min_qty` barang itu, atau
 * `tingkat_harga.min_qty`; tier tanpa syarat qty hanya dipakai bila dipilih manual. Seri → tier qty.
 */
export function pilihTierOtomatis(
  idDefault: number,
  tierAktif: { id: number }[],
  qtyDasar: string,
  minQty: (idTier: number) => string | null,
  hargaTier: (idTier: number) => number | undefined,
): number {
  let pilih = { id: idDefault, harga: hargaTier(idDefault) };
  for (const t of tierAktif) {
    const syarat = minQty(t.id);
    if (t.id === idDefault || syarat === null) continue;
    if (bandingQty(qtyDasar, syarat) < 0) continue;
    const h = hargaTier(t.id);
    if (h === undefined || h <= 0) continue;
    // Seri dengan tier default → tier qty (pembeli memang memenuhi syarat harga itu).
    if (
      pilih.harga === undefined ||
      h < pilih.harga ||
      (h === pilih.harga && pilih.id === idDefault)
    )
      pilih = { id: t.id, harga: h };
  }
  return pilih.id;
}

/**
 * Menghitung baris penjualan dari input: harga tier menurut qty (H8) dan snapshot (P2), promo menurut barang
 * dan pembeli (PR1–PR6, K-097), harga termurah antara tier qty dan harga normal + promo (tidak digabung,
 * K-097), diskon manual (D1–D4), dan total (P4). Memeriksa izin tier/harga manual/diskon/lepas promo untuk
 * nilai yang diubah pelaku. Tidak menulis apa pun.
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
    .select({ id: tingkatHarga.id, minQty: tingkatHarga.minQty })
    .from(tingkatHarga)
    .where(eq(tingkatHarga.statusAktif, 'AKTIF'));
  const minQtyTier = new Map(tierAktif.map((t) => [t.id, t.minQty]));
  const harga = new Map<string, number>();
  const minQtyBarang = new Map<string, string>();
  for (const h of await hargaBarangDasar(tx, idBarang)) {
    harga.set(`${h.idBarang}:${h.idTingkatHarga}`, h.hargaJual);
    if (h.minQty !== null) minQtyBarang.set(`${h.idBarang}:${h.idTingkatHarga}`, h.minQty);
  }
  /** Syarat qty tier untuk barang: khusus barang itu, atau syarat tier (K-097). */
  const minQtyUntuk = (idBrg: number, idTier: number) =>
    minQtyBarang.get(`${idBrg}:${idTier}`) ?? minQtyTier.get(idTier) ?? null;
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
  // K-095: syarat qty tier dihitung dari total satuan dasar barang itu di transaksi (semua baris satuannya).
  const totalDasar = new Map<number, string>();
  for (const b of input.baris) {
    const f = b.idSatuanJual === null ? '1' : (satuanJual.get(b.idSatuanJual)?.s.faktor ?? '1');
    totalDasar.set(
      b.idBarang,
      tambahQty(totalDasar.get(b.idBarang) ?? '0', kaliQty(keQty(b.qty), f)),
    );
  }
  const konteks = await muatKonteksHarga(tx);
  const batas = await batasDiskon(tx, pelaku);
  const bolehDiskon = pelaku.izin.has('penjualan.diskon');
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
  ): { harga: number | null; janji: boolean } => {
    const janji =
      lama !== undefined &&
      !lama.hargaManual &&
      lama.idTingkatHarga === idTier &&
      lama.idSatuanJual === b.idSatuanJual;
    if (janji) return { harga: lama.hargaSatuan, janji };
    const kini = hargaUntuk(b.idBarang, b.idSatuanJual, idTier);
    return { harga: kini === undefined || kini <= 0 ? null : kini, janji };
  };

  // Tahap 1: harga dan bruto setiap baris (tier qty), dan harga normal pembanding promo.
  const tahap1 = input.baris.map((b, i) => {
    const brg = brgPer.get(b.idBarang);
    if (!brg) throw galatBaris(i, 'idBarang', 'Barang tidak ditemukan.');
    if (brg.statusAktif !== 'AKTIF') {
      throw galatBaris(i, 'idBarang', `${brg.namaBarang} nonaktif dan tidak bisa dijual.`);
    }
    const qty = keQty(b.qty);
    const lama = lamaPer.get(kunciBaris(b.idBarang, b.idSatuanJual));
    const qtyTier = totalDasar.get(b.idBarang) ?? '0';
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
    // Dasar modal per satuan baris (H9, PR6): D × faktor.
    const dasar = subtotalRupiah(faktor, dasarMarkup(brg, konteks.modeDasar));
    let idTier: number | null = null;
    const tierDipilih = !b.hargaManual && b.idTingkatHarga !== null;
    let hargaSatuan: number;
    let hargaNormal: number | null = null;
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
      // K-094/K-097: tanpa pilihan kasir, tier ditentukan otomatis dari qty.
      idTier =
        b.idTingkatHarga ??
        pilihTierOtomatis(
          idDefault,
          tierAktif,
          qtyTier,
          (t) => minQtyUntuk(b.idBarang, t),
          (t) => hargaUntuk(b.idBarang, b.idSatuanJual, t),
        );
      if (!minQtyTier.has(idTier)) throw galatBaris(i, 'idTingkatHarga', 'Tier harga tidak aktif.');
      const tier = hargaTierBaris(b, lama, idTier);
      if (
        tierDipilih &&
        idTier !== idDefault &&
        !tier.janji &&
        !pelaku.izin.has('penjualan.tier.ubah')
      ) {
        throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin mengganti tier harga.', 403);
      }
      if (tier.harga === null) {
        throw galatBaris(
          i,
          'idTingkatHarga',
          `Harga ${brg.namaBarang} belum ada (harga modal belum diketahui). ` +
            'Catat penerimaan barangnya, atau isi harganya (Rp) di Data Barang.',
        );
      }
      hargaSatuan = tier.harga;
      // K-097: pembanding promo = harga normal (tier default) baris ini.
      hargaNormal = idTier === idDefault ? hargaSatuan : hargaTierBaris(b, lama, idDefault).harga;
    }
    return {
      b,
      brg,
      qty,
      qtyDasar,
      faktor,
      lama,
      dasar,
      qtyTier,
      idTier,
      tierDipilih,
      hargaSatuan,
      hargaNormal,
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

  // Tahap 2: promo, harga termurah, diskon manual, subtotal, dan saran tier per baris.
  const baris: BarisSiap[] = tahap1.map((x, i) => {
    const { b, brg, qty, qtyDasar, lama } = x;
    const tanpaPromo = b.tanpaPromo;
    if (tanpaPromo !== (lama?.promoNonaktif ?? false) && !pelaku.izin.has('penjualan.checkout')) {
      throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin melepas atau memasang promo.', 403);
    }
    // K-097: promo dihitung dari harga normal dan tidak digabung dengan harga tier qty. Tier yang dipilih
    // kasir selain tier default tidak mendapat promo. Promo tidak berlaku untuk harga manual (K-087).
    const bisaPromo =
      !b.hargaManual && x.hargaNormal !== null && (!x.tierDipilih || x.idTier === idDefault);
    const brutoNormal = x.hargaNormal === null ? 0 : subtotalRupiah(qty, x.hargaNormal);
    const pilih = !bisaPromo
      ? { promo: null, potongan: 0, ditolakDiBawahModal: false }
      : pilihPromo(
          kandidat,
          {
            idBarang: b.idBarang,
            idKategori: brg.idKategori,
            qty: qtyDasar,
            qtyHarga: qty,
            hargaSatuan: x.hargaNormal ?? 0,
            bruto: brutoNormal,
            batasBawah: bebasModal ? null : subtotalRupiah(qty, x.dasar),
            ...(b.diskonBarisPersen === null
              ? { batasPotongan: Math.max(0, brutoNormal - b.diskonBaris) }
              : {}),
          },
          totalBruto,
          tanggal,
        );
    // Harga termurah bagi pembeli: harga normal dipotong promo, atau harga tier qty tanpa promo.
    const promoDipakai =
      !tanpaPromo && pilih.promo !== null && brutoNormal - pilih.potongan < x.bruto;
    const idTingkatHarga = promoDipakai ? idDefault : x.idTier;
    const hargaSatuan = promoDipakai ? (x.hargaNormal ?? 0) : x.hargaSatuan;
    const bruto = promoDipakai ? brutoNormal : x.bruto;
    const diskonPromo = promoDipakai ? pilih.potongan : 0;

    // D1/D3: diskon manual atas subtotal setelah promo; D2 batas peran untuk nilai yang diubah pelaku.
    const dasarManual = bruto - diskonPromo;
    const diskonBaris =
      b.diskonBarisPersen !== null
        ? persenKeRupiah(dasarManual, b.diskonBarisPersen)
        : b.diskonBaris;
    const diskonSama = lama !== undefined && lama.diskonBaris === diskonBaris;
    if (diskonBaris > 0 && !diskonSama) {
      if (!bolehDiskon) {
        throw new AppError('TIDAK_BERIZIN', 'Anda tidak berizin memberi diskon.', 403);
      }
      if (melebihiBatas(diskonBaris, dasarManual, batas)) {
        throw galatBaris(i, 'diskonBaris', `Diskon melebihi batas peran Anda (${batas}%).`);
      }
    }
    if (diskonBaris > dasarManual) {
      throw galatBaris(i, 'diskonBaris', 'Diskon melebihi harga baris.');
    }

    // H8: tier pilihan kasir, padahal tier lain yang syarat qty-nya terpenuhi lebih murah: disarankan.
    let saran: { id: number; harga: number } | null = null;
    if (x.tierDipilih) {
      for (const t of tierAktif) {
        const syarat = minQtyUntuk(b.idBarang, t.id);
        if (t.id === x.idTier || syarat === null) continue;
        if (bandingQty(x.qtyTier, syarat) < 0) continue;
        const h = hargaUntuk(b.idBarang, b.idSatuanJual, t.id);
        if (h === undefined || h <= 0 || h >= x.hargaSatuan) continue;
        if (!saran || h < saran.harga) saran = { id: t.id, harga: h };
      }
    }

    return {
      idBarang: b.idBarang,
      namaBarang: brg.namaBarang,
      idKategori: brg.idKategori,
      idSatuanJual: b.idSatuanJual,
      faktor: x.faktor,
      qty,
      qtyDasar,
      idTingkatHarga,
      tierDipilih: x.tierDipilih,
      hargaSatuan,
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
      idTingkatHargaSaran: saran?.id ?? null,
    };
  });

  const subtotal = baris.reduce((t, b) => t + b.subtotal, 0);
  const diskonTransaksi =
    input.diskonTransaksiPersen !== null
      ? persenKeRupiah(subtotal, input.diskonTransaksiPersen)
      : input.diskonTransaksi;
  if (diskonTransaksi > 0) {
    if (diskonTransaksi !== opsi.diskonTransaksiLama) {
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
  /** Tier baris; promo hanya untuk baris harga normal (tier default, K-097). */
  idTingkatHarga: number | null;
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
 * terhadap izin kasir); potongan promo dibatasi agar subtotal tidak negatif. Baris berharga tier qty tidak
 * mendapat promo (tidak digabung, K-097).
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
  const kandidat = await kandidatPromo(
    tx,
    tanggal,
    idBarang,
    [...new Set(rows.map((r) => r.idKategori))],
    await pembeliPromo(tx, idPelanggan),
  );
  const idDefault = await tierDefault(tx);
  return rows.map((r, i) => {
    const b = bruto[i] ?? 0;
    const brg = brgPer.get(r.idBarang);
    if (r.hargaManual || r.promoNonaktif || r.idTingkatHarga !== idDefault || !brg) {
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
    );
    return {
      idPromo: pilih.promo?.id ?? null,
      namaPromo: pilih.promo?.nama ?? null,
      diskonPromo: pilih.potongan,
      subtotal: b - pilih.potongan - r.diskonBaris,
    };
  });
}
