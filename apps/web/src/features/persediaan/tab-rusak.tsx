import { formatRupiah, subtotalRupiah, type BarisBarang } from '@sit/shared';
import { Flame, Search, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePengguna } from '@/api/auth';
import { useDaftarBarang } from '@/api/barang';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDesimal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';

/**
 * Stok rusak (docs/05 SR1–SR3): barang di bucket RUSAK, tidak bisa dijual. Diselesaikan dengan retur ke
 * pemasok atau pemusnahan (penyesuaian MUSNAH).
 */
export function TabRusak() {
  const izin = usePengguna().izin;
  const bolehRetur = izin.includes('persediaan.retur_pemasok.kelola');
  const bolehMusnah = izin.includes('persediaan.penyesuaian.kelola');
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [halaman, setHalaman] = useState(1);
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarBarang({
    cari: cariTertunda,
    idKategori: null,
    status: 'SEMUA',
    perluTinjau: false,
    adaRusak: true,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const lihatNilai = (daftar.data?.data ?? []).some((b) => b.hppRata2 !== undefined);

  const kolom: KolomTabel<BarisBarang>[] = [
    {
      kunci: 'barang',
      judul: 'Barang',
      sel: (b) => (
        <div>
          <div className="font-medium">{b.namaBarang}</div>
          <div className="font-mono text-xs text-slate-500">{b.kode}</div>
        </div>
      ),
    },
    {
      kunci: 'milik',
      judul: 'Kepemilikan',
      sel: (b) =>
        b.kepemilikan === 'KONSINYASI' ? (
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
            Titipan {b.namaPemasokKonsinyasi}
          </Badge>
        ) : (
          <span className="text-slate-600">Milik toko</span>
        ),
    },
    {
      kunci: 'baik',
      judul: 'Stok baik',
      className: 'text-right tabular-nums',
      sel: (b) => `${formatDesimal(b.stokFisik)} ${b.kodeSatuan}`,
    },
    {
      kunci: 'rusak',
      judul: 'Stok rusak',
      className: 'text-right font-semibold tabular-nums text-red-700',
      sel: (b) => `${formatDesimal(b.stokRusak)} ${b.kodeSatuan}`,
    },
    ...(lihatNilai
      ? [
          {
            kunci: 'nilai',
            judul: 'Nilai (HPP)',
            className: 'text-right tabular-nums',
            sel: (b: BarisBarang) =>
              b.hppRata2 === undefined
                ? '—'
                : formatRupiah(subtotalRupiah(b.stokRusak, b.hppRata2)),
          },
        ]
      : []),
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      sel: (b) => (
        <div className="flex justify-end gap-2">
          {bolehRetur && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/retur-pemasok/baru?barang=${b.id}`}>
                <Undo2 /> Retur ke pemasok
              </Link>
            </Button>
          )}
          {bolehMusnah && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/persediaan/penyesuaian/baru?jenis=MUSNAH&barang=${b.id}`}>
                <Flame /> Musnahkan
              </Link>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <div className="relative w-72 shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
            placeholder="Cari barang rusak…"
            className="pl-8"
            aria-label="Cari stok rusak"
          />
        </div>
        <p className="min-w-0 flex-1 text-sm text-slate-500">
          Barang rusak tidak bisa dijual dan tidak termasuk nilai persediaan. Pindahkan barang ke
          stok rusak lewat Penyesuaian › Stok rusak.
        </p>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(b) => b.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Tidak ada stok rusak."
      />
    </Card>
  );
}
