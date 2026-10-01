import { formatRupiah, JENIS_MUTASI, type BarisMutasi, type JenisMutasi } from '@sit/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarMutasi } from '@/api/persediaan';
import { DataTable, type KolomTabel } from '@/components/data-table';
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
import { LABEL_JENIS_MUTASI } from '@/lib/label';
import { useTunda } from '@/lib/use-tunda';
import { TautanDokumen } from './tautan-dokumen';

const SEMUA = 'SEMUA';

/** Riwayat mutasi semua barang dari ledger (docs/05 L3), terbaru di atas. */
export function TabMutasi() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [jenis, setJenis] = useState<JenisMutasi | null>(null);
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [halaman, setHalaman] = useState(1);
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarMutasi({
    cari: cariTertunda,
    idBarang: null,
    jenis,
    dari,
    sampai,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const lihatHpp = daftar.data?.data[0]?.hppSatuan !== undefined;

  const kolom: KolomTabel<BarisMutasi>[] = [
    {
      kunci: 'waktu',
      judul: 'Waktu',
      sel: (m) => <span className="text-xs whitespace-nowrap">{formatWaktu(m.waktu)}</span>,
    },
    {
      kunci: 'barang',
      judul: 'Barang',
      sel: (m) => (
        <div>
          <div className="font-medium">{m.namaBarang}</div>
          <div className="font-mono text-xs text-slate-500">{m.kodeBarang}</div>
        </div>
      ),
    },
    {
      kunci: 'jenis',
      judul: 'Jenis',
      sel: (m) => (
        <span>
          {LABEL_JENIS_MUTASI[m.jenis]}
          {m.kondisi === 'RUSAK' && <span className="text-xs text-orange-700"> (rusak)</span>}
        </span>
      ),
    },
    { kunci: 'dokumen', judul: 'Dokumen', sel: (m) => <TautanDokumen m={m} /> },
    {
      kunci: 'masuk',
      judul: 'Masuk',
      className: 'text-right tabular-nums',
      sel: (m) =>
        m.qtyMasuk === '0.000' ? (
          ''
        ) : (
          <span className="text-green-700">+{formatDesimal(m.qtyMasuk)}</span>
        ),
    },
    {
      kunci: 'keluar',
      judul: 'Keluar',
      className: 'text-right tabular-nums',
      sel: (m) =>
        m.qtyKeluar === '0.000' ? (
          ''
        ) : (
          <span className="text-red-700">−{formatDesimal(m.qtyKeluar)}</span>
        ),
    },
    {
      kunci: 'saldo',
      judul: 'Saldo',
      className: 'text-right tabular-nums font-medium',
      sel: (m) => `${formatDesimal(m.saldoSetelah)} ${m.kodeSatuan}`,
    },
    ...(lihatHpp
      ? [
          {
            kunci: 'hpp',
            judul: 'HPP satuan',
            className: 'text-right tabular-nums',
            sel: (m: BarisMutasi) => formatRupiah(m.hppSatuan ?? 0),
          },
        ]
      : []),
    { kunci: 'oleh', judul: 'Oleh', sel: (m) => m.namaPengguna },
    {
      kunci: 'keterangan',
      judul: 'Keterangan',
      sel: (m) => <span className="text-xs text-slate-600">{m.keterangan ?? ''}</span>,
    },
  ];

  return (
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
            placeholder="Cari kode atau nama barang…"
            className="pl-8"
            aria-label="Cari mutasi barang"
          />
        </div>
        <Select
          value={jenis ?? SEMUA}
          onValueChange={(v) => {
            setJenis(v === SEMUA ? null : (v as JenisMutasi));
            setHalaman(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Saring jenis mutasi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua jenis</SelectItem>
            {JENIS_MUTASI.map((j) => (
              <SelectItem key={j} value={j}>
                {LABEL_JENIS_MUTASI[j]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Input
            type="date"
            value={dari}
            onChange={(e) => {
              setDari(e.target.value);
              setHalaman(1);
            }}
            className="w-40"
            aria-label="Dari tanggal"
          />
          s/d
          <Input
            type="date"
            value={sampai}
            onChange={(e) => {
              setSampai(e.target.value);
              setHalaman(1);
            }}
            className="w-40"
            aria-label="Sampai tanggal"
          />
        </div>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(m) => m.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada mutasi stok."
      />
    </Card>
  );
}
