import type { DetailPenjualan, DokumenLaporan, HasilSaranPesan, Notifikasi } from '@sit/shared';
import { eq, inArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan, siapkanTierNormal } from '../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../test/pembantu';
import { kosongkanTabel } from '../../../test/reset';
import { db } from '../../db/client';
import { hargaBarang, mutasiPersediaan, pemasok, shiftKasir } from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';
import { hitungSaran } from './saran-pesan/hitung';

/*
 * Rekomendasi pemesanan ulang (docs/05 §17 RO1–RO8, K-113).
 */

type Sesi = Awaited<ReturnType<typeof sesiUji>>;

let admin: Sesi;
let kasir: Sesi;
let m: Awaited<ReturnType<typeof siapkanMasterPersediaan>>;

const kirim = (sesi: Sesi, path: string, body?: unknown, method = 'POST') =>
  minta(path, { method, cookie: sesi.cookie, body });

async function data<T>(r: Response | Promise<Response>): Promise<T> {
  const res = await r;
  if (res.status >= 300) throw new Error(`gagal (${res.status}): ${await res.text()}`);
  return (await json<{ data: T }>(res)).data;
}

const ambil = <T>(sesi: Sesi, path: string) => data<T>(minta(path, { cookie: sesi.cookie }));

const dasar = {
  hariAmatan: 30,
  lamaKirimHari: 3,
  jarakBelanjaHari: 7,
  hariPengaman: 2,
  faktorKemasan: '10',
};

describe('rumus saran pesan (hitung murni)', () => {
  it('RO2–RO5 contoh di K-113: 240 terjual/30 hari, kirim 3, belanja tiap 7, pengaman 2, tersedia 40', () => {
    const h = hitungSaran({ ...dasar, terjual: '240', stokTersedia: '40' });
    expect(h.rataPerHari).toBe('8.000');
    expect(h.stokPengaman).toBe('16.000');
    expect(h.titikPesan).toBe('40.000');
    expect(h.stokTarget).toBe('96.000');
    expect(h.saranPesan).toBe('56.000');
    expect(h.saranKemasan).toBe('6');
    expect(h.hariCukup).toBe('5.000');
    expect(h.status).toBe('PESAN_SEKARANG');
  });

  it('RO6 status: di atas titik pesan tetapi di bawah target = SEGERA; di atas target = AMAN', () => {
    const segera = hitungSaran({ ...dasar, terjual: '240', stokTersedia: '60' });
    expect(segera.status).toBe('SEGERA');
    expect(segera.saranPesan).toBe('36.000');
    const aman = hitungSaran({ ...dasar, terjual: '240', stokTersedia: '100' });
    expect(aman.status).toBe('AMAN');
    expect(aman.saranPesan).toBe('0.000');
    expect(aman.saranKemasan).toBeNull();
  });

  it('RO5 saran dibulatkan ke atas; qty pecahan; stok minus dianggap 0 untuk hari cukup', () => {
    const h = hitungSaran({ ...dasar, terjual: '10', stokTersedia: '1.5', faktorKemasan: null });
    // target = 10 × 12 ÷ 30 = 4; 4 − 1,5 = 2,5 → 3
    expect(h.stokTarget).toBe('4.000');
    expect(h.saranPesan).toBe('3.000');
    expect(h.saranKemasan).toBeNull();
    const minus = hitungSaran({ ...dasar, terjual: '30', stokTersedia: '-2' });
    expect(minus.hariCukup).toBe('0.000');
    expect(minus.status).toBe('PESAN_SEKARANG');
  });

  it('RO7 tidak terjual (atau retur lebih banyak dari penjualan) = TIDAK_LAKU tanpa saran', () => {
    for (const terjual of ['0', '-3']) {
      const h = hitungSaran({ ...dasar, terjual, stokTersedia: '5' });
      expect(h.status).toBe('TIDAK_LAKU');
      expect(h.saranPesan).toBe('0.000');
      expect(h.hariCukup).toBeNull();
    }
    expect(hitungSaran({ ...dasar, hariAmatan: 0, terjual: '5', stokTersedia: '0' }).status).toBe(
      'TIDAK_LAKU',
    );
  });
});

