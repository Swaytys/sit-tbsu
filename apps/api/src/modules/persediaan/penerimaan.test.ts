import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { db } from '../../db/client';
import {
  logAktivitas,
  mutasiPersediaan,
  pembayaranPemasok,
  penerimaanBarang,
  persediaan,
} from '../../db/schema';
import { tanggalOperasional } from '../../lib/waktu';
import { hitungUlangCache } from './ledger';

type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};
type Detail = Record<string, unknown> & {
  id: number;
  nomor: string;
  baris: Record<string, unknown>[];
  pembayaran: Record<string, unknown>[];
};
type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
const hariIni = tanggalOperasional();

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  admin = await sesiUji('ADMIN');
});

const simpan = (body: unknown, sesi = admin) =>
  minta('/api/penerimaan', { method: 'POST', cookie: sesi.cookie, body });

async function berhasil(body: unknown): Promise<Detail> {
  const res = await simpan(body);
  if (res.status !== 201) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: Detail }>(res)).data;
}

const beli = (ubah: Record<string, unknown> = {}) => ({
  idPemasok: m.pemasokA,
  jenis: 'PEMBELIAN',
  syaratBayar: 'TUNAI',
  noFakturPemasok: 'F-001',
  baris: [
    { idBarang: m.semen, qtyMasuk: '10', hargaModalMasuk: 10000 },
    { idBarang: m.pasir, qtyMasuk: '2,5', hargaModalMasuk: 3333 },
  ],
  ...ubah,
});

async function stok(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return p!;
}

