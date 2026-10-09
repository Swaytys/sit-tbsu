import type { KolomImportBarang } from '@sit/shared';
import type ExcelJS from 'exceljs';
import { workbookBaru } from '../../../lib/excel';
import type { ReferensiImport } from './repo';

/*
 * Templat import barang (K-056, K-061, K-064). Baris 1 = kunci kolom (dibaca saat import), baris 2 = petunjuk
 * (dilewati), data mulai baris 3. Kolom harga dan atribut mengikuti tier dan jenis atribut aktif; kolom yang
 * tidak dikenali saat import diabaikan dengan peringatan, sehingga templat lama tetap bisa dipakai.
 */

export const NAMA_LEMBAR = 'Barang';
export const PETUNJUK_NAMA = 'Wajib';
export const BARIS_MAKS = 2000;
const BARIS_DATA_MAKS = BARIS_MAKS + 2;

export type JenisTemplat = 'ringkas' | 'lengkap';
type Kolom = KolomImportBarang & { lebar: number; ringkas: boolean };

/** Semua kolom yang dikenali import, berurutan seperti di templat lengkap. */
export function kolomImport(ref: ReferensiImport): Kolom[] {
  const tier = ref.tier.filter((t) => t.statusAktif === 'AKTIF');
  const jenis = ref.jenisAtribut.filter((j) => j.statusAktif === 'AKTIF');
  const k = (
    kunci: string,
    label: string,
    jenisKolom: Kolom['jenis'],
    petunjuk: string,
    opsi: { wajib?: boolean; ringkas?: boolean; lebar?: number } = {},
  ): Kolom => ({
    kunci,
    label,
    jenis: jenisKolom,
    petunjuk,
    wajib: opsi.wajib ?? false,
    ringkas: opsi.ringkas ?? false,
    lebar: opsi.lebar ?? 16,
  });
  return [
    k('kode', 'Kode', 'TEKS', 'Kosongkan = kode otomatis', { ringkas: true, lebar: 14 }),
    k('nama_barang', 'Nama barang', 'TEKS', PETUNJUK_NAMA, {
      wajib: true,
      ringkas: true,
      lebar: 36,
    }),
    k('kategori', 'Kategori', 'KATEGORI', 'Wajib. Pilih dari daftar', {
      wajib: true,
      ringkas: true,
      lebar: 20,
    }),
    k('merk', 'Merk', 'MERK', 'Opsional. Pilih dari daftar', { ringkas: true }),
    k('satuan_dasar', 'Satuan dasar', 'SATUAN', 'Wajib. Kode satuan, mis. sak', {
      wajib: true,
      ringkas: true,
    }),
    k('barcode', 'Barcode', 'TEKS', 'Opsional, unik'),
    k('stok_minimum', 'Stok minimum', 'QTY', 'Angka; kosong = bawaan toko', { ringkas: true }),
    k('harga_modal_awal', 'Harga modal awal', 'RUPIAH', 'Rupiah bulat, mis. 41234', {
      ringkas: true,
    }),
    k('kepemilikan', 'Kepemilikan', 'KEPEMILIKAN', 'MILIK_SENDIRI / KONSINYASI', { lebar: 18 }),
    k('kode_pemasok', 'Pemasok konsinyasi', 'PEMASOK', 'Wajib bila KONSINYASI'),
    k('harga_titip', 'Harga titip', 'RUPIAH', 'Rupiah bulat, wajib bila KONSINYASI'),
    k('keterangan', 'Keterangan', 'TEKS', 'Opsional', { lebar: 24 }),
    ...tier.map((t) =>
      k(
        `harga_${t.kode.toLowerCase()}`,
        `Harga ${t.nama}`,
        'RUPIAH',
        `Rupiah; kosong = ikut markup ${t.nama} dari harga modal`,
        { ringkas: t.isDefault, lebar: 18 },
      ),
    ),
    ...jenis.map((j) =>
      k(
        `atribut_${j.kode.toLowerCase()}`,
        j.nama,
        'TEKS',
        j.tipeNilai === 'TEKS'
          ? `${j.nama}: teks`
          : j.jenisDimensi
            ? `${j.nama}: angka + satuan, mis. 6 m`
            : `${j.nama}: angka`,
        { lebar: 18 },
      ),
    ),
    k('status', 'Status', 'STATUS', 'AKTIF / NONAKTIF; kosong = AKTIF'),
  ];
}

function kolomTemplat(ref: ReferensiImport, jenis: JenisTemplat, denganStatus: boolean): Kolom[] {
  return kolomImport(ref).filter(
    (k) => (k.kunci !== 'status' || denganStatus) && (jenis === 'lengkap' || k.ringkas),
  );
}

