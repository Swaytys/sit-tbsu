import {
  nomorAntrean,
  type DaftarOrder,
  type DetailOrder,
  type Notifikasi,
  type TiketAntrean,
} from '@sit/shared';
import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import {
  aturKonfigurasi,
  json,
  minta,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  hargaBarang,
  logAktivitas,
  orderPenjualan,
  pelanggan,
  persediaan,
  tingkatHarga,
} from '../../db/schema';
import { dengarkan } from '../../lib/siaran';
import { sekarang, tambahJam, tambahMenit } from '../../lib/waktu';
import { hitungUlangCache } from '../persediaan/ledger';
import { jalankanJobOrder } from './order/service';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string; detail?: unknown } };

let admin: Sesi;
let kasir: Sesi;
let staf: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let tier: { normal: number; grosir: number };
let plgGrosir: number;

function minta2(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  return minta(path, { method, cookie: sesi.cookie, body });
}

async function kirim<T = DetailOrder>(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta2(sesi, path, body, method);
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

async function ambil<T>(sesi: Sesi, path: string): Promise<T> {
  const r = await minta(path, { cookie: sesi.cookie });
  if (r.status !== 200) throw new Error(`GET ${path} gagal (${r.status}): ${await r.text()}`);
  return json<T>(r);
}

async function galat(r: Response | Promise<Response>) {
  const res = await r;
  return { status: res.status, ...(await json<Galat>(res)).error };
}

const order = (baris: unknown[], ubah: Record<string, unknown> = {}) => ({
  jenisPenjualan: 'LANGSUNG',
  baris,
  ...ubah,
});

async function stok(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return { fisik: p!.stokFisik, dipesan: p!.stokDipesan, tersedia: p!.stokTersedia };
}

async function logTerakhir(aksi: 'PENJUALAN_HARGA_MANUAL' | 'ORDER_LEPAS' | 'ORDER_BATAL') {
  const [log] = await db
    .select()
    .from(logAktivitas)
    .where(eq(logAktivitas.aksi, aksi))
    .orderBy(desc(logAktivitas.id))
    .limit(1);
  return log;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(pelanggan);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  staf = await sesiUji('STAF_PENJUALAN');
  const t = await db.select().from(tingkatHarga);
  tier = {
    normal: t.find((x) => x.kode === 'NORMAL')!.id,
    grosir: t.find((x) => x.kode === 'GROSIR')!.id,
  };
  const h = (idBarang: number, idTingkatHarga: number, hargaJual: number) => ({
    idBarang,
    idTingkatHarga,
    metode: 'TETAP' as const,
    hargaTetap: hargaJual,
    hargaJual,
  });
  await db
    .insert(hargaBarang)
    .values([
      h(m.semen, tier.normal, 12000),
      h(m.semen, tier.grosir, 11000),
      h(m.pasir, tier.normal, 4000),
      h(m.pasir, tier.grosir, 3800),
    ]);
  const [p] = await db
    .insert(pelanggan)
    .values({
      kode: 'PLG-90001',
      namaPelanggan: 'Toko Makmur',
      noHp: '0811',
      alamat: 'Jl. Raya 1',
      idTingkatHarga: tier.grosir,
    })
    .returning();
  plgGrosir = p!.id;
  // Stok awal: semen 10, pasir 5.
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [
      { idBarang: m.semen, qtyFisik: '10', hppSatuan: 9000 },
      { idBarang: m.pasir, qtyFisik: '5', hppSatuan: 3000 },
    ],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
});

