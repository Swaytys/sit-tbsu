import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { kendaraan, perjalanan, sopir } from '../../../db/schema';
import { kolomPenuh } from '../../../db/kolom-penuh';

/*
 * Kendaraan dan sopir (S8). Kolom turunan: jumlah perjalanan dan perjalanan yang sedang berjalan.
 */

const jalanKendaraan = sql<{
  idPerjalanan: number;
  nomor: string;
  waktuBerangkat: string;
} | null>`(select json_build_object('idPerjalanan', p.id, 'nomor', p.nomor, 'waktuBerangkat', p.waktu_berangkat)
  from ${perjalanan} p where p.id_kendaraan = ${kolomPenuh(kendaraan.id)} and p.status = 'JALAN' limit 1)`;
const tripKendaraan = sql<number>`(select count(*)::int from ${perjalanan} p where p.id_kendaraan = ${kolomPenuh(kendaraan.id)})`;

const jalanSopir = sql<{
  idPerjalanan: number;
  nomor: string;
  waktuBerangkat: string;
} | null>`(select json_build_object('idPerjalanan', p.id, 'nomor', p.nomor, 'waktuBerangkat', p.waktu_berangkat)
  from ${perjalanan} p where p.id_sopir = ${kolomPenuh(sopir.id)} and p.status = 'JALAN' limit 1)`;
const tripSopir = sql<number>`(select count(*)::int from ${perjalanan} p where p.id_sopir = ${kolomPenuh(sopir.id)})`;

const kolomKendaraan = {
  id: kendaraan.id,
  plat: kendaraan.plat,
  jenis: kendaraan.jenis,
  kapasitasKg: kendaraan.kapasitasKg,
  bakPanjangCm: kendaraan.bakPanjangCm,
  bakLebarCm: kendaraan.bakLebarCm,
  bakTinggiCm: kendaraan.bakTinggiCm,
  berlakuStnk: kendaraan.berlakuStnk,
  berlakuKir: kendaraan.berlakuKir,
  catatan: kendaraan.catatan,
  statusAktif: kendaraan.statusAktif,
  jumlahPerjalanan: tripKendaraan,
  sedangJalan: jalanKendaraan,
};

const kolomSopir = {
  id: sopir.id,
  nama: sopir.nama,
  noHp: sopir.noHp,
  catatan: sopir.catatan,
  statusAktif: sopir.statusAktif,
  jumlahPerjalanan: tripSopir,
  sedangJalan: jalanSopir,
};

export function daftarKendaraan(ex: Executor, status: StatusAktif | 'SEMUA') {
  return ex
    .select(kolomKendaraan)
    .from(kendaraan)
    .where(status === 'SEMUA' ? undefined : eq(kendaraan.statusAktif, status))
    .orderBy(asc(kendaraan.plat));
}

export async function kendaraanById(ex: Executor, id: number) {
  const [b] = await ex.select(kolomKendaraan).from(kendaraan).where(eq(kendaraan.id, id)).limit(1);
  return b;
}

export async function kunciKendaraan(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: kendaraan.id,
      plat: kendaraan.plat,
      jenis: kendaraan.jenis,
      kapasitasKg: kendaraan.kapasitasKg,
      bakPanjangCm: kendaraan.bakPanjangCm,
      bakLebarCm: kendaraan.bakLebarCm,
      bakTinggiCm: kendaraan.bakTinggiCm,
      berlakuStnk: kendaraan.berlakuStnk,
      berlakuKir: kendaraan.berlakuKir,
      catatan: kendaraan.catatan,
      statusAktif: kendaraan.statusAktif,
    })
    .from(kendaraan)
    .where(eq(kendaraan.id, id))
    .limit(1)
    .for('update');
  return b;
}

export type NilaiKendaraan = {
  plat: string;
  jenis: string;
  kapasitasKg: number | null;
  bakPanjangCm: number | null;
  bakLebarCm: number | null;
  bakTinggiCm: number | null;
  berlakuStnk: string | null;
  berlakuKir: string | null;
  catatan: string | null;
};

