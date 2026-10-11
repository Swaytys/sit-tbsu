import { randomBytes } from 'node:crypto';
import {
  IZIN_PER_PERAN,
  type DataKontakSaya,
  type DataPengaturanSaluran,
  type HasilUjiSaluran,
  type Izin,
  type KontakSaya,
  type PengaturanSaluran,
  type SaluranPesan,
  type TautanTelegram,
} from '@sit/shared';
import { db, type Executor } from '../../../db/client';
import { env } from '../../../env';
import { kirimEmail, type PengaturanSmtp } from '../../../lib/email';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { logger } from '../../../lib/logger';
import { infoBot, kirimTelegram, pesanMasuk } from '../../../lib/telegram';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { ambilTeks, invalidasiKonfigurasi } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import { simpanKonfigurasi } from '../pengaturan/repo';
import * as repo from './repo';

/*
 * Saluran pesan ke atasan (K-102): Telegram (bot milik toko) dan email (SMTP). Token bot dan sandi SMTP
 * disimpan di `konfigurasi` dan TIDAK PERNAH dikembalikan API maupun ditulis ke log.
 *
 * Di luar produksi, saluran yang belum diatur tidak menggagalkan pengiriman: pesannya masuk "kotak keluar
 * uji" di memori (dan log), supaya alur persetujuan bisa dicoba tanpa bot atau akun email sungguhan. Tes
 * otomatis tidak pernah menyentuh jaringan.
 */

const KUNCI = {
  token: 'telegram_bot_token',
  host: 'smtp_host',
  port: 'smtp_port',
  pengguna: 'smtp_pengguna',
  sandi: 'smtp_sandi',
  pengirim: 'email_pengirim',
} as const;
const RAHASIA: ReadonlySet<string> = new Set([KUNCI.token, KUNCI.sandi]);

type Saluran = { telegramToken: string; smtp: PengaturanSmtp | null };

async function muatSaluran(ex: Executor = db): Promise<Saluran> {
  const t = (k: string) => ambilTeks(k, '', ex).then((v) => v.trim());
  const [token, host, port, pengguna, sandi, pengirim] = await Promise.all([
    t(KUNCI.token),
    t(KUNCI.host),
    t(KUNCI.port),
    t(KUNCI.pengguna),
    ambilTeks(KUNCI.sandi, '', ex),
    t(KUNCI.pengirim),
  ]);
  const lengkap = host !== '' && pengguna !== '' && sandi !== '';
  return {
    telegramToken: token,
    smtp: lengkap
      ? { host, port: Number(port) || 465, pengguna, sandi, pengirim: pengirim || pengguna }
      : null,
  };
}

// --- Kotak keluar uji (pengembangan dan tes) ---

export type PesanUji = { kepada: string; saluran: SaluranPesan; judul: string; isi: string };
const kotakKeluar: PesanUji[] = [];
const BATAS_KOTAK = 50;

/** Pesan terakhir (terbaru di depan). Kosong di produksi. */
export function kotakKeluarUji(): readonly PesanUji[] {
  return kotakKeluar;
}

export function kosongkanKotakKeluar(): void {
  kotakKeluar.length = 0;
}

// --- Kirim ---

export type PenerimaPesan = {
  id: number;
  namaPengguna: string;
  email: string | null;
  telegramChatId: string | null;
};

/**
 * Mengirim satu pesan ke semua saluran yang dimiliki penerima. Mengembalikan saluran yang berhasil dan
 * alasan gagal (aman ditampilkan). Tidak melempar.
 */
