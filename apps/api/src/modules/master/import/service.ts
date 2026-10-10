import {
  KEPEMILIKAN,
  skemaBarang,
  type BacaImportBarang,
  type BarisImportBarang,
  type BarisImportMentah,
  type HasilImportBarang,
  type InputBarang,
  type InputProsesImport,
  type Izin,
  type Kepemilikan,
} from '@sit/shared';
import type ExcelJS from 'exceljs';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import { isiSel, keBytes, muatXlsx } from '../../../lib/excel';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { ubahBarang } from '../barang/repo';
import {
  buatBarang,
  catatLogBarangBaru,
  pastikanBolehTambahBarang,
  type BarangBaru,
} from '../barang/service';
import {
  BARIS_MAKS,
  buatBerkasBarang,
  kolomImport,
  NAMA_LEMBAR,
  PETUNJUK_NAMA,
  type JenisTemplat,
} from './kolom';
import { dataEksporBarang, kodeAda, referensiImport, type ReferensiImport } from './repo';

/*
 * Import Excel barang (K-056, K-061, K-064): hanya menambah barang baru; kode yang sudah ada dilewati.
 * Alur: berkas dibaca menjadi baris teks (baca) → pratinjau → (sunting baris bergalat di layar) → simpan.
 * Pratinjau menjalankan proses yang SAMA dengan simpan di dalam transaksi yang lalu dibatalkan; tiap baris
 * dalam savepoint. Simpan: semua baris sekaligus, semua atau tidak sama sekali.
 */

export async function templatImport(jenis: JenisTemplat): Promise<Uint8Array<ArrayBuffer>> {
  return keBytes(buatBerkasBarang(await referensiImport(db), { jenis }));
}

// --- Ekspor data barang (format sama dengan templat, bisa diimpor ulang) ---

function rapikanAngka(nilai: string): string {
  const ringkas = nilai.includes('.') ? nilai.replace(/0+$/, '').replace(/\.$/, '') : nilai;
  return ringkas.replace('.', ',');
}

export async function eksporBarang(
  izin: ReadonlySet<Izin>,
): Promise<{ isi: Uint8Array<ArrayBuffer>; namaBerkas: string }> {
  // Berisi harga modal dan harga titip (data sensitif, CLAUDE.md aturan 6).
  if (!izin.has('master.barang.lihat_hpp')) {
    throw new AppError('TIDAK_BERIZIN', 'Ekspor barang membutuhkan izin melihat harga modal.', 403);
  }
  const ref = await referensiImport(db);
  const { barang, harga, atribut } = await dataEksporBarang(db);
  const hargaPer = new Map<number, Record<string, number>>();
  for (const h of harga) {
    const r = hargaPer.get(h.idBarang) ?? {};
    r[`harga_${h.kodeTier.toLowerCase()}`] = h.hargaTetap;
    hargaPer.set(h.idBarang, r);
  }
  const atributPer = new Map<number, Record<string, string>>();
  for (const a of atribut) {
    const r = atributPer.get(a.idBarang) ?? {};
    r[`atribut_${a.kodeJenis.toLowerCase()}`] =
      a.nilaiAngka === null
        ? (a.nilaiTeks ?? '')
        : `${rapikanAngka(a.nilaiAngka)}${a.kodeSatuan ? ` ${a.kodeSatuan}` : ''}`;
    atributPer.set(a.idBarang, r);
  }
  const data = barang.map((b) => ({
    kode: b.kode,
    nama_barang: b.namaBarang,
    kategori: b.kategori,
    merk: b.merk,
    satuan_dasar: b.satuan,
    barcode: b.barcode,
    stok_minimum: rapikanAngka(b.stokMinimum),
    harga_modal_awal: b.kepemilikan === 'KONSINYASI' ? null : b.hargaModalAwal,
    kepemilikan: b.kepemilikan,
    kode_pemasok: b.kodePemasok,
    harga_titip: b.hargaTitip,
    keterangan: b.keterangan,
    status: b.statusAktif,
    ...hargaPer.get(b.id),
    ...atributPer.get(b.id),
  }));
  return {
    isi: await keBytes(buatBerkasBarang(ref, { jenis: 'lengkap', data })),
    namaBerkas: `data-barang-${tanggalOperasional()}.xlsx`,
  };
}

// --- Baca berkas → baris teks ---

/** Teks sel untuk import: bilangan bulat apa adanya, pecahan memakai koma (agar tidak dikira ribuan). */
function teksSel(nilai: ExcelJS.CellValue): string {
  const { teks, angka } = isiSel(nilai);
  if (angka === null) return teks;
  return Number.isInteger(angka) ? String(angka) : String(angka).replace('.', ',');
}

