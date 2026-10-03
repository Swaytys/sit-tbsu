import {
  bandingQty,
  keQty,
  kurangQty,
  tambahQty,
  teksPeriode,
  teksTanggalPanjang,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type JenisMutasi,
  type Kepemilikan,
  type skemaLaporanStokRekap,
} from '@sit/shared';
import { and, asc, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db, type Executor } from '../../db/client';
import { barang, kategori, mutasiPersediaan, satuan } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { angka, qty, susunDokumen, teks } from './umum';

/*
 * Laporan Stok Rekap (docs/05 §14): per barang, bucket BAIK, berdasarkan tanggal operasional mutasi.
 * stok awal = saldo sesudah mutasi terakhir sebelum periode; masuk/keluar = Σ qty mutasi periode;
 * stok akhir = awal + masuk − keluar, dan wajib sama dengan saldo ledger terakhir dalam periode.
 */

export type DataStokRekap = z.output<typeof skemaLaporanStokRekap>;

export type BarisStokRekap = {
  idBarang: number;
  kode: string;
  namaBarang: string;
  namaKategori: string;
  kodeSatuan: string;
  kepemilikan: Kepemilikan;
  saldoAwal: string;
  masukPenerimaan: string;
  masukReturVoid: string;
  masukLain: string;
  keluarPenjualan: string;
  keluarLain: string;
  totalMasuk: string;
  totalKeluar: string;
  saldoAkhir: string;
};

const MASUK_RETUR_VOID: readonly JenisMutasi[] = ['RETUR_JUAL', 'VOID'];
const KELUAR_PENJUALAN: readonly JenisMutasi[] = ['PENJUALAN', 'TUKAR_RETUR'];

function saldoTerakhir(ex: Executor, syarat: ReturnType<typeof and>) {
  const m = mutasiPersediaan;
  return ex
    .selectDistinctOn([m.idBarang], { idBarang: m.idBarang, saldo: m.saldoSetelah })
    .from(m)
    .where(and(eq(m.kondisi, 'BAIK'), syarat))
    .orderBy(m.idBarang, desc(m.id));
}

