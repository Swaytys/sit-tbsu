import type {
  BarisLembarHitung,
  DetailPenyesuaian,
  KinerjaOpname,
  LembarHitung,
  Notifikasi,
  PenghitungOpname,
  RingkasanOpname,
  TugasOpname,
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
import { db } from '../../db/client';
import { logAktivitas, penjualan, penjualanDetail } from '../../db/schema';
import { dalamTransaksi } from '../../lib/transaksi';
import { tanggalOperasional } from '../../lib/waktu';
import { catatMutasi } from './ledger';

/*
 * K-240/K-227: Stok Opname bertahap: kelas ABC, daftar hitung harian acak yang ditugaskan ke satu penghitung,
 * hitung buta ditegakkan API, hitung ulang oleh orang lain, sebab baku, penghitung tidak menyetujui hitungannya,
 * timbang, kinerja.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let kepala: Sesi;
let persediaanSesi: Sesi;
let gudang: Sesi;

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });
const lihat = (sesi: Sesi, path: string) => minta(path, { cookie: sesi.cookie });
async function data<T>(r: Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}
async function pesan(r: Promise<Response>): Promise<string> {
  return (await json<{ error: { pesan: string } }>(await r)).error.pesan;
}

async function saldoAwal(idBarang: number, qty: string, hpp = 10000) {
  const d = await data<{ id: number }>(
    kirim(kepala, '/api/penyesuaian', {
      jenis: 'SALDO_AWAL',
      baris: [{ idBarang, qtyFisik: qty, hppSatuan: hpp }],
    }),
  );
  await data(kirim(kepala, `/api/penyesuaian/${d.id}/selesai`));
}

/** Penjualan uji yang memotong stok (barang jadi kelas A karena satu-satunya yang terjual). */
async function jualLangsung(idBarang: number, qty: string) {
  const [jual] = await db
    .insert(penjualan)
    .values({
      nomor: `STR-UJI-${Date.now()}`,
      tanggalOperasional: tanggalOperasional(),
      jenisPenjualan: 'LANGSUNG',
      idKasir: kepala.pengguna.id,
      totalBruto: 0,
      totalNeto: 0,
      statusPengambilan: 'DIAMBIL',
    })
    .returning();
  const [det] = await db
    .insert(penjualanDetail)
    .values({
      idPenjualan: jual!.id,
      idBarang,
      qty,
      qtyDasar: qty,
      hargaManual: true,
      hargaSatuan: 0,
      subtotal: 0,
      hppSaatTransaksi: 10000,
    })
    .returning();
  await dalamTransaksi((tx) =>
    catatMutasi(tx, {
      idBarang,
      jenis: 'PENJUALAN',
      qtyKeluar: qty,
      idPengguna: kepala.pengguna.id,
      tanggalOperasional: tanggalOperasional(),
      sumber: { idPenjualanDetail: det!.id },
    }),
  );
}

const barisSebab = (d: DetailPenyesuaian, sebab: Record<number, string>) => ({
  jenis: 'OPNAME',
  baris: d.baris.map((b) => ({
    idBarang: b.idBarang,
    qtyFisik: null,
    sebabSelisih: sebab[b.idBarang] ?? null,
  })),
});

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  kepala = await sesiUji('ADMIN');
  persediaanSesi = await sesiUji('ADMIN_PERSEDIAAN');
  gudang = await sesiUji('PETUGAS_GUDANG');
});

