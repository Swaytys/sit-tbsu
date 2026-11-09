import { and, asc, count, eq, gt, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
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
import { kolomPenuh } from '../../../db/kolom-penuh';
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
  stokMaksimum: barang.stokMaksimum,
  stokFisik: persediaan.stokFisik,
  stokRusak: persediaan.stokRusak,
  stokTersedia: sql<string>`coalesce(${persediaan.stokTersedia}, 0)::text`,
  kepemilikan: barang.kepemilikan,
  idPemasokKonsinyasi: barang.idPemasokKonsinyasi,
  namaPemasokKonsinyasi: pemasok.namaPemasok,
  perluTinjauHarga: barang.perluTinjauHarga,
  perluPersetujuanBeli: barang.perluPersetujuanBeli,
  timbangJumlahSampel: barang.timbangJumlahSampel,
  timbangBeratSampelGram: barang.timbangBeratSampelGram,
  /** K-170: berat atau ukuran/volume belum diisi. */
  muatanBelum: sql<boolean>`${syaratMuatanBelum()}`,
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
  hargaFifo: persediaan.hargaFifo,
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
  adaRusak?: boolean | undefined;
  muatanBelum?: boolean | undefined;
  kepemilikan?: Kepemilikan | undefined;
};

/** K-161: barang yang berat atau ukuran/volumenya belum diisi (muatan rit tidak bisa dihitung penuh). */
export function syaratMuatanBelum(): SQL {
  return sql`(${barang.beratKg} is null
    or (not ${barang.curah} and ${barang.panjangCm} is null and ${barang.volumeM3} is null)
    or (${barang.curah} and ${barang.volumeM3} is null))`;
}

/** Paling banyak sekian kata dipakai dari kotak cari (sisanya diabaikan). */
const MAKS_KATA_CARI = 8;

/**
 * Satu kata cari cocok dengan atribut barang (K-108, K-123): nilai teks (mis. warna "putih"), nama jenis atribut
 * (mis. "diameter"), nilai angka (mis. "40" atau "0,5"), kode satuannya (mis. "kg"), atau gabungannya tanpa spasi
 * (mis. "40kg"). `persis = false` (bawaan, K-123): cocok sebagian, mis. "1" menemukan 10 dan 12,5, "c" menemukan
 * cm; `persis = true` dipakai urutan relevansi (cocok utuh di atribut di atas cocok sebagian).
 */
function cocokAtribut(kata: string, persis = false): SQL {
  const pola = polaCari(kata);
  // Pola tanpa "%" di kedua ujung: seluruh nilai harus sama (tetap tidak peka huruf besar/kecil).
  const utuh = pola.slice(1, -1);
  const p = persis ? utuh : pola;
  const angka = /^\d+(?:[.,]\d+)?$/.test(kata) ? kata.replace(',', '.') : null;
  const nilaiAngka = sql`(${kolomPenuh(barangAtribut.nilaiAngka)}::double precision)::text`;
  return sql`exists (select 1 from ${barangAtribut}
    inner join ${jenisAtribut} on ${kolomPenuh(jenisAtribut.id)} = ${kolomPenuh(barangAtribut.idJenisAtribut)}
    left join ${satuan} as satuan_atribut on satuan_atribut.id = ${kolomPenuh(barangAtribut.idSatuan)}
    where ${kolomPenuh(barangAtribut.idBarang)} = ${kolomPenuh(barang.id)} and (
      ${kolomPenuh(barangAtribut.nilaiTeks)} ilike ${p}
      or ${kolomPenuh(jenisAtribut.nama)} ilike ${p}
      or satuan_atribut.kode ilike ${p}
      or ${nilaiAngka} ilike ${p.replace(',', '.')}
      or concat(${nilaiAngka}, satuan_atribut.kode) ilike ${p.replace(',', '.')}
      ${angka === null ? sql`` : sql`or ${kolomPenuh(barangAtribut.nilaiAngka)} = ${angka}::numeric`}
    ))`;
}

/**
 * Kotak cari dipecah per kata; SEMUA kata harus cocok, masing-masing boleh di kolom yang berbeda: kode,
 * nama, barcode, merk, kategori, barcode satuan jual, atau atribut. Jadi "pipa 3 inch putih" menemukan pipa
 * yang atribut ukurannya 3 inch dan warnanya putih, walau kata-kata itu tidak ada di nama barang (K-108).
 */