export async function platDipakai(ex: Executor, plat: string, kecualiId?: number) {
  const [b] = await ex
    .select({ id: kendaraan.id })
    .from(kendaraan)
    .where(
      and(
        sql`upper(${kendaraan.plat}) = upper(${plat})`,
        kecualiId === undefined ? undefined : ne(kendaraan.id, kecualiId),
      ),
    )
    .limit(1);
  return b !== undefined;
}

export async function tambahKendaraan(tx: Tx, nilai: NilaiKendaraan): Promise<number> {
  const [b] = await tx.insert(kendaraan).values(nilai).returning({ id: kendaraan.id });
  if (!b) throw new Error('Kendaraan gagal disimpan');
  return b.id;
}

export async function ubahKendaraan(
  tx: Tx,
  id: number,
  nilai: Partial<NilaiKendaraan & { statusAktif: StatusAktif }>,
  waktu: Date,
) {
  await tx
    .update(kendaraan)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(kendaraan.id, id));
}

export function daftarSopir(ex: Executor, status: StatusAktif | 'SEMUA') {
  return ex
    .select(kolomSopir)
    .from(sopir)
    .where(status === 'SEMUA' ? undefined : eq(sopir.statusAktif, status))
    .orderBy(asc(sopir.nama));
}

export async function sopirById(ex: Executor, id: number) {
  const [b] = await ex.select(kolomSopir).from(sopir).where(eq(sopir.id, id)).limit(1);
  return b;
}

export async function kunciSopir(tx: Tx, id: number) {
  const [b] = await tx
    .select({
      id: sopir.id,
      nama: sopir.nama,
      noHp: sopir.noHp,
      catatan: sopir.catatan,
      statusAktif: sopir.statusAktif,
    })
    .from(sopir)
    .where(eq(sopir.id, id))
    .limit(1)
    .for('update');
  return b;
}

/** Nama sopir dianggap sama tanpa membedakan huruf besar/kecil. */
export async function namaSopirDipakai(ex: Executor, nama: string, kecualiId?: number) {
  const [b] = await ex
    .select({ id: sopir.id })
    .from(sopir)
    .where(
      and(
        sql`lower(${sopir.nama}) = lower(${nama})`,
        kecualiId === undefined ? undefined : ne(sopir.id, kecualiId),
      ),
    )
    .limit(1);
  return b !== undefined;
}

export async function tambahSopir(
  tx: Tx,
  nilai: { nama: string; noHp: string | null; catatan: string | null },
): Promise<number> {
  const [b] = await tx.insert(sopir).values(nilai).returning({ id: sopir.id });
  if (!b) throw new Error('Sopir gagal disimpan');
  return b.id;
}

export async function ubahSopir(
  tx: Tx,
  id: number,
  nilai: Partial<{
    nama: string;
    noHp: string | null;
    catatan: string | null;
    statusAktif: StatusAktif;
  }>,
  waktu: Date,
) {
  await tx
    .update(sopir)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(sopir.id, id));
}

/** Perjalanan JALAN milik kendaraan/sopir (dipakai saat menonaktifkan dan saat berangkat). */
export async function perjalananJalan(ex: Executor, p: { idKendaraan?: number; idSopir?: number }) {
  const [b] = await ex
    .select({
      id: perjalanan.id,
      nomor: perjalanan.nomor,
      waktuBerangkat: perjalanan.waktuBerangkat,
    })
    .from(perjalanan)
    .where(
      and(
        eq(perjalanan.status, 'JALAN'),
        p.idKendaraan === undefined ? undefined : eq(perjalanan.idKendaraan, p.idKendaraan),
        p.idSopir === undefined ? undefined : eq(perjalanan.idSopir, p.idSopir),
      ),
    )
    .limit(1);
  return b;
}
