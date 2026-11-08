import type { DetailPenyesuaian, RingkasanOpname } from '@sit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';

/* K-240/K-227: Stok Opname bertahap (kelas ABC, daftar hitung harian acak, selisih disetujui). */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let kepala: Sesi;
let persediaanSesi: Sesi;

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });
async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  kepala = await sesiUji('ADMIN');
  persediaanSesi = await sesiUji('ADMIN_PERSEDIAAN');
});

describe('stok opname bertahap (K-240)', () => {
  it('ringkasan kelas ABC; daftar harian hanya Kepala Toko/Owner; selisih wajib sebab dan disetujui', async () => {
    const r = await data<RingkasanOpname>(
      minta('/api/opname/ringkasan', { cookie: persediaanSesi.cookie }),
    );
    const total = r.kelas.reduce((t, k) => t + k.jumlah, 0);
    expect(total).toBeGreaterThan(0);
    // Belum pernah diopname: semua jatuh tempo.
    expect(r.kelas.reduce((t, k) => t + k.jatuhTempo, 0)).toBe(total);
    expect(r.akurasi30Hari).toBeNull();

    expect((await kirim(persediaanSesi, '/api/opname/daftar-harian', { jumlah: 2 })).status).toBe(
      403,
    );
    const d = await data<DetailPenyesuaian>(
      kirim(kepala, '/api/opname/daftar-harian', { jumlah: 2 }),
    );
    expect(d.jenis).toBe('OPNAME');
    expect(d.baris).toHaveLength(2);
    expect(new Set(d.baris.map((b) => b.idBarang)).size).toBe(2);

    // Penghitung mengisi hasil hitung (berselisih) lalu mencoba menyelesaikan sendiri.
    const isi = d.baris.map((b) => ({
      idBarang: b.idBarang,
      qtyFisik: '5',
      qtySelisih: null,
      hppSatuan: null,
      keterangan: null,
      dikecualikan: false,
      alasanKecuali: null,
    }));
    await data(
      kirim(persediaanSesi, `/api/penyesuaian/${d.id}`, { jenis: 'OPNAME', baris: isi }, 'PUT'),
    );
    expect((await kirim(persediaanSesi, `/api/penyesuaian/${d.id}/selesai`)).status).toBe(403);
    const tanpaSebab = await kirim(kepala, `/api/penyesuaian/${d.id}/selesai`);
    expect(tanpaSebab.status).toBe(400);
    await data(
      kirim(
        kepala,
        `/api/penyesuaian/${d.id}`,
        { jenis: 'OPNAME', baris: isi.map((b) => ({ ...b, keterangan: 'Belum tercatat' })) },
        'PUT',
      ),
    );
    await data(kirim(kepala, `/api/penyesuaian/${d.id}/selesai`));
    const r2 = await data<RingkasanOpname>(
      minta('/api/opname/ringkasan', { cookie: kepala.cookie }),
    );
    expect(r2.barisDihitung30Hari).toBe(2);
    expect(r2.kelas.reduce((t, k) => t + k.jatuhTempo, 0)).toBe(total - 2);
    void m;
  });
});
