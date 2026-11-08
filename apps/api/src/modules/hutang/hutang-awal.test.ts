import type { BarisHutang } from '@sit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';

/* K-241: hutang awal pemasok (bagian Persediaan Awal). */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let kepala: Sesi;

const kirim = (sesi: Sesi, path: string, body?: unknown) =>
  minta(path, { method: 'POST', cookie: sesi.cookie, body });
async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  kepala = await sesiUji('ADMIN');
});

describe('hutang awal pemasok (K-241)', () => {
  it('dicatat tanpa stok, tampil di Hutang Pemasok, dibayar seperti hutang lain; faktur ganda ditolak', async () => {
    const kasir = await sesiUji('KASIR');
    const isi = {
      idPemasok: m.pemasokA,
      noFakturLama: 'F-LAMA-01',
      sisa: 750_000,
      tanggalJatuhTempo: tambahHari(tanggalOperasional(), -3),
    };
    expect((await kirim(kasir, '/api/hutang/awal', isi)).status).toBe(403);
    const h = await data<{ id: number; nomor: string }>(kirim(kepala, '/api/hutang/awal', isi));
    expect(h.nomor).toMatch(/^HAW-/);
    const ganda = await kirim(kepala, '/api/hutang/awal', isi);
    expect(ganda.status).toBe(400);

    const daftar = await data<BarisHutang[]>(
      minta('/api/hutang?perHalaman=100', { cookie: kepala.cookie }),
    );
    const baris = daftar.find((x) => x.jenis === 'HUTANG_AWAL' && x.id === h.id);
    expect(baris).toMatchObject({ sisa: 750_000, noFaktur: 'F-LAMA-01', hariLewat: 3 });

    await data(
      kirim(kepala, '/api/hutang/bayar', {
        jenis: 'HUTANG_AWAL',
        id: h.id,
        nominal: 250_000,
        metode: 'TRANSFER',
        rekening: 'BCA 1',
        referensi: 'TRF-HAW1',
      }),
    );
    const bayar2 = await data<{ statusHutang: string; sisa: number }>(
      kirim(kepala, '/api/hutang/bayar', {
        jenis: 'HUTANG_AWAL',
        id: h.id,
        nominal: 500_000,
        metode: 'TRANSFER',
        rekening: 'BCA 1',
        referensi: 'TRF-HAW2',
      }),
    );
    expect(bayar2).toMatchObject({ statusHutang: 'LUNAS', sisa: 0 });
    const riwayat = await data<{ nominal: number }[]>(
      minta(`/api/hutang/HUTANG_AWAL/${h.id}/pembayaran`, { cookie: kepala.cookie }),
    );
    expect(riwayat.map((r) => r.nominal)).toEqual([250_000, 500_000]);
  });
});