export async function hitungStokRekap(p: DataStokRekap): Promise<BarisStokRekap[]> {
  const m = mutasiPersediaan;
  const daftarBarang = await db
    .select({
      idBarang: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      kepemilikan: barang.kepemilikan,
      aktif: sql<boolean>`${barang.statusAktif} = 'AKTIF'`,
    })
    .from(barang)
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(
      and(
        p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
        p.kepemilikan === undefined ? undefined : eq(barang.kepemilikan, p.kepemilikan),
      ),
    )
    .orderBy(asc(kategori.nama), asc(barang.namaBarang), asc(barang.id));

  const awal = new Map(
    (await saldoTerakhir(db, lt(m.tanggalOperasional, p.dari))).map((r) => [r.idBarang, r.saldo]),
  );
  const akhirLedger = new Map(
    (await saldoTerakhir(db, lte(m.tanggalOperasional, p.sampai))).map((r) => [
      r.idBarang,
      r.saldo,
    ]),
  );
  const gerak = await db
    .select({
      idBarang: m.idBarang,
      jenis: m.jenisMutasi,
      masuk: sql<string>`sum(${m.qtyMasuk})::text`,
      keluar: sql<string>`sum(${m.qtyKeluar})::text`,
    })
    .from(m)
    .where(
      and(
        eq(m.kondisi, 'BAIK'),
        gte(m.tanggalOperasional, p.dari),
        lte(m.tanggalOperasional, p.sampai),
      ),
    )
    .groupBy(m.idBarang, m.jenisMutasi);

  type Gerak = Pick<
    BarisStokRekap,
    'masukPenerimaan' | 'masukReturVoid' | 'masukLain' | 'keluarPenjualan' | 'keluarLain'
  >;
  const perBarang = new Map<number, Gerak>();
  for (const g of gerak) {
    const x = perBarang.get(g.idBarang) ?? {
      masukPenerimaan: '0',
      masukReturVoid: '0',
      masukLain: '0',
      keluarPenjualan: '0',
      keluarLain: '0',
    };
    if (g.jenis === 'PENERIMAAN') x.masukPenerimaan = tambahQty(x.masukPenerimaan, g.masuk);
    else if (MASUK_RETUR_VOID.includes(g.jenis)) {
      x.masukReturVoid = tambahQty(x.masukReturVoid, g.masuk);
    } else x.masukLain = tambahQty(x.masukLain, g.masuk);
    if (KELUAR_PENJUALAN.includes(g.jenis)) {
      x.keluarPenjualan = tambahQty(x.keluarPenjualan, g.keluar);
    } else x.keluarLain = tambahQty(x.keluarLain, g.keluar);
    perBarang.set(g.idBarang, x);
  }

  const hasil: BarisStokRekap[] = [];
  for (const b of daftarBarang) {
    const g = perBarang.get(b.idBarang);
    const saldoAwal = keQty(awal.get(b.idBarang) ?? '0');
    const tampil =
      p.cakupan === 'BERMUTASI'
        ? g !== undefined
        : g !== undefined || b.aktif || bandingQty(saldoAwal, 0) !== 0;
    if (!tampil) continue;
    const x = g ?? {
      masukPenerimaan: '0',
      masukReturVoid: '0',
      masukLain: '0',
      keluarPenjualan: '0',
      keluarLain: '0',
    };
    const totalMasuk = tambahQty(tambahQty(x.masukPenerimaan, x.masukReturVoid), x.masukLain);
    const totalKeluar = tambahQty(x.keluarPenjualan, x.keluarLain);
    const saldoAkhir = kurangQty(tambahQty(saldoAwal, totalMasuk), totalKeluar);
    const ledger = akhirLedger.get(b.idBarang);
    if (ledger !== undefined && keQty(ledger) !== saldoAkhir) {
      throw new Error(`Stok rekap barang ${b.idBarang} tidak sama dengan ledger (L3)`);
    }
    hasil.push({
      idBarang: b.idBarang,
      kode: b.kode,
      namaBarang: b.namaBarang,
      namaKategori: b.namaKategori,
      kodeSatuan: b.kodeSatuan,
      kepemilikan: b.kepemilikan,
      saldoAwal,
      masukPenerimaan: keQty(x.masukPenerimaan),
      masukReturVoid: keQty(x.masukReturVoid),
      masukLain: keQty(x.masukLain),
      keluarPenjualan: keQty(x.keluarPenjualan),
      keluarLain: keQty(x.keluarLain),
      totalMasuk,
      totalKeluar,
      saldoAkhir,
    });
  }
  return hasil;
}

export async function namaKategori(id: number | undefined): Promise<string | null> {
  if (id === undefined) return null;
  const [k] = await db
    .select({ nama: kategori.nama })
    .from(kategori)
    .where(eq(kategori.id, id))
    .limit(1);
  return k?.nama ?? null;
}

