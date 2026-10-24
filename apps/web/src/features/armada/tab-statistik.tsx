import { formatRupiah, type StatistikKendaraan, type StatistikSopir } from '@sit/shared';
import { useState } from 'react';
import { useStatistikArmada } from '@/api/armada';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { awalBulanIni, formatDesimal, tanggalHariIni } from '@/lib/format';

/*
 * K-162: statistik armada per kendaraan dan per sopir (docs/13 §5.3). Semua angka dari API.
 */

function lama(menit: number | null): string {
  if (menit === null) return '—';
  const j = Math.floor(menit / 60);
  return j > 0 ? `${j} j ${menit % 60} m` : `${menit} m`;
}

function tepat(t: number, dari: number): string {
  return dari === 0 ? '—' : `${t}/${dari} (${Math.round((t * 100) / dari)}%)`;
}

const kolomKendaraan: KolomTabel<StatistikKendaraan>[] = [
  {
    kunci: 'plat',
    judul: 'Kendaraan',
    sel: (k) => (
      <div>
        <div className="font-mono font-medium">{k.plat}</div>
        <div className="text-xs text-slate-500">{k.jenis}</div>
      </div>
    ),
  },
  {
    kunci: 'rit',
    judul: 'Rit · surat jalan',
    className: 'text-right',
    sel: (k) => `${k.rit} · ${k.suratJalan}`,
  },
  {
    kunci: 'muatan',
    judul: 'Muatan · pakai daya angkut',
    className: 'text-right',
    sel: (k) => (
      <div className="text-right">
        <div>{formatDesimal(k.muatanKg)} kg</div>
        <div className="text-xs text-slate-500">
          {k.rataPakaiPersen === null
            ? 'daya angkut belum diisi'
            : `rata-rata ${k.rataPakaiPersen}%`}
        </div>
      </div>
    ),
  },
  {
    kunci: 'lama',
    judul: 'Di jalan · tepat jadwal',
    className: 'text-right',
    sel: (k) => (
      <div className="text-right">
        <div>{k.rataLamaMenit === null ? '—' : `rata-rata ${lama(k.rataLamaMenit)}`}</div>
        <div className="text-xs text-slate-500">{tepat(k.tepatWaktu, k.berjadwal)}</div>
      </div>
    ),
  },
  {
    kunci: 'biaya',
    judul: 'BBM · servis',
    className: 'text-right',
    sel: (k) => (
      <div className="text-right">
        <div>
          {formatRupiah(k.bbmRp)}{' '}
          <span className="text-xs text-slate-500">({formatDesimal(k.bbmLiter)} L)</span>
        </div>
        <div className="text-xs text-slate-500">servis {formatRupiah(k.servisRp)}</div>
      </div>
    ),
  },
  {
    kunci: 'km',
    judul: 'Km · km/L · per km',
    className: 'text-right',
    sel: (k) => (
      <div className="text-right">
        <div>{k.kmTempuh === null ? '—' : `${k.kmTempuh.toLocaleString('id-ID')} km`}</div>
        <div className="text-xs text-slate-500">
          {k.kmPerLiter === null
            ? 'perlu ≥ 2 odometer'
            : `± ${k.kmPerLiter.replace('.', ',')} km/L`}
          {k.biayaPerKm !== null && ` · ${formatRupiah(k.biayaPerKm)}/km`}
        </div>
      </div>
    ),
  },
];

const kolomSopir: KolomTabel<StatistikSopir>[] = [
  { kunci: 'nama', judul: 'Sopir', sel: (s) => <span className="font-medium">{s.nama}</span> },
  {
    kunci: 'rit',
    judul: 'Rit · surat jalan',
    className: 'text-right',
    sel: (s) => `${s.rit} · ${s.suratJalan}`,
  },
  {
    kunci: 'lama',
    judul: 'Rata-rata di jalan',
    className: 'text-right',
    sel: (s) => lama(s.rataLamaMenit),
  },
  {
    kunci: 'tepat',
    judul: 'Tepat jadwal',
    className: 'text-right',
    sel: (s) => tepat(s.tepatWaktu, s.berjadwal),
  },
  {
    kunci: 'masalah',
    judul: 'Surat jalan bermasalah',
    className: 'text-right',
    sel: (s) => (
      <span className={s.suratJalanBermasalah > 0 ? 'font-medium text-amber-800' : ''}>
        {s.suratJalanBermasalah}
      </span>
    ),
  },
];

export function TabStatistik() {
  const [dari, setDari] = useState(awalBulanIni);
  const [sampai, setSampai] = useState(tanggalHariIni);
  const stat = useStatistikArmada({ dari, sampai });
  return (
    <div className="space-y-3">
      <Card className="flex flex-row flex-wrap items-center gap-3 p-3 text-sm">
        <label className="flex items-center gap-2">
          Dari
          <Input
            type="date"
            className="w-40"
            aria-label="Tanggal awal"
            value={dari}
            max={sampai}
            onChange={(e) => e.target.value && setDari(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          sampai
          <Input
            type="date"
            className="w-40"
            aria-label="Tanggal akhir"
            value={sampai}
            min={dari}
            onChange={(e) => e.target.value && setSampai(e.target.value)}
          />
        </label>
        <p className="text-xs text-slate-500">
          Rit menurut tanggal berangkat. Tepat jadwal = berangkat paling lambat 30 menit dari jadwal
          rit. Km dari odometer catatan BBM/servis dalam periode; km/L adalah perkiraan.
        </p>
      </Card>
      <Card className="gap-0 overflow-hidden py-0">
        <h2 className="border-b px-3 py-2 text-sm font-semibold text-slate-800">Per kendaraan</h2>
        <DataTable
          kolom={kolomKendaraan}
          data={stat.data?.kendaraan}
          kunciBaris={(k) => k.idKendaraan}
          memuat={stat.isFetching}
          galat={stat.error}
          onUlang={() => void stat.refetch()}
          kosong="Tidak ada kendaraan."
        />
      </Card>
      <Card className="gap-0 overflow-hidden py-0">
        <h2 className="border-b px-3 py-2 text-sm font-semibold text-slate-800">Per sopir</h2>
        <DataTable
          kolom={kolomSopir}
          data={stat.data?.sopir}
          kunciBaris={(s) => s.idSopir}
          memuat={stat.isFetching}
          galat={stat.error}
          onUlang={() => void stat.refetch()}
          kosong="Tidak ada sopir."
        />
      </Card>
    </div>
  );
}
