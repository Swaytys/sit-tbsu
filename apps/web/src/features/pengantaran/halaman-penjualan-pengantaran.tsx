import { Link, useSearchParams } from 'react-router';
import { useDaftarSuratJalan } from '@/api/penjualan';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDesimal } from '@/lib/format';
import { TabRiwayatPenjualan } from '../kasir/tab-riwayat-penjualan';
import { LayarPos } from '../pos/layar-pos';
import { BadgeSuratJalan } from './panel-surat-jalan';

const TAB = ['antrean', 'invoice', 'pengiriman'] as const;
type Tab = (typeof TAB)[number];

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

/**
 * Transaksi › Penjualan Pengantaran: antrean order pengantaran → invoice (layar POS, K-073), daftar invoice,
 * dan pengiriman aktif.
 */
export function HalamanPenjualanPengantaran() {
  const [url, setUrl] = useSearchParams();
  const idOrder = Number(url.get('order')) || null;
  const tab: Tab = idOrder ? 'antrean' : (TAB.find((t) => t === url.get('tab')) ?? 'antrean');
  return (
    <div className="flex flex-col gap-2 p-3">
      <Tabs
        value={tab}
        onValueChange={(v) => setUrl(v === 'antrean' ? {} : { tab: v }, { replace: true })}
      >
        <TabsList className="h-8">
          <TabsTrigger value="antrean">Antrean</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="pengiriman">Pengiriman aktif</TabsTrigger>
        </TabsList>
        <TabsContent value="antrean">
          <LayarPos jenis="PENGANTARAN" idOrderAwal={idOrder} />
        </TabsContent>
        <TabsContent value="invoice">
          <TabRiwayatPenjualan jenis="PENGANTARAN" />
        </TabsContent>
        <TabsContent value="pengiriman">
          <TabPengiriman />
        </TabsContent>
      </Tabs>
    </div>
  );
}
