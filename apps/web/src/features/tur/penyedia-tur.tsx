import type { KodeTur } from '@sit/shared';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useCatatTur, usePengguna, useStatusTur } from '@/api/auth';
import { useTampilanToko } from '@/api/pengaturan';
import { Button } from '@/components/ui/button';
import { bolehAkses } from '@/lib/menu';
import { DAFTAR_TUR, TUR_PER_KODE, type Sasaran, type Tur } from './daftar-tur';
import { KonteksTur } from './konteks-tur';

/*
 * K-206: tur fitur. Sorotan (lubang terang di lapisan gelap) pada bagian layar + kartu penjelasan. Tur Pengenalan
 * mulai sendiri saat pengguna pertama kali masuk; tur per fitur ditawarkan (kartu kecil pojok kanan bawah) saat
 * halamannya dibuka pertama kali. Semua bisa dilewati dan diulang (Pengaturan › Tur & panduan).
 * Keyboard: → / Enter lanjut, ← kembali, Esc lewati. Tombol halaman (F2, Enter bayar, …) tidak ikut terpicu.
 */

function terlihat(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function cariSasaran(s: Sasaran | undefined): Element | null {
  if (!s) return null;
  if (typeof s === 'string') {
    return [...document.querySelectorAll(s)].find(terlihat) ?? null;
  }
  const teks = s.teks.toLowerCase();
  const calon = document.querySelectorAll(
    'main button, main a, main [role="tab"], main h1, main h2, main label',
  );
  return (
    [...calon].find(
      (el) => terlihat(el) && (el.textContent ?? '').trim().toLowerCase().startsWith(teks),
    ) ?? null
  );
}

export function PenyediaTur({ children }: { children: ReactNode }) {
  const pengguna = usePengguna();
  const status = useStatusTur();
  const catat = useCatatTur();
  const toko = useTampilanToko().data;
  const lokasi = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [pilihan, setPilihan] = useState<{ tur: Tur; i: number } | null>(null);
  const [ditunda, setDitunda] = useState<KodeTur[]>([]);

  const turYangBoleh = useMemo(
    () =>
      DAFTAR_TUR.filter(
        (t) =>
          bolehAkses(pengguna, t.izin) &&
          (!t.layanan || !toko || toko.layananToko.includes(t.layanan)),
      ),
    [pengguna, toko],
  );
  const sudah = useCallback(
    (k: KodeTur) =>
      status.data ? status.data.selesai.includes(k) || status.data.dilewati.includes(k) : true,
    [status.data],
  );

  const mulai = useCallback(
    (kode: KodeTur) => {
      const tur = TUR_PER_KODE[kode];
      if (lokasi.pathname !== tur.rute) void navigate(tur.rute);
      setPilihan({ tur, i: 0 });
    },
    [lokasi.pathname, navigate],
  );

  // Tur yang mulai tanpa diklik (diturunkan dari keadaan, bukan state): ?tur=KODE (mis. sesudah setup awal), atau
  // tur Pengenalan saat pertama kali masuk Dashboard. Selesai/dilewati tersimpan di server; `ditunda` menahan
  // tampil ulang selama jawaban server belum datang.
  const diminta = params.get('tur') as KodeTur | null;
  const otomatis: KodeTur | null =
    diminta && diminta in TUR_PER_KODE && !ditunda.includes(diminta)
      ? diminta
      : status.data &&
          !sudah('PENGENALAN') &&
          !ditunda.includes('PENGENALAN') &&
          lokasi.pathname === '/dashboard'
        ? 'PENGENALAN'
        : null;
  const aktif = pilihan ?? (otomatis ? { tur: TUR_PER_KODE[otomatis], i: 0 } : null);

  function akhiri(hasil: 'SELESAI' | 'DILEWATI') {
    if (!aktif) return;
    const kode = aktif.tur.kode;
    catat.mutate({ kode, hasil });
    setDitunda((d) => [...d, kode]);
    setPilihan(null);
    if (diminta) {
      const p = new URLSearchParams(params);
      p.delete('tur');
      setParams(p, { replace: true });
    }
  }

  const tawaran =
    !aktif && status.data && sudah('PENGENALAN')
      ? turYangBoleh.find(
          (t) =>
            t.rute === lokasi.pathname &&
            t.kode !== 'PENGENALAN' &&
            !sudah(t.kode) &&
            !ditunda.includes(t.kode),
        )
      : undefined;

  const nilai = useMemo(() => ({ mulai, turYangBoleh }), [mulai, turYangBoleh]);
  return (
    <KonteksTur.Provider value={nilai}>
      {children}
      {aktif && (
        <LapisanTur
          tur={aktif.tur}
          i={aktif.i}
          ke={(i) => setPilihan({ tur: aktif.tur, i })}
          akhiri={akhiri}
        />
      )}
      {tawaran && (
        <TawaranTur
          tur={tawaran}
          onMulai={() => setPilihan({ tur: tawaran, i: 0 })}
          onNanti={() => setDitunda((d) => [...d, tawaran.kode])}
          onJangan={() => catat.mutate({ kode: tawaran.kode, hasil: 'DILEWATI' })}
        />
      )}
    </KonteksTur.Provider>
  );
}

function TawaranTur({
  tur,
  onMulai,
  onNanti,
  onJangan,
}: {
  tur: Tur;
  onMulai: () => void;
  onNanti: () => void;
  onJangan: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Tawaran tur ${tur.judul}`}
      className="fixed right-4 bottom-4 z-40 w-80 rounded-lg border bg-white p-4 shadow-xl print:hidden"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Compass className="size-4 text-blue-600" /> Tur fitur: {tur.judul}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {tur.ringkas} ({tur.langkah.length} langkah, ± 1 menit)
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onMulai}>
          Mulai tur
        </Button>
        <Button size="sm" variant="outline" onClick={onNanti}>
          Nanti
        </Button>
        <Button size="sm" variant="ghost" onClick={onJangan}>
          Jangan tawarkan lagi
        </Button>
      </div>
    </div>
  );
}

type Kotak = { top: number; left: number; width: number; height: number };

const LEBAR_KARTU = 380;
const TINGGI_KARTU = 300;
const JARAK = 12;

/** Kartu di bawah sasaran; bila tidak muat: di atas, kanan, lalu kiri. Selalu di dalam layar. */
function letakKartu(k: Kotak): React.CSSProperties {
  const lebarLayar = window.innerWidth;
  const tinggiLayar = window.innerHeight;
  const jepit = (v: number, min: number, maks: number) => Math.min(Math.max(v, min), maks);
  const kiriTengah = jepit(
    k.left + k.width / 2 - LEBAR_KARTU / 2,
    JARAK,
    lebarLayar - LEBAR_KARTU - JARAK,
  );
  const atasTengah = jepit(
    k.top + k.height / 2 - TINGGI_KARTU / 2,
    JARAK,
    tinggiLayar - TINGGI_KARTU - JARAK,
  );
  if (k.top + k.height + JARAK + TINGGI_KARTU < tinggiLayar) {
    return { top: k.top + k.height + JARAK, left: kiriTengah, width: LEBAR_KARTU };
  }
  if (k.top - JARAK - TINGGI_KARTU > 0) {
    return { bottom: tinggiLayar - k.top + JARAK, left: kiriTengah, width: LEBAR_KARTU };
  }
  if (k.left + k.width + JARAK + LEBAR_KARTU < lebarLayar) {
    return { top: atasTengah, left: k.left + k.width + JARAK, width: LEBAR_KARTU };
  }
  if (k.left - JARAK - LEBAR_KARTU > 0) {
    return { top: atasTengah, left: k.left - JARAK - LEBAR_KARTU, width: LEBAR_KARTU };
  }
  return { top: '50%', left: '50%', width: 460, transform: 'translate(-50%, -50%)' };
}

function LapisanTur({
  tur,
  i,
  ke,
  akhiri,
}: {
  tur: Tur;
  i: number;
  ke: (i: number) => void;
  akhiri: (hasil: 'SELESAI' | 'DILEWATI') => void;
}) {
  const langkah = tur.langkah[i];
  const terakhir = i === tur.langkah.length - 1;
  const [kotak, setKotak] = useState<Kotak | null>(null);

  // Posisi sasaran dibaca ulang berkala (halaman bisa masih memuat, digulir, atau berubah ukuran).
  useLayoutEffect(() => {
    let pertama = true;
    function ukur() {
      const el = cariSasaran(langkah?.sasaran);
      if (!el) {
        setKotak(null);
        return;
      }
      if (pertama) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        pertama = false;
      }
      const r = el.getBoundingClientRect();
      setKotak((k) =>
        k && k.top === r.top && k.left === r.left && k.width === r.width && k.height === r.height
          ? k
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
    }
    ukur();
    const t = window.setInterval(ukur, 250);
    return () => window.clearInterval(t);
  }, [langkah]);

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      const k = e.key;
      if (!['ArrowRight', 'ArrowLeft', 'Enter', 'Escape'].includes(k)) {
        // Pintasan halaman tidak dijalankan selama tur.
        if (k.startsWith('F') && k.length <= 3) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (k === 'Escape') akhiri('DILEWATI');
      else if (k === 'ArrowLeft') {
        if (i > 0) ke(i - 1);
      } else if (terakhir) akhiri('SELESAI');
      else ke(i + 1);
    }
    window.addEventListener('keydown', tombol, true);
    return () => window.removeEventListener('keydown', tombol, true);
  }, [i, ke, akhiri, terakhir]);

  if (!langkah) return null;
  const gaya: React.CSSProperties = kotak
    ? letakKartu(kotak)
    : { top: '50%', left: '50%', width: 460, transform: 'translate(-50%, -50%)' };

  return createPortal(
    <div className="fixed inset-0 z-[100] print:hidden" aria-live="polite">
      {/* Lapisan gelap; klik di luar kartu tidak berbuat apa-apa (gunakan tombol). */}
      {kotak ? (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-blue-400 transition-all duration-150"
          style={{
            top: kotak.top - 4,
            left: kotak.left - 4,
            width: kotak.width + 8,
            height: kotak.height + 8,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/60" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tur ${tur.judul}: ${langkah.judul}`}
        className="absolute rounded-lg bg-white p-5 shadow-2xl"
        style={gaya}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            {tur.judul} · {i + 1}/{tur.langkah.length}
          </p>
          <button
            type="button"
            onClick={() => akhiri('DILEWATI')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Lewati tur (Esc)"
            title="Lewati tur (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 className="mb-2 text-base font-semibold text-slate-900">{langkah.judul}</h2>
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">
          {langkah.isi.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1">
          {tur.langkah.map((l, j) => (
            <span
              key={l.judul}
              className={`h-1.5 flex-1 rounded-full ${j <= i ? 'bg-blue-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => akhiri('DILEWATI')}>
            Lewati tur <kbd className="ml-1 text-xs text-slate-400">Esc</kbd>
          </Button>
          <span className="flex-1" />
          {i > 0 && (
            <Button size="sm" variant="outline" onClick={() => ke(i - 1)}>
              <ArrowLeft /> Kembali
            </Button>
          )}
          <Button size="sm" autoFocus onClick={() => (terakhir ? akhiri('SELESAI') : ke(i + 1))}>
            {terakhir ? 'Selesai' : 'Lanjut'} <ArrowRight />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
