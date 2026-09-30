import {
  KEPEMILIKAN,
  skemaBarang,
  type BarisImportBarang,
  type HasilImportBarang,
  type InputBarang,
  type Kepemilikan,
} from '@sit/shared';
import type ExcelJS from 'exceljs';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import { isiSel, keBytes, muatXlsx } from '../../../lib/excel';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { catatLog } from '../../sistem/log-aktivitas';
import {
  buatBarang,
  catatLogBarangBaru,
  pastikanBolehTambahBarang,
  type BarangBaru,
} from '../barang/service';
import { BARIS_MAKS, buatTemplat, NAMA_LEMBAR, PETUNJUK_NAMA } from './kolom';
import { kodeAda, referensiImport, type ReferensiImport } from './repo';

/*
 * Import Excel barang (docs/07 Fase 3, K-056): hanya menambah barang baru; kode yang sudah ada dilewati.
 * Pratinjau menjalankan proses yang SAMA dengan simpan di dalam transaksi yang lalu dibatalkan, sehingga
 * hasil pratinjau selalu sama dengan hasil simpan. Setiap baris dijalankan dalam savepoint.
 */

export async function templatImport(): Promise<Uint8Array<ArrayBuffer>> {
  return keBytes(buatTemplat(await referensiImport(db)));
}

type Sel = { teks: string; angka: number | null };
type BarisMentah = { nomorBaris: number; sel: (kunci: string) => Sel };

/** Pembatalan sengaja (pratinjau / ada galat): membawa hasil keluar dari transaksi yang di-rollback. */
class BatalkanImport extends Error {
  constructor(public readonly hasil: HasilImportBarang) {
    super('import dibatalkan');
  }
}

