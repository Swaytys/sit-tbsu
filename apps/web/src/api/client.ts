import type { AppType } from '@sit/api';
import { KODE_ERROR, type KodeError } from '@sit/shared';
import { hc } from 'hono/client';

const METODE_UBAH = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Kiriman yang belum mendapat jawaban (jaringan gagal): tanda isi → kunci, dipakai lagi saat diulang. */
const kunciTertunda = new Map<string, string>();

/** Kunci acak; `crypto.randomUUID` tidak tersedia di alamat http jaringan toko (bukan "secure context"). */
function kunciBaru(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * K-164: setiap kiriman perubahan membawa header `Idempotency-Key`. Kiriman dengan isi sama yang diulang setelah
 * jaringan gagal memakai kunci yang sama, sehingga server tidak mencatatnya dua kali. Begitu ada jawaban (berhasil
 * atau ditolak), kuncinya dibuang: transaksi baru dengan isi kebetulan sama (pembeli lain) tetap tercatat.
 */
async function fetchIdempoten(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const metode = (init?.method ?? 'GET').toUpperCase();
  if (!METODE_UBAH.has(metode) || init?.body instanceof FormData) return fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const tanda = `${metode} ${url}
${typeof init?.body === 'string' ? init.body : ''}`;
  const kunci = kunciTertunda.get(tanda) ?? kunciBaru();
  kunciTertunda.set(tanda, kunci);
  const headers = new Headers(init?.headers);
  headers.set('Idempotency-Key', kunci);
  try {
    const res = await fetch(input, { ...init, headers });
    if (res.headers.get('Idempotent-Status') !== 'proses') kunciTertunda.delete(tanda);
    return res;
  } catch (err) {
    // Tanpa jawaban: kunci disimpan 10 menit untuk kiriman ulang yang sama.
    setTimeout(() => {
      if (kunciTertunda.get(tanda) === kunci) kunciTertunda.delete(tanda);
    }, 10 * 60_000);
    throw err;
  }
}

/** Klien API bertipe: rute dan bentuk data mengikuti backend (apps/api/src/app.ts). */
export const api = hc<AppType>('/api', { fetch: fetchIdempoten });

/** Parameter rute `/:id` untuk klien `hc` (nilai parameter rute selalu teks). */
export const paramId = (id: number) => ({ id: String(id) });

/** Kesalahan dari API; `message` berisi pesan dari server yang siap ditampilkan. */
export class GalatApi extends Error {
  constructor(
    public readonly kode: KodeError,
    message: string,
    public readonly status: number,
    /** Mis. `{ kolom: { username: ['Username sudah dipakai.'] } }` untuk galat validasi. */
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'GalatApi';
  }

  /** Pesan per kolom form dari server (bila ada). */
  get kolom(): Record<string, string[]> {
    if (typeof this.detail === 'object' && this.detail !== null && 'kolom' in this.detail) {
      const { kolom } = this.detail;
      if (typeof kolom === 'object' && kolom !== null) return kolom as Record<string, string[]>;
    }
    return {};
  }
}

function adalahKodeError(nilai: unknown): nilai is KodeError {
  return typeof nilai === 'string' && (KODE_ERROR as readonly string[]).includes(nilai);
}

/** Membaca respons gagal `{ error: { kode, pesan, detail? } }` menjadi GalatApi. */
export async function galatDariRespons(res: {
  status: number;
  json: () => Promise<unknown>;
}): Promise<GalatApi> {
  try {
    const body = await res.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const { error } = body as { error: { kode?: unknown; pesan?: unknown; detail?: unknown } };
      if (adalahKodeError(error.kode) && typeof error.pesan === 'string') {
        return new GalatApi(error.kode, error.pesan, res.status, error.detail);
      }
    }
  } catch {
    // Bukan JSON (mis. server API mati di belakang proxy).
  }
  return new GalatApi('INTERNAL', `Permintaan gagal (HTTP ${res.status}).`, res.status);
}

/** Mengambil `data` dari respons sukses, atau melempar GalatApi berisi pesan dari server. */
export async function ambilData<T>(res: {
  ok: boolean;
  status: number;
  json: () => Promise<{ data: T }>;
}): Promise<T> {
  if (!res.ok) throw await galatDariRespons(res);
  return (await res.json()).data;
}

/** Seperti `ambilData`, tetapi mengembalikan seluruh isi (mis. `{ data, meta }` daftar berhalaman). */
export async function ambilIsi<T>(res: {
  ok: boolean;
  status: number;
  json: () => Promise<T>;
}): Promise<T> {
  if (!res.ok) throw await galatDariRespons(res);
  return res.json();
}

/** Pesan yang aman ditampilkan untuk kesalahan apa pun dari pemanggilan API. */
export function pesanGalat(err: unknown): string {
  if (err instanceof GalatApi) return err.message;
  return 'Tidak dapat terhubung ke server. Periksa apakah server API berjalan.';
}
