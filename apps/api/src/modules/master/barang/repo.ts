import { and, asc, count, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Kepemilikan, StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  barangAtribut,
  barangSatuanJual,
  jenisAtribut,
  kategori,
  merk,
  pemasok,
  persediaan,
  satuan,
} from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

const kolom = {
  id: barang.id,
  kode: barang.kode,
  barcode: barang.barcode,
  namaBarang: barang.namaBarang,
  idKategori: barang.idKategori,
  namaKategori: kategori.nama,
  idMerk: barang.idMerk,
  namaMerk: merk.nama,
  idSatuanDasar: barang.idSatuanDasar,
  kodeSatuan: satuan.kode,
  stokMinimum: barang.stokMinimum,
  stokFisik: persediaan.stokFisik,
  stokTersedia: sql<string>`coalesce(${persediaan.stokTersedia}, 0)::text`,
  kepemilikan: barang.kepemilikan,
  idPemasokKonsinyasi: barang.idPemasokKonsinyasi,
  namaPemasokKonsinyasi: pemasok.namaPemasok,
  perluTinjauHarga: barang.perluTinjauHarga,
  hargaOtomatis: barang.hargaOtomatis,
  gambar: barang.gambar,
  keterangan: barang.keterangan,
  statusAktif: barang.statusAktif,
  hargaModalAwal: barang.hargaModalAwal,
  hargaTitip: barang.hargaTitip,
  hppRata2: persediaan.hppRata2,
  hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
  tanggalBeliTerakhir: persediaan.tanggalBeliTerakhir,
  terakhirMutasi: persediaan.terakhirMutasi,
};

function dasarQuery(ex: Executor) {
  return ex
    .select(kolom)
    .from(barang)
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .leftJoin(pemasok, eq(pemasok.id, barang.idPemasokKonsinyasi))
    .leftJoin(merk, eq(merk.id, barang.idMerk));
}

export type SaringBarang = {
  cari?: string | undefined;
  idKategori?: number | undefined;
  idMerk?: number | undefined;
  status: StatusAktif | 'SEMUA';
  perluTinjau?: boolean | undefined;
};

function syarat(p: SaringBarang): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    p.status === 'SEMUA' ? undefined : eq(barang.statusAktif, p.status),
    p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
    p.idMerk === undefined ? undefined : eq(barang.idMerk, p.idMerk),
    p.perluTinjau === undefined ? undefined : eq(barang.perluTinjauHarga, p.perluTinjau),
    pola
      ? or(
          ilike(barang.kode, pola),
          ilike(barang.namaBarang, pola),
          ilike(barang.barcode, pola),
          ilike(merk.nama, pola),
        )
      : undefined,
  );
}

