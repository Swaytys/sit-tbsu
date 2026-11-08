import type { DetailOrder, DetailPenjualan } from '@sit/shared';
import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import {
  aturKonfigurasi,
  json,
  minta,
  rekeningUji,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  hargaBarang,
  logAktivitas,
  mutasiPersediaan,
  orderPenjualan,
  pelanggan,
  persediaan,
  shiftKasir,
} from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { hitungUlangCache } from '../persediaan/ledger';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let staf: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let plg: number;
let tierNormal: number;

function minta2(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  return minta(path, { method, cookie: sesi.cookie, body });
}

async function kirim<T = DetailPenjualan>(
  sesi: Sesi,
  path: string,
  body?: unknown,
  method = 'POST',
) {
  const r = await minta2(sesi, path, body, method);
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

async function galat(r: Response | Promise<Response>) {
  const res = await r;
  return { status: res.status, ...(await json<Galat>(res)).error };
}

const keranjang = (baris: unknown[], ubah: Record<string, unknown> = {}) => ({
  jenisPenjualan: 'LANGSUNG',
  baris,
  ...ubah,
});
const tunai = (nominal: number, uangDiterima?: number) => ({
  metode: 'TUNAI',
  nominal,
  uangDiterima,
});

async function stok(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return { fisik: p!.stokFisik, dipesan: p!.stokDipesan };
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(pelanggan, shiftKasir);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  staf = await sesiUji('STAF_PENJUALAN');
  tierNormal = await siapkanTierNormal();
  await db.insert(hargaBarang).values([
    {
      idBarang: m.semen,
      idTingkatHarga: tierNormal,
      metode: 'TETAP',
      hargaTetap: 12000,
      hargaJual: 12000,
    },
    {
      idBarang: m.pasir,
      idTingkatHarga: tierNormal,
      metode: 'TETAP',
      hargaTetap: 4000,
      hargaJual: 4000,
    },
    {
      idBarang: m.titip,
      idTingkatHarga: tierNormal,
      metode: 'TETAP',
      hargaTetap: 40000,
      hargaJual: 40000,
    },
  ]);
  const [p] = await db
    .insert(pelanggan)
    .values({ kode: 'PLG-90001', namaPelanggan: 'CV. Bangun', noHp: '0811', alamat: 'Jl. A 1' })
    .returning();
  plg = p!.id;
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [
      { idBarang: m.semen, qtyFisik: '10', hppSatuan: 9000 },
      { idBarang: m.pasir, qtyFisik: '5', hppSatuan: 3000 },
      { idBarang: m.titip, qtyFisik: '2', hppSatuan: 30000 },
    ],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
});

