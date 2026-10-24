import {
  bacaIsianMuatan,
  KOLOM_MUATAN_EXCEL,
  skemaMuatanBarang,
  type BacaImportMuatan,
  type BarisImportMentah,
  type BarisImportMuatan,
  type HasilImportMuatan,
  type JenisIsianMuatan,
  type KolomMuatanExcel,
  type MuatanBarang,
} from '@sit/shared';
import type ExcelJS from 'exceljs';
import { db } from '../../../db/client';
import { AppError } from '../../../lib/errors';
import { isiSel, keBytes, muatXlsx, workbookBaru } from '../../../lib/excel';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { rapikanMuatan, simpanMuatan } from '../barang/service';
import { BARIS_MAKS } from './kolom';
import { dataMuatan, muatanPerKode } from './repo';

/*
 * K-161: isi massal data muatan barang lewat Excel. Berkas diunduh berisi barang yang sudah ada (semua, atau yang
 * belum lengkap), diisi, lalu diunggah: baca → pratinjau (tanpa menulis) → simpan (semua atau tidak sama sekali).
 * Hanya mengubah kolom muatan; barang dicocokkan dengan kode. Kolom yang tidak ada di berkas tidak mengubah apa pun;
 * sel kosong di kolom yang ada berarti datanya dikosongkan.
 */

const NAMA_LEMBAR = 'Data muatan';
const PETUNJUK_KODE = 'Jangan diubah';

type Kolom = { kunci: string; petunjuk: string; lebar: number };
const KOLOM: Kolom[] = [
  { kunci: 'kode', petunjuk: PETUNJUK_KODE, lebar: 14 },
  { kunci: 'nama_barang', petunjuk: 'Hanya keterangan', lebar: 36 },
  { kunci: 'satuan_dasar', petunjuk: 'Data untuk 1 satuan ini', lebar: 14 },
  { kunci: 'berat_kg', petunjuk: 'kg, atau mis. "500 g"', lebar: 16 },
  { kunci: 'panjang_cm', petunjuk: 'cm, atau mis. "700 mm"', lebar: 16 },
  { kunci: 'lebar_cm', petunjuk: 'cm, atau mis. "45 cm"', lebar: 16 },
  { kunci: 'tinggi_cm', petunjuk: 'cm, atau mis. "0,12 m"', lebar: 16 },
  { kunci: 'curah', petunjuk: 'YA untuk pasir/batu', lebar: 12 },
  { kunci: 'volume_m3', petunjuk: 'Wajib bila curah; m³ atau "500 L"', lebar: 20 },
];

const JENIS: Record<Exclude<KolomMuatanExcel, 'curah'>, JenisIsianMuatan> = {
  berat_kg: 'BERAT',
  panjang_cm: 'PANJANG',
  lebar_cm: 'PANJANG',
  tinggi_cm: 'PANJANG',
  volume_m3: 'VOLUME',
};

const KE_FIELD: Record<Exclude<KolomMuatanExcel, 'curah'>, Exclude<keyof MuatanBarang, 'curah'>> = {
  berat_kg: 'beratKg',
  panjang_cm: 'panjangCm',
  lebar_cm: 'lebarCm',
  tinggi_cm: 'tinggiCm',
  volume_m3: 'volumeM3',
};

const LABEL: Record<keyof MuatanBarang, [string, string]> = {
  beratKg: ['berat', 'kg'],
  panjangCm: ['panjang', 'cm'],
  lebarCm: ['lebar', 'cm'],
  tinggiCm: ['tinggi', 'cm'],
  curah: ['curah', ''],
  volumeM3: ['volume', 'm³'],
};

