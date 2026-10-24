import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { SasaranPromo, StatusAktif, StatusBerlakuPromo } from '@sit/shared';
import type { Executor, Tx } from '../../db/client';
import {
  barang,
  golonganPelanggan,
  kategori,
  merk,
  pelanggan,
  penjualan,
  penjualanDetail,
  promo,
  promoPelanggan,
  promoSasaran,
} from '../../db/schema';
import { kolomPenuh } from '../../db/kolom-penuh';
import { polaCari } from '../../lib/paginasi';
import { tanggalOperasional } from '../../lib/waktu';
import type { KandidatPromo } from './hitung';

const kolomKandidat = {
  id: promo.id,
  kode: promo.kode,
  nama: promo.nama,
  mulaiPada: promo.mulaiPada,
  selesaiPada: promo.selesaiPada,
  hariBerlaku: promo.hariBerlaku,
  jamMulai: promo.jamMulai,
  jamSelesai: promo.jamSelesai,
  statusAktif: promo.statusAktif,
  jenisPotongan: promo.jenisPotongan,
  potonganPersen: promo.potonganPersen,
  potonganNominal: promo.potonganNominal,
  maksPotongan: promo.maksPotongan,
  hargaKhusus: promo.hargaKhusus,
  beliQty: promo.beliQty,
  gratisQty: promo.gratisQty,
  sasaran: promo.sasaran,
  minQty: promo.minQty,
  minBelanja: promo.minBelanja,
};

/** Id sasaran per promo (urut), untuk kandidat dan form. */
export async function idSasaranPromo(
  ex: Executor,
  idPromo: number[],
): Promise<Map<number, number[]>> {
  const hasil = new Map<number, number[]>();
  if (idPromo.length === 0) return hasil;
  const baris = await ex
    .select({
      idPromo: promoSasaran.idPromo,
      id: sql<number>`coalesce(${promoSasaran.idBarang}, ${promoSasaran.idKategori}, ${promoSasaran.idMerk})`.mapWith(
        Number,
      ),
    })
    .from(promoSasaran)
    .where(inArray(promoSasaran.idPromo, idPromo));
  for (const b of baris) hasil.set(b.idPromo, [...(hasil.get(b.idPromo) ?? []), b.id]);
  for (const d of hasil.values()) d.sort((a, b) => a - b);
  return hasil;
}

/**
 * K-110: jumlah potongan promo yang sudah diberikan = Σ `diskon_promo` baris penjualan yang memakai promo itu,
 * kecuali baris VOID dan penjualan VOID (void mengembalikan anggaran; retur tidak).
 */
const terpakai = sql<number>`(
  select coalesce(sum(${kolomPenuh(penjualanDetail.diskonPromo)}), 0)::bigint
    from ${penjualanDetail}
    inner join ${penjualan} on ${kolomPenuh(penjualan.id)} = ${kolomPenuh(penjualanDetail.idPenjualan)}
   where ${kolomPenuh(penjualanDetail.idPromo)} = ${kolomPenuh(promo.id)}
     and ${kolomPenuh(penjualanDetail.statusItem)} <> 'VOID'
     and ${kolomPenuh(penjualan.statusTransaksi)} <> 'VOID'
)`.mapWith(Number);

/** Sama dengan `terpakai`, hanya transaksi satu pelanggan terdata. */
function terpakaiPelanggan(idPelanggan: number) {
  return sql<number>`(
  select coalesce(sum(${kolomPenuh(penjualanDetail.diskonPromo)}), 0)::bigint
    from ${penjualanDetail}
    inner join ${penjualan} on ${kolomPenuh(penjualan.id)} = ${kolomPenuh(penjualanDetail.idPenjualan)}
   where ${kolomPenuh(penjualanDetail.idPromo)} = ${kolomPenuh(promo.id)}
     and ${kolomPenuh(penjualanDetail.statusItem)} <> 'VOID'
     and ${kolomPenuh(penjualan.statusTransaksi)} <> 'VOID'
     and ${kolomPenuh(penjualan.idPelanggan)} = ${idPelanggan}
)`.mapWith(Number);
}

/** Pembeli transaksi untuk syarat promo (K-097); pembeli umum = semua `null`. */
export type PembeliPromo = { idPelanggan: number | null; idGolongan: number | null };

/**
 * K-097: belanja neto pelanggan (setelah void dan retur, tanpa transaksi VOID) dalam `hari_belanja` hari
 * terakhir sampai `tanggal`, dibandingkan dengan syarat promo.
 */
