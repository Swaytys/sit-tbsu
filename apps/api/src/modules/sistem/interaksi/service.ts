import {
  BATAS_EKSPOR_INTERAKSI,
  type BarisInteraksi,
  type DataKirimInteraksi,
  type JenisInteraksi,
  type MetaHalaman,
  type ParamEksporInteraksi,
  type RingkasanInteraksi,
  type SetelanInteraksi,
  type TingkatLogInteraksi,
} from '@sit/shared';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import { headerUnduhan, keBytes, workbookBaru } from '../../../lib/excel';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { waktuTeks } from '../../laporan/umum';
import { ambilTeks, invalidasiKonfigurasi } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import * as pengaturanRepo from '../pengaturan/repo';
import * as repo from './repo';

/*
 * K-190: log interaksi untuk penelitian. Dinyalakan Owner; selama mati, kiriman dari peramban diabaikan. Peramban
 * hanya mengirim nama elemen dan angka; server tetap menyamarkan deret angka panjang (No. HP, nomor rekening,
 * nominal) dan nomor id di alamat halaman, sebagai pengaman kedua.
 */

const KODE_AKTIF = 'log_interaksi_aktif';
const KODE_TINGKAT = 'log_interaksi_tingkat';

export async function bacaSetelan(): Promise<SetelanInteraksi> {
  const aktif = (await ambilTeks(KODE_AKTIF, 'false')) === 'true';
  const tingkat: TingkatLogInteraksi =
    (await ambilTeks(KODE_TINGKAT, 'SEMUA')) === 'BERMAKNA' ? 'BERMAKNA' : 'SEMUA';
  return { aktif, tingkat };
}

export async function ringkasanInteraksi(): Promise<RingkasanInteraksi> {
  const r = await repo.ringkasan(db);
  return {
    ...(await bacaSetelan()),
    jumlah: r.jumlah,
    jumlahPengguna: r.jumlahPengguna,
    pertama: r.pertama?.toISOString() ?? null,
    terakhir: r.terakhir?.toISOString() ?? null,
  };
}

