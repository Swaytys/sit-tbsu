import type {
  DetailBarang,
  Muatan,
  BarisRetur,
  BarisSuratJalan,
  DetailPenjualan,
  Kendaraan,
  Perjalanan,
  PerluDikirim,
  Sopir,
} from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  hargaBarang,
  kendaraan,
  pelanggan,
  persediaan,
  shiftKasir,
  sopir,
} from '../../db/schema';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
type Galat = { error: { kode: string; pesan: string } };

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;
let plg: number;
let truk: Kendaraan;
let pikap: Kendaraan;
let slamet: Sopir;
let budi: Sopir;

async function kirim<T>(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  if (r.status >= 300) throw new Error(`${method} ${path} gagal (${r.status}): ${await r.text()}`);
  return (await json<{ data: T }>(r)).data;
}

async function ambil<T>(sesi: Sesi, path: string) {
  return (await json<{ data: T }>(await minta(path, { cookie: sesi.cookie }))).data;
}

async function galat(sesi: Sesi, path: string, body?: unknown, method = 'POST') {
  const r = await minta(path, { method, cookie: sesi.cookie, body });
  return { status: r.status, ...(await json<Galat>(r)).error };
}

const detail = (id: number) => ambil<DetailPenjualan>(kasir, `/api/penjualan/${id}`);

async function stok(idBarang: number) {
  const [p] = await db
    .select({ baik: persediaan.stokFisik, rusak: persediaan.stokRusak })
    .from(persediaan)
    .where(eq(persediaan.idBarang, idBarang));
  return p!;
}

beforeEach(async () => {
  await siapkanDatabaseSistem();
  m = await siapkanMasterPersediaan();
  await kosongkanTabel(pelanggan, shiftKasir, kendaraan, sopir);
  admin = await sesiUji('ADMIN');
  kasir = await sesiUji('KASIR');
  const idTier = await siapkanTierNormal();
  await db.insert(hargaBarang).values([
    {
      idBarang: m.semen,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 12000,
      hargaJual: 12000,
    },
    {
      idBarang: m.pasir,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 4000,
      hargaJual: 4000,
    },
  ]);
  const [p] = await db
    .insert(pelanggan)
    .values({ kode: 'PLG-90001', namaPelanggan: 'PT. Proyek', noHp: '0811', alamat: 'Jl. B 2' })
    .returning();
  plg = p!.id;
  const sa = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
    jenis: 'SALDO_AWAL',
    baris: [
      { idBarang: m.semen, qtyFisik: '10', hppSatuan: 9000 },
      { idBarang: m.pasir, qtyFisik: '5', hppSatuan: 3000 },
    ],
  });
  await kirim(admin, `/api/penyesuaian/${sa.id}/selesai`);
  truk = await kirim<Kendaraan>(admin, '/api/kendaraan', {
    plat: 's 1234  ab',
    jenis: 'Truk engkel',
  });
  pikap = await kirim<Kendaraan>(admin, '/api/kendaraan', {
    plat: 'W 77 X',
    jenis: 'Pikap',
    kapasitasKg: 1000,
  });
  slamet = await kirim<Sopir>(admin, '/api/sopir', { nama: 'Pak Slamet', noHp: '081234567890' });
  budi = await kirim<Sopir>(admin, '/api/sopir', { nama: 'Budi' });
});

async function invoice(pembayaran?: unknown[]) {
  return kirim<DetailPenjualan>(admin, '/api/penjualan/checkout', {
    order: {
      jenisPenjualan: 'PENGANTARAN',
      idPelanggan: plg,
      alamatKirim: 'Proyek Jl. C 3',
      baris: [
        { idBarang: m.semen, qty: '5' },
        { idBarang: m.pasir, qty: '2' },
      ],
    },
    ...(pembayaran ? { pembayaran } : {}),
  });
}

/** Satu surat jalan berisi semua barang invoice, langsung diberangkatkan. */
async function sjBerangkat(inv: DetailPenjualan, k = truk, s = slamet) {
  const sj = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
    baris: inv.baris.map((b) => ({ idPenjualanDetail: b.id, qtyKirim: b.qty })),
  });
  await kirim<Perjalanan>(kasir, '/api/perjalanan', {
    idKendaraan: k.id,
    idSopir: s.id,
    idSuratJalan: [sj.id],
  });
  return sj;
}

