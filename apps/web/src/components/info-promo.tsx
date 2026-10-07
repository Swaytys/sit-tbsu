import { formatRupiah, type BarisPratinjau } from '@sit/shared';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Keterangan promo satu baris dari pratinjau API (docs/06 PR4–PR6). Tidak pernah menampilkan angka modal:
 * promo yang gugur karena di bawah modal hanya diberi tanda.
 */
export function InfoPromo({
  p,
  aksi,
  className,
}: {
  p: BarisPratinjau | undefined;
  /** Tombol/petunjuk lepas atau pasang promo (bila berizin). */
  aksi?: ReactNode;
  className?: string;
}) {
  if (!p) return null;
  if (p.idPromo !== null) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-emerald-700', className)}>
        <span>
          Promo {p.namaPromo} −{formatRupiah(p.diskonPromo)}
          {p.promoDitolak && (
            <span className="text-amber-700">
              {' '}
              (promo lebih besar tidak berlaku: di bawah modal)
            </span>
          )}
        </span>
        {aksi}
      </div>
    );
  }
  if (p.promoDilepas) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-slate-500', className)}>
        <span className="line-through">
          Promo {p.promoDilepas.nama} −{formatRupiah(p.promoDilepas.potongan)}
        </span>
        <span>dilepas</span>
        {aksi}
      </div>
    );
  }
  if (p.promoDitolak) {
    return (
      <div className={cn('text-xs text-amber-700', className)}>
        Promo tidak berlaku: harga jadi di bawah modal.
      </div>
    );
  }
  return null;
}
