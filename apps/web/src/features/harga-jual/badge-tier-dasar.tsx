import { Badge } from '@/components/ui/badge';

/**
 * Penanda tier harga dasar (`tingkat_harga.is_default`, docs/06 H1): harga semua transaksi sebelum syarat
 * belanja tier lain tercapai. Selalu disertai keterangan agar tidak menjadi label tanpa arti.
 */
export function BadgeTierDasar() {
  return (
    <Badge
      variant="outline"
      className="border-blue-200 bg-blue-50 text-blue-700"
      title="Harga dasar: dipakai semua transaksi sebelum syarat belanja tier lain tercapai. Tidak bisa dinonaktifkan."
    >
      Harga dasar
    </Badge>
  );
}
