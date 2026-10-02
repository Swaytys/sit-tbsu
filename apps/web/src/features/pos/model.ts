import {
  POLA_QTY,
  subtotalRupiah,
  type BarisBarang,
  type DetailOrder,
  type InputBarisOrder,
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
  satuan: string;
  /** Stok tersedia saat barang dipilih (info), `null` bila tidak diketahui. */
  stokTersedia: string | null;
  qty: string;
  /** `null` = tier bawaan transaksi (tier pelanggan / tier default). */
  idTingkatHarga: number | null;
  hargaManual: boolean;
  /** Harga manual, bila `hargaManual`. */
  hargaSatuan: number | null;
  hargaTier: HargaTier[];
  /** Harga yang dijanjikan saat order dibuat (P2): berlaku selama tier baris tidak berubah. */
  snapshot: { idTingkatHarga: number | null; hargaSatuan: number } | null;
  diskonBaris: number;
};

export function qtySah(q: string): boolean {
  return POLA_QTY.test(q) && /[1-9]/.test(q);
}

/** Harga satuan yang tampil untuk baris (perkiraan; P2/P3/H9). */
export function hargaBaris(b: BarisPos, tierBawaan: number | null): number | null {
  if (b.hargaManual) return b.hargaSatuan;
  const tier = b.idTingkatHarga ?? tierBawaan;
  if (b.snapshot && b.snapshot.idTingkatHarga === tier) return b.snapshot.hargaSatuan;
  return b.hargaTier.find((h) => h.idTingkatHarga === tier)?.hargaJual ?? null;
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

export function dariBarang(b: BarisBarang, qty: string): BarisPos {
  return {
    idBarang: b.id,
    kode: b.kode,
    nama: b.namaBarang,
    satuan: b.kodeSatuan,
    stokTersedia: b.stokTersedia,
    qty,
    idTingkatHarga: null,
    hargaManual: false,
    hargaSatuan: null,
    hargaTier: b.harga.map((h) => ({ idTingkatHarga: h.idTingkatHarga, hargaJual: h.hargaJual })),
    snapshot: null,
    diskonBaris: 0,
  };
}

export function dariOrder(d: DetailOrder): BarisPos[] {
  return d.baris.map((r) => ({
    idBarang: r.idBarang,
    kode: r.kodeBarang,
    nama: r.namaBarang,
    satuan: r.kodeSatuan,
    stokTersedia: r.stokTersedia,
    qty: rapikanQty(r.qty),
    idTingkatHarga: r.hargaManual ? null : r.idTingkatHarga,
    hargaManual: r.hargaManual,
    hargaSatuan: r.hargaManual ? r.hargaSatuan : null,
    hargaTier: r.hargaTier,
    snapshot: r.hargaManual
      ? null
      : { idTingkatHarga: r.idTingkatHarga, hargaSatuan: r.hargaSatuan },
    diskonBaris: r.diskonBaris,
  }));
}

/** Baris → isian order untuk API (skemaBarisOrder). */
export function keBarisOrder(b: BarisPos): InputBarisOrder {
  return {
    idBarang: b.idBarang,
    qty: b.qty,
    idTingkatHarga: b.hargaManual ? null : b.idTingkatHarga,
    hargaManual: b.hargaManual,
    hargaSatuan: b.hargaManual ? b.hargaSatuan : null,
    diskonBaris: b.diskonBaris,
  };
}

/**
 * Isian kotak cari: "3*semen" atau "3x semen" = qty 3 untuk barang berikutnya (kebiasaan POS ritel);
 * koma desimal diterima ("0,5*paku").
 */
export function uraikanCari(teks: string): { qty: string; kata: string } {
  const m = /^\s*(\d+(?:[.,]\d{1,3})?)\s*[*x×]\s*(.*)$/i.exec(teks);
  if (m?.[1] !== undefined && m[2] !== undefined && qtySah(m[1].replace(',', '.'))) {
    return { qty: m[1].replace(',', '.'), kata: m[2].trim() };
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
