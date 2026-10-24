import { and, count, desc, eq, gt, isNull, lte, max, min } from 'drizzle-orm';
import type { Executor, Tx } from '../../../db/client';
import {
  catatanBbm,
  catatanServis,
  kendaraan,
  pengguna,
  perjalanan,
  sopir,
} from '../../../db/schema';

/*
 * Catatan BBM dan servis kendaraan (K-162, docs/13 §5). [APPEND] kecuali kolom batal.
 */

export type JenisCatatan = 'bbm' | 'servis';
const TABEL = { bbm: catatanBbm, servis: catatanServis } as const;

/**
 * Batas odometer untuk catatan bertanggal `tanggal`: odometer terbesar pada/ sebelum tanggal itu dan terkecil
 * sesudahnya (catatan susulan tetap boleh selama urutannya masuk akal). Gabungan BBM + servis, tanpa yang batal.
 */
export async function batasOdometer(ex: Executor, idKendaraan: number, tanggal: string) {
  let sebelum: number | null = null;
  let sesudah: number | null = null;
  for (const t of [catatanBbm, catatanServis]) {
    const syarat = and(eq(t.idKendaraan, idKendaraan), isNull(t.batalPada));
    const [a] = await ex
      .select({ v: max(t.odometerKm) })
      .from(t)
      .where(and(syarat, lte(t.tanggal, tanggal)));
    const [b] = await ex
      .select({ v: min(t.odometerKm) })
      .from(t)
      .where(and(syarat, gt(t.tanggal, tanggal)));
    if (a?.v != null && (sebelum === null || a.v > sebelum)) sebelum = a.v;
    if (b?.v != null && (sesudah === null || b.v < sesudah)) sesudah = b.v;
  }
  return { sebelum, sesudah };
}

export async function tambahBbm(tx: Tx, nilai: typeof catatanBbm.$inferInsert): Promise<number> {
  const [b] = await tx.insert(catatanBbm).values(nilai).returning({ id: catatanBbm.id });
  if (!b) throw new Error('Catatan BBM gagal disimpan');
  return b.id;
}

export async function tambahServis(
  tx: Tx,
  nilai: typeof catatanServis.$inferInsert,
): Promise<number> {
  const [b] = await tx.insert(catatanServis).values(nilai).returning({ id: catatanServis.id });
  if (!b) throw new Error('Catatan servis gagal disimpan');
  return b.id;
}

export async function kunciCatatan(tx: Tx, jenis: JenisCatatan, id: number) {
  const t = TABEL[jenis];
  const [b] = await tx
    .select({
      id: t.id,
      idKendaraan: t.idKendaraan,
      tanggal: t.tanggal,
      batalPada: t.batalPada,
      plat: kendaraan.plat,
    })
    .from(t)
    .innerJoin(kendaraan, eq(kendaraan.id, t.idKendaraan))
    .where(eq(t.id, id))
    .limit(1)
    .for('update', { of: t });
  return b;
}

export async function batalkan(
  tx: Tx,
  jenis: JenisCatatan,
  id: number,
  nilai: { batalPada: Date; alasanBatal: string; dibatalkanOleh: number },
) {
  const t = TABEL[jenis];
  await tx.update(t).set(nilai).where(eq(t.id, id));
}

type Saring = { idKendaraan?: number | undefined; limit: number; offset: number };

export async function daftarBbm(ex: Executor, p: Saring) {
  const syarat =
    p.idKendaraan === undefined ? undefined : eq(catatanBbm.idKendaraan, p.idKendaraan);
  const data = await ex
    .select({
      id: catatanBbm.id,
      idKendaraan: catatanBbm.idKendaraan,
      plat: kendaraan.plat,
      tanggal: catatanBbm.tanggal,
      namaSopir: sopir.nama,
      nomorPerjalanan: perjalanan.nomor,
      odometerKm: catatanBbm.odometerKm,
      liter: catatanBbm.liter,
      totalRp: catatanBbm.totalRp,
      penuh: catatanBbm.penuh,
      catatan: catatanBbm.catatan,
      pencatat: pengguna.namaPengguna,
      dibuatPada: catatanBbm.dibuatPada,
      batalPada: catatanBbm.batalPada,
      alasanBatal: catatanBbm.alasanBatal,
    })
    .from(catatanBbm)
    .innerJoin(kendaraan, eq(kendaraan.id, catatanBbm.idKendaraan))
    .innerJoin(pengguna, eq(pengguna.id, catatanBbm.idPengguna))
    .leftJoin(sopir, eq(sopir.id, catatanBbm.idSopir))
    .leftJoin(perjalanan, eq(perjalanan.id, catatanBbm.idPerjalanan))
    .where(syarat)
    .orderBy(desc(catatanBbm.tanggal), desc(catatanBbm.id))
    .limit(p.limit)
    .offset(p.offset);
  const [t] = await ex.select({ n: count() }).from(catatanBbm).where(syarat);
  return { data, total: t?.n ?? 0 };
}

export async function daftarServis(ex: Executor, p: Saring) {
  const syarat =
    p.idKendaraan === undefined ? undefined : eq(catatanServis.idKendaraan, p.idKendaraan);
  const data = await ex
    .select({
      id: catatanServis.id,
      idKendaraan: catatanServis.idKendaraan,
      plat: kendaraan.plat,
      tanggal: catatanServis.tanggal,
      odometerKm: catatanServis.odometerKm,
      jenis: catatanServis.jenis,
      biayaRp: catatanServis.biayaRp,
      bengkel: catatanServis.bengkel,
      catatan: catatanServis.catatan,
      pencatat: pengguna.namaPengguna,
      dibuatPada: catatanServis.dibuatPada,
      batalPada: catatanServis.batalPada,
      alasanBatal: catatanServis.alasanBatal,
    })
    .from(catatanServis)
    .innerJoin(kendaraan, eq(kendaraan.id, catatanServis.idKendaraan))
    .innerJoin(pengguna, eq(pengguna.id, catatanServis.idPengguna))
    .where(syarat)
    .orderBy(desc(catatanServis.tanggal), desc(catatanServis.id))
    .limit(p.limit)
    .offset(p.offset);
  const [t] = await ex.select({ n: count() }).from(catatanServis).where(syarat);
  return { data, total: t?.n ?? 0 };
}

/** Rit milik kendaraan (untuk memastikan rit yang dipilih di catatan BBM memang rit kendaraan itu). */
export async function ritKendaraan(ex: Executor, idPerjalanan: number) {
  const [b] = await ex
    .select({ idKendaraan: perjalanan.idKendaraan, nomor: perjalanan.nomor })
    .from(perjalanan)
    .where(eq(perjalanan.id, idPerjalanan))
    .limit(1);
  return b;
}