export async function daftarBarang(
  ex: Executor,
  p: SaringBarang & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasarQuery(ex)
    .where(where)
    .orderBy(asc(barang.namaBarang), asc(barang.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(barang)
    .leftJoin(merk, eq(merk.id, barang.idMerk))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function barangById(ex: Executor, id: number) {
  const [baris] = await dasarQuery(ex).where(eq(barang.id, id)).limit(1);
  return baris;
}

export function atributBarang(ex: Executor, idBarang: number) {
  return ex
    .select({
      idJenisAtribut: barangAtribut.idJenisAtribut,
      kodeJenis: jenisAtribut.kode,
      namaJenis: jenisAtribut.nama,
      tipeNilai: jenisAtribut.tipeNilai,
      nilaiAngka: barangAtribut.nilaiAngka,
      nilaiTeks: barangAtribut.nilaiTeks,
      idSatuan: barangAtribut.idSatuan,
      kodeSatuan: satuan.kode,
    })
    .from(barangAtribut)
    .innerJoin(jenisAtribut, eq(jenisAtribut.id, barangAtribut.idJenisAtribut))
    .leftJoin(satuan, eq(satuan.id, barangAtribut.idSatuan))
    .where(eq(barangAtribut.idBarang, idBarang))
    .orderBy(asc(barangAtribut.urutan), asc(barangAtribut.id));
}

export async function kunciBarang(tx: Tx, id: number) {
  const [baris] = await tx
    .select({
      kode: barang.kode,
      barcode: barang.barcode,
      namaBarang: barang.namaBarang,
      idKategori: barang.idKategori,
      idMerk: barang.idMerk,
      idSatuanDasar: barang.idSatuanDasar,
      stokMinimum: barang.stokMinimum,
      hargaModalAwal: barang.hargaModalAwal,
      kepemilikan: barang.kepemilikan,
      idPemasokKonsinyasi: barang.idPemasokKonsinyasi,
      hargaTitip: barang.hargaTitip,
      hargaOtomatis: barang.hargaOtomatis,
      perluTinjauHarga: barang.perluTinjauHarga,
      gambar: barang.gambar,
      keterangan: barang.keterangan,
      statusAktif: barang.statusAktif,
    })
    .from(barang)
    .where(eq(barang.id, id))
    .limit(1)
    .for('update');
  return baris;
}

export async function kodeDipakai(ex: Executor, kode: string, kecualiId?: number) {
  const [baris] = await ex
    .select({ id: barang.id })
    .from(barang)
    .where(
      and(eq(barang.kode, kode), kecualiId === undefined ? undefined : ne(barang.id, kecualiId)),
    )
    .limit(1);
  return baris !== undefined;
}

/** Barcode unik di barang dan satuan jual (M2) sekaligus. */
export async function barcodeDipakai(ex: Executor, barcode: string, kecualiId?: number) {
  const [diBarang] = await ex
    .select({ id: barang.id })
    .from(barang)
    .where(
      and(
        eq(barang.barcode, barcode),
        kecualiId === undefined ? undefined : ne(barang.id, kecualiId),
      ),
    )
    .limit(1);
  if (diBarang) return true;
  const [diSatuanJual] = await ex
    .select({ id: barangSatuanJual.id })
    .from(barangSatuanJual)
    .where(eq(barangSatuanJual.barcode, barcode))
    .limit(1);
  return diSatuanJual !== undefined;
}

export async function statusReferensi(
  ex: Executor,
  p: { idKategori: number; idSatuan: number; idPemasok: number | null; idMerk: number | null },
) {
  const [kat] = await ex
    .select({ status: kategori.statusAktif })
    .from(kategori)
    .where(eq(kategori.id, p.idKategori));
  const [sat] = await ex
    .select({ status: satuan.statusAktif })
    .from(satuan)
    .where(eq(satuan.id, p.idSatuan));
  const [pms] =
    p.idPemasok === null
      ? [undefined]
      : await ex
          .select({ status: pemasok.statusAktif })
          .from(pemasok)
          .where(eq(pemasok.id, p.idPemasok));
  const [mrk] =
    p.idMerk === null
      ? [undefined]
      : await ex.select({ status: merk.statusAktif }).from(merk).where(eq(merk.id, p.idMerk));
  return { kategori: kat?.status, satuan: sat?.status, pemasok: pms?.status, merk: mrk?.status };
}

export async function jenisAtributDanSatuan(ex: Executor, idJenis: number[], idSatuan: number[]) {
  const jenis =
    idJenis.length === 0
      ? []
      : await ex
          .select({
            id: jenisAtribut.id,
            nama: jenisAtribut.nama,
            tipeNilai: jenisAtribut.tipeNilai,
            jenisDimensi: jenisAtribut.jenisDimensi,
            statusAktif: jenisAtribut.statusAktif,
          })
          .from(jenisAtribut)
          .where(inArray(jenisAtribut.id, idJenis));
  const daftarSatuan =
    idSatuan.length === 0
      ? []
      : await ex
          .select({
            id: satuan.id,
            kode: satuan.kode,
            jenisDimensi: satuan.jenisDimensi,
            statusAktif: satuan.statusAktif,
          })
          .from(satuan)
          .where(inArray(satuan.id, idSatuan));
  return { jenis, satuan: daftarSatuan };
}

export type NilaiBarang = {
  kode: string;
  barcode: string | null;
  namaBarang: string;
  idKategori: number;
  idMerk: number | null;
  idSatuanDasar: number;
  stokMinimum: string;
  hargaModalAwal: number;
  kepemilikan: Kepemilikan;
  idPemasokKonsinyasi: number | null;
  hargaTitip: number | null;
  keterangan: string | null;
  hargaOtomatis: boolean;
};

export async function tambahBarang(tx: Tx, nilai: NilaiBarang): Promise<number> {
  const [baris] = await tx.insert(barang).values(nilai).returning({ id: barang.id });
  if (!baris) throw new Error('insert barang tidak mengembalikan id');
  return baris.id;
}

export async function ubahBarang(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiBarang> & {
    statusAktif?: StatusAktif;
    perluTinjauHarga?: boolean;
    gambar?: string | null;
  },
  waktu: Date,
): Promise<void> {
  await tx
    .update(barang)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(barang.id, id));
}

export type NilaiAtribut = {
  idJenisAtribut: number;
  nilaiAngka: string | null;
  nilaiTeks: string | null;
  idSatuan: number | null;
  urutan: number;
};

/** Atribut adalah rincian barang: disimpan ulang seluruhnya mengikuti isi form. */
export async function gantiAtribut(tx: Tx, idBarang: number, atribut: NilaiAtribut[]) {
  await tx.delete(barangAtribut).where(eq(barangAtribut.idBarang, idBarang));
  if (atribut.length > 0) {
    await tx.insert(barangAtribut).values(atribut.map((a) => ({ ...a, idBarang })));
  }
}
