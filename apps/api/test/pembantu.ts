import type { Peran, StatusAktif } from '@sit/shared';
import { sql } from 'drizzle-orm';
import { app } from '../src/app';
import { db } from '../src/db/client';
import { konfigurasi, logAktivitas, pengguna, penghitungNomor, sesiLogin } from '../src/db/schema';
import { hashPassword } from '../src/lib/password';
import { resetBatasPercobaan } from '../src/middleware/batas-percobaan';
import { NAMA_COOKIE_SESI } from '../src/modules/auth/token';
import { invalidasiKonfigurasi } from '../src/modules/sistem/konfigurasi/service';
import { kosongkanTabel } from './reset';

export const PASSWORD_UJI = 'rahasia-uji-123';

let hashUji: Promise<string> | undefined;
let nomorUji = 0;

/** Mengosongkan tabel sistem (pengguna, sesi, log, penomoran, konfigurasi) beserta cache terkait. */
export async function siapkanDatabaseSistem(): Promise<void> {
  await kosongkanTabel(pengguna, sesiLogin, logAktivitas, penghitungNomor, konfigurasi);
  invalidasiKonfigurasi();
  resetBatasPercobaan();
}

/** Mengisi/menimpa nilai konfigurasi untuk tes (cache ikut dikosongkan). */
export async function aturKonfigurasi(nilai: Record<string, string>): Promise<void> {
  await db
    .insert(konfigurasi)
    .values(Object.entries(nilai).map(([kode, isi]) => ({ kode, nilai: isi })))
    .onConflictDoUpdate({ target: konfigurasi.kode, set: { nilai: sql`excluded.nilai` } });
  invalidasiKonfigurasi();
}

/** Membuat pengguna uji langsung di database. Password bawaan: PASSWORD_UJI. */
export async function buatPenggunaUji(opsi: {
  peran: Peran;
  username?: string;
  password?: string;
  statusAktif?: StatusAktif;
  wajibGantiPassword?: boolean;
}) {
  nomorUji++;
  hashUji ??= hashPassword(PASSWORD_UJI);
  const passwordHash = opsi.password ? await hashPassword(opsi.password) : await hashUji;
  const [baris] = await db
    .insert(pengguna)
    .values({
      kode: `UJI-${String(nomorUji).padStart(5, '0')}`,
      namaPengguna: `Pengguna Uji ${nomorUji}`,
      username: opsi.username ?? `uji.${opsi.peran.toLowerCase()}.${nomorUji}`,
      passwordHash,
      peran: opsi.peran,
      statusAktif: opsi.statusAktif ?? 'AKTIF',
      wajibGantiPassword: opsi.wajibGantiPassword ?? false,
    })
    .returning();
  if (!baris) throw new Error('Pengguna uji gagal dibuat');
  return baris;
}

type OpsiMinta = {
  method?: string;
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Memanggil API seperti browser: JSON, cookie sesi, dan header Origin (browser selalu mengirim Origin
 * pada POST; tanpa itu pengaman CSRF menolak permintaan non-JSON).
 */
export function minta(path: string, opsi: OpsiMinta = {}): Promise<Response> {
  const headers: Record<string, string> = { origin: 'http://localhost', ...opsi.headers };
  if (opsi.cookie) headers.cookie = opsi.cookie;
  if (opsi.body !== undefined) headers['content-type'] = 'application/json';
  return Promise.resolve(
    app.request(path, {
      method: opsi.method ?? 'GET',
      headers,
      body: opsi.body === undefined ? undefined : JSON.stringify(opsi.body),
    }),
  );
}

/** Nilai `sit_sesi=<token>` dari header Set-Cookie respons login (kosong bila tidak ada). */
export function cookieSesi(res: Response): string {
  const baris = res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${NAMA_COOKIE_SESI}=`) && !c.startsWith(`${NAMA_COOKIE_SESI}=;`));
  return baris?.split(';')[0] ?? '';
}

export async function loginUji(username: string, password = PASSWORD_UJI): Promise<string> {
  const res = await minta('/api/auth/login', { method: 'POST', body: { username, password } });
  if (res.status !== 200) throw new Error(`Login uji gagal (${res.status}): ${await res.text()}`);
  return cookieSesi(res);
}

/** Pengguna uji dengan peran tertentu yang sudah login. */
export async function sesiUji(peran: Peran, opsi: { wajibGantiPassword?: boolean } = {}) {
  const p = await buatPenggunaUji({ peran, ...opsi });
  return { pengguna: p, cookie: await loginUji(p.username) };
}

/** Isi JSON respons dengan tipe longgar (untuk tes). */
export async function json<T = { data?: unknown; error?: { kode: string; pesan: string } }>(
  res: Response,
): Promise<T> {
  return (await res.json()) as T;
}
