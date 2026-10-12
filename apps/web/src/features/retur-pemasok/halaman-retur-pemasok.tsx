import {
  formatRupiah,
  LABEL_PENYELESAIAN_RETUR_PEMASOK,
  PENYELESAIAN_RETUR_PEMASOK,
  type BarisDaftarReturPemasok,
  type PenyelesaianReturPemasok,
} from '@sit/shared';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useDaftarReturPemasok } from '@/api/hutang';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatWaktu } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';

const SEMUA = 'SEMUA';

export function BadgePenyelesaian({ p }: { p: PenyelesaianReturPemasok }) {
  return (
    <Badge variant="outline" className="border-slate-300 text-slate-700">
      {LABEL_PENYELESAIAN_RETUR_PEMASOK[p]}
    </Badge>
  );
}

/** Persediaan › Retur ke Pemasok (docs/06 RP1–RP7): riwayat dokumen RTP. */
export function HalamanReturPemasok() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [penyelesaian, setPenyelesaian] = useState<PenyelesaianReturPemasok | null>(null);
  const [halaman, setHalaman] = useState(1);
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarReturPemasok({
    cari: cariTertunda,
    penyelesaian,
    halaman,
    perHalaman: barisPerHalaman,
  });

  const kolom: KolomTabel<BarisDaftarReturPemasok>[] = [
    {
      kunci: 'nomor',
      judul: 'Nomor',
      sel: (r) => (
        <Link
          to={`/retur-pemasok/${r.id}`}
          className="font-mono text-xs font-medium text-blue-700 hover:underline"
        >
          {r.nomor}
        </Link>
      ),
    },
    { kunci: 'tanggal', judul: 'Waktu', sel: (r) => formatWaktu(r.tanggal) },
    { kunci: 'pemasok', judul: 'Pemasok', sel: (r) => r.namaPemasok },
    {
      kunci: 'penyelesaian',
      judul: 'Penyelesaian',
      sel: (r) => (
        <div className="space-y-0.5">
          <BadgePenyelesaian p={r.penyelesaian} />
          {r.nomorPenerimaan && (
            <div className="text-xs text-slate-500">dari {r.nomorPenerimaan}</div>
          )}
        </div>
      ),
    },
    { kunci: 'baris', judul: 'Barang', className: 'text-right', sel: (r) => r.jumlahBaris },
    {
      kunci: 'total',
      judul: 'Nilai retur',
      className: 'text-right tabular-nums',
      sel: (r) => formatRupiah(r.totalRetur),
    },
    { kunci: 'oleh', judul: 'Dicatat oleh', sel: (r) => r.namaPengguna },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-xl font-semibold text-slate-900">Retur ke Pemasok</h1>
          <p className="text-sm text-slate-500">
            Barang dikembalikan ke pemasok mengurangi stok dengan nilai HPP rata-rata; diselesaikan
            dengan potong hutang, barang pengganti, uang kembali, atau pengembalian titipan.
          </p>
        </div>
        <Button asChild>
          <Link to="/retur-pemasok/baru">
            <Plus /> Retur baru
          </Link>
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(1);
              }}
              placeholder="Cari nomor atau pemasok…"
              className="pl-8"
              aria-label="Cari retur pemasok"
            />
          </div>
          <Select
            value={penyelesaian ?? SEMUA}
            onValueChange={(v) => {
              setPenyelesaian(v === SEMUA ? null : (v as PenyelesaianReturPemasok));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-52" aria-label="Saring penyelesaian">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua penyelesaian</SelectItem>
              {PENYELESAIAN_RETUR_PEMASOK.map((p) => (
                <SelectItem key={p} value={p}>
                  {LABEL_PENYELESAIAN_RETUR_PEMASOK[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(r) => r.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Belum ada retur ke pemasok."
        />
      </Card>
    </div>
  );
}
