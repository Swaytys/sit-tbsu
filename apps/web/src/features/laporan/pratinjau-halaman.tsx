import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 1 mm dalam piksel CSS (96 dpi). */
const MM = 96 / 25.4;
/** Margin cetak laporan (sama dengan @page di halaman-laporan.tsx): atas, kanan, bawah, kiri (mm). */
const MARGIN = { atas: 14, kanan: 12, bawah: 16, kiri: 12 };

function ukuranKertas(orientasi: 'potret' | 'lanskap') {
  const [w, h] = orientasi === 'lanskap' ? [297, 210] : [210, 297];
  return {
    lebar: w * MM,
    tinggi: h * MM,
    isiLebar: (w - MARGIN.kiri - MARGIN.kanan) * MM,
    isiTinggi: (h - MARGIN.atas - MARGIN.bawah) * MM,
  };
}

/**
 * Titik potong halaman: tidak memotong baris tabel atau blok di tengah. Kandidat potong = bawah setiap baris tabel
 * dan setiap blok teratas dokumen; halaman diisi sebanyak mungkin sampai tinggi isi kertas.
 */
function hitungPotongan(wadah: HTMLElement, tinggiHalaman: number): [number, number][] {
  const total = wadah.scrollHeight;
  const atas = wadah.getBoundingClientRect().top;
  const batas = [...wadah.querySelectorAll('tr, .dokumen-laporan > *, .dokumen-laporan > * > *')]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { atas: r.top - atas, bawah: r.bottom - atas };
    })
    .sort((a, b) => a.bawah - b.bawah);
  const hasil: [number, number][] = [];
  let mulai = 0;
  while (mulai < total - 1 && hasil.length < 200) {
    const maks = mulai + tinggiHalaman;
    let akhir = maks;
    if (maks < total) {
      // Bawah elemen terakhir yang masih muat dan tidak terpotong (mulai di halaman ini).
      const muat = batas.filter((b) => b.bawah <= maks && b.bawah > mulai + 1);
      const terakhir = muat.at(-1);
      if (terakhir) akhir = terakhir.bawah;
    } else {
      akhir = total;
    }
    hasil.push([mulai, akhir]);
    mulai = akhir;
  }
  return hasil.length > 0 ? hasil : [[0, total]];
}

/**
 * K-182: pratinjau laporan per lembar A4 (1, 2, 3, …) seperti pratinjau cetak. Isi diukur sekali di luar layar,
 * lalu tiap lembar menampilkan potongannya. Pembagian akhir saat dicetak bisa sedikit berbeda menurut printer.
 */
export function PratinjauHalaman({
  orientasi,
  skala,
  kaki,
  children,
}: {
  orientasi: 'potret' | 'lanskap';
  skala: number;
  /** Teks kiri kaki halaman (nama toko · judul laporan). */
  kaki: string;
  children: ReactNode;
}) {
  const ukur = useRef<HTMLDivElement>(null);
  const k = ukuranKertas(orientasi);
  const [potongan, setPotongan] = useState<[number, number][]>([]);

  useLayoutEffect(() => {
    const el = ukur.current;
    if (!el) return;
    const hitung = () => {
      const baru = hitungPotongan(el, k.isiTinggi);
      setPotongan((lama) => (JSON.stringify(lama) === JSON.stringify(baru) ? lama : baru));
    };
    hitung();
    const amati = new ResizeObserver(hitung);
    amati.observe(el);
    return () => amati.disconnect();
  }, [k.isiTinggi, children]);

  const gaya = <style>{`.pratinjau-a4 .dokumen-laporan { font-size: 9.5pt; }`}</style>;
  return (
    <div className="pratinjau-a4">
      {gaya}
      {/* Pengukur: lebar sama dengan isi kertas, tidak terlihat. */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0"
        style={{ width: k.isiLebar }}
      >
        <div ref={ukur}>{children}</div>
      </div>
      {potongan.length > 1 && (
        <nav
          className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-center gap-1 text-xs"
          aria-label="Halaman pratinjau"
        >
          <span className="text-slate-500">{potongan.length} halaman:</span>
          {potongan.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                document
                  .getElementById(`lembar-${i + 1}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="min-w-7 rounded border bg-white px-1.5 py-0.5 hover:bg-blue-50"
            >
              {i + 1}
            </button>
          ))}
        </nav>
      )}
      {/* Diperkecil dengan transform (bukan zoom) agar tata letak isi sama persis dengan pengukuran. */}
      <div className="flex flex-col items-center gap-6">
        {potongan.map(([mulai, akhir], i) => (
          <div
            key={i}
            id={`lembar-${i + 1}`}
            style={{ width: k.lebar * skala, height: k.tinggi * skala }}
          >
            <section
              className="relative origin-top-left bg-white shadow-md"
              style={{ width: k.lebar, height: k.tinggi, transform: `scale(${skala})` }}
              aria-label={`Halaman ${i + 1}`}
              data-testid="lembar-laporan"
            >
              <IsiLembar mulai={mulai} tinggi={akhir - mulai} lebar={k.isiLebar}>
                {children}
              </IsiLembar>
              <div
                className={cn(
                  'absolute flex justify-between text-[8pt] text-slate-500',
                  'border-t border-slate-200 pt-1',
                )}
                style={{
                  left: MARGIN.kiri * MM,
                  right: MARGIN.kanan * MM,
                  bottom: (MARGIN.bawah * MM) / 2,
                }}
              >
                <span className="truncate">{kaki}</span>
                <span className="shrink-0">
                  Halaman {i + 1} dari {potongan.length}
                </span>
              </div>
            </section>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Isi satu lembar. Laporan panjang (ratusan baris, puluhan lembar) membuat salinan isi per lembar sangat berat,
 * jadi isi hanya dirender saat lembar dekat layar; lembar lain tetap tampil sebagai kertas kosong seukuran aslinya.
 */
function IsiLembar({
  mulai,
  tinggi,
  lebar,
  children,
}: {
  mulai: number;
  tinggi: number;
  lebar: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dekat, setDekat] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const amati = new IntersectionObserver(([e]) => setDekat(e?.isIntersecting ?? false), {
      rootMargin: '1200px 0px',
    });
    amati.observe(el);
    return () => amati.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="absolute overflow-hidden"
      style={{ top: MARGIN.atas * MM, left: MARGIN.kiri * MM, width: lebar, height: tinggi }}
    >
      {dekat && <div style={{ transform: `translateY(${-mulai}px)` }}>{children}</div>}
    </div>
  );
}
