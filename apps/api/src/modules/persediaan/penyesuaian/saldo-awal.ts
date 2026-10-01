import { asc, eq } from 'drizzle-orm';
import { POLA_QTY, type DetailPenyesuaian } from '@sit/shared';
import { db } from '../../../db/client';
import { barang, persediaan, satuan } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import { isiSel, keBytes, muatXlsx, workbookBaru } from '../../../lib/excel';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { catatLog } from '../../sistem/log-aktivitas';
import { buatPenyesuaian } from './service';

/*
 * Import saldo awal dari Excel (docs/05 A2, roadmap Fase 4): templat berisi semua barang aktif dengan
 * nilai per satuan = HPP saat ini; pengguna cukup mengisi qty. Hasilnya SATU draf SALDO_AWAL yang
 * diperiksa lalu diselesaikan di layar (tidak langsung mengubah stok).
 */

const LEMBAR = 'Saldo Awal';
const KOLOM = ['kode_barang', 'nama_barang', 'satuan', 'qty', 'hpp_satuan'] as const;

function barangAktif() {
  return db
    .select({
      id: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      kepemilikan: barang.kepemilikan,
      satuan: satuan.kode,
      hppRata2: persediaan.hppRata2,
    })
    .from(barang)
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(eq(barang.statusAktif, 'AKTIF'))
    .orderBy(asc(barang.namaBarang));
}

export async function templatSaldoAwal(): Promise<Uint8Array<ArrayBuffer>> {
  const wb = workbookBaru();
  const ws = wb.addWorksheet(LEMBAR, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { key: 'kode_barang', width: 14 },
    { key: 'nama_barang', width: 40 },
    { key: 'satuan', width: 10 },
    { key: 'qty', width: 12 },
    { key: 'hpp_satuan', width: 16 },
  ];
  ws.getRow(1).values = [...KOLOM];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  const daftar = await barangAktif();
  for (const b of daftar) {
    ws.addRow({
      kode_barang: b.kode,
      nama_barang: b.namaBarang,
      satuan: b.satuan,
      hpp_satuan: b.kepemilikan === 'KONSINYASI' ? 'titip' : b.hppRata2,
    });
  }
  for (let r = 2; r <= daftar.length + 1; r++) {
    ws.getCell(`D${r}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      error: 'Isi angka ≥ 0.',
    };
  }
  const p = wb.addWorksheet('Petunjuk');
  p.getColumn(1).width = 100;
  [
    'Cara mengisi saldo awal',
    '',
    '1. Isi kolom qty dengan jumlah stok saat ini (dalam satuan dasar). Baris dengan qty kosong dilewati.',
    '2. hpp_satuan = nilai per satuan (rupiah bulat). Sudah terisi HPP saat ini; ubah bila perlu.',
    '   Barang konsinyasi bertanda "titip" selalu bernilai harga titip.',
    '3. Unggah di Stok Persediaan › Penyesuaian › Import saldo awal. Hasilnya draf yang diperiksa dulu,',
    '   lalu tekan Selesaikan agar stok bertambah.',
  ].forEach((t, i) => {
    p.getCell(`A${i + 1}`).value = t;
  });
  return keBytes(wb);
}

export async function imporSaldoAwal(
  isi: Uint8Array,
  namaBerkas: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<DetailPenyesuaian> {
  const wb = await muatXlsx(isi);
  const ws = wb.getWorksheet(LEMBAR) ?? wb.worksheets[0];
  if (!ws) throw new AppError('VALIDASI', 'Berkas tidak berisi lembar data.', 400);
  const indeks = new Map<string, number>();
  ws.getRow(1).eachCell((c, i) => indeks.set(isiSel(c.value).teks.toLowerCase(), i));
  if (!indeks.has('kode_barang') || !indeks.has('qty')) {
    throw new AppError('VALIDASI', 'Kolom kode_barang dan qty wajib ada di baris 1.', 400);
  }
  const perKode = new Map((await barangAktif()).map((b) => [b.kode.toUpperCase(), b]));

  const galat: string[] = [];
  const baris: { idBarang: number; qtyFisik: string; hppSatuan: number }[] = [];
  const terlihat = new Set<number>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const sel = (k: string) => {
      const i = indeks.get(k);
      return i === undefined ? { teks: '', angka: null } : isiSel(ws.getRow(r).getCell(i).value);
    };
    const kode = sel('kode_barang').teks.toUpperCase();
    const qty = sel('qty');
    if (!kode && qty.teks === '') continue;
    if (qty.teks === '') continue; // qty kosong = barang tidak diisi
    const b = perKode.get(kode);
    if (!b) {
      galat.push(`Baris ${r}: kode "${kode}" tidak ditemukan atau barang nonaktif.`);
      continue;
    }
    if (terlihat.has(b.id)) {
      galat.push(`Baris ${r}: ${b.kode} muncul lebih dari sekali.`);
      continue;
    }
    terlihat.add(b.id);
    const teksQty = qty.angka !== null ? String(qty.angka) : qty.teks.replace(',', '.');
    if (!POLA_QTY.test(teksQty) || !/[1-9]/.test(teksQty)) {
      if (teksQty !== '0')
        galat.push(`Baris ${r}: qty ${b.kode} harus angka > 0 (maks. 3 desimal).`);
      continue;
    }
    const hpp = sel('hpp_satuan');
    let nilai = b.hppRata2;
    if (hpp.angka !== null) {
      if (!Number.isSafeInteger(hpp.angka) || hpp.angka < 0) {
        galat.push(`Baris ${r}: hpp_satuan ${b.kode} harus rupiah bulat ≥ 0.`);
        continue;
      }
      nilai = hpp.angka;
    } else if (hpp.teks !== '' && hpp.teks.toLowerCase() !== 'titip') {
      const bersih = hpp.teks.replace(/[\s.]/g, '');
      if (!/^\d{1,15}$/.test(bersih)) {
        galat.push(`Baris ${r}: hpp_satuan ${b.kode} harus rupiah bulat ≥ 0.`);
        continue;
      }
      nilai = Number(bersih);
    }
    baris.push({ idBarang: b.id, qtyFisik: teksQty, hppSatuan: nilai });
  }
  if (galat.length > 0) {
    throw new AppError('VALIDASI', galat.slice(0, 10).join(' '), 400, { galat });
  }
  if (baris.length === 0) {
    throw new AppError('VALIDASI', 'Tidak ada baris dengan qty terisi.', 400);
  }
  const hasil = await buatPenyesuaian(
    {
      jenis: 'SALDO_AWAL',
      alasan: null,
      catatan: `Import saldo awal dari ${namaBerkas}`.slice(0, 255),
      baris: baris.map((b) => ({
        ...b,
        qtySelisih: null,
        keterangan: null,
        dikecualikan: false,
        alasanKecuali: null,
      })),
    },
    pelaku,
    asal,
  );
  await catatLog(db, {
    aksi: 'IMPORT_SALDO_AWAL',
    idPengguna: pelaku.id,
    entitas: 'penyesuaian_stok',
    idEntitas: hasil.id,
    nomorDokumen: hasil.nomor,
    ringkasan: `Import saldo awal dari ${namaBerkas}: ${baris.length} barang (draf ${hasil.nomor})`,
    ip: asal.ip,
  });
  return hasil;
}
