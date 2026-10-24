import { formatNoHp, type DataMirip } from '@sit/shared';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * K-137: data yang sudah ada dan mirip dengan isian. Pengguna memilih: buka/pakai data yang ada (`onPakai`), atau
 * menegaskan ini data berbeda lalu menyimpan (`onTetapSimpan`, mengirim `abaikanMirip`).
 */
export function PanelMirip({
  mirip,
  apa,
  onPakai,
  onTetapSimpan,
  menyimpan,
}: {
  mirip: DataMirip[];
  apa: string;
  onPakai?: (m: DataMirip) => void;
  onTetapSimpan: () => void;
  menyimpan?: boolean;
}) {
  return (
    <div
      className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      role="alert"
      data-testid="panel-mirip"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="size-4" /> {apa} yang mirip sudah ada. Pastikan tidak dobel:
      </p>
      <ul className="space-y-1">
        {mirip.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{m.kode}</span>
            <span className="font-medium">{m.nama}</span>
            {m.noHp && <span className="text-xs">{formatNoHp(m.noHp)}</span>}
            <span className="text-xs text-amber-700">
              ({m.alasan}
              {m.statusAktif === 'AKTIF' ? '' : ', nonaktif'})
            </span>
            {onPakai && (
              <Button type="button" size="sm" variant="outline" onClick={() => onPakai(m)}>
                Pakai yang ini
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={menyimpan}
        onClick={onTetapSimpan}
      >
        Ini {apa.toLowerCase()} berbeda, tetap simpan
      </Button>
    </div>
  );
}
