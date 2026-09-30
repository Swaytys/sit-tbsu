import type { Izin } from '@sit/shared';
import { keBytes, workbookBaru } from '../../../lib/excel';
import { tanggalOperasional } from '../../../lib/waktu';
import { daftarBarang } from '../barang/service';
import { daftarTingkatHarga } from '../tingkat-harga/service';

const FORMAT_RUPIAH = '"Rp" #,##0';

/** H13: ekspor harga jual barang aktif per tier ke Excel (mengikuti saringan halaman Harga Jual). */
export async function eksporHargaJual(
  p: { cari?: string | undefined; idKategori?: number | undefined },
  izin: ReadonlySet<Izin>,
): Promise<{ isi: Uint8Array<ArrayBuffer>; namaBerkas: string }> {
  const tier = (await daftarTingkatHarga(izin)).filter((t) => t.statusAktif === 'AKTIF');
  const { data } = await daftarBarang(
    { ...p, status: 'AKTIF', halaman: 1, perHalaman: 100_000 },
    izin,
  );
  const lihatDasar = izin.has('master.barang.lihat_hpp');

  const wb = workbookBaru();
  const ws = wb.addWorksheet('Harga Jual', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Kode', key: 'kode', width: 14 },
    { header: 'Nama barang', key: 'nama', width: 40 },
    { header: 'Kategori', key: 'kategori', width: 18 },
    { header: 'Satuan', key: 'satuan', width: 10 },
    ...(lihatDasar
      ? [{ header: 'Dasar markup', key: 'dasar', width: 16, style: { numFmt: FORMAT_RUPIAH } }]
      : []),
    ...tier.flatMap((t) => [
      { header: `Harga ${t.nama}`, key: `h${t.id}`, width: 16, style: { numFmt: FORMAT_RUPIAH } },
      { header: `Metode ${t.nama}`, key: `m${t.id}`, width: 12 },
    ]),
  ];
  ws.getRow(1).font = { bold: true };
  for (const b of data) {
    const baris: Record<string, string | number | null> = {
      kode: b.kode,
      nama: b.namaBarang,
      kategori: b.namaKategori,
      satuan: b.kodeSatuan,
      dasar: b.dasarMarkup ?? null,
    };
    for (const t of tier) {
      const h = b.harga.find((x) => x.idTingkatHarga === t.id);
      baris[`h${t.id}`] = h?.hargaJual ?? null;
      baris[`m${t.id}`] = h ? (h.metode === 'TETAP' ? 'Tetap' : 'Ikut tier') : null;
    }
    ws.addRow(baris);
  }
  return {
    isi: await keBytes(wb),
    namaBerkas: `harga-jual-${tanggalOperasional()}.xlsx`,
  };
}
