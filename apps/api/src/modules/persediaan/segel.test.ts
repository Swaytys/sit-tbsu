import type { DetailPenyesuaian, KinerjaOpname, LembarHitung, SegelBarang } from '@sit/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barangSatuanJual,
  hargaBarang,
  logAktivitas,
  mutasiSegel,
  persediaan,
  satuan,
  shiftKasir,
} from '../../db/schema';
import { hitungUlangCache } from './ledger';

/*
 * K-227 tahap 3 / K-246: kemasan tersegel (stok dua lapis: box segel + ecer), buka box otomatis saat ecer kurang,
 * opname box + ecer dengan uji petik.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let kepala: Sesi;
let kasir: Sesi;
let gudang: Sesi;
let box: number;
let ikat: number;

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });
async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}
async function pesan(r: Promise<Response>) {
  const res = await r;
  return { status: res.status, ...(await json<{ error: { pesan: string } }>(res)).error };
}

async function stok(idBarang: number) {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, idBarang));
  return { fisik: p!.stokFisik, segel: p!.qtySegel };
}

async function terima(idBarang: number, qtyMasuk: string, qtySegel?: string) {
  return data(
    kirim(kepala, '/api/penerimaan', {
      idPemasok: m.pemasokA,
      jenis: 'PEMBELIAN',
      syaratBayar: 'TUNAI',
      referensi: 'TRF0001',
      baris: [{ idBarang, qtyMasuk, hargaModalMasuk: 9000, qtySegel }],
    }),
  );
}

const keranjang = (baris: unknown[]) => ({
  order: { jenisPenjualan: 'LANGSUNG', baris },
  pembayaran: [{ metode: 'TUNAI', nominal: 0 }],
});

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(shiftKasir);
  kepala = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  gudang = await sesiUji('PETUGAS_GUDANG');
  const [sBox] = await db
    .insert(satuan)
    .values({ kode: 'box', nama: 'Box', jenisDimensi: 'JUMLAH', faktorKeBasis: '1' })
    .returning();
  const [sIkat] = await db
    .insert(satuan)
    .values({ kode: 'ikat', nama: 'Ikat', jenisDimensi: 'JUMLAH', faktorKeBasis: '1' })
    .returning();
  const [bsj] = await db
    .insert(barangSatuanJual)
    .values({ idBarang: m.semen, idSatuan: sBox!.id, faktorKeDasar: '10' })
    .returning();
  const [bsj2] = await db
    .insert(barangSatuanJual)
    .values({ idBarang: m.semen, idSatuan: sIkat!.id, faktorKeDasar: '2.5' })
    .returning();
  box = bsj!.id;
  ikat = bsj2!.id;
});

describe('kemasan tersegel (K-227 tahap 3)', () => {
  it('tandai kemasan, penerimaan box utuh/ecer, buka manual, audit lapisan', async () => {
    const atur = (sesi: Sesi, idSatuanJual: number | null) =>
      kirim(sesi, `/api/segel/${m.semen}/kemasan`, { idSatuanJual }, 'PUT');
    expect((await pesan(atur(kepala, ikat))).pesan).toContain('bilangan bulat');
    expect((await atur(gudang, box)).status).toBe(403);
    const awal = await data<SegelBarang>(atur(kepala, box));
    expect(awal).toMatchObject({ kodeSatuan: 'box', isi: '10', qtySegel: '0.000', ecer: '0.000' });

    // Kosong = box utuh terbanyak; diisi = sebanyak itu; tidak bisa melebihi box utuh di qty diterima.
    await terima(m.semen, '35');
    expect(await stok(m.semen)).toEqual({ fisik: '35.000', segel: '3.000' });
    await terima(m.semen, '20', '1');
    expect(await stok(m.semen)).toEqual({ fisik: '55.000', segel: '4.000' });
    await terima(m.semen, '5', '3');
    expect(await stok(m.semen)).toEqual({ fisik: '60.000', segel: '4.000' });

    // Buka manual: hanya pemegang izin; tidak melebihi box yang ada.
    expect(
      (await kirim(kasir, `/api/segel/${m.semen}/buka`, { jumlah: 1, alasan: 'uji' })).status,
    ).toBe(403);
    expect(
      (
        await pesan(
          kirim(gudang, `/api/segel/${m.semen}/buka`, { jumlah: 5, alasan: 'Siapkan ecer' }),
        )
      ).status,
    ).toBe(409);
    const buka = await data<SegelBarang>(
      kirim(gudang, `/api/segel/${m.semen}/buka`, { jumlah: 1, alasan: 'Siapkan ecer' }),
    );
    expect(buka).toMatchObject({ qtySegel: '3.000', ecer: '30.000' });
    expect(buka.riwayat[0]).toMatchObject({
      jenis: 'BUKA',
      qtyKeluar: '1.000',
      namaPengguna: gudang.pengguna.namaPengguna,
      keterangan: 'Buka kemasan: Siapkan ecer',
    });
    expect(buka.riwayat.filter((r) => r.jenis === 'MASUK').map((r) => r.qtyMasuk)).toEqual([
      '1.000',
      '3.000',
    ]);
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'SEGEL_BUKA'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('Buka 1 box segel');
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
  });

  it('penjualan per box mengambil box segel; ecer kurang → box dibuka otomatis atas nama kasir (K-246)', async () => {
    const tier = await siapkanTierNormal();
    await db.insert(hargaBarang).values({
      idBarang: m.semen,
      idTingkatHarga: tier,
      metode: 'TETAP',
      hargaTetap: 1000,
      hargaJual: 1000,
    });
    await data(kirim(kepala, `/api/segel/${m.semen}/kemasan`, { idSatuanJual: box }, 'PUT'));
    await terima(m.semen, '40');
    expect(await stok(m.semen)).toEqual({ fisik: '40.000', segel: '4.000' });
    await data(kirim(kasir, '/api/shift/buka', { modalAwal: 0 }));
    const jual = async (baris: unknown, total: number) => {
      const isi = keranjang([baris]);
      isi.pembayaran[0]!.nominal = total;
      return data<{ nomor: string }>(kirim(kasir, '/api/penjualan/checkout', isi));
    };

    await jual({ idBarang: m.semen, qty: '2', idSatuanJual: box }, 20000);
    expect(await stok(m.semen)).toEqual({ fisik: '20.000', segel: '2.000' });
    // Pratinjau keranjang memberi tahu box yang akan dibuka (ecer 0, jual 3 sak).
    const pr = await data<{ baris: { segelDibuka: unknown }[] }>(
      kirim(kasir, '/api/order/pratinjau', {
        idOrder: null,
        order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '3' }] },
      }),
    );
    expect(pr.baris[0]?.segelDibuka).toEqual({ jumlah: 1, kodeSatuan: 'box' });
    const pj = await jual({ idBarang: m.semen, qty: '3' }, 3000);
    expect(await stok(m.semen)).toEqual({ fisik: '17.000', segel: '1.000' });
    const [bukaOtomatis] = await db
      .select()
      .from(mutasiSegel)
      .where(and(eq(mutasiSegel.idBarang, m.semen), eq(mutasiSegel.jenis, 'BUKA')));
    expect(bukaOtomatis).toMatchObject({ qtyKeluar: '1.000', idPengguna: kasir.pengguna.id });
    expect(bukaOtomatis?.keterangan).toContain('Dibuka otomatis');
    expect(bukaOtomatis?.keterangan).toContain(pj.nomor);

    // Retur/void dan pengurangan lain memakai ecer; aturan box × isi ≤ stok tetap terjaga.
    await jual({ idBarang: m.semen, qty: '1', idSatuanJual: box }, 10000);
    expect(await stok(m.semen)).toEqual({ fisik: '7.000', segel: '0.000' });
    const jenis = (
      await db
        .select({ jenis: mutasiSegel.jenis })
        .from(mutasiSegel)
        .where(eq(mutasiSegel.idBarang, m.semen))
        .orderBy(asc(mutasiSegel.id))
    ).map((x) => x.jenis);
    expect(jenis).toEqual(['MASUK', 'KELUAR', 'BUKA', 'KELUAR']);
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
  });

  it('opname: box + ecer, uji petik sekali per barang, lapisan disamakan, kinerja uji petik', async () => {
    await data(kirim(kepala, `/api/segel/${m.semen}/kemasan`, { idSatuanJual: box }, 'PUT'));
    await terima(m.semen, '50');
    const d = await data<DetailPenyesuaian>(
      kirim(kepala, '/api/opname/daftar-harian', { jumlah: 2, idPenghitung: gudang.pengguna.id }),
    );
    // Satu-satunya barang bersegel pasti diminta uji petik.
    expect(d.baris.find((b) => b.idBarang === m.semen)?.ujiPetik).toBe(true);
    const lembar = await data<LembarHitung>(kirim(gudang, `/api/opname/${d.id}/mulai`));
    expect(lembar.baris.find((b) => b.idBarang === m.semen)).toMatchObject({
      segel: { kodeSatuan: 'box', isi: '10' },
      ujiPetik: true,
    });
    const hitung = (sesi: Sesi, body: Record<string, unknown>) =>
      kirim(sesi, `/api/opname/${d.id}/hitung`, { idBarang: m.semen, ...body });
    expect((await pesan(hitung(gudang, { qtySegel: '5', qty: '0' }))).pesan).toContain('uji petik');
    // 5 box dihitung, 1 dibuka berisi 8, ecer 0 → 4 × 10 + 8 = 48 (selisih −2).
    await data(hitung(gudang, { qtySegel: '5', isiUjiPetik: '8', qty: '0' }));
    await data(kirim(gudang, `/api/opname/${d.id}/hitung`, { idBarang: m.pasir, qty: '0' }));
    let isi = await data<DetailPenyesuaian>(
      minta(`/api/penyesuaian/${d.id}`, { cookie: kepala.cookie }),
    );
    const semen = isi.baris.find((b) => b.idBarang === m.semen)!;
    expect(semen.qtyFisik).toBe('48.000');
    expect(semen.hitungan[0]).toMatchObject({
      qtySegel: '5.000',
      isiSegel: '10.000',
      isiUjiPetik: '8.000',
      selisih: '-2.000',
    });

    // Hitung ulang orang lain: box sudah dibuka, tidak diminta uji petik lagi (4 box + 8 ecer).
    await data(kirim(kepala, `/api/opname/${d.id}/penghitung`, { idPenghitung: null }, 'PATCH'));
    const persediaanSesi = await sesiUji('ADMIN_PERSEDIAAN');
    await data(hitung(persediaanSesi, { qtySegel: '4', qty: '8' }));
    isi = await data<DetailPenyesuaian>(
      minta(`/api/penyesuaian/${d.id}`, { cookie: kepala.cookie }),
    );
    expect(isi.baris.find((b) => b.idBarang === m.semen)).toMatchObject({ terkonfirmasi: true });
    await data(
      kirim(
        kepala,
        `/api/penyesuaian/${d.id}`,
        {
          jenis: 'OPNAME',
          baris: isi.baris.map((b) => ({
            idBarang: b.idBarang,
            qtyFisik: null,
            sebabSelisih: b.idBarang === m.semen ? 'SALAH_INPUT' : null,
          })),
        },
        'PUT',
      ),
    );
    await data(kirim(kepala, `/api/penyesuaian/${d.id}/selesai`));
    expect(await stok(m.semen)).toEqual({ fisik: '48.000', segel: '4.000' });
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
    const k = await data<KinerjaOpname>(minta('/api/opname/kinerja', { cookie: kepala.cookie }));
    expect(k.ujiPetik).toEqual({ dibuka: 1, kurang: 1, kurangQty: '2.000' });
  });

  it('kemasan tersegel berisi box tidak bisa dinonaktifkan; dilepas → box dihitung ecer (KOREKSI)', async () => {
    await data(kirim(kepala, `/api/segel/${m.semen}/kemasan`, { idSatuanJual: box }, 'PUT'));
    await terima(m.semen, '30');
    const [sBox] = await db.select().from(satuan).where(eq(satuan.kode, 'box'));
    const nonaktif = await pesan(
      kirim(
        kepala,
        `/api/barang/${m.semen}/satuan-jual`,
        { baris: [{ idSatuan: sBox!.id, faktor: '10', statusAktif: 'NONAKTIF' }] },
        'PUT',
      ),
    );
    expect(nonaktif.status).toBe(409);
    expect(nonaktif.pesan).toContain('Buka kemasan');
    const lepas = await data<SegelBarang | null>(
      kirim(kepala, `/api/segel/${m.semen}/kemasan`, { idSatuanJual: null }, 'PUT'),
    );
    expect(lepas).toBeNull();
    expect(await stok(m.semen)).toEqual({ fisik: '30.000', segel: '0.000' });
    const [akhir] = await db
      .select()
      .from(mutasiSegel)
      .where(eq(mutasiSegel.idBarang, m.semen))
      .orderBy(desc(mutasiSegel.id))
      .limit(1);
    expect(akhir).toMatchObject({ jenis: 'KOREKSI', qtyKeluar: '3.000', saldoSetelah: '0.000' });
    expect((await hitungUlangCache(db, m.semen)).cocok).toBe(true);
  });
});
