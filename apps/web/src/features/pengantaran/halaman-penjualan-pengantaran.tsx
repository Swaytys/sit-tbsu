import { formatRupiah } from '@sit/shared';
import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useDaftarOrder, useDaftarSuratJalan } from '@/api/penjualan';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { TabRiwayatPenjualan } from '../kasir/tab-riwayat-penjualan';
import { BadgeSuratJalan } from './panel-surat-jalan';

const TAB = ['invoice', 'checkout', 'pengiriman'] as const;
type Tab = (typeof TAB)[number];

/** Order pengantaran di antrean yang siap dibuatkan invoice. */
function TabSiapCheckout() {
  const daftar = useDaftarOrder(
    {
      cari: '',
      status: 'AKTIF',
      jenis: 'PENGANTARAN',
      milikSaya: false,
      halaman: 1,
      perHalaman: 100,
    },
    { segarkanTiap: 15_000 },
  );
  if (daftar.isLoading) return <Skeleton className="h-32 w-full" />;
  const data = daftar.data?.data ?? [];
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        Tidak ada order pengantaran di antrean.
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {data.map((o) => (
        <Card key={o.id} className="flex-row items-center gap-4 p-4">
          <div className="flex-1">
            <div className="font-mono text-sm font-semibold">{o.nomor}</div>
            <div className="text-sm text-slate-600">
              {o.namaPelanggan} · {o.jumlahItem} barang · dibuat {o.namaPengguna}{' '}
              {formatWaktu(o.waktuMasukAntrean)}
            </div>
          </div>
          <div className="font-semibold tabular-nums">{formatRupiah(o.total)}</div>
          <Link
            to={`/penjualan-pengantaran/checkout?order=${o.id}`}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Buat invoice <ChevronRight className="size-4" />
          </Link>
        </Card>
      ))}
    </div>
  );
}

/** Surat jalan yang belum selesai (DIPROSES/DIMUAT/DIKIRIM). */
function TabPengiriman() {
  const daftar = useDaftarSuratJalan({ status: 'AKTIF', cari: '' });
  if (daftar.isLoading) return <Skeleton className="h-32 w-full" />;
  const data = daftar.data?.data ?? [];
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">Tidak ada pengiriman aktif.</Card>
    );
  }
  return (
    <div className="space-y-2">
      {data.map((sj) => (
        <Card key={sj.id} className="flex-row items-center gap-4 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{sj.nomor}</span>
              <BadgeSuratJalan status={sj.status} />
            </div>
            <div className="text-sm text-slate-600">
              {sj.namaPelanggan} · {sj.alamatKirim} · {sj.sopir ?? 'sopir belum diisi'}
            </div>
            <div className="text-xs text-slate-500">
              {sj.baris.map((b) => `${b.namaBarang} ${formatDesimal(b.qtyKirim)}`).join(' · ')}
            </div>
          </div>
          <Link
            to={`/penjualan/${sj.idPenjualan}`}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {sj.nomorPenjualan}
          </Link>
        </Card>
      ))}
    </div>
  );
}

/** Transaksi › Penjualan Pengantaran: invoice, order siap dibuatkan invoice, pengiriman aktif. */
export function HalamanPenjualanPengantaran() {
  const [url, setUrl] = useSearchParams();
  const tab: Tab = TAB.find((t) => t === url.get('tab')) ?? 'invoice';
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Penjualan Pengantaran</h1>
        <p className="text-sm text-slate-500">
          Invoice pengantaran, surat jalan (boleh bertahap), dan pembayaran DP/pelunasan.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="checkout">Siap dibuatkan invoice</TabsTrigger>
          <TabsTrigger value="pengiriman">Pengiriman aktif</TabsTrigger>
        </TabsList>
        <TabsContent value="invoice">
          <TabRiwayatPenjualan jenis="PENGANTARAN" />
        </TabsContent>
        <TabsContent value="checkout">
          <TabSiapCheckout />
        </TabsContent>
        <TabsContent value="pengiriman">
          <TabPengiriman />
        </TabsContent>
      </Tabs>
    </div>
  );
}
