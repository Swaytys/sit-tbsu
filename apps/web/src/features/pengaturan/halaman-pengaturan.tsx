import { Compass, ListChecks } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { usePengaturan } from '@/api/pengaturan';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { bolehAkses } from '@/lib/menu';
import { TabPromo } from '../promo/halaman-promo';
import { FormHarga } from './form-harga';
import { FormKeamanan } from './form-keamanan';
import { FormOperasional } from './form-operasional';
import { FormPenomoran } from './form-penomoran';
import { FormDokumen } from './form-dokumen';
import { FormProfil } from './form-profil';
import { KartuLogo } from './kartu-logo';
import { KartuPrinterStruk } from './kartu-printer-struk';
import { TabArsip } from './tab-arsip';
import { TabPemeriksaanData } from './tab-pemeriksaan-data';
import { TabCadangan } from './tab-cadangan';
import { TabAkses } from './tab-akses';
import { TabData } from './tab-data';
import { TabInteraksi } from './tab-interaksi';
import { TabLog } from './tab-log';
import { TabPembayaran } from './tab-pembayaran';
import { TabPersetujuan } from './tab-persetujuan';

/**
 * Pengaturan sistem (Admin, Owner). Tab "Log Aktivitas" bila `sistem.log.lihat`, tab "Cadangan" bila
 * `sistem.cadangan.kelola`, tab "Promo" bila `promo.kelola` (docs/04 §4; promo pindah ke sini di K-110).
 * Tab aktif disimpan di URL (?tab=).
 */
export function HalamanPengaturan() {
  const pengguna = usePengguna();
  // K-225: Administrator Sistem (tanpa pengaturan umum) hanya melihat tab Cadangan dan Akses HP/tablet.
  const bolehUmum = bolehAkses(pengguna, 'sistem.pengaturan.kelola');
  const bolehAksesHp = bolehAkses(pengguna, 'sistem.akses.kelola');
  const pengaturan = usePengaturan(bolehUmum);
  const bolehLihatLog = bolehAkses(pengguna, 'sistem.log.lihat');
  const bolehCadangan = bolehAkses(pengguna, 'sistem.cadangan.kelola');
  const bolehData = bolehAkses(pengguna, 'sistem.data.kelola');
  const bolehPromo = bolehAkses(pengguna, 'promo.kelola');
  const [url, setUrl] = useSearchParams();
  const tab = url.get('tab') ?? (bolehUmum ? 'profil' : bolehCadangan ? 'cadangan' : 'akses');

  if (!bolehUmum) {
    return (
      <div className="max-w-5xl space-y-4 p-6">
        <h1 className="text-xl font-semibold text-slate-900">Pengaturan sistem</h1>
        <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v }, { replace: true })}>
          <TabsList className="h-auto flex-wrap justify-start [&>*]:flex-none">
            {bolehCadangan && <TabsTrigger value="cadangan">Cadangan</TabsTrigger>}
            {bolehAksesHp && <TabsTrigger value="akses">Akses HP/tablet</TabsTrigger>}
          </TabsList>
          {bolehCadangan && (
            <TabsContent value="cadangan">
              <TabCadangan />
            </TabsContent>
          )}
          {bolehAksesHp && (
            <TabsContent value="akses">
              <TabAkses />
            </TabsContent>
          )}
        </Tabs>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 p-6', tab !== 'promo' && 'max-w-5xl')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pengaturan sistem</h1>
          <p className="text-sm text-slate-500">
            Profil toko, penomoran dokumen, dan aturan operasional. Setiap perubahan tercatat di
            log.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/tur">
              <Compass /> Tur & panduan
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/penyiapan">
              <ListChecks /> Panduan penyiapan
            </Link>
          </Button>
        </div>
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
        <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v }, { replace: true })}>
          <TabsList className="h-auto flex-wrap justify-start [&>*]:flex-none">
            <TabsTrigger value="profil">Profil toko</TabsTrigger>
            <TabsTrigger value="struk">Struk &amp; printer</TabsTrigger>
            <TabsTrigger value="penomoran">Penomoran</TabsTrigger>
            <TabsTrigger value="operasional">Operasional</TabsTrigger>
            <TabsTrigger value="pembayaran">Pembayaran</TabsTrigger>
            <TabsTrigger value="harga">Harga dasar</TabsTrigger>
            {bolehPromo && <TabsTrigger value="promo">Promo</TabsTrigger>}
            <TabsTrigger value="keamanan">Keamanan</TabsTrigger>
            <TabsTrigger value="persetujuan">Persetujuan</TabsTrigger>
            <TabsTrigger value="pemeriksaan">Pemeriksaan data</TabsTrigger>
            {bolehCadangan && <TabsTrigger value="cadangan">Cadangan</TabsTrigger>}
            {bolehData && <TabsTrigger value="data">Data toko &amp; pindah komputer</TabsTrigger>}
            {bolehAksesHp && <TabsTrigger value="akses">Akses HP/tablet</TabsTrigger>}
            {bolehData && <TabsTrigger value="arsip">Arsip tahunan</TabsTrigger>}
            {bolehLihatLog && <TabsTrigger value="log">Log aktivitas</TabsTrigger>}
            {bolehLihatLog && <TabsTrigger value="interaksi">Log interaksi</TabsTrigger>}
          </TabsList>
          <TabsContent value="profil">
            <div className="space-y-4">
              <FormProfil pengaturan={pengaturan.data} />
              <KartuLogo />
            </div>
          </TabsContent>
          <TabsContent value="struk">
            <div className="space-y-4">
              <FormProfil pengaturan={pengaturan.data} bagian="struk" />
              <KartuPrinterStruk />
              <FormDokumen pengaturan={pengaturan.data} />
            </div>
          </TabsContent>
          <TabsContent value="penomoran">
            <FormPenomoran pengaturan={pengaturan.data} />
          </TabsContent>
          <TabsContent value="operasional">
            <FormOperasional pengaturan={pengaturan.data} />
          </TabsContent>
          <TabsContent value="pembayaran">
            <TabPembayaran />
          </TabsContent>
          <TabsContent value="harga">
            <FormHarga pengaturan={pengaturan.data} />
          </TabsContent>
          {bolehPromo && (
            <TabsContent value="promo">
              <TabPromo />
            </TabsContent>
          )}
          <TabsContent value="keamanan">
            <FormKeamanan pengaturan={pengaturan.data} />
          </TabsContent>
          <TabsContent value="persetujuan">
            <TabPersetujuan />
          </TabsContent>
          {/* K-220: tab sendiri (dulu memakai nilai "data" yang sama dengan tab Data, sehingga tergabung). */}
          <TabsContent value="pemeriksaan">
            <TabPemeriksaanData />
          </TabsContent>
          {bolehAksesHp && (
            <TabsContent value="akses">
              <TabAkses />
            </TabsContent>
          )}
          {bolehData && (
            <TabsContent value="data">
              <TabData />
            </TabsContent>
          )}
          {bolehCadangan && (
            <TabsContent value="cadangan">
              <TabCadangan />
            </TabsContent>
          )}
          {bolehData && (
            <TabsContent value="arsip">
              <TabArsip />
            </TabsContent>
          )}
          {bolehLihatLog && (
            <TabsContent value="log">
              <TabLog />
            </TabsContent>
          )}
          {bolehLihatLog && (
            <TabsContent value="interaksi">
              <TabInteraksi />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
