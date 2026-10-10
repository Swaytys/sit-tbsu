import { formatRupiah, type InfoTierBelanja as DataTierBelanja } from '@sit/shared';
import { cn } from '@/lib/utils';

/**
 * Keterangan tier harga transaksi dari pratinjau API (docs/06 H8, K-098): tier yang berlaku menurut total
 * belanja dan kekurangan belanja menuju tier berikutnya. Semua angka dari API; komponen hanya menampilkan.
 */
export function InfoTierBelanja({
  info,
  idTierDasar,
  namaTier,
  className,
}: {
  info: DataTierBelanja | undefined;
  idTierDasar: number | null;
  namaTier: (idTier: number) => string;
  className?: string;
}) {
  if (!info) return null;
  const naik = info.idTingkatHarga !== idTierDasar;
  if (!naik && !info.berikut) return null;
  return (
    <p className={cn('text-xs text-slate-600', className)} data-testid="info-tier-belanja">
      {naik && (
        <span className="font-medium text-blue-700">
          Harga {namaTier(info.idTingkatHarga)} berlaku untuk semua barang.{' '}
        </span>
      )}
      {info.berikut && (
        <span>
          Belanja {formatRupiah(info.berikut.kurang)} lagi untuk harga{' '}
          {namaTier(info.berikut.idTingkatHarga)}.
        </span>
      )}
    </p>
  );
}
