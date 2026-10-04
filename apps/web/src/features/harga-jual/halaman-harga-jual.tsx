import { useSearchParams } from 'react-router';
import { usePengguna } from '@/api/auth';
import { useTinjauHarga } from '@/api/barang';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabHargaTier } from './tab-harga-tier';
import { TabTinjauHarga } from './tab-tinjau-harga';

/**
 * Harga Jual (docs/06 H13, docs/04 §4): tab harga per tier, dan tab Tinjau Harga (H6) untuk pemegang
 * `master.harga.tinjau` + `master.barang.lihat_hpp`. Tab aktif disimpan di URL (?tab=).
 */
export function HalamanHargaJual() {
  const [url, setUrl] = useSearchParams();
  const pengguna = usePengguna();
  const bolehTinjau =
    pengguna.izin.includes('master.harga.tinjau') &&
    pengguna.izin.includes('master.barang.lihat_hpp');
  const tab = bolehTinjau && url.get('tab') === 'tinjau' ? 'tinjau' : 'harga';

  const tier = useDaftarTingkatHarga();
  const tierAktif = (tier.data ?? []).filter((t) => t.statusAktif === 'AKTIF');
  const jumlahTinjau =
    useTinjauHarga({ cari: '', idKategori: null, halaman: 1, perHalaman: 1 }, bolehTinjau).data
      ?.meta.total ?? 0;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Harga Jual</h1>
        <p className="text-sm text-slate-500">
          Harga per tier untuk setiap barang aktif. Harga markup dihitung dari dasar harga modal.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="harga">Harga per tier</TabsTrigger>
          {bolehTinjau && (
            <TabsTrigger value="tinjau">
              Tinjau Harga
              {jumlahTinjau > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 bg-orange-500 px-1.5 text-white">
                  {jumlahTinjau}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>
        {/* Tetap terpasang saat tab lain dibuka agar perubahan sel yang belum disimpan tidak hilang. */}
        <TabsContent value="harga" forceMount className="data-[state=inactive]:hidden">
          <TabHargaTier tierAktif={tierAktif} />
        </TabsContent>
        {bolehTinjau && (
          <TabsContent value="tinjau">
            <TabTinjauHarga tierAktif={tierAktif} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
