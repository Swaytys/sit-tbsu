import { asc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { kosongkanTabel } from '../../test/reset';
import { cocokPassword } from '../lib/password';
import { db } from './client';
import { isiDataAwal } from './data-awal';
import {
  jenisAtribut,
  kategori,
  konfigurasi,
  pengguna,
  penghitungNomor,
  satuan,
  tingkatHarga,
} from './schema';

const PASSWORD = 'password-seed-uji';

beforeEach(async () => {
  await kosongkanTabel(
    konfigurasi,
    satuan,
    jenisAtribut,
    tingkatHarga,
    kategori,
    pengguna,
    penghitungNomor,
  );
});

describe('seed data awal (docs/03 §6)', () => {
  it('idempoten: jalan kedua tidak menambah baris', async () => {
    const pertama = await isiDataAwal(db, { passwordOwner: PASSWORD, akunDemo: false });
    expect(pertama).toMatchObject({ satuan: 21, tingkatHarga: 3, kategori: 13, pengguna: 1 });
    expect(pertama.konfigurasi).toBeGreaterThan(30);

    const kedua = await isiDataAwal(db, { passwordOwner: PASSWORD, akunDemo: false });
    expect(Object.values(kedua).every((n) => n === 0)).toBe(true);
  });

  it('owner dibuat dengan kode dari penomoran, password argon2id, wajib ganti password', async () => {
    await isiDataAwal(db, { passwordOwner: PASSWORD, akunDemo: false });
    const [owner] = await db.select().from(pengguna).where(eq(pengguna.username, 'owner'));
    expect(owner).toMatchObject({ kode: 'USR-00001', peran: 'OWNER', wajibGantiPassword: true });
    // docs/04 §7: argon2id, memori 64 MB, iterasi 3, paralel 1.
    expect(owner?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
    expect(await cocokPassword(owner?.passwordHash ?? '', PASSWORD)).toBe(true);
  });

  it('penghitung USR disinkronkan dengan kode lama agar kode baru tidak bentrok', async () => {
    await db.insert(pengguna).values({
      kode: 'USR-00007',
      namaPengguna: 'Data lama',
      username: 'lama',
      passwordHash: 'x',
      peran: 'KASIR',
    });
    await isiDataAwal(db, { passwordOwner: PASSWORD, akunDemo: false });
    const [owner] = await db.select().from(pengguna).where(eq(pengguna.username, 'owner'));
    expect(owner?.kode).toBe('USR-00008');
  });

  it('akun demo per peran hanya dibuat bila diminta, tanpa wajib ganti password', async () => {
    await isiDataAwal(db, { passwordOwner: PASSWORD, akunDemo: false });
    expect(await db.select().from(pengguna)).toHaveLength(1);

    const hasil = await isiDataAwal(db, { passwordOwner: PASSWORD, akunDemo: true });
    expect(hasil.pengguna).toBe(4);
    const demo = await db
      .select({
        username: pengguna.username,
        peran: pengguna.peran,
        wajib: pengguna.wajibGantiPassword,
      })
      .from(pengguna)
      .orderBy(asc(pengguna.kode));
    expect(demo.map((d) => d.username)).toEqual([
      'owner',
      'demo.owner',
      'demo.admin',
      'demo.kasir',
      'demo.staf',
    ]);
    expect(demo.slice(1).every((d) => !d.wajib)).toBe(true);
  });

  it('konfigurasi tambahan docs/05 §15 ikut terisi', async () => {
    await isiDataAwal(db, { passwordOwner: PASSWORD, akunDemo: false });
    const kode = (await db.select({ kode: konfigurasi.kode }).from(konfigurasi)).map((k) => k.kode);
    expect(kode).toEqual(
      expect.arrayContaining(['batas_kunci_order_menit', 'jatuh_tempo_default_hari']),
    );
  });
});
