import { JENIS_DIMENSI_FISIK, type Satuan } from '@sit/shared';
import { RefreshCw } from 'lucide-react';
import { pesanGalat } from '@/api/client';
import { useDaftarSatuan } from '@/api/satuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDesimal } from '@/lib/format';
import { LABEL_JENIS_DIMENSI, LABEL_STATUS_AKTIF } from '@/lib/label';
import { cn } from '@/lib/utils';

const DIMENSI_FISIK: readonly string[] = JENIS_DIMENSI_FISIK;

export function HalamanSatuan() {
  const satuan = useDaftarSatuan();

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Satuan</h1>
        <p className="text-sm text-slate-500">
          Satuan ukur dan satuan hitung. Konversi hanya berlaku antar-satuan berdimensi sama.
        </p>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Daftar satuan</span>
          {satuan.data && (
            <span className="text-xs text-slate-500">{satuan.data.length} satuan</span>
          )}
        </div>

        {satuan.isPending ? (
          <div className="space-y-2 p-4" aria-label="Memuat data satuan">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : satuan.isError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-red-600">{pesanGalat(satuan.error)}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void satuan.refetch()}
              disabled={satuan.isFetching}
            >
              <RefreshCw className={cn(satuan.isFetching && 'animate-spin')} />
              Coba lagi
            </Button>
          </div>
        ) : satuan.data.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Belum ada data satuan.</p>
        ) : (
          <TabelSatuan data={satuan.data} />
        )}
      </Card>
    </div>
  );
}

function TabelSatuan({ data }: { data: Satuan[] }) {
  // Kode satuan basis per dimensi fisik, untuk menampilkan "0,01 m" (hanya tampilan).
  const kodeBasis = new Map(
    data
      .filter((s) => s.isBasis && DIMENSI_FISIK.includes(s.jenisDimensi))
      .map((s) => [s.jenisDimensi, s.kode]),
  );

  return (
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="px-4">Kode</TableHead>
          <TableHead>Nama</TableHead>
          <TableHead>Jenis dimensi</TableHead>
          <TableHead className="text-right">Faktor ke basis</TableHead>
          <TableHead>Basis</TableHead>
          <TableHead className="px-4">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((s) => {
          const fisik = DIMENSI_FISIK.includes(s.jenisDimensi);
          return (
            <TableRow key={s.id}>
              <TableCell className="px-4 font-mono">{s.kode}</TableCell>
              <TableCell>{s.nama}</TableCell>
              <TableCell>{LABEL_JENIS_DIMENSI[s.jenisDimensi]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {fisik ? (
                  `${formatDesimal(s.faktorKeBasis)} ${kodeBasis.get(s.jenisDimensi) ?? ''}`
                ) : (
                  <span className="text-slate-400" title="Konversi satuan hitung diatur per barang">
                    —
                  </span>
                )}
              </TableCell>
              <TableCell>
                {fisik && s.isBasis && (
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                    Basis
                  </Badge>
                )}
              </TableCell>
              <TableCell className="px-4">
                <Badge
                  variant="outline"
                  className={cn(
                    s.statusAktif === 'AKTIF'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-slate-100 text-slate-500',
                  )}
                >
                  {LABEL_STATUS_AKTIF[s.statusAktif]}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