export async function kirimKePengguna(
  p: PenerimaPesan,
  judul: string,
  isi: string,
): Promise<HasilUjiSaluran> {
  const s = await muatSaluran();
  const sungguhan = env.NODE_ENV !== 'test';
  const simulasi = env.NODE_ENV !== 'production';
  const terkirim: SaluranPesan[] = [];
  const galat: string[] = [];
  const catat = (saluran: SaluranPesan) => {
    terkirim.push(saluran);
    if (simulasi) {
      kotakKeluar.unshift({ kepada: p.namaPengguna, saluran, judul, isi });
      kotakKeluar.length = Math.min(kotakKeluar.length, BATAS_KOTAK);
    }
  };
  const coba = async (
    saluran: SaluranPesan,
    tersedia: boolean,
    kirim: () => Promise<void>,
    belumDiatur: string,
  ) => {
    if (tersedia && sungguhan) {
      try {
        await kirim();
        catat(saluran);
      } catch (err) {
        galat.push(err instanceof Error ? err.message : 'Pengiriman gagal.');
      }
    } else if (simulasi) {
      // Saluran belum diatur (atau sedang tes): pesan hanya masuk kotak keluar uji.
      if (env.NODE_ENV === 'development') {
        logger.info({ kepada: p.namaPengguna, saluran, judul }, `Pesan (simulasi):\n${isi}`);
      }
      catat(saluran);
    } else {
      galat.push(belumDiatur);
    }
  };

  if (p.telegramChatId) {
    const chat = p.telegramChatId;
    await coba(
      'TELEGRAM',
      s.telegramToken !== '',
      () => kirimTelegram(s.telegramToken, chat, `${judul}\n\n${isi}`),
      'Bot Telegram toko belum diatur.',
    );
  }
  if (p.email) {
    const kepada = p.email;
    const smtp = s.smtp;
    await coba(
      'EMAIL',
      smtp !== null,
      () => (smtp ? kirimEmail(smtp, { kepada, judul, isi }) : Promise.resolve()),
      'Akun email toko (SMTP) belum diatur.',
    );
  }
  return { terkirim, galat };
}

/** Pengguna aktif pemegang `izin` yang punya kontak, selain `kecualiId` (pengaju sendiri). */
export async function penerimaBerizin(izin: Izin, kecualiId: number): Promise<PenerimaPesan[]> {
  return (await repo.penggunaBerkontak(db)).filter(
    (p) => p.id !== kecualiId && IZIN_PER_PERAN[p.peran].has(izin),
  );
}

// --- Pengaturan toko ---

let botTersimpan: { token: string; username: string } | null = null;

async function namaBot(token: string): Promise<string | null> {
  if (token === '') return null;
  if (botTersimpan?.token === token) return botTersimpan.username;
  if (env.NODE_ENV === 'test') return 'bot_uji';
  try {
    const b = await infoBot(token);
    botTersimpan = { token, username: b.username };
    return b.username;
  } catch {
    return null;
  }
}

export async function bacaPengaturanSaluran(): Promise<PengaturanSaluran> {
  const s = await muatSaluran();
  const [host, port, pengguna, pengirim, sandi] = await Promise.all([
    ambilTeks(KUNCI.host, ''),
    ambilTeks(KUNCI.port, ''),
    ambilTeks(KUNCI.pengguna, ''),
    ambilTeks(KUNCI.pengirim, ''),
    ambilTeks(KUNCI.sandi, ''),
  ]);
  const bot = await namaBot(s.telegramToken);
  const atasan = (await repo.penggunaBerkontak(db)).filter((p) =>
    IZIN_PER_PERAN[p.peran].has('retur.setujui'),
  );
  return {
    telegram: { terpasang: s.telegramToken !== '', bot: bot ? `@${bot}` : null },
    email: {
      terpasang: s.smtp !== null,
      host,
      port: Number(port) || 465,
      pengguna,
      pengirim,
      sandiTerisi: sandi !== '',
    },
    penerima: atasan.map((p) => ({
      nama: p.namaPengguna,
      saluran: [
        ...(p.telegramChatId && s.telegramToken !== '' ? (['TELEGRAM'] as const) : []),
        ...(p.email && s.smtp !== null ? (['EMAIL'] as const) : []),
      ],
    })),
  };
}