describe('stok opname bertahap (K-240, K-227)', () => {
  it('daftar harian ditugaskan; hitung buta di API; hitung ulang orang lain sampai sama; kinerja', async () => {
    await saldoAwal(m.semen, '10');
    await saldoAwal(m.pasir, '7', 3000);
    const r = await data<RingkasanOpname>(lihat(persediaanSesi, '/api/opname/ringkasan'));
    const total = r.kelas.reduce((t, k) => t + k.jumlah, 0);
    expect(total).toBe(2);
    expect(r.kelas.reduce((t, k) => t + k.jatuhTempo, 0)).toBe(total);
    expect(r).toMatchObject({
      akurasi30Hari: null,
      belumDihitungTahunIni: 2,
      toleransiRp: 0,
      drafAktif: 0,
    });
    expect(r.saranPerHari).toBeGreaterThanOrEqual(1);

    // Hanya Kepala Toko/Owner menyusun daftar; penghitung wajib berizin hitung opname.
    expect(
      (
        await kirim(persediaanSesi, '/api/opname/daftar-harian', {
          jumlah: 2,
          idPenghitung: gudang.pengguna.id,
        })
      ).status,
    ).toBe(403);
    const kasir = await sesiUji('KASIR');
    expect(
      (
        await kirim(kepala, '/api/opname/daftar-harian', {
          jumlah: 2,
          idPenghitung: kasir.pengguna.id,
        })
      ).status,
    ).toBe(400);
    const penghitung = await data<PenghitungOpname[]>(lihat(kepala, '/api/opname/penghitung'));
    expect(penghitung.map((p) => p.id)).toEqual(
      expect.arrayContaining([gudang.pengguna.id, persediaanSesi.pengguna.id]),
    );
    expect(penghitung.map((p) => p.id)).not.toContain(kasir.pengguna.id);

    const d = await data<DetailPenyesuaian>(
      kirim(kepala, '/api/opname/daftar-harian', { jumlah: 2, idPenghitung: gudang.pengguna.id }),
    );
    expect(d.penghitung?.id).toBe(gudang.pengguna.id);
    expect(d.baris.map((b) => b.idBarang).sort((a, b) => a - b)).toEqual(
      [m.semen, m.pasir].sort((a, b) => a - b),
    );

    // Daftar milik penghitung lain tidak terlihat (isi daftar acak tidak bocor).
    expect((await lihat(persediaanSesi, `/api/penyesuaian/${d.id}`)).status).toBe(403);
    expect((await lihat(persediaanSesi, `/api/opname/${d.id}/lembar`)).status).toBe(403);
    const daftarLain = await json<{ data: { id: number }[] }>(
      await lihat(persediaanSesi, '/api/penyesuaian?jenis=OPNAME'),
    );
    expect(daftarLain.data.map((x) => x.id)).not.toContain(d.id);

    const notifGudang = await data<Notifikasi[]>(lihat(gudang, '/api/notifikasi'));
    expect(notifGudang.map((x) => x.jenis)).toContain('OPNAME_TUGAS');
    const tugas = await data<TugasOpname[]>(lihat(gudang, '/api/opname/tugas'));
    expect(tugas.find((t) => t.id === d.id)).toMatchObject({
      ditugaskan: true,
      dimulai: false,
      belumDihitung: 2,
    });

    // Isi daftar baru tampil setelah "Mulai hitung"; waktu mulai dicatat.
    let lembar = await data<LembarHitung>(lihat(gudang, `/api/opname/${d.id}/lembar`));
    expect(lembar).toMatchObject({ belumMulai: true, baris: [] });
    lembar = await data<LembarHitung>(kirim(gudang, `/api/opname/${d.id}/mulai`));
    expect(lembar.belumMulai).toBe(false);
    expect(lembar.waktuMulaiHitung).not.toBeNull();
    expect(lembar.baris).toHaveLength(2);

    // Gudang menghitung: semen 9 (sistem 10 → −1), pasir 7 (cocok).
    await data(kirim(gudang, `/api/opname/${d.id}/hitung`, { idBarang: m.semen, qty: '9' }));
    const pasir = await data<BarisLembarHitung>(
      kirim(gudang, `/api/opname/${d.id}/hitung`, { idBarang: m.pasir, qty: '7' }),
    );
    expect(pasir.hitunganSaya?.qty).toBe('7.000');
    expect(pasir.perluDihitung).toBe(false);

    // Hitung buta ditegakkan API: penghitung tidak menerima stok sistem, selisih, atau tanda hitung ulang
    // untuk barang yang ia hitung (tidak bisa dipakai menebak stok sistem).
    const buta = await data<DetailPenyesuaian>(lihat(gudang, `/api/penyesuaian/${d.id}`));
    expect(buta.hitungButa).toBe(true);
    const semenButa = buta.baris.find((b) => b.idBarang === m.semen)!;
    expect(semenButa).toMatchObject({
      qtySistem: '0.000',
      qtySelisih: '0.000',
      perluHitungUlang: false,
    });
    expect(semenButa.hitungan.every((h) => h.selisih === null)).toBe(true);
    expect(
      (await data<Notifikasi[]>(lihat(kepala, '/api/notifikasi'))).map((x) => x.jenis),
    ).toContain('OPNAME_SIAP_DIPERIKSA');

    let isi = await data<DetailPenyesuaian>(lihat(kepala, `/api/penyesuaian/${d.id}`));
    const semen = isi.baris.find((b) => b.idBarang === m.semen)!;
    expect(semen).toMatchObject({
      qtySistem: '10.000',
      perluHitungUlang: true,
      terkonfirmasi: false,
    });
    expect(semen.hitungan[0]).toMatchObject({
      namaPenghitung: gudang.pengguna.namaPengguna,
      selisih: '-1.000',
    });

    // Penghitung tidak bisa menyelesaikan; tanpa sebab ditolak; tanpa hitung ulang ditolak.
    expect((await kirim(gudang, `/api/penyesuaian/${d.id}/selesai`)).status).toBe(403);
    expect(await pesan(kirim(kepala, `/api/penyesuaian/${d.id}/selesai`))).toContain(
      'pilih sebabnya',
    );
    await data(
      kirim(
        kepala,
        `/api/penyesuaian/${d.id}`,
        barisSebab(isi, { [m.semen]: 'SALAH_SERAH' }),
        'PUT',
      ),
    );
    expect(await pesan(kirim(kepala, `/api/penyesuaian/${d.id}/selesai`))).toContain(
      'dihitung ulang oleh orang lain',
    );

    // Tugas dipindah ke Admin Persediaan untuk hitung ulang; gudang tidak lagi melihatnya.
    await data(
      kirim(
        kepala,
        `/api/opname/${d.id}/penghitung`,
        { idPenghitung: persediaanSesi.pengguna.id },
        'PATCH',
      ),
    );
    expect((await lihat(gudang, `/api/opname/${d.id}/lembar`)).status).toBe(403);
    lembar = await data<LembarHitung>(kirim(persediaanSesi, `/api/opname/${d.id}/mulai`));
    expect(lembar.baris.filter((b) => b.perluDihitung).map((b) => b.idBarang)).toEqual([m.semen]);
    expect(lembar.baris.find((b) => b.idBarang === m.semen)).toMatchObject({
      dihitungOrangLain: true,
      hitunganSaya: null,
    });

    // Hitungan ulang berbeda (8) → belum terkonfirmasi; dihitung lagi 9 → sama dengan gudang.
    await data(
      kirim(persediaanSesi, `/api/opname/${d.id}/hitung`, { idBarang: m.semen, qty: '8' }),
    );
    expect((await kirim(kepala, `/api/penyesuaian/${d.id}/selesai`)).status).toBe(400);
    await data(
      kirim(persediaanSesi, `/api/opname/${d.id}/hitung`, { idBarang: m.semen, qty: '9' }),
    );
    isi = await data<DetailPenyesuaian>(lihat(kepala, `/api/penyesuaian/${d.id}`));
    expect(isi.baris.find((b) => b.idBarang === m.semen)).toMatchObject({
      terkonfirmasi: true,
      qtyFisik: '9.000',
    });
    expect(isi.baris.find((b) => b.idBarang === m.semen)?.hitungan).toHaveLength(3);
    const selesai = await data<DetailPenyesuaian>(
      kirim(kepala, `/api/penyesuaian/${d.id}/selesai`),
    );
    expect(selesai.baris.find((b) => b.idBarang === m.semen)).toMatchObject({
      qtySelisih: '-1.000',
      sebabSelisih: 'SALAH_SERAH',
    });

    const r2 = await data<RingkasanOpname>(lihat(kepala, '/api/opname/ringkasan'));
    expect(r2).toMatchObject({
      barisDihitung30Hari: 2,
      akurasi30Hari: 50,
      belumDihitungTahunIni: 0,
    });

    const k = await data<KinerjaOpname>(lihat(kepala, '/api/opname/kinerja'));
    expect(k.bulan.at(-1)).toMatchObject({
      dihitung: 2,
      cocok: 1,
      akurasi: 50,
      nilaiBersih: -10000,
    });
    expect(k.penghitung.find((p) => p.idPengguna === gudang.pengguna.id)).toMatchObject({
      hitungan: 2,
      tepat: 2,
    });
    expect(k.penghitung.find((p) => p.idPengguna === persediaanSesi.pengguna.id)).toMatchObject({
      hitungan: 2,
      tepat: 1,
    });
    expect(k.sebab).toEqual([expect.objectContaining({ sebab: 'SALAH_SERAH', baris: 1 })]);
    expect((await lihat(persediaanSesi, '/api/opname/kinerja')).status).toBe(403);
  });

  it('timbang: data timbang barang; hasil timbang dibulatkan per buah; barang tanpa data ditolak', async () => {
    await saldoAwal(m.semen, '400');
    const timbang = `/api/opname/barang/${m.semen}/timbang`;
    expect(
      (await kirim(gudang, timbang, { jumlahSampel: '50', beratSampelGram: '125' }, 'PUT')).status,
    ).toBe(403);
    expect(
      (await kirim(kepala, timbang, { jumlahSampel: '50', beratSampelGram: '' }, 'PUT')).status,
    ).toBe(400);
    expect(
      await data(kirim(kepala, timbang, { jumlahSampel: '50', beratSampelGram: '125' }, 'PUT')),
    ).toEqual({ jumlahSampel: '50.000', beratSampelGram: '125.000' });
    const brg = await data<{ timbang: unknown }>(lihat(kepala, `/api/barang/${m.semen}`));
    expect(brg.timbang).toEqual({ jumlahSampel: '50.000', beratSampelGram: '125.000' });

    // Lembar terbuka (tanpa penugasan) buatan Admin Persediaan; gudang menimbang.
    const d = await data<DetailPenyesuaian>(
      kirim(persediaanSesi, '/api/penyesuaian', {
        jenis: 'OPNAME',
        baris: [
          { idBarang: m.semen, qtyFisik: null },
          { idBarang: m.pasir, qtyFisik: null },
        ],
      }),
    );
    expect(
      await pesan(
        kirim(gudang, `/api/opname/${d.id}/hitung`, {
          idBarang: m.pasir,
          cara: 'TIMBANG',
          beratGram: '100',
        }),
      ),
    ).toContain('belum punya data timbang');
    // 1.001 g × 50 ÷ 125 g = 400,4 → 400 buah.
    const b = await data<BarisLembarHitung>(
      kirim(gudang, `/api/opname/${d.id}/hitung`, {
        idBarang: m.semen,
        cara: 'TIMBANG',
        beratGram: '1001',
      }),
    );
    expect(b.hitunganSaya).toMatchObject({
      qty: '400.000',
      cara: 'TIMBANG',
      beratGram: '1001.000',
    });
    expect(b).toMatchObject({
      satuanBulat: true,
      timbang: { jumlahSampel: '50.000', beratSampelGram: '125.000' },
    });
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'OPNAME_HITUNG'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('ditimbang 1001 g');
  });

  it('toleransi: selisih kecil kelas C tanpa hitung ulang, kelas A selalu; Owner boleh mengesampingkan (tercatat)', async () => {
    await aturKonfigurasi({ opname_toleransi_rp: '50000' });
    await saldoAwal(m.semen, '10');
    await saldoAwal(m.pasir, '10', 3000);
    await jualLangsung(m.semen, '1'); // semen satu-satunya yang laku → kelas A; sistem 9
    const d = await data<DetailPenyesuaian>(
      kirim(persediaanSesi, '/api/penyesuaian', {
        jenis: 'OPNAME',
        baris: [
          { idBarang: m.semen, qtyFisik: '8' },
          { idBarang: m.pasir, qtyFisik: '9' },
        ],
      }),
    );
    let isi = await data<DetailPenyesuaian>(lihat(kepala, `/api/penyesuaian/${d.id}`));
    expect(isi.toleransiRp).toBe(50000);
    expect(isi.baris.find((b) => b.idBarang === m.semen)).toMatchObject({
      kelas: 'A',
      perluHitungUlang: true,
    });
    expect(isi.baris.find((b) => b.idBarang === m.pasir)).toMatchObject({
      kelas: 'C',
      perluHitungUlang: false,
    });
    await data(
      kirim(
        kepala,
        `/api/penyesuaian/${d.id}`,
        barisSebab(isi, { [m.semen]: 'HILANG', [m.pasir]: 'SALAH_INPUT' }),
        'PUT',
      ),
    );
    expect(await pesan(kirim(kepala, `/api/penyesuaian/${d.id}/selesai`))).toContain('Semen');

    // Owner boleh menyelesaikan tanpa hitung ulang; tercatat di log.
    const owner = await sesiUji('OWNER');
    isi = await data<DetailPenyesuaian>(kirim(owner, `/api/penyesuaian/${d.id}/selesai`));
    expect(isi.status).toBe('SELESAI');
    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENYESUAIAN_SELESAI'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log?.ringkasan).toContain('Owner menyetujui tanpa hitung ulang: Semen Gresik 40 kg');
    expect(log?.ringkasan).not.toContain('Pasir');

    // Owner menghitung sendiri lalu menyetujui: boleh, tercatat.
    const d2 = await data<DetailPenyesuaian>(
      kirim(owner, '/api/penyesuaian', {
        jenis: 'OPNAME',
        baris: [{ idBarang: m.pasir, qtyFisik: '8', sebabSelisih: 'RUSAK' }],
      }),
    );
    await data(kirim(owner, `/api/penyesuaian/${d2.id}/selesai`));
    const [log2] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENYESUAIAN_SELESAI'))
      .orderBy(desc(logAktivitas.id))
      .limit(1);
    expect(log2?.ringkasan).toContain('Owner menyetujui hitungannya sendiri: Pasir');
  });
});
