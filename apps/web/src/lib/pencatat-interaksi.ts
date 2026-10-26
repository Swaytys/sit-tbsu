import {
  BATAS_KIRIM_INTERAKSI,
  type JenisInteraksi,
  type KejadianInteraksi,
  type TingkatLogInteraksi,
} from '@sit/shared';
import { toast } from 'sonner';

/*
 * K-190: pencatat interaksi untuk penelitian (aktif hanya bila Owner menyalakannya). Yang dicatat: halaman dan lamanya,
 * elemen yang diklik (labelnya saja), tombol pintasan, dialog dibuka/ditutup, pencarian (jumlah hasil; kata hanya
 * untuk pencarian barang), dan pesan galat yang tampil. Isi kotak isian, password, dan nominal TIDAK pernah dibaca.
 * Kejadian dikumpulkan lalu dikirim berkelompok (tiap 15 detik, 50 kejadian, atau saat tab ditutup/disembunyikan).
 */

const SEL_BERMAKNA = 'button, a[href], [role="menuitem"]';
const SEL_SEMUA = `${SEL_BERMAKNA}, [role="tab"], [role="option"], [role="radio"], [role="checkbox"], [role="switch"], summary, select, input[type="checkbox"], input[type="radio"], label`;
const JEDA_KIRIM_MS = 15_000;

let aktif = false;
let tingkat: TingkatLogInteraksi = 'SEMUA';
const antre: KejadianInteraksi[] = [];
let pewaktu: number | undefined;
const idSesi = buatIdSesi();
const lepas: (() => void)[] = [];
const cariTerakhir = new Map<string, number>();

function buatIdSesi(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const rapikan = (t: string | null | undefined, maks: number) => {
  const r = (t ?? '').replace(/\s+/g, ' ').trim();
  return r ? r.slice(0, maks) : null;
};

export function catatInteraksi(
  jenis: JenisInteraksi,
  data: {
    elemen?: string | null;
    keterangan?: string | null;
    angka?: number | null;
    halaman?: string;
  } = {},
): void {
  if (!aktif) return;
  antre.push({
    waktu: new Date().toISOString(),
    jenis,
    halaman: (data.halaman ?? location.pathname).slice(0, 120),
    elemen: rapikan(data.elemen, 150),
    keterangan: rapikan(data.keterangan, 255),
    angka:
      data.angka === undefined || data.angka === null
        ? null
        : Math.max(0, Math.min(2_000_000_000, Math.round(data.angka))),
  });
  if (antre.length >= 50) void kirimAntrean();
}

export async function kirimAntrean(keepalive = false): Promise<void> {
  while (antre.length > 0) {
    const isi = antre.splice(0, BATAS_KIRIM_INTERAKSI);
    try {
      await asliFetch('/api/log-interaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive,
        body: JSON.stringify({ idSesiKlien: idSesi, kejadian: isi }),
      });
    } catch {
      // Jaringan putus: kejadian penelitian ini dilepas (tidak mengganggu pekerjaan kasir).
      return;
    }
  }
}

/** Nama elemen untuk log: label aksesibilitas/judul/teks tampilan; isi kotak isian tidak pernah dibaca. */
function namaElemen(el: Element): string | null {
  const aria = el.getAttribute('aria-label') ?? el.getAttribute('title');
  if (aria) return aria;
  if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
    return el.labels?.[0]?.innerText ?? el.name ?? null;
  }
  return el instanceof HTMLElement ? el.innerText : el.textContent;
}