function syaratBelanjaPelanggan(saat: Date, idPelanggan: number | null): SQL {
  const tanggal = tanggalOperasional(saat);
  if (idPelanggan === null) return isNull(promo.minBelanjaPelanggan);
  const belanja = sql`(
    select coalesce(sum(${kolomPenuh(penjualan.totalNeto)} - ${kolomPenuh(penjualan.totalVoid)} - ${kolomPenuh(penjualan.totalRetur)}), 0)
      from ${penjualan}
     where ${kolomPenuh(penjualan.idPelanggan)} = ${idPelanggan}
       and ${kolomPenuh(penjualan.statusTransaksi)} <> 'VOID'
       and ${kolomPenuh(penjualan.tanggalOperasional)} > ${tanggal}::date - ${kolomPenuh(promo.hariBelanja)}
       and ${kolomPenuh(penjualan.tanggalOperasional)} <= ${tanggal}::date
  )`;
  return or(isNull(promo.minBelanjaPelanggan), sql`${belanja} >= ${promo.minBelanjaPelanggan}`)!;
}

/** Promo bukan templat yang waktunya mencakup `saat` (hari/jam harian dinilai `promoBerlaku`). */
function dalamWaktu(saat: Date): SQL {
  return and(
    eq(promo.statusAktif, 'AKTIF'),
    eq(promo.templat, false),
    lte(promo.mulaiPada, saat),
    gte(promo.selesaiPada, saat),
  )!;
}

/**
 * PR1–PR2 + K-097 + K-163: promo AKTIF yang berlaku pada `saat`, sasarannya bisa mengenai barang/kategori/merk
 * ini, dan pembelinya berhak (semua pembeli, golongan pelanggan, atau pelanggan tertentu; syarat belanja).
 */
export async function kandidatPromo(
  ex: Executor,
  saat: Date,
  idBarang: number[],
  idKategori: number[],
  idMerk: number[],
  pembeli: PembeliPromo,
): Promise<KandidatPromo[]> {
  if (idBarang.length === 0) return [];
  const baris = await ex
    .select({
      ...kolomKandidat,
      anggaran: promo.anggaran,
      maksPerPembeli: promo.maksPerPembeli,
      terpakai,
      // Pembeli umum tidak punya riwayat: batas per pembeli berlaku per transaksi.
      terpakaiPembeli:
        pembeli.idPelanggan === null ? sql<number>`0` : terpakaiPelanggan(pembeli.idPelanggan),
    })
    .from(promo)
    .where(
      and(
        dalamWaktu(saat),
        or(
          eq(promo.sasaran, 'SEMUA'),
          sql`exists (select 1 from ${promoSasaran}
            where ${kolomPenuh(promoSasaran.idPromo)} = ${kolomPenuh(promo.id)}
              and (${or(
                inArray(promoSasaran.idBarang, idBarang),
                idKategori.length > 0 ? inArray(promoSasaran.idKategori, idKategori) : undefined,
                idMerk.length > 0 ? inArray(promoSasaran.idMerk, idMerk) : undefined,
              )}))`,
        ),
        or(
          eq(promo.sasaranPembeli, 'SEMUA'),
          pembeli.idGolongan === null
            ? undefined
            : and(eq(promo.sasaranPembeli, 'GOLONGAN'), eq(promo.idGolongan, pembeli.idGolongan)),
          pembeli.idPelanggan === null
            ? undefined
            : and(
                eq(promo.sasaranPembeli, 'PELANGGAN'),
                sql`exists (select 1 from ${promoPelanggan}
                  where ${kolomPenuh(promoPelanggan.idPromo)} = ${kolomPenuh(promo.id)}
                    and ${kolomPenuh(promoPelanggan.idPelanggan)} = ${pembeli.idPelanggan})`,
              ),
        ),
        syaratBelanjaPelanggan(saat, pembeli.idPelanggan),
      ),
    );
  const sasaran = await idSasaranPromo(
    ex,
    baris.map((b) => b.id),
  );
  return baris.map(({ anggaran, maksPerPembeli, terpakai: t, terpakaiPembeli: tp, ...k }) => {
    const batas = [
      ...(anggaran === null ? [] : [anggaran - t]),
      ...(maksPerPembeli === null ? [] : [maksPerPembeli - tp]),
    ];
    return {
      ...k,
      idSasaran: sasaran.get(k.id) ?? [],
      sisaPotongan: batas.length === 0 ? null : Math.max(0, Math.min(...batas)),
    };
  });
}

/**
 * K-110: mengunci promo berbatas yang berlaku pada `saat` (urut id) sebelum sisa anggarannya dibaca saat
 * checkout, supaya dua checkout bersamaan tidak sama-sama memakai sisa yang sama.
 */