/** Hasil per baris: default semua diterima, `ubah` mengganti baris tertentu (per id penjualan detail). */
function hasil(
  inv: DetailPenjualan,
  ubah: Record<
    number,
    Partial<
      Record<'qtyDiterima' | 'qtyKembali' | 'qtyRusak' | 'qtyDitolak' | 'kondisiDitolak', string>
    >
  > = {},
) {
  return inv.baris.map((b) => ({
    idPenjualanDetail: b.id,
    qtyDiterima: b.qty,
    qtyKembali: '0',
    qtyRusak: '0',
    qtyDitolak: '0',
    ...ubah[b.id],
  }));
}

describe('kendaraan dan sopir (S8, K-150)', () => {
  it('plat dirapikan dan unik; nama sopir unik; kasir hanya melihat; staf ditolak', async () => {
    expect(truk.plat).toBe('S 1234 AB');
    const ganda = await galat(admin, '/api/kendaraan', { plat: 'S 1234 AB', jenis: 'Pikap' });
    expect(ganda.kode).toBe('KONFLIK');
    expect((await galat(admin, '/api/kendaraan', { plat: '1234', jenis: 'Pikap' })).status).toBe(
      400,
    );
    const sopirGanda = await galat(admin, '/api/sopir', { nama: 'pak slamet' });
    expect(sopirGanda.pesan).toContain('sudah ada');
    expect((await galat(kasir, '/api/sopir', { nama: 'Joko' })).status).toBe(403);
    const daftar = await ambil<Kendaraan[]>(kasir, '/api/kendaraan?status=AKTIF');
    expect(daftar.map((k) => k.plat)).toEqual(['S 1234 AB', 'W 77 X']);
    const staf = await sesiUji('STAF_PENJUALAN');
    expect((await minta('/api/kendaraan', { cookie: staf.cookie })).status).toBe(403);
    expect((await galat(staf, '/api/perjalanan', {})).status).toBe(403);
  });
});

