import { formatRupiah, LABEL_PENYELESAIAN_RETUR_PEMASOK, ukuranKertasCss } from '@sit/shared';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { pesanGalat } from '@/api/client';
import { useDetailReturPemasok } from '@/api/hutang';
import { useTampilanToko } from '@/api/pengaturan';
import { AreaCetak } from '@/components/area-cetak';
import { NotaReturPemasokA4 } from '@/components/dokumen-a4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDesimal, formatWaktu } from '@/lib/format';

function Info({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{judul}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}

/** Detail retur ke pemasok (hanya baca; append-only) dan cetak nota retur. */
export function HalamanDetailReturPemasok() {
  const { id } = useParams();
  const detail = useDetailReturPemasok(Number(id));
  const toko = useTampilanToko().data;
  const [cetak, setCetak] = useState(false);
  useEffect(() => {
    if (!cetak) return;
    const t = setTimeout(() => {
      window.print();
      setCetak(false);
    }, 150);
    return () => clearTimeout(t);
  }, [cetak]);

  if (detail.error) return <p className="p-6 text-sm text-red-600">{pesanGalat(detail.error)}</p>;
  const r = detail.data;
  if (!r) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/retur-pemasok" aria-label="Kembali ke daftar retur pemasok">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              {r.nomor}
              <Badge variant="outline" className="border-slate-300 text-slate-700">
                {LABEL_PENYELESAIAN_RETUR_PEMASOK[r.penyelesaian]}
              </Badge>
            </h1>
            <p className="text-sm text-slate-500">
              Retur ke {r.namaPemasok} · {formatWaktu(r.tanggal)} · dicatat {r.namaPengguna}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setCetak(true)} disabled={!toko}>
          <Printer /> Cetak nota retur
        </Button>
      </div>

      <Card className="grid grid-cols-4 gap-4 p-5 text-sm">
        <Info judul="Pemasok">{r.namaPemasok}</Info>
        <Info judul="Nilai retur (HPP)">{formatRupiah(r.totalRetur)}</Info>
        <Info judul="Penerimaan asal">
          {r.idPenerimaan ? (
            <Link to={`/penerimaan/${r.idPenerimaan}`} className="text-blue-700 hover:underline">
              {r.nomorPenerimaan}
            </Link>
          ) : (
            '—'
          )}
        </Info>
        <Info judul="Barang pengganti">{r.nomorPenerimaanPengganti ?? '—'}</Info>
        <div className="col-span-2">
          <Info judul="Alasan">{r.alasan}</Info>
        </div>
        <div className="col-span-2">
          <Info judul="Catatan">{r.catatan ?? '—'}</Info>
        </div>
      </Card>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barang</TableHead>
              <TableHead>Dari stok</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">HPP / satuan</TableHead>
              <TableHead className="text-right">Nilai</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.baris.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.namaBarang}</div>
                  <div className="font-mono text-xs text-slate-500">{b.kodeBarang}</div>
                </TableCell>
                <TableCell>{b.kondisiAsal === 'RUSAK' ? 'Rusak' : 'Baik'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDesimal(b.qty)} {b.kodeSatuan}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(b.hppSatuan)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(b.subtotal)}
                </TableCell>
                <TableCell className="text-xs text-slate-600">{b.keterangan ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-medium">
                Total nilai retur
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatRupiah(r.totalRetur)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
      {cetak && toko && (
        <AreaCetak ukuranKertas={ukuranKertasCss(toko.kertasDokumenLain)}>
          <NotaReturPemasokA4 r={r} toko={toko} />
        </AreaCetak>
      )}
    </div>
  );
}