function cocokCari(cari: string): SQL[] {
  return kataCari(cari).map((kata) => {
    const pola = polaCari(kata);
    return or(
      ilike(barang.kode, pola),
      ilike(barang.namaBarang, pola),
      ilike(barang.barcode, pola),
      ilike(merk.nama, pola),
      ilike(kategori.nama, pola),
      // K-091: barcode satuan jual (pindai barcode dus/roll).
      sql`exists (select 1 from ${barangSatuanJual} where ${kolomPenuh(barangSatuanJual.idBarang)} = ${kolomPenuh(barang.id)}
            and ${kolomPenuh(barangSatuanJual.barcode)} ilike ${pola})`,
      cocokAtribut(kata),
    ) as SQL;
  });
}

/** Kata-kata kotak cari yang dipakai (paling banyak `MAKS_KATA_CARI`). */
function kataCari(cari: string): string[] {
  return cari.split(/\s+/).filter(Boolean).slice(0, MAKS_KATA_CARI);
}

/**
 * Urutan relevansi hasil cari: jumlah kata yang TIDAK ditemukan di nama, kode, atau barcode barang (makin
 * kecil makin atas). Barang yang cocok lewat namanya tampil di atas barang yang hanya cocok lewat kategori,
 * merk, atau atribut; tanpa ini "semen" menaruh semua barang berkategori Semen di atas "Semen Gresik".
 */
function urutanRelevan(cari: string): SQL {
  const bagian = kataCari(cari).map((kata) => {
    const pola = polaCari(kata);
    // K-123: cocok di nama/kode/barcode (0), cocok utuh di atribut (1), selebihnya (cocok sebagian, kategori, merk) (2).
    return sql`case when ${barang.namaBarang} ilike ${pola} or ${barang.kode} ilike ${pola} or ${barang.barcode} ilike ${pola} then 0
      when ${cocokAtribut(kata, true)} then 1 else 2 end`;
  });
  return sql.join(bagian, sql` + `);
}

function syarat(p: SaringBarang): SQL | undefined {
  return and(
    p.status === 'SEMUA' ? undefined : eq(barang.statusAktif, p.status),
    p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
    p.idMerk === undefined ? undefined : eq(barang.idMerk, p.idMerk),
    p.perluTinjau === undefined ? undefined : eq(barang.perluTinjauHarga, p.perluTinjau),
    p.adaRusak ? gt(persediaan.stokRusak, '0') : undefined,
    p.muatanBelum ? syaratMuatanBelum() : undefined,
    p.kepemilikan === undefined ? undefined : eq(barang.kepemilikan, p.kepemilikan),
    ...(p.cari ? cocokCari(p.cari) : []),
  );
}

export async function daftarBarang(
  ex: Executor,
  p: SaringBarang & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasarQuery(ex)
    .where(where)
    .orderBy(
      ...(p.cari && kataCari(p.cari).length > 0 ? [urutanRelevan(p.cari)] : []),
      asc(barang.namaBarang),
      asc(barang.id),
    )
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(barang)
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
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

/** Atribut banyak barang sekaligus (daftar barang / hasil cari kasir), urut seperti di form. */
export function atributBanyak(ex: Executor, idBarang: number[]) {
  return ex
    .select({
      idBarang: barangAtribut.idBarang,
      namaJenis: jenisAtribut.nama,
      nilaiAngka: barangAtribut.nilaiAngka,
      nilaiTeks: barangAtribut.nilaiTeks,
      kodeSatuan: satuan.kode,
    })
    .from(barangAtribut)
    .innerJoin(jenisAtribut, eq(jenisAtribut.id, barangAtribut.idJenisAtribut))
    .leftJoin(satuan, eq(satuan.id, barangAtribut.idSatuan))
    .where(inArray(barangAtribut.idBarang, idBarang))
    .orderBy(asc(barangAtribut.idBarang), asc(barangAtribut.urutan), asc(barangAtribut.id));
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
      stokMaksimum: barang.stokMaksimum,
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
  stokMaksimum: string | null;
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

/** K-161: data muatan per satuan dasar. */
export async function muatanBarang(ex: Executor, id: number) {
  const [b] = await ex
    .select({
      beratKg: barang.beratKg,
      panjangCm: barang.panjangCm,
      lebarCm: barang.lebarCm,
      tinggiCm: barang.tinggiCm,
      curah: barang.curah,
      volumeM3: barang.volumeM3,
    })
    .from(barang)
    .where(eq(barang.id, id))
    .limit(1);
  return b;
}

export async function ubahMuatan(
  tx: Tx,
  id: number,
  m: {
    beratKg: string | null;
    panjangCm: string | null;
    lebarCm: string | null;
    tinggiCm: string | null;
    curah: boolean;
    volumeM3: string | null;
  },
  waktu: Date,
) {
  await tx
    .update(barang)
    .set({ ...m, diubahPada: waktu })
    .where(eq(barang.id, id));
}
