import {
  formatRupiah,
  type BarisDaftarPenjualan,
  type JenisPenjualan,
  type StatusPembayaran,
  type StatusPengambilan,
} from '@sit/shared';
import { Search } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarPenjualan, useTandaiDiambil } from '@/api/penjualan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { BadgeStatusBayar } from '@/components/status-badge';
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
import { formatTanggal, formatWaktu } from '@/lib/format';
import { LABEL_STATUS_PENGAMBILAN, LABEL_STATUS_PENGIRIMAN } from '@/lib/label';
import { useTunda } from '@/lib/use-tunda';
import { KodeInfo } from '@/components/kode-info';
import { useIngat } from '@/lib/ingat-saring';

const SEMUA = 'SEMUA';

/**
 * Riwayat penjualan satu jenis (langsung/pengantaran). `belumDiambil` = daftar barang yang ditinggal di toko
 * dengan tombol konfirmasi diambil (P11).
 */
export function TabRiwayatPenjualan({
  jenis,
  belumDiambil = false,
}: {
  jenis: JenisPenjualan;
  belumDiambil?: boolean;
}) {
  const [cari, setCari] = useIngat(`riwayat-${jenis}${belumDiambil ? '-ambil' : ''}.cari`, '');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useIngat<StatusPembayaran | null>(
    `riwayat-${jenis}${belumDiambil ? '-ambil' : ''}.status`,
    null,
  );
  const [halaman, setHalaman] = useIngat(
    `riwayat-${jenis}${belumDiambil ? '-ambil' : ''}.halaman`,
    1,
  );
  const barisPerHalaman = useBarisPerHalaman();
  const diambil = useTandaiDiambil();
  const daftar = useDaftarPenjualan({
    cari: cariTertunda,
    jenis,
    statusPembayaran: status,
    statusPengambilan: belumDiambil ? ('BELUM_DIAMBIL' satisfies StatusPengambilan) : null,
    dari: '',
    sampai: '',
    halaman,
    perHalaman: barisPerHalaman,
  });

  const kolom: KolomTabel<BarisDaftarPenjualan>[] = [
    {
      kunci: 'nomor',
      judul: 'Nomor',
      sel: (p) => (
        <KodeInfo nomor={p.nomor}>
          <Link
            to={`/penjualan/${p.id}`}
            className="font-mono text-xs font-medium text-blue-700 hover:underline"
          >
            {p.nomor}
          </Link>
        </KodeInfo>
      ),
    },
    { kunci: 'waktu', judul: 'Waktu', sel: (p) => formatWaktu(p.tanggal) },
    {
      kunci: 'pembeli',
      judul: 'Pembeli',
      sel: (p) => p.namaPelanggan ?? p.namaPembeli ?? 'Pembeli umum',
    },
    { kunci: 'kasir', judul: 'Kasir', sel: (p) => p.namaKasir },
    {
      kunci: 'total',
      judul: 'Total',
      className: 'text-right tabular-nums',
      sel: (p) => formatRupiah(p.totalNeto),
    },
    {
      kunci: 'sisa',
      judul: 'Sisa',
      className: 'text-right tabular-nums',
      sel: (p) => (p.sisaTagihan > 0 ? formatRupiah(p.sisaTagihan) : '—'),
    },
    {
      kunci: 'bayar',
      judul: 'Pembayaran',
      sel: (p) => <BadgeStatusBayar status={p.statusPembayaran} />,
    },
    {
      kunci: 'barang',
      judul: jenis === 'LANGSUNG' ? 'Barang' : 'Pengiriman',
      sel: (p) =>
        p.statusPengambilan
          ? LABEL_STATUS_PENGAMBILAN[p.statusPengambilan]
          : p.statusPengiriman
            ? LABEL_STATUS_PENGIRIMAN[p.statusPengiriman]
            : '—',
    },
    {
      kunci: 'tempo',
      judul: 'Jatuh tempo',
      sel: (p) => (p.tanggalJatuhTempo ? formatTanggal(p.tanggalJatuhTempo) : '—'),
    },
    ...(belumDiambil
      ? [
          {
            kunci: 'aksi',
            judul: <span className="sr-only">Aksi</span>,
            sel: (p: BarisDaftarPenjualan) => (
              <Button
                size="sm"
                variant="outline"
                disabled={diambil.isPending}
                onClick={() =>
                  void diambil
                    .mutateAsync(p.id)
                    .then(() => toast.success(`Barang ${p.nomor} sudah diambil.`))
                    .catch((err: unknown) => toast.error(pesanGalat(err)))
                }
              >
                Sudah diambil
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-3 border-b p-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
            placeholder="Cari nomor atau pembeli…"
            className="pl-8"
            aria-label="Cari penjualan"
          />
        </div>
        {!belumDiambil && (
          <Select
            value={status ?? SEMUA}
            onValueChange={(v) => {
              setStatus(v === SEMUA ? null : (v as StatusPembayaran));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Saring status pembayaran">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua pembayaran</SelectItem>
              <SelectItem value="LUNAS">Lunas</SelectItem>
              <SelectItem value="DP">DP</SelectItem>
              <SelectItem value="BELUM_BAYAR">Belum bayar</SelectItem>
            </SelectContent>
          </Select>
        )}
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
        kosong={belumDiambil ? 'Tidak ada barang yang belum diambil.' : 'Belum ada penjualan.'}
      />
    </Card>
  );
}
