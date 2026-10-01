import { Link } from 'react-router';
import { useStokTertahan } from '@/api/penjualan';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDesimal, formatWaktu } from '@/lib/format';

/** Stok tertahan (docs/05 R7): per barang, order MENUNGGU/DIPROSES yang menahan stok, dengan umur order. */
export function TabTertahan() {
  const data = useStokTertahan();
  if (data.isLoading) return <Skeleton className="h-40 w-full" />;
  const daftar = data.data ?? [];
  if (daftar.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        Tidak ada stok yang ditahan order saat ini.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {daftar.map((b) => (
        <Card key={b.idBarang} className="gap-2 p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="font-medium">{b.namaBarang}</span>{' '}
              <span className="font-mono text-xs text-slate-500">{b.kodeBarang}</span>
            </div>
            <div className="text-sm text-slate-600 tabular-nums">
              fisik {formatDesimal(b.stokFisik)} · ditahan{' '}
              <span className="font-semibold">{formatDesimal(b.stokDipesan)}</span> {b.kodeSatuan}
            </div>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {b.order.map((o) => (
                <tr key={o.id}>
                  <td className="py-1.5">
                    <Link
                      to={`/order?id=${o.id}`}
                      className="font-mono text-xs font-medium text-blue-700"
                    >
                      {o.nomor}
                    </Link>
                  </td>
                  <td className="py-1.5">{o.namaPelanggan ?? 'Pembeli umum'}</td>
                  <td className="py-1.5 text-slate-500">{o.namaPengguna}</td>
                  <td className="py-1.5 text-slate-500">
                    {o.status === 'DIPROSES' ? 'Diproses' : 'Menunggu'} sejak{' '}
                    {formatWaktu(o.waktuMasukAntrean)}
                    {o.basi && (
                      <Badge
                        variant="outline"
                        className="ml-2 border-red-200 bg-red-50 text-red-700"
                      >
                        Basi
                      </Badge>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatDesimal(o.qtyDasar)} {b.kodeSatuan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
