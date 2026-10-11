import { and, eq, isNotNull, or } from 'drizzle-orm';
import type { Executor, Tx } from '../../../db/client';
import { pengguna } from '../../../db/schema';

const kolomKontak = {
  id: pengguna.id,
  namaPengguna: pengguna.namaPengguna,
  username: pengguna.username,
  peran: pengguna.peran,
  statusAktif: pengguna.statusAktif,
  email: pengguna.email,
  telegramChatId: pengguna.telegramChatId,
};

export async function kontakPengguna(ex: Executor, id: number) {
  const [p] = await ex.select(kolomKontak).from(pengguna).where(eq(pengguna.id, id));
  return p;
}

/** Pengguna aktif yang punya email atau Telegram terhubung (calon penerima kode). */
export function penggunaBerkontak(ex: Executor) {
  return ex
    .select(kolomKontak)
    .from(pengguna)
    .where(
      and(
        eq(pengguna.statusAktif, 'AKTIF'),
        or(isNotNull(pengguna.email), isNotNull(pengguna.telegramChatId)),
      ),
    )
    .orderBy(pengguna.id);
}

export async function ubahKontak(
  tx: Tx,
  id: number,
  nilai: { email?: string | null; telegramChatId?: string | null },
  waktu: Date,
): Promise<void> {
  await tx
    .update(pengguna)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(pengguna.id, id));
}