export async function bacaBerkasImport(
  isi: Uint8Array,
  namaBerkas: string,
  pelaku: PenggunaAktif,
): Promise<BacaImportBarang> {
  pastikanBolehTambahBarang(pelaku);
  const wb = await muatXlsx(isi);
  const ws = wb.getWorksheet(NAMA_LEMBAR) ?? wb.worksheets[0];
  if (!ws) throw new AppError('VALIDASI', 'Berkas tidak berisi lembar data.', 400);

  const ref = await referensiImport(db);
  const dikenal = new Map(kolomImport(ref).map((k) => [k.kunci, k]));
  // K-098: harga tier selain tier dasar tidak diisi per barang (templat lama masih punya kolomnya).
  const tierLain = new Map(
    ref.tier.filter((t) => !t.isDefault).map((t) => [`harga_${t.kode.toLowerCase()}`, t.nama]),
  );
  const indeks = new Map<string, number>();
  const peringatan: string[] = [];
  ws.getRow(1).eachCell((cell, kolom) => {
    const kunci = isiSel(cell.value).teks.toLowerCase();
    if (!kunci) return;
    if (dikenal.has(kunci)) indeks.set(kunci, kolom);
    else if (tierLain.has(kunci)) {
      peringatan.push(
        `Kolom "${kunci}" diabaikan: harga ${tierLain.get(kunci)} dihitung otomatis dari markup tier ` +
          'untuk semua barang.',
      );
    } else {
      peringatan.push(
        `Kolom "${kunci}" tidak dikenal (tier/atribut tidak ada atau nonaktif); isinya diabaikan.`,
      );
    }
  });
  for (const wajib of ['nama_barang', 'kategori', 'satuan_dasar']) {
    if (!indeks.has(wajib)) {
      throw new AppError(
        'VALIDASI',
        `Kolom ${wajib} tidak ditemukan di baris 1. Gunakan templat dari aplikasi.`,
        400,
      );
    }
  }

  const baris: BarisImportMentah[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nilai: Record<string, string> = {};
    for (const [kunci, kolom] of indeks) {
      const teks = teksSel(row.getCell(kolom).value).slice(0, 255);
      if (teks !== '') nilai[kunci] = teks;
    }
    if (r === 2 && nilai.nama_barang === PETUNJUK_NAMA) continue; // baris petunjuk templat
    if (Object.keys(nilai).length === 0) continue;
    baris.push({ nomorBaris: r, nilai });
  }
  if (baris.length === 0) throw new AppError('VALIDASI', 'Berkas tidak berisi data barang.', 400);
  if (baris.length > BARIS_MAKS) {
    throw new AppError('VALIDASI', `Maksimal ${BARIS_MAKS} baris per berkas.`, 400);
  }
  const kolom = [...dikenal.values()]
    // Kolom wajib ikut ditampilkan walau tidak ada di berkas, agar bisa diisi saat menyunting baris.
    .filter((k) => indeks.has(k.kunci) || k.wajib)
    .map(({ kunci, label, jenis, wajib, petunjuk }) => ({ kunci, label, jenis, wajib, petunjuk }));
  return { namaBerkas: namaBerkas.slice(0, 100), kolom, baris, peringatan };
}

// --- Pratinjau dan simpan ---

function cari<T>(daftar: T[], cocok: (x: T) => boolean): T | undefined {
  return daftar.find(cocok);
}

/** Rupiah dari teks: "41234", "41.234", "Rp 41.234" → 41234; pecahan ("1000,5") ditolak. */
function rupiah(teks: string, label: string, pesan: string[]): number | null {
  if (teks === '') return null;
  const bersih = teks.replace(/^rp\.?/i, '').replace(/[\s.]/g, '');
  if (/^\d{1,15}$/.test(bersih)) return Number(bersih);
  pesan.push(`${label} harus rupiah bulat ≥ 0 (mis. 41234).`);
  return null;
}

type Petaan = {
  input: InputBarang;
  nonaktif: boolean;
  pesan: string[];
  kolomDiperiksa: Set<string>;
};

