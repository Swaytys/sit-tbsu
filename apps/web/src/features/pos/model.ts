import {
  kaliQty,
  POLA_QTY,
  subtotalRupiah,
  type BarisBarang,
  type DetailOrder,
  type InputBarisOrder,
  type OpsiSatuanBaris,
} from '@sit/shared';

/*
 * Model transaksi layar POS (K-073). Angka di layar hanyalah perkiraan untuk kasir; nilai final selalu dari API
 * (CLAUDE.md aturan 1). Qty disimpan sebagai teks desimal apa adanya.
 */

export type HargaTier = { idTingkatHarga: number; hargaJual: number };

export type BarisPos = {
  idBarang: number;
  kode: string;
  nama: string;
  /** Kode satuan baris (satuan jual terpilih, atau satuan dasar). */
  satuan: string;
  /** K-091: satuan jual baris; `null` = satuan dasar. */
  idSatuanJual: number | null;
  /** Pilihan satuan: satuan dasar lalu satuan jual aktif, masing-masing dengan harga per tier. */
  opsiSatuan: OpsiSatuanBaris[];
  /** Stok tersedia saat barang dipilih (info), `null` bila tidak diketahui. */
  stokTersedia: string | null;
  qty: string;
  /** `null` = tier otomatis (tier default / syarat qty, K-097); diisi = dipilih kasir. */
  idTingkatHarga: number | null;
  hargaManual: boolean;
  /** Harga manual, bila `hargaManual`. */
  hargaSatuan: number | null;
  /** Harga yang dijanjikan saat order dibuat (P2): berlaku selama tier dan satuan baris tidak berubah. */
  snapshot: {
    idTingkatHarga: number | null;
    idSatuanJual: number | null;
    hargaSatuan: number;
  } | null;
  diskonBaris: number;
  /** PR5: promo baris dilepas kasir. */
  tanpaPromo: boolean;
};

export function qtySah(q: string): boolean {
  return POLA_QTY.test(q) && /[1-9]/.test(q);
}

/** Pilihan satuan baris yang sedang dipakai. */
export function opsiKini(b: BarisPos): OpsiSatuanBaris | undefined {
  return b.opsiSatuan.find((o) => o.idSatuanJual === b.idSatuanJual);
}

/**
 * Harga satuan yang tampil untuk baris sebelum pratinjau API tiba (perkiraan; P2/P3/H9). Tier otomatis
 * (K-094) ditentukan API; perkiraan memakai tier harga janji order, atau tier bawaan.
 */
export function hargaBaris(b: BarisPos, tierBawaan: number | null): number | null {
  if (b.hargaManual) return b.hargaSatuan;
  const tier = b.idTingkatHarga ?? b.snapshot?.idTingkatHarga ?? tierBawaan;
  if (
    b.snapshot &&
    b.snapshot.idTingkatHarga === tier &&
    b.snapshot.idSatuanJual === b.idSatuanJual
  )
    return b.snapshot.hargaSatuan;
  return opsiKini(b)?.hargaTier.find((h) => h.idTingkatHarga === tier)?.hargaJual ?? null;
}

/** Qty dalam satuan dasar (info "= 20 sak"); `null` bila satuan baris = satuan dasar. */
export function qtyDasarBaris(b: BarisPos): string | null {
  const o = opsiKini(b);
  if (!o || o.idSatuanJual === null || !qtySah(b.qty)) return null;
  return kaliQty(b.qty, o.faktor);
}

/** Satuan berikutnya (tombol S): satuan dasar → satuan jual → … → satuan dasar. */
export function satuanBerikut(b: BarisPos): Pick<BarisPos, 'idSatuanJual' | 'satuan'> | null {
  if (b.opsiSatuan.length < 2) return null;
  const i = b.opsiSatuan.findIndex((o) => o.idSatuanJual === b.idSatuanJual);
  const o = b.opsiSatuan[(i + 1) % b.opsiSatuan.length];
  return o ? { idSatuanJual: o.idSatuanJual, satuan: o.kodeSatuan } : null;
}

/** Pilihan satuan dari data barang: satuan dasar lalu satuan jual aktif (K-091). */
export function opsiDariBarang(b: BarisBarang): OpsiSatuanBaris[] {
  return [
    {
      idSatuanJual: null,
      kodeSatuan: b.kodeSatuan,
      faktor: '1',
      hargaTier: b.harga.map((h) => ({ idTingkatHarga: h.idTingkatHarga, hargaJual: h.hargaJual })),
    },
    ...b.satuanJual
      .filter((s) => s.statusAktif === 'AKTIF')
      .map((s) => ({
        idSatuanJual: s.id,
        kodeSatuan: s.kodeSatuan,
        faktor: s.faktor,
        hargaTier: s.harga.map((h) => ({
          idTingkatHarga: h.idTingkatHarga,
          hargaJual: h.hargaJual,
        })),
      })),
  ];
}

