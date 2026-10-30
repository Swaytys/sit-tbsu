import {
  bandingQty,
  kelipatanQty,
  tambahQty,
  kaliQty,
  potonganGratisRupiah,
  potonganPersenRupiah,
  qtyGratis,
  subtotalRupiah,
  type JenisPotongan,
  type KelompokSasaran,
  type SasaranPromo,
} from '@sit/shared';
import { hariJamLokal } from '../../lib/waktu';

/*
 * Hitungan promo murni (docs/06 PR1–PR4, PR6, PR12–PR15; K-087, K-163). Tidak membaca database: kandidat dimuat
 * repo, lalu fungsi di sini memilih satu promo per baris. Uang selalu rupiah utuh, qty lewat helper qty
 * (aturan 7–8).
 */

export type KandidatPromo = {
  id: number;
  kode: string;
  nama: string;
  /** K-163: berlaku dari `mulaiPada` sampai `selesaiPada` (inklusif). */
  mulaiPada: Date;
  selesaiPada: Date;
  /** Bit (hari ISO − 1); `null` = setiap hari. */
  hariBerlaku: number | null;
  jamMulai: string | null;
  jamSelesai: string | null;
  statusAktif: string;
  jenisPotongan: JenisPotongan;
  potonganPersen: string | null;
  potonganNominal: number | null;
  maksPotongan: number | null;
  hargaKhusus: number | null;
  beliQty: string | null;
  gratisQty: string | null;
  /** K-194: batas kelipatan per baris (GRATIS/BELI_POTONG); `null` = tanpa batas. */
  maksKelipatan: number | null;
  sasaran: SasaranPromo;
  /** Id barang/kategori/merk sasaran sesuai `sasaran` (kosong bila SEMUA atau KELOMPOK). */
  idSasaran: number[];
  /** K-185: kelompok sasaran (hanya `sasaran` KELOMPOK). */
  kelompok: KelompokSasaran[];
  minQty: string | null;
  minBelanja: number | null;
  /**
   * K-110: potongan yang masih boleh diberikan promo ini kepada pembeli transaksi ini, yaitu yang terkecil
   * dari sisa anggaran promo dan sisa batas per pembeli; `null` = tanpa batas.
   */
  sisaPotongan: number | null;
};

/**
 * K-110: sisa potongan tiap promo yang berbatas, untuk dibagi ke baris-baris satu transaksi secara berurutan
 * (baris pertama mengambil dulu; baris berikutnya mendapat sisanya).
 */
export function petaSisaPromo(kandidat: KandidatPromo[]): Map<number, number> {
  return new Map(
    kandidat.flatMap((p) => (p.sisaPotongan === null ? [] : [[p.id, Math.max(0, p.sisaPotongan)]])),
  );
}

/** Mengurangi sisa potongan promo setelah dipakai satu baris. */
export function pakaiSisaPromo(sisa: Map<number, number>, idPromo: number, potongan: number): void {
  const s = sisa.get(idPromo);
  if (s !== undefined) sisa.set(idPromo, Math.max(0, s - potongan));
}