const PETUNJUK = [
  'Cara mengisi templat import barang',
  '',
  '1. Isi lembar "Barang" mulai baris 3. Jangan ubah baris 1 (nama kolom). Baris 2 adalah petunjuk.',
  '2. Kolom berjudul biru tua wajib diisi: nama_barang, kategori, dan satuan_dasar.',
  '3. Lihat lembar "Contoh" untuk contoh pengisian setiap kolom.',
  '4. Kategori, merk, satuan, kepemilikan, dan pemasok dipilih dari daftar (klik sel, lalu panah di kanan).',
  '5. Kolom rupiah hanya menerima angka bulat tanpa titik/koma, mis. 41234. Stok minimum boleh desimal.',
  '6. Kode boleh dikosongkan (otomatis BRG-00001, ...). Baris dengan kode yang sudah ada DILEWATI:',
  '   import hanya menambah barang baru, tidak mengubah barang lama.',
  '7. Harga tier boleh dikosongkan: harganya mengikuti markup tier dari harga modal awal. Bila harga modal',
  '   juga kosong, barang belum bisa dijual sampai penerimaan pertama. Harga yang diisi menjadi harga tetap.',
  '8. Atribut berdimensi ditulis angka lalu kode satuan, mis. "6 m" atau "12,5 cm".',
  '9. Templat ringkas hanya berisi kolom yang paling sering dipakai; kolom lain boleh ditambahkan dari',
  '   templat lengkap. Kolom yang tidak dikenali saat import diabaikan dan diberi peringatan.',
  '10. Unggah berkas di Data Barang › Import Excel. Baris bergalat bisa diperbaiki langsung di pratinjau.',
  `11. Maksimal ${BARIS_MAKS} baris per berkas.`,
];

const WARNA_WAJIB = 'FF1E3A8A';
const WARNA_BIASA = 'FF2563EB';

/**
 * Templat import (tanpa data) atau berkas ekspor (dengan `data`, satu objek per barang dengan kunci kolom).
 * Berisi lembar Barang, Contoh, Referensi, dan Petunjuk.
 */
export function buatBerkasBarang(
  ref: ReferensiImport,
  opsi: { jenis: JenisTemplat; data?: Record<string, string | number | null>[] },
): ExcelJS.Workbook {
  const wb = workbookBaru();
  const ws = wb.addWorksheet(NAMA_LEMBAR, { views: [{ state: 'frozen', ySplit: 2 }] });
  const kolom = kolomTemplat(ref, opsi.jenis, opsi.data !== undefined);
  ws.columns = kolom.map((k) => ({ key: k.kunci, width: k.lebar }));
  const judul = ws.getRow(1);
  const petunjuk = ws.getRow(2);
  kolom.forEach((k, i) => {
    const sel = judul.getCell(i + 1);
    sel.value = k.kunci;
    sel.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sel.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: k.wajib ? WARNA_WAJIB : WARNA_BIASA },
    };
    const p = petunjuk.getCell(i + 1);
    p.value = k.petunjuk;
    p.font = { italic: true, color: { argb: 'FF64748B' } };
  });
  (opsi.data ?? []).forEach((baris, i) => {
    const row = ws.getRow(3 + i);
    kolom.forEach((k, j) => {
      const v = baris[k.kunci];
      if (v !== null && v !== undefined && v !== '') row.getCell(j + 1).value = v;
    });
  });

  // Lembar Referensi: pilihan untuk daftar dropdown.
  const r = wb.addWorksheet('Referensi');
  r.columns = [
    { header: 'Kategori', key: 'kategori', width: 24 },
    { header: 'Kode satuan', key: 'satuan', width: 14 },
    { header: 'Nama satuan', key: 'namaSatuan', width: 22 },
    { header: 'Kode pemasok', key: 'pemasok', width: 14 },
    { header: 'Nama pemasok', key: 'namaPemasok', width: 30 },
    { header: 'Merk', key: 'merk', width: 20 },
  ];
  r.getRow(1).font = { bold: true };
  const aktif = <T extends { statusAktif: string }>(d: T[]) =>
    d.filter((x) => x.statusAktif === 'AKTIF');
  const kategori = aktif(ref.kategori);
  const satuan = aktif(ref.satuan);
  const pemasok = aktif(ref.pemasok);
  const merk = aktif(ref.merk);
  const panjang = Math.max(kategori.length, satuan.length, pemasok.length, merk.length);
  for (let i = 0; i < panjang; i++) {
    r.addRow({
      kategori: kategori[i]?.nama,
      satuan: satuan[i]?.kode,
      namaSatuan: satuan[i]?.nama,
      pemasok: pemasok[i]?.kode,
      namaPemasok: pemasok[i]?.nama,
      merk: merk[i]?.nama,
    });
  }

  // Validasi sel: daftar pilihan dan angka (menolak huruf di kolom angka).
  for (const [i, k] of kolom.entries()) {
    const huruf = ws.getColumn(i + 1).letter;
    const daftar = (formula: string): ExcelJS.DataValidation => ({
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: k.label,
      error: `Pilih ${k.label.toLowerCase()} dari daftar.`,
    });
    let dv: ExcelJS.DataValidation | undefined;
    if (k.jenis === 'KATEGORI' && kategori.length > 0) {
      dv = daftar(`Referensi!$A$2:$A$${kategori.length + 1}`);
    } else if (k.jenis === 'SATUAN' && satuan.length > 0) {
      dv = daftar(`Referensi!$B$2:$B$${satuan.length + 1}`);
    } else if (k.jenis === 'PEMASOK' && pemasok.length > 0) {
      dv = daftar(`Referensi!$D$2:$D$${pemasok.length + 1}`);
    } else if (k.jenis === 'MERK' && merk.length > 0) {
      dv = daftar(`Referensi!$F$2:$F$${merk.length + 1}`);
    } else if (k.jenis === 'KEPEMILIKAN') {
      dv = daftar('"MILIK_SENDIRI,KONSINYASI"');
    } else if (k.jenis === 'STATUS') {
      dv = daftar('"AKTIF,NONAKTIF"');
    } else if (k.jenis === 'RUPIAH') {
      dv = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: k.label,
        error: 'Isi angka rupiah bulat tanpa titik atau koma, mis. 41234.',
      };
    } else if (k.jenis === 'QTY') {
      dv = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: k.label,
        error: 'Isi angka ≥ 0.',
      };
    }
    if (!dv) continue;
    for (let baris = 3; baris <= BARIS_DATA_MAKS; baris++)
      ws.getCell(`${huruf}${baris}`).dataValidation = dv;
  }

  // Lembar Contoh: kolom ditulis menurun (vertikal) agar mudah dibaca.
  const c = wb.addWorksheet('Contoh');
  c.columns = [
    { header: 'Kolom', key: 'kunci', width: 22 },
    { header: 'Wajib', key: 'wajib', width: 8 },
    { header: 'Contoh 1', key: 'c1', width: 26 },
    { header: 'Contoh 2', key: 'c2', width: 26 },
    { header: 'Keterangan', key: 'petunjuk', width: 50 },
  ];
  c.getRow(1).font = { bold: true };
  const contoh = contohBaris(ref);
  for (const k of kolomImport(ref)) {
    c.addRow({
      kunci: k.kunci,
      wajib: k.wajib ? 'Ya' : '',
      c1: contoh[0]?.[k.kunci] ?? '',
      c2: contoh[1]?.[k.kunci] ?? '',
      petunjuk: k.petunjuk,
    });
  }

  const p = wb.addWorksheet('Petunjuk');
  p.getColumn(1).width = 110;
  PETUNJUK.forEach((teks, i) => {
    p.getCell(`A${i + 1}`).value = teks;
  });
  p.getCell('A1').font = { bold: true, size: 13 };
  return wb;
}

