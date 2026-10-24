/*
 * K-137: No. HP disimpan dalam format internasional `+<kode negara><nomor>` tanpa spasi (mis. `+6281234567890`).
 * Isian dirapikan otomatis: spasi/strip/kurung dibuang, `0` di depan diganti kode negara (bawaan +62), `62…` tanpa
 * `+` diberi `+`. Panjang nomor internasional paling banyak 15 angka (E.164), paling sedikit 8.
 */

export const KODE_NEGARA = [
  { kode: '+62', nama: 'Indonesia' },
  { kode: '+60', nama: 'Malaysia' },
  { kode: '+65', nama: 'Singapura' },
  { kode: '+66', nama: 'Thailand' },
  { kode: '+86', nama: 'Tiongkok' },
  { kode: '+1', nama: 'Amerika/Kanada' },
] as const;

export const KODE_NEGARA_BAWAAN = '+62';
export const NO_HP_MIN_ANGKA = 8;
export const NO_HP_MAKS_ANGKA = 15;

/** Hanya karakter yang dibuang saat merapikan (pemisah yang lazim diketik). */
const PEMISAH = /[\s\-().]/g;

/**
 * Rapikan isian No. HP ke format internasional. `null` bila kosong. Isian yang memuat huruf atau tanda lain
 * dikembalikan apa adanya agar validasi menampilkan pesannya.
 */
export function rapikanNoHp(isian: string, kodeNegara: string = KODE_NEGARA_BAWAAN): string | null {
  const t = isian.replace(PEMISAH, '');
  if (t === '') return null;
  if (!/^\+?\d+$/.test(t)) return isian.trim();
  if (t.startsWith('+')) return t;
  if (t.startsWith('00')) return `+${t.slice(2)}`;
  if (t.startsWith('0')) return `${kodeNegara}${t.replace(/^0+/, '')}`;
  if (kodeNegara === '+62' && t.startsWith('62')) return `+${t}`;
  return `${kodeNegara}${t}`;
}

/** Pesan galat untuk No. HP yang sudah dirapikan; `null` bila sah. */
export function galatNoHp(rapi: string): string | null {
  if (!/^\+\d+$/.test(rapi))
    return 'No. HP hanya boleh angka (boleh diawali kode negara, mis. +62).';
  const angka = rapi.length - 1;
  if (angka < NO_HP_MIN_ANGKA)
    return `No. HP minimal ${NO_HP_MIN_ANGKA} angka termasuk kode negara.`;
  if (angka > NO_HP_MAKS_ANGKA) {
    return `No. HP paling banyak ${NO_HP_MAKS_ANGKA} angka termasuk kode negara (batas nomor internasional).`;
  }
  if (rapi.startsWith('+620'))
    return 'Setelah +62 jangan diawali 0 (mis. +62812…, bukan +620812…).';
  return null;
}

/** Pisahkan kode negara dan nomor (untuk isian dua bagian). Kode tak dikenal → seluruhnya nomor dengan +62. */
export function pecahNoHp(nilai: string | null | undefined): { kode: string; nomor: string } {
  if (!nilai) return { kode: KODE_NEGARA_BAWAAN, nomor: '' };
  const k = [...KODE_NEGARA]
    .sort((a, b) => b.kode.length - a.kode.length)
    .find((x) => nilai.startsWith(x.kode));
  if (k) return { kode: k.kode, nomor: nilai.slice(k.kode.length) };
  return { kode: KODE_NEGARA_BAWAAN, nomor: nilai.replace(/^\+/, '') };
}

/** Tampilan `+62 812-3456-7890`. */
export function formatNoHp(nilai: string | null | undefined): string {
  if (!nilai) return '—';
  const { kode, nomor } = pecahNoHp(nilai);
  const kelompok = nomor.match(/^(\d{3})(\d{4})(\d*)$/);
  return kelompok
    ? `${kode} ${kelompok[1]}-${kelompok[2]}${kelompok[3] ? `-${kelompok[3]}` : ''}`
    : `${kode} ${nomor}`;
}

/** Awalan sebutan yang diabaikan saat mencari nama ganda (pelanggan/pemasok). */
export const POLA_AWALAN_NAMA = String.raw`^(toko|tk|cv|pt|ud|pak|bapak|bpk|bu|ibu|sdr|mas|mbak)\.?\s+`;

/**
 * K-137: kunci pembanding nama untuk mencari data ganda: huruf kecil, tanpa awalan sebutan (opsional), hanya huruf
 * dan angka. "Toko  Sumber-Jaya" = "sumber jaya" = "SUMBERJAYA". Sama persis dengan ekspresi SQL di API.
 */
export function kunciNama(nama: string, buangAwalan = true): string {
  let t = nama.toLowerCase().trim();
  if (buangAwalan) t = t.replace(new RegExp(POLA_AWALAN_NAMA), '');
  return t.replace(/[^a-z0-9]/g, '');
}

/** Data lain yang mirip (nama sama setelah dirapikan atau No. HP sama), ditawarkan sebelum menyimpan. */
export type DataMirip = {
  id: number;
  kode: string;
  nama: string;
  noHp: string | null;
  statusAktif: string;
  alasan: string;
};

/** K-137 butir 3: hasil pemindaian data lama. */
export type HasilPemeriksaanData = {
  /** Kelompok data yang kemungkinan dobel. */
  ganda: { jenis: 'pelanggan' | 'pemasok' | 'barang'; alasan: string; data: DataMirip[] }[];
  /** Data dengan format salah (`alasan` = masalahnya). */
  format: (DataMirip & { jenis: 'pelanggan' | 'pemasok' | 'barang' })[];
};

export type HasilRapikanNoHp = { diubah: number; gagal: string[] };
