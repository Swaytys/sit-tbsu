import { useSearchParams } from 'react-router';
import { usePengguna } from '@/api/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabKartu } from './tab-kartu';
import { TabMutasi } from './tab-mutasi';
import { TabPenyesuaian } from './tab-penyesuaian';
import { TabPosisi } from './tab-posisi';
import { TabRusak } from './tab-rusak';
import { TabTertahan } from './tab-tertahan';

const TAB = ['posisi', 'mutasi', 'kartu', 'tertahan', 'rusak', 'penyesuaian'] as const;
type Tab = (typeof TAB)[number];

/**
 * Persediaan › Stok Persediaan (docs/04 §4): posisi stok, riwayat mutasi, kartu stok, stok tertahan,
 * stok rusak, penyesuaian.
 */
export function HalamanPersediaan() {
  const [cari, setCari] = useSearchParams();
  const bolehSesuaikan = usePengguna().izin.includes('persediaan.penyesuaian.kelola');
  const diminta = cari.get('tab');
  const tab: Tab = TAB.find((t) => t === diminta) ?? 'posisi';

  return (
    <div className="space-y-4 p-6 print:p-0">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-slate-900">Stok Persediaan</h1>
        <p className="text-sm text-slate-500">
          Pantau stok dan pergerakannya; saldo awal, opname, koreksi, dan stok rusak lewat
          penyesuaian.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setCari({ tab: v }, { replace: true })}>
        <TabsList className="print:hidden">
          <TabsTrigger value="posisi">Posisi stok</TabsTrigger>
          <TabsTrigger value="mutasi">Mutasi</TabsTrigger>
          <TabsTrigger value="kartu">Kartu stok</TabsTrigger>
          <TabsTrigger value="tertahan">Stok tertahan</TabsTrigger>
          <TabsTrigger value="rusak">Stok rusak</TabsTrigger>
          {bolehSesuaikan && <TabsTrigger value="penyesuaian">Penyesuaian</TabsTrigger>}
        </TabsList>
        <TabsContent value="posisi">
          <TabPosisi />
        </TabsContent>
        <TabsContent value="mutasi">
          <TabMutasi />
        </TabsContent>
        <TabsContent value="kartu">
          <TabKartu />
        </TabsContent>
        <TabsContent value="tertahan">
          <TabTertahan />
        </TabsContent>
        <TabsContent value="rusak">
          <TabRusak />
        </TabsContent>
        {bolehSesuaikan && (
          <TabsContent value="penyesuaian">
            <TabPenyesuaian />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
