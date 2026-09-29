import { beforeEach, describe, expect, it } from 'vitest';
import { aturKonfigurasi } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { konfigurasi, penghitungNomor } from '../../db/schema';
import { dalamTransaksi } from '../../lib/transaksi';
import { invalidasiKonfigurasi } from './konfigurasi/service';
import {
  sinkronkanKodeMaster,
  tanggalKode,
  terbitkanKodeMaster,
  terbitkanNomor,
} from './penomoran';

const HARI = '2026-09-29';

const terbitkan = (kode: 'ORD' | 'STR', tanggal = HARI) =>
  dalamTransaksi((tx) => terbitkanNomor(tx, kode, tanggal));

beforeEach(async () => {
  await kosongkanTabel(penghitungNomor, konfigurasi);
  invalidasiKonfigurasi();
});

describe('penomoran dokumen (docs/05 §4)', () => {
  it('N1 format PREFIX-YYMMDD-NNN, mulai 001 per hari per prefix', async () => {
    expect(await terbitkan('ORD')).toBe('ORD-260929-001');
    expect(await terbitkan('ORD')).toBe('ORD-260929-002');
    expect(await terbitkan('STR')).toBe('STR-260929-001');
    expect(await terbitkan('ORD', '2026-09-30')).toBe('ORD-260930-001');
  });

  it('N1 melebar menjadi 4 digit setelah 999 dalam sehari', async () => {
    await db
      .insert(penghitungNomor)
      .values({ prefix: 'ORD', tanggalKode: '260929', nilaiTerakhir: 999 });
    expect(await terbitkan('ORD')).toBe('ORD-260929-1000');
  });

  it('N2 prefix dibaca dari konfigurasi saat penerbitan', async () => {
    const lama = await terbitkan('ORD');
    await aturKonfigurasi({ prefix_ORD: 'PO' });
    expect(await terbitkan('ORD')).toBe('PO-260929-001');
    expect(lama).toBe('ORD-260929-001');
  });

  it('N3 50 penerbitan paralel → 50 nomor unik berurutan tanpa celah', async () => {
    const hasil = await Promise.all(Array.from({ length: 50 }, () => terbitkan('ORD')));
    const urut = [...hasil].sort();
    expect(new Set(hasil).size).toBe(50);
    expect(urut[0]).toBe('ORD-260929-001');
    expect(urut[49]).toBe('ORD-260929-050');
  });

  it('N4 nomor boleh berlubang bila transaksi dibatalkan setelah penerbitan', async () => {
    await terbitkan('ORD');
    await expect(
      dalamTransaksi(async (tx) => {
        await terbitkanNomor(tx, 'ORD', HARI);
        throw new Error('simpan dokumen gagal');
      }),
    ).rejects.toThrow('simpan dokumen gagal');
    // Rollback juga membatalkan kenaikan penghitung, jadi nomor berikutnya tetap 002.
    expect(await terbitkan('ORD')).toBe('ORD-260929-002');
  });

  it('N5 kode master PREFIX-NNNNN tanpa reset harian', async () => {
    expect(await dalamTransaksi((tx) => terbitkanKodeMaster(tx, 'USR'))).toBe('USR-00001');
    expect(await dalamTransaksi((tx) => terbitkanKodeMaster(tx, 'USR'))).toBe('USR-00002');
    expect(await dalamTransaksi((tx) => terbitkanKodeMaster(tx, 'BRG'))).toBe('BRG-00001');
  });

  it('N5 sinkronisasi penghitung master tidak pernah menurunkan nilai', async () => {
    await dalamTransaksi((tx) => sinkronkanKodeMaster(tx, 'USR', 7));
    await dalamTransaksi((tx) => sinkronkanKodeMaster(tx, 'USR', 3));
    expect(await dalamTransaksi((tx) => terbitkanKodeMaster(tx, 'USR'))).toBe('USR-00008');
  });

  it('tanggal operasional tidak valid ditolak', () => {
    expect(tanggalKode('2026-09-29')).toBe('260929');
    expect(() => tanggalKode('29/09/2026')).toThrow();
  });
});
