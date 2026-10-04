import {
  LABEL_PERAN,
  infoLaporan,
  type DokumenLaporan,
  type Izin,
  type JenisLaporan,
  type SelLaporan,
  type TandaTanganLaporan,
  teksTanggalAngka,
  teksTanggalPanjang,
} from '@sit/shared';

export { persenDari } from '@sit/shared';
import type { PenggunaAktif } from '../../lib/konteks';
import { jamLokal, sekarang, tanggalOperasional } from '../../lib/waktu';

/*
 * Bagian bersama laporan (K-078): kerangka dokumen formal, sel bertipe, dan aturan data sensitif.
 * Perhitungan angka tiap laporan ada di berkas laporannya masing-masing (docs/02: satu berkas per laporan).
 */

/** Kolom nilai/HPP laporan hanya untuk pemegang `laporan.laba` atau `master.barang.lihat_hpp` (docs/04 §5). */
export function bolehLihatNilai(izin: ReadonlySet<Izin>): boolean {
  return izin.has('laporan.laba') || izin.has('master.barang.lihat_hpp');
}

export const SATUAN_RUPIAH = '(Dinyatakan dalam Rupiah penuh)';

/** "Per 3 Oktober 2026 pukul 14:30 WIB" untuk laporan posisi saat ini. */
export function teksPerSaatIni(): string {
  const kini = sekarang();
  return `Per ${teksTanggalPanjang(tanggalOperasional(kini))} pukul ${jamLokal(kini)} WIB`;
}

/** Waktu ISO → `08/01/2026 14:30` (WIB), untuk tampilan. */
export function waktuTeks(iso: string | Date): string {
  const w = typeof iso === 'string' ? new Date(iso) : iso;
  return `${teksTanggalAngka(tanggalOperasional(w))} ${jamLokal(w)}`;
}

/** Kolom tanda tangan: pembuat laporan, lalu pemilik yang mengetahui (bila pembuatnya bukan pemilik). */
function tandaTangan(pelaku: PenggunaAktif): TandaTanganLaporan[] {
  const dibuat = {
    label: 'Dibuat oleh',
    jabatan: pelaku.peran === 'OWNER' ? 'Pemilik' : LABEL_PERAN[pelaku.peran],
    nama: pelaku.namaPengguna,
  };
  if (pelaku.peran === 'OWNER') return [dibuat];
  return [dibuat, { label: 'Mengetahui', jabatan: 'Pemilik', nama: null }];
}

type IsiDokumen = Pick<DokumenLaporan, 'subjudul' | 'orientasi' | 'bagian' | 'catatan'> & {
  /** Bagian nama berkas setelah kode laporan, mis. periode. */
  berkas: string;
};

export function susunDokumen(
  kode: JenisLaporan,
  pelaku: PenggunaAktif,
  isi: IsiDokumen,
): DokumenLaporan {
  const { berkas, ...lain } = isi;
  return {
    kode,
    judul: infoLaporan(kode).judul,
    ...lain,
    tandaTangan: tandaTangan(pelaku),
    disusunPada: sekarang().toISOString(),
    disusunOleh: pelaku.namaPengguna,
    namaBerkas: `laporan-${kode}-${berkas}`.replace(/[^a-z0-9_-]+/gi, '-'),
  };
}

// --- Sel ---

export const KOSONG: SelLaporan = { j: 'kosong' };

export function teks(
  v: string,
  opsi: { tebal?: boolean; mono?: boolean; nada?: 'baik' | 'peringatan' | 'bahaya' | 'info' } = {},
): SelLaporan {
  return { j: 'teks', v, ...opsi };
}
export const uang = (v: number): SelLaporan => ({ j: 'uang', v });
export const qty = (v: string): SelLaporan => ({ j: 'qty', v });
export const angka = (v: number): SelLaporan => ({ j: 'angka', v });
export const persen = (v: number | null): SelLaporan => ({ j: 'persen', v });
export const tanggal = (v: string): SelLaporan => ({ j: 'tanggal', v });