export type BarisUntukPromo = {
  idBarang: number;
  idKategori: number;
  idMerk: number | null;
  /** Qty satuan dasar: syarat min qty (PR2), potongan nominal, harga khusus, dan gratis (K-091, K-163). */
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

/** K-194: jumlah kelipatan dibatasi `maks` (null = tanpa batas). */
const batasi = (n: number, maks: number | null) => (maks === null ? n : Math.min(n, maks));

/** Bit hari ISO (1 = Senin … 7 = Minggu) dalam `hari_berlaku`. */
export function bitHari(hari: number[]): number | null {
  return hari.length === 0 ? null : hari.reduce((m, h) => m | (1 << (h - 1)), 0);
}

export function hariDariBit(bit: number | null): number[] {
  if (bit === null) return [];
  return [1, 2, 3, 4, 5, 6, 7].filter((h) => (bit & (1 << (h - 1))) !== 0);
}

/**
 * PR1 + PR12: promo AKTIF, `mulai_pada ≤ saat ≤ selesai_pada`, hari ini termasuk hari berlaku, dan jam sekarang
 * di dalam jam harian `[jam_mulai, jam_selesai)` bila diisi (zona toko).
 */
export function promoBerlaku(p: KandidatPromo, saat: Date): boolean {
  if (p.statusAktif !== 'AKTIF') return false;
  if (saat < p.mulaiPada || saat > p.selesaiPada) return false;
  const { hari, jam } = hariJamLokal(saat);
  if (p.hariBerlaku !== null && (p.hariBerlaku & (1 << (hari - 1))) === 0) return false;
  if (p.jamMulai !== null && p.jamSelesai !== null && (jam < p.jamMulai || jam >= p.jamSelesai)) {
    return false;
  }
  return true;
}

/** K-185 PR16: barang cocok dengan satu kelompok bila semua kolom yang diisi di kelompok itu sama. */
export function cocokKelompok(k: KelompokSasaran, b: BarisUntukPromo): boolean {
  return (
    (k.idKategori === null || k.idKategori === b.idKategori) &&
    (k.idMerk === null || k.idMerk === b.idMerk) &&
    (k.idBarang === null || k.idBarang === b.idBarang)
  );
}

/** PR2 + PR13: sasaran cocok, qty ≥ min_qty (bila diisi), total bruto transaksi ≥ min_belanja (bila diisi). */
export function promoCocok(p: KandidatPromo, b: BarisUntukPromo, totalBruto: number): boolean {
  if (p.sasaran === 'KELOMPOK' && !p.kelompok.some((k) => cocokKelompok(k, b))) return false;
  if (p.sasaran === 'KATEGORI' && !p.idSasaran.includes(b.idKategori)) return false;
  if (p.sasaran === 'MERK' && (b.idMerk === null || !p.idSasaran.includes(b.idMerk))) return false;
  if (p.sasaran === 'BARANG' && !p.idSasaran.includes(b.idBarang)) return false;
  if (p.minQty !== null && bandingQty(b.qty, p.minQty) < 0) return false;
  if (p.minBelanja !== null && totalBruto < p.minBelanja) return false;
  return true;
}

/**
 * PR3 + PR14: potongan baris. PERSEN = bulatkanRupiah(qty × harga × persen ÷ 100), dibatasi maks_potongan;
 * NOMINAL = bulatkanRupiah(qty × potongan per satuan); HARGA_KHUSUS = bruto − bulatkanRupiah(qty dasar × harga
 * khusus); GRATIS = nilai qty gratis (⌊qty ÷ (beli + gratis)⌋ × gratis) dari harga baris. Selalu 0 ≤ potongan ≤
 * bruto (dan ≤ batas potongan baris). BELI_POTONG = ⌊qty dasar ÷ N⌋ × Rp X (K-185).
 */
export function potonganPromo(p: KandidatPromo, b: BarisUntukPromo): number {
  let nilai: number;
  switch (p.jenisPotongan) {
    case 'PERSEN':
      nilai = potonganPersenRupiah(b.qtyHarga ?? b.qty, b.hargaSatuan, p.potonganPersen ?? '0');
      if (p.maksPotongan !== null) nilai = Math.min(nilai, p.maksPotongan);
      break;
    case 'NOMINAL':
      nilai = subtotalRupiah(b.qty, p.potonganNominal ?? 0);
      break;
    case 'HARGA_KHUSUS':
      nilai = p.hargaKhusus === null ? 0 : b.bruto - subtotalRupiah(b.qty, p.hargaKhusus);
      break;
    case 'GRATIS': {
      if (p.beliQty === null || p.gratisQty === null) {
        nilai = 0;
        break;
      }
      // K-194: jumlah paket (beli + gratis) dibatasi maks kelipatan.
      const paket = batasi(kelipatanQty(b.qty, tambahQty(p.beliQty, p.gratisQty)), p.maksKelipatan);
      const gratis =
        p.maksKelipatan === null
          ? qtyGratis(b.qty, p.beliQty, p.gratisQty)
          : kaliQty(String(paket), p.gratisQty);
      nilai = potonganGratisRupiah(b.bruto, gratis, b.qty);
      break;
    }
    case 'BELI_POTONG':
      // K-185 PR17: setiap kelipatan N (satuan dasar) dipotong Rp X; beli 2 potong Rp 2.000, qty 5 → Rp 4.000.
      // K-194: paling banyak `maks_kelipatan` kali.
      nilai =
        p.beliQty === null || p.potonganNominal === null
          ? 0
          : batasi(kelipatanQty(b.qty, p.beliQty), p.maksKelipatan) * p.potonganNominal;
      break;
  }
  return Math.max(0, Math.min(nilai, b.bruto, b.batasPotongan ?? b.bruto));
}

export type HasilPilihPromo = {
  promo: KandidatPromo | null;
  potongan: number;
  /** PR6: ada promo yang lebih besar tetapi tidak berlaku karena harga jadi di bawah modal. */
  ditolakDiBawahModal: boolean;
};

/**
 * PR4 + PR6: satu promo per baris. Kandidat yang berlaku dan cocok diurutkan potongan terbesar, lalu waktu
 * mulai terbaru, lalu id terbesar (pemutus seri, K-087). Promo yang membuat harga di bawah batas bawah dilewati
 * dan promo aman berikutnya dipakai (keputusan pemilik).
 *
 * PR10/PR11 (K-110): potongan tiap promo dibatasi `sisa` (sisa anggaran dan sisa batas per pembeli, sudah
 * dikurangi baris sebelumnya di transaksi yang sama). Promo yang sisanya 0 gugur; yang sisanya kurang dari
 * potongan penuh tetap berlaku sebesar sisanya. Pemanggil mengurangi `sisa` dengan `pakaiSisaPromo`.
 */
export function pilihPromo(
  kandidat: KandidatPromo[],
  b: BarisUntukPromo,
  totalBruto: number,
  saat: Date,
  sisa: ReadonlyMap<number, number> = new Map(),
): HasilPilihPromo {
  const urut = kandidat
    .filter((p) => promoBerlaku(p, saat) && promoCocok(p, b, totalBruto))
    .map((p) => ({ p, potongan: Math.min(potonganPromo(p, b), sisa.get(p.id) ?? Infinity) }))
    .filter((x) => x.potongan > 0)
    .sort(
      (x, y) =>
        y.potongan - x.potongan ||
        y.p.mulaiPada.getTime() - x.p.mulaiPada.getTime() ||
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
