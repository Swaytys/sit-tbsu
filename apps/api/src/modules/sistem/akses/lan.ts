import { createHash, randomBytes, randomInt } from 'node:crypto';
import { createServer as createServerHttp, type Server } from 'node:http';
import { createServer as createServerHttps } from 'node:https';
import path from 'node:path';
import { serve, type ServerType } from '@hono/node-server';
import type { StatusLan, PerangkatLan, StatusPerangkat } from '@sit/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Hono, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { db } from '../../../db/client';
import { perangkatLan } from '../../../db/schema';
import { env } from '../../../env';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, EnvApp, PenggunaAktif } from '../../../lib/konteks';
import { logger } from '../../../lib/logger';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import { ambilTeks, invalidasiKonfigurasi } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import * as pengaturanRepo from '../pengaturan/repo';
import { alamatLokal, pastikanSertifikatLan, type BerkasLan } from './sertifikat-lan';

/*
 * K-229: mode LAN toko. Selain server utama (hanya untuk komputer ini), aplikasi melayani:
 *  - HTTPS di semua alamat WiFi/LAN (port LAN_PORT, bawaan 7443) dengan sertifikat toko;
 *  - halaman pemasangan HTTP kecil (port LAN_PORT_SIAP, bawaan 7880) yang hanya berisi petunjuk dan sertifikat CA
 *    (sertifikat publik, tidak rahasia; sidik jarinya dicocokkan pemilik dengan layar komputer server).
 * Permintaan lewat HTTPS LAN hanya dilayani untuk perangkat yang sudah disetujui Owner/Admin (kode 6 angka).
 */

export const NAMA_COOKIE_PERANGKAT = 'bu_perangkat';
const KODE_AKTIF = 'akses_lan_aktif';

const folderSertifikat = () => path.join(env.STORAGE_DIR, 'sistem', 'lan');
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

let serverHttps: ServerType | null = null;
let serverSiap: Server | null = null;
let berkas: BerkasLan | null = null;
let galatTerakhir: string | null = null;
/** Aplikasi Hono yang dilayani juga lewat HTTPS LAN (diisi saat server menyala). */
let aplikasi: Hono<EnvApp> | null = null;

/** Tanda pada `c.env` untuk permintaan yang datang lewat HTTPS LAN. */
export type BindingLan = { jalurLan?: boolean };

export function lewatLan(c: { env: unknown }): boolean {
  return (c.env as BindingLan | undefined)?.jalurLan === true;
}

async function namaToko(): Promise<string> {
  return ambilTeks('nama_toko', 'BonsaiUrip');
}

function alamatHttps(): string[] {
  return alamatLokal().map((ip) => `https://${ip}:${env.LAN_PORT}`);
}

export async function statusLan(): Promise<StatusLan> {
  const aktif = (await ambilTeks(KODE_AKTIF, '0')) === '1';
  const daftar = await db
    .select()
    .from(perangkatLan)
    .where(inArray(perangkatLan.status, ['MENUNGGU', 'DISETUJUI']))
    .orderBy(desc(perangkatLan.id));
  return {
    aktif,
    menyala: serverHttps !== null,
    alamat: alamatHttps(),
    alamatSiap: alamatLokal().map((ip) => `http://${ip}:${env.LAN_PORT_SIAP}`),
    sidikJari: berkas?.sidikJari ?? null,
    berlakuSampai: berkas?.berlakuSampai ?? null,
    galat: galatTerakhir,
    perangkat: daftar.map(keDto),
  };
}

function keDto(p: typeof perangkatLan.$inferSelect): PerangkatLan {
  return {
    id: p.id,
    kode: p.kode,
    nama: p.nama,
    status: p.status,
    ipTerakhir: p.ipTerakhir,
    dibuatPada: p.dibuatPada.toISOString(),
    terakhirDilihat: p.terakhirDilihat?.toISOString() ?? null,
  };
}