describe('surat jalan dan perjalanan (docs/05 §7)', () => {
  it('S2/S4/S9/S10: dua surat jalan satu perjalanan; kendaraan & sopir terkunci sampai hasil semua dicatat', async () => {
    const inv = await invoice();
    const [semen, pasir] = inv.baris;
    const sj1 = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '3' }],
    });
    expect(sj1).toMatchObject({ status: 'DIPROSES', alamatKirim: 'Proyek Jl. C 3', hasil: null });
    expect(sj1.nomor).toMatch(/^SJ-\d{6}-001$/);
    let d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SEBAGIAN');
    expect(d.baris.map((b) => b.qtyBelumDikirim)).toEqual(['2.000', '2.000']);
    const lebih = await galat(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '3' }],
    });
    expect(lebih.status).toBe(409);
    expect(lebih.pesan).toContain('melebihi sisa yang belum dikirim (2 sak)');
    const sj2 = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [
        { idPenjualanDetail: semen!.id, qtyKirim: '2' },
        { idPenjualanDetail: pasir!.id, qtyKirim: '2' },
      ],
    });
    await kirim(kasir, `/api/surat-jalan/${sj1.id}/status`, { status: 'DIMUAT' });

    const trip = await kirim<Perjalanan>(kasir, '/api/perjalanan', {
      idKendaraan: truk.id,
      idSopir: slamet.id,
      idSuratJalan: [sj1.id, sj2.id],
    });
    expect(trip.nomor).toMatch(/^TRP-\d{6}-001$/);
    expect(trip).toMatchObject({ status: 'JALAN', plat: 'S 1234 AB', namaSopir: 'Pak Slamet' });
    expect(trip.suratJalan.map((s) => s.status)).toEqual(['DIKIRIM', 'DIKIRIM']);
    const sjJalan = await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj2.id}`);
    expect(sjJalan).toMatchObject({
      sopir: 'Pak Slamet',
      kendaraan: 'S 1234 AB (Truk engkel)',
      nomorPerjalanan: trip.nomor,
    });
    expect(sjJalan.waktuDimuat).not.toBeNull();

    // Kendaraan dan sopir sedang jalan: tidak bisa berangkat lagi, tidak bisa dinonaktifkan.
    const inv2 = await invoice();
    const sj3 = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv2.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: inv2.baris[0]!.id, qtyKirim: '1' }],
    });
    const trukJalan = await galat(kasir, '/api/perjalanan', {
      idKendaraan: truk.id,
      idSopir: budi.id,
      idSuratJalan: [sj3.id],
    });
    expect(trukJalan.status).toBe(409);
    expect(trukJalan.pesan).toContain(`Kendaraan S 1234 AB sedang jalan (${trip.nomor}`);
    const sopirJalan = await galat(kasir, '/api/perjalanan', {
      idKendaraan: pikap.id,
      idSopir: slamet.id,
      idSuratJalan: [sj3.id],
    });
    expect(sopirJalan.pesan).toContain('Sopir Pak Slamet sedang jalan');
    expect(
      (await galat(admin, `/api/kendaraan/${truk.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH'))
        .kode,
    ).toBe('STATUS_TIDAK_VALID');
    const daftarK = await ambil<Kendaraan[]>(kasir, '/api/kendaraan?status=AKTIF');
    expect(daftarK.find((k) => k.id === truk.id)?.sedangJalan?.nomor).toBe(trip.nomor);
    // Surat jalan yang sudah berangkat tidak bisa ikut perjalanan lain.
    const ulang = await galat(kasir, '/api/perjalanan', {
      idKendaraan: pikap.id,
      idSopir: budi.id,
      idSuratJalan: [sj1.id],
    });
    expect(ulang.pesan).toContain('sudah berangkat');

    await kirim(kasir, `/api/surat-jalan/${sj1.id}/hasil`, {
      baris: [
        {
          idPenjualanDetail: semen!.id,
          qtyDiterima: '3',
          qtyKembali: '0',
          qtyRusak: '0',
          qtyDitolak: '0',
        },
      ],
    });
    expect((await detail(inv.id)).statusPengiriman).toBe('SEBAGIAN');
    let trips = await ambil<Perjalanan[]>(kasir, '/api/perjalanan?status=JALAN');
    expect(trips).toHaveLength(1);
    const dua = await galat(kasir, `/api/surat-jalan/${sj1.id}/hasil`, {
      baris: [
        {
          idPenjualanDetail: semen!.id,
          qtyDiterima: '3',
          qtyKembali: '0',
          qtyRusak: '0',
          qtyDitolak: '0',
        },
      ],
    });
    expect(dua.pesan).toContain('sudah dicatat');

    const akhir = await kirim<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj2.id}/hasil`, {
      baris: [
        {
          idPenjualanDetail: semen!.id,
          qtyDiterima: '2',
          qtyKembali: '0',
          qtyRusak: '0',
          qtyDitolak: '0',
        },
        {
          idPenjualanDetail: pasir!.id,
          qtyDiterima: '2',
          qtyKembali: '0',
          qtyRusak: '0',
          qtyDitolak: '0',
        },
      ],
      namaPenerima: 'Mandor Joko',
    });
    expect(akhir.status).toBe('SELESAI');
    expect(akhir.hasil).toMatchObject({ namaPenerima: 'Mandor Joko', returUang: null });
    d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SELESAI');
    trips = await ambil<Perjalanan[]>(kasir, `/api/perjalanan?idKendaraan=${truk.id}`);
    expect(trips[0]).toMatchObject({ status: 'SELESAI' });
    expect(trips[0]!.waktuKembali).not.toBeNull();
    // Bebas lagi.
    await kirim(kasir, '/api/perjalanan', {
      idKendaraan: truk.id,
      idSopir: slamet.id,
      idSuratJalan: [sj3.id],
    });
  });

  it('S9: dua keberangkatan bersamaan dengan kendaraan sama → tepat satu berhasil', async () => {
    const a = await invoice();
    const b = await invoice();
    const sj = await Promise.all(
      [a, b].map((inv) =>
        kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
          baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '1' }],
        }),
      ),
    );
    const hasilBerangkat = await Promise.all(
      sj.map((s, i) =>
        minta('/api/perjalanan', {
          method: 'POST',
          cookie: kasir.cookie,
          body: { idKendaraan: truk.id, idSopir: [slamet, budi][i]!.id, idSuratJalan: [s.id] },
        }),
      ),
    );
    expect(hasilBerangkat.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await ambil<Perjalanan[]>(kasir, '/api/perjalanan?status=JALAN')).toHaveLength(1);
  });

  it('S3/S5: DIKIRIM/SELESAI tidak lewat ubah status; batal hanya sebelum berangkat', async () => {
    const inv = await invoice();
    const sj = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '5' }],
    });
    expect(
      (await galat(kasir, `/api/surat-jalan/${sj.id}/status`, { status: 'DIKIRIM' })).status,
    ).toBe(400);
    const belum = await galat(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv).slice(0, 1),
    });
    expect(belum.pesan).toContain('belum berangkat');
    const batal = await kirim<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj.id}/batal`, {
      alasan: 'Truk rusak',
    });
    expect(batal).toMatchObject({ status: 'BATAL', alasanBatal: 'Truk rusak' });
    expect((await detail(inv.id)).statusPengiriman).toBe('BELUM');
    const baru = await sjBerangkat(inv);
    const terlambat = await galat(kasir, `/api/surat-jalan/${baru.id}/batal`, { alasan: 'salah' });
    expect(terlambat.kode).toBe('STATUS_TIDAK_VALID');
  });

  it('S10: jumlah hasil harus = qty kirim; rusak wajib pilihan pembeli', async () => {
    const inv = await invoice();
    const [semen] = inv.baris;
    const sj = await sjBerangkat(inv);
    const kurang = await galat(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, { [semen!.id]: { qtyDiterima: '4' } }),
    });
    expect(kurang.status).toBe(400);
    expect(kurang.pesan).toContain('harus sama dengan qty kirim (5 sak)');
    const rusak = await galat(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, { [semen!.id]: { qtyDiterima: '4', qtyRusak: '1' } }),
    });
    expect(rusak.pesan).toContain('pilih kirim pengganti atau kurangi tagihan');
    expect((await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj.id}`)).status).toBe(
      'DIKIRIM',
    );
  });

  it('S10: kembali utuh tanpa mutasi stok, menjadi belum dikirim dan masuk daftar perlu dikirim', async () => {
    const inv = await invoice();
    const [semen] = inv.baris;
    const sebelum = await stok(m.semen);
    const sj = await sjBerangkat(inv);
    await kirim(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, { [semen!.id]: { qtyDiterima: '3', qtyKembali: '2' } }),
    });
    expect(await stok(m.semen)).toEqual(sebelum);
    const d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SEBAGIAN');
    expect(d.baris.map((b) => b.qtyBelumDikirim)).toEqual(['2.000', '0.000']);
    const perlu = await ambil<PerluDikirim[]>(kasir, '/api/surat-jalan/perlu-kirim');
    expect(perlu).toEqual([
      expect.objectContaining({
        idPenjualan: inv.id,
        kirimUlang: true,
        baris: [expect.objectContaining({ qtyBelumDikirim: '2.000' })],
      }),
    ]);
    // Kirim ulang 2 lalu diterima: selesai.
    const ulang = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '2' }],
    });
    await kirim(kasir, '/api/perjalanan', {
      idKendaraan: pikap.id,
      idSopir: budi.id,
      idSuratJalan: [ulang.id],
    });
    await kirim(kasir, `/api/surat-jalan/${ulang.id}/hasil`, {
      baris: [
        {
          idPenjualanDetail: semen!.id,
          qtyDiterima: '2',
          qtyKembali: '0',
          qtyRusak: '0',
          qtyDitolak: '0',
        },
      ],
    });
    expect((await detail(inv.id)).statusPengiriman).toBe('SELESAI');
    expect(await ambil<PerluDikirim[]>(kasir, '/api/surat-jalan/perlu-kirim')).toEqual([]);
  });

  it('S10: ditolak pembeli (kondisi baik) → retur potong tagihan, stok kembali, pengiriman selesai', async () => {
    const inv = await invoice(); // 5 × 12.000 + 2 × 4.000 = 68.000, belum bayar
    const [semen] = inv.baris;
    const sebelum = await stok(m.semen);
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '4', qtyDitolak: '1', kondisiDitolak: 'BAIK' },
      }),
    });
    expect(s.hasil?.returUang?.status).toBe('DISETUJUI');
    const r = await ambil<BarisRetur>(admin, `/api/retur/${s.hasil!.returUang!.id}`);
    expect(r).toMatchObject({ penyelesaian: 'POTONG_TAGIHAN', totalRetur: 12000 });
    expect(r.alasan).toContain(`Hasil pengantaran ${sj.nomor}`);
    expect(Number((await stok(m.semen)).baik)).toBe(Number(sebelum.baik) + 1);
    const d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SELESAI');
    expect(d.sisaTagihan).toBe(56000);
  });

  it('K-151: rusak di jalan, dikirim pengganti → stok baik −1, rusak +1, tagihan tetap, sisa dikirim ulang', async () => {
    const inv = await invoice();
    const [semen] = inv.baris;
    const sebelum = await stok(m.semen);
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, { [semen!.id]: { qtyDiterima: '4', qtyRusak: '1' } }),
      penangananRusak: 'KIRIM_PENGGANTI',
    });
    expect(s.hasil).toMatchObject({ penangananRusak: 'KIRIM_PENGGANTI', returUang: null });
    expect(s.hasil?.returTukar?.status).toBe('DISETUJUI');
    const st = await stok(m.semen);
    expect(Number(st.baik)).toBe(Number(sebelum.baik) - 1);
    expect(Number(st.rusak)).toBe(Number(sebelum.rusak) + 1);
    const d = await detail(inv.id);
    expect(d.sisaTagihan).toBe(68000);
    expect(d.baris[0]!.qtyBelumDikirim).toBe('1.000');
  });

  it('K-151: rusak di jalan, tagihan dikurangi → retur kondisi rusak masuk stok rusak', async () => {
    const inv = await invoice();
    const [semen] = inv.baris;
    const sebelum = await stok(m.semen);
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, { [semen!.id]: { qtyDiterima: '3', qtyRusak: '2' } }),
      penangananRusak: 'KURANGI_TAGIHAN',
    });
    const r = await ambil<BarisRetur>(admin, `/api/retur/${s.hasil!.returUang!.id}`);
    expect(r).toMatchObject({ penyelesaian: 'POTONG_TAGIHAN', totalRetur: 24000 });
    expect(r.baris[0]).toMatchObject({ kondisi: 'RUSAK' });
    expect(Number((await stok(m.semen)).rusak)).toBe(Number(sebelum.rusak) + 2);
    const d = await detail(inv.id);
    expect(d).toMatchObject({ statusPengiriman: 'SELESAI', sisaTagihan: 44000 });
  });

  it('S10: invoice lunas tunai, barang ditolak → wajib pilih cara uang kembali; refund dari shift', async () => {
    await kirim(admin, '/api/shift/buka', { modalAwal: 100000 });
    const inv = await invoice([{ metode: 'TUNAI', nominal: 68000, uangDiterima: 68000 }]);
    const [semen] = inv.baris;
    const sj = await sjBerangkat(inv);
    const isi = { baris: hasil(inv, { [semen!.id]: { qtyDiterima: '3', qtyDitolak: '2' } }) };
    const tanpa = await galat(admin, `/api/surat-jalan/${sj.id}/hasil`, isi);
    expect(tanpa.pesan).toContain('melebihi sisa tagihan Rp 0');
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      ...isi,
      metodeRefund: 'TUNAI',
    });
    const r = await ambil<BarisRetur>(admin, `/api/retur/${s.hasil!.returUang!.id}`);
    expect(r).toMatchObject({ penyelesaian: 'REFUND', metodeRefund: 'TUNAI', totalRetur: 24000 });
    expect((await detail(inv.id)).statusPembayaran).toBe('LUNAS');
  });

  it('S10/S2: kasir mencatat barang ditolak → retur menunggu atasan; qty-nya tidak bisa dikirim ulang dulu', async () => {
    const inv = await invoice();
    const [semen] = inv.baris;
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, { [semen!.id]: { qtyDiterima: '4', qtyDitolak: '1' } }),
    });
    expect(s.hasil?.returUang?.status).toBe('MENUNGGU');
    let d = await detail(inv.id);
    expect(d.baris[0]!.qtyBelumDikirim).toBe('0.000');
    expect(d.statusPengiriman).toBe('SEBAGIAN');
    // Atasan menolak retur: barang tetap milik pembeli dan menjadi belum dikirim.
    await kirim(admin, `/api/retur/${s.hasil!.returUang!.id}/tolak`, {
      alasan: 'Pembeli jadi ambil',
    });
    d = await detail(inv.id);
    expect(d.baris[0]!.qtyBelumDikirim).toBe('1.000');
  });

  it('K-149: retur biasa ditolak untuk barang yang masih di surat jalan belum selesai', async () => {
    const inv = await invoice();
    const [semen] = inv.baris;
    await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '4' }],
    });
    const r = await galat(admin, '/api/retur', {
      idPenjualan: inv.id,
      alasan: 'Batal sebagian',
      penyelesaian: 'POTONG_TAGIHAN',
      baris: [{ idPenjualanDetail: semen!.id, qtyRetur: '2' }],
    });
    expect(r.status).toBe(409);
    expect(r.pesan).toContain('masih di surat jalan yang belum selesai');
    // Qty yang belum masuk surat jalan boleh diretur (pembeli batal sebagian sebelum dikirim).
    await kirim(admin, '/api/retur', {
      idPenjualan: inv.id,
      alasan: 'Batal sebagian',
      penyelesaian: 'POTONG_TAGIHAN',
      baris: [{ idPenjualanDetail: semen!.id, qtyRetur: '1' }],
    });
  });

  it('S1 hanya pengantaran; Staf tidak berizin', async () => {
    await kirim(kasir, '/api/shift/buka', { modalAwal: 0 });
    const langsung = await kirim<DetailPenjualan>(kasir, '/api/penjualan/checkout', {
      order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty: '1' }] },
      pembayaran: [{ metode: 'TUNAI', nominal: 12000 }],
    });
    const salah = await galat(kasir, `/api/penjualan/${langsung.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: langsung.baris[0]!.id, qtyKirim: '1' }],
    });
    expect(salah.kode).toBe('STATUS_TIDAK_VALID');
    const inv = await invoice();
    const staf = await sesiUji('STAF_PENJUALAN');
    expect(
      (
        await galat(staf, `/api/penjualan/${inv.id}/surat-jalan`, {
          baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '1' }],
        })
      ).status,
    ).toBe(403);
  });
});

