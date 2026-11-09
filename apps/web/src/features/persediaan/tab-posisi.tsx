import {
  formatRupiah,
  STATUS_STOK,
  type BarisPosisiStok,
  type Kepemilikan,
  type StatusStok,
} from '@sit/shared';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { queryStok, useDaftarStok } from '@/api/persediaan';
import { useDaftarKategori } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { BadgeStatusStok } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { teksLapisanSegel } from '@/lib/segel';
import { LABEL_STATUS_STOK } from '@/lib/label';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

const SEMUA = 'SEMUA';

const WARNA_KARTU: Record<StatusStok, string> = {
  HABIS: 'text-red-700',
  KRITIS: 'text-orange-700',
  PERLU_RESTOCK: 'text-amber-700',
  AMAN: 'text-green-700',
};

function statusDariUrl(nilai: string | null): StatusStok | null {
  return STATUS_STOK.find((s) => s === nilai) ?? null;
}

/** Posisi stok per barang aktif (docs/01 §6, ST1): fisik, dipesan, tersedia, rusak, status. */
export function TabPosisi() {
  const [url, setUrl] = useSearchParams();
  const statusStok = statusDariUrl(url.get('status'));
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [idKategori, setIdKategori] = useState<number | null>(null);
  const [kepemilikan, setKepemilikan] = useState<Kepemilikan | null>(null);
  const [halaman, setHalaman] = useState(1);
  const barisPerHalaman = useBarisPerHalaman();
  const kategori = useDaftarKategori('AKTIF');
  const saringan = { cari: cariTertunda, idKategori, statusStok, kepemilikan };
  const daftar = useDaftarStok({ ...saringan, halaman, perHalaman: barisPerHalaman });
  const ringkasan = daftar.data?.ringkasan;
  const lihatNilai = ringkasan?.nilaiPersediaan !== undefined;

  function aturStatus(s: StatusStok | null) {
    setUrl(s ? { tab: 'posisi', status: s } : { tab: 'posisi' }, { replace: true });
    setHalaman(1);
  }

  const kueriEkspor = new URLSearchParams(
    Object.entries(queryStok(saringan)).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();

  const angka = (nilai: string, kelas?: string) => (
    <span className={cn('tabular-nums', kelas)}>{formatDesimal(nilai)}</span>
  );

  const kolom: KolomTabel<BarisPosisiStok>[] = [
    {
      kunci: 'barang',
      judul: 'Barang',
      sel: (b) => (
        <div>
          <Link
            to={`/persediaan?tab=kartu&barang=${b.idBarang}`}
            className="font-medium text-blue-700 hover:underline"
            title="Buka kartu stok"
          >
            {b.namaBarang}
          </Link>
          <div className="font-mono text-xs text-slate-500">
            {b.kode} · {b.namaKategori}
            {b.kepemilikan === 'KONSINYASI' && ' · konsinyasi'}
          </div>
        </div>
      ),
    },
    { kunci: 'satuan', judul: 'Satuan', sel: (b) => b.kodeSatuan },
    {
      kunci: 'fisik',
      judul: 'Fisik',
      className: 'text-right',
      sel: (b) => (
        <>
          {angka(b.stokFisik, 'font-medium')}
          {b.segel && (
            <div className="text-xs text-slate-500">
              {teksLapisanSegel(b.stokFisik, b.stokSegel, b.segel)}
            </div>
          )}
        </>
      ),
    },
    {
      kunci: 'dipesan',
      judul: 'Dipesan',
      className: 'text-right',
      sel: (b) => angka(b.stokDipesan, 'text-slate-500'),
    },
    {
      kunci: 'tersedia',
      judul: 'Tersedia',
      className: 'text-right',
      sel: (b) => angka(b.stokTersedia, 'font-medium'),
    },
    {
      kunci: 'rusak',
      judul: 'Rusak',
      className: 'text-right',
      sel: (b) => angka(b.stokRusak, 'text-slate-500'),
    },
    {
      kunci: 'minimum',
      judul: 'Min.',
      className: 'text-right',
      sel: (b) => angka(b.stokMinimum, 'text-slate-500'),
    },
    { kunci: 'status', judul: 'Status', sel: (b) => <BadgeStatusStok status={b.statusStok} /> },
    ...(lihatNilai
      ? [
          {
            kunci: 'hpp',
            judul: 'HPP',
            className: 'text-right tabular-nums',
            sel: (b: BarisPosisiStok) => formatRupiah(b.hppRata2 ?? 0),
          },
          {
            kunci: 'nilai',
            judul: 'Nilai',
            className: 'text-right tabular-nums',
            sel: (b: BarisPosisiStok) =>
              b.kepemilikan === 'KONSINYASI' ? (
                <span className="text-xs text-slate-400">titipan</span>
              ) : (
                formatRupiah(b.nilaiPersediaan ?? 0)
              ),
          },
        ]
      : []),
    {
      kunci: 'mutasi',
      judul: 'Mutasi terakhir',
      sel: (b) => <span className="text-xs text-slate-500">{formatWaktu(b.terakhirMutasi)}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'grid grid-cols-2 gap-3 sm:grid-cols-4',
          lihatNilai ? 'lg:grid-cols-5' : 'lg:grid-cols-4',
        )}
      >
        {(['HABIS', 'KRITIS', 'PERLU_RESTOCK', 'AMAN'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => aturStatus(statusStok === s ? null : s)}
            aria-pressed={statusStok === s}
            className={cn(
              'rounded-lg border bg-white p-3 text-left transition-colors hover:border-blue-300',
              statusStok === s && 'border-blue-500 ring-1 ring-blue-500',
            )}
          >
            <div className="text-xs text-slate-500">{LABEL_STATUS_STOK[s]}</div>
            <div className={cn('text-2xl font-semibold tabular-nums', WARNA_KARTU[s])}>
              {ringkasan?.perStatus[s] ?? '—'}
            </div>
          </button>
        ))}
        {lihatNilai && (
          <div className="rounded-lg border bg-white p-3">
            <div className="text-xs text-slate-500">Nilai persediaan milik toko</div>
            <div className="text-lg font-semibold text-slate-900 tabular-nums">
              {formatRupiah(ringkasan.nilaiPersediaan ?? 0)}
            </div>
          </div>
        )}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(1);
              }}
              placeholder="Cari kode, nama, barcode…"
              className="pl-8"
              aria-label="Cari stok barang"
            />
          </div>
          <Select
            value={idKategori === null ? SEMUA : String(idKategori)}
            onValueChange={(v) => {
              setIdKategori(v === SEMUA ? null : Number(v));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Saring kategori">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua kategori</SelectItem>
              {(kategori.data ?? []).map((k) => (
                <SelectItem key={k.id} value={String(k.id)}>
                  {k.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusStok ?? SEMUA}
            onValueChange={(v) => aturStatus(v === SEMUA ? null : statusDariUrl(v))}
          >
            <SelectTrigger className="w-40" aria-label="Saring status stok">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua status</SelectItem>
              {STATUS_STOK.map((s) => (
                <SelectItem key={s} value={s}>
                  {LABEL_STATUS_STOK[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={kepemilikan ?? SEMUA}
            onValueChange={(v) => {
              setKepemilikan(v === SEMUA ? null : (v as Kepemilikan));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Saring kepemilikan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua kepemilikan</SelectItem>
              <SelectItem value="MILIK_SENDIRI">Milik sendiri</SelectItem>
              <SelectItem value="KONSINYASI">Konsinyasi</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" asChild>
            <a href={`/api/stok/ekspor${kueriEkspor ? `?${kueriEkspor}` : ''}`} download>
              <Download /> Ekspor Excel
            </a>
          </Button>
        </div>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(b) => b.idBarang}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Tidak ada barang yang cocok."
        />
      </Card>
    </div>
  );
}
