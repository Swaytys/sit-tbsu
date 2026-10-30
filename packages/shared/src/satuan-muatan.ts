import Decimal from 'decimal.js';

/*
 * K-161: satuan isian data muatan. Disimpan dalam kg, cm, dan m³ (docs/13 §2.1); form boleh memakai satuan lain
 * yang sejenis. Faktor = berapa satuan simpan dalam satu satuan isian.
 */

export const SATUAN_BERAT = { kg: '1', g: '0.001', ton: '1000' } as const;
export const SATUAN_PANJANG = { cm: '1', mm: '0.1', dm: '10', m: '100' } as const;
export const SATUAN_VOLUME = { m3: '1', L: '0.001' } as const;

/**
 * Angka isian (boleh koma) dalam satuan berfaktor `faktor` → teks dalam satuan simpan, tanpa nol berlebih.
 * Isian kosong → `null`; isian bukan angka dikembalikan apa adanya agar validasi skema menampilkan pesannya.
 */
export function keSatuanSimpan(isian: string, faktor: string): string | null {
  const t = isian.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return isian;
  return new Decimal(t).times(faktor).toDecimalPlaces(4).toString();
}

/** Kebalikan `keSatuanSimpan` untuk menampilkan nilai simpan dalam satuan isian. */
export function dariSatuanSimpan(nilai: string | null, faktor: string): string {
  if (nilai === null || nilai === '') return '';
  return new Decimal(nilai).dividedBy(faktor).toDecimalPlaces(4).toString().replace('.', ',');
}

/** Jenis isian data muatan beserta satuan simpan dan banyak angka di belakang koma yang disimpan. */
const ISIAN_MUATAN = {
  BERAT: { satuan: SATUAN_BERAT as Record<string, string>, simpan: 'kg', desimal: 3 },
  PANJANG: { satuan: SATUAN_PANJANG as Record<string, string>, simpan: 'cm', desimal: 1 },
  VOLUME: {
    satuan: { ...SATUAN_VOLUME, 'm³': '1', l: '0.001' } as Record<string, string>,
    simpan: 'm³',
    desimal: 4,
  },
} as const;
export type JenisIsianMuatan = keyof typeof ISIAN_MUATAN;

/**
 * K-161 (isi massal Excel): isian sel seperti "50", "12,5", "50000 g", "700 mm", "500 L" → angka dalam satuan simpan
 * (kg/cm/m³), dibulatkan ke ketelitian kolom simpannya. Tanpa satuan = satuan simpan. Kosong → `null`.
 */
export function bacaIsianMuatan(
  isian: string,
  jenis: JenisIsianMuatan,
): { nilai: string | null; galat: string | null } {
  const t = isian.trim();
  if (t === '') return { nilai: null, galat: null };
  const cfg = ISIAN_MUATAN[jenis];
  const cocok = /^(\d+(?:[.,]\d+)?)\s*([A-Za-z³0-9]*)$/.exec(t);
  const satuan = cocok?.[2] ?? '';
  const faktor =
    satuan === '' ? '1' : (cfg.satuan[satuan] ?? cfg.satuan[satuan.toLowerCase()] ?? null);
  if (!cocok?.[1] || faktor === null) {
    const pilihan = Object.keys(cfg.satuan)
      .filter((k) => k !== 'l')
      .join('/');
    return {
      nilai: null,
      galat: `"${t}" bukan angka ${cfg.simpan}; tulis angka saja atau angka + satuan (${pilihan}).`,
    };
  }
  const nilai = new Decimal(cocok[1].replace(',', '.'))
    .times(faktor)
    .toDecimalPlaces(cfg.desimal)
    .toString();
  return { nilai, galat: null };
}

/**
 * K-169/K-201: atribut dimensi (kode jenis atribut) ↔ kolom data muatan. Atribut memakai satuan basis m, kg, m³
 * (dikali `faktor_ke_basis` satuannya); data muatan disimpan dalam cm, kg, m³.
 */
export const ATRIBUT_MUATAN = {
  PANJANG: 'panjangCm',
  LEBAR: 'lebarCm',
  TINGGI: 'tinggiCm',
  BERAT: 'beratKg',
  VOLUME: 'volumeM3',
} as const;
export type KodeAtributMuatan = keyof typeof ATRIBUT_MUATAN;
export type KolomMuatan = (typeof ATRIBUT_MUATAN)[KodeAtributMuatan];

/** Satuan basis → satuan simpan muatan (m → cm = ×100; kg dan m³ tetap). */
const BASIS_KE_MUATAN: Record<KodeAtributMuatan, string> = {
  PANJANG: '100',
  LEBAR: '100',
  TINGGI: '100',
  BERAT: '1',
  VOLUME: '1',
};
/** Kode satuan referensi yang setara dengan satuan simpan muatan. */
export const SATUAN_SIMPAN_MUATAN: Record<KodeAtributMuatan, string> = {
  PANJANG: 'cm',
  LEBAR: 'cm',
  TINGGI: 'cm',
  BERAT: 'kg',
  VOLUME: 'm3',
};

/** Nilai atribut (teks, boleh koma) dalam satuan berfaktor `faktorKeBasis` → teks satuan simpan muatan. */
export function atributKeMuatan(
  kode: KodeAtributMuatan,
  nilai: string,
  faktorKeBasis: string,
): string | null {
  const t = nilai.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t) || new Decimal(t).lessThanOrEqualTo(0)) return null;
  return new Decimal(t)
    .times(faktorKeBasis)
    .times(BASIS_KE_MUATAN[kode])
    .toDecimalPlaces(4)
    .toString();
}

/** Kebalikan `atributKeMuatan`: nilai muatan → teks atribut (koma desimal) dalam satuan berfaktor `faktorKeBasis`. */
export function muatanKeAtribut(
  kode: KodeAtributMuatan,
  nilaiMuatan: string,
  faktorKeBasis: string,
): string | null {
  const t = nilaiMuatan.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t) || new Decimal(faktorKeBasis).isZero()) return null;
  return new Decimal(t)
    .dividedBy(BASIS_KE_MUATAN[kode])
    .dividedBy(faktorKeBasis)
    .toDecimalPlaces(4)
    .toString()
    .replace('.', ',');
}
