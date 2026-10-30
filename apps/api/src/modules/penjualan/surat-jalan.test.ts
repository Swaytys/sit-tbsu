import type {
  DetailBarang,
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
import {
  aturKonfigurasi,
  json,
  minta,
  sesiUji,
  siapkanDatabaseSistem,
} from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import {
  barang,
  hargaBarang,
  kasShift,
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

const jadwal = () => new Date(Date.now() + 3600_000).toISOString();

/** Rit rencana (kendaraan + sopir) tempat surat jalan dibuat (K-174). */
function rit(k = truk, s = slamet) {
  return kirim<Perjalanan>(kasir, '/api/perjalanan/rencana', {
    idKendaraan: k.id,
    idSopir: s.id,
    jadwalBerangkat: jadwal(),
  });
}

function buatSj(inv: DetailPenjualan, idPerjalanan: number, baris: unknown[]) {
  return kirim<BarisSuratJalan>(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
    idPerjalanan,
    baris,
  });
}

/** K-203: rit berangkat setelah semua surat jalannya dicentang dimuat. */
const muat = (idRit: number) => kirim(kasir, `/api/perjalanan/${idRit}/dimuat`, {});
const berangkat = async (idRit: number, body: unknown = {}) => {
  await muat(idRit);
  return kirim<Perjalanan>(kasir, `/api/perjalanan/${idRit}/berangkat`, body);
};

/** Satu surat jalan berisi semua barang invoice dalam rit baru, langsung diberangkatkan. */
async function sjBerangkat(inv: DetailPenjualan, k = truk, s = slamet) {
  const r = await rit(k, s);
  const sj = await buatSj(
    inv,
    r.id,
    inv.baris.map((b) => ({ idPenjualanDetail: b.id, qtyKirim: b.qty })),
  );
  await berangkat(r.id);
  return sj;
}

/** Hasil per baris: default semua diterima, `ubah` mengganti baris tertentu (per id penjualan detail). */
function hasil(
  inv: DetailPenjualan,
  ubah: Record<
    number,
    Partial<
      Record<'qtyDiterima' | 'qtyKembali' | 'qtyRusak' | 'alasanKembali' | 'alasanRusak', string>
    >
  > = {},
) {
  return inv.baris.map((b) => ({
    idPenjualanDetail: b.id,
    qtyDiterima: b.qty,
    qtyKembali: '0',
    qtyRusak: '0',
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
    expect((await galat(staf, '/api/perjalanan/rencana', {})).status).toBe(403);
  });
});

describe('surat jalan dan perjalanan (docs/05 §7)', () => {
  it('S2/S4/S9/S10: dua surat jalan satu rit; kendaraan & sopir terkunci sampai hasil semua dicatat', async () => {
    const inv = await invoice();
    const [semen, pasir] = inv.baris;
    const r = await rit();
    // K-174: surat jalan wajib di dalam rit; sopir dan kendaraan langsung tertulis.
    const tanpaRit = await galat(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '3' }],
    });
    expect(tanpaRit.status).toBe(400);
    const sj1 = await buatSj(inv, r.id, [{ idPenjualanDetail: semen!.id, qtyKirim: '3' }]);
    expect(sj1).toMatchObject({
      status: 'DIPROSES',
      alamatKirim: 'Proyek Jl. C 3',
      hasil: null,
      idPerjalanan: r.id,
      sopir: 'Pak Slamet',
      kendaraan: 'S 1234 AB (Truk engkel)',
    });
    expect(sj1.nomor).toMatch(/^SJ-\d{6}-001$/);
    let d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SEBAGIAN');
    expect(d.baris.map((b) => b.qtyBelumDikirim)).toEqual(['2.000', '2.000']);
    const lebih = await galat(kasir, `/api/penjualan/${inv.id}/surat-jalan`, {
      idPerjalanan: r.id,
      baris: [{ idPenjualanDetail: semen!.id, qtyKirim: '3' }],
    });
    expect(lebih.status).toBe(409);
    expect(lebih.pesan).toContain('melebihi sisa yang belum dikirim (2 sak)');
    const sj2 = await buatSj(inv, r.id, [
      { idPenjualanDetail: semen!.id, qtyKirim: '2' },
      { idPenjualanDetail: pasir!.id, qtyKirim: '2' },
    ]);
    await kirim(kasir, `/api/surat-jalan/${sj1.id}/status`, { status: 'DIMUAT' });

    const trip = await berangkat(r.id);
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
    // Rit yang sudah berangkat tidak bisa diisi surat jalan baru.
    const inv2 = await invoice();
    const ritJalan = await galat(kasir, `/api/penjualan/${inv2.id}/surat-jalan`, {
      idPerjalanan: r.id,
      baris: [{ idPenjualanDetail: inv2.baris[0]!.id, qtyKirim: '1' }],
    });
    expect(ritJalan.pesan).toContain('sudah berangkat; pilih rit lain');

    // Kendaraan dan sopir sedang jalan: tidak bisa berangkat lagi, tidak bisa dinonaktifkan.
    const r2 = await rit(truk, budi);
    await buatSj(inv2, r2.id, [{ idPenjualanDetail: inv2.baris[0]!.id, qtyKirim: '1' }]);
    await muat(r2.id);
    const trukJalan = await galat(kasir, `/api/perjalanan/${r2.id}/berangkat`, {});
    expect(trukJalan.status).toBe(409);
    expect(trukJalan.pesan).toContain(`Kendaraan S 1234 AB sedang jalan (${trip.nomor}`);
    const r3 = await rit(pikap, slamet);
    await buatSj(inv2, r3.id, [{ idPenjualanDetail: inv2.baris[1]!.id, qtyKirim: '1' }]);
    await muat(r3.id);
    const sopirJalan = await galat(kasir, `/api/perjalanan/${r3.id}/berangkat`, {});
    expect(sopirJalan.pesan).toContain('Sopir Pak Slamet sedang jalan');
    expect(
      (await galat(admin, `/api/kendaraan/${truk.id}/status`, { statusAktif: 'NONAKTIF' }, 'PATCH'))
        .kode,
    ).toBe('STATUS_TIDAK_VALID');
    const daftarK = await ambil<Kendaraan[]>(kasir, '/api/kendaraan?status=AKTIF');
    expect(daftarK.find((k) => k.id === truk.id)?.sedangJalan?.nomor).toBe(trip.nomor);
    // Surat jalan yang sudah berangkat tidak bisa ikut rit lain.
    const ulang = await galat(kasir, `/api/perjalanan/${r3.id}/isi`, { idSuratJalan: sj1.id });
    expect(ulang.pesan).toContain('sudah berangkat');

    await kirim(kasir, `/api/surat-jalan/${sj1.id}/hasil`, {
      baris: [
        {
          idPenjualanDetail: semen!.id,
          qtyDiterima: '3',
          qtyKembali: '0',
          qtyRusak: '0',
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
        },
        {
          idPenjualanDetail: pasir!.id,
          qtyDiterima: '2',
          qtyKembali: '0',
          qtyRusak: '0',
        },
      ],
      namaPenerima: 'Mandor Joko',
    });
    expect(akhir.status).toBe('SELESAI');
    expect(akhir.hasil).toMatchObject({ namaPenerima: 'Mandor Joko', returUang: null });
    d = await detail(inv.id);
    expect(d.statusPengiriman).toBe('SELESAI');
    trips = await ambil<Perjalanan[]>(kasir, `/api/perjalanan?idKendaraan=${truk.id}`);
    expect(trips.find((t) => t.id === r.id)).toMatchObject({ status: 'SELESAI' });
    expect(trips.find((t) => t.id === r.id)!.waktuKembali).not.toBeNull();
    // Bebas lagi.
    await berangkat(r2.id);
  });

  it('S9: dua rit dengan kendaraan sama berangkat bersamaan → tepat satu berhasil', async () => {
    const a = await invoice();
    const b = await invoice();
    const daftarRit = [await rit(truk, slamet), await rit(truk, budi)];
    for (const [i, inv] of [a, b].entries()) {
      await buatSj(inv, daftarRit[i]!.id, [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '1' }]);
      await muat(daftarRit[i]!.id);
    }
    const hasilBerangkat = await Promise.all(
      daftarRit.map((r) =>
        minta(`/api/perjalanan/${r.id}/berangkat`, {
          method: 'POST',
          cookie: kasir.cookie,
          body: {},
        }),
      ),
    );
    expect(hasilBerangkat.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await ambil<Perjalanan[]>(kasir, '/api/perjalanan?status=JALAN')).toHaveLength(1);
  });

  it('S3/S5: DIKIRIM/SELESAI tidak lewat ubah status; batal hanya sebelum berangkat', async () => {
    const inv = await invoice();
    const r = await rit(pikap, budi);
    const sj = await buatSj(inv, r.id, [{ idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '5' }]);
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
    expect(rusak.pesan).toContain('pilih alasan barang rusak');
    const tanpaPilihan = await galat(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '4', qtyRusak: '1', alasanRusak: 'RUSAK_DI_JALAN' },
      }),
    });
    expect(tanpaPilihan.pesan).toContain('pilih kirim pengganti atau kurangi tagihan');
    const tanpaAlasan = await galat(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, { [semen!.id]: { qtyDiterima: '4', qtyKembali: '1' } }),
    });
    expect(tanpaAlasan.pesan).toContain('pilih alasan barang kembali');
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
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '3', qtyKembali: '2', alasanKembali: 'KIRIM_ULANG' },
      }),
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
    const r2 = await rit(pikap, budi);
    const ulang = await buatSj(inv, r2.id, [{ idPenjualanDetail: semen!.id, qtyKirim: '2' }]);
    await berangkat(r2.id);
    await kirim(kasir, `/api/surat-jalan/${ulang.id}/hasil`, {
      baris: [
        {
          idPenjualanDetail: semen!.id,
          qtyDiterima: '2',
          qtyKembali: '0',
          qtyRusak: '0',
        },
      ],
    });
    expect((await detail(inv.id)).statusPengiriman).toBe('SELESAI');
    expect(await ambil<PerluDikirim[]>(kasir, '/api/surat-jalan/perlu-kirim')).toEqual([]);
  });

  it('K-176: kembali utuh karena kelebihan → tagihan dikurangi otomatis, stok kembali, pengiriman selesai', async () => {
    const inv = await invoice(); // 5 × 12.000 + 2 × 4.000 = 68.000, belum bayar
    const [semen] = inv.baris;
    const sebelum = await stok(m.semen);
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '4', qtyKembali: '1', alasanKembali: 'KELEBIHAN' },
      }),
    });
    expect(s.hasil?.returUang?.status).toBe('DISETUJUI');
    const r = await ambil<BarisRetur>(admin, `/api/retur/${s.hasil!.returUang!.id}`);
    expect(r).toMatchObject({ penyelesaian: 'POTONG_TAGIHAN', totalRetur: 12000 });
    expect(r.alasan).toContain(`Hasil pengantaran ${sj.nomor}: kelebihan pesanan`);
    expect(s.hasil?.baris[0]).toMatchObject({ alasanKembali: 'KELEBIHAN', qtyDitolak: '1.000' });
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
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '4', qtyRusak: '1', alasanRusak: 'RUSAK_DI_JALAN' },
      }),
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
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '3', qtyRusak: '2', alasanRusak: 'RUSAK_SAAT_DICEK' },
      }),
      penangananRusak: 'KURANGI_TAGIHAN',
    });
    expect(s.hasil?.returUang).toBeNull();
    const r = await ambil<BarisRetur>(admin, `/api/retur/${s.hasil!.returRusak!.id}`);
    expect(r).toMatchObject({ penyelesaian: 'POTONG_TAGIHAN', totalRetur: 24000 });
    expect(r.baris[0]).toMatchObject({ kondisi: 'RUSAK' });
    expect(Number((await stok(m.semen)).rusak)).toBe(Number(sebelum.rusak) + 2);
    const d = await detail(inv.id);
    expect(d).toMatchObject({ statusPengiriman: 'SELESAI', sisaTagihan: 44000 });
  });

  it('S10/K-193: invoice lunas, barang ditolak → wajib pilih cara uang kembali; tunai menunggu sampai diserahkan', async () => {
    await kirim(admin, '/api/shift/buka', { modalAwal: 100000 });
    const inv = await invoice([{ metode: 'TUNAI', nominal: 68000, uangDiterima: 68000 }]);
    const [semen] = inv.baris;
    const sj = await sjBerangkat(inv);
    const isi = {
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '3', qtyKembali: '2', alasanKembali: 'BATAL_BELI' },
      }),
    };
    const tanpa = await galat(admin, `/api/surat-jalan/${sj.id}/hasil`, isi);
    expect(tanpa.pesan).toContain('Ada uang yang dikembalikan ke pembeli Rp 24.000');
    // Lunas: potong tagihan tidak mungkin.
    const potong = await galat(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      ...isi,
      penyelesaianUang: 'POTONG_TAGIHAN',
      metodeRefund: 'TUNAI',
    });
    expect(potong.pesan).toContain('Tagihan sudah lunas');
    const kasKeluar = async (idRetur: number) =>
      (await db.select().from(kasShift).where(eq(kasShift.idRetur, idRetur))).reduce(
        (t, k) => t + k.nominal,
        0,
      );
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      ...isi,
      metodeRefund: 'TUNAI',
    });
    const idRetur = s.hasil!.returUang!.id;
    const r = await ambil<BarisRetur>(admin, `/api/retur/${idRetur}`);
    expect(r).toMatchObject({
      penyelesaian: 'REFUND',
      metodeRefund: 'TUNAI',
      totalRetur: 24000,
      statusTransfer: 'MENUNGGU',
      nominalRefund: 24000,
    });
    // Belum keluar dari kas sampai pembeli datang mengambil.
    expect(await kasKeluar(idRetur)).toBe(0);
    const tugas = await ambil<{ id: number; metodeRefund: string }[]>(
      kasir,
      '/api/retur/pengembalian',
    );
    expect(tugas).toEqual([expect.objectContaining({ id: idRetur, metodeRefund: 'TUNAI' })]);
    await kirim(kasir, `/api/retur/${idRetur}/pengembalian`, { metode: 'TUNAI' });
    expect(await kasKeluar(idRetur)).toBe(24000);
    expect(await ambil(kasir, '/api/retur/pengembalian')).toEqual([]);
    expect((await detail(inv.id)).statusPembayaran).toBe('LUNAS');
  });

  it('K-192: DP → potong tagihan dulu (kelebihan dikembalikan) atau kembalikan uang (maks. yang dibayar); belum bayar hanya potong', async () => {
    await kirim(admin, '/api/shift/buka', { modalAwal: 100000 });
    // Total 68.000, DP 20.000, sisa 48.000.
    const dp = [{ metode: 'TUNAI', nominal: 20000, uangDiterima: 20000 }];
    const a = await invoice(dp);
    const sjA = await sjBerangkat(a);
    // Kembalikan uang: semen 2 = 24.000 → uang kembali 20.000 (yang sudah dibayar), 4.000 memotong tagihan.
    const sA = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sjA.id}/hasil`, {
      baris: hasil(a, {
        [a.baris[0]!.id]: { qtyDiterima: '3', qtyKembali: '2', alasanKembali: 'BATAL_BELI' },
      }),
      penyelesaianUang: 'KEMBALIKAN_UANG',
      metodeRefund: 'TRANSFER',
    });
    expect(await ambil<BarisRetur>(admin, `/api/retur/${sA.hasil!.returUang!.id}`)).toMatchObject({
      nominalRefund: 20000,
      statusTransfer: 'MENUNGGU',
    });
    expect((await detail(a.id)).sisaTagihan).toBe(44000);

    // Potong tagihan: semen 5 = 60.000 > sisa 48.000 → sisa jadi 0, kelebihan 12.000 dikembalikan.
    const b = await invoice(dp);
    const sjB = await sjBerangkat(b);
    const sB = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sjB.id}/hasil`, {
      baris: hasil(b, {
        [b.baris[0]!.id]: { qtyDiterima: '0', qtyKembali: '5', alasanKembali: 'BATAL_BELI' },
      }),
      penyelesaianUang: 'POTONG_TAGIHAN',
      metodeRefund: 'TUNAI',
    });
    expect(await ambil<BarisRetur>(admin, `/api/retur/${sB.hasil!.returUang!.id}`)).toMatchObject({
      nominalRefund: 12000,
      metodeRefund: 'TUNAI',
      statusTransfer: 'MENUNGGU',
    });
    expect((await detail(b.id)).sisaTagihan).toBe(0);

    // Belum bayar: kembalikan uang ditolak. (Stok pasir uji ditambah dulu.)
    const adj = await kirim<{ id: number }>(admin, '/api/penyesuaian', {
      jenis: 'KOREKSI',
      alasan: 'tambah stok uji',
      baris: [{ idBarang: m.pasir, qtySelisih: '5' }],
    });
    await kirim(admin, `/api/penyesuaian/${adj.id}/selesai`);
    const c = await invoice();
    const sjC = await sjBerangkat(c);
    const salah = await galat(admin, `/api/surat-jalan/${sjC.id}/hasil`, {
      baris: hasil(c, {
        [c.baris[0]!.id]: { qtyDiterima: '4', qtyKembali: '1', alasanKembali: 'KELEBIHAN' },
      }),
      penyelesaianUang: 'KEMBALIKAN_UANG',
      metodeRefund: 'TUNAI',
    });
    expect(salah.pesan).toContain('belum membayar');
  });

  it('K-193: cara pengembalian bisa diganti selama menunggu (alasan di log); transfer dikonfirmasi Admin/Owner saja', async () => {
    await kirim(admin, '/api/shift/buka', { modalAwal: 100000 });
    const inv = await invoice([{ metode: 'TUNAI', nominal: 68000, uangDiterima: 68000 }]);
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, {
        [inv.baris[0]!.id]: { qtyDiterima: '4', qtyKembali: '1', alasanKembali: 'KELEBIHAN' },
      }),
      metodeRefund: 'TRANSFER',
    });
    const id = s.hasil!.returUang!.id;
    const tolak = await galat(kasir, `/api/retur/${id}/pengembalian`, {
      metode: 'TRANSFER',
      rekeningRefund: 'BCA 123456 a.n. Proyek',
      referensiRefund: 'TRF889900',
    });
    expect(tolak.status).toBe(403);
    const tanpaAlasan = await galat(kasir, `/api/retur/${id}/ganti-cara`, { metode: 'TUNAI' });
    expect(tanpaAlasan.status).toBe(400);
    const daftar = await kirim<{ id: number; metodeRefund: string }[]>(
      kasir,
      `/api/retur/${id}/ganti-cara`,
      { metode: 'TUNAI', alasan: 'Pembeli minta tunai saat datang' },
    );
    expect(daftar).toEqual([expect.objectContaining({ id, metodeRefund: 'TUNAI' })]);
    await kirim(kasir, `/api/retur/${id}/pengembalian`, { metode: 'TUNAI' });
    const ulang = await galat(kasir, `/api/retur/${id}/ganti-cara`, {
      metode: 'TRANSFER',
      alasan: 'coba lagi',
    });
    expect(ulang.status).toBe(409);
  });

  it('K-176: refund transfer tanpa rekening → tugas menunggu transfer; konfirmasi wajib rekening + bukti, sekali saja', async () => {
    await kirim(admin, '/api/shift/buka', { modalAwal: 100000 });
    const inv = await invoice([{ metode: 'TUNAI', nominal: 68000, uangDiterima: 68000 }]);
    const [semen] = inv.baris;
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(admin, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '4', qtyKembali: '1', alasanKembali: 'KELEBIHAN' },
      }),
      metodeRefund: 'TRANSFER',
    });
    const idRetur = s.hasil!.returUang!.id;
    const r = await ambil<BarisRetur>(admin, `/api/retur/${idRetur}`);
    expect(r).toMatchObject({ statusTransfer: 'MENUNGGU', nominalRefund: 12000 });
    const tugas = await ambil<
      { id: number; nominalRefund: number; rekeningRefund: string | null }[]
    >(admin, '/api/retur/refund-transfer');
    expect(tugas).toEqual([expect.objectContaining({ id: idRetur, rekeningRefund: null })]);
    expect((await galat(kasir, '/api/retur/refund-transfer', undefined, 'GET')).status).toBe(403);
    const tanpaBukti = await galat(admin, `/api/retur/${idRetur}/transfer`, {
      rekeningRefund: 'BCA 123456 a.n. Proyek',
    });
    expect(tanpaBukti.status).toBe(400);
    await kirim(admin, `/api/retur/${idRetur}/transfer`, {
      rekeningRefund: 'BCA 123456 a.n. Proyek',
      referensiRefund: 'TRF-889900',
    });
    expect(await ambil(admin, '/api/retur/refund-transfer')).toEqual([]);
    const selesai = await ambil<{ statusTransfer: string; referensiRefund: string }[]>(
      admin,
      '/api/retur/refund-transfer?status=SELESAI',
    );
    expect(selesai[0]).toMatchObject({ statusTransfer: 'SELESAI', referensiRefund: 'TRF-889900' });
    const ulang = await galat(admin, `/api/retur/${idRetur}/transfer`, {
      rekeningRefund: 'BCA 123456',
      referensiRefund: 'TRF-1',
    });
    expect(ulang.pesan).toContain('sudah dikonfirmasi');
  });

  it('S10/S2: kasir mencatat barang ditolak → retur menunggu atasan; qty-nya tidak bisa dikirim ulang dulu', async () => {
    const inv = await invoice();
    const [semen] = inv.baris;
    const sj = await sjBerangkat(inv);
    const s = await kirim<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj.id}/hasil`, {
      baris: hasil(inv, {
        [semen!.id]: { qtyDiterima: '4', qtyKembali: '1', alasanKembali: 'SALAH_BARANG' },
      }),
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
    await buatSj(inv, (await rit()).id, [{ idPenjualanDetail: semen!.id, qtyKirim: '4' }]);
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
      idPerjalanan: (await rit()).id,
      baris: [{ idPenjualanDetail: langsung.baris[0]!.id, qtyKirim: '1' }],
    });
    expect(salah.kode).toBe('STATUS_TIDAK_VALID');
    const inv = await invoice();
    const staf = await sesiUji('STAF_PENJUALAN');
    expect(
      (
        await galat(staf, `/api/penjualan/${inv.id}/surat-jalan`, {
          idPerjalanan: 1,
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

  it('K-170: barang tanpa data muatan ditandai di Backlog dan masuk notifikasi Admin', async () => {
    const inv = await invoice(); // semen & pasir belum punya data muatan
    let perlu = await ambil<PerluDikirim[]>(kasir, '/api/surat-jalan/perlu-kirim');
    expect(perlu.find((p) => p.idPenjualan === inv.id)?.baris[0]?.tanpaMuatan).toBe(true);
    const notif = await ambil<{ jenis: string; jumlah: number }[]>(admin, '/api/notifikasi');
    expect(notif.find((n) => n.jenis === 'MUATAN_KOSONG')?.jumlah).toBe(2);
    await siapkanMuatan();
    perlu = await ambil<PerluDikirim[]>(kasir, '/api/surat-jalan/perlu-kirim');
    expect(perlu.find((p) => p.idPenjualan === inv.id)?.baris[0]?.tanpaMuatan).toBe(false);
  });

  it('berat di atas daya angkut ditolak; volume sedikit lebih butuh alasan; aman tercatat di perjalanan', async () => {
    await siapkanMuatan();
    const inv = await invoice(); // semen 5 sak = 250 kg, 0,189 m³ (pasir tanpa data)
    const kecil = await kirim<Kendaraan>(admin, '/api/kendaraan', {
      plat: 'L 1 KC',
      jenis: 'Motor roda tiga',
      kapasitasKg: 200,
    });
    const rKecil = await rit(kecil, slamet);
    const sj = await buatSj(inv, rKecil.id, [
      { idPenjualanDetail: inv.baris[0]!.id, qtyKirim: '5' },
    ]);
    await muat(rKecil.id);
    const tolak = await galat(kasir, `/api/perjalanan/${rKecil.id}/berangkat`, {});
    expect(tolak.status).toBe(409);
    expect(tolak.pesan).toContain('melebihi daya angkut');

    // Bak 84 × 60 × 42 cm × faktor isi 85% = 0,180 m³ → volume 105% (dalam toleransi 110%): perlu alasan.
    const pas = await kirim<Kendaraan>(admin, '/api/kendaraan', {
      plat: 'L 2 KC',
      jenis: 'Pikap kecil',
      kapasitasKg: 1000,
      bakPanjangCm: 84,
      bakLebarCm: 60,
      bakTinggiCm: 42,
    });
    const rPas = await rit(pas, slamet);
    const pindah = await kirim<Perjalanan>(kasir, `/api/perjalanan/${rPas.id}/isi`, {
      idSuratJalan: sj.id,
    });
    expect(pindah.muatan).toMatchObject({
      beratKg: '250',
      kesimpulan: 'KONFIRMASI',
      persenBerat: 25,
    });
    expect(pindah.muatan?.tingkat).toEqual({
      berat: 'AMAN',
      volume: 'KONFIRMASI',
      panjang: 'AMAN',
    });
    await muat(rPas.id);
    const tanpaAlasan = await galat(kasir, `/api/perjalanan/${rPas.id}/berangkat`, {});
    expect(tanpaAlasan.status).toBe(400);
    const trip = await berangkat(rPas.id, {
      alasanMuatan: 'Sak ditumpuk satu lapis di atas dinding bak, diikat tali dan ditutup terpal.',
    });
    expect(trip.status).toBe('JALAN');
    expect((await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${sj.id}`)).kendaraan).toBe(
      'L 2 KC (Pikap kecil)',
    );
  });

  it('K-203: centang muat per surat jalan; beban dari yang dicentang; berat dalam toleransi beralasan; ubah rit ganti kendaraan', async () => {
    await siapkanMuatan();
    const a = await invoice(); // semen 5 sak = 250 kg
    const b = await invoice();
    const kecil = await kirim<Kendaraan>(admin, '/api/kendaraan', {
      plat: 'L 3 KC',
      jenis: 'Pikap kecil',
      kapasitasKg: 480,
    });
    const r = await rit(kecil, slamet);
    const sjA = await buatSj(a, r.id, [{ idPenjualanDetail: a.baris[0]!.id, qtyKirim: '5' }]);
    const sjB = await buatSj(b, r.id, [{ idPenjualanDetail: b.baris[0]!.id, qtyKirim: '5' }]);
    const daftarRit = async () =>
      (await ambil<Perjalanan[]>(kasir, '/api/perjalanan?status=DIRENCANAKAN')).find(
        (x) => x.id === r.id,
      )!;
    // Belum ada yang dicentang: beban 0; berangkat ditolak.
    expect((await daftarRit()).muatan?.beratKg).toBe('0');
    expect((await galat(kasir, `/api/perjalanan/${r.id}/berangkat`, {})).pesan).toContain(
      'Centang muat dulu',
    );
    await kirim(kasir, `/api/surat-jalan/${sjA.id}/status`, { status: 'DIMUAT' });
    expect((await daftarRit()).muatan?.beratKg).toBe('250');
    // Lepas centang lalu centang lagi.
    await kirim(kasir, `/api/surat-jalan/${sjA.id}/status`, { status: 'DIPROSES' });
    expect((await daftarRit()).muatan?.beratKg).toBe('0');
    await kirim(kasir, `/api/surat-jalan/${sjA.id}/status`, { status: 'DIMUAT' });
    await kirim(kasir, `/api/surat-jalan/${sjB.id}/status`, { status: 'DIMUAT' });
    // 500 kg dari 480 kg = 104%: dalam toleransi 110% → wajib alasan.
    const m2 = (await daftarRit()).muatan!;
    expect(m2).toMatchObject({ beratKg: '500', kesimpulan: 'KONFIRMASI' });
    expect((await galat(kasir, `/api/perjalanan/${r.id}/berangkat`, {})).status).toBe(400);

    // Toleransi 100% (tanpa toleransi) → ditolak; ganti kendaraan lewat Ubah rit.
    await aturKonfigurasi({ muatan_toleransi_persen: '100' });
    expect((await daftarRit()).muatan?.kesimpulan).toBe('DITOLAK');
    const ubah = await minta(`/api/perjalanan/${r.id}`, {
      method: 'PATCH',
      cookie: kasir.cookie,
      body: { idKendaraan: truk.id, idSopir: budi.id, jadwalBerangkat: jadwal() },
    });
    expect(ubah.status).toBe(200);
    const sj = await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${sjA.id}`);
    expect(sj.sopir).toBe(budi.nama);
    const trip = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r.id}/berangkat`, {});
    expect(trip).toMatchObject({ status: 'JALAN', plat: truk.plat });
    // Setelah berangkat: centang tidak bisa dilepas, rit tidak bisa diubah.
    expect(
      (await galat(kasir, `/api/surat-jalan/${sjA.id}/status`, { status: 'DIPROSES' })).status,
    ).toBe(409);
  });
});