describe('muatan kendaraan (K-161, docs/13 §3)', () => {
  async function siapkanMuatan() {
    // Semen 50 kg/sak, kemasan 70 × 45 × 12 cm (0,0378 m³).
    await db
      .update(barang)
      .set({ beratKg: '50', panjangCm: '70', lebarCm: '45', tinggiCm: '12' })
      .where(eq(barang.id, m.semen));
  }

  it('data muatan disimpan lewat ubah barang dan tampil di detail', async () => {
    const d = await ambil<DetailBarang>(admin, `/api/barang/${m.semen}`);
    const r = await minta(`/api/barang/${m.semen}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      body: {
        kode: d.kode,
        namaBarang: d.namaBarang,
        idKategori: d.idKategori,
        idSatuanDasar: d.idSatuanDasar,
        stokMinimum: d.stokMinimum,
        hargaModalAwal: d.hargaModalAwal,
        kepemilikan: d.kepemilikan,
        atribut: [],
        muatan: { beratKg: '50,5', panjangCm: '70', lebarCm: '45', tinggiCm: '12' },
      },
    });
    expect(r.status).toBe(200);
    const baru = await ambil<DetailBarang>(admin, `/api/barang/${m.semen}`);
    expect(baru.muatan).toMatchObject({ beratKg: '50.5', panjangCm: '70', curah: false });
    const salah = await minta(`/api/barang/${m.semen}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      body: {
        kode: d.kode,
        namaBarang: d.namaBarang,
        idKategori: d.idKategori,
        idSatuanDasar: d.idSatuanDasar,
        kepemilikan: d.kepemilikan,
        atribut: [],
        muatan: { beratKg: '1', panjangCm: '70', lebarCm: null, tinggiCm: null },
      },
    });
    expect(salah.status).toBe(400);
  });

  it('berat di atas daya angkut ditolak; volume sedikit lebih butuh alasan; aman tercatat di perjalanan', async () => {
    await siapkanMuatan();
    const inv = await invoice(); // semen 5 sak = 250 kg, 0,189 m³ (pasir tanpa data)
    const sj = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '5' }],
    });
    const kecil = await kirim<Kendaraan>(admin, '/api/kendaraan', {
      plat: 'L 1 KC',
      jenis: 'Motor roda tiga',
      kapasitasKg: 200,
    });
    const tolak = await galat(kasir, '/api/perjalanan', {
      idKendaraan: kecil.id,
      idSopir: slamet.id,
      idSuratJalan: [sj.id],
    });
    expect(tolak.status).toBe(409);
    expect(tolak.pesan).toContain('melebihi daya angkut');

    // Bak 80 × 60 × 42 cm × faktor isi 85% = 0,171 m³ → volume 110%: perlu alasan.
    const pas = await kirim<Kendaraan>(admin, '/api/kendaraan', {
      plat: 'L 2 KC',
      jenis: 'Pikap kecil',
      kapasitasKg: 1000,
      bakPanjangCm: 80,
      bakLebarCm: 60,
      bakTinggiCm: 42,
    });
    const pr = await kirim<Muatan>(kasir, '/api/perjalanan/pratinjau-muatan', {
      idKendaraan: pas.id,
      idSuratJalan: [sj.id],
    });
    expect(pr).toMatchObject({ beratKg: '250', kesimpulan: 'KONFIRMASI', persenBerat: 25 });
    expect(pr.tingkat).toEqual({ berat: 'AMAN', volume: 'KONFIRMASI', panjang: 'AMAN' });
    const tanpaAlasan = await galat(kasir, '/api/perjalanan', {
      idKendaraan: pas.id,
      idSopir: slamet.id,
      idSuratJalan: [sj.id],
    });
    expect(tanpaAlasan.status).toBe(400);
    const trip = await kirim<Perjalanan>(kasir, '/api/perjalanan', {
      idKendaraan: pas.id,
      idSopir: slamet.id,
      idSuratJalan: [sj.id],
      alasanMuatan: 'Sak ditumpuk satu lapis di atas dinding bak, diikat tali dan ditutup terpal.',
    });
    expect(trip.status).toBe('JALAN');
  });
});

