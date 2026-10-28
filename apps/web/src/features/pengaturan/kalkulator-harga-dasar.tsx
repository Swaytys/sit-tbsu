import { formatRupiah, type DasarMarkup } from '@sit/shared';
import { Calculator } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/*
 * Kalkulator contoh untuk Pengaturan › Harga dasar: membandingkan harga jual bila dasarnya rata-rata tertimbang
 * (Average), harga beli terakhir, dan FIFO. Hanya alat bantu memahami (angka tampilan); harga sebenarnya dihitung
 * API dari ledger (docs/06 H1–H7).
 */

function angka(v: string): number {
  const n = Number(v.replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Harga jual = dasar × (1 + markup%), dibulatkan ke atas ke kelipatan pembulatan (docs/06 H4). */
function hargaJual(dasar: number, markupPersen: number, bulat: number): number {
  const mentah = Math.round((dasar * (100 + markupPersen)) / 100);
  return bulat > 1 ? Math.ceil(mentah / bulat) * bulat : mentah;
}

function Isian({
  label,
  nilai,
  onUbah,
  akhiran,
}: {
  label: string;
  nilai: string;
  onUbah: (v: string) => void;
  akhiran?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-600">
      {label}
      <div className="flex items-center gap-1">
        <Input
          className="h-8 text-right tabular-nums"
          inputMode="numeric"
          value={nilai}
          onChange={(e) => onUbah(e.target.value.replace(/\D/g, '').slice(0, 9))}
          aria-label={label}
        />
        {akhiran && <span className="shrink-0">{akhiran}</span>}
      </div>
    </label>
  );
}

export function KalkulatorHargaDasar({
  pembulatan,
  dipilih,
}: {
  pembulatan: number;
  dipilih: DasarMarkup;
}) {
  const [qLama, setQLama] = useState('20');
  const [hLama, setHLama] = useState('60000');
  const [qBaru, setQBaru] = useState('30');
  const [hBaru, setHBaru] = useState('65000');
  const [markup, setMarkup] = useState('15');

  const q1 = angka(qLama);
  const h1 = angka(hLama);
  const q2 = angka(qBaru);
  const h2 = angka(hBaru);
  const m = Math.min(angka(markup), 999);
  const rata = q1 + q2 > 0 ? Math.round((q1 * h1 + q2 * h2) / (q1 + q2)) : 0;
  const baris = [
    {
      kode: 'HPP_RATA2',
      nama: 'Rata-rata tertimbang (Average)',
      dasar: rata,
      cara: `(${q1} × ${formatRupiah(h1)} + ${q2} × ${formatRupiah(h2)}) ÷ ${q1 + q2}`,
    },
    {
      kode: 'HARGA_BELI_TERAKHIR',
      nama: 'Harga beli terakhir (Latest cost)',
      dasar: h2,
      cara: 'harga pembelian paling baru',
    },
    {
      kode: 'FIFO',
      nama: 'Stok tertua dulu (FIFO)',
      dasar: q1 > 0 ? h1 : h2,
      cara: q1 > 0 ? 'stok lama dijual dulu, jadi harga beli lama' : 'stok lama habis',
    },
  ];

  return (
    <div
      className="space-y-3 rounded-lg border bg-slate-50 p-4"
      data-testid="kalkulator-harga-dasar"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Calculator className="size-4 text-blue-600" /> Kalkulator contoh
      </h3>
      <p className="text-xs text-slate-500">
        Ubah angkanya untuk melihat bedanya. Contoh: semen di gudang 20 sak dibeli Rp 60.000, lalu
        datang 30 sak dengan harga baru Rp 65.000. Pembulatan memakai pengaturan di atas (
        {formatRupiah(pembulatan)}).
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Isian label="Stok lama (qty)" nilai={qLama} onUbah={setQLama} />
        <Isian label="Harga beli lama" nilai={hLama} onUbah={setHLama} />
        <Isian label="Pembelian baru (qty)" nilai={qBaru} onUbah={setQBaru} />
        <Isian label="Harga beli baru" nilai={hBaru} onUbah={setHBaru} />
        <Isian label="Markup tier" nilai={markup} onUbah={setMarkup} akhiran="%" />
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-1 text-left">Metode dasar</th>
            <th className="py-1 text-left">Cara hitung</th>
            <th className="py-1 text-right">Dasar</th>
            <th className="py-1 text-right">Harga jual</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {baris.map((b) => (
            <tr
              key={b.kode}
              className={cn(b.kode === dipilih && 'bg-blue-50 font-semibold text-blue-900')}
            >
              <td className="py-1.5">
                {b.nama}
                {b.kode === dipilih && <span className="ml-1 text-xs">(dipakai toko)</span>}
              </td>
              <td className="py-1.5 text-xs text-slate-600">{b.cara}</td>
              <td className="py-1.5 text-right tabular-nums">{formatRupiah(b.dasar)}</td>
              <td className="py-1.5 text-right tabular-nums">
                {formatRupiah(hargaJual(b.dasar, m, pembulatan))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
