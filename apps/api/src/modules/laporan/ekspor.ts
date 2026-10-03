import {
  teksTanggalAngka,
  type BarisIkhtisar,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type NadaSel,
  type SelLaporan,
  type TabelLaporan,
  type TampilanToko,
} from '@sit/shared';
import type ExcelJS from 'exceljs';
import { headerUnduhan, keBytes, workbookBaru } from '../../lib/excel';
import { waktuTeks } from './umum';

/*
 * Ekspor Excel dokumen laporan (K-078): kop toko, judul, periode, ikhtisar bergaya laporan keuangan
 * (pengurang dalam kurung, subtotal bergaris tunggal, total bergaris ganda), tabel bergaris, catatan,
 * kolom tanda tangan, dan kaki halaman "Halaman x dari y". Angka tetap angka (bisa dijumlah di Excel).
 */

const FMT_UANG = '#,##0;(#,##0);"–"';
const FMT_BULAT = '#,##0;(#,##0);"–"';
const FMT_DESIMAL = '#,##0.0##;(#,##0.0##);"–"';
const FMT_PERSEN = '0.0%;(0.0%);"–"';

const WARNA_NADA: Record<NadaSel, string> = {
  baik: 'FF15803D',
  peringatan: 'FFB45309',
  bahaya: 'FFB91C1C',
  info: 'FF1D4ED8',
};
const GARIS: ExcelJS.Border = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const GARIS_TEGAS: ExcelJS.Border = { style: 'thin', color: { argb: 'FF0F172A' } };
const GARIS_GANDA: ExcelJS.Border = { style: 'double', color: { argb: 'FF0F172A' } };
const GRID: Partial<ExcelJS.Borders> = { top: GARIS, left: GARIS, bottom: GARIS, right: GARIS };

function isiSel(cell: ExcelJS.Cell, s: SelLaporan) {
  switch (s.j) {
    case 'teks':
      cell.value = s.v;
      cell.font = {
        ...(s.tebal ? { bold: true } : {}),
        ...(s.mono ? { name: 'Consolas' } : {}),
        ...(s.nada ? { color: { argb: WARNA_NADA[s.nada] } } : {}),
      };
      break;
    case 'uang':
      cell.value = s.v;
      cell.numFmt = FMT_UANG;
      cell.alignment = { horizontal: 'right' };
      break;
    case 'qty':
      // Qty numeric(14,3) aman sebagai double untuk tampilan dan penjumlahan di Excel.
      cell.value = Number(s.v);
      cell.numFmt = /\.\d*[1-9]/.test(s.v) ? FMT_DESIMAL : FMT_BULAT;
      cell.alignment = { horizontal: 'right' };
      break;
    case 'angka':
      cell.value = s.v;
      cell.numFmt = FMT_BULAT;
      cell.alignment = { horizontal: 'right' };
      break;
    case 'persen':
      if (s.v === null) cell.value = '–';
      else {
        cell.value = s.v / 100;
        cell.numFmt = FMT_PERSEN;
      }
      cell.alignment = { horizontal: 'right' };
      break;
    case 'tanggal':
      cell.value = teksTanggalAngka(s.v);
      cell.alignment = { horizontal: 'center' };
      break;
    case 'kosong':
      break;
  }
}

class Penulis {
  baris = 1;
  constructor(
    readonly ws: ExcelJS.Worksheet,
    readonly n: number,
  ) {}

  gabung(r: number, c1: number, c2: number) {
    if (c2 > c1) this.ws.mergeCells(r, c1, r, c2);
  }

  teksPenuh(isi: string, font: Partial<ExcelJS.Font>, rata: 'left' | 'center' = 'left') {
    const r = this.baris++;
    const cell = this.ws.getCell(r, 1);
    cell.value = isi;
    cell.font = font;
    cell.alignment = { horizontal: rata, vertical: 'middle', wrapText: true };
    this.gabung(r, 1, this.n);
    return r;
  }

  kosong() {
    this.baris++;
  }

  kop(toko: TampilanToko) {
    this.teksPenuh(toko.namaToko, { bold: true, size: 14 });
    this.teksPenuh(toko.namaBadanUsaha, { bold: true, size: 11 });
    const r = this.teksPenuh(
      [toko.alamatToko, toko.telpToko && `Telp. ${toko.telpToko}`, toko.emailToko]
        .filter(Boolean)
        .join(' · '),
      { size: 9, color: { argb: 'FF475569' } },
    );
    for (let c = 1; c <= this.n; c++) {
      this.ws.getCell(r, c).border = { bottom: GARIS_GANDA };
    }
    this.kosong();
  }