describe('saran pesan dari data sungguhan', () => {
  beforeEach(async () => {
    await siapkanDatabaseSistem();
    m = await siapkanMasterPersediaan();
    await kosongkanTabel(shiftKasir);
    admin = await sesiUji('ADMIN');
    kasir = await sesiUji('KASIR');
    const idTier = await siapkanTierNormal();
    await db.insert(hargaBarang).values({
      idBarang: m.semen,
      idTingkatHarga: idTier,
      metode: 'TETAP',
      hargaTetap: 12000,
      hargaJual: 12000,
    });
    // Pemasok A: kirim 2 hari, belanja tiap 5 hari (RO3–RO4).
    await db
      .update(pemasok)
      .set({ lamaKirimHari: 2, jarakBelanjaHari: 5 })
      .where(eq(pemasok.id, m.pemasokA));
    await data(
      kirim(admin, '/api/penerimaan', {
        idPemasok: m.pemasokA,
        jenis: 'PEMBELIAN',
        syaratBayar: 'TUNAI',
        baris: [{ idBarang: m.semen, qtyMasuk: '100', hargaModalMasuk: 10000 }],
      }),
    );
    await data(kirim(kasir, '/api/shift/buka', { modalAwal: 0 }));
    await data(kirim(admin, '/api/shift/buka', { modalAwal: 100000 }));
  });

  async function jual(qty: string) {
    return data<DetailPenjualan>(
      kirim(kasir, '/api/penjualan/checkout', {
        order: { jenisPenjualan: 'LANGSUNG', baris: [{ idBarang: m.semen, qty }] },
        pembayaran: [{ metode: 'TUNAI', uangDiterima: 10_000_000 }],
      }),
    );
  }

  /** Memindahkan seluruh riwayat stok barang ke `hari` hari lalu (tes saja: periode berakhir kemarin). */
  async function mundurkan(idBarang: number[], hari: number) {
    await db
      .update(mutasiPersediaan)
      .set({ tanggalOperasional: tambahHari(tanggalOperasional(), -hari) })
      .where(inArray(mutasiPersediaan.idBarang, idBarang));
  }

  it('RO1 terjual bersih dari ledger (void dikurangkan), RO3–RO4 parameter pemasok, RO8 titipan tidak ikut', async () => {
    await jual('60');
    const batal = await jual('10');
    const v = await data<{ status: string }>(
      kirim(admin, '/api/void', {
        idPenjualan: batal.id,
        lingkup: 'TRANSAKSI',
        alasan: 'Salah input',
        persetujuan: { metodeRefund: 'TUNAI' },
      }),
    );
    expect(v.status).toBe('DISETUJUI');
    // Riwayat barang 10 hari: hari amatan = 10 (lebih pendek dari periode 30).
    await mundurkan([m.semen], 10);

    const h = await ambil<HasilSaranPesan>(admin, '/api/saran-pesan?tampil=SEMUA');
    expect(h.parameter.periodeHari).toBe(30);
    expect(h.parameter.sampai).toBe(tambahHari(tanggalOperasional(), -1));
    const s = h.baris.find((b) => b.idBarang === m.semen)!;
    expect(s.hariAmatan).toBe(10);
    expect(s.terjual).toBe('60.000'); // 60 + 10 − 10 (void)
    expect(s.rataPerHari).toBe('6.000');
    expect(s.namaPemasok).toBe('CV. Semen Jaya');
    expect(s.lamaKirimHari).toBe(2);
    expect(s.jarakBelanjaHari).toBe(5);
    // tersedia 40; titik = 6 × (2 + 2) = 24; target = 6 × (2 + 5 + 2) = 54; saran 14; SEGERA
    expect(s.stokTersedia).toBe('40.000');
    expect(s.titikPesan).toBe('24.000');
    expect(s.stokTarget).toBe('54.000');
    expect(s.saranPesan).toBe('14.000');
    expect(s.status).toBe('SEGERA');
    expect(s.perkiraanBiaya).toBe(140000); // 14 × harga beli terakhir 10.000
    expect(h.baris.some((b) => b.idBarang === m.titip)).toBe(false);
    expect(h.baris.some((b) => b.idBarang === m.mati)).toBe(false);
    // Pasir: belum pernah dibeli/terjual → bawaan pengaturan, TIDAK_LAKU.
    const pasir = h.baris.find((b) => b.idBarang === m.pasir)!;
    expect(pasir.status).toBe('TIDAK_LAKU');
    expect(pasir.lamaKirimHari).toBe(3);
    expect(pasir.jarakBelanjaHari).toBe(7);
    expect(h.perPemasok).toEqual([
      {
        idPemasok: m.pemasokA,
        namaPemasok: 'CV. Semen Jaya',
        jumlahBarang: 1,
        perkiraanBiaya: 140000,
      },
    ]);
    // Bawaan tampil = yang perlu dipesan saja.
    const perlu = await ambil<HasilSaranPesan>(admin, '/api/saran-pesan');
    expect(perlu.baris.map((b) => b.idBarang)).toEqual([m.semen]);
  });

  it('RO1 penjualan hari ini belum dihitung (periode sampai kemarin); RO6 notifikasi Pesan sekarang; laporan; Kasir ditolak', async () => {
    await jual('90');
    await mundurkan([m.semen], 15);
    await jual('5'); // hari ini: tidak masuk rata-rata, tetapi mengurangi stok tersedia
    const h = await ambil<HasilSaranPesan>(admin, '/api/saran-pesan');
    const s = h.baris.find((b) => b.idBarang === m.semen)!;
    expect(s.hariAmatan).toBe(15);
    expect(s.terjual).toBe('90.000');
    expect(s.stokTersedia).toBe('5.000');
    expect(s.status).toBe('PESAN_SEKARANG'); // titik = 6 × 4 = 24 ≥ 5
    expect(h.jumlah.PESAN_SEKARANG).toBe(1);

    const notif = await ambil<Notifikasi[]>(admin, '/api/notifikasi');
    expect(notif.find((n) => n.jenis === 'PERLU_DIPESAN')?.jumlah).toBe(1);

    const lap = await ambil<DokumenLaporan>(admin, '/api/laporan/rekomendasi-pesan');
    expect(JSON.stringify(lap)).toContain('Semen Gresik 40 kg');
    expect(JSON.stringify(lap)).toContain('Pesan sekarang');

    expect((await minta('/api/saran-pesan', { cookie: kasir.cookie })).status).toBe(403);
    expect((await minta('/api/laporan/rekomendasi-pesan', { cookie: kasir.cookie })).status).toBe(
      403,
    );
    const nk = await ambil<Notifikasi[]>(kasir, '/api/notifikasi');
    expect(nk.some((n) => n.jenis === 'PERLU_DIPESAN')).toBe(false);
  });
});
