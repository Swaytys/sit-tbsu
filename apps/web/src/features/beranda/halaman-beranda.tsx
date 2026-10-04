import { formatRupiah, LABEL_PERAN, teksTanggalPanjang, type Izin } from '@sit/shared';
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  ClipboardCheck,
  Clock,
  FileText,
  PackagePlus,
  Plus,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { usePengguna } from '@/api/auth';
import { useAktivitasDashboard, useRingkasanDashboard } from '@/api/laporan';
import { useTampilanToko } from '@/api/pengaturan';
import { usePeringatanStok } from '@/api/persediaan';
import { BadgeStatusStok } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { labelAksi } from '@/lib/label';
import { cn } from '@/lib/utils';
import { GrafikTujuhHari } from './grafik-tujuh-hari';

/*
 * Dashboard operasional per peran (docs/05 ST3, mockup Dashboard): kartu ringkasan, grafik penjualan
 * 7 hari, aksi cepat, aktivitas terkini, dan peringatan stok. Kartu yang tampil mengikuti izin; angka
 * omzet hanya untuk `dashboard.omzet` (dikirim API hanya untuk izin itu).
 */

function KartuAngka({
  judul,
  nilai,
  ikon: Ikon,
  warna,
  keterangan,
  ke,
  testId,
}: {
  judul: string;
  nilai: ReactNode;
  ikon: LucideIcon;
  warna: string;
  keterangan: ReactNode;
  ke?: string;
  testId: string;
}) {
  const isi = (
    <Card className="h-full gap-0 p-5 transition-colors hover:border-blue-200">
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{judul}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900" data-testid={testId}>
            {nilai}
          </p>
        </div>
        <div className={cn('shrink-0 rounded-lg p-2', warna)}>
          <Ikon className="size-5" />
        </div>
      </div>
      <div className="mt-auto border-t border-slate-100 pt-2 text-xs font-medium text-slate-600">
        {keterangan}
      </div>
    </Card>
  );
  return ke ? (
    <Link to={ke} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500">
      {isi}
    </Link>
  ) : (
    isi
  );
}

function Banding({ kini, lalu }: { kini: number; lalu: number }) {
  if (lalu === 0) return <span>Kemarin {formatRupiah(0)}</span>;
  const persen = ((kini - lalu) / lalu) * 100;
  const naik = persen >= 0;
  const Ikon = naik ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn('inline-flex items-center gap-1', naik ? 'text-green-700' : 'text-red-700')}
    >
      <Ikon className="size-3.5" />
      {naik ? '+' : '−'}
      {Math.abs(persen).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dibanding kemarin
    </span>
  );
}

type AksiCepat = { label: string; ke: string; ikon: LucideIcon; izin: Izin | Izin[] };

const AKSI_CEPAT: AksiCepat[] = [
  { label: 'Order baru', ke: '/order', ikon: Plus, izin: 'penjualan.order.buat' },
  {
    label: 'Kasir langsung',
    ke: '/penjualan-langsung',
    ikon: ShoppingCart,
    izin: 'penjualan.checkout',
  },
  { label: 'Pengantaran', ke: '/penjualan-pengantaran', ikon: Truck, izin: 'penjualan.checkout' },
  {
    label: 'Terima barang',
    ke: '/penerimaan',
    ikon: PackagePlus,
    izin: 'persediaan.penerimaan.kelola',
  },
  {
    label: 'Persetujuan void',
    ke: '/void?tab=persetujuan',
    ikon: ClipboardCheck,
    izin: 'void.setujui',
  },
  { label: 'Shift & kas', ke: '/shift', ikon: Calculator, izin: 'kas.shift.kelola_sendiri' },
  {
    label: 'Laporan',
    ke: '/laporan',
    ikon: FileText,
    izin: ['laporan.penjualan', 'laporan.persediaan'],
  },
];

