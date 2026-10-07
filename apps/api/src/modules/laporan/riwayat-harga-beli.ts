import {
  hargaSatuanEfektif,
  keQty,
  tambahQty,
  teksPeriode,
  type BarisTabelLaporan,
  type DokumenLaporan,
  type skemaLaporanRiwayatHargaBeli,
} from '@sit/shared';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import {
  barang,
  pemasok,
  pembayaranPemasok,
  penerimaanBarang,
  penerimaanBarangDetail,
  satuan,
} from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { namaKategori } from './stok-rekap';
import {
  angka,
  KOSONG,
  persen,
  persenDari,
  qty,
  SATUAN_RUPIAH,
  susunDokumen,
  tanggal,
  teks,
  uang,
} from './umum';

/*
 * Laporan Riwayat Harga Beli (docs/06 HT7, K-087): harga modal per satuan dasar dari setiap penerimaan
 * jenis PEMBELIAN (konsinyasi tidak ikut), perubahan dibanding pembelian sebelumnya barang yang sama dari
 * pemasok yang sama (dihitung atas seluruh riwayat, jadi baris pertama periode tetap punya pembanding), dan
 * perbandingan harga antarpemasok. Seluruh isinya harga modal: butuh `laporan.laba` (docs/04 §5).
 */

export type DataRiwayatHargaBeli = z.output<typeof skemaLaporanRiwayatHargaBeli>;

export type BarisRiwayatHargaBeli = {
  idBarang: number;
  kode: string;
  namaBarang: string;
  kodeSatuan: string;
  idPemasok: number;
  namaPemasok: string;
  tanggal: string;
  nomor: string;
  noFaktur: string | null;
  qty: string;
  harga: number;
  hargaSebelumnya: number | null;
  subtotal: number;
};

export type RingkasPemasok = {
  idBarang: number;
  namaPemasok: string;
  jumlah: number;
  qty: string;
  terendah: number;
  tertinggi: number;
  rataRata: number;
  terakhir: number;
  tanggalTerakhir: string;
};

export async function hitungRiwayatHargaBeli(p: DataRiwayatHargaBeli): Promise<{
  baris: BarisRiwayatHargaBeli[];
  ringkas: RingkasPemasok[];
}> {
  // Lag dihitung di subkueri atas seluruh riwayat sampai akhir periode, baru disaring ke awal periode.
  const riwayat = db
    .select({
      idDetail: sql<number>`${penerimaanBarangDetail.id}`.as('id_detail'),
      idPenerimaan: sql<number>`${penerimaanBarang.id}`.as('id_penerimaan'),
      nomor: penerimaanBarang.nomor,
      tanggal: penerimaanBarang.tanggalOperasional,
      noFaktur: penerimaanBarang.noFakturPemasok,
      idPemasok: sql<number>`${penerimaanBarang.idPemasok}`.as('id_pemasok_r'),
      namaPemasok: pemasok.namaPemasok,
      idBarang: sql<number>`${barang.id}`.as('id_barang_r'),
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      kodeSatuan: sql<string>`${satuan.kode}`.as('kode_satuan'),
      qty: penerimaanBarangDetail.qtyDasar,
      harga: penerimaanBarangDetail.hargaModalDasar,
      subtotal: penerimaanBarangDetail.subtotal,
      hargaSebelumnya: sql<string | null>`lag(${penerimaanBarangDetail.hargaModalDasar}) over (
        partition by ${penerimaanBarangDetail.idBarang}, ${penerimaanBarang.idPemasok}
        order by ${penerimaanBarang.tanggalOperasional}, ${penerimaanBarang.id}, ${penerimaanBarangDetail.id}
      )`.as('harga_sebelumnya'),
    })
    .from(penerimaanBarangDetail)
    .innerJoin(penerimaanBarang, eq(penerimaanBarang.id, penerimaanBarangDetail.idPenerimaan))
    .innerJoin(barang, eq(barang.id, penerimaanBarangDetail.idBarang))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .innerJoin(pemasok, eq(pemasok.id, penerimaanBarang.idPemasok))
    .where(
      and(
        eq(penerimaanBarang.jenis, 'PEMBELIAN'),
        lte(penerimaanBarang.tanggalOperasional, p.sampai),
        // Barang pengganti retur pemasok (RP5, dibayar kompensasi) bukan pembelian baru.
        sql`not exists (select 1 from ${pembayaranPemasok} k
          where k.id_penerimaan = ${penerimaanBarang.id} and k.metode = 'KOMPENSASI')`,
        p.idBarang === undefined ? undefined : eq(penerimaanBarangDetail.idBarang, p.idBarang),
        p.idPemasok === undefined ? undefined : eq(penerimaanBarang.idPemasok, p.idPemasok),
        p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
      ),
    )
    .as('riwayat');

  const rows = await db
    .select()
    .from(riwayat)
    .where(gte(riwayat.tanggal, p.dari))
    .orderBy(
      asc(riwayat.namaBarang),
      asc(riwayat.idBarang),
      asc(riwayat.namaPemasok),
      asc(riwayat.tanggal),
      asc(riwayat.idPenerimaan),
      asc(riwayat.idDetail),
    );

  const baris: BarisRiwayatHargaBeli[] = rows.map((r) => ({
    idBarang: Number(r.idBarang),
    kode: r.kode,
    namaBarang: r.namaBarang,
    kodeSatuan: r.kodeSatuan,
    idPemasok: Number(r.idPemasok),
    namaPemasok: r.namaPemasok,
    tanggal: r.tanggal,
    nomor: r.nomor,
    noFaktur: r.noFaktur,
    qty: keQty(r.qty),
    harga: Number(r.harga),
    hargaSebelumnya: r.hargaSebelumnya === null ? null : Number(r.hargaSebelumnya),
    subtotal: Number(r.subtotal),
  }));

  const kelompok = new Map<string, BarisRiwayatHargaBeli[]>();
  for (const b of baris) {
    const k = `${b.idBarang}:${b.idPemasok}`;
    kelompok.set(k, [...(kelompok.get(k) ?? []), b]);
  }
  const ringkas = [...kelompok.values()].map((xs) => {
    const totalQty = xs.reduce((t, x) => tambahQty(t, x.qty), '0');
    const totalNilai = xs.reduce((t, x) => t + x.subtotal, 0);
    const akhir = xs[xs.length - 1]!;
    return {
      idBarang: akhir.idBarang,
      namaPemasok: akhir.namaPemasok,
      jumlah: xs.length,
      qty: keQty(totalQty),
      terendah: Math.min(...xs.map((x) => x.harga)),
      tertinggi: Math.max(...xs.map((x) => x.harga)),
      // Rata-rata tertimbang qty: Σ subtotal ÷ Σ qty, dibulatkan ke rupiah.
      rataRata: hargaSatuanEfektif(totalNilai, totalQty),
      terakhir: akhir.harga,
      tanggalTerakhir: akhir.tanggal,
    };
  });
  return { baris, ringkas };
}

