import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  aturKonfigurasi,
  json,
  minta,
  PASSWORD_UJI,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../../test/pembantu';
import { db } from '../../../db/client';
import { logAktivitas } from '../../../db/schema';
import { dalamTransaksi } from '../../../lib/transaksi';
import { terbitkanNomor } from '../penomoran';

type Galat = { error: { kode: string; pesan: string } };
type Pengaturan = {
  profil: { namaToko: string; footerStruk: string; lebarStrukMm: number };
  penomoran: { prefix: Record<string, string>; digitNomor: number };
  keamanan: { passwordMin: number };
};

let admin: Awaited<ReturnType<typeof sesiUji>>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  admin = await sesiUji('ADMIN');
});

function ubah(body: unknown, cookie = admin.cookie) {
  return minta('/api/pengaturan', { method: 'PATCH', cookie, body });
}

async function baca(): Promise<Pengaturan> {
  return (
    await json<{ data: Pengaturan }>(await minta('/api/pengaturan', { cookie: admin.cookie }))
  ).data;
}

describe('pengaturan › izin (docs/04 §3: Admin dan Owner)', () => {
  it('Kasir dan Staf ditolak 403; Admin dan Owner boleh', async () => {
    for (const peran of ['KASIR', 'STAF_PENJUALAN'] as const) {
      const { cookie } = await sesiUji(peran);
      expect((await minta('/api/pengaturan', { cookie })).status).toBe(403);
    }
    const owner = await sesiUji('OWNER');
    expect((await minta('/api/pengaturan', { cookie: owner.cookie })).status).toBe(200);
    expect((await minta('/api/pengaturan', { cookie: admin.cookie })).status).toBe(200);
  });
});

describe('pengaturan › baca dan ubah', () => {
  it('nilai bawaan dipakai bila konfigurasi belum ada', async () => {
    const p = await baca();
    expect(p.profil.namaToko).toBe('BonsaiUrip');
    expect(p.penomoran.prefix.STR).toBe('STR');
    expect(p.keamanan.passwordMin).toBe(8);
  });

  it('hanya nilai yang berubah disimpan dan dicatat PENGATURAN_UBAH (lama → baru)', async () => {
    await aturKonfigurasi({
      nama_toko: 'BonsaiUrip',
      nama_badan_usaha: 'UD. Sumber Urip',
      alamat_toko: 'Peterongan',
      telp_toko: '(0321) 862620',
      email_toko: '',
      footer_struk: 'Terima kasih.',
      lebar_struk_mm: '80',
    });
    const sekarang = await baca();

    const res = await ubah({
      profil: { ...sekarang.profil, footerStruk: 'Barang yang dibeli tidak dapat ditukar.' },
    });
    expect(res.status).toBe(200);
    expect((await json<{ data: Pengaturan }>(res)).data.profil.footerStruk).toBe(
      'Barang yang dibeli tidak dapat ditukar.',
    );

    const [log] = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENGATURAN_UBAH'))
      .orderBy(desc(logAktivitas.id));
    expect(log?.idPengguna).toBe(admin.pengguna.id);
    expect(log?.dataLama).toEqual({ footer_struk: 'Terima kasih.' });
    expect(log?.dataBaru).toEqual({ footer_struk: 'Barang yang dibeli tidak dapat ditukar.' });
  });

  it('tanpa perubahan tidak menulis log', async () => {
    const sekarang = await baca();
    await ubah({ profil: sekarang.profil });
    const log = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENGATURAN_UBAH'));
    // Baris konfigurasi belum ada → nilai bawaan dianggap perubahan pertama kali; kirim ulang = tanpa log.
    const jumlahAwal = log.length;
    await ubah({ profil: sekarang.profil });
    const lagi = await db
      .select()
      .from(logAktivitas)
      .where(eq(logAktivitas.aksi, 'PENGATURAN_UBAH'));
    expect(lagi.length).toBe(jumlahAwal);
  });

  it('prefix baru langsung dipakai penomoran berikutnya (N2); nomor lama tidak berubah', async () => {
    const lama = await dalamTransaksi((tx) => terbitkanNomor(tx, 'ORD', '2026-09-30'));
    const p = await baca();
    const res = await ubah({
      penomoran: { ...p.penomoran, prefix: { ...p.penomoran.prefix, ORD: 'po' } },
    });
    expect(res.status).toBe(200);

    const baru = await dalamTransaksi((tx) => terbitkanNomor(tx, 'ORD', '2026-09-30'));
    expect(lama).toBe('ORD-260930-001');
    expect(baru).toBe('PO-260930-001');
  });

  it('password minimal baru langsung berlaku untuk ganti password', async () => {
    const p = await baca();
    await ubah({ keamanan: { ...p.keamanan, passwordMin: 12 } });
    const res = await minta('/api/auth/ganti-password', {
      method: 'POST',
      cookie: admin.cookie,
      body: { passwordLama: PASSWORD_UJI, passwordBaru: 'sepuluh-10', konfirmasi: 'sepuluh-10' },
    });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.pesan).toBe('Password minimal 12 karakter.');
  });
});

describe('pengaturan › validasi', () => {
  it('prefix dokumen yang sama dipakai dua jenis ditolak', async () => {
    const p = await baca();
    const res = await ubah({
      penomoran: { ...p.penomoran, prefix: { ...p.penomoran.prefix, INV: 'STR' } },
    });
    expect(res.status).toBe(400);
    expect((await json<Galat>(res)).error.pesan).toBe('Prefix STR sudah dipakai STR.');
  });

  it('lebar struk selain 58/80 dan body kosong ditolak', async () => {
    const p = await baca();
    const lebar = await ubah({ profil: { ...p.profil, lebarStrukMm: 70 } });
    expect(lebar.status).toBe(400);
    expect((await json<Galat>(lebar)).error.pesan).toBe('Lebar struk hanya 58 atau 80 mm.');

    const kosong = await ubah({});
    expect(kosong.status).toBe(400);
    expect((await json<Galat>(kosong)).error.pesan).toBe('Tidak ada pengaturan yang dikirim.');
  });
});
