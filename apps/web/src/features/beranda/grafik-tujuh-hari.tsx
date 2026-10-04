import { formatRupiah, nomorHari, teksTanggalAngka } from '@sit/shared';
import { useState } from 'react';

/*
 * Grafik kolom penjualan bersih 7 hari (docs/05 ST3). SVG tanpa pustaka tambahan: satu seri satu warna
 * (biru aksen), kolom ≤ 24px dengan ujung membulat 4px dan pangkal rata, grid tipis, label nilai hanya
 * pada hari ini, tooltip per kolom (hover & fokus keyboard), dan tabel tersembunyi untuk pembaca layar.
 */

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function namaHari(tanggal: string) {
  // 1970-01-01 jatuh pada Kamis (indeks 4).
  return HARI[(((nomorHari(tanggal) + 4) % 7) + 7) % 7]!;
}

/** Batas atas sumbu yang "bulat": 1, 2, 2,5 atau 5 × 10^k. */
function batasBulat(maks: number): number {
  if (maks <= 0) return 1_000_000;
  const pangkat = 10 ** Math.floor(Math.log10(maks));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * pangkat >= maks) return f * pangkat;
  return 10 * pangkat;
}

/** 1.500.000 → "1,5 jt"; 750.000 → "750 rb". */
function ringkas(n: number): string {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString('id-ID')} rb`;
  return n.toLocaleString('id-ID');
}

const L = 640;
const T = 230;
const KIRI = 52;
const BAWAH = 36;
const ATAS = 22;

export function GrafikTujuhHari({ data }: { data: { tanggal: string; nilai: number }[] }) {
  const [sorot, setSorot] = useState<number | null>(null);
  const maks = batasBulat(Math.max(...data.map((d) => d.nilai), 0));
  const tinggiPlot = T - ATAS - BAWAH;
  const pita = (L - KIRI) / Math.max(1, data.length);
  const lebar = Math.min(24, pita * 0.5);
  const y = (v: number) => ATAS + tinggiPlot - (Math.max(0, v) / maks) * tinggiPlot;
  const garis = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maks);
  const aktif = sorot === null ? null : data[sorot];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${L} ${T}`}
        className="h-auto w-full"
        role="img"
        aria-label="Grafik penjualan bersih 7 hari terakhir"
      >
        {garis.map((g) => (
          <g key={g}>
            <line x1={KIRI} x2={L} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeWidth={1} />
            <text
              x={KIRI - 8}
              y={y(g) + 4}
              textAnchor="end"
              className="fill-slate-500 text-[11px] tabular-nums"
            >
              {g === 0 ? '0' : ringkas(g)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = KIRI + pita * i + pita / 2;
          const atas = y(d.nilai);
          const tinggi = ATAS + tinggiPlot - atas;
          const r = Math.min(4, tinggi);
          const x0 = cx - lebar / 2;
          const dasar = ATAS + tinggiPlot;
          const terakhir = i === data.length - 1;
          return (
            <g key={d.tanggal}>
              {tinggi > 0 && (
                <path
                  d={`M${x0},${dasar} V${atas + r} Q${x0},${atas} ${x0 + r},${atas} H${x0 + lebar - r} Q${x0 + lebar},${atas} ${x0 + lebar},${atas + r} V${dasar} Z`}
                  fill="#2563eb"
                  opacity={sorot === null || sorot === i ? 1 : 0.55}
                />
              )}
              {terakhir && d.nilai > 0 && (
                <text
                  x={cx}
                  y={atas - 6}
                  textAnchor="middle"
                  className="fill-slate-700 text-[11px] font-semibold"
                >
                  {ringkas(d.nilai)}
                </text>
              )}
              <text
                x={cx}
                y={T - BAWAH + 16}
                textAnchor="middle"
                className="fill-slate-600 text-[11px]"
              >
                {terakhir ? 'Hari ini' : namaHari(d.tanggal)}
              </text>
              <text
                x={cx}
                y={T - BAWAH + 29}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {teksTanggalAngka(d.tanggal).slice(0, 5)}
              </text>
              {/* Area sentuh selebar pita, lebih besar dari kolomnya. */}
              <rect
                x={KIRI + pita * i}
                y={ATAS}
                width={pita}
                height={tinggiPlot}
                fill="transparent"
                tabIndex={0}
                aria-label={`${namaHari(d.tanggal)} ${teksTanggalAngka(d.tanggal)}: ${formatRupiah(d.nilai)}`}
                onPointerEnter={() => setSorot(i)}
                onPointerLeave={() => setSorot(null)}
                onFocus={() => setSorot(i)}
                onBlur={() => setSorot(null)}
                className="cursor-default outline-none focus-visible:stroke-blue-600"
              />
            </g>
          );
        })}
        <line x1={KIRI} x2={L} y1={ATAS + tinggiPlot} y2={ATAS + tinggiPlot} stroke="#94a3b8" />
      </svg>
      {aktif && sorot !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${((KIRI + pita * sorot + pita / 2) / L) * 100}%`,
            top: `${(Math.max(ATAS, y(aktif.nilai) - 44) / T) * 100}%`,
          }}
          role="status"
        >
          <div className="font-semibold text-slate-900 tabular-nums">
            {formatRupiah(aktif.nilai)}
          </div>
          <div className="text-slate-500">
            {namaHari(aktif.tanggal)}, {teksTanggalAngka(aktif.tanggal)}
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>Penjualan bersih 7 hari terakhir</caption>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Penjualan bersih</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.tanggal}>
              <td>{teksTanggalAngka(d.tanggal)}</td>
              <td>{formatRupiah(d.nilai)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
