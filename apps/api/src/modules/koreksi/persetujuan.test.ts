import type {
  BarisRetur,
  BarisVoid,
  DetailPenjualan,
  DetailShift,
  InfoKodePersetujuan,
  KandidatRetur,
  KandidatVoid,
  ShiftAktif,
} from '@sit/shared';
import { desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import {
  aturKonfigurasi,
  beriEmail,
  json,
  kodeTerkirim,
  minta,
  pesanTerkirim,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { catatPercobaan } from '../../lib/batas-percobaan';
import { BATAS_MINTA_KODE } from '../sistem/kode-persetujuan/service';
import {
  clericalCheck,
  hargaBarang,
  kasShift,
  logAktivitas,
  pelanggan,
  pengguna,
  permintaanPersetujuan,
  persediaan,
  returPenjualan,
  returPenjualanDetail,
  shiftKasir,
  voidTransaksi,
  voidTransaksiDetail,
} from '../../db/schema';

/*
 * Persetujuan retur/void (docs/04 §6, K-099, K-102): kode sekali pakai yang dikirim ke atasan, batas nilai
 * tanpa persetujuan, dan pembatalan pengajuan yang masih menunggu.
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
  await aturKonfigurasi({
    batas_retur_tanpa_persetujuan: '0',
    batas_void_tanpa_persetujuan: '0',
    login_maks_gagal: '3',
  });
  admin = await sesiUji('ADMIN');
  // Admin punya email, jadi bisa menerima kode persetujuan (di tes: kotak keluar uji).
  await beriEmail(admin.pengguna.id);
  kasir = await sesiUji('KASIR');
  const idTier = await siapkanTierNormal();
  await db.insert(hargaBarang).values({
    idBarang: m.semen,
    idTingkatHarga: idTier,
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

describe('kode persetujuan sekali pakai (K-102)', () => {
  /** Kasir mengajukan retur (MENUNGGU) lalu meminta kode untuk atasan. */
  async function returMenunggu(qty = '2') {
    const pj = await jual('5');
    const r = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj, qty));
    expect(r).toMatchObject({ status: 'MENUNGGU', caraPersetujuan: null });
    return r;
  }
  const mintaKode = (sesi: Sesi, path: string) =>
    kirim<InfoKodePersetujuan>(sesi, `${path}/minta-kode`);

  it('retur: tiap atasan menerima kodenya sendiri berisi rincian retur; kode Admin menyetujui atas nama Admin', async () => {
    const owner = await sesiUji('OWNER');
    await beriEmail(owner.pengguna.id);
    const r = await returMenunggu();
    const info = await mintaKode(kasir, `/api/retur/${r.id}`);
    expect(info.penerima).toEqual([
      { nama: admin.pengguna.namaPengguna, saluran: ['EMAIL'] },
      { nama: owner.pengguna.namaPengguna, saluran: ['EMAIL'] },
    ]);
    // Atasan membaca apa yang ia setujui: nomor, barang, nilai, alasan, dan siapa pengajunya.
    const pesan = pesanTerkirim(admin.pengguna.namaPengguna);
    expect(pesan).toContain(r.nomor);
    expect(pesan).toContain('Rp 20.000');
    expect(pesan).toContain('Kelebihan beli');
    expect(pesan).toContain(kasir.pengguna.namaPengguna);
    const kodeAdmin = kodeTerkirim(admin.pengguna.namaPengguna);
    expect(kodeTerkirim(owner.pengguna.namaPengguna)).not.toBe(kodeAdmin);
    // Sebelum kode dipakai tidak ada yang berubah.
    expect(await stokSemen()).toBe('15.000');

    const ok = await kirim<BarisRetur>(kasir, `/api/retur/${r.id}/setujui-kode`, {
      metodeRefund: 'TUNAI',
      kode: { idPermintaan: info.idPermintaan, kode: kodeAdmin },
    });
    expect(ok).toMatchObject({
      status: 'DISETUJUI',
      caraPersetujuan: 'DI_TEMPAT',
      namaPengaju: kasir.pengguna.namaPengguna,
      namaPenyetuju: admin.pengguna.namaPengguna,
    });
    expect(await stokSemen()).toBe('17.000');
    // Admin tidak punya shift: refund tunai keluar dari laci kasir yang sedang login.
    expect(await kasKasir()).toEqual([['REFUND_RETUR', 20000]]);
    const log = await logTerakhir('RETUR_SETUJUI');
    expect(log?.idPengguna).toBe(admin.pengguna.id);
    expect(log?.ringkasan).toContain(`kode sekali pakai, sesi ${kasir.pengguna.username}`);
    expect((await logTerakhir('PERSETUJUAN_KODE_KIRIM'))?.idPengguna).toBe(kasir.pengguna.id);
    // Kodenya tidak pernah tercatat di log, dan tidak ada sesi baru untuk atasan.
    const semuaLog = JSON.stringify(await db.select().from(logAktivitas));
    expect(semuaLog).not.toContain(kodeAdmin);
    const saya = await ambil<{ username: string }>(kasir, '/api/auth/saya');
    expect(saya.username).toBe(kasir.pengguna.username);
  });

  it('kode sekali pakai: tidak bisa dipakai lagi, dan tidak berlaku untuk dokumen lain', async () => {
    const r1 = await returMenunggu('1');
    const info = await mintaKode(kasir, `/api/retur/${r1.id}`);
    const kode = {
      idPermintaan: info.idPermintaan,
      kode: kodeTerkirim(admin.pengguna.namaPengguna),
    };
    const pj2 = await jual('3');
    const r2 = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj2, '1'));
    // Kode untuk retur pertama ditolak pada retur kedua (tanpa menambah hitungan salah ketik retur pertama).
    const lain = await galat(kasir, `/api/retur/${r2.id}/setujui-kode`, {
      metodeRefund: 'TUNAI',
      kode,
    });
    expect(lain).toMatchObject({ status: 400, kode: 'VALIDASI' });
    expect(lain.pesan).toContain('tidak berlaku');

    await kirim(kasir, `/api/retur/${r1.id}/setujui-kode`, { metodeRefund: 'TUNAI', kode });
    const [m1] = await db.select().from(permintaanPersetujuan);
    expect(m1).toMatchObject({ status: 'DIPAKAI', idPenyetuju: admin.pengguna.id });
    // Retur kedua masih menunggu; kode yang sudah dipakai tidak bisa menyetujuinya.
    expect((await ambil<BarisRetur>(kasir, `/api/retur/${r2.id}`)).status).toBe('MENUNGGU');
  });

  it('salah ketik dihitung dan dicatat; 5 kali salah membatalkan kode, kode yang benar pun ditolak', async () => {
    const r = await returMenunggu();
    const info = await mintaKode(kasir, `/api/retur/${r.id}`);
    const benar = kodeTerkirim(admin.pengguna.namaPengguna);
    const salah = benar === '000000' ? '111111' : '000000';
    const coba = (kode: string) =>
      galat(kasir, `/api/retur/${r.id}/setujui-kode`, {
        metodeRefund: 'TUNAI',
        kode: { idPermintaan: info.idPermintaan, kode },
      });
    const g1 = await coba(salah);
    expect(g1).toMatchObject({ status: 400, kode: 'VALIDASI' });
    expect(g1.pesan).toBe('Kode salah. Sisa percobaan: 4.');
    expect((await logTerakhir('PERSETUJUAN_GAGAL'))?.idPengguna).toBe(kasir.pengguna.id);
    for (let i = 0; i < 3; i++) await coba(salah);
    expect((await coba(salah)).pesan).toContain('kode dibatalkan');
    expect((await coba(benar)).pesan).toContain('tidak berlaku');
    expect((await ambil<BarisRetur>(kasir, `/api/retur/${r.id}`)).status).toBe('MENUNGGU');
    expect(await stokSemen()).toBe('15.000');
    // Sesi kasir tidak terpengaruh (galat 400, bukan 401).
    expect((await minta('/api/auth/saya', { cookie: kasir.cookie })).status).toBe(200);
  });

  it('kode kadaluarsa ditolak; meminta kode baru menggantikan kode lama', async () => {
    const r = await returMenunggu();
    const lama = await mintaKode(kasir, `/api/retur/${r.id}`);
    const kodeLama = kodeTerkirim(admin.pengguna.namaPengguna);
    const setujui = (idPermintaan: number, kode: string) =>
      minta(`/api/retur/${r.id}/setujui-kode`, {
        method: 'POST',
        cookie: kasir.cookie,
        body: { metodeRefund: 'TUNAI', kode: { idPermintaan, kode } },
      });

    const baru = await mintaKode(kasir, `/api/retur/${r.id}`);
    const kodeBaru = kodeTerkirim(admin.pengguna.namaPengguna);
    // Kode lama sudah diganti.
    expect((await setujui(lama.idPermintaan, kodeLama)).status).toBe(400);
    // Kode baru yang sudah lewat waktunya juga ditolak.
    await db
      .update(permintaanPersetujuan)
      .set({ kadaluarsaPada: new Date(Date.now() - 1000) })
      .where(eq(permintaanPersetujuan.id, baru.idPermintaan));
    expect((await setujui(baru.idPermintaan, kodeBaru)).status).toBe(400);
    expect((await ambil<BarisRetur>(kasir, `/api/retur/${r.id}`)).status).toBe('MENUNGGU');
  });

  it('hanya pengaju yang bisa meminta dan memakai kode; hanya atasan berwenang dan berkontak yang menerima', async () => {
    const kasir2 = await sesiUji('KASIR');
    await beriEmail(kasir2.pengguna.id); // Kasir beremail bukan atasan: tidak menerima kode.
    const r = await returMenunggu();
    expect((await galat(kasir2, `/api/retur/${r.id}/minta-kode`)).status).toBe(403);
    const info = await mintaKode(kasir, `/api/retur/${r.id}`);
    expect(info.penerima.map((x) => x.nama)).toEqual([admin.pengguna.namaPengguna]);
    // Kode yang benar pun tidak bisa dipakai kasir lain.
    const olehLain = await galat(kasir2, `/api/retur/${r.id}/setujui-kode`, {
      metodeRefund: 'TUNAI',
      kode: {
        idPermintaan: info.idPermintaan,
        kode: kodeTerkirim(admin.pengguna.namaPengguna),
      },
    });
    expect(olehLain.status).toBe(400);
    // Kasir tetap tidak bisa menyetujui tanpa kode.
    expect((await galat(kasir, `/api/retur/${r.id}/setujui`, {})).status).toBe(403);
    expect((await galat(kasir, `/api/retur/${r.id}/setujui-kode`, {})).status).toBe(400);

    // Atasan dinonaktifkan setelah kode dikirim: kodenya tidak lagi berwenang.
    await db
      .update(pengguna)
      .set({ statusAktif: 'NONAKTIF' })
      .where(eq(pengguna.id, admin.pengguna.id));
    const nonaktif = await galat(kasir, `/api/retur/${r.id}/setujui-kode`, {
      metodeRefund: 'TUNAI',
      kode: {
        idPermintaan: info.idPermintaan,
        kode: kodeTerkirim(admin.pengguna.namaPengguna),
      },
    });
    expect(nonaktif.pesan).toContain('tidak lagi berwenang');
    // Tanpa satu pun atasan yang bisa dihubungi, kode tidak bisa diminta.
    const kosong = await galat(kasir, `/api/retur/${r.id}/minta-kode`);
    expect(kosong).toMatchObject({ status: 409, kode: 'KONFLIK' });
    expect(kosong.pesan).toContain('Belum ada Admin/Owner');
  });

  it('batas laju: permintaan kode ke-6 dalam 5 menit ditolak 429 dan tidak mengirim pesan', async () => {
    const r = await returMenunggu();
    for (let i = 0; i < BATAS_MINTA_KODE.maks; i++) {
      catatPercobaan(`minta-kode:${kasir.pengguna.id}`, BATAS_MINTA_KODE);
    }
    const g = await galat(kasir, `/api/retur/${r.id}/minta-kode`);
    expect(g).toMatchObject({ status: 429, kode: 'TERLALU_BANYAK_PERCOBAAN' });
    expect(pesanTerkirim(admin.pengguna.namaPengguna)).toBe('');
  });

  it('void: kode menyetujui; stok kembali dan refund dari laci kasir', async () => {
    const pj = await jual('3');
    const v = await kirim<BarisVoid>(kasir, '/api/void', {
      idPenjualan: pj.id,
      lingkup: 'TRANSAKSI',
      alasan: 'Salah input barang',
      persetujuan: { metodeRefund: 'TUNAI' },
    });
    expect(v.status).toBe('MENUNGGU');
    const info = await mintaKode(kasir, `/api/void/${v.id}`);
    expect(pesanTerkirim(admin.pengguna.namaPengguna)).toContain(v.nomor);
    const ok = await kirim<BarisVoid>(kasir, `/api/void/${v.id}/setujui-kode`, {
      metodeRefund: 'TUNAI',
      kode: {
        idPermintaan: info.idPermintaan,
        kode: kodeTerkirim(admin.pengguna.namaPengguna),
      },
    });
    expect(ok).toMatchObject({
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
    const r2m = await kirim<BarisRetur>(kasir, '/api/retur', retur(pj, '3'));
    const info = await kirim<InfoKodePersetujuan>(kasir, `/api/retur/${r2m.id}/minta-kode`);
    const r2 = await kirim<BarisRetur>(kasir, `/api/retur/${r2m.id}/setujui-kode`, {
      metodeRefund: 'TUNAI',
      kode: {
        idPermintaan: info.idPermintaan,
        kode: kodeTerkirim(admin.pengguna.namaPengguna),
      },
    });
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
