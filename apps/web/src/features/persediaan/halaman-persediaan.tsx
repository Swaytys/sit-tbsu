import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabPenyesuaian } from './tab-penyesuaian';

const TAB = ['penyesuaian'] as const;
type Tab = (typeof TAB)[number];

/** Persediaan › Stok Persediaan (docs/04 §4): tab posisi stok, mutasi, kartu stok, penyesuaian. */
export function HalamanPersediaan() {
  const [cari, setCari] = useSearchParams();
  const diminta = cari.get('tab');
  const tab: Tab = TAB.find((t) => t === diminta) ?? 'penyesuaian';

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Stok Persediaan</h1>
        <p className="text-sm text-slate-500">
          Pantau stok dan pergerakannya; saldo awal, opname, koreksi, dan stok rusak lewat
          penyesuaian.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setCari({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="penyesuaian">Penyesuaian</TabsTrigger>
        </TabsList>
        <TabsContent value="penyesuaian">
          <TabPenyesuaian />
        </TabsContent>
      </Tabs>
    </div>
  );
}
