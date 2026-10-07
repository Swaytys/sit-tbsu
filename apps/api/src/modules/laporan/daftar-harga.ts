import type { BarisTabelLaporan, DokumenLaporan, skemaLaporanDaftarHarga } from '@sit/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { barang, hargaBarang, kategori, satuan, tingkatHarga } from '../../db/schema';
import type { PenggunaAktif } from '../../lib/konteks';
import { tanggalOperasional } from '../../lib/waktu';
import { namaKategori } from './stok-rekap';
import { angka, KOSONG, susunDokumen, teks, teksPerSaatIni, uang, SATUAN_RUPIAH } from './umum';

/*
 * Daftar Harga / katalog harga (Fase 12, K-090): harga jual per satuan dasar untuk setiap tier aktif, barang
 * AKTIF dikelompokkan per kategori. Hanya harga jual (bukan data sensitif), bisa dicetak atau diekspor Excel
 * untuk pelanggan.
 */

export type DataDaftarHarga = z.output<typeof skemaLaporanDaftarHarga>;

export async function laporanDaftarHarga(
  p: DataDaftarHarga,
  pelaku: PenggunaAktif,
): Promise<DokumenLaporan> {
  const tier = await db
    .select({ id: tingkatHarga.id, nama: tingkatHarga.nama })
    .from(tingkatHarga)
    .where(eq(tingkatHarga.statusAktif, 'AKTIF'))
    .orderBy(asc(tingkatHarga.urutan), asc(tingkatHarga.id));
  const daftar = await db
    .select({
      id: barang.id,
      kode: barang.kode,
      namaBarang: barang.namaBarang,
      kepemilikan: barang.kepemilikan,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
    })
    .from(barang)
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(
      and(
        eq(barang.statusAktif, 'AKTIF'),
        p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
      ),
    )
    .orderBy(asc(kategori.nama), asc(barang.namaBarang), asc(barang.id));
  const harga =
    daftar.length === 0
      ? []
      : await db
          .select({
            idBarang: hargaBarang.idBarang,
            idTingkatHarga: hargaBarang.idTingkatHarga,
            hargaJual: hargaBarang.hargaJual,
          })
          .from(hargaBarang)
          .where(
            and(
              inArray(
                hargaBarang.idBarang,
                daftar.map((b) => b.id),
              ),
              isNull(hargaBarang.idSatuanJual),
            ),
          );
  const peta = new Map(harga.map((h) => [`${h.idBarang}:${h.idTingkatHarga}`, h.hargaJual]));

  const isi: BarisTabelLaporan[] = [];
  let no = 0;
  for (let i = 0; i < daftar.length;) {
    const kat = daftar[i]!.namaKategori;
    isi.push({ gaya: 'grup', sel: [], label: kat });
    for (; i < daftar.length && daftar[i]!.namaKategori === kat; i++) {
      const b = daftar[i]!;
      isi.push({
        gaya: 'data',
        sel: [
          angka(++no),
          teks(b.kode, { mono: true }),
          teks(b.namaBarang),
          teks(b.kodeSatuan),
          ...tier.map((t) => {
            const v = peta.get(`${b.id}:${t.id}`);
            return v === undefined ? KOSONG : uang(v);
          }),
        ],
      });
    }
  }

  const lebarTier = Math.max(10, Math.min(14, Math.floor(60 / Math.max(1, tier.length))));
  return susunDokumen('daftar-harga', pelaku, {
    subjudul: [
      teksPerSaatIni(),
      `Kategori: ${(await namaKategori(p.idKategori)) ?? 'semua'}`,
      `${SATUAN_RUPIAH}; harga per satuan dasar barang`,
    ],
    orientasi: tier.length > 3 ? 'lanskap' : 'potret',
    bagian: [
      {
        jenis: 'tabel',
        judul: `Daftar Harga (${daftar.length} barang)`,
        tabel: {
          kolom: [
            { judul: 'No', jenis: 'angka', lebar: 5 },
            { judul: 'Kode', jenis: 'teks', lebar: 12 },
            { judul: 'Nama Barang', jenis: 'teks', lebar: 34 },
            { judul: 'Satuan', jenis: 'teks', lebar: 7 },
            ...tier.map((t) => ({ judul: t.nama, jenis: 'uang' as const, lebar: lebarTier })),
          ],
          baris: isi,
          kosong: 'Tidak ada barang aktif.',
        },
      },
    ],
    catatan: [
      'Harga dapat berubah sewaktu-waktu. Promo yang sedang berjalan dihitung otomatis saat transaksi dan tidak tercantum di daftar ini.',
    ],
    berkas: tanggalOperasional(),
  });
}
