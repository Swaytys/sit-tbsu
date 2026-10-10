import { kaliQty, type ResponsGalat } from '@sit/shared';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { galatBaris, galatKolom } from '../lib/errors';
import { errorHandler } from './error-handler';

/** Galat seperti yang dilempar Drizzle: galat pg (dengan SQLSTATE) dibungkus di `cause`. */
function galatPg(sqlstate: string): Error {
  return new Error('Failed query', {
    cause: Object.assign(new Error('pg'), { code: sqlstate }),
  });
}

async function jawaban(lempar: () => never) {
  const app = new Hono().get('/x', () => lempar()).onError(errorHandler);
  const r = await app.request('/x');
  return { status: r.status, ...((await r.json()) as ResponsGalat).error };
}

describe('errorHandler', () => {
  it('bentrok UNIQUE → 409 KONFLIK', async () => {
    expect(
      await jawaban(() => {
        throw galatPg('23505');
      }),
    ).toMatchObject({ status: 409, kode: 'KONFLIK' });
  });

  it.each(['40P01', '40001', '55P03'])(
    'kebuntuan / menunggu kunci (%s) → 409 "coba lagi", bukan 500',
    async (sqlstate) => {
      const j = await jawaban(() => {
        throw galatPg(sqlstate);
      });
      expect(j).toMatchObject({ status: 409, kode: 'KONFLIK' });
      expect(j.pesan).toContain('coba lagi');
    },
  );

  it('pernyataan melewati batas waktu (57014) → 503', async () => {
    expect(
      await jawaban(() => {
        throw galatPg('57014');
      }),
    ).toMatchObject({ status: 503, kode: 'INTERNAL' });
  });

  it.each(['53100', '53200', '53300'])(
    'sumber daya server habis (%s) → 503 dengan pesan yang menyebut sebabnya',
    async (sqlstate) => {
      const j = await jawaban(() => {
        throw galatPg(sqlstate);
      });
      expect(j).toMatchObject({ status: 503, kode: 'INTERNAL' });
      expect(j.pesan).toContain('kehabisan memori');
    },
  );

  it.each(['57P01', '57P03', '08006', 'ECONNREFUSED'])(
    'database tidak siap atau koneksi putus (%s) → 503',
    async (kode) => {
      const j = await jawaban(() => {
        throw galatPg(kode);
      });
      expect(j).toMatchObject({ status: 503, kode: 'INTERNAL' });
      expect(j.pesan).toContain('Database tidak bisa dihubungi');
    },
  );

  it.each(['23514', '23503', '22003', '22001'])(
    'aturan database menolak data (%s) → 400 tanpa membocorkan detail',
    async (sqlstate) => {
      const j = await jawaban(() => {
        throw galatPg(sqlstate);
      });
      expect(j).toMatchObject({ status: 400, kode: 'VALIDASI' });
      expect(JSON.stringify(j)).not.toContain('Failed query');
    },
  );

  it('hasil hitung di luar batas angka (GalatAngka) → 400', async () => {
    const j = await jawaban(() => {
      kaliQty('99999999999', '99999999999');
      throw new Error('kaliQty seharusnya sudah melempar GalatAngka');
    });
    expect(j).toMatchObject({ status: 400, kode: 'VALIDASI' });
    expect(j.pesan).toContain('Angka terlalu besar');
  });

  it('galat lain (termasuk RangeError biasa) → 500 dengan pesan umum', async () => {
    const j = await jawaban(() => {
      throw new RangeError('Invalid array length');
    });
    expect(j).toMatchObject({ status: 500, kode: 'INTERNAL' });
    expect(j.pesan).not.toContain('Invalid array length');
  });

  it('galatKolom dan galatBaris membawa kolom untuk form', async () => {
    expect(
      await jawaban(() => {
        throw galatKolom('kode', 'Kode sudah dipakai.', 'KONFLIK');
      }),
    ).toMatchObject({
      status: 409,
      kode: 'KONFLIK',
      pesan: 'Kode sudah dipakai.',
      detail: { kolom: { kode: ['Kode sudah dipakai.'] } },
    });
    expect(
      await jawaban(() => {
        throw galatBaris(1, 'qty', 'Qty terlalu kecil.');
      }),
    ).toMatchObject({
      status: 400,
      kode: 'VALIDASI',
      pesan: 'Baris 2: Qty terlalu kecil.',
      detail: { kolom: { 'baris.1.qty': ['Qty terlalu kecil.'] } },
    });
  });
});
