import { and, eq, sql } from 'drizzle-orm';
import type { JenisKodePersetujuan, StatusKodePersetujuan } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { kodePersetujuan, pengguna, permintaanPersetujuan } from '../../../db/schema';

export type Rujukan = {
  idRetur?: number;
  idVoid?: number;
  idPelanggan?: number;
  idOrderPembelian?: number;
};

/** Permintaan lama yang masih menunggu untuk hal yang sama: hanya kode terbaru yang berlaku. */
export async function gantikanYangMenunggu(
  tx: Tx,
  p: { jenis: JenisKodePersetujuan; idPengaju: number; rujukan: Rujukan },
  waktu: Date,
): Promise<void> {
  const r = p.rujukan;
  await tx
    .update(permintaanPersetujuan)
    .set({ status: 'DIGANTI', diputusPada: waktu })
    .where(
      and(
        eq(permintaanPersetujuan.jenis, p.jenis),
        eq(permintaanPersetujuan.idPengaju, p.idPengaju),
        eq(permintaanPersetujuan.status, 'MENUNGGU'),
        r.idRetur !== undefined ? eq(permintaanPersetujuan.idRetur, r.idRetur) : undefined,
        r.idVoid !== undefined ? eq(permintaanPersetujuan.idVoid, r.idVoid) : undefined,
        r.idPelanggan !== undefined
          ? eq(permintaanPersetujuan.idPelanggan, r.idPelanggan)
          : undefined,
        r.idOrderPembelian !== undefined
          ? eq(permintaanPersetujuan.idOrderPembelian, r.idOrderPembelian)
          : undefined,
      ),
    );
}

export async function tambahPermintaan(
  tx: Tx,
  nilai: typeof permintaanPersetujuan.$inferInsert,
): Promise<number> {
  const [b] = await tx
    .insert(permintaanPersetujuan)
    .values(nilai)
    .returning({ id: permintaanPersetujuan.id });
  if (!b) throw new Error('insert permintaan_persetujuan tidak mengembalikan id');
  return b.id;
}

export async function tambahKode(
  tx: Tx,
  baris: { idPermintaan: number; idAtasan: number; kodeHash: string }[],
): Promise<void> {
  await tx.insert(kodePersetujuan).values(baris);
}

export async function catatSaluran(
  ex: Executor,
  idPermintaan: number,
  idAtasan: number,
  saluran: string,
): Promise<void> {
  await ex
    .update(kodePersetujuan)
    .set({ saluran })
    .where(
      and(eq(kodePersetujuan.idPermintaan, idPermintaan), eq(kodePersetujuan.idAtasan, idAtasan)),
    );
}

export async function ubahStatus(
  ex: Executor,
  id: number,
  nilai: { status: StatusKodePersetujuan; idPenyetuju?: number; diputusPada: Date },
): Promise<void> {
  await ex.update(permintaanPersetujuan).set(nilai).where(eq(permintaanPersetujuan.id, id));
}

/** Mengunci baris permintaan: dua pemakaian kode yang sama bersamaan jadi berurutan. */
export async function kunciPermintaan(tx: Tx, id: number) {
  const [b] = await tx
    .select()
    .from(permintaanPersetujuan)
    .where(eq(permintaanPersetujuan.id, id))
    .for('update');
  return b;
}

/** Menambah hitungan salah ketik; mengembalikan hitungan baru. */
export async function tambahGagal(tx: Tx, id: number): Promise<number> {
  const [b] = await tx
    .update(permintaanPersetujuan)
    .set({ gagal: sql`${permintaanPersetujuan.gagal} + 1` })
    .where(eq(permintaanPersetujuan.id, id))
    .returning({ gagal: permintaanPersetujuan.gagal });
  return b?.gagal ?? 0;
}

/** Kode yang benar-benar terkirim beserta pemiliknya. */
export function kodeTerkirim(tx: Tx, idPermintaan: number) {
  return tx
    .select({
      idAtasan: kodePersetujuan.idAtasan,
      kodeHash: kodePersetujuan.kodeHash,
      saluran: kodePersetujuan.saluran,
      username: pengguna.username,
      namaPengguna: pengguna.namaPengguna,
      peran: pengguna.peran,
      statusAktif: pengguna.statusAktif,
    })
    .from(kodePersetujuan)
    .innerJoin(pengguna, eq(pengguna.id, kodePersetujuan.idAtasan))
    .where(eq(kodePersetujuan.idPermintaan, idPermintaan));
}

/** K-136: permintaan milik pengaju yang masih MENUNGGU, beserta atasan yang benar-benar menerima kodenya. */
export async function permintaanMenunggu(ex: Executor, id: number, idPengaju: number) {
  const [p] = await ex
    .select({
      id: permintaanPersetujuan.id,
      kadaluarsaPada: permintaanPersetujuan.kadaluarsaPada,
    })
    .from(permintaanPersetujuan)
    .where(
      and(
        eq(permintaanPersetujuan.id, id),
        eq(permintaanPersetujuan.idPengaju, idPengaju),
        eq(permintaanPersetujuan.status, 'MENUNGGU'),
      ),
    );
  if (!p) return null;
  const penerima = await ex
    .select({ nama: pengguna.namaPengguna, saluran: kodePersetujuan.saluran })
    .from(kodePersetujuan)
    .innerJoin(pengguna, eq(pengguna.id, kodePersetujuan.idAtasan))
    .where(eq(kodePersetujuan.idPermintaan, id));
  return { ...p, penerima };
}
