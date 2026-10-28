import type { HasilContoh, PanduanPenyiapan } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { kosongkanTabel } from '../../../../test/reset';
import { db } from '../../../db/client';
import { isiDataAwal } from '../../../db/data-awal';
import {
  barang,
  hargaBarang,
  jenisAtribut,
  kategori,
  kendaraan,
  pelanggan,
  pemasok,
  rekeningToko,
  satuan,
  sopir,
  tingkatHarga,
} from '../../../db/schema';
import { invalidasiKonfigurasi } from '../konfigurasi/service';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await siapkanMasterPersediaan();
  await kosongkanTabel(
    hargaBarang,
    barang,
    kategori,
    satuan,
    jenisAtribut,
    tingkatHarga,
    pelanggan,
    pemasok,
    kendaraan,
    sopir,
    rekeningToko,
  );
  // Kategori, satuan, tier, dan konfigurasi seperti pemasangan baru (tanpa akun).
  await isiDataAwal(db, { passwordOwner: null, akunDemo: false });
  invalidasiKonfigurasi();
  admin = await sesiUji('ADMIN');
});

const panduan = async () =>
  (await json<{ data: PanduanPenyiapan }>(await minta('/api/penyiapan', { cookie: admin.cookie })))
    .data;
const kirim = async <T>(path: string, body: unknown = {}) => {
  const r = await minta(path, { method: 'POST', cookie: admin.cookie, body });
  return { status: r.status, data: (await json<{ data: T }>(r)).data };
};
const langkah = (p: PanduanPenyiapan, l: string) => p.langkah.find((x) => x.langkah === l)!;

describe('panduan penyiapan pertama (K-168)', () => {
  it('status langkah dari data asli; profil ditandai manual; Kasir ditolak', async () => {
    const awal = await panduan();
    expect(langkah(awal, 'BARANG')).toMatchObject({ selesai: false, jumlah: 0 });
    expect(langkah(awal, 'PROFIL').selesai).toBe(false);
    const tanda = await kirim<PanduanPenyiapan>('/api/penyiapan/tandai', {
      langkah: 'PROFIL',
      selesai: true,
    });
    expect(langkah(tanda.data, 'PROFIL').selesai).toBe(true);
    const kasir = await sesiUji('KASIR');
    expect((await minta('/api/penyiapan', { cookie: kasir.cookie })).status).toBe(403);
  });

  it('contoh 5 barang/pelanggan/pemasok dan 2 kendaraan+2 sopir: tidak dihitung sebagai data asli; tidak bisa diisi dua kali', async () => {
    for (const jenis of ['BARANG', 'PELANGGAN', 'PEMASOK', 'ARMADA']) {
      const r = await kirim<HasilContoh>('/api/penyiapan/contoh', { jenis });
      expect(r.status).toBe(200);
      expect(r.data.gagal).toEqual([]);
      expect(r.data.dibuat).toBe(jenis === 'ARMADA' ? 4 : 5);
    }
    const p = await panduan();
    expect(p.contoh).toEqual({ BARANG: 5, PELANGGAN: 5, PEMASOK: 5, ARMADA: 4 });
    expect(langkah(p, 'BARANG')).toMatchObject({ selesai: false, jumlah: 0 });
    expect(langkah(p, 'PELANGGAN').selesai).toBe(false);
    const [semen] = await db
      .select()
      .from(barang)
      .where(eq(barang.namaBarang, 'Semen Gresik 40 kg'));
    expect(semen?.keterangan).toContain('Data contoh');
    expect((await kirim('/api/penyiapan/contoh', { jenis: 'BARANG' })).status).toBe(409);
  });

  it('nonaktifkan semua contoh sekali klik; setelah itu boleh dibuat lagi', async () => {
    await kirim('/api/penyiapan/contoh', { jenis: 'PELANGGAN' });
    await kirim('/api/penyiapan/contoh', { jenis: 'ARMADA' });
    const r = await kirim<HasilContoh>('/api/penyiapan/contoh/nonaktifkan');
    expect(r.data).toMatchObject({ dinonaktifkan: 9, gagal: [] });
    expect(r.data.panduan.contoh).toEqual({ BARANG: 0, PELANGGAN: 0, PEMASOK: 0, ARMADA: 0 });
    const aktif = await db.select().from(pelanggan).where(eq(pelanggan.statusAktif, 'AKTIF'));
    expect(aktif).toHaveLength(0);
    // Data asli ikut dihitung setelah diisi.
    await db
      .insert(pelanggan)
      .values({ kode: 'PLG-99999', namaPelanggan: 'Pelanggan Asli', noHp: '+6281299990000' });
    expect(langkah(await panduan(), 'PELANGGAN')).toMatchObject({ selesai: true, jumlah: 1 });
  });

  it('pengingat dashboard bisa disembunyikan', async () => {
    const r = await kirim<PanduanPenyiapan>('/api/penyiapan/sembunyikan', { sembunyikan: true });
    expect(r.data.disembunyikan).toBe(true);
  });
});
