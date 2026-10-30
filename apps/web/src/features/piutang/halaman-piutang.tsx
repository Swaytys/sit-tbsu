import { formatRupiah, type BarisPiutang } from '@sit/shared';
import { Search, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { usePengguna } from '@/api/auth';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarPiutang } from '@/api/penjualan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { BadgeStatusBayar } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatTanggal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';
import { DialogTerimaPembayaran } from '../kasir/halaman-detail-penjualan';
import { useIngat } from '@/lib/ingat-saring';

function KeteranganTempo({ p }: { p: BarisPiutang }) {
  if (p.hariTerlambat === null) return <span className="text-slate-400">—</span>;
  if (p.terlambat) {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        Terlambat {p.hariTerlambat} hari
      </Badge>
    );
  }
  const sisa = -p.hariTerlambat;
  return (
    <span className={sisa <= 3 ? 'text-amber-700' : 'text-slate-500'}>
      {sisa === 0 ? 'Hari ini' : `${sisa} hari lagi`}
    </span>
  );
}

/** Transaksi › Piutang (docs/06 PT3): daftar per penjualan, ringkasan per pelanggan, terima pembayaran. */
export function HalamanPiutang() {
  const [url, setUrl] = useSearchParams();
  const terlambat = url.get('terlambat') === 'true';
  const idPelanggan = Number(url.get('pelanggan')) || null;
  const bolehBayar = usePengguna().izin.includes('penjualan.pembayaran.catat');
  const [cari, setCari] = useIngat('piutang.cari', '');
  const cariTertunda = useTunda(cari, 300);
  const [halaman, setHalaman] = useIngat('piutang.halaman', 1);
  const barisPerHalaman = useBarisPerHalaman();
  const [bayar, setBayar] = useState<BarisPiutang | null>(null);
  const daftar = useDaftarPiutang({
    cari: cariTertunda,
    idPelanggan,
    terlambat,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const r = daftar.data?.ringkasan;

  function atur(ubah: Record<string, string | null>) {
    const baru = new URLSearchParams(url);
    for (const [k, v] of Object.entries(ubah)) {
      if (v === null) baru.delete(k);
      else baru.set(k, v);
    }
    setUrl(baru, { replace: true });
    setHalaman(1);
  }

  const kolom: KolomTabel<BarisPiutang>[] = [
    {
      kunci: 'nomor',
      judul: 'Nomor',
      sel: (p) => (
        <Link
          to={`/penjualan/${p.id}`}
          className="font-mono text-xs font-medium text-blue-700 hover:underline"
        >
          {p.nomor}
        </Link>
      ),
    },
    { kunci: 'pelanggan', judul: 'Pelanggan', sel: (p) => p.namaPelanggan },
    { kunci: 'tanggal', judul: 'Tanggal', sel: (p) => formatTanggal(p.tanggal.slice(0, 10)) },
    {
      kunci: 'tempo',
      judul: 'Jatuh tempo',
      sel: (p) => (
        <div>
          <div>{formatTanggal(p.tanggalJatuhTempo)}</div>
          <div className="text-xs">
            <KeteranganTempo p={p} />
          </div>
        </div>
      ),
    },
    {
      kunci: 'total',
      judul: 'Total',
      className: 'text-right tabular-nums',
      sel: (p) => formatRupiah(p.totalNeto),
    },
    {
      kunci: 'sisa',
      judul: 'Sisa',
      className: 'text-right font-semibold tabular-nums',
      sel: (p) => formatRupiah(p.sisaTagihan),
    },
    {
      kunci: 'status',
      judul: 'Status',
      sel: (p) => <BadgeStatusBayar status={p.statusPembayaran} />,
    },
    ...(bolehBayar
      ? [
          {
            kunci: 'aksi',
            judul: <span className="sr-only">Aksi</span>,
            sel: (p: BarisPiutang) => (
              <Button size="sm" variant="outline" onClick={() => setBayar(p)}>
                <Wallet /> Terima pembayaran
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Piutang</h1>
        <p className="text-sm text-slate-500">
          Penjualan pelanggan yang belum lunas. Pembayaran dicatat sebagai pelunasan.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => atur({ terlambat: null })}
          className={cn(
            'rounded-lg border bg-white p-3 text-left',
            !terlambat && 'border-blue-500 ring-1 ring-blue-500',
          )}
        >
          <div className="text-xs text-slate-500">Total piutang ({r?.jumlah ?? 0} penjualan)</div>
          <div className="text-xl font-semibold tabular-nums">
            {formatRupiah(r?.totalSisa ?? 0)}
          </div>
        </button>
        <button
          type="button"
          onClick={() => atur({ terlambat: terlambat ? null : 'true' })}
          className={cn(
            'rounded-lg border bg-white p-3 text-left',
            terlambat && 'border-red-500 ring-1 ring-red-500',
          )}
        >
          <div className="text-xs text-slate-500">Terlambat ({r?.jumlahTerlambat ?? 0})</div>
          <div className="text-xl font-semibold text-red-700 tabular-nums">
            {formatRupiah(r?.totalTerlambat ?? 0)}
          </div>
        </button>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-slate-500">Pelanggan berpiutang</div>
          <div className="text-xl font-semibold tabular-nums">{r?.perPelanggan.length ?? 0}</div>
        </div>
      </div>
      <div className="flex gap-4">
        <Card className="w-72 shrink-0 gap-0 self-start py-0">
          <div className="border-b p-3 text-sm font-semibold text-slate-700">Per pelanggan</div>
          <ul className="max-h-[480px] divide-y overflow-auto text-sm">
            {idPelanggan !== null && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-blue-700"
                  onClick={() => atur({ pelanggan: null })}
                >
                  Tampilkan semua pelanggan
                </button>
              </li>
            )}
            {(r?.perPelanggan ?? []).map((p) => (
              <li key={p.idPelanggan}>
                <button
                  type="button"
                  onClick={() => atur({ pelanggan: String(p.idPelanggan) })}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-slate-50',
                    idPelanggan === p.idPelanggan && 'bg-blue-50',
                  )}
                >
                  <div className="font-medium">{p.namaPelanggan}</div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      {p.jumlahInvoice} penjualan · terlama {formatTanggal(p.jatuhTempoTerlama)}
                    </span>
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {formatRupiah(p.totalSisa)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex-1 gap-0 overflow-hidden py-0">
          <div className="border-b p-3">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={cari}
                onChange={(e) => {
                  setCari(e.target.value);
                  setHalaman(1);
                }}
                placeholder="Cari nomor atau pelanggan…"
                className="pl-8"
                aria-label="Cari piutang"
              />
            </div>
          </div>
          <DataTable
            kolom={kolom}
            data={daftar.data?.data}
            meta={daftar.data?.meta}
            onHalaman={setHalaman}
            kunciBaris={(p) => p.id}
            memuat={daftar.isFetching}
            galat={daftar.error}
            onUlang={() => void daftar.refetch()}
            kosong="Tidak ada piutang."
          />
        </Card>
      </div>
      {bayar && <DialogTerimaPembayaran p={bayar} onTutup={() => setBayar(null)} />}
    </div>
  );
}
