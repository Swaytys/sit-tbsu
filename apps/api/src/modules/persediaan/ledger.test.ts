import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { buatPenggunaUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db, type Tx } from '../../db/client';
import {
  barang,
  hargaBarang,
  kategori,
  mutasiPersediaan,
  pemasok,
  penerimaanBarang,
  penerimaanBarangDetail,
  penyesuaianStok,
  penyesuaianStokDetail,
  persediaan,
  satuan,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import { dalamTransaksi } from '../../lib/transaksi';
import { buatPersediaan, catatMutasi, hitungUlangCache, type InputMutasi } from './ledger';

const TANGGAL = '2026-10-01';
let idPengguna: number;
let idSendiri: number;
let idTitip: number;
let idPemasok: number;
let nomor = 0;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(
    mutasiPersediaan,
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
  );
  idPengguna = (await buatPenggunaUji({ peran: 'ADMIN' })).id;
  const [kat] = await db.insert(kategori).values({ nama: 'Semen' }).returning();
  const [sak] = await db
    .insert(satuan)
    .values({ kode: 'sak', nama: 'Sak', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true })
    .returning();
  const [pms] = await db
    .insert(pemasok)
    .values({ kode: 'PMS-00001', namaPemasok: 'CV. Titip', noHp: '081234567890' })
    .returning();
  idPemasok = pms!.id;
  const barangUji = async (nilai: Partial<typeof barang.$inferInsert>) => {
    const [b] = await db
      .insert(barang)
      .values({
        kode: `B-${++nomor}`,
        namaBarang: 'Semen',
        idKategori: kat!.id,
        idSatuanDasar: sak!.id,
        ...nilai,
      })
      .returning();
    await dalamTransaksi((tx) =>
      buatPersediaan(tx, b!.id, {
        kepemilikan: b!.kepemilikan,
        hargaModalAwal: b!.hargaModalAwal,
        hargaTitip: b!.hargaTitip,
      }),
    );
    return b!.id;
  };
  idSendiri = await barangUji({ namaBarang: 'Semen Gresik', hargaModalAwal: 9000 });
  idTitip = await barangUji({
    namaBarang: 'Cat titipan',
    kepemilikan: 'KONSINYASI',
    idPemasokKonsinyasi: idPemasok,
    hargaTitip: 30000,
  });
});

/** Dokumen sumber minimal (penyesuaian KOREKSI) agar CHECK sumber mutasi terpenuhi. */
async function sumberPenyesuaian(idBarang: number, kondisi: 'BAIK' | 'RUSAK' = 'BAIK') {
  const [adj] = await db
    .insert(penyesuaianStok)
    .values({
      nomor: `ADJ-UJI-${++nomor}`,
      tanggalOperasional: TANGGAL,
      jenis: 'KOREKSI',
      idPengguna,
    })
    .returning();
  const [d] = await db
    .insert(penyesuaianStokDetail)
    .values({ idPenyesuaian: adj!.id, idBarang, kondisi })
    .returning();
  return { idPenyesuaianDetail: d!.id };
}

async function sumberPenerimaan(idBarang: number, qty: string, harga: number) {
  const [rcv] = await db
    .insert(penerimaanBarang)
    .values({
      nomor: `RCV-UJI-${++nomor}`,
      tanggalOperasional: TANGGAL,
      idPemasok,
      idPengguna,
      jenis: 'PEMBELIAN',
      syaratBayar: 'TUNAI',
    })
    .returning();
  const [d] = await db
    .insert(penerimaanBarangDetail)
    .values({
      idPenerimaan: rcv!.id,
      idBarang,
      qtyMasuk: qty,
      qtyDasar: qty,
      hargaModalMasuk: harga,
      hargaModalDasar: harga,
      subtotal: 0,
    })
    .returning();
  return { idPenerimaanDetail: d!.id };
}

async function mutasi(m: Omit<InputMutasi, 'idPengguna' | 'tanggalOperasional'>, tx?: Tx) {
  const input = { ...m, idPengguna, tanggalOperasional: TANGGAL };
  return tx ? catatMutasi(tx, input) : dalamTransaksi((t) => catatMutasi(t, input));
}

async function terima(idBarang: number, qty: string, harga: number, pembelian = true) {
  return mutasi({
    idBarang,
    jenis: 'PENERIMAAN',
    qtyMasuk: qty,
    hppSatuan: harga,
    pembelian,
    sumber: await sumberPenerimaan(idBarang, qty, harga),
  });
}

async function keluar(idBarang: number, qty: string, kondisi: 'BAIK' | 'RUSAK' = 'BAIK') {
  return mutasi({
    idBarang,
    jenis: 'PENYESUAIAN',
    kondisi,
    qtyKeluar: qty,
    sumber: await sumberPenyesuaian(idBarang, kondisi),
  });
}

async function stok(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return p!;
}

