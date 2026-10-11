/*
 * Klien kecil Bot API Telegram (https://core.telegram.org/bots/api) memakai `fetch` bawaan Node: kirim pesan,
 * baca identitas bot, dan baca pesan masuk (untuk menghubungkan akun pengguna dengan chat-nya). Server toko
 * tidak punya alamat publik, jadi pesan masuk dibaca dengan `getUpdates` saat diperlukan, bukan webhook.
 */

const BATAS_WAKTU_MS = 8000;

type Jawaban<T> = { ok: true; result: T } | { ok: false; description?: string };

/** Gagal menghubungi Telegram atau ditolak Telegram; `message` aman ditampilkan (tanpa token). */
export class GalatTelegram extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GalatTelegram';
  }
}

async function panggil<T>(token: string, metode: string, isi: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${metode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(isi),
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    });
  } catch {
    // Pesan galat fetch bisa memuat URL (berisi token), jadi tidak diteruskan.
    throw new GalatTelegram('Telegram tidak bisa dihubungi (periksa internet server).');
  }
  const j = (await res.json().catch(() => null)) as Jawaban<T> | null;
  if (!j?.ok) {
    throw new GalatTelegram(
      res.status === 401 || res.status === 404
        ? 'Token bot Telegram tidak dikenal.'
        : `Telegram menolak permintaan (${j?.description ?? `HTTP ${res.status}`}).`,
    );
  }
  return j.result;
}

export async function kirimTelegram(token: string, chatId: string, teks: string): Promise<void> {
  await panggil(token, 'sendMessage', { chat_id: chatId, text: teks });
}

/** Nama pengguna bot (tanpa @), untuk tautan `https://t.me/<bot>?start=<kode>`. */
export async function infoBot(token: string): Promise<{ username: string; nama: string }> {
  const r = await panggil<{ username: string; first_name: string }>(token, 'getMe', {});
  return { username: r.username, nama: r.first_name };
}

export type PesanMasuk = { idPembaruan: number; chatId: string; teks: string; dari: string };

/** Pesan teks pribadi yang masuk ke bot sejak `offset` (id pembaruan terakhir + 1). */
export async function pesanMasuk(token: string, offset: number): Promise<PesanMasuk[]> {
  type Pembaruan = {
    update_id: number;
    message?: {
      text?: string;
      chat: { id: number; type: string };
      from?: { first_name?: string; username?: string };
    };
  };
  const daftar = await panggil<Pembaruan[]>(token, 'getUpdates', {
    offset,
    timeout: 0,
    allowed_updates: ['message'],
  });
  return daftar.flatMap((u) =>
    u.message?.text && u.message.chat.type === 'private'
      ? [
          {
            idPembaruan: u.update_id,
            chatId: String(u.message.chat.id),
            teks: u.message.text,
            dari: u.message.from?.username ?? u.message.from?.first_name ?? '',
          },
        ]
      : [],
  );
}
