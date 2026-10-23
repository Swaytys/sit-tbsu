import { createHash } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { db } from '../db/client';
import { kunciIdempoten } from '../db/schema';
import type { EnvApp } from '../lib/konteks';
import { logger } from '../lib/logger';

/*
 * K-164: kunci idempoten. Peramban mengirim header `Idempotency-Key` untuk setiap kiriman perubahan
 * (POST/PUT/PATCH/DELETE) dan memakai kunci yang sama bila kiriman yang sama diulang karena jaringan gagal.
 * - kunci baru: dicatat PROSES, permintaan dijalankan; jawaban sukses disimpan, jawaban gagal menghapus kunci
 *   (boleh dicoba lagi dengan perbaikan);
 * - kunci SELESAI dengan isi sama: jawaban tersimpan dikembalikan apa adanya (tidak dijalankan dua kali);
 * - kunci sama dengan isi berbeda: ditolak (kunci dipakai ulang secara keliru);
 * - kunci masih PROSES: ditolak sementara (permintaan pertama belum selesai).
 */

const POLA_KUNCI = /^[A-Za-z0-9_-]{8,64}$/;
const METODE_UBAH = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const HEADER_IDEMPOTEN = 'Idempotency-Key';

function galat(kode: 'KONFLIK' | 'VALIDASI', pesan: string, status: 409 | 422, proses = false) {
  return new Response(JSON.stringify({ error: { kode, pesan } }), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      // Peramban memakai kunci yang sama lagi hanya bila permintaan pertama masih berjalan.
      ...(proses ? { 'Idempotent-Status': 'proses' } : {}),
    },
  });
}

export const idempoten: MiddlewareHandler<EnvApp> = async (c, next) => {
  const kunci = c.req.header(HEADER_IDEMPOTEN);
  const pengguna = c.get('pengguna');
  const jenis = c.req.header('content-type') ?? '';
  // Unggahan berkas (multipart) dan permintaan tanpa login tidak memakai kunci.
  if (!kunci || !pengguna || !METODE_UBAH.has(c.req.method) || jenis.includes('multipart')) {
    return next();
  }
  if (!POLA_KUNCI.test(kunci)) {
    return galat('VALIDASI', 'Kunci kiriman tidak valid. Muat ulang halaman lalu ulangi.', 422);
  }
  const jalur = c.req.path.slice(0, 255);
  const hashBody = createHash('sha256')
    .update(`${c.req.method} ${jalur}\n${await c.req.text()}`)
    .digest('hex');

  const [baru] = await db
    .insert(kunciIdempoten)
    .values({ kunci, idPengguna: pengguna.id, metode: c.req.method, jalur, hashBody })
    .onConflictDoNothing()
    .returning({ kunci: kunciIdempoten.kunci });
  if (!baru) {
    const [ada] = await db
      .select()
      .from(kunciIdempoten)
      .where(and(eq(kunciIdempoten.kunci, kunci), eq(kunciIdempoten.idPengguna, pengguna.id)))
      .limit(1);
    if (!ada) return next(); // terhapus di antara dua kueri: jalankan biasa
    if (ada.hashBody !== hashBody) {
      return galat(
        'VALIDASI',
        'Kunci kiriman dipakai untuk isi yang berbeda. Muat ulang halaman.',
        422,
      );
    }
    if (ada.status === 'PROSES' || ada.kodeHttp === null) {
      return galat(
        'KONFLIK',
        'Kiriman yang sama masih diproses. Tunggu sebentar lalu periksa hasilnya sebelum mengulang.',
        409,
        true,
      );
    }
    logger.info({ jalur, idPengguna: pengguna.id }, 'Kiriman ulang dijawab dari kunci idempoten');
    return new Response(ada.respons ?? '', {
      status: ada.kodeHttp,
      headers: { 'content-type': 'application/json; charset=UTF-8', 'Idempotent-Replay': 'true' },
    });
  }

  try {
    await next();
  } catch (err) {
    await hapus(kunci, pengguna.id);
    throw err;
  }
  const status = c.res.status;
  if (status >= 200 && status < 300) {
    const isi = await c.res.clone().text();
    await db
      .update(kunciIdempoten)
      .set({ status: 'SELESAI', kodeHttp: status, respons: isi })
      .where(and(eq(kunciIdempoten.kunci, kunci), eq(kunciIdempoten.idPengguna, pengguna.id)));
  } else {
    await hapus(kunci, pengguna.id);
  }
};

async function hapus(kunci: string, idPengguna: number) {
  await db
    .delete(kunciIdempoten)
    .where(and(eq(kunciIdempoten.kunci, kunci), eq(kunciIdempoten.idPengguna, idPengguna)));
}

/** Membersihkan kunci lebih tua dari 24 jam (dipanggil job berkala). */
export async function bersihkanKunciIdempoten(): Promise<number> {
  const hasil = await db
    .delete(kunciIdempoten)
    .where(lt(kunciIdempoten.dibuatPada, sql`now() - interval '24 hours'`))
    .returning({ kunci: kunciIdempoten.kunci });
  return hasil.length;
}