export async function laporanStokRekap(
  p: DataStokRekap,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const baris = await hitungStokRekap(p);
  const kriteria = [
    `Kategori: ${(await namaKategori(p.idKategori)) ?? 'semua'}`,
    `Kepemilikan: ${p.kepemilikan === undefined ? 'semua' : p.kepemilikan === 'KONSINYASI' ? 'titipan (konsinyasi)' : 'milik sendiri'}`,
    p.cakupan === 'BERMUTASI' ? 'hanya barang yang bermutasi' : 'semua barang aktif',
  ].join(' · ');

  const isi: BarisTabelLaporan[] = [];
  let kategoriAktif = '';
  let no = 0;
  for (const b of baris) {
    if (b.namaKategori !== kategoriAktif) {
      kategoriAktif = b.namaKategori;
      isi.push({ gaya: 'grup', sel: [], label: kategoriAktif });
    }
    isi.push({
      gaya: 'data',
      sel: [
        angka(++no),
        teks(b.kode, { mono: true }),
        teks(b.kepemilikan === 'KONSINYASI' ? `${b.namaBarang} (titipan)` : b.namaBarang),
        teks(b.kodeSatuan),
        qty(b.saldoAwal),
        qty(b.masukPenerimaan),
        qty(b.masukReturVoid),
        qty(b.masukLain),
        qty(b.keluarPenjualan),
        qty(b.keluarLain),
        qty(b.saldoAkhir),
      ],
    });
  }

  // Rekapitulasi per satuan: kuantitas hanya dijumlah bila satuannya sama.
  const perSatuan = new Map<
    string,
    { n: number; awal: string; masuk: string; keluar: string; akhir: string }
  >();
  for (const b of baris) {
    const r = perSatuan.get(b.kodeSatuan) ?? {
      n: 0,
      awal: '0',
      masuk: '0',
      keluar: '0',
      akhir: '0',
    };
    r.n += 1;
    r.awal = tambahQty(r.awal, b.saldoAwal);
    r.masuk = tambahQty(r.masuk, b.totalMasuk);
    r.keluar = tambahQty(r.keluar, b.totalKeluar);
    r.akhir = tambahQty(r.akhir, b.saldoAkhir);
    perSatuan.set(b.kodeSatuan, r);
  }

  return susunDokumen('stok-rekap', pelaku, {
    subjudul: [teksPeriode(p.dari, p.sampai), kriteria, '(Kuantitas dalam satuan dasar barang)'],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'tabel',
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'Kode', jenis: 'teks', lebar: 12 },
            { judul: 'Nama Barang', jenis: 'teks', lebar: 34 },
            { judul: 'Satuan', jenis: 'teks', lebar: 8 },
            { judul: 'Saldo Awal', jenis: 'qty', lebar: 11 },
            { judul: 'Penerimaan', jenis: 'qty', lebar: 11, grup: 'Masuk' },
            { judul: 'Retur & Void', jenis: 'qty', lebar: 11, grup: 'Masuk' },
            { judul: 'Lainnya', jenis: 'qty', lebar: 10, grup: 'Masuk' },
            { judul: 'Penjualan', jenis: 'qty', lebar: 11, grup: 'Keluar' },
            { judul: 'Lainnya', jenis: 'qty', lebar: 10, grup: 'Keluar' },
            { judul: 'Saldo Akhir', jenis: 'qty', lebar: 11 },
          ],
          baris: isi,
          kosong: 'Tidak ada barang yang sesuai kriteria.',
        },
      },
      {
        jenis: 'tabel',
        judul: 'Rekapitulasi per Satuan',
        tabel: {
          kolom: [
            { judul: 'Satuan', jenis: 'teks', lebar: 10 },
            { judul: 'Jumlah Barang', jenis: 'angka', lebar: 12 },
            { judul: 'Saldo Awal', jenis: 'qty', lebar: 12 },
            { judul: 'Masuk', jenis: 'qty', lebar: 12 },
            { judul: 'Keluar', jenis: 'qty', lebar: 12 },
            { judul: 'Saldo Akhir', jenis: 'qty', lebar: 12 },
          ],
          baris: [...perSatuan.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([s, r]) => ({
              gaya: 'data' as const,
              sel: [teks(s), angka(r.n), qty(r.awal), qty(r.masuk), qty(r.keluar), qty(r.akhir)],
            })),
          kosong: '—',
        },
      },
    ],
    catatan: [
      `Angka diambil dari buku persediaan (mutasi stok) kondisi baik menurut tanggal operasional; stok rusak tidak termasuk.`,
      `Saldo awal adalah saldo setelah mutasi terakhir sebelum ${teksTanggalPanjang(p.dari)}. Saldo akhir = saldo awal + masuk − keluar, dan telah dicocokkan dengan saldo buku persediaan.`,
      'Masuk "Lainnya": saldo awal dan penyesuaian (opname/koreksi) yang menambah stok. Keluar "Lainnya": penyesuaian yang mengurangi stok, pemindahan ke stok rusak, dan retur ke pemasok. Penjualan termasuk barang pengganti tukar retur.',
      'Kuantitas barang bersatuan berbeda tidak dijumlahkan; jumlah per satuan ada pada rekapitulasi.',
      'Tanda pisah (–) berarti nol.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
