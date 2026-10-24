import type { Kendaraan, TingkatPengingat } from '@sit/shared';
import { Badge } from '@/components/ui/badge';
import { formatTanggal } from '@/lib/format';
import { cn } from '@/lib/utils';

/*
 * K-162: tanda kesehatan kendaraan (odometer, servis berikutnya, STNK/KIR). Perhitungan dari API
 * (`Kendaraan.kesehatan`); komponen ini hanya menampilkan.
 */

const WARNA: Record<TingkatPengingat, string> = {
  AMAN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  SEGERA: 'border-amber-300 bg-amber-50 text-amber-800',
  LEWAT: 'border-red-300 bg-red-50 text-red-700',
};

function LencanaSurat({ nama, t }: { nama: string; t: TingkatPengingat | null }) {
  if (t === null || t === 'AMAN') return null;
  return (
    <Badge variant="outline" className={WARNA[t]}>
      {nama} {t === 'LEWAT' ? 'habis' : 'hampir habis'}
    </Badge>
  );
}

/** Sel tabel kendaraan: odometer terakhir, servis berikutnya, dan surat yang perlu diurus. */
export function SelKesehatan({ k }: { k: Kendaraan }) {
  const h = k.kesehatan;
  const s = h.servisBerikut;
  return (
    <div className="space-y-0.5 text-xs">
      <div className="text-slate-700">
        {h.odometerKm !== null
          ? `${h.odometerKm.toLocaleString('id-ID')} km (${formatTanggal(h.odometerTanggal)})`
          : 'Odometer belum dicatat'}
      </div>
      {s ? (
        <div
          className={cn(
            s.tingkat !== 'AMAN' && 'font-medium',
            s.tingkat === 'LEWAT'
              ? 'text-red-700'
              : s.tingkat === 'SEGERA'
                ? 'text-amber-800'
                : 'text-slate-500',
          )}
        >
          Servis {s.tingkat === 'LEWAT' ? 'terlewat' : 'berikutnya'}:{' '}
          {[
            s.km !== null ? `${s.km.toLocaleString('id-ID')} km` : null,
            s.tanggal ? formatTanggal(s.tanggal) : null,
          ]
            .filter(Boolean)
            .join(' / ')}
        </div>
      ) : (
        <div className="text-slate-400">
          {k.servisTiapKm || k.servisTiapBulan
            ? 'Belum ada catatan servis'
            : 'Jadwal servis belum diatur'}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <LencanaSurat nama="STNK" t={h.stnk} />
        <LencanaSurat nama="KIR" t={h.kir} />
      </div>
    </div>
  );
}
