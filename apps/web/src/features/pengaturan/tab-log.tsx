import { AKSI_LOG, type AksiLog, type BarisLog } from '@sit/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useDaftarLog } from '@/api/pengaturan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatWaktu } from '@/lib/format';
import { labelAksi } from '@/lib/label';
import { useTunda } from '@/lib/use-tunda';

const SEMUA = 'SEMUA';

function tampil(nilai: unknown): string {
  if (nilai === null || nilai === undefined || nilai === '') return '—';
  return typeof nilai === 'string' ? nilai : JSON.stringify(nilai);
}

/** Perubahan master "kolom: lama → baru" (docs/04 §8). */
function Perubahan({ lama, baru }: { lama: unknown; baru: unknown }) {
  if (typeof baru !== 'object' || baru === null) return null;
  const nilaiLama =
    typeof lama === 'object' && lama !== null ? (lama as Record<string, unknown>) : {};
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
      {Object.entries(baru as Record<string, unknown>).map(([kolom, nilai]) => (
        <li key={kolom}>
          <span className="font-mono">{kolom}</span>:{' '}
          {kolom in nilaiLama && <>{tampil(nilaiLama[kolom])} → </>}
          <span className="text-slate-700">{tampil(nilai)}</span>
        </li>
      ))}
    </ul>
  );
}

const KOLOM: KolomTabel<BarisLog>[] = [
  {
    kunci: 'waktu',
    judul: 'Waktu',
    className: 'w-36 align-top',
    sel: (l) => (
      <span className="text-xs whitespace-nowrap text-slate-600">{formatWaktu(l.waktu)}</span>
    ),
  },
  {
    kunci: 'pengguna',
    judul: 'Pengguna',
    className: 'w-40 align-top',
    sel: (l) =>
      l.namaPengguna ?? (
        <span className="text-slate-400">
          {l.usernamePercobaan ? `“${l.usernamePercobaan}”` : '—'}
        </span>
      ),
  },
  {
    kunci: 'aksi',
    judul: 'Aksi',
    className: 'w-48 align-top',
    sel: (l) => (
      <Badge
        variant="outline"
        className={l.aksi === 'LOGIN_GAGAL' ? 'border-red-200 bg-red-50 text-red-700' : ''}
      >
        {labelAksi(l.aksi)}
      </Badge>
    ),
  },
  {
    kunci: 'ringkasan',
    judul: 'Keterangan',
    className: 'align-top whitespace-normal',
    sel: (l) => (
      <div className="text-sm">
        {l.nomorDokumen && <span className="mr-1 font-mono text-xs">{l.nomorDokumen}</span>}
        {l.ringkasan ?? '—'}
        <Perubahan lama={l.dataLama} baru={l.dataBaru} />
      </div>
    ),
  },
  {
    kunci: 'ip',
    judul: 'IP',
    className: 'w-28 align-top',
    sel: (l) => <span className="font-mono text-xs text-slate-400">{l.ip ?? '—'}</span>,
  },
];

/** Log aktivitas: hanya-baca, hanya Owner (`sistem.log.lihat`, docs/04 §8). */
export function TabLog() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [aksi, setAksi] = useState<AksiLog | ''>('');
  const [halaman, setHalaman] = useState(1);
  const log = useDaftarLog({ cari: cariTertunda, aksi, halaman, perHalaman: 25 });

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-3 border-b p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
            placeholder="Cari keterangan, pengguna, nomor dokumen…"
            className="pl-8"
            aria-label="Cari log"
          />
        </div>
        <Select
          value={aksi || SEMUA}
          onValueChange={(v) => {
            setAksi(v === SEMUA ? '' : (v as AksiLog));
            setHalaman(1);
          }}
        >
          <SelectTrigger className="w-56" aria-label="Saring aksi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua aksi</SelectItem>
            {AKSI_LOG.map((a) => (
              <SelectItem key={a} value={a}>
                {labelAksi(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        kolom={KOLOM}
        data={log.data?.data}
        meta={log.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(l) => l.id}
        memuat={log.isFetching}
        galat={log.error}
        onUlang={() => void log.refetch()}
        kosong="Belum ada aktivitas yang cocok."
      />
    </Card>
  );
}
