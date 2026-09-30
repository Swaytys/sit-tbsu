import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabJenisAtribut } from './tab-jenis-atribut';
import { TabKategori } from './tab-kategori';
import { TabMerk } from './tab-merk';
import { TabSatuan } from './tab-satuan';

/** Data Master › Referensi Barang: kategori, merk, satuan, atribut dalam satu halaman bertab (K-063). */
export function HalamanReferensi() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Referensi Barang</h1>
        <p className="text-sm text-slate-500">
          Pilihan tetap untuk data barang. Data yang tidak dipakai lagi dinonaktifkan, tidak
          dihapus.
        </p>
      </div>
      <Tabs defaultValue="kategori">
        <TabsList>
          <TabsTrigger value="kategori">Kategori</TabsTrigger>
          <TabsTrigger value="merk">Merk</TabsTrigger>
          <TabsTrigger value="satuan">Satuan</TabsTrigger>
          <TabsTrigger value="atribut">Atribut</TabsTrigger>
        </TabsList>
        <TabsContent value="kategori">
          <TabKategori />
        </TabsContent>
        <TabsContent value="merk">
          <TabMerk />
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
