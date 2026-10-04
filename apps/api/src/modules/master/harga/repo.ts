import { and, asc, count, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { MetodeHarga } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  hargaBarang,
  kategori,
  persediaan,
  satuan,
  tingkatHarga,
} from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

/** Data untuk menghitung dasar markup `D` (docs/06 H3) per barang. */
export const kolomDasar = {
  id: barang.id,
  namaBarang: barang.namaBarang,
  kepemilikan: barang.kepemilikan,
  hargaModalAwal: barang.hargaModalAwal,
  hargaTitip: barang.hargaTitip,
  hppRata2: persediaan.hppRata2,
  hargaBeliTerakhir: persediaan.hargaBeliTerakhir,
  tanggalBeliTerakhir: persediaan.tanggalBeliTerakhir,
};

export async function dataDasar(ex: Executor, idBarang: number[]) {
  if (idBarang.length === 0) return [];
  return ex
    .select(kolomDasar)
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .where(inArray(barang.id, idBarang));
}

export function semuaDataDasar(ex: Executor) {
  return ex
    .select(kolomDasar)
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id));
}

export function semuaTier(ex: Executor) {
  return ex
    .select({
      id: tingkatHarga.id,
      nama: tingkatHarga.nama,
      markupDefaultPersen: tingkatHarga.markupDefaultPersen,
      isDefault: tingkatHarga.isDefault,
      statusAktif: tingkatHarga.statusAktif,
      urutan: tingkatHarga.urutan,
    })
    .from(tingkatHarga)
    .orderBy(asc(tingkatHarga.urutan), asc(tingkatHarga.id));
}

const kolomHarga = {
  id: hargaBarang.id,
  idBarang: hargaBarang.idBarang,
  idTingkatHarga: hargaBarang.idTingkatHarga,
  metode: hargaBarang.metode,
  markupPersen: hargaBarang.markupPersen,
  hargaTetap: hargaBarang.hargaTetap,
  hargaJual: hargaBarang.hargaJual,
  dasarMarkupSaatHitung: hargaBarang.dasarMarkupSaatHitung,
};
export type BarisHarga = {
  id: number;
  idBarang: number;
  idTingkatHarga: number;
  metode: MetodeHarga;
  markupPersen: string | null;
  hargaTetap: number | null;
  hargaJual: number;
  dasarMarkupSaatHitung: number | null;
};

/** Harga per satuan dasar (satuan jual null) untuk sekumpulan barang. */
export async function hargaBarangDasar(ex: Executor, idBarang: number[]): Promise<BarisHarga[]> {
  if (idBarang.length === 0) return [];
  return ex
    .select(kolomHarga)
    .from(hargaBarang)
    .where(and(inArray(hargaBarang.idBarang, idBarang), isNull(hargaBarang.idSatuanJual)));
}

/** Mengunci baris harga barang selama transaksi (simpan harga serentak tidak saling menimpa). */
export async function kunciHargaBarang(tx: Tx, idBarang: number): Promise<BarisHarga[]> {
  return tx
    .select(kolomHarga)
    .from(hargaBarang)
    .where(and(eq(hargaBarang.idBarang, idBarang), isNull(hargaBarang.idSatuanJual)))
    .for('update');
}

/**
 * Mengunci baris barang berurutan id. Urutan kunci baku untuk semua penulis harga (K-086):
 * barang → persediaan → harga_barang, masing-masing berurutan id, agar tidak saling mengunci (deadlock).
 */
export async function kunciBarangHarga(tx: Tx, idBarang: number[]) {
  if (idBarang.length === 0) return [];
  return tx
    .select({
      id: barang.id,
      namaBarang: barang.namaBarang,
      hargaOtomatis: barang.hargaOtomatis,
      perluTinjauHarga: barang.perluTinjauHarga,
      statusAktif: barang.statusAktif,
    })
    .from(barang)
    .where(inArray(barang.id, idBarang))
    .orderBy(asc(barang.id))
    .for('update');
}

export type NilaiHarga = {
  metode: MetodeHarga;
  markupPersen: string | null;
  hargaTetap: number | null;
  hargaJual: number;
  dasarMarkupSaatHitung: number | null;
};

export async function tambahHarga(
  tx: Tx,
  baris: (NilaiHarga & { idBarang: number; idTingkatHarga: number; idPengguna: number | null })[],
): Promise<void> {
  // Per 1000 baris agar tidak melewati batas parameter PostgreSQL. Baris yang sudah ada (mis. tier
  // diaktifkan kembali) dibiarkan (uq_harga_barang).
  for (let i = 0; i < baris.length; i += 1000) {
    await tx
      .insert(hargaBarang)
      .values(baris.slice(i, i + 1000))
      .onConflictDoNothing();
  }
}

export async function ubahHarga(
  tx: Tx,
  id: number,
  nilai: NilaiHarga & { idPengguna: number },
  waktu: Date,
): Promise<void> {
  await tx
    .update(hargaBarang)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(hargaBarang.id, id));
}

