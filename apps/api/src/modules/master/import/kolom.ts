import type ExcelJS from 'exceljs';
import { workbookBaru } from '../../../lib/excel';
import type { ReferensiImport } from './repo';

/*
 * Templat import barang (docs/07 Fase 3, K-056). Baris 1 = kunci kolom (dibaca saat import), baris 2 =
 * petunjuk (dilewati), data mulai baris 3. Kolom harga dan atribut mengikuti tier dan jenis atribut aktif.
 */

export const NAMA_LEMBAR = 'Barang';
export const PETUNJUK_NAMA = 'Wajib';
export const BARIS_MAKS = 2000;

export type KolomImport = { kunci: string; petunjuk: string; lebar: number };

export function kolomImport(ref: ReferensiImport): KolomImport[] {
  const tier = ref.tier.filter((t) => t.statusAktif === 'AKTIF');
  const jenis = ref.jenisAtribut.filter((j) => j.statusAktif === 'AKTIF');
  return [
    { kunci: 'kode', petunjuk: 'Kosongkan = kode otomatis', lebar: 14 },
    { kunci: 'nama_barang', petunjuk: PETUNJUK_NAMA, lebar: 36 },
    { kunci: 'kategori', petunjuk: 'Wajib. Nama kategori', lebar: 20 },
    { kunci: 'merk', petunjuk: 'Opsional. Nama merk', lebar: 16 },
    { kunci: 'satuan_dasar', petunjuk: 'Wajib. Kode satuan, mis. sak', lebar: 14 },
    { kunci: 'barcode', petunjuk: 'Opsional, unik', lebar: 16 },
    { kunci: 'stok_minimum', petunjuk: 'Kosong = bawaan toko', lebar: 14 },
    { kunci: 'harga_modal_awal', petunjuk: 'Rupiah, mis. 41234', lebar: 16 },
    { kunci: 'kepemilikan', petunjuk: 'MILIK_SENDIRI / KONSINYASI', lebar: 18 },
    { kunci: 'kode_pemasok', petunjuk: 'Wajib bila KONSINYASI', lebar: 16 },
    { kunci: 'harga_titip', petunjuk: 'Rupiah, wajib bila KONSINYASI', lebar: 16 },
    { kunci: 'keterangan', petunjuk: 'Opsional', lebar: 24 },
    ...tier.map((t) => ({
      kunci: `harga_${t.kode}`,
      petunjuk: t.isDefault
        ? `Rupiah, wajib (${t.nama})`
        : `Rupiah; kosong = ikut markup ${t.nama}`,
      lebar: 18,
    })),
    ...jenis.map((j) => ({
      kunci: `atribut_${j.kode}`,
      petunjuk:
        j.tipeNilai === 'TEKS'
          ? `${j.nama}: teks`
          : j.jenisDimensi
            ? `${j.nama}: angka + satuan, mis. 6 m`
            : `${j.nama}: angka`,
      lebar: 18,
    })),
  ];
}

const PETUNJUK = [
  'Cara mengisi templat import barang',
  '',
  '1. Isi lembar "Barang" mulai baris 3. Jangan ubah baris 1 (nama kolom). Baris 2 adalah petunjuk.',
  '2. Kolom wajib: nama_barang, kategori, satuan_dasar, dan harga tier default.',
  '3. Kode boleh dikosongkan (otomatis BRG-00001, ...). Baris dengan kode yang sudah ada DILEWATI:',
  '   import hanya menambah barang baru, tidak mengubah barang lama.',
  '4. Kategori ditulis dengan nama; satuan dan pemasok ditulis dengan kode (lihat lembar Referensi).',
  '5. Rupiah ditulis angka bulat tanpa titik/koma, mis. 41234. Stok minimum boleh desimal, mis. 2,5.',
  '6. Harga tier selain default boleh dikosongkan: harganya mengikuti markup tier dari harga modal awal.',
  '7. Atribut berdimensi ditulis angka lalu kode satuan, mis. "6 m" atau "12,5 cm".',
  '8. Unggah berkas di halaman Data Barang > Import Excel, periksa pratinjau, lalu simpan.',
  '   Bila masih ada baris bergalat, tidak ada yang disimpan; perbaiki berkas lalu unggah ulang.',
  `9. Maksimal ${BARIS_MAKS} baris per berkas.`,
];

export function buatTemplat(ref: ReferensiImport): ExcelJS.Workbook {
  const wb = workbookBaru();
  const ws = wb.addWorksheet(NAMA_LEMBAR, { views: [{ state: 'frozen', ySplit: 2 }] });
  const kolom = kolomImport(ref);
  ws.columns = kolom.map((k) => ({ key: k.kunci, width: k.lebar }));
  const judul = ws.getRow(1);
  const petunjuk = ws.getRow(2);
  kolom.forEach((k, i) => {
    judul.getCell(i + 1).value = k.kunci;
    petunjuk.getCell(i + 1).value = k.petunjuk;
  });
  judul.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  judul.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  petunjuk.font = { italic: true, color: { argb: 'FF64748B' } };

  // Lembar referensi untuk pilihan kategori, satuan, pemasok.
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
  const kategori = ref.kategori.filter((k) => k.statusAktif === 'AKTIF');
  const satuan = ref.satuan.filter((s) => s.statusAktif === 'AKTIF');
  const pemasok = ref.pemasok.filter((p) => p.statusAktif === 'AKTIF');
  const merk = ref.merk.filter((m) => m.statusAktif === 'AKTIF');
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

  // Daftar pilihan (dropdown) di sel data.
  const daftar = (kunci: string, formula: string) => {
    const i = kolom.findIndex((k) => k.kunci === kunci);
    if (i < 0) return;
    const huruf = ws.getColumn(i + 1).letter;
    for (let baris = 3; baris <= BARIS_MAKS + 2; baris++) {
      ws.getCell(`${huruf}${baris}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
      };
    }
  };
  if (kategori.length > 0) daftar('kategori', `Referensi!$A$2:$A$${kategori.length + 1}`);
  if (satuan.length > 0) daftar('satuan_dasar', `Referensi!$B$2:$B$${satuan.length + 1}`);
  if (merk.length > 0) daftar('merk', `Referensi!$F$2:$F$${merk.length + 1}`);
  if (pemasok.length > 0) daftar('kode_pemasok', `Referensi!$D$2:$D$${pemasok.length + 1}`);
  daftar('kepemilikan', '"MILIK_SENDIRI,KONSINYASI"');

  const p = wb.addWorksheet('Petunjuk');
  p.getColumn(1).width = 110;
  PETUNJUK.forEach((teks, i) => {
    p.getCell(`A${i + 1}`).value = teks;
  });
  p.getCell('A1').font = { bold: true, size: 13 };
  return wb;
}
