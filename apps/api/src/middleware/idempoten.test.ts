import { count, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../test/pembantu';
import { kosongkanTabel } from '../../test/reset';
import { db } from '../db/client';
import { hargaBarang, kunciIdempoten, merk, penjualan, shiftKasir } from '../db/schema';
import { bersihkanKunciIdempoten } from './idempoten';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;

const kirim = (sesi: Sesi, path: string, body: unknown, kunci?: string) =>
  minta(path, {
    method: 'POST',
    cookie: sesi.cookie,
    body,
    headers: kunci ? { 'Idempotency-Key': kunci } : {},
  });

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await kosongkanTabel(kunciIdempoten, merk);
  admin = await sesiUji('ADMIN');
});

describe('kunci idempoten (K-164)', () => {
  it('kiriman ulang dengan kunci sama dijawab dari hasil pertama, tidak dijalankan dua kali', async () => {
    const a = await kirim(admin, '/api/merk', { nama: 'Tiga Roda' }, 'kunci-uji-0001');
    const b = await kirim(admin, '/api/merk', { nama: 'Tiga Roda' }, 'kunci-uji-0001');
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers.get('Idempotent-Replay')).toBe('true');
    expect(await json(b)).toEqual(await json(a));
    const [n] = await db.select({ n: count() }).from(merk);
    expect(n!.n).toBe(1);
  });

  it('kunci sama dengan isi berbeda ditolak; kiriman gagal boleh diulang dengan kunci sama', async () => {
    await kirim(admin, '/api/merk', { nama: 'Holcim' }, 'kunci-uji-0002');
    const beda = await kirim(admin, '/api/merk', { nama: 'Gresik' }, 'kunci-uji-0002');
    expect(beda.status).toBe(422);
    // Gagal validasi: kunci dilepas, jadi isian yang diperbaiki tetap bisa dikirim dengan kunci itu.
    const gagal = await kirim(admin, '/api/merk', { nama: '' }, 'kunci-uji-0003');
    expect(gagal.status).toBe(400);
    const ulang = await kirim(admin, '/api/merk', { nama: 'Semen Padang' }, 'kunci-uji-0003');
    expect(ulang.status).toBe(201);
  });

  it('pengguna lain dengan kunci sama tidak mendapat jawaban milik orang lain', async () => {
    const owner = await sesiUji('OWNER');
    await kirim(admin, '/api/merk', { nama: 'Merk A' }, 'kunci-uji-0004');
    const lain = await kirim(owner, '/api/merk', { nama: 'Merk A' }, 'kunci-uji-0004');
    expect(lain.status).toBe(409); // nama merk sudah ada: dijalankan sungguhan, bukan jawaban tersimpan
  });

  it('checkout tunai yang diulang (jaringan putus) hanya tercatat satu kali', async () => {
    const m = await siapkanMasterPersediaan();
    await kosongkanTabel(shiftKasir);
    const idTier = await siapkanTierNormal();
    await db.insert(hargaBarang).values({
      idBarang: m.semen,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 12000,
      hargaJual: 12000,
    });
    const sa = await json<{ data: { id: number } }>(
      await kirim(admin, '/api/penyesuaian', {
        jenis: 'SALDO_AWAL',
        baris: [{ idBarang: m.semen, qtyFisik: '5', hppSatuan: 9000 }],
      }),
    );
    await kirim(admin, `/api/penyesuaian/${sa.data.id}/selesai`, {});
    await kirim(admin, '/api/shift/buka', { modalAwal: 0 });
    const isi = {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 12000 }],
    };
    const r1 = await kirim(admin, '/api/penjualan/checkout', isi, 'kunci-checkout-01');
    const r2 = await kirim(admin, '/api/penjualan/checkout', isi, 'kunci-checkout-01');
    expect([r1.status, r2.status]).toEqual([201, 201]);
    const [n] = await db.select({ n: count() }).from(penjualan);
    expect(n!.n).toBe(1);
    // Pembeli lain dengan isi sama (kunci baru) tetap tercatat.
    await kirim(admin, '/api/penjualan/checkout', isi, 'kunci-checkout-02');
    const [n2] = await db.select({ n: count() }).from(penjualan);
    expect(n2!.n).toBe(2);
  });

  it('kunci lebih tua dari 24 jam dibersihkan', async () => {
    await kirim(admin, '/api/merk', { nama: 'Lama' }, 'kunci-uji-0005');
    await db
      .update(kunciIdempoten)
      .set({ dibuatPada: new Date(Date.now() - 25 * 3600 * 1000) })
      .where(eq(kunciIdempoten.kunci, 'kunci-uji-0005'));
    expect(await bersihkanKunciIdempoten()).toBe(1);
  });
});