export async function kunciPromoBerbatas(tx: Tx, saat: Date): Promise<void> {
  await tx
    .select({ id: promo.id })
    .from(promo)
    .where(and(dalamWaktu(saat), or(isNotNull(promo.anggaran), isNotNull(promo.maksPerPembeli))))
    .orderBy(asc(promo.id))
    .for('update');
}

/** Jumlah potongan promo yang sudah diberikan (K-110). */
export async function totalDiskonPromo(ex: Executor, id: number): Promise<number> {
  const [b] = await ex.select({ total: terpakai }).from(promo).where(eq(promo.id, id));
  return b?.total ?? 0;
}

// --- Master promo ---

const pemakaian = sql<number>`(
  select count(*)::int from ${penjualanDetail} where ${kolomPenuh(penjualanDetail.idPromo)} = ${kolomPenuh(promo.id)}
)`;

/** Kolom sasaran pembeli (K-097). */
const kolomPembeli = {
  sasaranPembeli: promo.sasaranPembeli,
  idGolongan: promo.idGolongan,
  minBelanjaPelanggan: promo.minBelanjaPelanggan,
  hariBelanja: promo.hariBelanja,
};

const kolom = {
  ...kolomKandidat,
  ...kolomPembeli,
  tanggalMulai: promo.tanggalMulai,
  tanggalSelesai: promo.tanggalSelesai,
  templat: promo.templat,
  namaGolongan: golonganPelanggan.nama,
  keterangan: promo.keterangan,
  jumlahPemakaian: pemakaian,
  anggaran: promo.anggaran,
  maksPerPembeli: promo.maksPerPembeli,
  totalDiskon: terpakai,
};

function dasar(ex: Executor) {
  return ex
    .select(kolom)
    .from(promo)
    .leftJoin(golonganPelanggan, eq(golonganPelanggan.id, promo.idGolongan));
}

/** K-163: barang/kategori/merk sasaran per promo dengan nama (untuk tampilan). */
export async function sasaranPromo(ex: Executor, idPromo: number[]) {
  if (idPromo.length === 0) return [];
  return ex
    .select({
      idPromo: promoSasaran.idPromo,
      id: sql<number>`coalesce(${promoSasaran.idBarang}, ${promoSasaran.idKategori}, ${promoSasaran.idMerk})`.mapWith(
        Number,
      ),
      kode: barang.kode,
      nama: sql<string>`coalesce(${barang.namaBarang}, ${kategori.nama}, ${merk.nama})`,
    })
    .from(promoSasaran)
    .leftJoin(barang, eq(barang.id, promoSasaran.idBarang))
    .leftJoin(kategori, eq(kategori.id, promoSasaran.idKategori))
    .leftJoin(merk, eq(merk.id, promoSasaran.idMerk))
    .where(inArray(promoSasaran.idPromo, idPromo))
    .orderBy(sql`2`);
}

/** Sasaran diganti seluruhnya (tabel penghubung master; hanya sebelum promo terpakai, K-087). */
export async function gantiSasaranPromo(
  tx: Tx,
  idPromo: number,
  sasaran: SasaranPromo,
  id: number[],
): Promise<void> {
  await tx.delete(promoSasaran).where(eq(promoSasaran.idPromo, idPromo));
  if (sasaran === 'SEMUA' || id.length === 0) return;
  await tx.insert(promoSasaran).values(
    id.map((x) => ({
      idPromo,
      idBarang: sasaran === 'BARANG' ? x : null,
      idKategori: sasaran === 'KATEGORI' ? x : null,
      idMerk: sasaran === 'MERK' ? x : null,
    })),
  );
}

/** Pelanggan yang berhak atas promo (sasaran PELANGGAN), per promo. */
export async function pelangganPromo(ex: Executor, idPromo: number[]) {
  if (idPromo.length === 0) return [];
  return ex
    .select({
      idPromo: promoPelanggan.idPromo,
      id: pelanggan.id,
      nama: pelanggan.namaPelanggan,
    })
    .from(promoPelanggan)
    .innerJoin(pelanggan, eq(pelanggan.id, promoPelanggan.idPelanggan))
    .where(inArray(promoPelanggan.idPromo, idPromo))
    .orderBy(asc(pelanggan.namaPelanggan));
}

/** Daftar pelanggan berhak diganti seluruhnya (tabel penghubung master, bukan transaksi). */
export async function gantiPelangganPromo(
  tx: Tx,
  idPromo: number,
  idPelanggan: number[],
): Promise<void> {
  await tx.delete(promoPelanggan).where(eq(promoPelanggan.idPromo, idPromo));
  if (idPelanggan.length > 0) {
    await tx.insert(promoPelanggan).values(idPelanggan.map((id) => ({ idPromo, idPelanggan: id })));
  }
}

