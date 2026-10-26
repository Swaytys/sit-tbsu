import {
  JENIS_INTERAKSI,
  type BarisInteraksi,
  type JenisInteraksi,
  type TingkatLogInteraksi,
} from '@sit/shared';
import { FileSpreadsheet, FileText, Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import {
  useDaftarInteraksi,
  useRingkasanInteraksi,
  useUbahSetelanInteraksi,
} from '@/api/interaksi';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarPengguna } from '@/api/pengguna';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatWaktu } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

const LABEL_JENIS: Record<JenisInteraksi, string> = {
  HALAMAN: 'Halaman',
  KLIK: 'Klik',
  TOMBOL: 'Pintasan',
  CARI: 'Cari',
  DIALOG: 'Dialog',
  GALAT: 'Galat',
};

const kelasPilih =
  'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

/** Angka dibaca sesuai jenisnya: lama (detik) untuk halaman/dialog, jumlah hasil untuk cari. */
function teksAngka(b: BarisInteraksi): string {
  if (b.angka === null) return '—';
  if (b.jenis === 'HALAMAN' || b.jenis === 'DIALOG') {
    const detik = Math.round(b.angka / 1000);
    return detik >= 60 ? `${Math.floor(detik / 60)} m ${detik % 60} d` : `${detik} d`;
  }
  if (b.jenis === 'CARI') return `${b.angka} hasil`;
  return String(b.angka);
}

const KOLOM: KolomTabel<BarisInteraksi>[] = [
  {
    kunci: 'waktu',
    judul: 'Waktu',
    className: 'w-36',
    sel: (b) => (
      <span className="text-xs whitespace-nowrap text-slate-600">{formatWaktu(b.waktu)}</span>
    ),
  },
  {
    kunci: 'pengguna',
    judul: 'Pengguna',
    className: 'w-40',
    sel: (b) => (
      <span>
        {b.namaPengguna} <span className="text-xs text-slate-400">{b.peran.toLowerCase()}</span>
      </span>
    ),
  },
  {
    kunci: 'jenis',
    judul: 'Jenis',
    className: 'w-24',
    sel: (b) => (
      <Badge
        variant="outline"
        className={b.jenis === 'GALAT' ? 'border-red-200 bg-red-50 text-red-700' : ''}
      >
        {LABEL_JENIS[b.jenis]}
      </Badge>
    ),
  },
  {
    kunci: 'halaman',
    judul: 'Halaman',
    className: 'w-40',
    sel: (b) => <span className="font-mono text-xs">{b.halaman}</span>,
  },
  {
    kunci: 'elemen',
    judul: 'Elemen / keterangan',
    className: 'whitespace-normal',
    sel: (b) => (
      <span className="text-sm">
        {b.elemen ?? '—'}
        {b.keterangan && <span className="ml-1 text-xs text-slate-500">· {b.keterangan}</span>}
      </span>
    ),
  },
  {
    kunci: 'angka',
    judul: 'Lama / hasil',
    className: 'w-24 text-right',
    sel: (b) => <span className="text-xs tabular-nums">{teksAngka(b)}</span>,
  },
];