describe('penerimaan barang (docs/05 §11)', () => {
  it('hanya Admin/Owner; tidak ada ubah atau hapus (E5)', async () => {
    const kasir = await sesiUji('KASIR');
    expect((await simpan(beli(), kasir)).status).toBe(403);
    expect((await minta('/api/penerimaan', { cookie: kasir.cookie })).status).toBe(403);
    const p = await berhasil(beli());
    for (const method of ['PATCH', 'DELETE']) {
      const res = await minta(`/api/penerimaan/${p.id}`, {
        method,
        cookie: admin.cookie,
        body: {},
      });
      expect(res.status).toBe(404);
    }
  });

  it('E1/E2/E4 pembelian tunai: nomor RCV, subtotal dibulatkan, stok dan HPP lewat ledger, lunas', async () => {
    const p = await berhasil(beli());
    expect(p.nomor).toBe(`RCV-${hariIni.slice(2).replaceAll('-', '')}-001`);
    expect(p).toMatchObject({
      jenis: 'PEMBELIAN',
      syaratBayar: 'TUNAI',
      totalFaktur: 108333, // 100.000 + bulat(2,5 × 3.333 = 8.332,5)
      totalDibayar: 108333,
      sisaHutang: 0,
      statusHutang: 'LUNAS',
    });
    expect(p.baris.map((b) => b.subtotal)).toEqual([100000, 8333]);
    expect(p.pembayaran).toMatchObject([{ nominal: 108333, metode: 'TRANSFER' }]);

    expect(await stok(m.semen)).toMatchObject({
      stokFisik: '10.000',
      hppRata2: 10000,
      hargaBeliTerakhir: 10000,
      tanggalBeliTerakhir: hariIni,
    });
    const mutasi = await db.select().from(mutasiPersediaan);
    expect(mutasi.map((x) => x.jenisMutasi)).toEqual(['PENERIMAAN', 'PENERIMAAN']);
    expect(mutasi[0]?.keterangan).toBe(`Terima dari CV. Semen Jaya (${p.nomor})`);
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENERIMAAN_SIMPAN'));
    expect(log).toMatchObject({ nomorDokumen: p.nomor, idEntitas: p.id });
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
  });

  it('E4 pembelian tempo: jatuh tempo wajib dan tidak sebelum hari ini; hutang belum lunas', async () => {
    let res = await simpan(beli({ syaratBayar: 'TEMPO' }));
    expect((await json<Galat>(res)).error.detail?.kolom?.tanggalJatuhTempo).toBeDefined();
    res = await simpan(beli({ syaratBayar: 'TEMPO', tanggalJatuhTempo: '2000-01-01' }));
    expect(res.status).toBe(400);

    const p = await berhasil(beli({ syaratBayar: 'TEMPO', tanggalJatuhTempo: '2099-12-31' }));
    expect(p).toMatchObject({ statusHutang: 'BELUM_LUNAS', sisaHutang: 108333, totalDibayar: 0 });
    expect(p.pembayaran).toHaveLength(0);
    expect(await db.select().from(pembayaranPemasok)).toHaveLength(0);
  });

  it('E2/E3 barang konsinyasi hanya lewat jenis konsinyasi dari pemasok penitipnya; harga = harga titip', async () => {
    let res = await simpan(
      beli({ baris: [{ idBarang: m.titip, qtyMasuk: '1', hargaModalMasuk: 1 }] }),
    );
    expect((await json<Galat>(res)).error.detail?.kolom?.['baris.0.idBarang']?.[0]).toContain(
      'barang konsinyasi',
    );

    const titip = {
      idPemasok: m.pemasokA,
      jenis: 'KONSINYASI',
      baris: [{ idBarang: m.titip, qtyMasuk: '4', hargaModalMasuk: 1 }],
    };
    const p = await berhasil(titip);
    expect(p).toMatchObject({ totalFaktur: 0, statusHutang: 'TIDAK_ADA', syaratBayar: null });
    expect(p.baris[0]).toMatchObject({ hargaModalMasuk: 30000, subtotal: 120000 });
    expect(await stok(m.titip)).toMatchObject({
      stokFisik: '4.000',
      hppRata2: 30000,
      hargaBeliTerakhir: 0,
    });

    res = await simpan({ ...titip, idPemasok: m.pemasokB });
    expect((await json<Galat>(res)).error.pesan).toContain('bukan barang titipan UD. Cat Murni');
    res = await simpan({
      ...titip,
      baris: [{ idBarang: m.semen, qtyMasuk: '1', hargaModalMasuk: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('E1 pemasok/barang nonaktif, qty 0, barang ganda ditolak; gagal satu baris = tidak ada yang tersimpan', async () => {
    expect((await simpan(beli({ idPemasok: m.pemasokMati }))).status).toBe(400);
    const res = await simpan(
      beli({
        baris: [
          { idBarang: m.semen, qtyMasuk: '5', hargaModalMasuk: 10000 },
          { idBarang: m.mati, qtyMasuk: '1', hargaModalMasuk: 1 },
        ],
      }),
    );
    expect((await json<Galat>(res)).error.pesan).toContain('Baris 2: Barang lama nonaktif.');
    const qtyNol = await simpan(
      beli({ baris: [{ idBarang: m.semen, qtyMasuk: '0', hargaModalMasuk: 1 }] }),
    );
    expect((await json<Galat>(qtyNol)).error.detail?.kolom?.baris).toBeDefined();
    const ganda = await simpan(
      beli({
        baris: [
          { idBarang: m.semen, qtyMasuk: '1', hargaModalMasuk: 1 },
          { idBarang: m.semen, qtyMasuk: '1', hargaModalMasuk: 2 },
        ],
      }),
    );
    expect(ganda.status).toBe(400);

    expect((await stok(m.semen)).stokFisik).toBe('0.000');
    expect(await db.select().from(penerimaanBarang)).toHaveLength(0);
  });

  it('E6 riwayat: cari nomor/pemasok, saring jenis; detail lengkap', async () => {
    const a = await berhasil(beli());
    await berhasil({
      idPemasok: m.pemasokA,
      jenis: 'KONSINYASI',
      baris: [{ idBarang: m.titip, qtyMasuk: '1', hargaModalMasuk: 0 }],
    });
    const cari = async (q: string) =>
      json<{ data: Record<string, unknown>[]; meta: { total: number } }>(
        await minta(`/api/penerimaan?${q}`, { cookie: admin.cookie }),
      );
    expect((await cari('')).meta.total).toBe(2);
    expect((await cari('jenis=KONSINYASI')).meta.total).toBe(1);
    expect((await cari(`cari=${a.nomor}`)).data[0]).toMatchObject({
      nomor: a.nomor,
      jumlahBaris: 2,
    });
    expect((await cari('cari=semen jaya')).meta.total).toBe(2);
    const detail = await json<{ data: Detail }>(
      await minta(`/api/penerimaan/${a.id}`, { cookie: admin.cookie }),
    );
    expect(detail.data.baris[1]).toMatchObject({
      namaBarang: 'Pasir',
      qtyMasuk: '2.500',
      kodeSatuan: 'sak',
    });
  });
});
