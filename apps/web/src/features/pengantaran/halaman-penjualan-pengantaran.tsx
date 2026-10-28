import { KanbanSquare } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabRiwayatPenjualan } from '../kasir/tab-riwayat-penjualan';
import { LayarPos } from '../pos/layar-pos';

const TAB = ['antrean', 'invoice'] as const;
type Tab = (typeof TAB)[number];

/**
 * Transaksi › Penjualan Pengantaran: antrean order pengantaran → invoice (layar POS, K-073), daftar invoice,
 * (pengiriman diatur di Logistik › Pengiriman, K-160).
 */
export function HalamanPenjualanPengantaran() {
  const [url, setUrl] = useSearchParams();
  const idOrder = Number(url.get('order')) || null;
  const tab: Tab = idOrder ? 'antrean' : (TAB.find((t) => t === url.get('tab')) ?? 'antrean');
  // K-171: bilah pintasan sejajar tab.
  const [slotPintasan, setSlotPintasan] = useState<HTMLDivElement | null>(null);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <Tabs
        className="min-h-0 flex-1"
        value={tab}
        onValueChange={(v) => setUrl(v === 'antrean' ? {} : { tab: v }, { replace: true })}
      >
        <div className="flex items-start gap-2">
          <TabsList className="h-8 shrink-0">
            <TabsTrigger value="antrean">Antrean</TabsTrigger>
            <TabsTrigger value="invoice">Invoice</TabsTrigger>
          </TabsList>
          <Link
            to="/pengiriman"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
            title="Atur rit dan pengantaran di Logistik › Pengiriman"
          >
            <KanbanSquare className="size-3.5" /> Pengiriman (papan)
          </Link>
          <div ref={setSlotPintasan} className="min-w-0 flex-1" />
        </div>
        <TabsContent value="antrean" className="min-h-0">
          <LayarPos jenis="PENGANTARAN" idOrderAwal={idOrder} slotPintasan={slotPintasan} />
        </TabsContent>
        <TabsContent value="invoice">
          <TabRiwayatPenjualan jenis="PENGANTARAN" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
