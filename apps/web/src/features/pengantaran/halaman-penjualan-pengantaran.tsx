import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabRiwayatPenjualan } from '../kasir/tab-riwayat-penjualan';
import { LayarPos } from '../pos/layar-pos';
import { PapanPengiriman } from './papan-pengiriman';

const TAB = ['antrean', 'invoice', 'pengiriman'] as const;
type Tab = (typeof TAB)[number];

/**
 * Transaksi › Penjualan Pengantaran: antrean order pengantaran → invoice (layar POS, K-073), daftar invoice,
 * dan pengiriman aktif.
 */
export function HalamanPenjualanPengantaran() {
  const [url, setUrl] = useSearchParams();
  const idOrder = Number(url.get('order')) || null;
  const tab: Tab = idOrder ? 'antrean' : (TAB.find((t) => t === url.get('tab')) ?? 'antrean');
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <Tabs
        className="min-h-0 flex-1"
        value={tab}
        onValueChange={(v) => setUrl(v === 'antrean' ? {} : { tab: v }, { replace: true })}
      >
        <TabsList className="h-8">
          <TabsTrigger value="antrean">Antrean</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="pengiriman">Pengiriman aktif</TabsTrigger>
        </TabsList>
        <TabsContent value="antrean" className="min-h-0">
          <LayarPos jenis="PENGANTARAN" idOrderAwal={idOrder} />
        </TabsContent>
        <TabsContent value="invoice">
          <TabRiwayatPenjualan jenis="PENGANTARAN" />
        </TabsContent>
        <TabsContent value="pengiriman" className="min-h-0">
          <PapanPengiriman />
        </TabsContent>
      </Tabs>
    </div>
  );
}
