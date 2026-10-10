import type {
  BarisRetur,
  BarisVoid,
  DetailPenjualan,
  DetailShift,
  KandidatRetur,
  KandidatVoid,
  ShiftAktif,
} from '@sit/shared';
import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../test/fixtur-persediaan';
import {
  PASSWORD_UJI,
  aturKonfigurasi,
  json,
  minta,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  clericalCheck,
  hargaBarang,
  kasShift,
  logAktivitas,
  pelanggan,
  pengguna,
  persediaan,
  returPenjualan,
  returPenjualanDetail,
  shiftKasir,
  tingkatHarga,
  voidTransaksi,
  voidTransaksiDetail,
} from '../../db/schema';

/*
 * Persetujuan retur/void (docs/04 §6, K-099): atasan menyetujui di tempat dengan mengetik akunnya di layar
 * kasir, batas nilai tanpa persetujuan, dan pembatalan pengajuan yang masih menunggu.
 * Semen Rp 10.000/sak (stok 20). Kasir punya shift terbuka (modal 100.000); Admin tidak membuka shift.
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

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
async function stokSemen() {
  const [p] = await db.select().from(persediaan).where(eq(persediaan.idBarang, m.semen));
  return p!.stokFisik;
}
function jual(qty: string) {
  return kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
    order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty }] },
    pembayaran: [{ metode: 'TUNAI' }],
  });
}
function retur(pj: DetailPenjualan, qtyRetur: string, ubah: Record<string, unknown> = {}) {
  return {
    idPenjualan: pj.id,
    alasan: 'Kelebihan beli',
    penyelesaian: 'REFUND',
    persetujuan: { metodeRefund: 'TUNAI' },
    baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur, kondisi: 'BAIK' }],
    ...ubah,
  };
}
async function kasKasir() {
  const s = await ambil<ShiftAktif>(kasir, '/api/shift/saya');
  return (await ambil<DetailShift>(kasir, `/api/shift/${s.id}`)).kas.map((k) => [
    k.jenis,
    k.nominal,
  ]);
}
async function logTerakhir(aksi: string) {
  const [b] = await db
    .select()
    .from(logAktivitas)
    .where(eq(logAktivitas.aksi, aksi))
    .orderBy(desc(logAktivitas.id))
    .limit(1);
  return b;
}
const akunAdmin = () => ({ username: admin.pengguna.username, password: PASSWORD_UJI });

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
    tingkatHarga,
  );
  await aturKonfigurasi({
    batas_retur_tanpa_persetujuan: '0',
    batas_void_tanpa_persetujuan: '0',
    login_maks_gagal: '3',
  });
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  // Tier sendiri agar tes tidak bergantung pada sisa data tes lain.
  const [t] = await db
    .insert(tingkatHarga)
    .values({ kode: 'NORMAL', nama: 'Normal', markupDefaultPersen: '25', isDefault: true })
    .returning();
  await db.insert(hargaBarang).values({
    idBarang: m.semen,
    idTingkatHarga: t!.id,
    metode: 'TETAP',
    hargaTetap: 10000,
    hargaJual: 10000,
  });
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [{ idBarang: m.semen, qtyFisik: '20', hppSatuan: 8000 }],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
  await kirim(kasir, '/api/shift/buka', { modalAwal: 100000 });
});

describe('persetujuan di tempat (K-099)', () => {
  it('retur: atasan mengetik akunnya di layar kasir → langsung disetujui atas nama atasan, uang dari laci kasir', async () => {
    const pj = await jual('5');
    const r = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj, '2', { atasan: akunAdmin() }));
    expect(r).toMatchObject({
      status: 'DISETUJUI',
      caraPersetujuan: 'DI_TEMPAT',
      namaPengaju: kasir.pengguna.namaPengguna,
      namaPenyetuju: admin.pengguna.namaPengguna,
      totalRetur: 20000,
    });
    expect(await stokSemen()).toBe('17.000');
    // Admin tidak punya shift: refund tunai keluar dari laci kasir yang sedang login.
    expect(await kasKasir()).toEqual([['REFUND_RETUR', 20000]]);
    const log = await logTerakhir('RETUR_SETUJUI');
    expect(log?.idPengguna).toBe(admin.pengguna.id);
    expect(log?.ringkasan).toContain(`di tempat, sesi ${kasir.pengguna.username}`);
    // Tidak ada sesi baru untuk atasan, dan sesi kasir tetap milik kasir.
    const saya = await ambil<{ username: string }>(kasir, '/api/auth/saya');
    expect(saya.username).toBe(kasir.pengguna.username);
  });

  it('password salah: 400 (bukan 401), dokumen tidak dibuat, dicatat, dan akun atasan terkunci seperti gagal login', async () => {
    const pj = await jual('5');
    const salah = retur(pj, '1', {
      atasan: { username: admin.pengguna.username, password: 'tebakan-salah' },
    });
    const g = await galat(kasir, '/api/retur', salah);
    expect(g).toMatchObject({ status: 400, kode: 'VALIDASI' });
    expect(g.pesan).toBe('Username atau password salah.');
    expect(await db.select().from(returPenjualan)).toHaveLength(0);
    const log = await logTerakhir('PERSETUJUAN_GAGAL');
    expect(log?.idPengguna).toBe(admin.pengguna.id);
    expect(log?.ringkasan).toContain(`sesi ${kasir.pengguna.username}`);
    expect(JSON.stringify(log)).not.toContain('tebakan-salah');

    // Percobaan ke-3 mengunci akun atasan; sesudahnya password benar pun ditolak.
    await galat(kasir, '/api/retur', salah);
    const kunci = await galat(kasir, '/api/retur', salah);
    expect(kunci.pesan).toContain('Akun dikunci sampai');
    const terkunci = await galat(kasir, '/api/retur', retur(pj, '1', { atasan: akunAdmin() }));
    expect(terkunci).toMatchObject({ status: 400 });
    expect(terkunci.pesan).toContain('Akun terkunci');
    expect(await db.select().from(returPenjualan)).toHaveLength(0);
    // Sesi kasir tidak terpengaruh.
    expect((await minta('/api/auth/saya', { cookie: kasir.cookie })).status).toBe(200);
  });

  it('akun yang tidak berwenang (Kasir lain) dan akun nonaktif ditolak', async () => {
    const pj = await jual('5');
    const kasir2 = await sesiUji('KASIR');
    const bukanAtasan = await galat(
      kasir,
      '/api/retur',
      retur(pj, '1', {
        atasan: { username: kasir2.pengguna.username, password: PASSWORD_UJI },
      }),
    );
    expect(bukanAtasan).toMatchObject({ status: 403, kode: 'TIDAK_BERIZIN' });
    expect(bukanAtasan.pesan).toContain('tidak berwenang menyetujui');

    await db
      .update(pengguna)
      .set({ statusAktif: 'NONAKTIF' })
      .where(eq(pengguna.id, admin.pengguna.id));
    const nonaktif = await galat(kasir, '/api/retur', retur(pj, '1', { atasan: akunAdmin() }));
    expect(nonaktif.status).toBe(400);
    expect(nonaktif.pesan).toContain('nonaktif');
    expect(await db.select().from(returPenjualan)).toHaveLength(0);
  });

  it('pengajuan MENUNGGU disetujui di tempat belakangan; Kasir tanpa akun atasan tetap tidak bisa menyetujui', async () => {
    const pj = await jual('5');
    const r = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj, '2'));
    expect(r).toMatchObject({ status: 'MENUNGGU', caraPersetujuan: null });
    expect((await galat(kasir, `/api/retur/${r.id}/setujui`, {})).status).toBe(403);
    expect((await galat(kasir, `/api/retur/${r.id}/setujui-di-tempat`, {})).status).toBe(400);

    const ok = await kirim<BarisRetur>(kasir, `/api/retur/${r.id}/setujui-di-tempat`, {
      atasan: akunAdmin(),
    });
    expect(ok).toMatchObject({
      status: 'DISETUJUI',
      caraPersetujuan: 'DI_TEMPAT',
      namaPenyetuju: admin.pengguna.namaPengguna,
    });
    expect(await kasKasir()).toEqual([['REFUND_RETUR', 20000]]);
  });

  it('void: disetujui di tempat; stok kembali dan refund dari laci kasir', async () => {
    const pj = await jual('3');
    const v = await kirim<BarisVoid>(kasir, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Salah input barang',
      persetujuan: { metodeRefund: 'TUNAI' },
      atasan: akunAdmin(),
    });
    expect(v).toMatchObject({
      status: 'DISETUJUI',
      caraPersetujuan: 'DI_TEMPAT',
      namaPenyetuju: admin.pengguna.namaPengguna,
      nominalVoid: 30000,
      nominalRefund: 30000,
    });
    expect(await stokSemen()).toBe('20.000');
    expect(await kasKasir()).toEqual([['REFUND_VOID', 30000]]);
    expect((await logTerakhir('VOID_SETUJUI'))?.idPengguna).toBe(admin.pengguna.id);
  });
});

describe('batas tanpa persetujuan (K-099)', () => {
  it('retur: di dalam batas langsung jadi atas nama Kasir; batas dihitung per transaksi, bukan per dokumen', async () => {
    await aturKonfigurasi({ batas_retur_tanpa_persetujuan: '30000' });
    const pj = await jual('6');
    let [k] = await ambil<KandidatRetur[]>(kasir, `/api/retur/kandidat?cari=${pj.nomor}`);
    expect(k).toMatchObject({ sisaBatasBebas: 30000, retur: [] });

    const r1 = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj, '2'));
    expect(r1).toMatchObject({
      status: 'DISETUJUI',
      caraPersetujuan: 'BATAS_BEBAS',
      namaPenyetuju: kasir.pengguna.namaPengguna,
    });
    expect((await logTerakhir('RETUR_SETUJUI'))?.ringkasan).toContain(
      'tanpa atasan: di bawah batas Rp 30.000',
    );
    expect(await stokSemen()).toBe('16.000');

    // Sisa batas transaksi ini Rp 10.000: retur 2 sak (20.000) berikutnya menunggu atasan.
    [k] = await ambil<KandidatRetur[]>(kasir, `/api/retur/kandidat?cari=${pj.nomor}`);
    expect(k?.sisaBatasBebas).toBe(10000);
    expect(k?.baris[0]).toMatchObject({
      qty: '6.000',
      qtyDiretur: '2.000',
      qtyMenunggu: '0.000',
      qtyBisaRetur: '4.000',
    });
    expect(k?.retur).toEqual([
      expect.objectContaining({ nomor: r1.nomor, status: 'DISETUJUI', totalRetur: 20000 }),
    ]);
    expect(k?.retur[0]?.ringkasan).toContain('2 sak');

    const r2 = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj, '2'));
    expect(r2.status).toBe('MENUNGGU');
    [k] = await ambil<KandidatRetur[]>(kasir, `/api/retur/kandidat?cari=${pj.nomor}`);
    expect(k?.baris[0]).toMatchObject({ qtyMenunggu: '2.000', qtyBisaRetur: '2.000' });
    expect(k?.sisaBatasBebas).toBe(0);
    // Transaksi lain punya batasnya sendiri.
    const pj2 = await jual('1');
    expect((await kirim<BarisRetur>(kasir, '/api/retur', retur(pj2, '1'))).status).toBe(
      'DISETUJUI',
    );
  });

  it('void: di dalam batas langsung jadi; di atas batas menunggu', async () => {
    await aturKonfigurasi({ batas_void_tanpa_persetujuan: '25000' });
    const kecil = await jual('2');
    const [k] = await ambil<KandidatVoid[]>(kasir, `/api/void/kandidat?cari=${kecil.nomor}`);
    expect(k?.sisaBatasBebas).toBe(25000);
    const v = await kirim<BarisVoid>(kasir, '/api/void', {
      idPenjualan: kecil.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Salah input',
      persetujuan: { metodeRefund: 'TUNAI' },
    });
    expect(v).toMatchObject({ status: 'DISETUJUI', caraPersetujuan: 'BATAS_BEBAS' });

    const besar = await jual('3');
    const v2 = await kirim<BarisVoid>(kasir, '/api/void', {
      idPenjualan: besar.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Salah input',
      persetujuan: { metodeRefund: 'TUNAI' },
    });
    expect(v2.status).toBe('MENUNGGU');
  });
});

describe('batalkan pengajuan (K-099)', () => {
  it('retur MENUNGGU dibatalkan pengajunya: tanpa efek, qty bisa diajukan lagi; yang sudah diputuskan tidak bisa', async () => {
    const pj = await jual('5');
    const r = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj, '4'));
    expect((await galat(kasir, `/api/retur/${r.id}/batal`, {})).status).toBe(400);
    const kasir2 = await sesiUji('KASIR');
    const orangLain = await galat(kasir2, `/api/retur/${r.id}/batal`, { alasan: 'iseng' });
    expect(orangLain).toMatchObject({ status: 403 });

    const batal = await kirim<BarisRetur>(kasir, `/api/retur/${r.id}/batal`, {
      alasan: 'Salah qty, seharusnya 3',
    });
    expect(batal).toMatchObject({
      status: 'DIBATALKAN',
      alasanPenolakan: 'Salah qty, seharusnya 3',
      caraPersetujuan: null,
    });
    expect(await stokSemen()).toBe('15.000');
    expect((await logTerakhir('RETUR_BATAL'))?.ringkasan).toContain(r.nomor);
    const [k] = await ambil<KandidatRetur[]>(kasir, `/api/retur/kandidat?cari=${pj.nomor}`);
    expect(k?.baris[0]).toMatchObject({ qtyMenunggu: '0.000', qtyBisaRetur: '5.000' });

    // Diajukan ulang dengan qty benar lalu disetujui: retur yang sudah disetujui tidak bisa dibatalkan.
    const r2 = await kirim<BarisRetur>(
      kasir,
      '/api/retur',
      retur(pj, '3', { atasan: akunAdmin() }),
    );
    for (const sesi of [kasir, admin]) {
      const g = await galat(sesi, `/api/retur/${r2.id}/batal`, { alasan: 'ingin dibalik' });
      expect(g).toMatchObject({ status: 409, kode: 'STATUS_TIDAK_VALID' });
      expect(g.pesan).toContain('tidak bisa dibalik');
    }
    expect((await galat(kasir, `/api/retur/${r.id}/batal`, { alasan: 'dua kali' })).status).toBe(
      409,
    );
    expect(await stokSemen()).toBe('18.000');
  });

  it('void MENUNGGU dibatalkan pengajunya; barangnya bisa diajukan void lagi', async () => {
    const pj = await jual('2');
    const isi = { idPenjualan: pj.id, lingkup: 'TRANSAKSI', alasan: 'Salah transaksi' };
    const v = await kirim<BarisVoid>(kasir, '/api/void', isi);
    expect(v.status).toBe('MENUNGGU');
    expect((await galat(kasir, '/api/void', isi)).status).toBe(409);
    const batal = await kirim<BarisVoid>(kasir, `/api/void/${v.id}/batal`, {
      alasan: 'Tidak jadi',
    });
    expect(batal).toMatchObject({ status: 'DIBATALKAN', alasanPenolakan: 'Tidak jadi' });
    expect((await logTerakhir('VOID_BATAL'))?.ringkasan).toContain(v.nomor);
    expect((await kirim<BarisVoid>(kasir, '/api/void', isi)).status).toBe('MENUNGGU');
  });
});