describe('rit rencana papan Pengiriman (K-160, docs/05 S14)', () => {
  const jadwal = () => new Date(Date.now() + 3600_000).toISOString();

  it('rencana → isi dari invoice & surat jalan → dimuat → berangkat; kendaraan terkunci saat jalan', async () => {
    const a = await invoice();
    const b = await invoice();
    const rit = await kirim<Perjalanan>(kasir, '/api/perjalanan/rencana', {
      idKendaraan: truk.id,
      idSopir: slamet.id,
      jadwalBerangkat: jadwal(),
    });
    expect(rit).toMatchObject({ status: 'DIRENCANAKAN', waktuBerangkat: null, suratJalan: [] });
    // Kartu Backlog (invoice) → surat jalan baru untuk semua sisa barangnya, langsung masuk rit.
    let isi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${rit.id}/isi`, {
      idPenjualan: a.id,
    });
    expect(isi.suratJalan).toHaveLength(1);
    expect((await detail(a.id)).baris.map((x) => x.qtyBelumDikirim)).toEqual(['0.000', '0.000']);
    const sjB = await kirim<BarisSuratJalan>(kasir, `/api/penjualan/${b.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: b.baris[0]!.id, qtyKirim: '2' }],
    });
    isi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${rit.id}/isi`, { idSuratJalan: sjB.id });
    expect(isi.suratJalan).toHaveLength(2);
    // Invoice tanpa sisa tidak bisa dijadwalkan lagi.
    expect(
      (await galat(kasir, `/api/perjalanan/${rit.id}/isi`, { idPenjualan: a.id })).status,
    ).toBe(409);

    await kirim(kasir, `/api/perjalanan/${rit.id}/dimuat`, {});
    const jalan = await kirim<Perjalanan>(kasir, `/api/perjalanan/${rit.id}/berangkat`, {});
    expect(jalan.status).toBe('JALAN');
    expect(jalan.waktuBerangkat).not.toBeNull();
    expect(jalan.suratJalan.map((s) => s.status)).toEqual(['DIKIRIM', 'DIKIRIM']);
    // Rit lain dengan truk yang sama boleh direncanakan, tetapi tidak bisa berangkat selama truk di jalan.
    const c = await kirim<DetailPenjualan>(admin, '/api/penjualan/checkout', {
      order: {
        jenisPenjualan: 'PENGANTARAN',
        idPelanggan: plg,
        alamatKirim: 'Proyek Jl. C 3',
        baris: [{ idBarang: m.pasir, qty: '1' }],
      },
    });
    const rit2 = await kirim<Perjalanan>(kasir, '/api/perjalanan/rencana', {
      idKendaraan: truk.id,
      idSopir: budi.id,
      jadwalBerangkat: jadwal(),
    });
    await kirim(kasir, `/api/perjalanan/${rit2.id}/isi`, { idPenjualan: c.id });
    const tolak = await galat(kasir, `/api/perjalanan/${rit2.id}/berangkat`, {});
    expect(tolak.pesan).toContain('sedang jalan');
    // Rit yang sudah berangkat tidak bisa diisi.
    expect(
      (await galat(kasir, `/api/perjalanan/${rit.id}/isi`, { idPenjualan: c.id })).status,
    ).toBe(409);
  });

  it('pindah antar rit, keluarkan, batal surat jalan, dan batal rit mengembalikan surat jalan', async () => {
    const a = await invoice();
    const r1 = await kirim<Perjalanan>(kasir, '/api/perjalanan/rencana', {
      idKendaraan: truk.id,
      idSopir: slamet.id,
      jadwalBerangkat: jadwal(),
    });
    const r2 = await kirim<Perjalanan>(kasir, '/api/perjalanan/rencana', {
      idKendaraan: pikap.id,
      idSopir: budi.id,
      jadwalBerangkat: jadwal(),
    });
    const isi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r1.id}/isi`, {
      idPenjualan: a.id,
    });
    const idSj = isi.suratJalan[0]!.id;
    // Pindah ke r2.
    const r2isi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r2.id}/isi`, {
      idSuratJalan: idSj,
    });
    expect(r2isi.suratJalan.map((s) => s.id)).toEqual([idSj]);
    const daftar = await ambil<Perjalanan[]>(kasir, '/api/perjalanan?status=DIRENCANAKAN');
    expect(daftar.find((r) => r.id === r1.id)?.suratJalan).toEqual([]);
    // Keluarkan: belum direncanakan, tetap DIPROSES.
    await kirim(kasir, '/api/perjalanan/keluar', { idSuratJalan: idSj });
    expect(
      (await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${idSj}`)).idPerjalanan,
    ).toBeNull();
    // Masuk lagi lalu rit dibatalkan: surat jalan kembali tanpa rit.
    await kirim(kasir, `/api/perjalanan/${r1.id}/isi`, { idSuratJalan: idSj });
    const batal = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r1.id}/batal`, {
      alasan: 'Truk dipakai proyek lain',
    });
    expect(batal).toMatchObject({ status: 'BATAL', alasanBatal: 'Truk dipakai proyek lain' });
    const sj = await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${idSj}`);
    expect(sj).toMatchObject({ status: 'DIPROSES', idPerjalanan: null });
    // Surat jalan di rit rencana yang dibatalkan ikut keluar dari rit.
    await kirim(kasir, `/api/perjalanan/${r2.id}/isi`, { idSuratJalan: idSj });
    await kirim(kasir, `/api/surat-jalan/${idSj}/batal`, { alasan: 'Pembeli tunda' });
    expect(
      (await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${idSj}`)).idPerjalanan,
    ).toBeNull();
    expect((await galat(kasir, `/api/perjalanan/${r2.id}/berangkat`, {})).pesan).toContain(
      'kosong',
    );
  });
});
