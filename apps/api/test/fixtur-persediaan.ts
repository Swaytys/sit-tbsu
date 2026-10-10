import { db } from '../src/db/client';
import {
  barang,
  hargaBarang,
  kategori,
  merk,
  mutasiPersediaan,
  pembayaranPemasok,
  pemasok,
  penerimaanBarang,
  penerimaanBarangDetail,
  penyesuaianStok,
  penyesuaianStokDetail,
  persediaan,
  satuan,
  tingkatHarga,
} from '../src/db/schema';
import { buatPersediaan } from '../src/modules/persediaan/ledger';
import { dalamTransaksi } from '../src/lib/transaksi';
import { kosongkanTabel } from './reset';

/**
 * Data master minimal untuk tes persediaan: 2 pemasok, barang milik sendiri (sak), barang kedua, barang
 * konsinyasi titipan pemasok A, barang nonaktif. Tabel persediaan/transaksi dikosongkan dulu.
 */
export async function siapkanMasterPersediaan() {
  await kosongkanTabel(
    mutasiPersediaan,
    pembayaranPemasok,
    penyesuaianStokDetail,
    penyesuaianStok,
    penerimaanBarangDetail,
    penerimaanBarang,
    hargaBarang,
    persediaan,
    barang,
    kategori,
    satuan,
    pemasok,
    merk,
  );
  const [kat] = await db.insert(kategori).values({ nama: 'Semen' }).returning();
  const [sak] = await db
    .insert(satuan)
    .values({ kode: 'sak', nama: 'Sak', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true })
    .returning();
  const [a, b, mati] = await db
    .insert(pemasok)
    .values([
      { kode: 'PMS-00001', namaPemasok: 'CV. Semen Jaya', noHp: '081234567890' },
      { kode: 'PMS-00002', namaPemasok: 'UD. Cat Murni', noHp: '081234567891' },
      {
        kode: 'PMS-00003',
        namaPemasok: 'Pemasok Lama',
        noHp: '081234567892',
        statusAktif: 'NONAKTIF',
      },
    ])
    .returning();
  let n = 0;
  const buat = async (nilai: Partial<typeof barang.$inferInsert>) => {
    const [x] = await db
      .insert(barang)
      .values({
        kode: `BRG-9000${++n}`,
        namaBarang: `Barang ${n}`,
        idKategori: kat!.id,
        idSatuanDasar: sak!.id,
        ...nilai,
      })
      .returning();
    await dalamTransaksi((tx) =>
      buatPersediaan(tx, x!.id, {
        kepemilikan: x!.kepemilikan,
        hargaModalAwal: x!.hargaModalAwal,
        hargaTitip: x!.hargaTitip,
      }),
    );
    return x!.id;
  };
  return {
    pemasokA: a!.id,
    pemasokB: b!.id,
    pemasokMati: mati!.id,
    semen: await buat({ namaBarang: 'Semen Gresik 40 kg', hargaModalAwal: 9000, stokMinimum: '5' }),
    pasir: await buat({ namaBarang: 'Pasir', hargaModalAwal: 3000 }),
    titip: await buat({
      namaBarang: 'Cat titipan',
      kepemilikan: 'KONSINYASI',
      idPemasokKonsinyasi: a!.id,
      hargaTitip: 30000,
    }),
    mati: await buat({ namaBarang: 'Barang lama', statusAktif: 'NONAKTIF' }),
  };
}

/**
 * Tier dasar "Normal" untuk tes yang menjual barang; mengembalikan id-nya. Tabel tier dikosongkan dulu supaya
 * setiap berkas tes membawa datanya sendiri: lulus atau gagal tidak boleh bergantung pada sisa data berkas
 * tes lain maupun urutan berkas dijalankan.
 */
export async function siapkanTierNormal(): Promise<number> {
  await kosongkanTabel(tingkatHarga);
  const [t] = await db
    .insert(tingkatHarga)
    .values({ kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', isDefault: true })
    .returning();
  return t!.id;
}
