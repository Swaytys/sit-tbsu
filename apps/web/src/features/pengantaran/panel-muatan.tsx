import type { Muatan, TingkatMuatan } from '@sit/shared';
import { cn } from '@/lib/utils';

/* K-161: ringkasan muatan rit (docs/13 §3) di dialog Berangkat. Angka dan tingkat dari API. */

const WARNA: Record<TingkatMuatan, string> = {
  AMAN: 'bg-emerald-500',
  HAMPIR_PENUH: 'bg-amber-500',
  KONFIRMASI: 'bg-orange-500',
  DITOLAK: 'bg-red-600',
  TIDAK_DIKETAHUI: 'bg-slate-300',
};

const LABEL: Record<TingkatMuatan, string> = {
  AMAN: 'aman',
  HAMPIR_PENUH: 'hampir penuh',
  KONFIRMASI: 'perlu alasan',
  DITOLAK: 'ditolak',
  TIDAK_DIKETAHUI: 'data belum lengkap',
};

function Bar({
  judul,
  persen,
  tingkat,
  rinci,
}: {
  judul: string;
  persen: number | null;
  tingkat: TingkatMuatan;
  rinci: string;
}) {
  return (
    <div className="space-y-0.5" data-testid={`muatan-${judul.toLowerCase()}`}>
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-700">
          {judul} <span className="text-slate-500">· {rinci}</span>
        </span>
        <span className={cn(tingkat === 'DITOLAK' && 'font-semibold text-red-700')}>
          {persen === null ? '—' : `${persen.toLocaleString('id-ID')}%`} {LABEL[tingkat]}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full', WARNA[tingkat])}
          style={{ width: `${Math.min(100, persen ?? 0)}%` }}
        />
      </div>
    </div>
  );
}

export function PanelMuatan({ m }: { m: Muatan }) {
  return (
    <div className="space-y-2 rounded-md border bg-slate-50 p-3" data-testid="panel-muatan">
      <Bar
        judul="Berat"
        persen={m.persenBerat}
        tingkat={m.tingkat.berat}
        rinci={`${Number(m.beratKg).toLocaleString('id-ID')} kg dari ${
          m.dayaAngkutKg ? `${m.dayaAngkutKg.toLocaleString('id-ID')} kg` : '?'
        }`}
      />
      <Bar
        judul="Volume"
        persen={m.persenVolume}
        tingkat={m.tingkat.volume}
        rinci={`${m.volumeM3.replace('.', ',')} m³ dari ${m.volumeBakM3?.replace('.', ',') ?? '?'} m³ (isi ${m.faktorIsiPersen}%)`}
      />
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-700">
          Barang terpanjang ·{' '}
          <span className="text-slate-500">
            {m.terpanjangCm ? `${m.terpanjangCm} cm` : '—'} / bak{' '}
            {m.panjangBakCm ? `${m.panjangBakCm} cm` : '?'}
          </span>
        </span>
        <span className={cn(m.tingkat.panjang === 'DITOLAK' && 'font-semibold text-red-700')}>
          {LABEL[m.tingkat.panjang]}
        </span>
      </div>
      {m.pesan.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
          {m.pesan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {m.saran.map((s) => (
        <p key={s} className="text-xs text-blue-800">
          Saran: {s}
        </p>
      ))}
    </div>
  );
}
