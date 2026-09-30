import { beforeEach, describe, expect, it } from 'vitest';
import { kosongkanTabel } from '../../../../test/reset';
import { db } from '../../../db/client';
import { satuan } from '../../../db/schema';
import { daftarSatuan } from './service';

/** Nama constraint PostgreSQL yang menolak query (drizzle membungkus galat pg di `cause`). */
async function constraintPenolak(query: Promise<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (err) {
    const galat = err as { constraint?: string; cause?: { constraint?: string } };
    return galat.cause?.constraint ?? galat.constraint;
  }
  return undefined;
}

describe('satuan › daftarSatuan', () => {
  beforeEach(async () => {
    await kosongkanTabel(satuan);
    await db.insert(satuan).values([
      { kode: 'sak', nama: 'Sak', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true },
      {
        kode: 'cm',
        nama: 'Sentimeter',
        jenisDimensi: 'PANJANG',
        faktorKeBasis: '0.01',
        isBasis: false,
      },
      { kode: 'kg', nama: 'Kilogram', jenisDimensi: 'BERAT', faktorKeBasis: '1', isBasis: true },
      { kode: 'm', nama: 'Meter', jenisDimensi: 'PANJANG', faktorKeBasis: '1', isBasis: true },
      {
        kode: 'mm',
        nama: 'Milimeter',
        jenisDimensi: 'PANJANG',
        faktorKeBasis: '0.001',
        isBasis: false,
        statusAktif: 'NONAKTIF',
      },
    ]);
  });

  it('mengurutkan per dimensi (urutan enum), satuan basis dulu, lalu faktor terbesar', async () => {
    const hasil = await daftarSatuan();
    expect(hasil.map((s) => s.kode)).toEqual(['m', 'cm', 'mm', 'kg', 'sak']);
  });

  it('faktor ke basis dikirim sebagai desimal eksak (string), bukan float', async () => {
    const mm = (await daftarSatuan()).find((s) => s.kode === 'mm');
    expect(mm?.faktorKeBasis).toBe('0.001000');
  });

  it('satuan nonaktif tetap ada dengan statusnya (data master tidak dihapus)', async () => {
    const mm = (await daftarSatuan()).find((s) => s.kode === 'mm');
    expect(mm?.statusAktif).toBe('NONAKTIF');
  });
});

describe('satuan › aturan yang ditegakkan database', () => {
  beforeEach(async () => {
    await kosongkanTabel(satuan);
    await db.insert(satuan).values({
      kode: 'm',
      nama: 'Meter',
      jenisDimensi: 'PANJANG',
      faktorKeBasis: '1',
      isBasis: true,
    });
  });

  it('dimensi fisik hanya boleh punya satu satuan basis', async () => {
    const constraint = await constraintPenolak(
      db.insert(satuan).values({
        kode: 'yd',
        nama: 'Yard',
        jenisDimensi: 'PANJANG',
        faktorKeBasis: '0.9144',
        isBasis: true,
      }),
    );
    expect(constraint).toBe('uq_satuan_basis_dimensi');
  });

  it('satuan hitung (JUMLAH) boleh banyak yang berstatus basis', async () => {
    await db.insert(satuan).values([
      { kode: 'sak', nama: 'Sak', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true },
      { kode: 'dus', nama: 'Dus', jenisDimensi: 'JUMLAH', faktorKeBasis: '1', isBasis: true },
    ]);
    expect(await daftarSatuan()).toHaveLength(3);
  });

  it('faktor ke basis harus lebih dari nol', async () => {
    const constraint = await constraintPenolak(
      db.insert(satuan).values({
        kode: 'x',
        nama: 'Salah',
        jenisDimensi: 'PANJANG',
        faktorKeBasis: '0',
        isBasis: false,
      }),
    );
    expect(constraint).toBe('chk_satuan_faktor');
  });

  it('kode satuan unik', async () => {
    const constraint = await constraintPenolak(
      db.insert(satuan).values({
        kode: 'm',
        nama: 'Meter lagi',
        jenisDimensi: 'PANJANG',
        faktorKeBasis: '1',
        isBasis: false,
      }),
    );
    expect(constraint).toBe('satuan_kode_key');
  });
});