function KartuSetelan() {
  const ringkas = useRingkasanInteraksi();
  const ubah = useUbahSetelanInteraksi();
  const r = ringkas.data;
  const [aktif, setAktif] = useState<boolean | null>(null);
  const [tingkat, setTingkat] = useState<TingkatLogInteraksi | null>(null);
  const nilaiAktif = aktif ?? r?.aktif ?? false;
  const nilaiTingkat = tingkat ?? r?.tingkat ?? 'SEMUA';
  const berubah = r !== undefined && (nilaiAktif !== r.aktif || nilaiTingkat !== r.tingkat);

  function simpan() {
    ubah
      .mutateAsync({ aktif: nilaiAktif, tingkat: nilaiTingkat })
      .then((h) => {
        setAktif(null);
        setTingkat(null);
        toast.success(h.aktif ? 'Log interaksi dinyalakan.' : 'Log interaksi dimatikan.');
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Card className="gap-3 p-4">
      <div>
        <h2 className="font-semibold">Log interaksi untuk penelitian</h2>
        <p className="text-sm text-slate-600">
          Mencatat cara aplikasi dipakai: halaman yang dibuka dan lamanya, tombol/menu yang diklik,
          tombol pintasan, dialog dibuka dan ditutup, pencarian (jumlah hasil; kata hanya untuk
          pencarian barang), dan pesan galat yang tampil. <b>Tidak dicatat:</b> isi kotak isian,
          password, nominal uang, dan data pribadi. Setiap pengguna diberi tahu saat masuk bahwa
          pemakaiannya dicatat. Terpisah dari Log aktivitas (catatan audit).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            className="size-4"
            checked={nilaiAktif}
            onChange={(e) => setAktif(e.target.checked)}
            aria-label="Catat interaksi untuk penelitian"
          />
          Catat interaksi
        </label>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Tingkat rincian">
          <span className="text-slate-600">Rincian:</span>
          {(
            [
              ['SEMUA', 'Semua elemen yang diklik'],
              ['BERMAKNA', 'Tombol, tautan, menu saja'],
            ] as const
          ).map(([nilai, label]) => (
            <label
              key={nilai}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1',
                nilaiTingkat === nilai ? 'border-blue-600 bg-blue-50' : 'border-slate-300',
              )}
            >
              <input
                type="radio"
                name="tingkat-interaksi"
                checked={nilaiTingkat === nilai}
                onChange={() => setTingkat(nilai)}
              />
              {label}
            </label>
          ))}
        </div>
        <Button size="sm" disabled={!berubah || ubah.isPending} onClick={simpan}>
          <Save /> {ubah.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
      {r && (
        <p className="text-xs text-slate-500" data-testid="ringkasan-interaksi">
          Status:{' '}
          <b className={r.aktif ? 'text-emerald-700' : ''}>{r.aktif ? 'menyala' : 'mati'}</b> ·
          terkumpul {r.jumlah.toLocaleString('id-ID')} kejadian dari {r.jumlahPengguna} pengguna
          {r.pertama && r.terakhir
            ? ` (${formatWaktu(r.pertama)} s.d. ${formatWaktu(r.terakhir)})`
            : ''}
          . Data disimpan seluruhnya; lama penyimpanan belum dibatasi.
        </p>
      )}
    </Card>
  );
}

/** K-190: Pengaturan › Log interaksi (Owner, izin `sistem.log.lihat`). */
export function TabInteraksi() {
  const [jenis, setJenis] = useState<JenisInteraksi | ''>('');
  const [idPengguna, setIdPengguna] = useState('');
  const [lokasi, setLokasi] = useState('');
  const lokasiTertunda = useTunda(lokasi, 300);
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [halaman, setHalaman] = useState(1);
  const perHalaman = useBarisPerHalaman();
  const pengguna = useDaftarPengguna({ cari: '', status: 'SEMUA', halaman: 1, perHalaman: 100 });
  const saring = {
    jenis: jenis || undefined,
    idPengguna: idPengguna ? Number(idPengguna) : undefined,
    lokasi: lokasiTertunda,
    dari,
    sampai,
  };
  const daftar = useDaftarInteraksi({ ...saring, halaman, perHalaman });
  const kueri = (format: 'XLSX' | 'CSV') =>
    new URLSearchParams(
      Object.entries({
        jenis,
        idPengguna,
        lokasi: lokasiTertunda,
        dari,
        sampai,
        format,
      }).filter(([, v]) => v !== ''),
    ).toString();
  const ulangHalaman =
    <T,>(f: (v: T) => void) =>
    (v: T) => {
      f(v);
      setHalaman(1);
    };

  return (
    <div className="space-y-4">
      <KartuSetelan />
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
          <select
            className={kelasPilih}
            value={jenis}
            onChange={(e) => ulangHalaman(setJenis)(e.target.value as JenisInteraksi | '')}
            aria-label="Saring jenis interaksi"
          >
            <option value="">Semua jenis</option>
            {JENIS_INTERAKSI.map((j) => (
              <option key={j} value={j}>
                {LABEL_JENIS[j]}
              </option>
            ))}
          </select>
          <select
            className={kelasPilih}
            value={idPengguna}
            onChange={(e) => ulangHalaman(setIdPengguna)(e.target.value)}
            aria-label="Saring pengguna"
          >
            <option value="">Semua pengguna</option>
            {(pengguna.data?.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.namaPengguna}
              </option>
            ))}
          </select>
          <Input
            className="h-9 w-44"
            value={lokasi}
            onChange={(e) => ulangHalaman(setLokasi)(e.target.value)}
            placeholder="Halaman, mis. /order"
            aria-label="Saring halaman"
          />
          <label className="flex items-center gap-1 text-xs text-slate-600">
            Dari
            <Input
              type="date"
              className="h-9 w-36"
              value={dari}
              onChange={(e) => ulangHalaman(setDari)(e.target.value)}
              aria-label="Log interaksi dari tanggal"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-600">
            s.d.
            <Input
              type="date"
              className="h-9 w-36"
              value={sampai}
              onChange={(e) => ulangHalaman(setSampai)(e.target.value)}
              aria-label="Log interaksi sampai tanggal"
            />
          </label>
          <div className="ml-auto flex gap-2">
            <a
              href={`/api/log-interaksi/ekspor?${kueri('XLSX')}`}
              download
              className="flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 whitespace-nowrap text-slate-800 hover:bg-slate-50"
            >
              <FileSpreadsheet className="size-4" /> Ekspor Excel
            </a>
            <a
              href={`/api/log-interaksi/ekspor?${kueri('CSV')}`}
              download
              className="flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 whitespace-nowrap text-slate-800 hover:bg-slate-50"
            >
              <FileText className="size-4" /> Ekspor CSV
            </a>
          </div>
        </div>
        <DataTable
          kolom={KOLOM}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(b) => b.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Belum ada interaksi yang tercatat."
        />
      </Card>
    </div>
  );
}