function PeringatanStok({ bolehBuka }: { bolehBuka: boolean }) {
  const data = usePeringatanStok(true).data;
  if (!data) return null;
  const jumlah = data.habis + data.kritis;
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-slate-800 uppercase">
            Peringatan stok
          </h2>
          <p className="text-xs text-slate-500">
            {data.habis} habis · {data.kritis} kritis · {data.perluRestock} perlu restock
          </p>
        </div>
        <AlertTriangle
          className={jumlah > 0 ? 'size-5 text-orange-600' : 'size-5 text-slate-300'}
        />
      </div>
      {data.barang.length > 0 ? (
        <ul className="divide-y text-sm">
          {data.barang.map((b) => (
            <li key={b.idBarang} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 truncate">{b.namaBarang}</span>
              <span className="text-xs text-slate-500 tabular-nums">
                {formatDesimal(b.stokFisik)} / min {formatDesimal(b.stokMinimum)} {b.kodeSatuan}
              </span>
              <BadgeStatusStok status={b.statusStok} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Semua stok aman.</p>
      )}
      {bolehBuka && data.barang.length > 0 && (
        <Link
          to="/persediaan?tab=posisi"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Lihat posisi stok
        </Link>
      )}
    </Card>
  );
}

function Aktivitas() {
  const data = useAktivitasDashboard().data;
  return (
    <Card className="gap-3 p-5">
      <h2 className="text-sm font-bold tracking-wide text-slate-800 uppercase">
        Aktivitas terkini
      </h2>
      {!data ? (
        <Skeleton className="h-32 w-full" />
      ) : data.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada aktivitas.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {labelAksi(a.aksi)}
                  {a.nomorDokumen && (
                    <span className="ml-1 font-mono text-xs text-slate-500">{a.nomorDokumen}</span>
                  )}
                </p>
                {a.ringkasan && <p className="truncate text-xs text-slate-500">{a.ringkasan}</p>}
              </div>
              <div className="shrink-0 text-right text-[11px] text-slate-400">
                <div>{formatWaktu(a.waktu).slice(11)}</div>
                {a.namaPengguna && <div>{a.namaPengguna}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function HalamanBeranda() {
  const pengguna = usePengguna();
  const toko = useTampilanToko().data;
  const ringkasan = useRingkasanDashboard();
  const r = ringkasan.data;
  const punya = (izin: Izin | Izin[]) =>
    (Array.isArray(izin) ? izin : [izin]).some((i) => pengguna.izin.includes(i));
  const aksi = AKSI_CEPAT.filter((a) => punya(a.izin)).slice(0, 6);
  const peringatan = usePeringatanStok(true).data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Operasional</h1>
          <p className="mt-1 text-sm text-slate-500">
            Selamat datang, {pengguna.namaPengguna} ({LABEL_PERAN[pengguna.peran]}) · ringkasan{' '}
            {toko?.namaBadanUsaha ?? 'toko'}
            {r ? `, ${teksTanggalPanjang(r.tanggal)}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void ringkasan.refetch()}>
            <RefreshCw className={cn(ringkasan.isFetching && 'animate-spin')} /> Muat ulang
          </Button>
          {punya('penjualan.order.buat') && (
            <Button asChild>
              <Link to="/order">
                <Plus /> Order baru
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!r ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {r.omzet && (
            <KartuAngka
              judul="Penjualan hari ini"
              nilai={formatRupiah(r.omzet.hariIni)}
              ikon={TrendingUp}
              warna="bg-emerald-50 text-emerald-600"
              keterangan={
                <span className="flex flex-wrap gap-x-2">
                  <span>{r.omzet.jumlahTransaksiHariIni} transaksi</span>·
                  <Banding kini={r.omzet.hariIni} lalu={r.omzet.kemarin} />
                </span>
              }
              testId="dashboard-penjualan-hari-ini"
              {...(punya('laporan.penjualan') ? { ke: '/laporan?laporan=penjualan' } : {})}
            />
          )}
          <KartuAngka
            judul="Antrean order"
            nilai={r.antreanOrder.total}
            ikon={ShoppingCart}
            warna="bg-amber-50 text-amber-600"
            keterangan={
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Clock className="size-3.5" /> {r.antreanOrder.diproses} sedang diproses kasir
              </span>
            }
            testId="dashboard-antrean"
            {...(punya('penjualan.checkout')
              ? { ke: '/penjualan-langsung' }
              : punya('penjualan.order.buat')
                ? { ke: '/order' }
                : {})}
          />
          <KartuAngka
            judul="Pengiriman aktif"
            nilai={r.pengirimanAktif.total}
            ikon={Truck}
            warna="bg-blue-50 text-blue-600"
            keterangan={
              <span className="text-blue-700">{r.pengirimanAktif.dikirim} sedang di jalan</span>
            }
            testId="dashboard-pengiriman"
            {...(punya('penjualan.checkout') ? { ke: '/penjualan-pengantaran' } : {})}
          />
          <KartuAngka
            judul="Peringatan stok"
            nilai={`${(peringatan?.habis ?? 0) + (peringatan?.kritis ?? 0)} barang`}
            ikon={AlertTriangle}
            warna="bg-red-50 text-red-600"
            keterangan={
              <span className="text-red-700">
                {peringatan?.habis ?? 0} habis · {peringatan?.kritis ?? 0} kritis
              </span>
            }
            testId="jumlah-peringatan-stok"
            {...(punya('persediaan.stok.lihat') ? { ke: '/persediaan?tab=posisi' } : {})}
          />
        </div>
      )}

      {r?.persetujuan && r.persetujuan.retur + r.persetujuan.void > 0 && (
        <Card className="flex-row items-center gap-3 border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <ClipboardCheck className="size-5 shrink-0" />
          <span className="flex-1">
            Menunggu persetujuan Anda: <b>{r.persetujuan.void}</b> void dan{' '}
            <b>{r.persetujuan.retur}</b> retur.
          </span>
          {r.persetujuan.void > 0 && (
            <Link to="/void?tab=persetujuan" className="font-semibold hover:underline">
              Buka void
            </Link>
          )}
          {r.persetujuan.retur > 0 && (
            <Link to="/retur?tab=persetujuan" className="font-semibold hover:underline">
              Buka retur
            </Link>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {r?.omzet && (
            <Card className="gap-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-800 uppercase">
                  <BarChart3 className="size-4 text-blue-600" /> Penjualan bersih 7 hari terakhir
                </h2>
                <span className="text-xs text-slate-500">
                  Total {formatRupiah(r.omzet.tujuhHari.reduce((t, d) => t + d.nilai, 0))}
                </span>
              </div>
              <GrafikTujuhHari data={r.omzet.tujuhHari} />
            </Card>
          )}
          {punya('dashboard.dasar') && (
            <PeringatanStok bolehBuka={punya('persediaan.stok.lihat')} />
          )}
        </div>
        <div className="space-y-6">
          {aksi.length > 0 && (
            <Card className="gap-3 p-5">
              <h2 className="text-sm font-bold tracking-wide text-slate-800 uppercase">
                Aksi cepat
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {aksi.map((a) => (
                  <Link
                    key={a.ke}
                    to={a.ke}
                    className="group flex flex-col items-center justify-center rounded-lg border border-slate-100 bg-slate-50 p-3 text-center hover:bg-blue-50"
                  >
                    <a.ikon className="mb-1.5 size-5 text-slate-400 group-hover:text-blue-600" />
                    <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700">
                      {a.label}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Aktivitas />
        </div>
      </div>
    </div>
  );
}
