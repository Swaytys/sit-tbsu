import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { AksiLog } from '@sit/shared';
import type { Executor } from '../../../db/client';
import { logAktivitas, pengguna } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

type SaringLog = {
  cari?: string | undefined;
  aksi?: AksiLog | undefined;
  /** Tanggal lokal toko (Asia/Jakarta), inklusif. */
  dari?: string | undefined;
  sampai?: string | undefined;
};

function syarat(p: SaringLog): SQL | undefined {
  const daftar: (SQL | undefined)[] = [];
  const tanggal = sql`(${logAktivitas.waktu} at time zone 'Asia/Jakarta')::date`;
  if (p.dari) daftar.push(sql`${tanggal} >= ${p.dari}::date`);
  if (p.sampai) daftar.push(sql`${tanggal} <= ${p.sampai}::date`);
  if (p.aksi) daftar.push(eq(logAktivitas.aksi, p.aksi));
  if (p.cari) {
    const pola = polaCari(p.cari);
    daftar.push(
      or(
        ilike(logAktivitas.ringkasan, pola),
        ilike(logAktivitas.nomorDokumen, pola),
        ilike(logAktivitas.usernamePercobaan, pola),
        ilike(pengguna.namaPengguna, pola),
        ilike(pengguna.username, pola),
      ),
    );
  }
  return and(...daftar);
}

/** Log terbaru lebih dulu, beserta nama pengguna pelakunya. */
export async function daftarLog(ex: Executor, p: SaringLog & { limit: number; offset: number }) {
  const where = syarat(p);
  const baris = await ex
    .select({
      id: logAktivitas.id,
      waktu: logAktivitas.waktu,
      idPengguna: logAktivitas.idPengguna,
      namaPengguna: pengguna.namaPengguna,
      usernamePercobaan: logAktivitas.usernamePercobaan,
      aksi: logAktivitas.aksi,
      entitas: logAktivitas.entitas,
      idEntitas: logAktivitas.idEntitas,
      nomorDokumen: logAktivitas.nomorDokumen,
      ringkasan: logAktivitas.ringkasan,
      dataLama: logAktivitas.dataLama,
      dataBaru: logAktivitas.dataBaru,
      ip: logAktivitas.ip,
    })
    .from(logAktivitas)
    .leftJoin(pengguna, eq(logAktivitas.idPengguna, pengguna.id))
    .where(where)
    .orderBy(desc(logAktivitas.waktu), desc(logAktivitas.id))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex
    .select({ total: count() })
    .from(logAktivitas)
    .leftJoin(pengguna, eq(logAktivitas.idPengguna, pengguna.id))
    .where(where);
  return { baris, total: hitung?.total ?? 0 };
}
