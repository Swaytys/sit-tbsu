import type { DetailBarang } from '@sit/shared';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useBarangKhusus } from '@/api/order-pembelian';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

/**
 * K-225: Owner menandai barang mahal/langka yang pembeliannya selalu wajib disetujui Owner, berapa pun nilai
 * ordernya. Peran lain hanya melihat tandanya.
 */
export function KartuPembelianKhusus({ barang }: { barang: DetailBarang }) {
  const owner = usePengguna().izin.includes('pembelian.setujui_semua');
  const ubah = useBarangKhusus();
  if (!owner && !barang.perluPersetujuanBeli) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pembelian wajib disetujui Owner</CardTitle>
        <CardDescription>
          Setiap order pembelian yang memuat barang ini harus disetujui Owner sebelum dikirim ke
          pemasok, walau nilainya kecil. Untuk barang mahal atau yang sering jadi celah.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-3 text-sm">
          <Switch
            aria-label="Pembelian wajib disetujui Owner"
            checked={barang.perluPersetujuanBeli}
            disabled={!owner || ubah.isPending}
            onCheckedChange={(perlu) =>
              void ubah
                .mutateAsync({ id: barang.id, perlu })
                .then(() =>
                  toast.success(
                    perlu
                      ? 'Pembelian barang ini kini wajib disetujui Owner.'
                      : 'Pembelian barang ini kembali mengikuti aturan biasa.',
                  ),
                )
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          />
          {barang.perluPersetujuanBeli ? 'Ya, wajib disetujui Owner' : 'Tidak (aturan biasa)'}
        </label>
      </CardContent>
    </Card>
  );
}
