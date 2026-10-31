import { existsSync } from 'node:fs';
import path from 'node:path';
import type { StatusAksesPerangkat } from '@sit/shared';
import { env } from '../../../env';
import { logger } from '../../../lib/logger';
import { jalankan } from '../cadangan/alat';

/*
 * K-217: HP/tablet membuka BonsaiUrip lewat Tailscale HTTPS. `tailscale serve` (di laptop) meneruskan
 * https://<nama>.ts.net ke server ini; sertifikatnya sah sehingga cookie aman dan PWA berfungsi. Modul ini mencari
 * program Tailscale, membaca statusnya, menyalakan serve, dan mendaftarkan alamat itu sebagai origin yang sah (CSRF).
 */

let originDinamis = new Set<string>();
let terakhir: StatusAksesPerangkat | null = null;

/** Origin tambahan yang sah (alamat Tailscale laptop ini). */
export function originAksesPerangkat(): ReadonlySet<string> {
  return originDinamis;
}

function programTailscale(): string | null {
  const calon = [
    env.TAILSCALE_CLI,
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Tailscale', 'tailscale.exe'),
  ].filter((p): p is string => Boolean(p));
  for (const p of calon) if (existsSync(p)) return p;
  return null;
}

type StatusJson = {
  BackendState?: string;
  Self?: { DNSName?: string; Online?: boolean };
  CertDomains?: string[] | null;
};

function kosong(pesan: string, terpasang: boolean): StatusAksesPerangkat {
  return {
    tailscaleTerpasang: terpasang,
    tersambung: false,
    alamat: null,
    serveAktif: false,
    httpsAktif: false,
    pesan,
    diperiksa: new Date().toISOString(),
  };
}

/** Membaca status Tailscale dan (bila `nyalakan`) menyalakan serve ke port aplikasi. */
export async function periksaAksesPerangkat(nyalakan: boolean): Promise<StatusAksesPerangkat> {
  const cli = programTailscale();
  if (!cli) {
    terakhir = kosong('Tailscale belum terpasang di laptop ini.', false);
    return terakhir;
  }
  const st = await jalankan(cli, ['status', '--json'], { batasMs: 15_000 });
  let json: StatusJson = {};
  try {
    json = JSON.parse(st.keluaran) as StatusJson;
  } catch {
    // Keluaran bukan JSON: Tailscale belum menyala.
  }
  if (json.BackendState !== 'Running') {
    terakhir = kosong(
      json.BackendState === 'NeedsLogin'
        ? 'Tailscale terpasang tetapi belum masuk (login). Buka Tailscale di laptop lalu masuk.'
        : 'Tailscale terpasang tetapi belum menyala. Buka aplikasi Tailscale di laptop.',
      true,
    );
    return terakhir;
  }
  const nama = (json.Self?.DNSName ?? '').replace(/\.$/, '');
  const alamat = nama ? `https://${nama}` : null;
  const httpsAktif = (json.CertDomains ?? []).length > 0;
  let serveAktif = false;
  let pesan = '';
  if (!httpsAktif) {
    pesan =
      'Sertifikat HTTPS Tailscale belum diaktifkan. Di login.tailscale.com › DNS: aktifkan MagicDNS dan HTTPS Certificates.';
  } else {
    if (nyalakan) {
      const s = await jalankan(
        cli,
        ['serve', '--bg', '--https=443', `http://127.0.0.1:${env.PORT}`],
        { batasMs: 60_000 },
      );
      if (s.kode !== 0) {
        logger.warn({ keluaran: s.galat || s.keluaran }, 'tailscale serve gagal');
        pesan = `Tailscale serve belum bisa dinyalakan: ${(s.galat || s.keluaran).trim().slice(0, 300)}`;
      }
    }
    const ss = await jalankan(cli, ['serve', 'status', '--json'], { batasMs: 15_000 });
    serveAktif = ss.kode === 0 && ss.keluaran.includes(`127.0.0.1:${env.PORT}`);
    if (serveAktif) pesan = 'HP/tablet bisa membuka alamat di bawah.';
    else if (!pesan) pesan = 'Tailscale serve belum aktif. Tekan Aktifkan.';
  }
  originDinamis = new Set(alamat ? [alamat] : []);
  terakhir = {
    tailscaleTerpasang: true,
    tersambung: true,
    alamat,
    serveAktif,
    httpsAktif,
    pesan,
    diperiksa: new Date().toISOString(),
  };
  return terakhir;
}

export async function statusAksesPerangkat(): Promise<StatusAksesPerangkat> {
  return terakhir ?? periksaAksesPerangkat(false);
}

/** Dipanggil saat server menyala pada pemasangan desktop (AKSES_TAILSCALE=1). Tidak pernah melempar. */
export async function nyalakanAksesPerangkat(): Promise<void> {
  if (!env.AKSES_TAILSCALE) return;
  try {
    const s = await periksaAksesPerangkat(true);
    logger.info({ alamat: s.alamat, serveAktif: s.serveAktif }, 'Akses HP/tablet (Tailscale)');
  } catch (err) {
    logger.warn({ err }, 'Akses HP/tablet: Tailscale tidak bisa diperiksa');
  }
}
