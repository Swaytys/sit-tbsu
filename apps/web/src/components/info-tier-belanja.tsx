import { formatRupiah, type InfoTierBelanja as DataTierBelanja } from '@sit/shared';
import { BadgeCheck, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "harga Grosir", tetapi tidak "harga Harga 23%" bila nama tiernya sendiri sudah diawali kata Harga. */
const sebutTier = (nama: string) => (/^harga\b/i.test(nama) ? nama.toLowerCase() : `harga ${nama}`);

/**
 * Keterangan tier harga transaksi dari pratinjau API (docs/06 H8, K-098): tier yang berlaku menurut total
 * belanja dan kekurangan belanja menuju tier berikutnya. Semua angka dari API; komponen hanya menampilkan.
 * Dibuat menonjol (kotak berwarna, angka besar) karena ini bahan kasir menawarkan tambahan belanja (K-106).
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
    <div className={cn('space-y-1', className)} data-testid="info-tier-belanja">
      {naik && (
        <p className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-sm font-semibold text-emerald-800">
          <BadgeCheck className="size-4 shrink-0" />
          <span>
            {sebutTier(namaTier(info.idTingkatHarga)).replace(/^h/, 'H')} berlaku untuk semua
            barang.
          </span>
        </p>
      )}
      {info.berikut && (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-900">
          <TrendingUp className="size-4 shrink-0" />
          <span>
            Belanja{' '}
            <b className="text-base font-bold text-red-600 tabular-nums">
              {formatRupiah(info.berikut.kurang)}
            </b>{' '}
            lagi untuk {sebutTier(namaTier(info.berikut.idTingkatHarga))}.
          </span>
        </p>
      )}
    </div>
  );
}