  judul(d: DokumenLaporan) {
    this.teksPenuh(d.judul.toUpperCase(), { bold: true, size: 13 }, 'center');
    for (const s of d.subjudul) this.teksPenuh(s, { size: 10 }, 'center');
    this.kosong();
  }

  info(judul: string | undefined, pasangan: { label: string; nilai: string }[]) {
    if (judul) this.teksPenuh(judul, { bold: true, size: 11 });
    const tengah = Math.max(2, Math.ceil(this.n / 2));
    for (const p of pasangan) {
      const r = this.baris++;
      this.ws.getCell(r, 1).value = p.label;
      this.ws.getCell(r, 1).font = { color: { argb: 'FF475569' } };
      this.gabung(r, 1, Math.max(1, tengah - 1));
      const v = this.ws.getCell(r, tengah);
      v.value = `: ${p.nilai}`;
      v.alignment = { wrapText: true };
      this.gabung(r, tengah, this.n);
    }
    this.kosong();
  }

  ikhtisar(judul: string | undefined, baris: BarisIkhtisar[]) {
    if (judul) this.teksPenuh(judul, { bold: true, size: 11 });
    for (const b of baris) {
      const r = this.baris++;
      const label = this.ws.getCell(r, 1);
      const tebal = b.gaya === 'judul' || b.gaya === 'subtotal' || b.gaya === 'total';
      label.value = b.label;
      label.font = { bold: tebal };
      label.alignment = { indent: (b.tingkat ?? 0) * 2 };
      this.gabung(r, 1, this.n - 1);
      if (!b.nilai) continue;
      const nilai = this.ws.getCell(r, this.n);
      const sel: SelLaporan =
        b.gaya === 'kurang' && b.nilai.j === 'uang' ? { j: 'uang', v: -b.nilai.v } : b.nilai;
      isiSel(nilai, sel);
      nilai.font = { ...nilai.font, bold: tebal };
      if (b.gaya === 'subtotal') nilai.border = { top: GARIS_TEGAS };
      if (b.gaya === 'total') nilai.border = { top: GARIS_TEGAS, bottom: GARIS_GANDA };
    }
    this.kosong();
  }

  tabel(judul: string | undefined, t: TabelLaporan) {
    if (judul) this.teksPenuh(judul, { bold: true, size: 11 });
    const adaGrup = t.kolom.some((k) => k.grup);
    const r1 = this.baris;
    const r2 = adaGrup ? r1 + 1 : r1;
    const gayaKepala = (cell: ExcelJS.Cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { top: GARIS_TEGAS, left: GARIS, bottom: GARIS_TEGAS, right: GARIS };
    };
    for (let i = 0; i < t.kolom.length;) {
      const k = t.kolom[i]!;
      const c = i + 1;
      if (adaGrup && k.grup) {
        let j = i;
        while (j + 1 < t.kolom.length && t.kolom[j + 1]!.grup === k.grup) j++;
        this.ws.getCell(r1, c).value = k.grup;
        this.gabung(r1, c, j + 1);
        for (let x = i; x <= j; x++) {
          this.ws.getCell(r2, x + 1).value = t.kolom[x]!.judul;
          gayaKepala(this.ws.getCell(r1, x + 1));
          gayaKepala(this.ws.getCell(r2, x + 1));
        }
        i = j + 1;
      } else {
        this.ws.getCell(r1, c).value = k.judul;
        if (adaGrup) this.ws.mergeCells(r1, c, r2, c);
        gayaKepala(this.ws.getCell(r1, c));
        if (adaGrup) gayaKepala(this.ws.getCell(r2, c));
        i++;
      }
    }
    this.baris = r2 + 1;
    if (!t.baris.some((b) => b.gaya === 'data') && t.kosong) {
      const r = this.baris++;
      const cell = this.ws.getCell(r, 1);
      cell.value = t.kosong;
      cell.font = { italic: true, color: { argb: 'FF64748B' } };
      cell.alignment = { horizontal: 'center' };
      this.gabung(r, 1, t.kolom.length);
    }
    for (const b of t.baris) this.barisTabel(b, t.kolom.length);
    this.kosong();
  }