function bacaLembar(wb: ExcelJS.Workbook): BarisMentah[] {
  const ws = wb.getWorksheet(NAMA_LEMBAR) ?? wb.worksheets[0];
  if (!ws) throw new AppError('VALIDASI', 'Berkas tidak berisi lembar data.', 400);

  const indeks = new Map<string, number>();
  ws.getRow(1).eachCell((cell, kolom) => {
    const kunci = isiSel(cell.value).teks.toLowerCase();
    if (kunci) indeks.set(kunci, kolom);
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

  const hasil: BarisMentah[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const sel = (kunci: string): Sel => {
      const kolom = indeks.get(kunci.toLowerCase());
      return kolom === undefined ? { teks: '', angka: null } : isiSel(row.getCell(kolom).value);
    };
    if (r === 2 && sel('nama_barang').teks === PETUNJUK_NAMA) continue; // baris petunjuk templat
    const kosong = [...indeks.keys()].every((k) => sel(k).teks === '');
    if (kosong) continue;
    hasil.push({ nomorBaris: r, sel });
  }
  if (hasil.length === 0) throw new AppError('VALIDASI', 'Berkas tidak berisi data barang.', 400);
  if (hasil.length > BARIS_MAKS) {
    throw new AppError('VALIDASI', `Maksimal ${BARIS_MAKS} baris per berkas.`, 400);
  }
  return hasil;
}

function cari<T>(daftar: T[], cocok: (x: T) => boolean): T | undefined {
  return daftar.find(cocok);
}

function rupiah(s: Sel, label: string, pesan: string[]): number | null {
  if (s.teks === '') return null;
  if (s.angka !== null) {
    if (Number.isSafeInteger(s.angka) && s.angka >= 0) return s.angka;
    pesan.push(`${label} harus rupiah bulat ≥ 0.`);
    return null;
  }
  const bersih = s.teks.replace(/^rp\.?/i, '').replace(/[\s.]/g, '');
  if (/^\d{1,15}$/.test(bersih)) return Number(bersih);
  pesan.push(`${label} harus rupiah bulat ≥ 0 (mis. 41234).`);
  return null;
}

/** Isi sel → input form barang (id dicari dari nama/kode). Galat pencocokan masuk `pesan`. */
function petakan(
  b: BarisMentah,
  ref: ReferensiImport,
): { input: InputBarang; pesan: string[]; kolomDiperiksa: Set<string> } {
  const pesan: string[] = [];
  // Kolom yang galatnya sudah dijelaskan di sini; pesan umum Zod untuk kolom itu tidak ditampilkan lagi.
  const kolomDiperiksa = new Set<string>();
  const t = (k: string) => b.sel(k).teks;

  const namaKategori = t('kategori');
  const kategori = cari(ref.kategori, (k) => k.nama.toLowerCase() === namaKategori.toLowerCase());
  if (namaKategori && !kategori) {
    pesan.push(`Kategori "${namaKategori}" tidak ditemukan.`);
    kolomDiperiksa.add('idKategori');
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

  const atribut: NonNullable<InputBarang['atribut']> = [];
  for (const j of ref.jenisAtribut.filter((x) => x.statusAktif === 'AKTIF')) {
    const s = b.sel(`atribut_${j.kode}`);
    if (s.teks === '') continue;
    if (j.tipeNilai === 'TEKS' || !j.jenisDimensi) {
      atribut.push({ idJenisAtribut: j.id, nilai: s.teks });
      continue;
    }
    const cocok = /^(\d+(?:[.,]\d+)?)\s*(\S+)?$/.exec(s.teks);
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

  const hargaTier = ref.tier
    .filter((x) => x.statusAktif === 'AKTIF')
    .map((x) => ({
      idTingkatHarga: x.id,
      hargaTetap: rupiah(b.sel(`harga_${x.kode}`), `Harga ${x.nama}`, pesan),
    }));
  const tierDefault = ref.tier.find((x) => x.isDefault && x.statusAktif === 'AKTIF');
  if (tierDefault && b.sel(`harga_${tierDefault.kode}`).teks === '') {
    pesan.push(`Harga ${tierDefault.nama} (tier default) wajib diisi.`);
  }

  const stok = b.sel('stok_minimum');
  const input: InputBarang = {
    kode: t('kode'),
    barcode: t('barcode'),
    namaBarang: t('nama_barang'),
    idKategori: kategori?.id ?? 0,
    merk: t('merk'),
    idSatuanDasar: satuan?.id ?? 0,
    stokMinimum: stok.angka !== null ? String(stok.angka) : stok.teks,
    hargaModalAwal: rupiah(b.sel('harga_modal_awal'), 'Harga modal awal', pesan) ?? 0,
    kepemilikan: kepemilikan ?? 'MILIK_SENDIRI',
    idPemasokKonsinyasi: idPemasok,
    hargaTitip: rupiah(b.sel('harga_titip'), 'Harga titip', pesan),
    keterangan: t('keterangan'),
    atribut,
    hargaTier,
  };
  return { input, pesan, kolomDiperiksa };
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

/**
 * Pratinjau (`simpan = false`) atau simpan import. Simpan hanya terjadi bila tidak ada baris bergalat;
 * semua barang baru disimpan dalam satu transaksi (semua atau tidak sama sekali).
 */
export async function prosesImportBarang(
  isi: Uint8Array,
  namaBerkas: string,
  simpan: boolean,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilImportBarang> {
  pastikanBolehTambahBarang(pelaku);
  const mentah = bacaLembar(await muatXlsx(isi));

  try {
    return await dalamTransaksi(async (tx) => {
      const ref = await referensiImport(tx);
      const kodeBerkas = mentah.map((b) => b.sel('kode').teks.toUpperCase()).filter(Boolean);
      const sudahAda = await kodeAda(tx, kodeBerkas);
      const kodeTerlihat = new Map<string, number>();
      const baris: BarisImportBarang[] = [];
      const baru: BarangBaru[] = [];

      for (const b of mentah) {
        const kode = b.sel('kode').teks.toUpperCase() || null;
        const hasil: BarisImportBarang = {
          nomorBaris: b.nomorBaris,
          kode,
          namaBarang: b.sel('nama_barang').teks,
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
        if (kode) kodeTerlihat.set(kode, b.nomorBaris);

        const { input, pesan, kolomDiperiksa } = petakan(b, ref);
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
          const dibuat = await tx.transaction((sp) => buatBarang(sp, valid.data, pelaku.id));
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
        ringkasan: `Import barang dari ${namaBerkas}: ${baru.length} ditambahkan, ${dilewati.length} dilewati`,
        dataBaru: {
          berkas: namaBerkas,
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
        `Masih ada ${err.hasil.ringkasan.galat} baris bergalat; tidak ada yang disimpan. Perbaiki berkas lalu unggah ulang.`,
        400,
        { hasil: err.hasil },
      );
    }
    return err.hasil;
  }
}