describe('ledger stok (docs/05 §2)', () => {
  it('L1/L3 satu baris ledger per mutasi, saldo_setelah dan hpp_setelah benar', async () => {
    const h = await mutasi({
      idBarang: idSendiri,
      jenis: 'SALDO_AWAL',
      qtyMasuk: '10',
      hppSatuan: 12000,
      sumber: await sumberPenyesuaian(idSendiri),
    });
    expect(h).toMatchObject({ saldoSetelah: '10.000', hppSetelah: 12000 });
    const baris = await db.select().from(mutasiPersediaan);
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({
      jenisMutasi: 'SALDO_AWAL',
      qtyMasuk: '10.000',
      saldoSetelah: '10.000',
    });
    expect(await stok(idSendiri)).toMatchObject({ stokFisik: '10.000', hppRata2: 12000 });
  });

  it('L2 saldo bucket tidak boleh negatif (BAIK dan RUSAK)', async () => {
    await terima(idSendiri, '3', 10000);
    await expect(keluar(idSendiri, '3.001')).rejects.toMatchObject({
      kode: 'STOK_TIDAK_CUKUP',
      message: 'Stok Semen Gresik tidak cukup: tersedia 3 sak, diminta 3,001 sak.',
    });
    await expect(keluar(idSendiri, '1', 'RUSAK')).rejects.toBeInstanceOf(AppError);
    expect((await stok(idSendiri)).stokFisik).toBe('3.000');
    expect(await db.select().from(mutasiPersediaan)).toHaveLength(1);
  });

  it('L4 HPP rata-rata tertimbang benar pada 3 penerimaan berbeda harga; keluar tidak mengubah HPP', async () => {
    expect((await terima(idSendiri, '10', 10000)).hppSetelah).toBe(10000); // saldo 0 → harga masuk
    expect((await terima(idSendiri, '3', 10001)).hppSetelah).toBe(10000); // 10.000,23
    expect((await terima(idSendiri, '7', 12345)).hppSetelah).toBe(10821); // 10.820,75 → naik
    expect((await keluar(idSendiri, '20')).hppSetelah).toBe(10821);
    // Saldo menjadi 0: HPP dipertahankan.
    expect(await stok(idSendiri)).toMatchObject({ stokFisik: '0.000', hppRata2: 10821 });
  });

  it('L4 qty desimal dihitung tanpa float', async () => {
    await terima(idSendiri, '2.5', 10000);
    expect((await terima(idSendiri, '0.333', 33333)).hppSetelah).toBe(12743); // 36.099,889 ÷ 2,833 = 12.742,6
  });

  it('L6 penerimaan pembelian memperbarui harga beli terakhir (tanda tinjau diputuskan modul harga)', async () => {
    await terima(idSendiri, '1', 11000);
    expect(await stok(idSendiri)).toMatchObject({
      hargaBeliTerakhir: 11000,
      tanggalBeliTerakhir: TANGGAL,
    });
    // H5/H7 dipicu oleh penerimaan lewat tanggapiPerubahanDasar() (K-086; tes di harga.test.ts).
    const [b] = await db.select().from(barang).where(eq(barang.id, idSendiri));
    expect(b?.perluTinjauHarga).toBe(false);
  });

  it('L7 barang konsinyasi: HPP selalu harga titip, harga beli terakhir tidak berubah', async () => {
    const h = await terima(idTitip, '5', 30000, false);
    expect(h.hppSetelah).toBe(30000);
    expect(await stok(idTitip)).toMatchObject({
      stokFisik: '5.000',
      hppRata2: 30000,
      hargaBeliTerakhir: 0,
    });
  });

  it('A6/K-048 stok fisik tidak boleh turun di bawah stok dipesan', async () => {
    await terima(idSendiri, '10', 10000);
    // Susun keadaan: 8 sak sedang ditahan order (fitur order dibangun Fase 5).
    await db.update(persediaan).set({ stokDipesan: '8' }).where(eq(persediaan.idBarang, idSendiri));
    await expect(keluar(idSendiri, '3')).rejects.toMatchObject({ kode: 'KONFLIK' });
    expect((await keluar(idSendiri, '2')).saldoSetelah).toBe('8.000');
  });

  it('L9 hitung ulang cache dari ledger cocok; selisih terdeteksi', async () => {
    await terima(idSendiri, '10', 10000);
    await terima(idSendiri, '5', 13000);
    await keluar(idSendiri, '4');
    await terima(idTitip, '2', 30000, false);
    expect((await hitungUlangCache(db, idSendiri)).cocok).toBe(true);
    expect((await hitungUlangCache(db, idTitip)).cocok).toBe(true);

    // hpp_setelah konsisten dengan persediaan.hpp_rata2.
    const terakhir = (await db.select().from(mutasiPersediaan))
      .filter((m) => m.idBarang === idSendiri)
      .at(-1);
    expect(terakhir?.hppSetelah).toBe((await stok(idSendiri)).hppRata2);

    await db.update(persediaan).set({ stokFisik: '99' }).where(eq(persediaan.idBarang, idSendiri));
    const audit = await hitungUlangCache(db, idSendiri);
    expect(audit.cocok).toBe(false);
    expect(audit.masalah[0]).toContain('stok_fisik 99.000, ledger 11.000');
  });

  it('L11 20 pengurangan paralel 1 dari stok 10: tepat 10 berhasil, saldo akhir 0', async () => {
    await terima(idSendiri, '10', 10000);
    const sumber = await Promise.all(
      Array.from({ length: 20 }, () => sumberPenyesuaian(idSendiri)),
    );
    const hasil = await Promise.allSettled(
      sumber.map((s) =>
        mutasi({ idBarang: idSendiri, jenis: 'PENYESUAIAN', qtyKeluar: '1', sumber: s }),
      ),
    );
    const gagal = hasil.filter((h) => h.status === 'rejected');
    expect(hasil.filter((h) => h.status === 'fulfilled')).toHaveLength(10);
    expect(gagal).toHaveLength(10);
    for (const g of gagal) {
      expect(g.reason).toMatchObject({ kode: 'STOK_TIDAK_CUKUP' });
    }
    expect((await stok(idSendiri)).stokFisik).toBe('0.000');
    expect((await hitungUlangCache(db, idSendiri)).cocok).toBe(true);
  });
});