  barisTabel(b: BarisTabelLaporan, n: number) {
    const r = this.baris++;
    if (b.gaya === 'grup') {
      const cell = this.ws.getCell(r, 1);
      cell.value = b.label ?? '';
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = GRID;
      cell.alignment = { wrapText: true };
      this.gabung(r, 1, n);
      return;
    }
    let awal = 0;
    if (b.label !== undefined) {
      while (awal < b.sel.length && b.sel[awal]!.j === 'kosong') awal++;
      const span = Math.max(1, awal);
      const cell = this.ws.getCell(r, 1);
      cell.value = b.label;
      cell.alignment = { horizontal: b.gaya === 'data' ? 'left' : 'right', wrapText: true };
      this.gabung(r, 1, span);
      awal = span;
    }
    const tebal = b.gaya === 'subtotal' || b.gaya === 'total';
    for (let i = 0; i < n; i++) {
      const cell = this.ws.getCell(r, i + 1);
      if (i >= awal) {
        const s = b.sel[i];
        if (s) isiSel(cell, s);
      }
      cell.font = { ...cell.font, bold: tebal || cell.font?.bold === true };
      cell.border = {
        ...GRID,
        ...(tebal ? { top: GARIS_TEGAS } : {}),
        ...(b.gaya === 'total' ? { bottom: GARIS_GANDA } : {}),
      };
      if (tebal) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  }

  catatan(daftar: string[]) {
    if (daftar.length === 0) return;
    this.teksPenuh('Catatan:', { bold: true, size: 9 });
    daftar.forEach((c, i) => {
      const r = this.teksPenuh(`${i + 1}. ${c}`, { size: 9, color: { argb: 'FF475569' } });
      this.ws.getRow(r).height = Math.max(15, Math.ceil(c.length / (this.n * 9)) * 13);
    });
    this.kosong();
  }

  tandaTangan(d: DokumenLaporan) {
    const k = d.tandaTangan.length;
    if (k === 0) return;
    this.teksPenuh(`Disusun pada ${waktuTeks(d.disusunPada)} WIB`, { size: 9 }, 'left');
    this.kosong();
    const lebarBlok = Math.max(1, Math.floor(this.n / k));
    const r = this.baris;
    d.tandaTangan.forEach((t, i) => {
      const c1 = i * lebarBlok + 1;
      const c2 = i === k - 1 ? this.n : c1 + lebarBlok - 1;
      const tulis = (baris: number, isi: string, font: Partial<ExcelJS.Font> = {}) => {
        const cell = this.ws.getCell(baris, c1);
        cell.value = isi;
        cell.font = font;
        cell.alignment = { horizontal: 'center' };
        this.gabung(baris, c1, c2);
      };
      tulis(r, `${t.label},`);
      tulis(r + 1, t.jabatan, { bold: true });
      tulis(r + 5, t.nama ? `( ${t.nama} )` : '(................................)');
    });
    this.baris = r + 6;
  }
}

/** Menyusun berkas .xlsx dari dokumen laporan. */
export async function eksporExcel(
  d: DokumenLaporan,
  toko: TampilanToko,
): Promise<{ isi: Uint8Array<ArrayBuffer>; header: Record<string, string> }> {
  const tabel = d.bagian.flatMap((b) => (b.jenis === 'tabel' ? [b.tabel] : []));
  const terlebar = tabel.reduce<TabelLaporan | null>(
    (a, t) => (a === null || t.kolom.length > a.kolom.length ? t : a),
    null,
  );
  const n = Math.max(terlebar?.kolom.length ?? 0, 4);
  const wb = workbookBaru();
  const ws = wb.addWorksheet(d.judul.replace(/^Laporan /, '').slice(0, 31), {
    pageSetup: {
      paperSize: 9,
      orientation: d.orientasi === 'lanskap' ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.7, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L&8${`${toko.namaToko} — ${d.judul}`.replaceAll('&', '&&')}&R&8Halaman &P dari &N`,
    },
  });
  ws.columns = Array.from({ length: n }, (_, i) => ({
    width: Math.max(6, (terlebar?.kolom[i]?.lebar ?? 14) + 2),
  }));
  const tulis = new Penulis(ws, n);
  tulis.kop(toko);
  tulis.judul(d);
  for (const b of d.bagian) {
    if (b.jenis === 'info') tulis.info(b.judul, b.pasangan);
    else if (b.jenis === 'ikhtisar') tulis.ikhtisar(b.judul, b.baris);
    else tulis.tabel(b.judul, b.tabel);
  }
  tulis.catatan(d.catatan);
  tulis.tandaTangan(d);
  return { isi: await keBytes(wb), header: headerUnduhan(`${d.namaBerkas}.xlsx`) };
}
