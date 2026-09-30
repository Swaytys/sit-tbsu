import ExcelJS from 'exceljs';
import { AppError } from './errors';

/** Berkas Excel (templat, ekspor, import). Hanya format .xlsx. */

export const TIPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const UKURAN_XLSX_MAKS = 5 * 1024 * 1024;

export function workbookBaru(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIT TBSU';
  wb.created = new Date();
  return wb;
}

/** Membaca .xlsx kiriman pengguna; menolak berkas yang bukan .xlsx (arsip zip) atau terlalu besar. */
export async function muatXlsx(isi: Uint8Array): Promise<ExcelJS.Workbook> {
  if (isi.byteLength > UKURAN_XLSX_MAKS) {
    throw new AppError('VALIDASI', 'Ukuran berkas Excel maksimal 5 MB.', 400);
  }
  const zip = isi[0] === 0x50 && isi[1] === 0x4b && isi[2] === 0x03 && isi[3] === 0x04;
  if (!zip) throw new AppError('VALIDASI', 'Berkas harus berformat Excel .xlsx.', 400);
  const wb = new ExcelJS.Workbook();
  try {
    // Salinan ArrayBuffer sendiri: tipe exceljs meminta ArrayBuffer, bukan Buffer Node.
    await wb.xlsx.load(new Uint8Array(isi).buffer);
  } catch {
    throw new AppError(
      'VALIDASI',
      'Berkas Excel tidak bisa dibaca. Simpan ulang sebagai .xlsx.',
      400,
    );
  }
  return wb;
}

export async function keBytes(wb: ExcelJS.Workbook): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** Header respons unduhan .xlsx. */
export function headerUnduhan(namaBerkas: string): Record<string, string> {
  return {
    'Content-Type': TIPE_XLSX,
    'Content-Disposition': `attachment; filename="${namaBerkas}"`,
    'Cache-Control': 'no-store',
  };
}

/**
 * Isi sel sebagai teks apa adanya (spasi tepi dibuang). Angka tetap dalam bentuk angka JavaScript
 * (`nilaiAngka`) agar pemanggil bisa memeriksa bilangan bulat untuk rupiah.
 */
export function isiSel(nilai: ExcelJS.CellValue): { teks: string; angka: number | null } {
  if (nilai === null || nilai === undefined) return { teks: '', angka: null };
  if (typeof nilai === 'number') return { teks: String(nilai), angka: nilai };
  if (typeof nilai === 'string') return { teks: nilai.trim(), angka: null };
  if (typeof nilai === 'boolean') return { teks: nilai ? 'TRUE' : 'FALSE', angka: null };
  if (nilai instanceof Date) return { teks: nilai.toISOString().slice(0, 10), angka: null };
  if ('richText' in nilai) {
    return {
      teks: nilai.richText
        .map((r) => r.text)
        .join('')
        .trim(),
      angka: null,
    };
  }
  if ('result' in nilai) return isiSel(nilai.result);
  if ('text' in nilai) return { teks: String(nilai.text).trim(), angka: null };
  return { teks: '', angka: null };
}
