import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayarKasir } from './layar-kasir';
import { TabRiwayatPenjualan } from './tab-riwayat-penjualan';

const TAB = ['kasir', 'riwayat', 'belum-diambil'] as const;
type Tab = (typeof TAB)[number];

/** Transaksi › Penjualan Langsung: layar kasir, riwayat, dan barang belum diambil (P11). */
export function HalamanPenjualanLangsung() {
  const [url, setUrl] = useSearchParams();
  const idOrder = Number(url.get('order')) || null;
  const diminta = url.get('tab');
  const tab: Tab = idOrder ? 'kasir' : (TAB.find((t) => t === diminta) ?? 'kasir');

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <Tabs
        value={tab}
        onValueChange={(v) => setUrl(v === 'kasir' ? {} : { tab: v }, { replace: true })}
        className="flex flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="kasir">Kasir</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          <TabsTrigger value="belum-diambil">Belum diambil</TabsTrigger>
        </TabsList>
        <TabsContent value="kasir" className="flex flex-1 flex-col">
          <LayarKasir key={idOrder ?? 'keranjang'} idOrder={idOrder} />
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
