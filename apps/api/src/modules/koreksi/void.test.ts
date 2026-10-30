import type {
  BarisVoid,
  DetailPenjualan,
  DetailShift,
  KandidatVoid,
  ShiftAktif,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  clericalCheck,
  hargaBarang,
  kasShift,
  pelanggan,
  persediaan,
  shiftKasir,
  voidTransaksi,
  voidTransaksiDetail,
} from '../../db/schema';
import { hitungUlangCache } from '../persediaan/ledger';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let plg: number;

async function kirim<T>(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`POST ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
async function galat(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  return { status: r.status, ...(await json<Galat>(r)).error };
}
async function ambil<T>(sesi: Sesi, path: string) {
  const r = await minta(path, { cookie: sesi.cookie });
  if (r.status !== 200) throw new Error(`GET ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}
async function stok(id: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, id));
  return p!.stokFisik;
}

function jual(
  sesi: Sesi,
  baris: unknown[],
  pembayaran: unknown[],
  ubah: Record<string, unknown> = {},
) {
  return kirim<DetailPenjualan>(sesi, '/api/penjualan/checkout', {
    order: { jenisPenjualan: 'LANGSUNG', baris, ...ubah },
    pembayaran,
  });
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(
    voidTransaksiDetail,
    voidTransaksi,
    kasShift,
    clericalCheck,
    shiftKasir,
    pelanggan,
  );
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  const idTier = await siapkanTierNormal();
  await db.insert(hargaBarang).values([
    {
      idBarang: m.semen,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 10000,
      hargaJual: 10000,
    },
    {
      idBarang: m.pasir,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 4000,
      hargaJual: 4000,
    },
  ]);
  const [p] = await db
    .insert(pelanggan)
    .values({ kode: 'PLG-90001', namaPelanggan: 'CV Uji', noHp: '0811', alamat: 'Jl. A' })
    .returning();
  plg = p!.id;
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [
      { idBarang: m.semen, qtyFisik: '20', hppSatuan: 8000 },
      { idBarang: m.pasir, qtyFisik: '20', hppSatuan: 3000 },
    ],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
  await kirim(kasir, '/api/shift/buka', { modalAwal: 100000 }); // satu shift toko (K-132)
});

