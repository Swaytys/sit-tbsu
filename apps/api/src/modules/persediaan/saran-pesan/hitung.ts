import {
  bagiQty,
  bandingQty,
  bulatAtasQty,
  kaliQty,
  keQty,
  kurangQty,
  rapikanDesimal,
  type StatusSaranPesan,
} from '@sit/shared';

/*
 * Rumus rekomendasi pemesanan ulang (K-113, docs/05 §17). Fungsi murni tanpa akses database, supaya setiap aturan
 * bisa diuji dengan angka contoh. Semua kuantitas dalam satuan dasar barang; aritmatika lewat helper qty
 * (decimal.js), tidak pernah `number`.
 */

export type MasukanSaran = {
  /** Terjual bersih selama hari amatan (penjualan + barang pengganti tukar − retur − void). */
  terjual: string;
  hariAmatan: number;
  stokTersedia: string;
  lamaKirimHari: number;
  jarakBelanjaHari: number;
  hariPengaman: number;
  /** Faktor kemasan beli terbesar yang aktif (> 1), mis. "10" untuk dus isi 10; `null` = tidak ada. */
  faktorKemasan: string | null;
};

export type HasilHitungSaran = {
  rataPerHari: string;
  stokPengaman: string;
  titikPesan: string;
  stokTarget: string;
  saranPesan: string;
  /** Jumlah kemasan (dibulatkan ke atas) untuk saran ini; `null` bila tanpa kemasan atau saran 0. */
  saranKemasan: string | null;
  hariCukup: string | null;
  status: StatusSaranPesan;
};

const NOL = keQty(0);

/**
 * RO1–RO6. Pembagian dengan hari amatan dilakukan sekali per angka (bukan dari rata-rata yang sudah dibulatkan),
 * supaya pembulatan tidak menumpuk:
 * - rata/hari = terjual ÷ hari amatan
 * - stok pengaman = terjual × hari pengaman ÷ hari amatan
 * - titik pesan = terjual × (lama kirim + hari pengaman) ÷ hari amatan
 * - stok target = terjual × (lama kirim + jarak belanja + hari pengaman) ÷ hari amatan
 * - saran = bulat ke atas (stok target − stok tersedia), paling kecil 0
 * - status: tidak terjual → TIDAK_LAKU; tersedia ≤ titik pesan → PESAN_SEKARANG; tersedia < stok target →
 *   SEGERA; selain itu AMAN.
 */
export function hitungSaran(m: MasukanSaran): HasilHitungSaran {
  const terjual = bandingQty(m.terjual, 0) > 0 ? keQty(m.terjual) : NOL;
  if (m.hariAmatan <= 0 || bandingQty(terjual, 0) <= 0) {
    return {
      rataPerHari: NOL,
      stokPengaman: NOL,
      titikPesan: NOL,
      stokTarget: NOL,
      saranPesan: NOL,
      saranKemasan: null,
      hariCukup: null,
      status: 'TIDAK_LAKU',
    };
  }
  const per = (hari: number) => bagiQty(kaliQty(terjual, hari), m.hariAmatan);
  const rataPerHari = per(1);
  const stokPengaman = per(m.hariPengaman);
  const titikPesan = per(m.lamaKirimHari + m.hariPengaman);
  const stokTarget = per(m.lamaKirimHari + m.jarakBelanjaHari + m.hariPengaman);
  const kurang = kurangQty(stokTarget, m.stokTersedia);
  const saranPesan = bandingQty(kurang, 0) > 0 ? bulatAtasQty(kurang) : NOL;
  const tersedia = bandingQty(m.stokTersedia, 0) > 0 ? keQty(m.stokTersedia) : NOL;
  const hariCukup = bagiQty(kaliQty(tersedia, m.hariAmatan), terjual);
  const status: StatusSaranPesan =
    bandingQty(m.stokTersedia, titikPesan) <= 0
      ? 'PESAN_SEKARANG'
      : bandingQty(m.stokTersedia, stokTarget) < 0
        ? 'SEGERA'
        : 'AMAN';
  const saranKemasan =
    m.faktorKemasan !== null && bandingQty(saranPesan, 0) > 0
      ? rapikanDesimal(bulatAtasQty(bagiQty(saranPesan, m.faktorKemasan)))
      : null;
  return {
    rataPerHari,
    stokPengaman,
    titikPesan,
    stokTarget,
    saranPesan,
    saranKemasan,
    hariCukup,
    status,
  };
}
