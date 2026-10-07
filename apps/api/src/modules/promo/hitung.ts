import {
  bandingQty,
  potonganPersenRupiah,
  subtotalRupiah,
  type JenisPotongan,
  type SasaranPromo,
} from '@sit/shared';

/*
 * Hitungan promo murni (docs/06 PR1–PR4, PR6; K-087). Tidak membaca database: kandidat dimuat repo, lalu
 * fungsi di sini memilih satu promo per baris. Uang selalu rupiah utuh, qty lewat helper qty (aturan 7–8).
 */

export type KandidatPromo = {
  id: number;
  kode: string;
  nama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  statusAktif: string;
  jenisPotongan: JenisPotongan;
  potonganPersen: string | null;
  potonganNominal: number | null;
  maksPotongan: number | null;
  sasaran: SasaranPromo;
  idKategori: number | null;
  idBarang: number | null;
  minQty: string | null;
  minBelanja: number | null;
};

export type BarisUntukPromo = {
  idBarang: number;
  idKategori: number;
  /** Qty satuan dasar: syarat min qty (PR2) dan potongan nominal per satuan (K-091). */
  qty: string;
  /** Qty dalam satuan `hargaSatuan` (satuan jual baris); bawaan = `qty`. */
  qtyHarga?: string;
  hargaSatuan: number;
  /** bulatkanRupiah(qty × harga satuan). */
  bruto: number;
  /**
   * PR6: batas bawah harga setelah promo = bulatkanRupiah(qty × D) untuk pelaku tanpa izin harga di bawah
   * modal; `null` = tanpa batas (Admin/Owner).
   */
  batasBawah: number | null;
  /** Potongan maksimum agar subtotal tidak negatif (bruto − diskon manual yang sudah ada). */
  batasPotongan?: number;
};

/** PR1: promo AKTIF dan tanggal transaksi di [tanggal_mulai, tanggal_selesai] (tanggal YYYY-MM-DD). */
export function promoBerlaku(p: KandidatPromo, tanggal: string): boolean {
  return p.statusAktif === 'AKTIF' && p.tanggalMulai <= tanggal && tanggal <= p.tanggalSelesai;
}

/** PR2: sasaran cocok, qty ≥ min_qty (bila diisi), total bruto transaksi ≥ min_belanja (bila diisi). */
export function promoCocok(p: KandidatPromo, b: BarisUntukPromo, totalBruto: number): boolean {
  if (p.sasaran === 'KATEGORI' && p.idKategori !== b.idKategori) return false;
  if (p.sasaran === 'BARANG' && p.idBarang !== b.idBarang) return false;
  if (p.minQty !== null && bandingQty(b.qty, p.minQty) < 0) return false;
  if (p.minBelanja !== null && totalBruto < p.minBelanja) return false;
  return true;
}

/**
 * PR3: potongan baris. PERSEN = bulatkanRupiah(qty × harga × persen ÷ 100), dibatasi maks_potongan; NOMINAL =
 * bulatkanRupiah(qty × potongan per satuan). Selalu 0 ≤ potongan ≤ bruto (dan ≤ batas potongan baris).
 */
export function potonganPromo(p: KandidatPromo, b: BarisUntukPromo): number {
  let nilai =
    p.jenisPotongan === 'PERSEN'
      ? potonganPersenRupiah(b.qtyHarga ?? b.qty, b.hargaSatuan, p.potonganPersen ?? '0')
      : subtotalRupiah(b.qty, p.potonganNominal ?? 0);
  if (p.jenisPotongan === 'PERSEN' && p.maksPotongan !== null)
    nilai = Math.min(nilai, p.maksPotongan);
  return Math.max(0, Math.min(nilai, b.bruto, b.batasPotongan ?? b.bruto));
}

export type HasilPilihPromo = {
  promo: KandidatPromo | null;
  potongan: number;
  /** PR6: ada promo yang lebih besar tetapi tidak berlaku karena harga jadi di bawah modal. */
  ditolakDiBawahModal: boolean;
};

/**
 * PR4 + PR6: satu promo per baris. Kandidat yang berlaku dan cocok diurutkan potongan terbesar, lalu
 * tanggal_mulai terbaru, lalu id terbesar (pemutus seri, K-087). Promo yang membuat harga di bawah batas
 * bawah dilewati dan promo aman berikutnya dipakai (keputusan pemilik).
 */
export function pilihPromo(
  kandidat: KandidatPromo[],
  b: BarisUntukPromo,
  totalBruto: number,
  tanggal: string,
): HasilPilihPromo {
  const urut = kandidat
    .filter((p) => promoBerlaku(p, tanggal) && promoCocok(p, b, totalBruto))
    .map((p) => ({ p, potongan: potonganPromo(p, b) }))
    .filter((x) => x.potongan > 0)
    .sort(
      (x, y) =>
        y.potongan - x.potongan ||
        (x.p.tanggalMulai < y.p.tanggalMulai ? 1 : x.p.tanggalMulai > y.p.tanggalMulai ? -1 : 0) ||
        y.p.id - x.p.id,
    );
  let ditolak = false;
  for (const x of urut) {
    if (b.batasBawah !== null && b.bruto - x.potongan < b.batasBawah) {
      ditolak = true;
      continue;
    }
    return { promo: x.p, potongan: x.potongan, ditolakDiBawahModal: ditolak };
  }
  return { promo: null, potongan: 0, ditolakDiBawahModal: ditolak };
}