describe('void transaksi (docs/05 §9)', () => {
  it('V3/V4/V5 Kasir mengajukan item → tanpa efek; Admin menyetujui: stok kembali, total_void, refund tunai dari laci toko', async () => {
    const pj = await jual(
      kasir,
      [
        { idBarang: m.semen, qty: '2' },
        { idBarang: m.pasir, qty: '1' },
      ],
      [{ metode: 'TUNAI' }],
    ); // 24.000 lunas
    const semen = pj.baris.find((b) => b.namaBarang.startsWith('Semen'))!;
    const v = await kirim<BarisVoid>(kasir, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'ITEM',
      idDetail: [semen.id],
      alasan: 'Salah input',
    });
    expect(v).toMatchObject({ status: 'MENUNGGU', nominalVoid: 20000 });
    expect(v.nomor).toMatch(/^VD-/);
    expect(await stok(m.semen)).toBe('18.000'); // belum ada efek
    expect((await galat(kasir, `/api/void/${v.id}/setujui`, {})).status).toBe(403);
    // Pengajuan ganda baris yang sama ditolak.
    expect(
      (
        await galat(kasir, '/api/void', {
          idPenjualan: pj.id,
          lingkup: 'ITEM',
          idDetail: [semen.id],
          alasan: 'dobel',
        })
      ).status,
    ).toBe(409);

    const tanpaMetode = await galat(admin, `/api/void/${v.id}/setujui`, {});
    expect(tanpaMetode.pesan).toContain('pilih metode refund');
    const ok = await kirim<BarisVoid>(admin, `/api/void/${v.id}/setujui`, {
      metodeRefund: 'TUNAI',
    });
    expect(ok).toMatchObject({
      status: 'DISETUJUI',
      nominalVoid: 20000,
      nominalRefund: 20000,
      metodeRefund: 'TUNAI',
      namaPenyetuju: admin.pengguna.namaPengguna,
    });
    expect(await stok(m.semen)).toBe('20.000');
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
    const d = await ambil<DetailPenjualan>(admin, `/api/penjualan/${pj.id}`);
    expect(d).toMatchObject({
      statusTransaksi: 'VOID_SEBAGIAN',
      totalVoid: 20000,
      totalRefund: 20000,
      sisaTagihan: 0,
      statusPembayaran: 'LUNAS',
    });
    expect(d.baris.find((b) => b.id === semen.id)?.statusItem).toBe('VOID');
    // V5/K2 + K-132: refund tunai keluar dari laci shift toko (satu-satunya shift terbuka).
    const sAdmin = await ambil<ShiftAktif>(admin, '/api/shift/saya');
    const dShift = await ambil<DetailShift>(admin, `/api/shift/${sAdmin.id}`);
    expect(dShift.kas.map((k) => [k.jenis, k.nominal, k.nomorDokumen])).toEqual([
      ['REFUND_VOID', 20000, v.nomor],
    ]);
  });

  it('K-017/V2 Admin langsung disetujui; void transaksi penuh membuat tagihan 0', async () => {
    const pj = await jual(
      admin,
      [{ idBarang: m.semen, qty: '3' }],
      [{ metode: 'TUNAI', uangDiterima: 5000 }],
      { idPelanggan: plg },
    ); // neto 30.000, dibayar 5.000 (DP)
    const v = await kirim<BarisVoid>(admin, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Pembeli batal',
      persetujuan: { metodeRefund: 'TRANSFER', rekeningRefund: 'BCA 9' },
    });
    expect(v).toMatchObject({ status: 'DISETUJUI', nominalVoid: 30000, nominalRefund: 5000 });
    const d = await ambil<DetailPenjualan>(admin, `/api/penjualan/${pj.id}`);
    expect(d).toMatchObject({
      statusTransaksi: 'VOID',
      totalVoid: 30000,
      totalRefund: 5000,
      sisaTagihan: 0,
      statusPembayaran: 'LUNAS',
    });
    expect(await stok(m.semen)).toBe('20.000');
    // Void lagi ditolak.
    expect(
      (
        await galat(admin, '/api/void', {
          idPenjualan: pj.id,
          lingkup: 'TRANSAKSI',
          alasan: 'lagi',
        })
      ).kode,
    ).toBe('STATUS_TIDAK_VALID');
  });

  it('V1 shift asal sudah ditutup → ditolak (gunakan retur); V7 tolak tanpa efek; kandidat hanya shift terbuka', async () => {
    const pj = await jual(kasir, [{ idBarang: m.pasir, qty: '1' }], [{ metode: 'TUNAI' }]);
    const v = await kirim<BarisVoid>(kasir, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'TRANSAKSI',
      alasan: 'coba',
    });
    const tolak = await kirim<BarisVoid>(admin, `/api/void/${v.id}/tolak`, {
      alasan: 'Tidak perlu',
    });
    expect(tolak).toMatchObject({ status: 'DITOLAK', alasanPenolakan: 'Tidak perlu' });
    expect(await stok(m.pasir)).toBe('19.000');

    const kandidat = await ambil<KandidatVoid[]>(kasir, '/api/void/kandidat');
    expect(kandidat.map((k) => k.id)).toContain(pj.id);

    const s = await ambil<ShiftAktif>(kasir, '/api/shift/saya');
    await kirim(kasir, `/api/shift/${s.id}/tutup`, { uangFisik: 104000 });
    const telat = await galat(kasir, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'TRANSAKSI',
      alasan: 'telat',
    });
    expect(telat.kode).toBe('STATUS_TIDAK_VALID');
    expect(telat.pesan).toContain('Gunakan retur');
    expect(
      (await ambil<KandidatVoid[]>(kasir, '/api/void/kandidat')).map((k) => k.id),
    ).not.toContain(pj.id);
  });

  it('V1/S7 void ditolak bila barang sudah dikirim; surat jalan belum berangkat ikut batal', async () => {
    const inv = await kirim<DetailPenjualan>(admin, '/api/penjualan/checkout', {
      order: {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: plg,
        alamatKirim: 'Jl. A',
        baris: [{ idBarang: m.semen, qty: '4' }],
      },
    });
    const k = await kirim<{ id: number }>(admin, '/api/kendaraan', {
      plat: `S ${Date.now() % 10000} VD`,
      jenis: 'Pikap',
    });
    const s = await kirim<{ id: number }>(admin, '/api/sopir', { nama: `Budi ${Date.now()}` });
    const rit = await kirim<{ id: number }>(admin, '/api/perjalanan/rencana', {
      idKendaraan: k.id,
      idSopir: s.id,
      jadwalBerangkat: new Date(Date.now() + 3600_000).toISOString(),
    });
    const sj = await kirim<{ id: number }>(admin, `/api/penjualan/${inv.id}/surat-jalan`, {
      idPerjalanan: rit.id,
      baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '2' }],
    });
    const v = await kirim<BarisVoid>(admin, '/api/void', {
      idPenjualan: inv.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Proyek batal',
    });
    expect(v.status).toBe('DISETUJUI');
    const d = await ambil<DetailPenjualan>(admin, `/api/penjualan/${inv.id}`);
    expect(d.suratJalan.find((s) => s.id === sj.id)?.status).toBe('BATAL');

    const inv2 = await kirim<DetailPenjualan>(admin, '/api/penjualan/checkout', {
      order: {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: plg,
        alamatKirim: 'Jl. A',
        baris: [{ idBarang: m.semen, qty: '1' }],
      },
    });
    const sj2 = await kirim<{ id: number }>(admin, `/api/penjualan/${inv2.id}/surat-jalan`, {
      idPerjalanan: rit.id,
      baris: [{ idPenjualanDetail: inv2.baris[0]!.id, qtyKirim: '1' }],
    });
    // K-203: rit berangkat setelah semua surat jalan dicentang dimuat.
    await kirim(admin, `/api/surat-jalan/${sj2.id}/status`, { status: 'DIMUAT' });
    await kirim(admin, `/api/perjalanan/${rit.id}/berangkat`, {});
    const ditolak = await galat(admin, '/api/void', {
      idPenjualan: inv2.id,
      lingkup: 'TRANSAKSI',
      alasan: 'x y z',
    });
    expect(ditolak.pesan).toContain('sudah dikirim');
  });
});