function diKotakIsian(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

function padaKlik(e: MouseEvent): void {
  if (!(e.target instanceof Element)) return;
  const el = e.target.closest(tingkat === 'SEMUA' ? SEL_SEMUA : SEL_BERMAKNA);
  if (!el) return;
  const peran = el.getAttribute('role');
  catatInteraksi('KLIK', {
    elemen: namaElemen(el),
    keterangan: `${el.tagName.toLowerCase()}${peran ? `[${peran}]` : ''}`,
  });
}

const TOMBOL_KHUSUS = new Set(['Escape', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown']);

/** Pintasan saja: F1–F12, Ctrl/Alt + tombol, Escape, dan huruf tunggal di luar kotak isian (mis. R, S, P). */
function padaTombol(e: KeyboardEvent): void {
  if (e.repeat || ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
  const fungsi = /^F\d{1,2}$/.test(e.key);
  const kombinasi = e.ctrlKey || e.altKey || e.metaKey;
  const isian = diKotakIsian(e.target);
  let nama: string | null = null;
  if (fungsi || kombinasi || TOMBOL_KHUSUS.has(e.key))
    nama = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  else if (!isian && /^[a-z]$/i.test(e.key)) nama = e.key.toUpperCase();
  else if (!isian && e.key === ' ') nama = 'Spasi';
  if (!nama) return;
  const awalan = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.metaKey ? 'Meta+' : ''}`;
  // Nama elemen hanya bila fokus ada di elemen yang bisa dipakai (bukan wadah halaman).
  const fokus =
    e.target instanceof Element ? e.target.closest(`${SEL_SEMUA}, input, textarea`) : null;
  catatInteraksi('TOMBOL', {
    elemen: fokus ? namaElemen(fokus)?.slice(0, 60) : null,
    keterangan: `${awalan}${nama}${isian ? ' (di kotak isian)' : ''}`,
  });
}

// --- Dialog: portal Radix menjadi anak langsung <body>. ---
const dialogTerbuka = new Map<Element, { judul: string | null; mulai: number }>();

function judulDialog(d: Element): string | null {
  const id = d.getAttribute('aria-labelledby');
  const judul = id ? document.getElementById(id) : d.querySelector('h2');
  return judul?.textContent ?? d.getAttribute('aria-label');
}

function amatiDialog(): () => void {
  const pengamat = new MutationObserver((daftar) => {
    for (const m of daftar) {
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        const pilih = '[role="dialog"], [role="alertdialog"]';
        for (const d of [...(n.matches(pilih) ? [n] : []), ...n.querySelectorAll(pilih)]) {
          const judul = judulDialog(d);
          dialogTerbuka.set(d, { judul, mulai: performance.now() });
          catatInteraksi('DIALOG', { elemen: judul, keterangan: 'buka' });
        }
      }
    }
    for (const [d, info] of dialogTerbuka) {
      if (!d.isConnected) {
        dialogTerbuka.delete(d);
        catatInteraksi('DIALOG', {
          elemen: info.judul,
          keterangan: 'tutup',
          angka: performance.now() - info.mulai,
        });
      }
    }
  });
  pengamat.observe(document.body, { childList: true });
  return () => pengamat.disconnect();
}

// --- Pencarian: dibaca dari permintaan GET ber-`cari`/`q` ke API, beserta jumlah hasilnya. ---
const asliFetch: typeof fetch = window.fetch.bind(window);

function jumlahHasil(isi: unknown): number | null {
  if (typeof isi !== 'object' || isi === null) return null;
  const o = isi as { data?: unknown; meta?: { total?: unknown } };
  if (typeof o.meta?.total === 'number') return o.meta.total;
  return Array.isArray(o.data) ? o.data.length : null;
}

const fetchTercatat: typeof fetch = async (masukan, opsi) => {
  const res = await asliFetch(masukan, opsi);
  try {
    const metode = (
      opsi?.method ?? (masukan instanceof Request ? masukan.method : 'GET')
    ).toUpperCase();
    const url = new URL(
      masukan instanceof Request ? masukan.url : String(masukan),
      location.origin,
    );
    const kata = (url.searchParams.get('cari') ?? url.searchParams.get('q') ?? '').trim();
    if (metode === 'GET' && kata && url.pathname.startsWith('/api/') && res.ok) {
      const kunci = `${url.pathname}|${kata}`;
      const lalu = cariTerakhir.get(kunci) ?? 0;
      if (Date.now() - lalu > 30_000) {
        cariTerakhir.set(kunci, Date.now());
        const isi: unknown = await res.clone().json();
        // Kata dicatat hanya untuk pencarian barang (nama barang bukan data pribadi).
        const bolehKata = url.pathname.startsWith('/api/barang');
        catatInteraksi('CARI', {
          elemen: url.pathname,
          keterangan: bolehKata ? kata : `${kata.length} huruf`,
          angka: jumlahHasil(isi),
        });
      }
    }
  } catch {
    // Bukan JSON atau URL aneh: pencarian tidak dicatat.
  }
  return res;
};

// --- Galat yang tampil ke pengguna (toast) dan galat skrip. ---
function pasangGalat(): () => void {
  const asliError = toast.error;
  toast.error = ((pesan, data) => {
    catatInteraksi('GALAT', { keterangan: typeof pesan === 'string' ? pesan : 'galat' });
    return asliError(pesan, data);
  }) as typeof toast.error;
  const padaError = (e: ErrorEvent) =>
    catatInteraksi('GALAT', { elemen: 'skrip', keterangan: e.message });
  const padaTolak = (e: PromiseRejectionEvent) =>
    catatInteraksi('GALAT', {
      elemen: 'skrip',
      keterangan: e.reason instanceof Error ? e.reason.message : 'promise ditolak',
    });
  window.addEventListener('error', padaError);
  window.addEventListener('unhandledrejection', padaTolak);
  return () => {
    toast.error = asliError;
    window.removeEventListener('error', padaError);
    window.removeEventListener('unhandledrejection', padaTolak);
  };
}

function padaSembunyi(): void {
  if (document.visibilityState === 'hidden') void kirimAntrean(true);
}

export function mulaiPencatat(t: TingkatLogInteraksi): void {
  tingkat = t;
  if (aktif) return;
  aktif = true;
  document.addEventListener('click', padaKlik, true);
  document.addEventListener('keydown', padaTombol, true);
  document.addEventListener('visibilitychange', padaSembunyi);
  window.addEventListener('pagehide', padaSembunyi);
  window.fetch = fetchTercatat;
  lepas.push(amatiDialog(), pasangGalat());
  pewaktu = window.setInterval(() => void kirimAntrean(), JEDA_KIRIM_MS);
}

export function hentikanPencatat(): void {
  if (!aktif) return;
  void kirimAntrean();
  aktif = false;
  document.removeEventListener('click', padaKlik, true);
  document.removeEventListener('keydown', padaTombol, true);
  document.removeEventListener('visibilitychange', padaSembunyi);
  window.removeEventListener('pagehide', padaSembunyi);
  window.fetch = asliFetch;
  for (const f of lepas.splice(0)) f();
  window.clearInterval(pewaktu);
  dialogTerbuka.clear();
}