const PETUNJUK = [
  'Cara mengisi data muatan barang',
  '',
  '1. Isi lembar "Data muatan" mulai baris 3. Jangan ubah baris 1 (nama kolom) dan kolom kode.',
  '2. Semua angka untuk 1 SATUAN DASAR barang (lihat kolom satuan_dasar), termasuk kemasannya.',
  '   Contoh: semen satuan dasar sak → berat 1 sak = 50 kg, ukuran 1 sak = 70 × 45 × 12 cm.',
  '3. Tulis angka saja (kg/cm/m³), atau angka dengan satuan: "500 g", "1,2 ton", "700 mm", "0,7 m", "500 L".',
  '   Koma untuk desimal: 12,5.',
  '4. Panjang, lebar, dan tinggi diisi ketiganya atau dikosongkan ketiganya.',
  '5. Barang curah (pasir, batu, tanah): isi curah = YA, berat, dan volume_m3 (mis. 1 m³). Ukuran dikosongkan.',
  '6. Sel kosong = data itu dikosongkan. Kolom yang Anda hapus dari berkas tidak mengubah data apa pun.',
  '7. Kolom nama_barang dan satuan_dasar hanya keterangan; perubahannya tidak dibaca.',
  '8. Unggah di Data Barang › Data muatan Excel. Periksa pratinjau (kolom Perubahan) sebelum menyimpan.',
  `9. Maksimal ${BARIS_MAKS} baris per berkas.`,
];

const angka = (v: string | null) => (v === null ? null : Number(v));