describe('order penjualan (docs/05 §3, §6)', () => {
  it('R2/R3 draf tidak menahan stok; kirim ke antrean menahan; stok kurang ditolak menyebut semua barang', async () => {
    const d = await kirim(staf, '/api/order', order([{ idBarang: m.semen, qty: '4' }]));
    expect(d.nomor).toMatch(/^ORD-\d{6}-001$/);
    expect(d.status).toBe('DRAFT');
    expect((await stok(m.semen)).dipesan).toBe('0.000');

    const a = await kirim(staf, `/api/order/${d.id}/kirim`);
    expect(a.status).toBe('MENUNGGU');
    expect(a.waktuMasukAntrean).not.toBeNull();
    expect(await stok(m.semen)).toMatchObject({
      fisik: '10.000',
      dipesan: '4.000',
      tersedia: '6.000',
    });

    const kurang = await galat(
      minta2(
        staf,
        '/api/order?kirim=true',
        order([
          { idBarang: m.semen, qty: '7' },
          { idBarang: m.pasir, qty: '6' },
        ]),
      ),
    );
    expect(kurang.status).toBe(409);
    expect(kurang.kode).toBe('STOK_TIDAK_CUKUP');
    expect(kurang.pesan).toContain('Semen Gresik 40 kg (tersedia 6.000, diminta 7.000)');
    expect(kurang.pesan).toContain('Pasir (tersedia 5.000, diminta 6.000)');
    // Gagal seluruhnya: tidak ada order baru, reservasi tidak berubah.
    expect((await db.select().from(orderPenjualan)).length).toBe(1);
    expect((await stok(m.pasir)).dipesan).toBe('0.000');
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
  });

  it('P2/P3/P4/R4 tier bawaan pelanggan, snapshot harga, diskon, total, selisih reservasi', async () => {
    const d = await kirim(
      admin,
      '/api/order?kirim=true',
      order(
        [
          { idBarang: m.semen, qty: '2' },
          { idBarang: m.pasir, qty: '1.5', idTingkatHarga: tier.normal, diskonBaris: 100 },
        ],
        { idPelanggan: plgGrosir, ongkir: 5000, diskonTransaksiPersen: '10' },
      ),
    );
    const semen = d.baris.find((b) => b.idBarang === m.semen)!;
    const pasir = d.baris.find((b) => b.idBarang === m.pasir)!;
    expect(semen).toMatchObject({
      idTingkatHarga: tier.grosir,
      hargaSatuan: 11000,
      subtotal: 22000,
    });
    expect(pasir).toMatchObject({ hargaSatuan: 4000, diskonBaris: 100, subtotal: 5900 });
    // subtotal 27.900 − diskon 10% (2.790) + ongkir 5.000
    expect(d).toMatchObject({ subtotal: 27900, diskonTransaksi: 2790, ongkir: 5000, total: 30110 });

    // Harga master berubah; order yang sudah dibuat tetap memakai harga lama (P2).
    await db
      .update(hargaBarang)
      .set({ hargaJual: 11500, hargaTetap: 11500 })
      .where(eq(hargaBarang.idBarang, m.semen));
    const u = await kirim(
      admin,
      `/api/order/${d.id}`,
      order([{ idBarang: m.semen, qty: '3' }], { idPelanggan: plgGrosir }),
      'PUT',
    );
    expect(u.baris).toHaveLength(1);
    expect(u.baris[0]).toMatchObject({ hargaSatuan: 11000, subtotal: 33000 });
    // R4: reservasi mengikuti isi baru.
    expect((await stok(m.semen)).dipesan).toBe('3.000');
    expect((await stok(m.pasir)).dipesan).toBe('0.000');
    for (const id of [m.semen, m.pasir]) expect((await hitungUlangCache(db, id)).cocok).toBe(true);

    // R9: pengantaran wajib pelanggan dan alamat.
    const antar = await galat(
      minta2(
        admin,
        '/api/order',
        order([{ idBarang: m.semen, qty: '1' }], { jenisPenjualan: 'PENGANTARAN' }),
      ),
    );
    expect(antar.status).toBe(400);
  });

  it('P3/D2/H9 izin tier, batas diskon per peran, harga manual di bawah modal', async () => {
    // Staf: hanya tier bawaan.
    const tierLain = await galat(
      minta2(
        staf,
        '/api/order',
        order([{ idBarang: m.semen, qty: '1', idTingkatHarga: tier.normal }], {
          idPelanggan: plgGrosir,
        }),
      ),
    );
    expect(tierLain.status).toBe(403);
    const biasa = await kirim(staf, '/api/order', order([{ idBarang: m.semen, qty: '1' }]));
    expect(biasa.baris[0]).toMatchObject({ idTingkatHarga: tier.normal, hargaSatuan: 12000 });

    // Staf tidak berizin diskon; Kasir berizin tetapi batasnya 0%.
    const diskon = (n: number) => order([{ idBarang: m.semen, qty: '1', diskonBaris: n }]);
    expect((await galat(minta2(staf, '/api/order', diskon(500)))).status).toBe(403);
    const batasKasir = await galat(minta2(kasir, '/api/order', diskon(500)));
    expect(batasKasir.status).toBe(400);
    expect(batasKasir.pesan).toContain('melebihi batas peran Anda (0%)');
    await aturKonfigurasi({ batas_diskon_persen_KASIR: '5' });
    expect((await kirim(kasir, '/api/order', diskon(600))).total).toBe(11400);
    expect((await galat(minta2(kasir, '/api/order', diskon(601)))).status).toBe(400);

    // Harga manual: Kasir tidak berizin; Admin di bawah modal (9.000) wajib persetujuan.
    const manual = { idBarang: m.semen, qty: '1', hargaManual: true, hargaSatuan: 8000 };
    expect((await galat(minta2(kasir, '/api/order', order([manual])))).status).toBe(403);
    const bawah = await galat(minta2(admin, '/api/order', order([manual])));
    expect(bawah.status).toBe(409);
    expect(bawah.pesan).toContain('di bawah modal');
    const ok = await kirim(admin, '/api/order', order([manual], { setujuDiBawahModal: true }));
    expect(ok.baris[0]).toMatchObject({
      hargaManual: true,
      idTingkatHarga: null,
      hargaSatuan: 8000,
    });
    const log = await logTerakhir('PENJUALAN_HARGA_MANUAL');
    expect(log?.ringkasan).toContain('Rp 8.000');
    expect(log?.ringkasan).toContain('di bawah modal');
  });

  it('R8 kunci DIPROSES: satu kasir; lepas oleh pemegang atau paksa Admin; Staf tidak bisa memproses', async () => {
    const d = await kirim(staf, '/api/order?kirim=true', order([{ idBarang: m.semen, qty: '2' }]));
    expect((await galat(minta2(staf, `/api/order/${d.id}/proses`))).status).toBe(403);
    const p = await kirim(kasir, `/api/order/${d.id}/proses`);
    expect(p).toMatchObject({ status: 'DIPROSES', idKasirProses: kasir.pengguna.id });

    const kasir2 = await sesiUji('KASIR');
    const bentrok = await galat(minta2(kasir2, `/api/order/${d.id}/proses`));
    expect(bentrok.status).toBe(409);
    expect(bentrok.pesan).toContain(`sedang diproses oleh ${kasir.pengguna.namaPengguna}`);
    expect((await galat(minta2(kasir2, `/api/order/${d.id}/lepas`))).status).toBe(403);
    const ubahLain = await galat(
      minta2(kasir2, `/api/order/${d.id}`, order([{ idBarang: m.semen, qty: '1' }]), 'PUT'),
    );
    expect(ubahLain.status).toBe(409);
    // Pemegang kunci boleh mengubah.
    await kirim(kasir, `/api/order/${d.id}`, order([{ idBarang: m.semen, qty: '1' }]), 'PUT');
    expect((await stok(m.semen)).dipesan).toBe('1.000');

    const lepas = await kirim(admin, `/api/order/${d.id}/lepas`);
    expect(lepas).toMatchObject({ status: 'MENUNGGU', idKasirProses: null });
    expect((await logTerakhir('ORDER_LEPAS'))?.ringkasan).toContain('dilepas paksa');
  });

  it('R5 batal melepas reservasi; Staf hanya order sendiri yang belum diproses', async () => {
    const milikStaf = await kirim(
      staf,
      '/api/order?kirim=true',
      order([{ idBarang: m.semen, qty: '3' }]),
    );
    const milikKasir = await kirim(
      kasir,
      '/api/order?kirim=true',
      order([{ idBarang: m.semen, qty: '2' }]),
    );
    expect((await stok(m.semen)).dipesan).toBe('5.000');

    // Staf tidak melihat order orang lain; alasan wajib.
    expect(
      (await galat(minta2(staf, `/api/order/${milikKasir.id}/batal`, { alasan: 'salah' }))).status,
    ).toBe(404);
    expect((await galat(minta2(staf, `/api/order/${milikStaf.id}/batal`, {}))).status).toBe(400);

    await kirim(kasir, `/api/order/${milikStaf.id}/proses`);
    expect(
      (await galat(minta2(staf, `/api/order/${milikStaf.id}/batal`, { alasan: 'tidak jadi' })))
        .status,
    ).toBe(403);
    await kirim(kasir, `/api/order/${milikStaf.id}/lepas`);
    const b = await kirim(staf, `/api/order/${milikStaf.id}/batal`, { alasan: 'tidak jadi' });
    expect(b).toMatchObject({ status: 'BATAL', alasanBatal: 'tidak jadi' });
    expect((await stok(m.semen)).dipesan).toBe('2.000');

    await kirim(kasir, `/api/order/${milikKasir.id}/batal`, { alasan: 'pembeli pergi' });
    expect((await stok(m.semen)).dipesan).toBe('0.000');
    const lagi = await galat(
      minta2(kasir, `/api/order/${milikKasir.id}/batal`, { alasan: 'lagi' }),
    );
    expect(lagi.kode).toBe('STATUS_TIDAK_VALID');
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
  });

  it('daftar: Staf hanya order sendiri; antrean murni FIFO, prioritas hanya penanda (K-073)', async () => {
    const a = await kirim(staf, '/api/order?kirim=true', order([{ idBarang: m.semen, qty: '1' }]));
    const b = await kirim(kasir, '/api/order?kirim=true', order([{ idBarang: m.semen, qty: '1' }]));
    const c = await kirim(
      kasir,
      '/api/order?kirim=true',
      order([{ idBarang: m.pasir, qty: '1' }], { prioritas: 'TINGGI' }),
    );
    const punyaStaf = await ambil<DaftarOrder>(staf, '/api/order');
    expect(punyaStaf.data.map((o) => o.id)).toEqual([a.id]);
    expect((await galat(minta(`/api/order/${b.id}`, { cookie: staf.cookie }))).status).toBe(404);
    const antrean = await ambil<DaftarOrder>(kasir, '/api/order?status=AKTIF');
    expect(antrean.data.map((o) => o.id)).toEqual([a.id, b.id, c.id]);
    expect(antrean.data[2]).toMatchObject({ prioritas: 'TINGGI', noAntrean: 3 });
    expect(antrean.data[0]?.ringkasan).toEqual([
      { namaBarang: 'Semen Gresik 40 kg', qty: '1.000', kodeSatuan: 'sak' },
    ]);
  });

  it('K-073 papan antrean: per jenis, FIFO, isi barang terbaca, DIPROSES menyebut kasir; siaran tiap perubahan', async () => {
    let siaran = 0;
    const berhenti = dengarkan('antrean', () => {
      siaran += 1;
    });
    try {
      const draf = await kirim(staf, '/api/order', order([{ idBarang: m.semen, qty: '1' }]));
      expect(siaran).toBe(0); // draf belum masuk antrean
      const a = await kirim(
        staf,
        '/api/order?kirim=true',
        order([
          { idBarang: m.semen, qty: '2' },
          { idBarang: m.pasir, qty: '0.5' },
        ]),
      );
      const antar = await kirim(
        staf,
        '/api/order?kirim=true',
        order([{ idBarang: m.pasir, qty: '1' }], {
          jenisPenjualan: 'PENGANTARAN',
          idPelanggan: plgGrosir,
          alamatKirim: 'Jl. Raya 1',
        }),
      );
      await kirim(kasir, `/api/order/${a.id}/proses`);
      expect(siaran).toBe(3);

      const papan = await ambil<{ data: TiketAntrean[] }>(
        kasir,
        '/api/order/antrean?jenis=LANGSUNG',
      );
      expect(papan.data.map((t) => t.id)).toEqual([a.id]);
      expect(papan.data[0]).toMatchObject({
        noAntrean: nomorAntrean(a.nomor),
        status: 'DIPROSES',
        namaKasirProses: kasir.pengguna.namaPengguna,
        total: 26000,
        ringkasan: [
          { namaBarang: 'Semen Gresik 40 kg', qty: '2.000', kodeSatuan: 'sak' },
          { namaBarang: 'Pasir', qty: '0.500', kodeSatuan: 'sak' },
        ],
      });
      const papanAntar = await ambil<{ data: TiketAntrean[] }>(
        kasir,
        '/api/order/antrean?jenis=PENGANTARAN',
      );
      expect(papanAntar.data.map((t) => [t.id, t.alamatKirim])).toEqual([[antar.id, 'Jl. Raya 1']]);
      expect(papanAntar.data.some((t) => t.id === draf.id)).toBe(false);
      expect(
        (await galat(minta('/api/order/antrean?jenis=LANGSUNG', { cookie: staf.cookie }))).status,
      ).toBe(403);
    } finally {
      berhenti();
    }
  });

  it('R7/R8 order basi ditandai, notifikasi, stok tertahan, auto-batal opsional; kunci kadaluarsa dilepas', async () => {
    const basi = await kirim(
      staf,
      '/api/order?kirim=true',
      order([{ idBarang: m.semen, qty: '2' }]),
    );
    const dikunci = await kirim(
      staf,
      '/api/order?kirim=true',
      order([{ idBarang: m.pasir, qty: '1' }]),
    );
    await kirim(kasir, `/api/order/${dikunci.id}/proses`);
    await db
      .update(orderPenjualan)
      .set({ waktuMasukAntrean: tambahJam(sekarang(), -25) })
      .where(eq(orderPenjualan.id, basi.id));
    await db
      .update(orderPenjualan)
      .set({ diubahPada: tambahMenit(sekarang(), -31) })
      .where(eq(orderPenjualan.id, dikunci.id));

    expect((await ambil<{ data: DetailOrder }>(kasir, `/api/order/${basi.id}`)).data.basi).toBe(
      true,
    );
    const notif = await ambil<{ data: Notifikasi[] }>(kasir, '/api/notifikasi');
    expect(notif.data.find((n) => n.jenis === 'ORDER_BASI')?.jumlah).toBe(1);
    const tertahan = await ambil<{ data: { idBarang: number; order: { basi: boolean }[] }[] }>(
      admin,
      '/api/stok/tertahan',
    );
    expect(tertahan.data.find((t) => t.idBarang === m.semen)?.order[0]?.basi).toBe(true);

    // Auto-batal mati (bawaan): order basi tetap; kunci kadaluarsa tetap dilepas.
    let hasil = await jalankanJobOrder();
    expect(hasil).toEqual({ dibatalkan: [], dilepas: [dikunci.nomor] });
    await aturKonfigurasi({ auto_batal_order_basi: 'true' });
    hasil = await jalankanJobOrder();
    expect(hasil.dibatalkan).toEqual([basi.nomor]);
    const [o] = await db.select().from(orderPenjualan).where(eq(orderPenjualan.id, basi.id));
    expect(o).toMatchObject({ status: 'BATAL', alasanBatal: 'KADALUARSA' });
    expect((await stok(m.semen)).dipesan).toBe('0.000');
    expect(await logTerakhir('ORDER_BATAL')).toMatchObject({ idPengguna: null });
  });
});