async function namaFilter(tabel: 'barang' | 'pemasok', id: number | undefined) {
  if (id === undefined) return null;
  if (tabel === 'barang') {
    const [b] = await db
      .select({ nama: barang.namaBarang, kode: barang.kode })
      .from(barang)
      .where(eq(barang.id, id));
    return b ? `${b.kode} ${b.nama}` : null;
  }
  const [x] = await db
    .select({ nama: pemasok.namaPemasok })
    .from(pemasok)
    .where(eq(pemasok.id, id));
  return x?.nama ?? null;
}

export async function laporanRiwayatHargaBeli(
  p: DataRiwayatHargaBeli,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const h = await hitungRiwayatHargaBeli(p);

  const isi: BarisTabelLaporan[] = [];
  let idBarangAktif: number | null = null;
  const barangUrut: { id: number; label: string }[] = [];
  for (let i = 0; i < h.baris.length; i++) {
    const b = h.baris[i]!;
    if (b.idBarang !== idBarangAktif) {
      idBarangAktif = b.idBarang;
      const label = `${b.kode} — ${b.namaBarang} (per ${b.kodeSatuan})`;
      barangUrut.push({ id: b.idBarang, label });
      isi.push({ gaya: 'grup', sel: [], label });
    }
    const selisih = b.hargaSebelumnya === null ? null : b.harga - b.hargaSebelumnya;
    isi.push({
      gaya: 'data',
      sel: [
        tanggal(b.tanggal),
        teks(b.nomor, { mono: true }),
        teks(b.namaPemasok),
        teks(b.noFaktur ?? '—'),
        qty(b.qty),
        uang(b.harga),
        selisih === null ? teks('pertama') : uang(selisih),
        selisih === null || b.hargaSebelumnya === null
          ? KOSONG
          : persen(persenDari(selisih, b.hargaSebelumnya)),
        uang(b.subtotal),
      ],
    });
    const berikut = h.baris[i + 1];
    if (!berikut || berikut.idBarang !== b.idBarang) {
      const milik = h.baris.filter((x) => x.idBarang === b.idBarang);
      const totalQty = milik.reduce((t, x) => tambahQty(t, x.qty), '0');
      const totalNilai = milik.reduce((t, x) => t + x.subtotal, 0);
      isi.push({
        gaya: 'subtotal',
        label: `Jumlah ${milik.length} penerimaan · rata-rata tertimbang`,
        sel: [
          KOSONG,
          KOSONG,
          KOSONG,
          KOSONG,
          qty(keQty(totalQty)),
          uang(hargaSatuanEfektif(totalNilai, totalQty)),
          KOSONG,
          KOSONG,
          uang(totalNilai),
        ],
      });
    }
  }

  const isiRingkas: BarisTabelLaporan[] = [];
  for (const b of barangUrut) {
    const milik = h.ringkas.filter((r) => r.idBarang === b.id);
    isiRingkas.push({ gaya: 'grup', sel: [], label: b.label });
    const termurah = Math.min(...milik.map((r) => r.terakhir));
    for (const r of milik) {
      isiRingkas.push({
        gaya: 'data',
        sel: [
          teks(r.namaPemasok, { tebal: milik.length > 1 && r.terakhir === termurah }),
          angka(r.jumlah),
          qty(r.qty),
          uang(r.terendah),
          uang(r.tertinggi),
          uang(r.rataRata),
          uang(r.terakhir),
          tanggal(r.tanggalTerakhir),
        ],
      });
    }
  }

  const kriteria = [
    `Barang: ${(await namaFilter('barang', p.idBarang)) ?? 'semua'}`,
    `Pemasok: ${(await namaFilter('pemasok', p.idPemasok)) ?? 'semua'}`,
    `Kategori: ${(await namaKategori(p.idKategori)) ?? 'semua'}`,
  ].join(' · ');

  return susunDokumen('riwayat-harga-beli', pelaku, {
    subjudul: [teksPeriode(p.dari, p.sampai), kriteria, SATUAN_RUPIAH],
    orientasi: 'lanskap',
    bagian: [
      {
        jenis: 'tabel',
        judul: 'Riwayat per Penerimaan',
        tabel: {
          kolom: [
            { judul: 'Tanggal', jenis: 'tanggal', lebar: 11 },
            { judul: 'No. Penerimaan', jenis: 'teks', lebar: 16 },
            { judul: 'Pemasok', jenis: 'teks', lebar: 22 },
            { judul: 'No. Faktur', jenis: 'teks', lebar: 13 },
            { judul: 'Qty', jenis: 'qty', lebar: 9 },
            { judul: 'Harga Beli', jenis: 'uang', lebar: 13 },
            { judul: 'Perubahan', jenis: 'uang', lebar: 12, grup: 'Dibanding sebelumnya' },
            { judul: '%', jenis: 'persen', lebar: 8, grup: 'Dibanding sebelumnya' },
            { judul: 'Subtotal', jenis: 'uang', lebar: 14 },
          ],
          baris: isi,
          kosong: 'Tidak ada penerimaan pembelian dalam periode ini.',
        },
      },
      {
        jenis: 'tabel',
        judul: 'Perbandingan Harga per Pemasok',
        tabel: {
          kolom: [
            { judul: 'Pemasok', jenis: 'teks', lebar: 26 },
            { judul: 'Penerimaan', jenis: 'angka', lebar: 10 },
            { judul: 'Qty', jenis: 'qty', lebar: 10 },
            { judul: 'Terendah', jenis: 'uang', lebar: 13 },
            { judul: 'Tertinggi', jenis: 'uang', lebar: 13 },
            { judul: 'Rata-rata', jenis: 'uang', lebar: 13 },
            { judul: 'Terakhir', jenis: 'uang', lebar: 13 },
            { judul: 'Tgl Terakhir', jenis: 'tanggal', lebar: 11 },
          ],
          baris: isiRingkas,
          kosong: 'Tidak ada data.',
        },
      },
    ],
    catatan: [
      'Harga beli = harga modal per satuan dasar pada penerimaan jenis pembelian; penerimaan barang titipan (konsinyasi) tidak termasuk.',
      'Perubahan dibandingkan dengan pembelian sebelumnya untuk barang yang sama dari pemasok yang sama, termasuk pembelian sebelum awal periode; "pertama" berarti belum pernah dibeli dari pemasok itu.',
      'Rata-rata = rata-rata tertimbang kuantitas (Σ nilai ÷ Σ qty) dalam periode, dibulatkan ke rupiah. Pada perbandingan, pemasok dengan harga terakhir termurah dicetak tebal.',
    ],
    berkas: `${p.dari}_${p.sampai}`,
  });
}
