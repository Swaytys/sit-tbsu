import type {
  DaftarShift,
  DetailOrder,
  DetailShift,
  HasilHitungTutup,
  InfoKodePersetujuan,
  Notifikasi,
  ShiftAktif,
  UsulanBukaShift,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
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
import {
  clericalCheck,
  hargaBarang,
  hitungKas,
  kasShift,
  orderPenjualan,
  shiftKasir,
} from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { ingatkanShiftPerluDitutup } from './shift/service';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string; detail?: { perluKeterangan?: boolean } } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

async function kirim<T>(sesi: Sesi, path: string, body?: unknown) {
  const r = await minta(path, { method: 'POST', cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`POST ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

async function galat(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  return { status: r.status, ...(await json<Galat>(r)).error };
}

async function ambil<T>(sesi: Sesi, path: string) {
  const r = await minta(path, { cookie: sesi.cookie });
  if (r.status !== 200) throw new Error(`GET ${path} gagal (${r.status}): ${await r.text()}`);
  return json<T>(r);
}

function jualTunai(sesi: Sesi, qty: string, uang?: number) {
  return kirim<{ id: number; totalNeto: number }>(sesi, '/api/penjualan/checkout', {
    order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty }] },
    pembayaran: [{ metode: 'TUNAI', uangDiterima: uang }],
  });
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(hitungKas, kasShift, clericalCheck, shiftKasir);
  admin = await sesiUji('ADMIN');
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
    baris: [{ idBarang: m.semen, qtyFisik: '50', hppSatuan: 8000 }],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
});

describe('shift kasir & clerical check (docs/05 §10)', () => {
  it('K1/K3/K5 kas manual, saldo sistem = modal + tunai (nominal, bukan uang diterima) + masuk − keluar', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 200000 });
    expect(s.nomor).toMatch(/^SHF-\d{6}-001$/);
    expect((await galat(kasir, '/api/shift/buka', { modalAwal: 0 })).status).toBe(409);

    await jualTunai(kasir, '3', 50000); // 30.000, kembalian 20.000
    await jualTunai(kasir, '1'); // 10.000
    await kirim(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '2' }] },
      pembayaran: [{ metode: 'TRANSFER', rekening: 'BCA' }],
    }); // non-tunai: tidak masuk laci
    await kirim(kasir, '/api/shift/kas', {
      jenis: 'KASBON',
      nominal: 15000,
      keterangan: 'Pak Budi',
    });
    await kirim(kasir, '/api/shift/kas', { jenis: 'TARIK_OWNER', nominal: 50000 });
    const tanpaKet = await galat(kasir, '/api/shift/kas', { jenis: 'KELUAR_LAIN', nominal: 1000 });
    expect(tanpaKet.status).toBe(400);
    const staf = await sesiUji('STAF_PENJUALAN');
    expect((await galat(staf, '/api/shift/kas', { jenis: 'TARIK_OWNER', nominal: 1 })).status).toBe(
      403,
    );

    // K4: kasir tidak melihat angka sistem shift yang masih BUKA; Admin melihat.
    const dKasir = (await ambil<{ data: DetailShift }>(kasir, `/api/shift/${s.id}`)).data;
    expect(dKasir.ringkasan).toBeNull();
    expect(dKasir.kas.map((k) => [k.jenis, k.arah, k.nominal])).toEqual([
      ['KASBON', 'KELUAR', 15000],
      ['TARIK_OWNER', 'MASUK', 50000],
    ]);
    const dAdmin = (await ambil<{ data: DetailShift }>(admin, `/api/shift/${s.id}`)).data;
    expect(dAdmin.ringkasan).toEqual({
      modalAwal: 200000,
      koreksiModal: 0,
      tunaiPenjualan: 40000,
      kasMasukLain: 50000,
      kasKeluar: 15000,
      saldoSistem: 275000,
      jumlahTransaksi: 2,
    });
  });

  it('K4/K5 blind count: selisih dihitung server; selisih ≠ 0 wajib keterangan; hasil tampil setelah tutup', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 100000 });
    await jualTunai(kasir, '2'); // saldo 120.000

    const kurang = await galat(kasir, `/api/shift/${s.id}/tutup`, { uangFisik: 115000 });
    expect(kurang.status).toBe(409);
    expect(kurang.detail?.perluKeterangan).toBe(true);
    expect(kurang.pesan).not.toContain('120'); // angka sistem tidak dibocorkan
    const tutup = await kirim<DetailShift>(kasir, `/api/shift/${s.id}/tutup`, {
      uangFisik: 115000,
      keterangan: 'Uang receh kurang',
    });
    expect(tutup.status).toBe('TUTUP');
    expect(tutup.clerical).toMatchObject({
      saldoSistem: 120000,
      uangFisik: 115000,
      selisih: -5000,
      keterangan: 'Uang receh kurang',
      namaPemeriksa: kasir.pengguna.namaPengguna,
    });
    expect(tutup.clerical?.nomor).toMatch(/^CLC-/);
    expect(tutup.ringkasan?.saldoSistem).toBe(120000);

    // K6/K7: setelah tutup tidak bisa transaksi tunai, tidak bisa ditutup lagi.
    expect((await galat(kasir, `/api/shift/${s.id}/tutup`, { uangFisik: 0 })).kode).toBe(
      'STATUS_TIDAK_VALID',
    );
    const r = await minta('/api/penjualan/checkout', {
      method: 'POST',
      cookie: kasir.cookie,
      body: {
        order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
        pembayaran: [{ metode: 'TUNAI' }],
      },
    });
    expect(r.status).toBe(409);
    expect((await ambil<{ data: ShiftAktif | null }>(kasir, '/api/shift/saya')).data).toBeNull();
  });

  it('K6 order DIPROSES kasir kembali ke antrean saat tutup; Admin boleh menutup shift kasir lain', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    const staf = await sesiUji('STAF_PENJUALAN');
    const o = await kirim<DetailOrder>(staf, '/api/order?kirim=true', {
      jenisPenjualan: 'LANGSUNG',
      baris: [{ idBarang: m.semen, qty: '1' }],
    });
    await kirim(kasir, `/api/order/${o.id}/proses`);

    const kasir2 = await sesiUji('KASIR');
    expect((await galat(kasir2, `/api/shift/${s.id}/tutup`, { uangFisik: 0 })).status).toBe(404);
    const tutup = await kirim<DetailShift>(admin, `/api/shift/${s.id}/tutup`, { uangFisik: 0 });
    expect(tutup.clerical?.namaPemeriksa).toBe(admin.pengguna.namaPengguna);
    const [order] = await db.select().from(orderPenjualan).where(eq(orderPenjualan.id, o.id));
    expect(order).toMatchObject({ status: 'MENUNGGU', idKasirProses: null });
  });

  it('K8 riwayat: Admin melihat semua shift, kasir hanya miliknya; saring selisih', async () => {
    const s1 = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    await kirim(kasir, `/api/shift/${s1.id}/tutup`, { uangFisik: 1000, keterangan: 'lebih' });
    const kasir2 = await sesiUji('KASIR');
    const s2 = await kirim<ShiftAktif>(kasir2, '/api/shift/buka', { modalAwal: 0 });
    await kirim(kasir2, `/api/shift/${s2.id}/tutup`, { uangFisik: 0 });

    const semua = await ambil<DaftarShift>(admin, '/api/shift');
    expect(semua.data.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
    const milik = await ambil<DaftarShift>(kasir2, '/api/shift');
    expect(milik.data.map((s) => s.id)).toEqual([s2.id]);
    expect((await galat(kasir2, `/api/shift/${s1.id}`, undefined, 'GET')).status).toBe(404);
    const selisih = await ambil<DaftarShift>(admin, '/api/shift?adaSelisih=true');
    expect(selisih.data.map((s) => [s.id, s.clerical?.selisih])).toEqual([[s1.id, 1000]]);
  });

  it('K10 jadwal shift dibekukan saat dibuka; lewat jam tutup hanya peringatan (penjualan tetap bisa)', async () => {
    await aturKonfigurasi({ shift_jam_buka: '08:00', shift_jam_tutup: '23:59' });
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    expect(s).toMatchObject({
      jadwalBuka: '08:00',
      jadwalTutup: '23:59',
      lewatJadwal: false,
      terlewat: false,
    });
    expect(s.batasTutup).not.toBeNull();
    // Pengaturan diubah saat shift berjalan: shift ini tetap memakai jadwal lamanya.
    await aturKonfigurasi({ shift_jam_tutup: '00:00' });
    let saya = (await ambil<{ data: ShiftAktif }>(kasir, '/api/shift/saya')).data;
    expect(saya).toMatchObject({ jadwalTutup: '23:59', lewatJadwal: false });
    let notif = (await ambil<{ data: Notifikasi[] }>(kasir, '/api/notifikasi')).data;
    expect(notif.some((n) => n.jenis === 'SHIFT_SAYA_PERLU_DITUTUP')).toBe(false);

    // Jam tutup shift ini sudah lewat: peringatan untuk kasir dan atasan, penjualan masih diterima.
    await db.update(shiftKasir).set({ jadwalTutup: '00:00' }).where(eq(shiftKasir.id, s.id));
    saya = (await ambil<{ data: ShiftAktif }>(kasir, '/api/shift/saya')).data;
    expect(saya).toMatchObject({ lewatJadwal: true, terlewat: false });
    notif = (await ambil<{ data: Notifikasi[] }>(kasir, '/api/notifikasi')).data;
    expect(notif.find((n) => n.jenis === 'SHIFT_SAYA_PERLU_DITUTUP')?.tautan).toBe('/shift');
    const notifAdmin = (await ambil<{ data: Notifikasi[] }>(admin, '/api/notifikasi')).data;
    expect(notifAdmin.find((n) => n.jenis === 'SHIFT_PERLU_DITUTUP')?.jumlah).toBe(1);
    await jualTunai(kasir, '1');

    // Shift yang dibuka setelah perubahan memakai jadwal baru.
    await kirim(kasir, `/api/shift/${s.id}/tutup`, { uangFisik: 10000 });
    const baru = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    expect(baru).toMatchObject({ jadwalBuka: '08:00', jadwalTutup: '00:00' });
  });

  it('K9 shift dari hari sebelumnya mengunci penjualan dan kas sampai ditutup; K11 atasan diingatkan sekali sehari', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 50000 });
    await jualTunai(kasir, '1');
    await db
      .update(shiftKasir)
      .set({ tanggalOperasional: tambahHari(tanggalOperasional(), -1) })
      .where(eq(shiftKasir.id, s.id));

    const saya = (await ambil<{ data: ShiftAktif }>(kasir, '/api/shift/saya')).data;
    expect(saya.terlewat).toBe(true);
    // Tunai, non-tunai, dan kas manual semuanya ditolak dengan petunjuk menutup shift lama.
    const tunai = await galat(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: 10000 }],
    });
    expect(tunai).toMatchObject({ status: 409, kode: 'KONFLIK' });
    expect(tunai.pesan).toContain(`Shift ${s.nomor}`);
    expect(tunai.pesan).toContain('belum ditutup');
    const transfer = await galat(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
      pembayaran: [{ metode: 'TRANSFER', rekening: 'BCA 123' }],
    });
    expect(transfer.status).toBe(409);
    expect(
      (
        await galat(kasir, '/api/shift/kas', {
          jenis: 'MASUK_LAIN',
          nominal: 1000,
          keterangan: 'x',
        })
      ).status,
    ).toBe(409);
    expect((await galat(kasir, '/api/shift/buka', { modalAwal: 0 })).status).toBe(409);

    // Daftar "perlu ditutup" dan pengingat ke atasan (sekali per hari per shift).
    const perlu = await ambil<DaftarShift>(admin, '/api/shift?perluDitutup=true');
    expect(perlu.data.map((x) => x.id)).toEqual([s.id]);
    expect(perlu.data[0]?.waktu).toMatchObject({ terlewat: true });
    await beriEmail(admin.pengguna.id);
    expect(await ingatkanShiftPerluDitutup()).toBe(1);
    expect(pesanTerkirim(admin.pengguna.namaPengguna)).toContain(s.nomor);
    expect(await ingatkanShiftPerluDitutup()).toBe(0);

    // Setelah shift lama ditutup (di sini oleh Admin), kasir bisa membuka shift baru dan menjual lagi.
    await kirim(admin, `/api/shift/${s.id}/tutup`, { uangFisik: 60000 });
    expect((await ambil<DaftarShift>(admin, '/api/shift?perluDitutup=true')).data).toHaveLength(0);
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    await jualTunai(kasir, '1');
  });

  it('K2/E4 penerimaan tunai dari laci butuh shift dan tercatat sebagai kas keluar BAYAR_PEMASOK', async () => {
    const terima = (metodeBayar: string) =>
      minta('/api/penerimaan', {
        method: 'POST',
        cookie: admin.cookie,
        body: {
          idPemasok: m.pemasokA,
          jenis: 'PEMBELIAN',
          syaratBayar: 'TUNAI',
          metodeBayar,
          baris: [{ idBarang: m.semen, qtyMasuk: '2', hargaModalMasuk: 8000 }],
        },
      });
    expect((await terima('TUNAI')).status).toBe(409);
    expect((await terima('TRANSFER')).status).toBe(201);
    const s = await kirim<ShiftAktif>(admin, '/api/shift/buka', { modalAwal: 50000 });
    expect((await terima('TUNAI')).status).toBe(201);
    const d = (await ambil<{ data: DetailShift }>(admin, `/api/shift/${s.id}`)).data;
    expect(d.kas).toHaveLength(1);
    expect(d.kas[0]).toMatchObject({ jenis: 'BAYAR_PEMASOK', arah: 'KELUAR', nominal: 16000 });
    expect(d.kas[0]?.nomorDokumen).toMatch(/^PBP-/);
    expect(d.ringkasan?.saldoSistem).toBe(34000);
  });
});

describe('buka/tutup shift dan anomali kas (docs/05 §10 K15–K23, K-121)', () => {
  /** Shift ditutup dengan uang ditinggal `ditinggal`, supaya shift berikutnya punya usulan modal. */
  async function shiftKemarin(ditinggal: number) {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: ditinggal });
    await kirim(kasir, `/api/shift/${s.id}/tutup`, {
      uangFisik: ditinggal,
      uangDitinggal: ditinggal,
    });
  }

  it('K15 buka tiga cara: sama dengan kemarin, hitung per pecahan, tanpa riwayat ditolak', async () => {
    const tanpa = await galat(kasir, '/api/shift/buka', { cara: 'SAMA_KEMARIN' });
    expect(tanpa.status).toBe(409);
    expect(tanpa.pesan).toContain('Hitung sekarang');

    await shiftKemarin(150000);
    const usulan = (await ambil<{ data: UsulanBukaShift }>(kasir, '/api/shift/usulan-buka')).data;
    expect(usulan.uangDitinggal).toBe(150000);
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { cara: 'SAMA_KEMARIN' });
    expect(s.modalAwal).toBe(150000);
    expect(s.caraBuka).toBe('SAMA_KEMARIN');
    await kirim(kasir, `/api/shift/${s.id}/tutup`, { uangFisik: 150000, uangDitinggal: 120000 });

    // Hitung per pecahan: total dari rincian; total yang tidak cocok ditolak.
    const salah = await galat(kasir, '/api/shift/buka', {
      cara: 'HITUNG',
      modalAwal: 100000,
      rincian: { '50000': 2, '1000': 3 },
    });
    expect(salah.status).toBe(400);
    const h = await kirim<ShiftAktif>(kasir, '/api/shift/buka', {
      cara: 'HITUNG',
      rincian: { '50000': 2, '1000': 3, '500': 4 },
    });
    expect(h.modalAwal).toBe(105000);
    const d = await ambil<{ data: DetailShift }>(admin, `/api/shift/${h.id}`);
    expect(d.data.hitungan).toMatchObject([
      { jenis: 'BUKA', uangFisik: 105000, saldoSistem: 120000, rincian: { '50000': 2 } },
    ]);
  });

  it('K16 hitung nanti: modal saat buka = hitungan − tunai bersih sejak buka; selisih semalam jadi koreksi', async () => {
    await shiftKemarin(150000);
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { cara: 'HITUNG_NANTI' });
    expect(s.modalAwal).toBe(150000);
    expect(s.batasHitungBuka).not.toBeNull();
    const notif = await ambil<{ data: Notifikasi[] }>(kasir, '/api/notifikasi');
    expect(notif.data.some((n) => n.jenis === 'SHIFT_HITUNG_BUKA')).toBe(true);

    await jualTunai(kasir, '2', 50000); // tunai masuk 20.000 (kembalian 30.000)
    await kirim(kasir, '/api/shift/kas', { jenis: 'KASBON', nominal: 5000, keterangan: 'Budi' });
    // Laci 160.000; tunai bersih sejak buka 15.000; modal saat buka 145.000 (semalam kurang 5.000).
    const h = await kirim<ShiftAktif>(kasir, `/api/shift/${s.id}/hitung-buka`, {
      uangFisik: 160000,
    });
    expect(h.batasHitungBuka).toBeNull();
    expect(h.koreksiModal).toBe(-5000);
    const ulang = await galat(kasir, `/api/shift/${s.id}/hitung-buka`, { uangFisik: 160000 });
    expect(ulang.status).toBe(409);
    const d = await ambil<{ data: DetailShift }>(admin, `/api/shift/${s.id}`);
    expect(d.data.ringkasan).toMatchObject({
      modalAwal: 145000,
      koreksiModal: -5000,
      saldoSistem: 160000,
    });
    expect(d.data.kas.find((k) => k.jenis === 'KOREKSI_MODAL_KURANG')?.keterangan).toContain(
      'selisih semalam',
    );
  });

  it('K17 koreksi modal: bebas sebelum transaksi tunai; sesudahnya kode atasan yang terikat nilainya', async () => {
    await beriEmail(admin.pengguna.id);
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 15000 });
    const d1 = await kirim<DetailShift>(kasir, `/api/shift/${s.id}/koreksi-modal`, {
      modalBenar: 150000,
      alasan: 'Salah ketik, kurang nol',
    });
    expect(d1.kas.at(-1)).toMatchObject({ jenis: 'KOREKSI_MODAL_TAMBAH', nominal: 135000 });

    await jualTunai(kasir, '1');
    const isi = { modalBenar: 140000, alasan: 'Uang receh terhitung dua kali' };
    const tolak = await galat(kasir, `/api/shift/${s.id}/koreksi-modal`, isi);
    expect(tolak.status).toBe(403);
    const info = await kirim<InfoKodePersetujuan>(
      kasir,
      `/api/shift/${s.id}/koreksi-modal/minta-kode`,
      isi,
    );
    const kode = {
      idPermintaan: info.idPermintaan,
      kode: kodeTerkirim(admin.pengguna.namaPengguna),
    };
    const lain = await galat(kasir, `/api/shift/${s.id}/koreksi-modal`, {
      ...isi,
      modalBenar: 130000,
      kode,
    });
    expect(lain.status).toBeGreaterThanOrEqual(400);
    const d2 = await kirim<DetailShift>(kasir, `/api/shift/${s.id}/koreksi-modal`, {
      ...isi,
      kode,
    });
    expect(d2.kas.at(-1)?.keterangan).toContain('disetujui');
    const r = await ambil<{ data: DetailShift }>(admin, `/api/shift/${s.id}`);
    expect(r.data.ringkasan?.modalAwal).toBe(140000);
  });

  it('K18–K22 tutup dua langkah: hitungan terkunci, uang baru ditolak, bantuan, hitung ulang sekali, keterangan, uang ditinggal', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 100000 });
    await jualTunai(kasir, '3', 50000); // tunai 30.000, kembalian 20.000
    const h1 = await kirim<HasilHitungTutup>(kasir, `/api/shift/${s.id}/hitung`, {
      rincian: { '100000': 1, '5000': 2 },
    });
    expect(h1.rekonsiliasi).toMatchObject({
      saldoSistem: 130000,
      uangFisik: 110000,
      selisih: -20000,
    });
    expect(h1.bolehHitungUlang).toBe(true);
    expect(h1.perluKeterangan).toBe(true);
    expect(h1.bantuan.petunjuk.map((p) => p.judul).join(' | ')).toContain('kembalian');
    expect(h1.tinjauan.linimasa.map((l) => l.jenis)).toEqual(['MODAL', 'BAYAR']);
    expect(h1.tinjauan.totalKembalian).toBe(20000);

    const kas = await galat(kasir, '/api/shift/kas', {
      jenis: 'MASUK_LAIN',
      nominal: 1000,
      keterangan: 'tambahan',
    });
    expect(kas.status).toBe(409);
    expect(kas.pesan).toContain('sedang ditutup');

    const h2 = await kirim<HasilHitungTutup>(kasir, `/api/shift/${s.id}/hitung`, {
      uangFisik: 125000,
    });
    expect(h2.hitungan.map((x) => x.jenis)).toEqual(['BUKA', 'TUTUP', 'TUTUP_ULANG']);
    expect(h2.bolehHitungUlang).toBe(false);
    expect((await galat(kasir, `/api/shift/${s.id}/hitung`, { uangFisik: 130000 })).status).toBe(
      409,
    );

    const tanpaKet = await galat(kasir, `/api/shift/${s.id}/tutup`, { uangDitinggal: 100000 });
    expect(tanpaKet.status).toBe(409);
    expect(tanpaKet.detail?.perluKeterangan).toBe(true);
    const lebih = await galat(kasir, `/api/shift/${s.id}/tutup`, {
      keterangan: 'Uang Rp 5.000 dipakai beli bensin',
      uangDitinggal: 200000,
    });
    expect(lebih.status).toBe(400);
    const d = await kirim<DetailShift>(kasir, `/api/shift/${s.id}/tutup`, {
      keterangan: 'Uang Rp 5.000 dipakai beli bensin',
      uangDitinggal: 100000,
    });
    expect(d.clerical).toMatchObject({
      uangFisik: 125000,
      selisih: -5000,
      jumlahHitung: 2,
      uangDitinggal: 100000,
    });
    expect(d.hitungan).toHaveLength(3);
    const usulan = (await ambil<{ data: UsulanBukaShift }>(kasir, '/api/shift/usulan-buka')).data;
    expect(usulan.uangDitinggal).toBe(100000);
  });

  it('K20 selisih dalam toleransi: tanpa keterangan, ditandai selisih receh, tidak boleh hitung ulang', async () => {
    await aturKonfigurasi({ toleransi_selisih_kas: '1000' });
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 100000 });
    const h = await kirim<HasilHitungTutup>(kasir, `/api/shift/${s.id}/hitung`, {
      uangFisik: 99500,
    });
    expect(h.rekonsiliasi.dalamToleransi).toBe(true);
    expect(h.bolehHitungUlang).toBe(false);
    expect((await galat(kasir, `/api/shift/${s.id}/hitung`, { uangFisik: 100000 })).status).toBe(
      409,
    );
    const d = await kirim<DetailShift>(kasir, `/api/shift/${s.id}/tutup`, {});
    expect(d.clerical?.keterangan).toContain('Selisih receh');
  });

  it('K23 penjelasan selisih hanya oleh atasan, sekali, setelah ditutup; angka tidak berubah', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 100000 });
    await kirim(kasir, `/api/shift/${s.id}/tutup`, { uangFisik: 90000, keterangan: 'Belum tahu' });
    expect(
      (await galat(kasir, `/api/shift/${s.id}/penjelasan`, { penjelasan: 'Ditemukan' })).status,
    ).toBe(403);
    const d = await kirim<DetailShift>(admin, `/api/shift/${s.id}/penjelasan`, {
      penjelasan: 'Uang Rp 10.000 terselip di bawah laci, sudah dikembalikan',
    });
    expect(d.clerical?.selisih).toBe(-10000);
    expect(d.clerical?.penjelasanAtasan).toContain('terselip');
    expect(d.clerical?.dijelaskanOleh).toBe(admin.pengguna.namaPengguna);
    expect(d.bantuan?.petunjuk.some((p) => p.judul.includes('lembar'))).toBe(true);
    expect(
      (await galat(admin, `/api/shift/${s.id}/penjelasan`, { penjelasan: 'Lagi' })).status,
    ).toBe(409);
  });
});
