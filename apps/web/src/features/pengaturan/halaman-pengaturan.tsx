import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { usePengaturan } from '@/api/pengaturan';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { bolehAkses } from '@/lib/menu';
import { FormHarga } from './form-harga';
import { FormKeamanan } from './form-keamanan';
import { FormOperasional } from './form-operasional';
import { FormPenomoran } from './form-penomoran';
import { FormProfil } from './form-profil';
import { TabLog } from './tab-log';

/** Pengaturan sistem (Admin, Owner). Tab "Log Aktivitas" hanya bila `sistem.log.lihat` (docs/04 §4). */
export function HalamanPengaturan() {
  const pengguna = usePengguna();
  const pengaturan = usePengaturan();
  const bolehLihatLog = bolehAkses(pengguna, 'sistem.log.lihat');

  return (
    <div className="max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Pengaturan sistem</h1>
        <p className="text-sm text-slate-500">
          Profil toko, penomoran dokumen, dan aturan operasional. Setiap perubahan tercatat di log.
        </p>
      </div>

      {pengaturan.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full max-w-xl" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : pengaturan.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-red-600">{pesanGalat(pengaturan.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void pengaturan.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="profil">
          <TabsList>
            <TabsTrigger value="profil">Profil toko</TabsTrigger>
            <TabsTrigger value="penomoran">Penomoran</TabsTrigger>
            <TabsTrigger value="operasional">Operasional</TabsTrigger>
            <TabsTrigger value="harga">Harga &amp; diskon</TabsTrigger>
            <TabsTrigger value="keamanan">Keamanan</TabsTrigger>
            {bolehLihatLog && <TabsTrigger value="log">Log aktivitas</TabsTrigger>}
          </TabsList>
          <TabsContent value="profil">
            <FormProfil pengaturan={pengaturan.data} />
          </TabsContent>
          <TabsContent value="penomoran">
            <FormPenomoran pengaturan={pengaturan.data} />
          </TabsContent>
          <TabsContent value="operasional">
            <FormOperasional pengaturan={pengaturan.data} />
          </TabsContent>
          <TabsContent value="harga">
            <FormHarga pengaturan={pengaturan.data} />
          </TabsContent>
          <TabsContent value="keamanan">
            <FormKeamanan pengaturan={pengaturan.data} />
          </TabsContent>
          {bolehLihatLog && (
            <TabsContent value="log">
              <TabLog />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
