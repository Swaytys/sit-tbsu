import {
  formatRupiah,
  type BarisDaftarPenyelesaianKonsinyasi,
  type RingkasanKonsinyasiPemasok,
} from '@sit/shared';
import { Download, HandCoins, PackagePlus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useDaftarPenyelesaianKonsinyasi, useRingkasanKonsinyasi } from '@/api/konsinyasi';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatTanggal, formatWaktu } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { BadgeStatusHutang } from '../hutang/halaman-hutang';

const TAB = ['posisi', 'riwayat'] as const;
type Tab = (typeof TAB)[number];

/** Persediaan › Konsinyasi (docs/06 KS5–KS8): posisi titipan per pemasok dan setoran ke pemasok. */
export function HalamanKonsinyasi() {
  const [url, setUrl] = useSearchParams();
  const diminta = url.get('tab');
  const tab: Tab = TAB.find((t) => t === diminta) ?? 'posisi';
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Konsinyasi (barang titipan)</h1>
          <p className="text-sm text-slate-500">
            Barang milik pemasok yang dititipkan untuk dijual. Toko hanya membayar yang laku.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/barang/baru?titipan=">
              <PackagePlus /> Daftarkan barang titipan
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/penerimaan/baru?jenis=KONSINYASI">
              <Download /> Terima barang titipan
            </Link>
          </Button>
        </div>
      </div>
      <ol className="grid grid-cols-4 gap-2 text-xs text-slate-600" aria-label="Alur konsinyasi">
        {[
          [
            'Daftarkan barang',
            'Data Barang › Kepemilikan: Titipan, pilih penitip dan harga titip.',
          ],
          ['Terima barang', 'Penerimaan › jenis Konsinyasi. Tidak menjadi hutang.'],
          ['Jual seperti biasa', 'Retur pelanggan otomatis mengurangi yang harus disetor.'],
          ['Setor & bayar', 'Buat setoran per penitip di sini, lalu bayar.'],
        ].map(([judul, isi], i) => (
          <li key={judul} className="rounded-md border bg-white px-3 py-2">
            <span className="font-semibold text-slate-800">
              {i + 1}. {judul}
            </span>
            <div>{isi}</div>
          </li>
        ))}
      </ol>
      <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="posisi">Posisi per pemasok</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat setoran</TabsTrigger>
        </TabsList>
        <TabsContent value="posisi">
          <TabPosisi />
        </TabsContent>
        <TabsContent value="riwayat">
          <TabRiwayat />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabPosisi() {
  const ringkasan = useRingkasanKonsinyasi();
  if (ringkasan.isLoading) return <Skeleton className="h-40 w-full" />;
  const data: RingkasanKonsinyasiPemasok[] = ringkasan.data ?? [];
  const jumlah = (f: (r: RingkasanKonsinyasiPemasok) => number) =>
    data.reduce((t, r) => t + f(r), 0);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pemasok penitip</TableHead>
            <TableHead className="text-right">Barang titipan</TableHead>
            <TableHead className="text-right">Nilai stok titipan</TableHead>
            <TableHead className="text-right">Belum disetor</TableHead>
            <TableHead className="text-right">Sisa hutang setoran</TableHead>
            <TableHead>Disetor s/d</TableHead>
            <TableHead className="w-52" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                Belum ada barang titipan. Mulai dari &quot;Daftarkan barang titipan&quot; di atas.
              </TableCell>
            </TableRow>
          )}
          {data.map((r) => (
            <TableRow key={r.idPemasok}>
              <TableCell className="font-medium">{r.namaPemasok}</TableCell>
              <TableCell className="text-right tabular-nums">{r.jumlahBarang}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRupiah(r.nilaiStokTitipan)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatRupiah(r.nilaiBelumDisetor)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.sisaHutang > 0 ? (
                  <Link
                    to={`/hutang?pemasok=${r.idPemasok}`}
                    className="text-blue-700 hover:underline"
                  >
                    {formatRupiah(r.sisaHutang)}
                  </Link>
                ) : (
                  formatRupiah(0)
                )}
              </TableCell>
              <TableCell>
                {r.terakhirDisetor ? formatTanggal(r.terakhirDisetor) : 'Belum pernah'}
              </TableCell>
              <TableCell className="space-x-1 text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" asChild>
                  <Link
                    to={`/penerimaan/baru?jenis=KONSINYASI&pemasok=${r.idPemasok}`}
                    aria-label={`Terima barang titipan ${r.namaPemasok}`}
                    title="Terima barang titipan dari penitip ini"
                  >
                    <Download />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant={r.nilaiBelumDisetor > 0 ? 'default' : 'outline'}
                  disabled={r.nilaiBelumDisetor === 0}
                  asChild={r.nilaiBelumDisetor > 0}
                >
                  {r.nilaiBelumDisetor > 0 ? (
                    <Link
                      to={`/konsinyasi/baru?pemasok=${r.idPemasok}`}
                      aria-label={`Buat setoran ${r.namaPemasok}`}
                    >
                      <HandCoins /> Buat setoran
                    </Link>
                  ) : (
                    <>
                      <HandCoins /> Buat setoran
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {data.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Jumlah</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">
                {formatRupiah(jumlah((r) => r.nilaiStokTitipan))}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatRupiah(jumlah((r) => r.nilaiBelumDisetor))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRupiah(jumlah((r) => r.sisaHutang))}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
      <p className="border-t p-3 text-xs text-slate-500">
        Nilai stok titipan = stok titipan (baik dan rusak) × harga titip saat ini; bukan aset toko.
        Belum disetor = penjualan titipan + barang titipan yang dimusnahkan toko, sebelum dikurangi
        retur pelanggan.
      </p>
    </Card>
  );
}

function TabRiwayat() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [halaman, setHalaman] = useState(1);
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPenyelesaianKonsinyasi({
    cari: cariTertunda,
    idPemasok: null,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const kolom: KolomTabel<BarisDaftarPenyelesaianKonsinyasi>[] = [
    {
      kunci: 'nomor',
      judul: 'Nomor',
      sel: (k) => (
        <Link
          to={`/konsinyasi/${k.id}`}
          className="font-mono text-xs font-medium text-blue-700 hover:underline"
        >
          {k.nomor}
        </Link>
      ),
    },
    { kunci: 'tanggal', judul: 'Waktu', sel: (k) => formatWaktu(k.tanggal) },
    { kunci: 'pemasok', judul: 'Pemasok', sel: (k) => k.namaPemasok },
    {
      kunci: 'periode',
      judul: 'Periode penjualan',
      sel: (k) => `${formatTanggal(k.periodeMulai)} – ${formatTanggal(k.periodeSelesai)}`,
    },
    {
      kunci: 'total',
      judul: 'Total setoran',
      className: 'text-right tabular-nums',
      sel: (k) => formatRupiah(k.total),
    },
    {
      kunci: 'sisa',
      judul: 'Sisa',
      className: 'text-right font-semibold tabular-nums',
      sel: (k) => formatRupiah(k.sisaHutang),
    },
    { kunci: 'status', judul: 'Status', sel: (k) => <BadgeStatusHutang status={k.statusHutang} /> },
    { kunci: 'oleh', judul: 'Dibuat oleh', sel: (k) => k.namaPengguna },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b p-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
            placeholder="Cari nomor atau pemasok…"
            className="pl-8"
            aria-label="Cari setoran konsinyasi"
          />
        </div>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(k) => k.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada setoran konsinyasi."
      />
    </Card>
  );
}