/** Dua contoh baris memakai data referensi yang benar-benar ada. */
function contohBaris(ref: ReferensiImport): Record<string, string | number>[] {
  const kategori = ref.kategori.find((x) => x.statusAktif === 'AKTIF')?.nama ?? 'Semen';
  const merk = ref.merk.find((x) => x.statusAktif === 'AKTIF')?.nama ?? '';
  const satuan = ref.satuan.find((x) => x.statusAktif === 'AKTIF')?.kode ?? 'sak';
  const pemasok = ref.pemasok.find((x) => x.statusAktif === 'AKTIF')?.kode ?? 'PMS-00001';
  const tierDefault = ref.tier.find((t) => t.isDefault);
  const tierLain = ref.tier.find((t) => !t.isDefault && t.statusAktif === 'AKTIF');
  const atributAngka = ref.jenisAtribut.find((j) => j.tipeNilai === 'ANGKA' && j.jenisDimensi);
  const satuanAtribut = ref.satuan.find((s) => s.jenisDimensi === atributAngka?.jenisDimensi)?.kode;
  const atributTeks = ref.jenisAtribut.find((j) => j.tipeNilai === 'TEKS');
  const umum: Record<string, string | number> = {
    kategori,
    merk,
    satuan_dasar: satuan,
    keterangan: '',
  };
  const a: Record<string, string | number> = {
    ...umum,
    kode: '',
    nama_barang: 'Semen 40 kg',
    stok_minimum: 10,
    harga_modal_awal: 52000,
    kepemilikan: 'MILIK_SENDIRI',
  };
  const b: Record<string, string | number> = {
    ...umum,
    kode: 'CAT-01',
    nama_barang: 'Cat tembok 5 kg titipan',
    barcode: '8991234567890',
    stok_minimum: '2,5',
    harga_modal_awal: '',
    kepemilikan: 'KONSINYASI',
    kode_pemasok: pemasok,
    harga_titip: 150000,
    status: 'AKTIF',
  };
  if (tierDefault) {
    a[`harga_${tierDefault.kode.toLowerCase()}`] = 60000;
    b[`harga_${tierDefault.kode.toLowerCase()}`] = 185000;
  }
  if (tierLain) {
    a[`harga_${tierLain.kode.toLowerCase()}`] = '';
    b[`harga_${tierLain.kode.toLowerCase()}`] = 180000;
  }
  if (atributAngka && satuanAtribut) {
    a[`atribut_${atributAngka.kode.toLowerCase()}`] = `6 ${satuanAtribut}`;
  }
  if (atributTeks) b[`atribut_${atributTeks.kode.toLowerCase()}`] = 'Putih';
  return [a, b];
}