export async function berkasMuatan(
  belum: boolean,
): Promise<{ isi: Uint8Array<ArrayBuffer>; namaBerkas: string }> {
  const daftar = await dataMuatan(db, belum);
  const wb = workbookBaru();
  const ws = wb.addWorksheet(NAMA_LEMBAR, { views: [{ state: 'frozen', ySplit: 2, xSplit: 2 }] });
  ws.columns = KOLOM.map((k) => ({ key: k.kunci, width: k.lebar }));
  KOLOM.forEach((k, i) => {
    const sel = ws.getRow(1).getCell(i + 1);
    sel.value = k.kunci;
    sel.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sel.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: i < 3 ? 'FF64748B' : 'FF2563EB' },
    };
    const p = ws.getRow(2).getCell(i + 1);
    p.value = k.petunjuk;
    p.font = { italic: true, color: { argb: 'FF64748B' } };
  });
  daftar.forEach((b, i) => {
    const m = rapikanMuatan(b);
    ws.getRow(3 + i).values = [
      b.kode,
      b.statusAktif === 'AKTIF' ? b.namaBarang : `${b.namaBarang} (nonaktif)`,
      b.satuan,
      angka(m.beratKg),
      angka(m.panjangCm),
      angka(m.lebarCm),
      angka(m.tinggiCm),
      m.curah ? 'YA' : null,
      angka(m.volumeM3),
    ];
  });
  const curah = ws.getColumn(KOLOM.findIndex((k) => k.kunci === 'curah') + 1).letter;
  for (let r = 3; r < 3 + Math.max(daftar.length, 1) + 50; r++) {
    ws.getCell(`${curah}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"YA,TIDAK"'],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Curah',
      error: 'Pilih YA atau TIDAK (atau kosongkan).',
    };
  }
  const p = wb.addWorksheet('Petunjuk');
  p.getColumn(1).width = 110;
  PETUNJUK.forEach((teks, i) => {
    p.getCell(`A${i + 1}`).value = teks;
  });
  p.getCell('A1').font = { bold: true, size: 13 };
  return {
    isi: await keBytes(wb),
    namaBerkas: `data-muatan-${belum ? 'belum-lengkap-' : ''}${tanggalOperasional()}.xlsx`,
  };
}

/** Teks sel: bilangan bulat apa adanya, pecahan memakai koma. */
function teksSel(nilai: ExcelJS.CellValue): string {
  const { teks, angka: a } = isiSel(nilai);
  if (a === null) return teks;
  return Number.isInteger(a) ? String(a) : String(a).replace('.', ',');
}

export async function bacaBerkasMuatan(
  isi: Uint8Array,
  namaBerkas: string,
): Promise<BacaImportMuatan> {
  const wb = await muatXlsx(isi);
  const ws = wb.getWorksheet(NAMA_LEMBAR) ?? wb.worksheets[0];
  if (!ws) throw new AppError('VALIDASI', 'Berkas tidak berisi lembar data.', 400);
  const indeks = new Map<string, number>();
  const peringatan: string[] = [];
  const dikenal = new Set(KOLOM.map((k) => k.kunci));
  ws.getRow(1).eachCell((cell, kolom) => {
    const kunci = isiSel(cell.value).teks.trim().toLowerCase();
    if (!kunci) return;
    if (dikenal.has(kunci)) indeks.set(kunci, kolom);
    else peringatan.push(`Kolom "${kunci}" tidak dikenal; isinya diabaikan.`);
  });
  if (!indeks.has('kode')) {
    throw new AppError(
      'VALIDASI',
      'Kolom kode tidak ditemukan di baris 1. Unduh berkas data muatan dari aplikasi.',
      400,
    );
  }
  const kolom = KOLOM_MUATAN_EXCEL.filter((k) => indeks.has(k));
  if (kolom.length === 0) {
    throw new AppError('VALIDASI', 'Berkas tidak berisi kolom data muatan (berat_kg, dst.).', 400);
  }
  const baris: BarisImportMentah[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nilai: Record<string, string> = {};
    for (const [kunci, k] of indeks) {
      const teks = teksSel(row.getCell(k).value).trim().slice(0, 255);
      if (teks !== '') nilai[kunci] = teks;
    }
    if (r === 2 && nilai.kode === PETUNJUK_KODE) continue;
    if (Object.keys(nilai).length === 0) continue;
    baris.push({ nomorBaris: r, nilai });
  }
  if (baris.length === 0) throw new AppError('VALIDASI', 'Berkas tidak berisi baris barang.', 400);
  if (baris.length > BARIS_MAKS) {
    throw new AppError('VALIDASI', `Maksimal ${BARIS_MAKS} baris per berkas.`, 400);
  }
  return { namaBerkas: namaBerkas.slice(0, 100), kolom, baris, peringatan };
}

function teksNilai(field: keyof MuatanBarang, v: string | boolean | null): string {
  if (field === 'curah') return v ? 'ya' : 'tidak';
  if (v === null || v === '') return '(kosong)';
  return `${String(v).replace('.', ',')} ${LABEL[field][1]}`;
}

/** Bentuk akhir yang akan disimpan (sama dengan `simpanMuatan`: barang curah tanpa ukuran per buah). */
function rapikanBaru(m: MuatanBarang): MuatanBarang {
  return m.curah ? { ...m, panjangCm: null, lebarCm: null, tinggiCm: null } : m;
}

/**
 * Pratinjau (`simpan = false`) atau simpan data muatan dari baris teks. Simpan hanya bila tidak ada baris bergalat;
 * semua barang yang berubah disimpan dalam satu transaksi dengan log BARANG_UBAH per barang dan satu IMPORT_MUATAN.
 */
export async function prosesMuatan(
  data: { namaBerkas: string; kolom: KolomMuatanExcel[]; baris: BarisImportMentah[] },
  simpan: boolean,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilImportMuatan> {
  return dalamTransaksi(async (tx) => {
    const kodeBaris = (b: BarisImportMentah) => (b.nilai.kode ?? '').trim().toUpperCase();
    const semuaKode = [...new Set(data.baris.map(kodeBaris).filter(Boolean))];
    const perKode = new Map(
      (await muatanPerKode(tx, semuaKode, simpan)).map((b) => [b.kode.toUpperCase(), b]),
    );
    const terlihat = new Map<string, number>();
    const hasil: BarisImportMuatan[] = [];
    const simpanan: {
      id: number;
      label: string;
      muatan: MuatanBarang;
      baris: BarisImportMuatan;
    }[] = [];

    for (const b of data.baris) {
      const kode = kodeBaris(b) || null;
      const barang = kode ? perKode.get(kode) : undefined;
      const h: BarisImportMuatan = {
        nomorBaris: b.nomorBaris,
        kode,
        namaBarang: barang?.namaBarang ?? (b.nilai.nama_barang ?? '').trim(),
        status: 'GALAT',
        perubahan: [],
        pesan: [],
      };
      hasil.push(h);
      if (!kode) {
        h.pesan.push('Kode kosong.');
        continue;
      }
      if (terlihat.has(kode)) {
        h.pesan.push(`Kode sama dengan baris ${terlihat.get(kode)}.`);
        continue;
      }
      terlihat.set(kode, b.nomorBaris);
      if (!barang) {
        h.pesan.push(`Barang dengan kode ${kode} tidak ditemukan.`);
        continue;
      }

      const lama = rapikanMuatan(barang);
      const isian: MuatanBarang = { ...lama };
      for (const k of data.kolom) {
        const teks = (b.nilai[k] ?? '').trim();
        if (k === 'curah') {
          const t = teks.toUpperCase();
          if (['', 'TIDAK', 'T', 'N', 'NO', '0', 'FALSE'].includes(t)) isian.curah = false;
          else if (['YA', 'Y', 'YES', '1', 'TRUE', 'CURAH'].includes(t)) isian.curah = true;
          else h.pesan.push(`Curah "${teks}": isi YA atau kosongkan.`);
          continue;
        }
        const { nilai, galat } = bacaIsianMuatan(teks, JENIS[k]);
        if (galat) h.pesan.push(`${LABEL[KE_FIELD[k]][0]}: ${galat}`);
        else isian[KE_FIELD[k]] = nilai;
      }
      if (h.pesan.length > 0) continue;
      const valid = skemaMuatanBarang.safeParse(isian);
      if (!valid.success) {
        h.pesan.push(...new Set(valid.error.issues.map((i) => i.message)));
        continue;
      }
      const baru = rapikanBaru(rapikanMuatan(valid.data));
      for (const f of Object.keys(LABEL) as (keyof MuatanBarang)[]) {
        if (lama[f] !== baru[f]) {
          h.perubahan.push(`${LABEL[f][0]} ${teksNilai(f, lama[f])} → ${teksNilai(f, baru[f])}`);
        }
      }
      h.status = h.perubahan.length > 0 ? 'BERUBAH' : 'SAMA';
      if (h.status === 'BERUBAH') {
        simpanan.push({
          id: barang.id,
          label: `${barang.kode} ${barang.namaBarang}`,
          muatan: baru,
          baris: h,
        });
      }
    }

    const ringkas = (disimpan: boolean): HasilImportMuatan => {
      const n = (s: BarisImportMuatan['status']) => hasil.filter((x) => x.status === s).length;
      return {
        baris: hasil,
        ringkasan: {
          total: hasil.length,
          berubah: n('BERUBAH'),
          sama: n('SAMA'),
          galat: n('GALAT'),
          disimpan: n('DISIMPAN'),
        },
        disimpan,
      };
    };
    if (!simpan) return ringkas(false);
    const galat = hasil.filter((x) => x.status === 'GALAT').length;
    if (galat > 0) {
      throw new AppError(
        'VALIDASI',
        `Masih ada ${galat} baris bergalat; tidak ada yang disimpan. Perbaiki atau buang baris itu.`,
        400,
        { hasil: ringkas(false) },
      );
    }
    for (const s of simpanan) {
      await simpanMuatan(tx, s.id, s.muatan, s.label, pelaku, asal);
      s.baris.status = 'DISIMPAN';
    }
    await catatLog(tx, {
      aksi: 'IMPORT_MUATAN',
      idPengguna: pelaku.id,
      entitas: 'barang',
      ringkasan: `Data muatan dari ${data.namaBerkas}: ${simpanan.length} barang diubah, ${
        hasil.length - simpanan.length
      } tidak berubah`,
      dataBaru: { berkas: data.namaBerkas, diubah: simpanan.map((s) => s.label.split(' ')[0]) },
      ip: asal.ip,
    });
    return ringkas(true);
  });
}
