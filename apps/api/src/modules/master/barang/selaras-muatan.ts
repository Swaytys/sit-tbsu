import type { DataBarang, DataMuatanBarang } from '@sit/shared';
import { inArray } from 'drizzle-orm';
import type { Tx } from '../../../db/client';
import { jenisAtribut, satuan } from '../../../db/schema';
import { AppError } from '../../../lib/errors';

/*
 * K-169: atribut dimensi (Panjang/Lebar/Tinggi/Berat, dan Volume untuk barang curah) dan data muatan adalah satu
 * data. Mengisi salah satu mengisi yang lain; bila keduanya diisi dan berbeda (setelah dikonversi satuannya), simpan
 * ditolak agar tidak ada dua angka untuk satu ukuran. Volume barang tidak curah (mis. isi cat 5 L) tetap atribut
 * produk biasa, bukan volume muatan.
 */

type Kunci = 'PANJANG' | 'LEBAR' | 'TINGGI' | 'BERAT' | 'VOLUME';
const KUNCI: Kunci[] = ['PANJANG', 'LEBAR', 'TINGGI', 'BERAT', 'VOLUME'];
const KOLOM: Record<Kunci, keyof DataMuatanBarang> = {
  PANJANG: 'panjangCm',
  LEBAR: 'lebarCm',
  TINGGI: 'tinggiCm',
  BERAT: 'beratKg',
  VOLUME: 'volumeM3',
};
/** Satuan simpan data muatan dan faktor dari satuan basis atribut (m, kg, m³). */
const SATUAN_MUATAN: Record<Kunci, { kode: string; dariBasis: number; desimal: number }> = {
  PANJANG: { kode: 'cm', dariBasis: 100, desimal: 1 },
  LEBAR: { kode: 'cm', dariBasis: 100, desimal: 1 },
  TINGGI: { kode: 'cm', dariBasis: 100, desimal: 1 },
  BERAT: { kode: 'kg', dariBasis: 1, desimal: 3 },
  VOLUME: { kode: 'm3', dariBasis: 1, desimal: 4 },
};
const LABEL: Record<Kunci, string> = {
  PANJANG: 'Panjang',
  LEBAR: 'Lebar',
  TINGGI: 'Tinggi',
  BERAT: 'Berat',
  VOLUME: 'Volume',
};

const KOSONG: DataMuatanBarang = {
  beratKg: null,
  panjangCm: null,
  lebarCm: null,
  tinggiCm: null,
  curah: false,
  volumeM3: null,
};

const teks = (n: number, desimal: number) => String(Number(n.toFixed(desimal)));

/** Dua angka dianggap sama bila selisihnya ≤ 0,5% atau ≤ setengah digit terakhir yang disimpan. */
function sama(a: number, b: number, desimal: number): boolean {
  return Math.abs(a - b) <= Math.max(Math.max(a, b) * 0.005, 0.5 / 10 ** desimal);
}

export async function selaraskanMuatan(
  tx: Tx,
  input: Pick<DataBarang, 'atribut' | 'muatan'>,
  muatanLama: DataMuatanBarang | undefined,
): Promise<Pick<DataBarang, 'atribut' | 'muatan'>> {
  const jenis = await tx
    .select({ id: jenisAtribut.id, kode: jenisAtribut.kode })
    .from(jenisAtribut)
    .where(inArray(jenisAtribut.kode, KUNCI));
  const idJenis = new Map(jenis.map((j) => [j.kode as Kunci, j.id]));
  const kunciDariId = new Map(jenis.map((j) => [j.id, j.kode as Kunci]));
  const daftarSatuan = await tx
    .select({ id: satuan.id, kode: satuan.kode, faktor: satuan.faktorKeBasis })
    .from(satuan);
  const faktorSatuan = new Map(daftarSatuan.map((s) => [s.id, Number(s.faktor)]));
  const idSatuanKode = new Map(daftarSatuan.map((s) => [s.kode, s.id]));

  // Nilai atribut dimensi dalam satuan simpan muatan (cm, kg, m³). Atribut tanpa satuan tidak bisa dikonversi.
  const dariAtribut = new Map<Kunci, number>();
  for (const a of input.atribut) {
    const k = kunciDariId.get(a.idJenisAtribut);
    if (!k || a.idSatuan === null || a.idSatuan === undefined) continue;
    const faktor = faktorSatuan.get(a.idSatuan);
    const n = Number(a.nilai.replace(',', '.'));
    if (faktor === undefined || !Number.isFinite(n) || n <= 0) continue;
    dariAtribut.set(k, n * faktor * SATUAN_MUATAN[k].dariBasis);
  }

  const dasar: DataMuatanBarang = input.muatan ?? muatanLama ?? KOSONG;
  const relevan = (k: Kunci) => (k === 'VOLUME' ? dasar.curah : k === 'BERAT' || !dasar.curah);

  // Keduanya terisi dan berbeda: tolak.
  for (const k of KUNCI) {
    const a = dariAtribut.get(k);
    const m = dasar[KOLOM[k]];
    if (a === undefined || m === null || typeof m === 'boolean' || !relevan(k)) continue;
    const { kode, desimal } = SATUAN_MUATAN[k];
    if (!sama(a, Number(m), desimal)) {
      throw new AppError(
        'VALIDASI',
        `${LABEL[k]} di atribut (${teks(a, desimal)} ${kode}) berbeda dengan data muatan ` +
          `(${teks(Number(m), desimal)} ${kode}). Samakan salah satunya; keduanya satu data.`,
        400,
        { kolom: { [`muatan.${KOLOM[k]}`]: ['Berbeda dengan atribut.'] } },
      );
    }
  }

  // Atribut → data muatan (yang masih kosong).
  const muatan: DataMuatanBarang = { ...dasar };
  let terisi = false;
  const isi = (k: Kunci) => {
    const v = dariAtribut.get(k);
    if (v === undefined) return;
    (muatan as Record<string, unknown>)[KOLOM[k]] = teks(v, SATUAN_MUATAN[k].desimal);
    terisi = true;
  };
  if (muatan.beratKg === null) isi('BERAT');
  if (dasar.curah) {
    if (muatan.volumeM3 === null) isi('VOLUME');
  } else if (
    muatan.panjangCm === null &&
    muatan.lebarCm === null &&
    muatan.tinggiCm === null &&
    dariAtribut.has('PANJANG') &&
    dariAtribut.has('LEBAR') &&
    dariAtribut.has('TINGGI')
  ) {
    // Ukuran kemasan hanya dipakai lengkap (P × L × T).
    isi('PANJANG');
    isi('LEBAR');
    isi('TINGGI');
  }

  // Data muatan → atribut (yang belum ada).
  const atribut = [...input.atribut];
  for (const k of KUNCI) {
    const m = muatan[KOLOM[k]];
    const id = idJenis.get(k);
    const idSat = idSatuanKode.get(SATUAN_MUATAN[k].kode);
    if (m === null || typeof m === 'boolean' || !relevan(k) || !id || !idSat) continue;
    if (atribut.some((a) => a.idJenisAtribut === id) || atribut.length >= 30) continue;
    atribut.push({ idJenisAtribut: id, nilai: String(m).replace('.', ','), idSatuan: idSat });
  }

  return {
    atribut,
    muatan: input.muatan !== undefined || terisi ? muatan : undefined,
  };
}