describe('checkout dan pembayaran (docs/05 §6)', () => {
  it('P1/R6/P5/P8 checkout langsung pembeli umum: stok terpotong, HPP snapshot, kembalian, order tersimpan', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 100000 });
    const pj = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([
        { idBarang: m.semen, qty: '2' },
        { idBarang: m.titip, qty: '1' },
      ]),
      pembayaran: [tunai(64000, 100000)],
    });
    expect(pj.nomor).toMatch(/^STR-\d{6}-001$/);
    expect(pj).toMatchObject({
      totalNeto: 64000,
      totalDibayar: 64000,
      sisaTagihan: 0,
      statusPembayaran: 'LUNAS',
      statusPengambilan: 'DIAMBIL',
      tanggalJatuhTempo: null,
    });
    expect(pj.nomorShift).toMatch(/^SHF-/);
    expect(pj.pembayaran[0]).toMatchObject({
      jenis: 'PENUH',
      metode: 'TUNAI',
      nominal: 64000,
      uangDiterima: 100000,
      kembalian: 36000,
    });
    // Kasir tidak menerima HPP; Admin menerima (P5: milik sendiri 9.000, konsinyasi = harga titip).
    expect(pj.baris[0]).not.toHaveProperty('hppSaatTransaksi');
    const lengkap = (
      await json<{ data: DetailPenjualan }>(
        await minta(`/api/penjualan/${pj.id}`, { cookie: admin.cookie }),
      )
    ).data;
    expect(lengkap.baris.map((b) => b.hppSaatTransaksi)).toEqual([9000, 30000]);

    expect(await stok(m.semen)).toEqual({ fisik: '8.000', dipesan: '0.000' });
    expect(await stok(m.titip)).toEqual({ fisik: '1.000', dipesan: '0.000' });
    const [o] = await db.select().from(orderPenjualan).where(eq(orderPenjualan.id, pj.idOrder!));
    expect(o).toMatchObject({ status: 'SELESAI', idPenjualan: pj.id });
    const mutasi = await db
      .select()
      .from(mutasiPersediaan)
      .where(eq(mutasiPersediaan.jenisMutasi, 'PENJUALAN'));
    expect(mutasi).toHaveLength(2);
    for (const id of [m.semen, m.titip]) expect((await hitungUlangCache(db, id)).cocok).toBe(true);
  });

  it('P12 tunai wajib shift; non-tunai tanpa shift hanya Admin/Owner; P6 pembeli umum wajib lunas; P8 lebih bayar ditolak', async () => {
    const isi = keranjang([{ idBarang: m.semen, qty: '1' }]);
    const tanpaShift = await galat(
      minta2(kasir, '/api/penjualan/checkout', { order: isi, pembayaran: [tunai(12000)] }),
    );
    expect(tanpaShift.status).toBe(409);
    expect(tanpaShift.pesan).toContain('Buka shift');
    const transferKasir = await galat(
      minta2(kasir, '/api/penjualan/checkout', {
        order: isi,
        pembayaran: [
          {
            metode: 'TRANSFER',
            nominal: 12000,
            idRekening: await rekeningUji('TRANSFER'),
            referensi: 'REF-0001',
          },
        ],
      }),
    );
    expect(transferKasir.status).toBe(409);
    const transferAdmin = await kirim(admin, '/api/penjualan/checkout', {
      order: isi,
      pembayaran: [
        {
          metode: 'TRANSFER',
          nominal: 12000,
          idRekening: await rekeningUji('TRANSFER'),
          referensi: 'TRX9',
        },
      ],
    });
    expect(transferAdmin.pembayaran[0]).toMatchObject({ metode: 'TRANSFER', referensi: 'TRX9' });
    expect(transferAdmin.nomorShift).toBeNull();

    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const kurang = await galat(
      minta2(kasir, '/api/penjualan/checkout', { order: isi, pembayaran: [tunai(10000)] }),
    );
    expect(kurang.status).toBe(400);
    expect(kurang.pesan).toContain('Pembeli umum wajib lunas');
    const lebih = await galat(
      minta2(kasir, '/api/penjualan/checkout', { order: isi, pembayaran: [tunai(13000)] }),
    );
    expect(lebih.kode).toBe('LIMIT_TERLAMPAUI');
    // Gagal = tidak ada efek (stok tetap setelah satu penjualan Admin).
    expect(await stok(m.semen)).toEqual({ fisik: '9.000', dipesan: '0.000' });
    expect((await galat(minta2(staf, '/api/penjualan/checkout', { order: isi }))).status).toBe(403);
  });

  it('K-244 di jam operasional tanpa shift semua checkout ditolak; di luar jam non-tunai boleh', async () => {
    const isi = keranjang([{ idBarang: m.semen, qty: '1' }]);
    const transfer = async () => ({
      order: isi,
      pembayaran: [
        {
          metode: 'TRANSFER',
          nominal: 12000,
          idRekening: await rekeningUji('TRANSFER'),
          referensi: 'TRX-K244',
        },
      ],
    });
    // Jam operasional sepanjang hari: Admin pun ditolak walau bayar transfer.
    await aturKonfigurasi({ shift_jam_buka: '00:00', shift_jam_tutup: '24:00' });
    const ditolak = await galat(minta2(admin, '/api/penjualan/checkout', await transfer()));
    expect(ditolak.status).toBe(409);
    expect(ditolak.pesan).toContain('jam operasional');
    expect(await stok(m.semen)).toEqual({ fisik: '10.000', dipesan: '0.000' });
    const jam = await kirim<{ di: boolean }>(admin, '/api/shift/jam-operasional', undefined, 'GET');
    expect(jam.di).toBe(true);

    // Di luar jam operasional: non-tunai boleh (aturan lama), tunai tetap wajib shift.
    await aturKonfigurasi({ shift_jam_buka: '23:59', shift_jam_tutup: '23:59' });
    const ok = await kirim(admin, '/api/penjualan/checkout', await transfer());
    expect(ok.nomorShift).toBeNull();
    expect(
      (
        await galat(
          minta2(admin, '/api/penjualan/checkout', { order: isi, pembayaran: [tunai(12000)] }),
        )
      ).status,
    ).toBe(409);

    // Dengan shift terbuka di jam operasional: normal.
    await aturKonfigurasi({ shift_jam_buka: '00:00', shift_jam_tutup: '24:00' });
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    expect(
      (await kirim(kasir, '/api/penjualan/checkout', { order: isi, pembayaran: [tunai(12000)] }))
        .nomorShift,
    ).not.toBeNull();
  });

  it('PT2/P7/P8/P9 order dari antrean ke pelanggan: DP, jatuh tempo bawaan, pelunasan, bayar campuran', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const o = await kirim<DetailOrder>(staf, '/api/order?kirim=true', {
      jenisPenjualan: 'LANGSUNG',
      idPelanggan: plg,
      baris: [{ idBarang: m.semen, qty: '2' }],
    });
    expect((await stok(m.semen)).dipesan).toBe('2.000');
    const pj = await kirim(kasir, '/api/penjualan/checkout', {
      idOrder: o.id,
      pembayaran: [tunai(10000)],
    });
    expect(pj).toMatchObject({
      statusPembayaran: 'DP',
      sisaTagihan: 14000,
      tanggalJatuhTempo: tambahHari(tanggalOperasional(), 7),
    });
    expect(pj.pembayaran[0]?.jenis).toBe('DP');
    expect(await stok(m.semen)).toEqual({ fisik: '8.000', dipesan: '0.000' });

    const lunas = await kirim(kasir, `/api/penjualan/${pj.id}/pembayaran`, {
      pembayaran: {
        metode: 'EDC',
        nominal: 14000,
        idRekening: await rekeningUji('EDC'),
        referensi: 'REF-0001',
      },
    });
    expect(lunas).toMatchObject({ statusPembayaran: 'LUNAS', sisaTagihan: 0, totalDibayar: 24000 });
    expect(lunas.pembayaran.map((p) => p.jenis)).toEqual(['DP', 'PELUNASAN']);
    const lagi = await galat(
      minta2(kasir, `/api/penjualan/${pj.id}/pembayaran`, { pembayaran: tunai(1000) }),
    );
    expect(lagi.kode).toBe('STATUS_TIDAK_VALID');

    // Bayar campuran saat checkout: tunai + transfer = lunas.
    const campur = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.pasir, qty: '3' }]),
      pembayaran: [
        tunai(5000),
        {
          metode: 'TRANSFER',
          nominal: 7000,
          idRekening: await rekeningUji('TRANSFER'),
          referensi: 'REF-0001',
        },
      ],
    });
    expect(campur.statusPembayaran).toBe('LUNAS');
    expect(campur.pembayaran.map((p) => p.jenis)).toEqual(['DP', 'PELUNASAN']);
  });

  it('R8/P2 checkout hanya oleh pemegang kunci; perbarui harga dicatat log', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const o = await kirim<DetailOrder>(staf, '/api/order?kirim=true', {
      jenisPenjualan: 'LANGSUNG',
      baris: [{ idBarang: m.semen, qty: '1' }],
    });
    await kirim(admin, `/api/order/${o.id}/proses`);
    const bentrok = await galat(
      minta2(kasir, '/api/penjualan/checkout', { idOrder: o.id, pembayaran: [tunai(12000)] }),
    );
    expect(bentrok.status).toBe(409);
    await kirim(admin, `/api/order/${o.id}/lepas`);

    await db
      .update(hargaBarang)
      .set({ hargaJual: 12500, hargaTetap: 12500 })
      .where(eq(hargaBarang.idBarang, m.semen));
    const pj = await kirim(kasir, '/api/penjualan/checkout', {
      idOrder: o.id,
      perbaruiHarga: [m.semen],
      pembayaran: [tunai(12500)],
    });
    expect(pj.baris[0]).toMatchObject({ hargaSatuan: 12500, subtotal: 12500 });
    expect(pj.totalNeto).toBe(12500);
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'ORDER_UBAH'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('Rp 12.000 → Rp 12.500');
  });

  it('P11 belum diambil → diambil (log); pengantaran: INV, status kirim BELUM, bayar saat terima', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const pj = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '1' }]),
      pembayaran: [tunai(12000)],
      statusPengambilan: 'BELUM_DIAMBIL',
    });
    expect(pj.statusPengambilan).toBe('BELUM_DIAMBIL');
    const daftar = await json<{ data: { id: number }[] }>(
      await minta('/api/penjualan?statusPengambilan=BELUM_DIAMBIL', { cookie: kasir.cookie }),
    );
    expect(daftar.data.map((d) => d.id)).toEqual([pj.id]);
    expect((await kirim(kasir, `/api/penjualan/${pj.id}/diambil`)).statusPengambilan).toBe(
      'DIAMBIL',
    );
    expect((await galat(minta2(kasir, `/api/penjualan/${pj.id}/diambil`))).status).toBe(409);

    const salah = await galat(
      minta2(kasir, '/api/penjualan/checkout', {
        order: keranjang([{ idBarang: m.semen, qty: '1' }], { idPelanggan: plg }),
        bayarSaatTerima: true,
      }),
    );
    expect(salah.status).toBe(400);
    const inv = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '2' }], {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: plg,
        alamatKirim: 'Jl. Proyek 9',
        ongkir: 15000,
      }),
      bayarSaatTerima: true,
    });
    expect(inv.nomor).toMatch(/^INV-/);
    expect(inv).toMatchObject({
      statusPengiriman: 'BELUM',
      statusPengambilan: null,
      bayarSaatTerima: true,
      totalNeto: 39000,
      statusPembayaran: 'BELUM_BAYAR',
    });
  });

  it('K-073 nominal kosong = lunasi: tunai pakai uang diterima (kembalian), non-tunai pakai sisa', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const tunaiLebih = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '2' }]),
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 50000 }],
    });
    expect(tunaiLebih.pembayaran[0]).toMatchObject({
      jenis: 'PENUH',
      nominal: 24000,
      uangDiterima: 50000,
      kembalian: 26000,
    });
    const pas = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.pasir, qty: '1' }]),
      pembayaran: [{ metode: 'TUNAI' }],
    });
    expect(pas.pembayaran[0]).toMatchObject({ nominal: 4000, uangDiterima: 4000, kembalian: 0 });
    const transfer = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.pasir, qty: '1' }]),
      pembayaran: [
        { metode: 'TRANSFER', idRekening: await rekeningUji('TRANSFER'), referensi: 'REF-0001' },
      ],
    });
    expect(transfer).toMatchObject({ statusPembayaran: 'LUNAS', totalDibayar: 4000 });

    // Pelanggan terdata: tunai kurang dari total = DP, sisanya piutang.
    const dp = await kirim(kasir, '/api/penjualan/checkout', {
      order: keranjang([{ idBarang: m.semen, qty: '1' }], { idPelanggan: plg }),
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 5000 }],
    });
    expect(dp).toMatchObject({ statusPembayaran: 'DP', sisaTagihan: 7000 });
    // Pembeli umum: kurang bayar ditolak seluruhnya (P6).
    const kurang = await galat(
      minta2(kasir, '/api/penjualan/checkout', {
        order: keranjang([{ idBarang: m.semen, qty: '1' }]),
        pembayaran: [{ metode: 'TUNAI', uangDiterima: 5000 }],
      }),
    );
    expect(kurang.status).toBe(400);
    expect(kurang.pesan).toContain('kurang Rp 7.000');
    expect(await stok(m.semen)).toEqual({ fisik: '7.000', dipesan: '0.000' });
  });

  it('K-073 kasir mengubah isi order antrean saat checkout dalam satu transaksi', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const o = await kirim<DetailOrder>(staf, '/api/order?kirim=true', {
      jenisPenjualan: 'LANGSUNG',
      baris: [
        { idBarang: m.semen, qty: '2' },
        { idBarang: m.pasir, qty: '1' },
      ],
    });
    expect(await stok(m.semen)).toEqual({ fisik: '10.000', dipesan: '2.000' });
    // Pembeli batal ambil pasir dan menambah semen jadi 3.
    const pj = await kirim(kasir, '/api/penjualan/checkout', {
      idOrder: o.id,
      order: keranjang([{ idBarang: m.semen, qty: '3' }]),
      pembayaran: [{ metode: 'TUNAI' }],
    });
    expect(pj.idOrder).toBe(o.id);
    expect(pj.baris.map((b) => [b.namaBarang, b.qty])).toEqual([['Semen Gresik 40 kg', '3.000']]);
    expect(pj.totalNeto).toBe(36000);
    expect(await stok(m.semen)).toEqual({ fisik: '7.000', dipesan: '0.000' });
    expect(await stok(m.pasir)).toEqual({ fisik: '5.000', dipesan: '0.000' });
    for (const id of [m.semen, m.pasir]) expect((await hitungUlangCache(db, id)).cocok).toBe(true);
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'ORDER_UBAH'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.nomorDokumen).toBe(o.nomor);
  });

  it('L11/R6 checkout paralel pada barang yang sama tidak menjual melebihi stok', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const hasil = await Promise.all(
      Array.from({ length: 8 }, () =>
        minta2(kasir, '/api/penjualan/checkout', {
          order: keranjang([{ idBarang: m.pasir, qty: '1' }]),
          pembayaran: [tunai(4000)],
        }),
      ),
    );
    const sukses = hasil.filter((r) => r.status === 201).length;
    expect(sukses).toBe(5);
    for (const r of hasil.filter((x) => x.status !== 201)) {
      expect((await json<Galat>(r)).error.kode).toBe('STOK_TIDAK_CUKUP');
    }
    expect(await stok(m.pasir)).toEqual({ fisik: '0.000', dipesan: '0.000' });
    expect((await hitungUlangCache(db, m.pasir)).cocok).toBe(true);
  });
});
