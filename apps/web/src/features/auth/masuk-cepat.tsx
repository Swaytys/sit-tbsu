import { LABEL_PERAN, USERNAME_DEMO, type PenggunaSaya, type Peran } from '@sit/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { kunciAuth } from '@/api/auth';
import { ambilData, pesanGalat } from '@/api/client';
import { cn } from '@/lib/utils';

/*
 * Tombol "masuk cepat per peran" — HANYA mode pengembangan (CLAUDE.md § Keamanan, K-021). Komponen ini
 * hanya dirender di dalam `import.meta.env.DEV`, sehingga ikut terbuang dari build produksi; rute API
 * `/api/auth/masuk-cepat` juga tidak dipasang di produksi.
 */

const PERAN_DEMO: { peran: Peran; warna: string; ket: string }[] = [
  { peran: 'OWNER', warna: 'bg-purple-600 hover:bg-purple-700', ket: 'Akses penuh semua fitur' },
  { peran: 'ADMIN', warna: 'bg-blue-600 hover:bg-blue-700', ket: 'Kelola data & laporan' },
  { peran: 'KASIR', warna: 'bg-teal-600 hover:bg-teal-700', ket: 'Transaksi & pembayaran' },
  { peran: 'STAF_PENJUALAN', warna: 'bg-slate-600 hover:bg-slate-700', ket: 'Order & pelanggan' },
];

async function masukCepat(peran: Peran): Promise<PenggunaSaya> {
  const res = await fetch('/api/auth/masuk-cepat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ peran }),
  });
  return ambilData<PenggunaSaya>({
    ok: res.ok,
    status: res.status,
    json: () => res.json() as Promise<{ data: PenggunaSaya }>,
  });
}

export function MasukCepat({ onBerhasil }: { onBerhasil: () => void }) {
  const qc = useQueryClient();
  const [memproses, setMemproses] = useState<Peran | null>(null);

  async function masuk(peran: Peran) {
    setMemproses(peran);
    try {
      qc.setQueryData(kunciAuth.saya, await masukCepat(peran));
      onBerhasil();
    } catch (err) {
      toast.error(pesanGalat(err));
    } finally {
      setMemproses(null);
    }
  }

  return (
    <div className="border-t border-slate-100 pt-5">
      <p className="mb-3 text-center text-xs font-semibold tracking-wide text-slate-400 uppercase">
        Mode pengembangan — Masuk cepat per peran
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PERAN_DEMO.map(({ peran, warna, ket }) => (
          <button
            key={peran}
            type="button"
            onClick={() => void masuk(peran)}
            disabled={memproses !== null}
            className={cn(
              'rounded-lg p-3 text-left text-white transition-colors disabled:opacity-50',
              warna,
            )}
          >
            <div className="mb-0.5 text-xs font-bold">{LABEL_PERAN[peran]}</div>
            <div className="text-xs opacity-75">{ket}</div>
            <div className="mt-1 font-mono text-xs opacity-60">{USERNAME_DEMO[peran]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
