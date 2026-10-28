import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayarPos } from '../pos/layar-pos';
import { TabRiwayatPenjualan } from './tab-riwayat-penjualan';

const TAB = ['kasir', 'riwayat', 'belum-diambil'] as const;
type Tab = (typeof TAB)[number];

/** Transaksi › Penjualan Langsung: layar kasir POS (K-073), riwayat, dan barang belum diambil (P11). */
export function HalamanPenjualanLangsung() {
  const [url, setUrl] = useSearchParams();
  const idOrder = Number(url.get('order')) || null;
  const diminta = url.get('tab');
  const tab: Tab = idOrder ? 'kasir' : (TAB.find((t) => t === diminta) ?? 'kasir');
  // K-171: bilah pintasan kasir tampil sejajar tab agar area kerja lebih tinggi.
  const [slotPintasan, setSlotPintasan] = useState<HTMLDivElement | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <Tabs
        className="min-h-0 flex-1"
        value={tab}
        onValueChange={(v) => setUrl(v === 'kasir' ? {} : { tab: v }, { replace: true })}
      >
        <div className="flex items-start gap-2">
          <TabsList className="h-8 shrink-0">
            <TabsTrigger value="kasir">Kasir</TabsTrigger>
            <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
            <TabsTrigger value="belum-diambil">Belum diambil</TabsTrigger>
          </TabsList>
          <div ref={setSlotPintasan} className="min-w-0 flex-1" />
        </div>
        <TabsContent value="kasir" className="min-h-0">
          <LayarPos jenis="LANGSUNG" idOrderAwal={idOrder} slotPintasan={slotPintasan} />
        </TabsContent>
        <TabsContent value="riwayat">
          <TabRiwayatPenjualan jenis="LANGSUNG" />
        </TabsContent>
        <TabsContent value="belum-diambil">
          <TabRiwayatPenjualan jenis="LANGSUNG" belumDiambil />
        </TabsContent>
      </Tabs>
    </div>
  );
}