export async function ubahSetelan(
  input: SetelanInteraksi,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<RingkasanInteraksi> {
  const lama = await bacaSetelan();
  if (lama.aktif === input.aktif && lama.tingkat === input.tingkat) return ringkasanInteraksi();
  const waktu = sekarang();
  try {
    await dalamTransaksi(async (tx) => {
      await pengaturanRepo.simpanKonfigurasi(
        tx,
        { kode: KODE_AKTIF, nilai: String(input.aktif), tipe: 'BOOL' },
        waktu,
      );
      await pengaturanRepo.simpanKonfigurasi(
        tx,
        { kode: KODE_TINGKAT, nilai: input.tingkat, tipe: 'TEKS' },
        waktu,
      );
      await catatLog(tx, {
        aksi: 'PENGATURAN_UBAH',
        idPengguna: pelaku.id,
        entitas: 'konfigurasi',
        ringkasan:
          `Log interaksi penelitian ${input.aktif ? 'dinyalakan' : 'dimatikan'}` +
          ` (rincian: ${input.tingkat === 'SEMUA' ? 'semua elemen' : 'aksi bermakna'})`,
        dataLama: { [KODE_AKTIF]: lama.aktif, [KODE_TINGKAT]: lama.tingkat },
        dataBaru: { [KODE_AKTIF]: input.aktif, [KODE_TINGKAT]: input.tingkat },
        ip: asal.ip,
      });
    });
  } finally {
    invalidasiKonfigurasi();
  }
  return ringkasanInteraksi();
}

/** Deret 7 angka atau lebih (No. HP, rekening, nominal tanpa titik) disamarkan. */
function samarkan(teks: string | null): string | null {
  if (teks === null) return null;
  const bersih = teks
    .replace(/\s+/g, ' ')
    .replace(/\d[\d.,]{6,}\d/g, '#')
    .trim();
  return bersih.length > 0 ? bersih : null;
}

/** Alamat halaman tanpa query/hash; segmen angka (id data) menjadi `:id`. */
function rapikanHalaman(halaman: string): string {
  const jalur = halaman.split(/[?#]/)[0] ?? '/';
  return jalur.replace(/\/\d+(?=\/|$)/g, '/:id').slice(0, 120) || '/';
}

const MUNDUR_MAKS_MS = 2 * 24 * 3600_000;
const MAJU_MAKS_MS = 5 * 60_000;

/** Kiriman berkelompok dari peramban. Mengembalikan jumlah kejadian yang disimpan (0 bila log dimatikan). */
export async function terimaInteraksi(
  input: DataKirimInteraksi,
  pelaku: PenggunaAktif,
): Promise<number> {
  if (!(await bacaSetelan()).aktif) return 0;
  const kini = sekarang();
  const baris = input.kejadian.map((k) => {
    const w = new Date(k.waktu);
    const selisih = w.getTime() - kini.getTime();
    return {
      idPengguna: pelaku.id,
      idSesiKlien: input.idSesiKlien,
      waktu: selisih < -MUNDUR_MAKS_MS || selisih > MAJU_MAKS_MS ? kini : w,
      jenis: k.jenis,
      halaman: rapikanHalaman(k.halaman),
      elemen: samarkan(k.elemen)?.slice(0, 150) ?? null,
      keterangan: samarkan(k.keterangan)?.slice(0, 255) ?? null,
      angka: k.angka,
    };
  });
  await repo.tambah(db, baris);
  return baris.length;
}

function keRespons(b: Awaited<ReturnType<typeof repo.daftar>>['baris'][number]): BarisInteraksi {
  return { ...b, waktu: b.waktu.toISOString(), jenis: b.jenis as JenisInteraksi };
}

export async function daftarInteraksi(
  p: repo.SaringInteraksi & { halaman: number; perHalaman: number },
): Promise<{ data: BarisInteraksi[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: baris.map(keRespons), meta: metaHalaman(total, p) };
}

const KOLOM = [
  { header: 'Waktu (WIB)', key: 'waktu', width: 19 },
  { header: 'ID pengguna', key: 'idPengguna', width: 11 },
  { header: 'Pengguna', key: 'pengguna', width: 22 },
  { header: 'Peran', key: 'peran', width: 15 },
  { header: 'Sesi', key: 'sesi', width: 14 },
  { header: 'Jenis', key: 'jenis', width: 10 },
  { header: 'Halaman', key: 'halaman', width: 26 },
  { header: 'Elemen', key: 'elemen', width: 36 },
  { header: 'Keterangan', key: 'keterangan', width: 36 },
  { header: 'Angka', key: 'angka', width: 10 },
] as const;

function selCsv(nilai: string | number | null): string {
  const t = nilai === null ? '' : String(nilai);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Ekspor Excel/CSV (Owner) untuk diolah: satu baris per kejadian, terbaru dulu. Ekspor dicatat di log audit. */
export async function eksporInteraksi(
  p: ParamEksporInteraksi,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<{ isi: Uint8Array<ArrayBuffer>; header: Record<string, string> }> {
  const { format, ...saring } = p;
  const { baris, total } = await repo.daftar(db, {
    ...saring,
    limit: BATAS_EKSPOR_INTERAKSI,
    offset: 0,
  });
  if (total > BATAS_EKSPOR_INTERAKSI) {
    throw new AppError(
      'VALIDASI',
      `Log interaksi terlalu banyak (${total} baris; paling banyak ${BATAS_EKSPOR_INTERAKSI}). Persempit rentang tanggal.`,
      400,
    );
  }
  const data = baris.map((b) => ({
    waktu: waktuTeks(b.waktu),
    idPengguna: b.idPengguna,
    pengguna: b.namaPengguna,
    peran: b.peran,
    sesi: b.idSesiKlien,
    jenis: b.jenis,
    halaman: b.halaman,
    elemen: b.elemen,
    keterangan: b.keterangan,
    angka: b.angka,
  }));
  const nama = `log-interaksi${saring.dari ? `-${saring.dari}` : ''}${saring.sampai ? `-sd-${saring.sampai}` : ''}`;
  let isi: Uint8Array<ArrayBuffer>;
  let header: Record<string, string>;
  if (format === 'CSV') {
    const teks = [
      KOLOM.map((k) => k.header).join(','),
      ...data.map((d) => KOLOM.map((k) => selCsv(d[k.key])).join(',')),
    ].join('\r\n');
    // BOM agar Excel membaca huruf non-ASCII dengan benar.
    isi = new TextEncoder().encode(`${String.fromCharCode(0xfeff)}${teks}\r\n`);
    header = {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nama}.csv"`,
      'Cache-Control': 'no-store',
    };
  } else {
    const wb = workbookBaru();
    const ws = wb.addWorksheet('Log Interaksi', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = KOLOM.map((k) => ({ ...k }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    for (const d of data) ws.addRow(d);
    ws.autoFilter = { from: 'A1', to: 'J1' };
    isi = await keBytes(wb);
    header = headerUnduhan(`${nama}.xlsx`);
  }
  await catatLog(db, {
    aksi: 'LAPORAN_EKSPOR',
    idPengguna: pelaku.id,
    entitas: 'log_interaksi',
    ringkasan: `Ekspor ${format} log interaksi (${data.length} baris)`,
    dataBaru: { format, parameter: saring },
    ip: asal.ip,
  });
  return { isi, header };
}
