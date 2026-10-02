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

  return (
    <div className="flex flex-col gap-2 p-3">
      <Tabs
        value={tab}
        onValueChange={(v) => setUrl(v === 'kasir' ? {} : { tab: v }, { replace: true })}
      >
        <TabsList className="h-8">
          <TabsTrigger value="kasir">Kasir</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          <TabsTrigger value="belum-diambil">Belum diambil</TabsTrigger>
        </TabsList>
        <TabsContent value="kasir">
          <LayarPos jenis="LANGSUNG" idOrderAwal={idOrder} />
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
