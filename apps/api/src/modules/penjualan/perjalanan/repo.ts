import { and, count, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { kolomPenuh } from '../../../db/kolom-penuh';
import type { StatusPerjalanan } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import {
  barang,
  kendaraan,
  pelanggan,
  pengguna,
  penjualan,
  perjalanan,
  sopir,
  penjualanDetail,
  suratJalan,
  suratJalanDetail,
  suratJalanHasil,
  suratJalanHasilDetail,
} from '../../../db/schema';

/** K-176: ringkasan hasil per surat jalan untuk penanda kartu (null = hasil belum dicatat). */
const hasilRingkas = sql<'SEMUA_DITERIMA' | 'ADA_KEMBALI' | 'ADA_RUSAK' | null>`(
  select case
    when sum(d.qty_rusak) > 0 then 'ADA_RUSAK'
    when sum(d.qty_kembali + d.qty_ditolak) > 0 then 'ADA_KEMBALI'
    else 'SEMUA_DITERIMA' end
  from ${suratJalanHasilDetail} d
  join ${suratJalanHasil} h on h.id = d.id_hasil
  where h.id_surat_jalan = ${kolomPenuh(suratJalan.id)})`;

/* Perjalanan pengantaran (S9, S12). */

const kolom = {
  id: perjalanan.id,
  nomor: perjalanan.nomor,
  status: perjalanan.status,
  idKendaraan: perjalanan.idKendaraan,
  plat: kendaraan.plat,
  jenisKendaraan: kendaraan.jenis,
  kapasitasKg: kendaraan.kapasitasKg,
  bakPanjangCm: kendaraan.bakPanjangCm,
  bakLebarCm: kendaraan.bakLebarCm,
  bakTinggiCm: kendaraan.bakTinggiCm,
  idSopir: perjalanan.idSopir,
  namaSopir: sopir.nama,
  noHpSopir: sopir.noHp,
  waktuBerangkat: perjalanan.waktuBerangkat,
  waktuKembali: perjalanan.waktuKembali,
  jadwalBerangkat: perjalanan.jadwalBerangkat,
  alasanBatal: perjalanan.alasanBatal,
  muatanBeratKg: perjalanan.muatanBeratKg,
  muatanVolumeM3: perjalanan.muatanVolumeM3,
  catatan: perjalanan.catatan,
  namaPengguna: pengguna.namaPengguna,
};

export type SaringPerjalanan = {
  id?: number | undefined;
  status?: StatusPerjalanan | undefined;
  idKendaraan?: number | undefined;
  idSopir?: number | undefined;
};

function syarat(p: SaringPerjalanan): SQL | undefined {
  return and(
    p.id ? eq(perjalanan.id, p.id) : undefined,
    p.status ? eq(perjalanan.status, p.status) : undefined,
    p.idKendaraan ? eq(perjalanan.idKendaraan, p.idKendaraan) : undefined,
    p.idSopir ? eq(perjalanan.idSopir, p.idSopir) : undefined,
  );
}

export async function daftar(
  ex: Executor,
  p: SaringPerjalanan & { limit: number; offset: number },
) {
  const where = syarat(p);
  const baris = await ex
    .select(kolom)
    .from(perjalanan)
    .innerJoin(kendaraan, eq(kendaraan.id, perjalanan.idKendaraan))
    .innerJoin(sopir, eq(sopir.id, perjalanan.idSopir))
    .innerJoin(pengguna, eq(pengguna.id, perjalanan.idPengguna))
    .where(where)
    .orderBy(desc(perjalanan.waktuBerangkat), desc(perjalanan.id))
    .limit(p.limit)
    .offset(p.offset);
  const [h] = await ex.select({ total: count() }).from(perjalanan).where(where);
  return { baris, total: h?.total ?? 0 };
}

export function suratJalanPerjalanan(ex: Executor, idPerjalanan: number[]) {
  if (idPerjalanan.length === 0) return Promise.resolve([]);
  return ex
    .select({
      idPerjalanan: suratJalan.idPerjalanan,
      id: suratJalan.id,
      nomor: suratJalan.nomor,
      status: suratJalan.status,
      idPenjualan: suratJalan.idPenjualan,
      nomorPenjualan: penjualan.nomor,
      namaPelanggan: pelanggan.namaPelanggan,
      alamatKirim: suratJalan.alamatKirim,
      hasilRingkas,
    })
    .from(suratJalan)
    .innerJoin(penjualan, eq(penjualan.id, suratJalan.idPenjualan))
    .leftJoin(pelanggan, eq(pelanggan.id, penjualan.idPelanggan))
    .where(inArray(suratJalan.idPerjalanan, idPerjalanan))
    .orderBy(suratJalan.id);
}

export async function tambah(
  tx: Tx,
  nilai: {
    nomor: string;
    idKendaraan: number;
    idSopir: number;
    idPengguna: number;
    status: 'DIRENCANAKAN' | 'JALAN';
    waktuBerangkat: Date | null;
    jadwalBerangkat: Date | null;
    catatan: string | null;
    muatanBeratKg: string | null;
    muatanVolumeM3: string | null;
    alasanMuatan: string | null;
  },
): Promise<number> {
  const [b] = await tx.insert(perjalanan).values(nilai).returning({ id: perjalanan.id });
  if (!b) throw new Error('insert perjalanan tidak mengembalikan id');
  return b.id;
}

export async function kunci(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: perjalanan.id,
      nomor: perjalanan.nomor,
      status: perjalanan.status,
      idKendaraan: perjalanan.idKendaraan,
      idSopir: perjalanan.idSopir,
    })
    .from(perjalanan)
    .where(eq(perjalanan.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** Surat jalan lain di perjalanan ini yang masih DIKIRIM (perjalanan belum selesai). */
export async function masihDikirim(ex: Executor, idPerjalanan: number, kecuali: number) {
  const [h] = await ex
    .select({ n: count() })
    .from(suratJalan)
    .where(
      and(
        eq(suratJalan.idPerjalanan, idPerjalanan),
        eq(suratJalan.status, 'DIKIRIM'),
        ne(suratJalan.id, kecuali),
      ),
    );
  return h?.n ?? 0;
}

export async function selesaikan(tx: Tx, id: number, waktu: Date) {
  await tx
    .update(perjalanan)
    .set({ status: 'SELESAI', waktuKembali: waktu, diubahPada: waktu })
    .where(eq(perjalanan.id, id));
}

/** K-161: baris surat jalan beserta data muatan barangnya (per satuan dasar) untuk hitung muatan. */
export function barisMuatan(ex: Executor, idSuratJalan: number[]) {
  if (idSuratJalan.length === 0) return Promise.resolve([]);
  return ex
    .select({
      namaBarang: barang.namaBarang,
      qtyKirim: suratJalanDetail.qtyKirim,
      faktor: penjualanDetail.faktor,
      beratKg: barang.beratKg,
      panjangCm: barang.panjangCm,
      lebarCm: barang.lebarCm,
      tinggiCm: barang.tinggiCm,
      curah: barang.curah,
      volumeM3: barang.volumeM3,
    })
    .from(suratJalanDetail)
    .innerJoin(penjualanDetail, eq(penjualanDetail.id, suratJalanDetail.idPenjualanDetail))
    .innerJoin(barang, eq(barang.id, penjualanDetail.idBarang))
    .where(inArray(suratJalanDetail.idSuratJalan, idSuratJalan));
}

/** Id surat jalan (belum batal) dalam satu rit. */
export async function idSuratJalanRit(ex: Executor, idPerjalanan: number): Promise<number[]> {
  const r = await ex
    .select({ id: suratJalan.id })
    .from(suratJalan)
    .where(and(eq(suratJalan.idPerjalanan, idPerjalanan), ne(suratJalan.status, 'BATAL')));
  return r.map((x) => x.id);
}
