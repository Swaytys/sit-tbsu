import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabJenisAtribut } from './tab-jenis-atribut';
import { TabKategori } from './tab-kategori';
import { TabSatuan } from './tab-satuan';

/** Data Master › Kategori, Satuan & Atribut: satu halaman dengan tab (docs/04 §4). */
export function HalamanReferensi() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Kategori, Satuan &amp; Atribut</h1>
        <p className="text-sm text-slate-500">
          Data referensi untuk barang. Data yang tidak dipakai lagi dinonaktifkan, tidak dihapus.
        </p>
      </div>
      <Tabs defaultValue="kategori">
        <TabsList>
          <TabsTrigger value="kategori">Kategori</TabsTrigger>
          <TabsTrigger value="satuan">Satuan</TabsTrigger>
          <TabsTrigger value="atribut">Jenis atribut</TabsTrigger>
        </TabsList>
        <TabsContent value="kategori">
          <TabKategori />
        </TabsContent>
        <TabsContent value="satuan">
          <TabSatuan />
        </TabsContent>
        <TabsContent value="atribut">
          <TabJenisAtribut />
        </TabsContent>
      </Tabs>
    </div>
  );
}
