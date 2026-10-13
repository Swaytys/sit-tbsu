import type {
  DaftarNonTunai,
  DetailPenjualan,
  Notifikasi,
  PembayaranPenjualan,
  RekeningToko,
} from '@sit/shared';
import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { hargaBarang, logAktivitas, rekeningToko, shiftKasir } from '../../db/schema';

/*
 * Rekening toko dan pengecekan uang masuk non-tunai (docs/05 §10 K12–K14, K-111).
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = {
  error: { kode: string; pesan: string; detail?: { kolom?: Record<string, string[]> } };
};

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });

async function data<T>(r: Response | Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}

async function galat(r: Response | Promise<Response>) {
  const res = await r;
  return { status: res.status, ...(await json<Galat>(res)).error };
}

const ambil = <T>(sesi: Sesi, path: string) => data<T>(minta(path, { cookie: sesi.cookie }));

const rekening = (ubah: Record<string, unknown> = {}) => ({
  jenis: 'TRANSFER',
  bank: 'BCA',
  nomor: '1234567890',
  atasNama: 'Sumber Urip',
  ...ubah,
});

function jual(pembayaran: Record<string, unknown>[], qty = '1') {
  return data<DetailPenjualan>(
    kirim(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty }] },
      pembayaran,
    }),
  );
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(rekeningToko, shiftKasir);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  const idTier = await siapkanTierNormal();
  await db.insert(hargaBarang).values({
    idBarang: m.semen,
    idTingkatHarga: idTier,
    metode: 'TETAP',
    hargaTetap: 10000,
    hargaJual: 10000,
  });
  const sa = await data<{ id: number }>(
    kirim(admin, '/api/penyesuaian', {
      jenis: 'SALDO_AWAL',
      baris: [{ idBarang: m.semen, qtyFisik: '50', hppSatuan: 8000 }],
    }),
  );
  await data(kirim(admin, `/api/penyesuaian/${sa.id}/selesai`));
  await data(kirim(kasir, '/api/shift/buka', { modalAwal: 0 }));
});

describe('rekening toko (K-111)', () => {
  it('K12 Admin mendaftarkan rekening; label otomatis; satu bawaan per jenis; kembar ditolak; nonaktif bukan hapus', async () => {
    const bca = await data<RekeningToko>(
      kirim(admin, '/api/rekening', rekening({ isDefault: true })),
    );
    expect(bca).toMatchObject({
      jenis: 'TRANSFER',
      nama: 'BCA 1234567890 a.n. Sumber Urip',
      isDefault: true,
      statusAktif: 'AKTIF',
    });
    // Bawaan baru untuk jenis yang sama menggantikan bawaan lama.
    const bri = await data<RekeningToko>(
      kirim(admin, '/api/rekening', rekening({ bank: 'BRI', nomor: '999', isDefault: true })),
    );
    const edc = await data<RekeningToko>(
      kirim(
        admin,
        '/api/rekening',
        rekening({ jenis: 'EDC', bank: 'EDC BRI', nomor: null, atasNama: null, isDefault: true }),
      ),
    );
    expect(edc.nama).toBe('EDC BRI');
    let daftar = await ambil<RekeningToko[]>(kasir, '/api/rekening');
    expect(daftar.map((r) => [r.nama, r.isDefault])).toEqual([
      ['EDC BRI', true],
      ['BCA 1234567890 a.n. Sumber Urip', false],
      ['BRI 999 a.n. Sumber Urip', true],
    ]);
    expect((await galat(kirim(admin, '/api/rekening', rekening()))).status).toBe(400);

    // Kasir hanya membaca; Staf Penjualan (tidak mencatat pembayaran) tidak punya aksesnya.
    expect((await kirim(kasir, '/api/rekening', rekening({ bank: 'Mandiri' }))).status).toBe(403);
    const staf = await sesiUji('STAF_PENJUALAN');
    expect((await minta('/api/rekening', { cookie: staf.cookie })).status).toBe(403);

    // Nonaktif: hilang dari pilihan kasir, tetap ada untuk pengelola, dan tercatat di log.
    await data(
      kirim(admin, `/api/rekening/${bri.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH'),
    );
    daftar = await ambil<RekeningToko[]>(kasir, '/api/rekening?status=SEMUA');
    expect(daftar.map((r) => r.id)).toEqual([edc.id, bca.id]);
    expect(await ambil<RekeningToko[]>(admin, '/api/rekening?status=SEMUA')).toHaveLength(3);
    expect(await db.select().from(rekeningToko)).toHaveLength(3);
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'REKENING_NONAKTIF'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.idEntitas).toBe(bri.id);
  });

  it('K13 pembayaran non-tunai memakai rekening toko yang sejenis dan mulai dari BELUM_DICEK; tunai tanpa status', async () => {
    const bca = await data<RekeningToko>(kirim(admin, '/api/rekening', rekening()));
    const qris = await data<RekeningToko>(
      kirim(admin, '/api/rekening', rekening({ jenis: 'QRIS', bank: 'QRIS BCA', nomor: null })),
    );

    const pj = await jual([{ metode: 'TRANSFER', idRekening: bca.id, referensi: 'TRX-1' }]);
    expect(pj.pembayaran[0]).toMatchObject({
      metode: 'TRANSFER',
      rekening: 'BCA 1234567890 a.n. Sumber Urip',
      referensi: 'TRX-1',
      statusVerifikasi: 'BELUM_DICEK',
    });
    // Metode QRIS dengan rekening QRIS.
    const pq = await jual([{ metode: 'QRIS', idRekening: qris.id }]);
    expect(pq.pembayaran[0]).toMatchObject({
      metode: 'QRIS',
      rekening: 'QRIS BCA a.n. Sumber Urip',
    });
    // Rekening jenis lain, atau tanpa rekening sama sekali, ditolak.
    const salah = await galat(
      kirim(kasir, '/api/penjualan/checkout', {
        order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
        pembayaran: [{ metode: 'EDC', idRekening: bca.id }],
      }),
    );
    expect(salah.status).toBe(400);
    expect(salah.detail?.kolom?.['pembayaran.0.rekening']).toBeDefined();
    const kosong = await galat(
      kirim(kasir, '/api/penjualan/checkout', {
        order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
        pembayaran: [{ metode: 'TRANSFER' }],
      }),
    );
    expect(kosong.status).toBe(400);

    // Campuran: bagian tunai tidak punya status pengecekan.
    const campur = await jual(
      [
        { metode: 'TRANSFER', idRekening: bca.id, nominal: 15000 },
        { metode: 'TUNAI', uangDiterima: 5000 },
      ],
      '2',
    );
    expect(campur.pembayaran.map((p: PembayaranPenjualan) => p.statusVerifikasi)).toEqual([
      'BELUM_DICEK',
      null,
    ]);
  });

  it('K14 Admin mengecek uang masuk: daftar dan total per rekening, tidak masuk wajib catatan, notifikasi, log; Kasir ditolak', async () => {
    const bca = await data<RekeningToko>(kirim(admin, '/api/rekening', rekening()));
    const a = await jual([{ metode: 'TRANSFER', idRekening: bca.id }]);
    const b = await jual([{ metode: 'TRANSFER', idRekening: bca.id }], '2');
    await jual([{ metode: 'TUNAI', uangDiterima: 10000 }]);

    expect((await minta('/api/pembayaran-nontunai', { cookie: kasir.cookie })).status).toBe(403);
    const daftar = await json<DaftarNonTunai>(
      await minta('/api/pembayaran-nontunai?status=BELUM_DICEK', { cookie: admin.cookie }),
    );
    // Hanya non-tunai; total per rekening = angka yang dicocokkan dengan mutasi.
    expect(daftar.data.map((p) => p.nomorPenjualan)).toEqual([b.nomor, a.nomor]);
    expect(daftar.ringkasan).toEqual([
      { rekening: 'BCA 1234567890 a.n. Sumber Urip', jumlah: 2, total: 30000 },
    ]);

    const idA = daftar.data.find((p) => p.idPenjualan === a.id)!.id;
    const idB = daftar.data.find((p) => p.idPenjualan === b.id)!.id;
    const cek = (id: number, body: unknown, sesi = admin) =>
      kirim(sesi, `/api/pembayaran-nontunai/${id}/verifikasi`, body);
    expect((await cek(idA, { status: 'SUDAH_MASUK' }, kasir)).status).toBe(403);
    expect((await galat(cek(idB, { status: 'TIDAK_MASUK' }))).status).toBe(400);

    await data(cek(idA, { status: 'SUDAH_MASUK' }));
    const tidak = await data<{ statusVerifikasi: string; namaPemeriksa: string }>(
      cek(idB, { status: 'TIDAK_MASUK', catatan: 'Tidak ada di mutasi BCA' }),
    );
    expect(tidak).toMatchObject({
      statusVerifikasi: 'TIDAK_MASUK',
      namaPemeriksa: admin.pengguna.namaPengguna,
    });
    // Penandaan tidak mengubah tagihan penjualan; statusnya tampil di rincian penjualan.
    const detail = await ambil<DetailPenjualan>(admin, `/api/penjualan/${b.id}`);
    expect(detail).toMatchObject({ statusPembayaran: 'LUNAS', sisaTagihan: 0 });
    expect(detail.pembayaran[0]).toMatchObject({
      statusVerifikasi: 'TIDAK_MASUK',
      catatanVerifikasi: 'Tidak ada di mutasi BCA',
    });

    const notif = await ambil<Notifikasi[]>(admin, '/api/notifikasi');
    expect(notif.find((n) => n.jenis === 'NONTUNAI_TIDAK_MASUK')?.jumlah).toBe(1);
    expect(notif.some((n) => n.jenis === 'NONTUNAI_BELUM_DICEK')).toBe(false);
    expect(
      (await ambil<Notifikasi[]>(kasir, '/api/notifikasi')).some((n) =>
        n.jenis.startsWith('NONTUNAI'),
      ),
    ).toBe(false);

    // Ternyata masuk belakangan: status boleh diperbaiki; tiap perubahan tercatat di log.
    await data(
      cek(idB, { status: 'SUDAH_MASUK', catatan: 'Masuk 13/10 setelah pembeli transfer ulang' }),
    );
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PEMBAYARAN_VERIFIKASI'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('sudah masuk');
    expect(log?.dataLama).toMatchObject({ statusVerifikasi: 'TIDAK_MASUK' });
    // Pembayaran tunai bukan objek pengecekan.
    expect((await galat(cek(999_999, { status: 'SUDAH_MASUK' }))).status).toBe(404);
  });
});
