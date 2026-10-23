import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { HasilCari, Izin } from '@sit/shared';
import { db } from '../../../db/client';
import {
  barang,
  orderPenjualan,
  pelanggan,
  pemasok,
  penerimaanBarang,
  penjualan,
  persediaan,
  returPenjualan,
  suratJalan,
  voidTransaksi,
} from '../../../db/schema';
import type { PenggunaAktif } from '../../../lib/konteks';
import { polaCari } from '../../../lib/paginasi';

/*
 * K-167: pencarian universal di topbar. Setiap kelompok hanya dicari bila pengguna punya izin melihatnya
 * (API tetap penjaga, docs/04). Paling banyak 5 hasil per kelompok; nomor dokumen dicari bila teksnya memuat angka.
 */

const BATAS = 5;

export async function cariUniversal(q: string, pelaku: PenggunaAktif): Promise<HasilCari[]> {
  const teks = q.trim();
  if (teks.length < 2) return [];
  const pola = polaCari(teks);
  const boleh = (i: Izin) => pelaku.izin.has(i);
  const adaAngka = /\d/.test(teks);
  const tugas: Promise<HasilCari[]>[] = [];

  if (boleh('master.barang.lihat')) {
    tugas.push(
      db
        .select({
          id: barang.id,
          kode: barang.kode,
          nama: barang.namaBarang,
          tersedia: persediaan.stokTersedia,
        })
        .from(barang)
        .leftJoin(persediaan, eq(persediaan.idBarang, barang.id))
        .where(
          and(
            eq(barang.statusAktif, 'AKTIF'),
            or(ilike(barang.namaBarang, pola), ilike(barang.kode, pola), eq(barang.barcode, teks)),
          ),
        )
        .orderBy(barang.namaBarang)
        .limit(BATAS)
        .then((r) =>
          r.map((b) => ({
            jenis: 'BARANG' as const,
            judul: b.nama,
            keterangan: `${b.kode} · tersedia ${Number(b.tersedia ?? 0).toLocaleString('id-ID')}`,
            tautan: boleh('master.barang.kelola') ? `/barang/${b.id}` : null,
          })),
        ),
    );
  }
  if (boleh('master.pelanggan.lihat')) {
    tugas.push(
      db
        .select({ kode: pelanggan.kode, nama: pelanggan.namaPelanggan, noHp: pelanggan.noHp })
        .from(pelanggan)
        .where(
          or(
            ilike(pelanggan.namaPelanggan, pola),
            ilike(pelanggan.kode, pola),
            ilike(pelanggan.noHp, pola),
          ),
        )
        .orderBy(pelanggan.namaPelanggan)
        .limit(BATAS)
        .then((r) =>
          r.map((p) => ({
            jenis: 'PELANGGAN' as const,
            judul: p.nama,
            keterangan: `${p.kode}${p.noHp ? ` · ${p.noHp}` : ''}`,
            tautan: `/pelanggan?cari=${encodeURIComponent(p.nama)}`,
          })),
        ),
    );
  }
  if (boleh('master.pemasok.lihat')) {
    tugas.push(
      db
        .select({ kode: pemasok.kode, nama: pemasok.namaPemasok })
        .from(pemasok)
        .where(or(ilike(pemasok.namaPemasok, pola), ilike(pemasok.kode, pola)))
        .orderBy(pemasok.namaPemasok)
        .limit(BATAS)
        .then((r) =>
          r.map((p) => ({
            jenis: 'PEMASOK' as const,
            judul: p.nama,
            keterangan: p.kode,
            tautan: `/pemasok?cari=${encodeURIComponent(p.nama)}`,
          })),
        ),
    );
  }
  if (adaAngka && boleh('penjualan.riwayat.lihat')) {
    tugas.push(
      db
        .select({ id: penjualan.id, nomor: penjualan.nomor, nama: penjualan.namaPembeli })
        .from(penjualan)
        .where(ilike(penjualan.nomor, pola))
        .orderBy(desc(penjualan.id))
        .limit(BATAS)
        .then((r) =>
          r.map((p) => ({
            jenis: 'PENJUALAN' as const,
            judul: p.nomor,
            keterangan: p.nama ?? 'Penjualan',
            tautan: `/penjualan/${p.id}`,
          })),
        ),
    );
  }
  if (adaAngka && boleh('penjualan.order.buat')) {
    const semua = boleh('penjualan.order.lihat_semua');
    tugas.push(
      db
        .select({
          id: orderPenjualan.id,
          nomor: orderPenjualan.nomor,
          status: orderPenjualan.status,
        })
        .from(orderPenjualan)
        .where(
          and(
            ilike(orderPenjualan.nomor, pola),
            semua ? undefined : eq(orderPenjualan.idPengguna, pelaku.id),
          ),
        )
        .orderBy(desc(orderPenjualan.id))
        .limit(BATAS)
        .then((r) =>
          r.map((o) => ({
            jenis: 'ORDER' as const,
            judul: o.nomor,
            keterangan: `Order · ${o.status.toLowerCase()}`,
            tautan: `/order?id=${o.id}`,
          })),
        ),
    );
  }
  if (adaAngka && boleh('penjualan.surat_jalan.kelola')) {
    tugas.push(
      db
        .select({
          nomor: suratJalan.nomor,
          idPenjualan: suratJalan.idPenjualan,
          status: suratJalan.status,
        })
        .from(suratJalan)
        .where(ilike(suratJalan.nomor, pola))
        .orderBy(desc(suratJalan.id))
        .limit(BATAS)
        .then((r) =>
          r.map((s) => ({
            jenis: 'SURAT_JALAN' as const,
            judul: s.nomor,
            keterangan: `Surat jalan · ${s.status.toLowerCase()}`,
            tautan: `/penjualan/${s.idPenjualan}`,
          })),
        ),
    );
  }
  if (adaAngka && boleh('retur.ajukan')) {
    tugas.push(
      db
        .select({ nomor: returPenjualan.nomor, status: returPenjualan.status })
        .from(returPenjualan)
        .where(ilike(returPenjualan.nomor, pola))
        .orderBy(desc(returPenjualan.id))
        .limit(BATAS)
        .then((r) =>
          r.map((x) => ({
            jenis: 'RETUR' as const,
            judul: x.nomor,
            keterangan: `Retur · ${x.status.toLowerCase()}`,
            tautan: '/retur?tab=riwayat',
          })),
        ),
    );
  }
  if (adaAngka && boleh('void.ajukan')) {
    tugas.push(
      db
        .select({ nomor: voidTransaksi.nomor, status: voidTransaksi.status })
        .from(voidTransaksi)
        .where(ilike(voidTransaksi.nomor, pola))
        .orderBy(desc(voidTransaksi.id))
        .limit(BATAS)
        .then((r) =>
          r.map((x) => ({
            jenis: 'VOID' as const,
            judul: x.nomor,
            keterangan: `Void · ${x.status.toLowerCase()}`,
            tautan: '/void?tab=riwayat',
          })),
        ),
    );
  }
  if (adaAngka && boleh('persediaan.penerimaan.kelola')) {
    tugas.push(
      db
        .select({
          id: penerimaanBarang.id,
          nomor: penerimaanBarang.nomor,
          faktur: penerimaanBarang.noFakturPemasok,
        })
        .from(penerimaanBarang)
        .where(
          or(ilike(penerimaanBarang.nomor, pola), ilike(penerimaanBarang.noFakturPemasok, pola)),
        )
        .orderBy(desc(penerimaanBarang.id))
        .limit(BATAS)
        .then((r) =>
          r.map((x) => ({
            jenis: 'PENERIMAAN' as const,
            judul: x.nomor,
            keterangan: `Penerimaan barang${x.faktur ? ` · faktur ${x.faktur}` : ''}`,
            tautan: `/penerimaan/${x.id}`,
          })),
        ),
    );
  }
  return (await Promise.all(tugas)).flat();
}
