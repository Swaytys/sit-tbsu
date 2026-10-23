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
import { eq, ne } from 'drizzle-orm';
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
  return kirim<{ id: number; nomor: string; totalNeto: number; baris: { id: number }[] }>(
    sesi,
    '/api/penjualan/checkout',
    {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty }] },
      pembayaran: [{ metode: 'TUNAI', uangDiterima: uang }],
    },
  );
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

  it('K6 + K-132: semua order DIPROSES kembali ke antrean saat tutup; siapa pun berizin boleh menutup', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    const staf = await sesiUji('STAF_PENJUALAN');
    const o = await kirim<DetailOrder>(staf, '/api/order?kirim=true', {
      jenisPenjualan: 'LANGSUNG',
      baris: [{ idBarang: m.semen, qty: '1' }],
    });
    await kirim(kasir, `/api/order/${o.id}/proses`);

    // Staf tidak punya akses shift; pengguna lain yang berizin boleh menutup shift toko.
    expect((await galat(staf, `/api/shift/${s.id}/tutup`, { uangFisik: 0 })).status).toBe(403);
    const tutup = await kirim<DetailShift>(admin, `/api/shift/${s.id}/tutup`, { uangFisik: 0 });
    expect(tutup.clerical?.namaPemeriksa).toBe(admin.pengguna.namaPengguna);
    const [order] = await db.select().from(orderPenjualan).where(eq(orderPenjualan.id, o.id));
    expect(order).toMatchObject({ status: 'MENUNGGU', idKasirProses: null });
  });

  it('K8 + K-132 riwayat: shift toko terlihat oleh semua pengguna berizin; saring selisih', async () => {
    const s1 = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    await kirim(kasir, `/api/shift/${s1.id}/tutup`, { uangFisik: 1000, keterangan: 'lebih' });
    const kasir2 = await sesiUji('KASIR');
    const s2 = await kirim<ShiftAktif>(kasir2, '/api/shift/buka', { modalAwal: 0 });
    await kirim(kasir2, `/api/shift/${s2.id}/tutup`, { uangFisik: 0 });

    const semua = await ambil<DaftarShift>(admin, '/api/shift');
    expect(semua.data.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
    const kasirLain = await ambil<DaftarShift>(kasir2, '/api/shift');
    expect(kasirLain.data.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
    const d1 = await ambil<{ data: DetailShift }>(kasir2, `/api/shift/${s1.id}`);
    expect(d1.data.clerical?.selisih).toBe(1000);
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
    expect(notifAdmin.find((n) => n.jenis === 'SHIFT_SAYA_PERLU_DITUTUP')?.jumlah).toBe(1);
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

  it('K16 + K-134 hitung nanti: hitung → hasil → hitung ulang sekali → simpan; selisih semalam jadi koreksi', async () => {
    await shiftKemarin(150000);
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { cara: 'HITUNG_NANTI' });
    expect(s.modalAwal).toBe(150000);
    expect(s.batasHitungBuka).not.toBeNull();
    const notif = await ambil<{ data: Notifikasi[] }>(kasir, '/api/notifikasi');
    expect(notif.data.some((n) => n.jenis === 'SHIFT_HITUNG_BUKA')).toBe(true);
    // Koreksi modal belum boleh: modal ditentukan hitung susulan.
    expect(
      (
        await galat(kasir, `/api/shift/${s.id}/koreksi-modal`, {
          modalBenar: 100000,
          alasan: 'salah',
        })
      ).pesan,
    ).toContain('hitung uang shift dulu');

    await jualTunai(kasir, '2', 50000); // tunai masuk 20.000 (kembalian 30.000)
    await kirim(kasir, '/api/shift/kas', { jenis: 'KASBON', nominal: 5000, keterangan: 'Budi' });
    // Hitungan pertama 150.000 (salah hitung): selisih −15.000 di luar toleransi → boleh hitung ulang sekali.
    const h1 = await kirim<ShiftAktif>(kasir, `/api/shift/${s.id}/hitung-buka`, {
      uangFisik: 150000,
    });
    expect(h1.batasHitungBuka).not.toBeNull();
    expect(h1.hitungBuka).toMatchObject({
      jumlahHitung: 1,
      laci: 150000,
      masukSejakBuka: 15000,
      modalSaatBuka: 135000,
      ditinggalKemarin: 150000,
      selisih: -15000,
      bolehHitungUlang: true,
    });
    expect(h1.koreksiModal).toBe(0);
    // Hitung ulang: laci 160.000 → modal saat buka 145.000 (semalam kurang 5.000).
    const h2 = await kirim<ShiftAktif>(kasir, `/api/shift/${s.id}/hitung-buka`, {
      uangFisik: 160000,
    });
    expect(h2.hitungBuka).toMatchObject({
      jumlahHitung: 2,
      selisih: -5000,
      bolehHitungUlang: false,
    });
    const ketiga = await galat(kasir, `/api/shift/${s.id}/hitung-buka`, { uangFisik: 160000 });
    expect(ketiga.pesan).toContain('hanya sekali');
    const simpan = await kirim<ShiftAktif>(kasir, `/api/shift/${s.id}/hitung-buka/simpan`);
    expect(simpan.batasHitungBuka).toBeNull();
    expect(simpan.hitungBuka).toBeNull();
    expect(simpan.koreksiModal).toBe(-5000);
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

describe('satu shift untuk toko (docs/05 K1, K2, K25–K27; K-132, K-141, K-142)', () => {
  it('K-132 satu shift terbuka untuk toko: buka kedua ditolak, dua pembukaan bersamaan tetap satu', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    expect(s.namaPembuka).toBe(kasir.pengguna.namaPengguna);
    const kedua = await galat(admin, '/api/shift/buka', { modalAwal: 0 });
    expect(kedua.status).toBe(409);
    expect(kedua.pesan).toContain(s.nomor);
    // Admin mencatat penjualan tunai ke shift toko yang dibuka kasir.
    await jualTunai(admin, '1');
    const d = await ambil<{ data: DetailShift }>(admin, `/api/shift/${s.id}`);
    expect(d.data.ringkasan?.tunaiPenjualan).toBe(10000);
    await kirim(kasir, `/api/shift/${s.id}/tutup`, { uangFisik: 10000 });

    const hasil = await Promise.all([
      minta('/api/shift/buka', { method: 'POST', cookie: kasir.cookie, body: { modalAwal: 0 } }),
      minta('/api/shift/buka', { method: 'POST', cookie: admin.cookie, body: { modalAwal: 0 } }),
    ]);
    expect(hasil.map((r) => r.status).sort()).toEqual([201, 409]);
    const terbuka = await db.select().from(shiftKasir).where(ne(shiftKasir.status, 'TUTUP'));
    expect(terbuka).toHaveLength(1);
  });

  it('K-132 sisa shift ganda (aturan lama) menolak pencatatan uang sampai ditutup; Staf melihat status shift', async () => {
    const staf = await sesiUji('STAF_PENJUALAN');
    expect((await ambil<{ data: unknown }>(staf, '/api/shift/status')).data).toBeNull();
    const s1 = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 0 });
    // Shift kedua yang tertinggal dari aturan lama (satu shift per pengguna).
    const [lama] = await db
      .insert(shiftKasir)
      .values({
        nomor: 'SHF-LAMA-001',
        idKasir: admin.pengguna.id,
        tanggalOperasional: s1.tanggalOperasional,
        waktuBuka: new Date(),
        modalAwal: 0,
      })
      .returning();
    const g = await galat(kasir, '/api/shift/kas', { jenis: 'SETOR_OWNER', nominal: 1000 });
    expect(g.status).toBe(409);
    expect(g.pesan).toContain('aturan lama');
    const aktif = (await ambil<{ data: ShiftAktif }>(kasir, '/api/shift/aktif')).data;
    expect(aktif.lainTerbuka.map((x) => x.nomor)).toEqual(['SHF-LAMA-001']);
    await kirim(admin, `/api/shift/${lama!.id}/tutup`, { uangFisik: 0 });
    await kirim(kasir, '/api/shift/kas', { jenis: 'SETOR_OWNER', nominal: 1000 });
    const st = (
      await ambil<{ data: { nomor: string; status: string; namaPembuka: string } }>(
        staf,
        '/api/shift/status',
      )
    ).data;
    expect(st).toMatchObject({
      nomor: s1.nomor,
      status: 'BUKA',
      namaPembuka: kasir.pengguna.namaPengguna,
    });
  });

  it('K-141 kembalian tidak diambil dicatat kas masuk khusus; omzet tetap, laci cocok', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 100000 });
    // Belanja 10.000, bayar 15.000, kembalian 5.000 tidak diambil.
    const r = await minta('/api/penjualan/checkout', {
      method: 'POST',
      cookie: kasir.cookie,
      body: {
        order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
        pembayaran: [{ metode: 'TUNAI', uangDiterima: 15000, kembalianTidakDiambil: true }],
      },
    });
    expect(r.status).toBe(201);
    const d = await ambil<{ data: DetailShift }>(admin, `/api/shift/${s.id}`);
    expect(d.data.ringkasan).toMatchObject({
      tunaiPenjualan: 10000,
      kasMasukLain: 5000,
      saldoSistem: 115000,
    });
    expect(d.data.kas.map((k) => [k.jenis, k.nominal])).toEqual([['KEMBALIAN_DITINGGAL', 5000]]);
    const tutup = await kirim<DetailShift>(kasir, `/api/shift/${s.id}/tutup`, {
      uangFisik: 115000,
    });
    expect(tutup.clerical?.selisih).toBe(0);
  });

  it('K-142 pengajuan retur menunggu tampil sebagai informasi; uangnya belum keluar dari laci', async () => {
    const s = await kirim<ShiftAktif>(kasir, '/api/shift/buka', { modalAwal: 100000 });
    const pj = await jualTunai(kasir, '2');
    const r = await minta('/api/retur', {
      method: 'POST',
      cookie: kasir.cookie,
      body: {
        idPenjualan: pj.id,
        alasan: 'Kelebihan',
        penyelesaian: 'REFUND',
        persetujuan: { metodeRefund: 'TUNAI' },
        baris: [{ idPenjualanDetail: pj.baris[0]!.id, qtyRetur: '1', kondisi: 'BAIK' }],
      },
    });
    expect(r.status).toBe(201);
    const menunggu = (
      await ambil<{ data: { jenis: string; nomorPenjualan: string; nilai: number }[] }>(
        kasir,
        '/api/shift/menunggu',
      )
    ).data;
    expect(menunggu).toContainEqual(
      expect.objectContaining({ jenis: 'RETUR', nomorPenjualan: pj.nomor, nilai: 10000 }),
    );
    const d = await ambil<{ data: DetailShift }>(admin, `/api/shift/${s.id}`);
    expect(d.data.ringkasan?.kasKeluar).toBe(0);
  });
});