/** Teks baris → input form barang (id dicari dari nama/kode). Galat pencocokan masuk `pesan`. */
function petakan(b: BarisImportMentah, ref: ReferensiImport): Petaan {
  const pesan: string[] = [];
  // Kolom yang galatnya sudah dijelaskan di sini; pesan umum Zod untuk kolom itu tidak ditampilkan lagi.
  const kolomDiperiksa = new Set<string>();
  const t = (k: string) => (b.nilai[k] ?? '').trim();

  const namaKategori = t('kategori');
  const kategori = cari(ref.kategori, (k) => k.nama.toLowerCase() === namaKategori.toLowerCase());
  if (namaKategori && !kategori) {
    pesan.push(`Kategori "${namaKategori}" tidak ditemukan.`);
    kolomDiperiksa.add('idKategori');
  }

  const namaMerk = t('merk');
  const merk = namaMerk
    ? cari(ref.merk, (m) => m.nama.toLowerCase() === namaMerk.toLowerCase())
    : undefined;
  if (namaMerk && !merk) {
    pesan.push(`Merk "${namaMerk}" tidak ditemukan; tambahkan dulu di Referensi Barang.`);
    kolomDiperiksa.add('idMerk');
  }

  const cariSatuan = (kode: string) =>
    cari(ref.satuan, (s) => s.kode === kode) ??
    cari(ref.satuan, (s) => s.kode.toLowerCase() === kode.toLowerCase());
  const kodeSatuan = t('satuan_dasar');
  const satuan = kodeSatuan ? cariSatuan(kodeSatuan) : undefined;
  if (kodeSatuan && !satuan) {
    pesan.push(`Satuan "${kodeSatuan}" tidak ditemukan.`);
    kolomDiperiksa.add('idSatuanDasar');
  }

  const teksKepemilikan = t('kepemilikan').toUpperCase().replace(/\s+/g, '_') || 'MILIK_SENDIRI';
  const kepemilikan = (KEPEMILIKAN as readonly string[]).includes(teksKepemilikan)
    ? (teksKepemilikan as Kepemilikan)
    : undefined;
  if (!kepemilikan) pesan.push('Kepemilikan harus MILIK_SENDIRI atau KONSINYASI.');

  let idPemasok: number | null = null;
  const kodePemasok = t('kode_pemasok').toUpperCase();
  if (kepemilikan === 'KONSINYASI' && kodePemasok) {
    const p = cari(ref.pemasok, (x) => x.kode === kodePemasok);
    if (p) idPemasok = p.id;
    else {
      pesan.push(`Pemasok "${kodePemasok}" tidak ditemukan.`);
      kolomDiperiksa.add('idPemasokKonsinyasi');
    }
  }

  const status = t('status').toUpperCase();
  if (status !== '' && status !== 'AKTIF' && status !== 'NONAKTIF') {
    pesan.push('Status harus AKTIF atau NONAKTIF.');
  }

  const atribut: NonNullable<InputBarang['atribut']> = [];
  for (const j of ref.jenisAtribut.filter((x) => x.statusAktif === 'AKTIF')) {
    const teks = t(`atribut_${j.kode.toLowerCase()}`);
    if (teks === '') continue;
    if (j.tipeNilai === 'TEKS' || !j.jenisDimensi) {
      atribut.push({ idJenisAtribut: j.id, nilai: teks });
      continue;
    }
    const cocok = /^(\d+(?:[.,]\d+)?)\s*(\S+)?$/.exec(teks);
    if (!cocok?.[2]) {
      pesan.push(`Atribut ${j.nama}: tulis angka dan satuan, mis. "6 m".`);
      continue;
    }
    const sat = cariSatuan(cocok[2]);
    if (!sat) {
      pesan.push(`Atribut ${j.nama}: satuan "${cocok[2]}" tidak dikenal.`);
      continue;
    }
    atribut.push({ idJenisAtribut: j.id, nilai: cocok[1] ?? '', idSatuan: sat.id });
  }

  // K-098: hanya harga tier dasar yang diisi per barang; tier lain dilengkapi service dari markup tier.
  const tierDasar = ref.tier.filter((x) => x.statusAktif === 'AKTIF' && x.isDefault);
  const hargaTier = tierDasar.map((x) => ({
    idTingkatHarga: x.id,
    hargaTetap: rupiah(t(`harga_${x.kode.toLowerCase()}`), `Harga ${x.nama}`, pesan),
  }));
  const input: InputBarang = {
    kode: t('kode'),
    barcode: t('barcode'),
    namaBarang: t('nama_barang'),
    idKategori: kategori?.id ?? 0,
    idMerk: merk?.id ?? null,
    idSatuanDasar: satuan?.id ?? 0,
    stokMinimum: t('stok_minimum'),
    hargaModalAwal: rupiah(t('harga_modal_awal'), 'Harga modal awal', pesan) ?? 0,
    kepemilikan: kepemilikan ?? 'MILIK_SENDIRI',
    idPemasokKonsinyasi: idPemasok,
    hargaTitip: rupiah(t('harga_titip'), 'Harga titip', pesan),
    keterangan: t('keterangan'),
    atribut,
    hargaTier,
  };
  return { input, nonaktif: status === 'NONAKTIF', pesan, kolomDiperiksa };
}

function ringkas(baris: BarisImportBarang[], disimpan: boolean): HasilImportBarang {
  const hitung = (s: BarisImportBarang['status']) => baris.filter((b) => b.status === s).length;
  return {
    baris,
    ringkasan: {
      total: baris.length,
      siap: hitung('SIAP'),
      dilewati: hitung('DILEWATI'),
      galat: hitung('GALAT'),
      disimpan: hitung('DISIMPAN'),
    },
    disimpan,
  };
}