export async function ubahPengaturanSaluran(
  input: DataPengaturanSaluran,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<PengaturanSaluran> {
  const baru = new Map<string, string>([
    [KUNCI.host, input.smtpHost],
    [KUNCI.port, String(input.smtpPort)],
    [KUNCI.pengguna, input.smtpPengguna],
    [KUNCI.pengirim, input.emailPengirim],
  ]);
  // Rahasia: kosong = tidak diubah.
  if (input.hapusTelegram) baru.set(KUNCI.token, '');
  else if (input.telegramToken) baru.set(KUNCI.token, input.telegramToken);
  if (input.smtpSandi) baru.set(KUNCI.sandi, input.smtpSandi);

  const token = baru.get(KUNCI.token);
  if (token && env.NODE_ENV !== 'test') {
    try {
      await infoBot(token);
    } catch (err) {
      throw new AppError('VALIDASI', err instanceof Error ? err.message : 'Token ditolak.', 400, {
        kolom: { telegramToken: ['Token bot tidak dikenal Telegram.'] },
      });
    }
  }

  try {
    await dalamTransaksi(async (tx) => {
      const berubah: string[] = [];
      for (const [kode, nilai] of baru) {
        if ((await ambilTeks(kode, '', tx)) === nilai) continue;
        await simpanKonfigurasi(tx, { kode, nilai, tipe: 'TEKS' }, sekarang());
        berubah.push(kode);
      }
      if (berubah.length === 0) return;
      await catatLog(tx, {
        aksi: 'PENGATURAN_UBAH',
        idPengguna: pelaku.id,
        entitas: 'konfigurasi',
        // Nilai token dan sandi tidak pernah masuk log; nilai lain cukup nama kuncinya.
        ringkasan: `Mengubah pengaturan saluran persetujuan: ${berubah
          .map((k) => (RAHASIA.has(k) ? `${k} (rahasia)` : k))
          .join(', ')}`,
        ip: asal.ip,
      });
    });
  } finally {
    invalidasiKonfigurasi();
    botTersimpan = null;
  }
  return bacaPengaturanSaluran();
}

/** Mengirim pesan uji ke kontak pengguna itu sendiri. */
export async function ujiSaluran(pelaku: PenggunaAktif): Promise<HasilUjiSaluran> {
  const p = await repo.kontakPengguna(db, pelaku.id);
  if (!p || (!p.email && !p.telegramChatId)) {
    throw new AppError(
      'VALIDASI',
      'Akun Anda belum punya email atau Telegram. Isi dulu di menu Akun saya.',
      400,
    );
  }
  return kirimKePengguna(
    p,
    'BonsaiUrip: uji saluran persetujuan',
    `Halo ${p.namaPengguna}, pesan ini menandakan kode persetujuan akan sampai ke sini.`,
  );
}

// --- Kontak pengguna sendiri ---

export async function kontakSaya(pelaku: PenggunaAktif): Promise<KontakSaya> {
  const [p, s] = await Promise.all([repo.kontakPengguna(db, pelaku.id), muatSaluran()]);
  return {
    email: p?.email ?? null,
    telegramTerhubung: Boolean(p?.telegramChatId),
    telegramTersedia: s.telegramToken !== '',
    emailTersedia: s.smtp !== null,
  };
}

export async function ubahKontakSaya(
  input: DataKontakSaya,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<KontakSaya> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kontakPengguna(tx, pelaku.id);
    if ((lama?.email ?? null) === input.email) return;
    await repo.ubahKontak(tx, pelaku.id, { email: input.email }, sekarang());
    await catatLog(tx, {
      aksi: 'AKUN_KONTAK_UBAH',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: pelaku.id,
      ringkasan: `Mengubah email penerima kode persetujuan: ${lama?.email ?? '(kosong)'} → ${input.email ?? '(kosong)'}`,
      ip: asal.ip,
    });
  });
  return kontakSaya(pelaku);
}

/** Kode tautan Telegram yang sedang menunggu `/start <kode>` dari pemilik akun (di memori, 10 menit). */
const tautan = new Map<string, { idPengguna: number; kadaluarsa: number }>();
const UMUR_TAUTAN_MS = 10 * 60 * 1000;
let offsetTelegram = 0;

async function tokenWajib(): Promise<string> {
  const { telegramToken } = await muatSaluran();
  if (telegramToken === '') {
    throw new AppError(
      'KONFLIK',
      'Bot Telegram toko belum diatur. Minta Owner mengisinya di Pengaturan › Persetujuan.',
      409,
    );
  }
  return telegramToken;
}

