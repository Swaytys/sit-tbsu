import type {
  BarisRetur,
  BarisVoid,
  DetailPenjualan,
  DetailShift,
  KandidatRetur,
  Notifikasi,
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
  returPenjualan,
  returPenjualanDetail,
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
  return { baik: p!.stokFisik, rusak: p!.stokRusak };
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
    returPenjualanDetail,
    returPenjualan,
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
      hargaTetap: 3000,
      hargaJual: 3000,
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
      { idBarang: m.pasir, qtyFisik: '20', hppSatuan: 2000 },
    ],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
  await kirim(kasir, '/api/shift/buka', { modalAwal: 100000 });
  await kirim(admin, '/api/shift/buka', { modalAwal: 0 });
});

describe('retur penjualan (docs/05 §8)', () => {
  it('T2/T3/T4/T6 Kasir mengajukan refund; disetujui: BAIK ke stok jual, RUSAK ke bucket rusak, refund dari laci penyetuju', async () => {
    const pj = await jual(
      kasir,
      [{ idBarang: m.semen, qty: '5', diskonBaris: 0 }],
      [{ metode: 'TUNAI' }],
    );
    const baris = pj.baris[0]!;
    const r = await kirim<BarisRetur>(kasir, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Kelebihan beli',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: baris.id, qtyRetur: '2', kondisi: 'BAIK' }],
    });
    expect(r).toMatchObject({ status: 'MENUNGGU', totalRetur: 20000 });
    expect(r.nomor).toMatch(/^RTR-/);
    expect((await stok(m.semen)).baik).toBe('15.000');
    // Pengajuan kedua tidak boleh melebihi sisa (2 masih menunggu).
    const lebih = await galat(kasir, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'lagi',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: baris.id, qtyRetur: '4' }],
    });
    expect(lebih.pesan).toContain('melebihi yang bisa diretur (3 sak)');

    const ok = await kirim<BarisRetur>(admin, `/api/retur/${r.id}/setujui`, {});
    expect(ok).toMatchObject({ status: 'DISETUJUI', metodeRefund: 'TUNAI' });
    expect((await stok(m.semen)).baik).toBe('17.000');
    const d = await ambil<DetailPenjualan>(admin, `/api/penjualan/${pj.id}`);
    expect(d).toMatchObject({ totalRetur: 20000, totalRefund: 20000, sisaTagihan: 0 });
    expect(d.baris[0]?.statusItem).toBe('RETUR_SEBAGIAN');
    const sAdmin = await ambil<ShiftAktif>(admin, '/api/shift/saya');
    const kas = (await ambil<DetailShift>(admin, `/api/shift/${sAdmin.id}`)).kas;
    expect(kas.map((k) => [k.jenis, k.nominal, k.nomorDokumen])).toEqual([
      ['REFUND_RETUR', 20000, r.nomor],
    ]);

    // RUSAK masuk bucket rusak, bukan stok jual (Admin langsung disetujui).
    await kirim<BarisRetur>(admin, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Sak sobek',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TRANSFER', rekeningRefund: 'BCA 1' },
      baris: [{ idPenjualanDetail: baris.id, qtyRetur: '1', kondisi: 'RUSAK' }],
    });
    expect(await stok(m.semen)).toEqual({ baik: '17.000', rusak: '1.000' });
    for (const id of [m.semen]) expect((await hitungUlangCache(db, id)).cocok).toBe(true);
  });

  it('T2 harga efektif sudah bersih diskon baris; T5 tukar barang tidak mengubah tagihan; T7 potong tagihan', async () => {
    const pj = await jual(
      admin,
      [{ idBarang: m.semen, qty: '3', diskonBaris: 3000 }],
      [{ metode: 'TUNAI', uangDiterima: 10000 }],
      { idPelanggan: plg },
    ); // subtotal 27.000 (efektif 9.000/sak), dibayar 10.000, sisa 17.000
    const kandidat = await ambil<KandidatRetur[]>(admin, `/api/retur/kandidat?cari=${pj.nomor}`);
    expect(kandidat[0]?.baris[0]).toMatchObject({
      hargaSatuanEfektif: 9000,
      qtyBisaRetur: '3.000',
    });
    // K-106: tanpa kata cari = transaksi terbaru (yang baru dijual ada paling atas), beserta sisa tagihannya.
    const terbaru = await ambil<KandidatRetur[]>(admin, '/api/retur/kandidat');
    expect(terbaru[0]).toMatchObject({ id: pj.id, sisaTagihan: 17000 });

    const tukar = await kirim<BarisRetur>(admin, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Sak bocor, tukar',
      penyelesaian: 'TUKAR_BARANG',
      baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '1', kondisi: 'RUSAK' }],
    });
    expect(tukar.status).toBe('DISETUJUI');
    expect(await stok(m.semen)).toEqual({ baik: '16.000', rusak: '1.000' }); // 17 − 1 pengganti
    let d = await ambil<DetailPenjualan>(admin, `/api/penjualan/${pj.id}`);
    expect(d).toMatchObject({ totalRetur: 0, sisaTagihan: 17000 });

    const terlalu = await galat(admin, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'potong',
      penyelesaian: 'POTONG_TAGIHAN',
      baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '2', kondisi: 'BAIK' }],
    });
    expect(terlalu.pesan).toContain('melebihi sisa tagihan'); // 18.000 > 17.000
    await kirim(admin, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'potong',
      penyelesaian: 'POTONG_TAGIHAN',
      baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '1', kondisi: 'BAIK' }],
    });
    d = await ambil<DetailPenjualan>(admin, `/api/penjualan/${pj.id}`);
    expect(d).toMatchObject({
      totalRetur: 9000,
      totalRefund: 0,
      sisaTagihan: 8000,
      statusPembayaran: 'DP',
    });
  });

  it('T6 refund dibatasi uang yang dibayar; T10 tolak tanpa efek; notifikasi persetujuan; V1 void ditolak setelah retur', async () => {
    const pj = await jual(
      kasir,
      [{ idBarang: m.pasir, qty: '10' }],
      [{ metode: 'TUNAI', uangDiterima: 5000 }],
      { idPelanggan: plg },
    ); // 30.000, dibayar 5.000
    const r = await kirim<BarisRetur>(kasir, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Sisa proyek',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '4' }],
    });
    const notif = await ambil<Notifikasi[]>(admin, '/api/notifikasi');
    expect(notif.find((n) => n.jenis === 'RETUR_MENUNGGU')?.jumlah).toBe(1);
    const tolak = await kirim<BarisRetur>(admin, `/api/retur/${r.id}/tolak`, {
      alasan: 'Barang bukan dari toko',
    });
    expect(tolak.status).toBe('DITOLAK');
    expect((await stok(m.pasir)).baik).toBe('10.000');

    const r2 = await kirim<BarisRetur>(admin, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Sisa proyek',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '4' }],
    }); // nilai 12.000, dibayar 5.000 → refund 5.000, 7.000 potong tagihan
    expect(r2.catatan).toContain('Refund dibatasi Rp 5.000');
    const d = await ambil<DetailPenjualan>(admin, `/api/penjualan/${pj.id}`);
    expect(d).toMatchObject({ totalRetur: 12000, totalRefund: 5000, sisaTagihan: 18000 });

    const v = await galat(kasir, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'TRANSAKSI',
      alasan: 'coba',
    });
    expect(v.pesan).toContain('sudah punya retur');
  });

  it('Selesai bila Fase 6: satu hari operasional — 5 penjualan, 1 retur, 1 void, tutup shift → clerical cocok hitungan manual', async () => {
    const s = await ambil<ShiftAktif>(kasir, '/api/shift/saya'); // modal 100.000
    const p1 = await jual(
      kasir,
      [{ idBarang: m.semen, qty: '2' }],
      [{ metode: 'TUNAI', uangDiterima: 50000 }],
    ); // 20.000
    await jual(kasir, [{ idBarang: m.pasir, qty: '5' }], [{ metode: 'TUNAI' }]); // 15.000
    await jual(kasir, [{ idBarang: m.semen, qty: '1' }], [{ metode: 'TRANSFER', rekening: 'BCA' }]); // 10.000 non-tunai
    const p4 = await jual(kasir, [{ idBarang: m.pasir, qty: '2' }], [{ metode: 'TUNAI' }]); // 6.000
    await jual(kasir, [{ idBarang: m.semen, qty: '3' }], [{ metode: 'TUNAI' }]); // 30.000
    await kirim(kasir, '/api/shift/kas', { jenis: 'KASBON', nominal: 5000, keterangan: 'Sopir' });

    // Retur 1 sak dari p1, refund tunai — kasir mengajukan, kasir (penyetuju?) tidak berhak; Admin menyetujui
    // dari shift Admin, jadi laci kasir TIDAK berkurang.
    const r = await kirim<BarisRetur>(kasir, '/api/retur', {
      idPenjualan: p1.id,
      alasan: 'Kelebihan',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: p1.baris[0]!.id, qtyRetur: '1' }],
    });
    await kirim(admin, `/api/retur/${r.id}/setujui`, {});
    // Void p4 seluruhnya, refund tunai dari laci Admin.
    const v = await kirim<BarisVoid>(kasir, '/api/void', {
      idPenjualan: p4.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Salah',
    });
    await kirim(admin, `/api/void/${v.id}/setujui`, { metodeRefund: 'TUNAI' });

    // Hitungan manual laci kasir: 100.000 + (20.000 + 15.000 + 6.000 + 30.000) − 5.000 kasbon = 166.000.
    const tutup = await kirim<DetailShift>(kasir, `/api/shift/${s.id}/tutup`, {
      uangFisik: 166000,
    });
    expect(tutup.clerical).toMatchObject({
      modalAwal: 100000,
      tunaiPenjualan: 71000,
      kasMasukLain: 0,
      kasKeluar: 5000,
      saldoSistem: 166000,
      uangFisik: 166000,
      selisih: 0,
    });
    // Laci Admin: 0 − refund retur 10.000 − refund void 6.000.
    const sAdmin = await ambil<ShiftAktif>(admin, '/api/shift/saya');
    const dAdmin = await ambil<DetailShift>(admin, `/api/shift/${sAdmin.id}`);
    expect(dAdmin.ringkasan?.saldoSistem).toBe(-16000);
    for (const id of [m.semen, m.pasir]) expect((await hitungUlangCache(db, id)).cocok).toBe(true);
    expect(await stok(m.semen)).toEqual({ baik: '15.000', rusak: '0.000' }); // 20 − 6 + 1
    expect(await stok(m.pasir)).toEqual({ baik: '15.000', rusak: '0.000' }); // 20 − 7 + 2
  });

  it('T5 tukar ditolak sejak pengajuan bila stok pengganti kurang; sisanya bisa diretur uang kembali', async () => {
    const pj = await jual(
      kasir,
      [{ idBarang: m.semen, qty: '19', diskonBaris: 0 }],
      [{ metode: 'TUNAI' }],
    );
    const b = pj.baris[0]!;
    // Stok tinggal 1: tukar 2 sak rusak ditolak dengan saran memecah.
    const tolak = await galat(kasir, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Sak sobek',
      penyelesaian: 'TUKAR_BARANG',
      baris: [{ idPenjualanDetail: b.id, qtyRetur: '2', kondisi: 'RUSAK' }],
    });
    expect(tolak.status).toBe(409);
    expect(tolak.pesan).toContain('tinggal 1 sak');
    // Tukar 1 + retur 1 uang kembali: keduanya bisa diajukan.
    await kirim(kasir, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Sak sobek',
      penyelesaian: 'TUKAR_BARANG',
      baris: [{ idPenjualanDetail: b.id, qtyRetur: '1', kondisi: 'RUSAK' }],
    });
    await kirim(kasir, '/api/retur', {
      idPenjualan: pj.id,
      alasan: 'Sak sobek, stok pengganti habis',
      penyelesaian: 'REFUND',
      persetujuan: { metodeRefund: 'TUNAI' },
      baris: [{ idPenjualanDetail: b.id, qtyRetur: '1', kondisi: 'RUSAK' }],
    });
  });
});