describe('rit rencana papan Pengiriman (K-160, K-174, docs/05 S14)', () => {
  it('rencana → isi dari invoice & surat jalan → dimuat → berangkat; kendaraan terkunci saat jalan', async () => {
    const a = await invoice();
    const b = await invoice();
    const rt = await kirim<Perjalanan>(kasir, '/api/perjalanan/rencana', {
      idKendaraan: truk.id,
      idSopir: slamet.id,
      jadwalBerangkat: jadwal(),
    });
    expect(rt).toMatchObject({ status: 'DIRENCANAKAN', waktuBerangkat: null, suratJalan: [] });
    // Kartu Backlog (invoice) → surat jalan baru untuk semua sisa barangnya, langsung masuk rit.
    let isi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${rt.id}/isi`, {
      idPenjualan: a.id,
    });
    expect(isi.suratJalan).toHaveLength(1);
    expect((await detail(a.id)).baris.map((x) => x.qtyBelumDikirim)).toEqual(['0.000', '0.000']);
    // Sebagian invoice lain (dialog qty) langsung dibuat di rit yang sama.
    await buatSj(b, rt.id, [{ idPenjualanDetail: b.baris[0]!.id, qtyKirim: '2' }]);
    isi = (await ambil<Perjalanan[]>(kasir, '/api/perjalanan?status=DIRENCANAKAN')).find(
      (x) => x.id === rt.id,
    )!;
    expect(isi.suratJalan).toHaveLength(2);
    // Invoice tanpa sisa tidak bisa dijadwalkan lagi.
    expect((await galat(kasir, `/api/perjalanan/${rt.id}/isi`, { idPenjualan: a.id })).status).toBe(
      409,
    );

    await kirim(kasir, `/api/perjalanan/${rt.id}/dimuat`, {});
    const jalan = await kirim<Perjalanan>(kasir, `/api/perjalanan/${rt.id}/berangkat`, {});
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
    await muat(rit2.id);
    const tolak = await galat(kasir, `/api/perjalanan/${rit2.id}/berangkat`, {});
    expect(tolak.pesan).toContain('sedang jalan');
    // Rit yang sudah berangkat tidak bisa diisi.
    expect((await galat(kasir, `/api/perjalanan/${rt.id}/isi`, { idPenjualan: c.id })).status).toBe(
      409,
    );
  });

  it('pindah antar rit mengganti sopir; keluarkan dan batal rit membatalkan surat jalan, barang kembali ke Backlog', async () => {
    const a = await invoice();
    const r1 = await rit(truk, slamet);
    const r2 = await rit(pikap, budi);
    const isi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r1.id}/isi`, {
      idPenjualan: a.id,
    });
    const idSj = isi.suratJalan[0]!.id;
    // Pindah ke r2: sopir dan kendaraan surat jalan ikut r2.
    const r2isi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r2.id}/isi`, {
      idSuratJalan: idSj,
    });
    expect(r2isi.suratJalan.map((s) => s.id)).toEqual([idSj]);
    expect(await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${idSj}`)).toMatchObject({
      sopir: 'Budi',
      kendaraan: 'W 77 X (Pikap)',
    });
    const daftar = await ambil<Perjalanan[]>(kasir, '/api/perjalanan?status=DIRENCANAKAN');
    expect(daftar.find((r) => r.id === r1.id)?.suratJalan).toEqual([]);
    // Keluarkan: surat jalan batal, barang kembali menjadi order kirim.
    await kirim(kasir, '/api/perjalanan/keluar', { idSuratJalan: idSj });
    expect(await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${idSj}`)).toMatchObject({
      status: 'BATAL',
      idPerjalanan: null,
      alasanBatal: `Dikeluarkan dari rit ${r2.nomor}`,
    });
    expect((await detail(a.id)).statusPengiriman).toBe('BELUM');
    expect(
      (await ambil<PerluDikirim[]>(kasir, '/api/surat-jalan/perlu-kirim')).map(
        (p) => p.idPenjualan,
      ),
    ).toContain(a.id);
    // Masuk lagi lalu rit dibatalkan: surat jalannya ikut batal.
    const lagi = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r1.id}/isi`, {
      idPenjualan: a.id,
    });
    const idSj2 = lagi.suratJalan[0]!.id;
    const batal = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r1.id}/batal`, {
      alasan: 'Truk dipakai proyek lain',
    });
    expect(batal).toMatchObject({ status: 'BATAL', alasanBatal: 'Truk dipakai proyek lain' });
    expect(await ambil<BarisSuratJalan>(kasir, `/api/surat-jalan/${idSj2}`)).toMatchObject({
      status: 'BATAL',
      idPerjalanan: null,
    });
    expect((await detail(a.id)).baris.map((b) => b.qtyBelumDikirim)).toEqual(['5.000', '2.000']);
    // Rit yang sudah batal tidak bisa diisi; batal surat jalan langsung juga mengosongkan rit.
    expect((await galat(kasir, `/api/perjalanan/${r1.id}/isi`, { idPenjualan: a.id })).status).toBe(
      409,
    );
    const di2 = await kirim<Perjalanan>(kasir, `/api/perjalanan/${r2.id}/isi`, {
      idPenjualan: a.id,
    });
    await kirim(kasir, `/api/surat-jalan/${di2.suratJalan[0]!.id}/batal`, {
      alasan: 'Pembeli tunda',
    });
    expect((await galat(kasir, `/api/perjalanan/${r2.id}/berangkat`, {})).pesan).toContain(
      'kosong',
    );
  });
});