/** Satuan awal saat barang dipilih: barcode satuan jual yang dipindai, satuan jual bawaan, atau dasar. */
export function satuanAwal(b: BarisBarang): number | null {
  const aktif = b.satuanJual.filter((s) => s.statusAktif === 'AKTIF');
  if (b.idSatuanJualCocok !== null && aktif.some((s) => s.id === b.idSatuanJualCocok))
    return b.idSatuanJualCocok;
  return aktif.find((s) => s.isDefaultJual)?.id ?? null;
}

export function subtotalBaris(b: BarisPos, tierBawaan: number | null): number {
  const h = hargaBaris(b, tierBawaan);
  if (h === null || !qtySah(b.qty)) return 0;
  return Math.max(0, subtotalRupiah(b.qty, h) - b.diskonBaris);
}

/** "2.500" → "2.5"; "3.000" → "3". */
export function rapikanQty(q: string): string {
  return q.includes('.') ? q.replace(/\.?0+$/, '') : q;
}

/** `pilihSatuan` = satuan yang dipilih kasir di hasil cari; tidak diisi = satuan awal barang. */
export function dariBarang(b: BarisBarang, qty: string, pilihSatuan?: number | null): BarisPos {
  const opsi = opsiDariBarang(b);
  const idSatuanJual = pilihSatuan !== undefined ? pilihSatuan : satuanAwal(b);
  return {
    idBarang: b.id,
    kode: b.kode,
    nama: b.namaBarang,
    satuan: opsi.find((o) => o.idSatuanJual === idSatuanJual)?.kodeSatuan ?? b.kodeSatuan,
    idSatuanJual,
    opsiSatuan: opsi,
    stokTersedia: b.stokTersedia,
    qty,
    idTingkatHarga: null,
    hargaManual: false,
    hargaSatuan: null,
    snapshot: null,
    diskonBaris: 0,
    tanpaPromo: false,
  };
}

export function dariOrder(d: DetailOrder): BarisPos[] {
  return d.baris.map((r) => ({
    idBarang: r.idBarang,
    kode: r.kodeBarang,
    nama: r.namaBarang,
    satuan: r.kodeSatuan,
    idSatuanJual: r.idSatuanJual,
    opsiSatuan: r.opsiSatuan,
    stokTersedia: r.stokTersedia,
    qty: rapikanQty(r.qty),
    idTingkatHarga: r.hargaManual || !r.tierDipilih ? null : r.idTingkatHarga,
    hargaManual: r.hargaManual,
    hargaSatuan: r.hargaManual ? r.hargaSatuan : null,
    snapshot: r.hargaManual
      ? null
      : {
          idTingkatHarga: r.idTingkatHarga,
          idSatuanJual: r.idSatuanJual,
          hargaSatuan: r.hargaSatuan,
        },
    diskonBaris: r.diskonBaris,
    tanpaPromo: r.promoNonaktif,
  }));
}

/** Baris → isian order untuk API (skemaBarisOrder). */
export function keBarisOrder(b: BarisPos): InputBarisOrder {
  return {
    idBarang: b.idBarang,
    idSatuanJual: b.idSatuanJual,
    qty: b.qty,
    idTingkatHarga: b.hargaManual ? null : b.idTingkatHarga,
    hargaManual: b.hargaManual,
    hargaSatuan: b.hargaManual ? b.hargaSatuan : null,
    diskonBaris: b.diskonBaris,
    tanpaPromo: b.tanpaPromo,
  };
}

/**
 * Isian kotak cari: "3*semen", "3x semen", atau "semen*3" = qty 3 untuk barang tersebut (kebiasaan POS
 * ritel); koma desimal diterima ("0,5*paku"). Nama barang tidak boleh memuat "*".
 */
export function uraikanCari(teks: string): { qty: string; kata: string } {
  // Qty paling banyak 6 digit: angka lebih panjang adalah barcode ("8991234567890*2" = barcode × 2).
  const depan = /^\s*(\d{1,6}(?:[.,]\d{1,3})?)\s*[*x×]\s*(.*)$/i.exec(teks);
  if (depan?.[1] !== undefined && depan[2] !== undefined && qtySah(depan[1].replace(',', '.'))) {
    return { qty: depan[1].replace(',', '.'), kata: depan[2].trim() };
  }
  const belakang = /^(.*?)\s*\*\s*(\d{1,6}(?:[.,]\d{1,3})?)\s*$/.exec(teks);
  if (
    belakang?.[1] !== undefined &&
    belakang[2] !== undefined &&
    belakang[1].trim() !== '' &&
    qtySah(belakang[2].replace(',', '.'))
  ) {
    return { qty: belakang[2].replace(',', '.'), kata: belakang[1].trim() };
  }
  return { qty: '1', kata: teks.trim() };
}

/** Teks angka rupiah dari isian bebas: hanya digit ("50.000" → "50000"). */
export function digitSaja(teks: string): string {
  return teks
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 13);
}

export function tampilRibuan(digit: string): string {
  return digit ? digit.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}