function htmlSiap(b: BerkasLan, toko: string): string {
  const ip = alamatLokal();
  const tautan = ip
    .map((a) => `<li><a href="https://${a}:${env.LAN_PORT}/">https://${a}:${env.LAN_PORT}</a></li>`)
    .join('');
  const aman = (t: string) => t.replace(/[<>&"]/g, (x) => `&#${x.charCodeAt(0)};`);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pasang BonsaiUrip di perangkat ini</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#0f172a;line-height:1.5}
h1{font-size:22px}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px;word-break:break-all}
.tombol{display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}
ol li{margin-bottom:10px}.kotak{border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:12px 0}</style></head><body>
<h1>Pasang BonsaiUrip di HP/tablet ini</h1>
<p>Toko: <b>${aman(toko)}</b>. Lakukan sekali per perangkat.</p>
<ol>
<li><a class="tombol" href="/sertifikat-toko.crt">1. Unduh sertifikat toko</a></li>
<li><b>Cocokkan sidik jari</b> di bawah ini dengan yang tampil di laptop toko (Pengaturan › Akses HP/tablet).
Bila berbeda, <b>jangan dipasang</b> dan beri tahu Owner.<div class="kotak"><code>${b.sidikJari}</code></div></li>
<li><b>Android:</b> buka berkas yang diunduh, atau Setelan › Keamanan › Enkripsi &amp; kredensial › Pasang sertifikat ›
<i>Sertifikat CA</i> › pilih berkas <code>sertifikat-toko.crt</code> › Tetap pasang.<br>
<b>iPhone/iPad:</b> izinkan unduhan profil › Setelan › Profil diunduh › Instal; lalu Setelan › Umum › Mengenai ›
Pengaturan Kepercayaan Sertifikat › nyalakan sertifikat toko.</li>
<li>Buka alamat aplikasi:<ul>${tautan}</ul> lalu menu peramban › <i>Tambahkan ke layar utama</i>.</li>
<li>Saat pertama dibuka, layar menampilkan <b>kode 6 angka</b>. Owner/Admin menyetujuinya di laptop toko
(Pengaturan › Akses HP/tablet › Perangkat).</li>
</ol></body></html>`;
}

/** Menyalakan server LAN (dipanggil saat server menyala bila mode LAN aktif, dan dari Pengaturan). */
export async function nyalakanLan(app: Hono<EnvApp>): Promise<void> {
  if (serverHttps) return;
  try {
    berkas = pastikanSertifikatLan(folderSertifikat(), await namaToko());
    const b = berkas;
    serverHttps = serve({
      fetch: (req, e) => app.fetch(req, { ...(e as object), jalurLan: true }),
      port: env.LAN_PORT,
      hostname: '0.0.0.0',
      createServer: createServerHttps,
      serverOptions: { key: b.key, cert: b.cert },
    });
    // Port dipakai program lain / ditolak Windows: dicatat sebagai galat, aplikasi utama tetap jalan.
    serverHttps.on('error', (err: Error) => gagalDengar(err, env.LAN_PORT));
    const toko = await namaToko();
    serverSiap = createServerHttp((req, res) => {
      if (req.url === '/sertifikat-toko.crt') {
        res.writeHead(200, {
          'Content-Type': 'application/x-x509-ca-cert',
          'Content-Disposition': 'attachment; filename="sertifikat-toko.crt"',
        });
        res.end(b.caPem);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlSiap(b, toko));
    });
    serverSiap.on('error', (err: Error) => gagalDengar(err, env.LAN_PORT_SIAP));
    serverSiap.listen(env.LAN_PORT_SIAP, '0.0.0.0');
    galatTerakhir = null;
    logger.info({ alamat: alamatHttps() }, 'Mode LAN toko menyala');
  } catch (err) {
    galatTerakhir = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, 'Mode LAN toko gagal menyala');
    await matikanServerLan();
  }
}

function gagalDengar(err: Error, port: number): void {
  galatTerakhir =
    'code' in err && err.code === 'EADDRINUSE'
      ? `Port ${port} sedang dipakai program lain. Tutup program itu atau ubah LAN_PORT.`
      : `Server LAN gagal: ${err.message}`;
  logger.warn({ err }, 'Mode LAN toko gagal mendengar');
  void matikanServerLan();
}

async function matikanServerLan(): Promise<void> {
  const s = serverHttps;
  serverHttps = null;
  if (s) await new Promise<void>((r) => s.close(() => r())).catch(() => undefined);
  const t = serverSiap;
  serverSiap = null;
  if (t) await new Promise<void>((r) => t.close(() => r()));
}

/** Saat server menyala: nyalakan bila Owner pernah mengaktifkannya. Tidak pernah melempar. */
export async function nyalakanLanBilaAktif(app: Hono<EnvApp>): Promise<void> {
  aplikasi = app;
  try {
    if ((await ambilTeks(KODE_AKTIF, '0')) === '1') await nyalakanLan(app);
  } catch (err) {
    logger.warn({ err }, 'Mode LAN toko tidak bisa diperiksa');
  }
}

export async function aturLan(
  aktif: boolean,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<StatusLan> {
  await dalamTransaksi((tx) =>
    pengaturanRepo.simpanKonfigurasi(
      tx,
      { kode: KODE_AKTIF, nilai: aktif ? '1' : '0', tipe: 'TEKS' },
      sekarang(),
    ),
  );
  invalidasiKonfigurasi();
  if (aktif) {
    if (!aplikasi) throw new AppError('STATUS_TIDAK_VALID', 'Server belum siap. Coba lagi.', 409);
    await nyalakanLan(aplikasi);
  } else await matikanServerLan();
  await catatLog(db, {
    aksi: 'PENGATURAN_UBAH',
    idPengguna: pelaku.id,
    entitas: 'konfigurasi',
    ringkasan: aktif ? 'Mode LAN toko dinyalakan' : 'Mode LAN toko dimatikan',
    ip: asal.ip,
  });
  return statusLan();
}

/** Ringkasan nama perangkat dari user agent (mis. "Android · Chrome"). */
function namaPerangkat(ua: string): string {
  const os = /iPad/.test(ua)
    ? 'iPad'
    : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac/.test(ua)
            ? 'Mac'
            : 'Perangkat';
  const peramban = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : 'peramban';
  return `${os} · ${peramban}`;
}

async function perangkatDariCookie(token: string | undefined) {
  if (!token) return null;
  const [p] = await db
    .select()
    .from(perangkatLan)
    .where(eq(perangkatLan.tokenHash, hashToken(token)))
    .orderBy(desc(perangkatLan.id))
    .limit(1);
  return p ?? null;
}

/** Perangkat di LAN meminta didaftarkan (atau membaca status pendaftarannya). */
export async function daftarPerangkat(
  token: string | undefined,
  asal: AsalRequest,
): Promise<{ token: string | null; status: StatusPerangkat; kode: string }> {
  const ada = await perangkatDariCookie(token);
  if (ada && ada.status !== 'DITOLAK' && ada.status !== 'DICABUT') {
    return { token: null, status: ada.status as StatusPerangkat, kode: ada.kode };
  }
  const baru = randomBytes(32).toString('base64url');
  const kode = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const ua = asal.userAgent ?? '';
  await db.insert(perangkatLan).values({
    tokenHash: hashToken(baru),
    kode,
    nama: namaPerangkat(ua),
    userAgent: ua.slice(0, 300) || null,
    ipTerakhir: asal.ip,
    terakhirDilihat: sekarang(),
  });
  return { token: baru, status: 'MENUNGGU', kode };
}

export async function statusPerangkatSaya(
  token: string | undefined,
): Promise<{ status: StatusPerangkat | 'BELUM_TERDAFTAR'; kode: string | null }> {
  const p = await perangkatDariCookie(token);
  return p ? { status: p.status, kode: p.kode } : { status: 'BELUM_TERDAFTAR', kode: null };
}

export async function putuskanPerangkat(
  id: number,
  status: 'DISETUJUI' | 'DITOLAK' | 'DICABUT',
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<StatusLan> {
  const [p] = await db.select().from(perangkatLan).where(eq(perangkatLan.id, id));
  if (!p) throw new AppError('TIDAK_DITEMUKAN', 'Perangkat tidak ditemukan.', 404);
  const boleh = status === 'DICABUT' ? p.status === 'DISETUJUI' : p.status === 'MENUNGGU';
  if (!boleh) {
    throw new AppError('STATUS_TIDAK_VALID', `Perangkat ini sudah ${p.status.toLowerCase()}.`, 409);
  }
  await db
    .update(perangkatLan)
    .set({ status, diputuskanOleh: pelaku.id, diputuskanPada: sekarang() })
    .where(and(eq(perangkatLan.id, id), eq(perangkatLan.status, p.status)));
  await catatLog(db, {
    aksi: 'PENGATURAN_UBAH',
    idPengguna: pelaku.id,
    entitas: 'perangkat_lan',
    idEntitas: id,
    ringkasan: `Perangkat LAN ${p.nama} (kode ${p.kode}) ${status === 'DISETUJUI' ? 'disetujui' : status === 'DITOLAK' ? 'ditolak' : 'dicabut'}`,
    ip: asal.ip,
  });
  return statusLan();
}

export function pasangCookiePerangkat(c: Parameters<typeof setCookie>[0], token: string): void {
  setCookie(c, NAMA_COOKIE_PERANGKAT, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    // Batas peramban dan Hono: paling lama 400 hari; diperpanjang setiap kali perangkat terlihat.
    maxAge: 400 * 86_400,
  });
}

/** Rute yang tetap terbuka bagi perangkat LAN yang belum disetujui. */
const BEBAS = ['/api/health', '/api/perangkat/daftar', '/api/perangkat/status'];

/**
 * Penjaga: permintaan API lewat HTTPS LAN hanya untuk perangkat yang disetujui. Halaman web (berkas statis) tetap
 * dilayani agar perangkat bisa menampilkan kode pendaftarannya.
 */
export const jagaPerangkatLan: MiddlewareHandler<EnvApp> = async (c, next) => {
  if (!lewatLan(c) || BEBAS.includes(c.req.path)) return next();
  const p = await perangkatDariCookie(getCookie(c, NAMA_COOKIE_PERANGKAT));
  if (p?.status !== 'DISETUJUI') {
    return c.json(
      {
        error: {
          kode: 'PERANGKAT_BELUM_DISETUJUI',
          pesan: 'Perangkat ini belum disetujui Owner/Admin untuk membuka BonsaiUrip.',
        },
      },
      403,
    );
  }
  if (!p.terakhirDilihat || Date.now() - p.terakhirDilihat.getTime() > 5 * 60_000) {
    const token = getCookie(c, NAMA_COOKIE_PERANGKAT);
    if (token) pasangCookiePerangkat(c, token);
    await db
      .update(perangkatLan)
      .set({ terakhirDilihat: sekarang(), ipTerakhir: c.var.asal?.ip ?? p.ipTerakhir })
      .where(eq(perangkatLan.id, p.id));
  }
  return next();
};