/** Pembatalan sengaja (pratinjau / ada galat): membawa hasil keluar dari transaksi yang di-rollback. */
class BatalkanImport extends Error {
  constructor(public readonly hasil: HasilImportBarang) {
    super('import dibatalkan');
  }
}

/**
 * Pratinjau (`simpan = false`) atau simpan import dari baris teks. Simpan hanya terjadi bila tidak ada baris
 * bergalat; semua barang baru disimpan dalam satu transaksi (semua atau tidak sama sekali).
 */
export async function prosesImportBarang(
  data: Required<Pick<InputProsesImport, 'baris'>> & { namaBerkas: string; kodeLain: string[] },
  simpan: boolean,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilImportBarang> {
  pastikanBolehTambahBarang(pelaku);
  const kodeLain = new Set(data.kodeLain.map((k) => k.trim().toUpperCase()));

  try {
    return await dalamTransaksi(async (tx) => {
      const ref = await referensiImport(tx);
      const kodeBaris = (b: BarisImportMentah) => (b.nilai.kode ?? '').trim().toUpperCase();
      const sudahAda = await kodeAda(tx, data.baris.map(kodeBaris).filter(Boolean));
      const kodeTerlihat = new Map<string, number>();
      const baris: BarisImportBarang[] = [];
      const baru: BarangBaru[] = [];

      for (const b of data.baris) {
        const kode = kodeBaris(b) || null;
        const hasil: BarisImportBarang = {
          nomorBaris: b.nomorBaris,
          kode,
          namaBarang: (b.nilai.nama_barang ?? '').trim(),
          status: 'GALAT',
          pesan: [],
        };
        baris.push(hasil);
        if (kode && sudahAda.has(kode)) {
          hasil.status = 'DILEWATI';
          hasil.pesan.push('Kode sudah ada; dilewati (import hanya menambah barang baru).');
          continue;
        }
        if (kode && kodeTerlihat.has(kode)) {
          hasil.pesan.push(`Kode sama dengan baris ${kodeTerlihat.get(kode)}.`);
          continue;
        }
        if (kode && kodeLain.has(kode)) {
          hasil.pesan.push('Kode sama dengan baris lain di berkas.');
          continue;
        }
        if (kode) kodeTerlihat.set(kode, b.nomorBaris);

        const { input, nonaktif, pesan, kolomDiperiksa } = petakan(b, ref);
        const valid = skemaBarang.safeParse(input);
        if (!valid.success) {
          for (const i of valid.error.issues) {
            if (!kolomDiperiksa.has(String(i.path[0]))) pesan.push(i.message);
          }
        }
        if (pesan.length > 0 || !valid.success) {
          hasil.pesan = [...new Set(pesan)];
          continue;
        }
        try {
          const dibuat = await tx.transaction(async (sp) => {
            const hasilBuat = await buatBarang(sp, valid.data, pelaku.id);
            if (nonaktif) {
              await ubahBarang(sp, hasilBuat.id, { statusAktif: 'NONAKTIF' }, sekarang());
            }
            return hasilBuat;
          });
          baru.push(dibuat);
          hasil.status = 'SIAP';
          if (simpan) hasil.kode = dibuat.nilai.kode;
        } catch (err) {
          if (!(err instanceof AppError)) throw err;
          hasil.pesan.push(err.message);
        }
      }

      const galat = baris.filter((x) => x.status === 'GALAT').length;
      if (!simpan || galat > 0) throw new BatalkanImport(ringkas(baris, false));

      for (const b of baru) await catatLogBarangBaru(tx, b, pelaku, asal, ' (import Excel)');
      for (const x of baris) if (x.status === 'SIAP') x.status = 'DISIMPAN';
      const dilewati = baris.filter((x) => x.status === 'DILEWATI');
      await catatLog(tx, {
        aksi: 'IMPORT_BARANG',
        idPengguna: pelaku.id,
        entitas: 'barang',
        ringkasan: `Import barang dari ${data.namaBerkas}: ${baru.length} ditambahkan, ${dilewati.length} dilewati`,
        dataBaru: {
          berkas: data.namaBerkas,
          ditambahkan: baru.map((x) => x.nilai.kode),
          dilewati: dilewati.map((x) => x.kode),
        },
        ip: asal.ip,
      });
      return ringkas(baris, true);
    });
  } catch (err) {
    if (!(err instanceof BatalkanImport)) throw err;
    if (simpan) {
      throw new AppError(
        'VALIDASI',
        `Masih ada ${err.hasil.ringkasan.galat} baris bergalat; tidak ada yang disimpan. Perbaiki baris lalu simpan lagi.`,
        400,
        { hasil: err.hasil },
      );
    }
    return err.hasil;
  }
}