/** Golongan dan pelanggan sasaran harus ada dan AKTIF. */
export async function statusPembeli(
  ex: Executor,
  p: { idGolongan: number | null; idPelanggan: number[] },
) {
  const [g] =
    p.idGolongan === null
      ? [undefined]
      : await ex
          .select({ status: golonganPelanggan.statusAktif })
          .from(golonganPelanggan)
          .where(eq(golonganPelanggan.id, p.idGolongan));
  const aktif =
    p.idPelanggan.length === 0
      ? []
      : await ex
          .select({ id: pelanggan.id })
          .from(pelanggan)
          .where(and(inArray(pelanggan.id, p.idPelanggan), eq(pelanggan.statusAktif, 'AKTIF')));
  return { golongan: g, pelangganAktif: new Set(aktif.map((x) => x.id)) };
}

export type SaringPromo = {
  cari?: string | undefined;
  status: StatusAktif | 'SEMUA';
  berlaku?: StatusBerlakuPromo | undefined;
  /** K-163: daftar templat kampanye, bukan promo. */
  templat?: boolean;
  /** Tanggal operasional hari ini (untuk saringan berlaku). */
  hariIni: string;
};

function syarat(p: SaringPromo): SQL | undefined {
  const pola = p.cari ? polaCari(p.cari) : undefined;
  return and(
    eq(promo.templat, p.templat === true),
    p.status === 'SEMUA' ? undefined : eq(promo.statusAktif, p.status),
    p.berlaku === 'TERJADWAL' ? gt(promo.tanggalMulai, p.hariIni) : undefined,
    p.berlaku === 'BERJALAN'
      ? and(lte(promo.tanggalMulai, p.hariIni), gte(promo.tanggalSelesai, p.hariIni))
      : undefined,
    p.berlaku === 'BERAKHIR' ? lt(promo.tanggalSelesai, p.hariIni) : undefined,
    pola ? or(ilike(promo.kode, pola), ilike(promo.nama, pola)) : undefined,
  );
}

export async function daftarPromo(
  ex: Executor,
  p: SaringPromo & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await dasar(ex)
    .where(where)
    .orderBy(desc(promo.tanggalMulai), desc(promo.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(promo).where(where);
  return { baris, total: hitung?.total ?? 0 };
}

export async function promoById(ex: Executor, id: number) {
  const [b] = await dasar(ex).where(eq(promo.id, id)).limit(1);
  return b;
}

export async function kunciPromo(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      ...kolomKandidat,
      ...kolomPembeli,
      tanggalMulai: promo.tanggalMulai,
      tanggalSelesai: promo.tanggalSelesai,
      templat: promo.templat,
      keterangan: promo.keterangan,
      anggaran: promo.anggaran,
      maksPerPembeli: promo.maksPerPembeli,
    })
    .from(promo)
    .where(eq(promo.id, id))
    .limit(1)
    .for('update');
  return b;
}

export async function jumlahPemakaian(ex: Executor, id: number): Promise<number> {
  const [b] = await ex
    .select({ n: count() })
    .from(penjualanDetail)
    .where(eq(penjualanDetail.idPromo, id));
  return b?.n ?? 0;
}

export type NilaiPromo = Omit<
  typeof promo.$inferInsert,
  'id' | 'kode' | 'dibuatPada' | 'diubahPada'
>;

export async function tambahPromo(tx: Tx, nilai: NilaiPromo & { kode: string }): Promise<number> {
  const [b] = await tx.insert(promo).values(nilai).returning({ id: promo.id });
  if (!b) throw new Error('insert promo tidak mengembalikan id');
  return b.id;
}

export async function ubahPromo(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiPromo>,
  waktu: Date,
): Promise<void> {
  await tx
    .update(promo)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(promo.id, id));
}

/** K-163: id sasaran yang ada dan AKTIF untuk jenis `sasaran`. */
export async function sasaranAktif(
  ex: Executor,
  sasaran: SasaranPromo,
  id: number[],
): Promise<Set<number>> {
  if (sasaran === 'SEMUA' || id.length === 0) return new Set();
  const tabel = sasaran === 'BARANG' ? barang : sasaran === 'KATEGORI' ? kategori : merk;
  const baris = await ex
    .select({ id: tabel.id })
    .from(tabel)
    .where(and(inArray(tabel.id, id), eq(tabel.statusAktif, 'AKTIF')));
  return new Set(baris.map((b) => b.id));
}