export async function buatTautanTelegram(pelaku: PenggunaAktif): Promise<TautanTelegram> {
  const token = await tokenWajib();
  const bot = await namaBot(token);
  if (!bot) {
    throw new AppError('INTERNAL', 'Telegram tidak bisa dihubungi. Periksa internet server.', 503);
  }
  const kini = Date.now();
  for (const [k, v] of tautan)
    if (v.kadaluarsa < kini || v.idPengguna === pelaku.id) tautan.delete(k);
  const kode = randomBytes(5).toString('hex').toUpperCase();
  tautan.set(kode, { idPengguna: pelaku.id, kadaluarsa: kini + UMUR_TAUTAN_MS });
  return {
    bot: `@${bot}`,
    tautan: `https://t.me/${bot}?start=${kode}`,
    perintah: `/start ${kode}`,
  };
}

/**
 * Membaca pesan masuk bot dan menghubungkan chat yang mengirim `/start <kode>` milik pengguna ini. Hanya
 * pemilik akun yang login yang tahu kodenya, jadi chat orang lain tidak bisa menempel ke akun ini.
 */
export async function periksaTautanTelegram(
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<KontakSaya> {
  const token = await tokenWajib();
  let masuk;
  try {
    masuk = await pesanMasuk(token, offsetTelegram);
  } catch (err) {
    throw new AppError('INTERNAL', err instanceof Error ? err.message : 'Telegram gagal.', 503);
  }
  const kini = Date.now();
  let chatSaya: string | null = null;
  for (const m of masuk) {
    offsetTelegram = Math.max(offsetTelegram, m.idPembaruan + 1);
    const kode = /^\/start\s+([0-9A-F]{10})$/i.exec(m.teks.trim())?.[1]?.toUpperCase();
    const t = kode ? tautan.get(kode) : undefined;
    if (!kode || !t || t.kadaluarsa < kini) continue;
    tautan.delete(kode);
    // Kode milik pengguna lain yang kebetulan terbaca sekarang: langsung dihubungkan untuk pemiliknya.
    await simpanChat(t.idPengguna, m.chatId, t.idPengguna === pelaku.id ? asal : null);
    if (t.idPengguna === pelaku.id) chatSaya = m.chatId;
  }
  if (!chatSaya) {
    throw new AppError(
      'VALIDASI',
      'Pesan Start belum terbaca. Buka tautannya di Telegram, tekan Start, lalu periksa lagi.',
      400,
    );
  }
  await kirimTelegram(
    token,
    chatSaya,
    `Terhubung dengan akun ${pelaku.namaPengguna} di BonsaiUrip. Kode persetujuan akan dikirim ke sini.`,
  ).catch(() => undefined);
  return kontakSaya(pelaku);
}

async function simpanChat(idPengguna: number, chatId: string, asal: AsalRequest | null) {
  await dalamTransaksi(async (tx) => {
    await repo.ubahKontak(tx, idPengguna, { telegramChatId: chatId }, sekarang());
    await catatLog(tx, {
      aksi: 'AKUN_KONTAK_UBAH',
      idPengguna,
      entitas: 'pengguna',
      idEntitas: idPengguna,
      ringkasan: 'Menghubungkan Telegram sebagai penerima kode persetujuan',
      ip: asal?.ip ?? null,
    });
  });
}

export async function putusTelegram(pelaku: PenggunaAktif, asal: AsalRequest): Promise<KontakSaya> {
  await dalamTransaksi(async (tx) => {
    const lama = await repo.kontakPengguna(tx, pelaku.id);
    if (!lama?.telegramChatId) return;
    await repo.ubahKontak(tx, pelaku.id, { telegramChatId: null }, sekarang());
    await catatLog(tx, {
      aksi: 'AKUN_KONTAK_UBAH',
      idPengguna: pelaku.id,
      entitas: 'pengguna',
      idEntitas: pelaku.id,
      ringkasan: 'Memutus Telegram dari penerima kode persetujuan',
      ip: asal.ip,
    });
  });
  return kontakSaya(pelaku);
}
