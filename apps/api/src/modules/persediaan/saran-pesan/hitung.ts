import {
  akarQty,
  bagiQty,
  bandingQty,
  bulatAtasQty,
  jumlahPerkiraanHolt,
  kaliQty,
  keQty,
  kurangQty,
  pemulusanHolt,
  rapikanDesimal,
  simpanganBakuQty,
  tambahQty,
  teksQty,
  type MetodeSaranPesan,
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

/*
 * K-127 (docs/05 RO9–RO12): metode B statistik, C min–maks, D tren. Metode yang syaratnya tidak terpenuhi untuk
 * suatu barang dihitung dengan A (`hitungSaran`) dan diberi catatan alasannya.
 */

export type MasukanMetode = MasukanSaran & {
  metode: MetodeSaranPesan;
  /** Penjualan bersih per hari selama hari amatan, terlama dulu (hari tanpa penjualan = "0"). */
  harian: readonly string[];
  /** Nilai Z tingkat layanan (metode B). */
  z: string;
  stokMinimum: string;
  stokMaksimum: string | null;
};

export type HasilMetode = HasilHitungSaran & { metode: MetodeSaranPesan; catatan: string | null };

/** Syarat riwayat minimal (hari amatan) metode B dan D. */
export const MIN_HARI_STATISTIK = 30;
export const MIN_HARI_TREN = 14;
const ALFA_TREN = '0.3';
const BETA_TREN = '0.1';

function keA(m: MasukanSaran, catatan: string | null = null): HasilMetode {
  return { ...hitungSaran(m), metode: 'RATA', catatan };
}

/** Saran, kemasan, cukup-hari, dan status RO5–RO6 dari angka hasil suatu metode. */
function selesaikan(
  m: MasukanSaran,
  angka: { rataPerHari: string; stokPengaman: string; titikPesan: string; stokTarget: string },
): HasilHitungSaran {
  const kurang = kurangQty(angka.stokTarget, m.stokTersedia);
  const saranPesan = bandingQty(kurang, 0) > 0 ? bulatAtasQty(kurang) : NOL;
  const tersedia = bandingQty(m.stokTersedia, 0) > 0 ? keQty(m.stokTersedia) : NOL;
  const status: StatusSaranPesan =
    bandingQty(m.stokTersedia, angka.titikPesan) <= 0
      ? 'PESAN_SEKARANG'
      : bandingQty(m.stokTersedia, angka.stokTarget) < 0
        ? 'SEGERA'
        : 'AMAN';
  return {
    ...angka,
    saranPesan,
    saranKemasan:
      m.faktorKemasan !== null && bandingQty(saranPesan, 0) > 0
        ? rapikanDesimal(bulatAtasQty(bagiQty(saranPesan, m.faktorKemasan)))
        : null,
    hariCukup: bandingQty(angka.rataPerHari, 0) > 0 ? bagiQty(tersedia, angka.rataPerHari) : null,
    status,
  };
}

/** RO10: stok pengaman = Z × simpangan baku harian × √lama kirim. */
function statistik(m: MasukanMetode): HasilMetode {
  if (m.hariAmatan < MIN_HARI_STATISTIK) {
    return keA(
      m,
      `Riwayat baru ${m.hariAmatan} hari (metode B butuh ${MIN_HARI_STATISTIK}): dihitung dengan A.`,
    );
  }
  const rata = bagiQty(m.terjual, m.hariAmatan);
  const simpangan = simpanganBakuQty(m.harian);
  const pengaman = kaliQty(kaliQty(m.z, simpangan), akarQty(m.lamaKirimHari));
  return {
    ...selesaikan(m, {
      rataPerHari: rata,
      stokPengaman: pengaman,
      titikPesan: tambahQty(kaliQty(rata, m.lamaKirimHari), pengaman),
      stokTarget: tambahQty(kaliQty(rata, m.lamaKirimHari + m.jarakBelanjaHari), pengaman),
    }),
    metode: 'STATISTIK',
    catatan: `Naik-turun harian ±${teksQty(simpangan)}`,
  };
}

/** RO11: pesan bila tersedia ≤ minimum, sampai maksimum. */
function minMaks(m: MasukanMetode): HasilMetode {
  if (m.stokMaksimum === null) return keA(m, 'Stok maksimum belum diisi: dihitung dengan A.');
  const a = hitungSaran(m);
  const perlu = bandingQty(m.stokTersedia, m.stokMinimum) <= 0;
  const kurang = kurangQty(m.stokMaksimum, m.stokTersedia);
  const saranPesan = perlu && bandingQty(kurang, 0) > 0 ? bulatAtasQty(kurang) : NOL;
  return {
    rataPerHari: a.rataPerHari,
    stokPengaman: keQty(m.stokMinimum),
    titikPesan: keQty(m.stokMinimum),
    stokTarget: keQty(m.stokMaksimum),
    saranPesan,
    saranKemasan:
      m.faktorKemasan !== null && bandingQty(saranPesan, 0) > 0
        ? rapikanDesimal(bulatAtasQty(bagiQty(saranPesan, m.faktorKemasan)))
        : null,
    hariCukup: a.hariCukup,
    status: perlu ? 'PESAN_SEKARANG' : a.status === 'TIDAK_LAKU' ? 'TIDAK_LAKU' : 'AMAN',
    metode: 'MIN_MAKS',
    catatan: null,
  };
}

/** RO12: perkiraan Holt; rata per hari = perkiraan besok. */
function tren(m: MasukanMetode): HasilMetode {
  if (m.hariAmatan < MIN_HARI_TREN) {
    return keA(
      m,
      `Riwayat baru ${m.hariAmatan} hari (metode D butuh ${MIN_HARI_TREN}): dihitung dengan A.`,
    );
  }
  const h = pemulusanHolt(m.harian, ALFA_TREN, BETA_TREN);
  const besok = jumlahPerkiraanHolt(h.level, h.tren, 1);
  const pengaman = kaliQty(besok, m.hariPengaman);
  const arah = bandingQty(h.tren, 0);
  return {
    ...selesaikan(m, {
      rataPerHari: besok,
      stokPengaman: pengaman,
      titikPesan: tambahQty(jumlahPerkiraanHolt(h.level, h.tren, m.lamaKirimHari), pengaman),
      stokTarget: tambahQty(
        jumlahPerkiraanHolt(h.level, h.tren, m.lamaKirimHari + m.jarakBelanjaHari),
        pengaman,
      ),
    }),
    metode: 'TREN',
    catatan:
      arah > 0
        ? `Tren naik ±${teksQty(h.tren)}/hari`
        : arah < 0
          ? `Tren turun ±${teksQty(kaliQty(h.tren, -1))}/hari`
          : 'Tanpa tren',
  };
}

/** RO9: hitung dengan metode pilihan. Barang tidak terjual (kecuali C) dihitung dengan A (TIDAK_LAKU). */
export function hitungSaranMetode(m: MasukanMetode): HasilMetode {
  if (m.metode === 'MIN_MAKS') return minMaks(m);
  const terjual = m.hariAmatan > 0 && bandingQty(m.terjual, 0) > 0;
  if (m.metode === 'RATA' || !terjual) return keA(m);
  return m.metode === 'STATISTIK' ? statistik(m) : tren(m);
}