export type HitungUlangHarga = {
  id: number;
  hargaJual: number;
  /** Diisi hanya untuk baris TETAP (usulan tier default diterapkan); baris IKUT_TIER/MARKUP: null. */
  hargaTetap: number | null;
  dasarMarkupSaatHitung: number | null;
};

/**
 * Menulis hasil hitung ulang banyak baris sekaligus (H6/H7), per 500 baris. Metode dan markup tidak
 * berubah; hanya harga jual, harga tetap (baris TETAP), dan dasar saat hitung.
 */
export async function hitungUlangHargaBanyak(
  tx: Tx,
  baris: HitungUlangHarga[],
  idPengguna: number | null,
  waktu: Date,
): Promise<void> {
  for (let i = 0; i < baris.length; i += 500) {
    const nilai = sql.join(
      baris
        .slice(i, i + 500)
        .map(
          (b) =>
            sql`(${b.id}::bigint, ${b.hargaJual}::bigint, ${b.hargaTetap}::bigint, ${b.dasarMarkupSaatHitung}::bigint)`,
        ),
      sql`, `,
    );
    await tx.execute(sql`
      update ${hargaBarang}
         set harga_jual = v.harga_jual,
             harga_tetap = case when ${hargaBarang.metode} = 'TETAP' then v.harga_tetap else null end,
             dasar_markup_saat_hitung = v.dasar,
             id_pengguna = ${idPengguna},
             diubah_pada = ${waktu}
        from (values ${nilai}) as v(id, harga_jual, harga_tetap, dasar)
       where ${hargaBarang.id} = v.id`);
  }
}

/** Barang yang punya baris IKUT_TIER pada tier ini (markup default tier berubah, H5). */
export async function barangIkutTier(ex: Executor, idTingkatHarga: number): Promise<number[]> {
  const baris = await ex
    .select({ id: hargaBarang.idBarang })
    .from(hargaBarang)
    .where(
      and(
        eq(hargaBarang.idTingkatHarga, idTingkatHarga),
        eq(hargaBarang.metode, 'IKUT_TIER'),
        isNull(hargaBarang.idSatuanJual),
      ),
    );
  return baris.map((b) => b.id);
}

/** Barang yang punya baris IKUT_TIER/MARKUP (harga dihitung dari markup), opsional di satu tier saja. */
export async function barangBerformula(ex: Executor, idTingkatHarga?: number): Promise<number[]> {
  const baris = await ex
    .selectDistinct({ id: hargaBarang.idBarang })
    .from(hargaBarang)
    .where(
      and(
        ne(hargaBarang.metode, 'TETAP'),
        isNull(hargaBarang.idSatuanJual),
        idTingkatHarga === undefined ? undefined : eq(hargaBarang.idTingkatHarga, idTingkatHarga),
      ),
    );
  return baris.map((b) => b.id);
}

export async function aturTandaTinjau(tx: Tx, idBarang: number[], nilai: boolean): Promise<void> {
  for (let i = 0; i < idBarang.length; i += 1000) {
    await tx
      .update(barang)
      .set({ perluTinjauHarga: nilai })
      .where(
        and(
          inArray(barang.id, idBarang.slice(i, i + 1000)),
          sql`${barang.perluTinjauHarga} <> ${nilai}`,
        ),
      );
  }
}

// --- Tinjau Harga (H6) ---

export type SaringTinjau = { cari?: string | undefined; idKategori?: number | undefined };

function syaratTinjau(p: SaringTinjau) {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    eq(barang.perluTinjauHarga, true),
    eq(barang.statusAktif, 'AKTIF'),
    p.idKategori === undefined ? undefined : eq(barang.idKategori, p.idKategori),
    pola
      ? or(ilike(barang.kode, pola), ilike(barang.namaBarang, pola), ilike(barang.barcode, pola))
      : undefined,
  );
}

/** Barang aktif bertanda perlu tinjau, beserta data dasar markupnya. */
export async function daftarPerluTinjau(
  ex: Executor,
  p: SaringTinjau & { limit: number; offset: number },
) {
  const where = syaratTinjau(p);
  const baris = await ex
    .select({
      ...kolomDasar,
      kode: barang.kode,
      namaKategori: kategori.nama,
      kodeSatuan: satuan.kode,
      hargaOtomatis: barang.hargaOtomatis,
    })
    .from(barang)
    .innerJoin(persediaan, eq(persediaan.idBarang, barang.id))
    .innerJoin(kategori, eq(kategori.id, barang.idKategori))
    .innerJoin(satuan, eq(satuan.id, barang.idSatuanDasar))
    .where(where)
    .orderBy(asc(barang.namaBarang), asc(barang.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(barang).where(where);
  return { baris, total: hitung?.total ?? 0 };
}
