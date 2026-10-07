import { formatRupiah, type BarisSetoranKonsinyasi } from '@sit/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDesimal } from '@/lib/format';

/** Baris setoran konsinyasi (pratinjau dan detail): per barang per harga titip saat jual. */
export function TabelSetoran({ baris, total }: { baris: BarisSetoranKonsinyasi[]; total: number }) {
  const adaGantiRugi = baris.some((b) => /[1-9]/.test(b.qtyGantiRugi));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Barang</TableHead>
          <TableHead className="text-right">Terjual</TableHead>
          <TableHead className="text-right">Retur pelanggan</TableHead>
          {adaGantiRugi && (
            <TableHead className="text-right" title="Barang titipan yang dimusnahkan toko">
              Ganti rugi toko
            </TableHead>
          )}
          <TableHead className="text-right">Disetor</TableHead>
          <TableHead className="text-right">Harga titip</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {baris.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
              Tidak ada penjualan barang titipan yang belum disetor.
            </TableCell>
          </TableRow>
        )}
        {baris.map((b) => (
          <TableRow key={`${b.idBarang}-${b.hargaTitip}`}>
            <TableCell>
              <div className="font-medium">{b.namaBarang}</div>
              <div className="font-mono text-xs text-slate-500">{b.kodeBarang}</div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatDesimal(b.qtyTerjual)} {b.kodeSatuan}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {/[1-9]/.test(b.qtyRetur) ? `−${formatDesimal(b.qtyRetur)}` : '—'}
            </TableCell>
            {adaGantiRugi && (
              <TableCell className="text-right tabular-nums">
                {/[1-9]/.test(b.qtyGantiRugi) ? `+${formatDesimal(b.qtyGantiRugi)}` : '—'}
              </TableCell>
            )}
            <TableCell className="text-right font-medium tabular-nums">
              {formatDesimal(b.qtyNeto)} {b.kodeSatuan}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatRupiah(b.hargaTitip)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatRupiah(b.subtotal)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={adaGantiRugi ? 6 : 5} className="text-right font-medium">
            Total setoran
          </TableCell>
          <TableCell className="text-right text-base font-semibold tabular-nums">
            {formatRupiah(total)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
