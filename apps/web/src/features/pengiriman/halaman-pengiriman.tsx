import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { BarisSuratJalan, Perjalanan, PerluDikirim } from '@sit/shared';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  GripVertical,
  MoreVertical,
  Phone,
  Truck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  useBatalRit,
  useDaftarPerjalanan,
  useIsiRit,
  useKeluarRit,
  useMuatRit,
  usePerluDikirim,
} from '@/api/armada';
import { pesanGalat } from '@/api/client';
import { useBatalSuratJalan, useDaftarSuratJalan, useDetailPenjualan } from '@/api/penjualan';
import { CetakSuratJalan } from '@/components/cetak-surat-jalan';
import { SaranAlasan } from '@/components/saran-alasan';
import { SARAN_ALASAN } from '@/lib/saran-alasan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatDesimal, formatTanggal, formatWaktu, tanggalHariIni } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DialogHasil } from '../pengantaran/dialog-hasil';
import { DialogBuat } from '../pengantaran/panel-surat-jalan';
import { BilahTombol } from '../pos/bilah-tombol';
import { DialogBerangkatRit, DialogRitBaru } from './dialog-rit';

/*
 * Logistik › Pengiriman (K-160, docs/13 §4): papan kartu. Order kirim (Backlog) diseret ke grup rit
 * (Dijadwalkan), rit dimuat lalu berangkat (Di jalan), sopir kembali → catat hasil (Selesai). Status kartu selalu
 * dari dokumen (surat jalan & rit); menyeret kartu menjalankan aksi yang sama dengan tombol/menunya.
 */

const WARNA_MUATAN = {
  AMAN: 'bg-emerald-500',
  HAMPIR_PENUH: 'bg-amber-500',
  KONFIRMASI: 'bg-orange-500',
  DITOLAK: 'bg-red-600',
} as const;

const jam = (iso: string | null) => (iso ? formatWaktu(iso).slice(11) : '—');

function Kolom({
  id,
  judul,
  jumlah,
  bantu,
  aksi,
  children,
}: {
  id?: string;
  judul: string;
  jumlah: number;
  bantu: string;
  aksi?: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: id ?? `kolom-${judul}`, disabled: !id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 min-w-56 flex-1 flex-col rounded-md border bg-slate-50',
        isOver && 'border-red-400 bg-red-50',
      )}
      aria-label={judul}
    >
      <header className="space-y-0.5 border-b bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold whitespace-nowrap text-slate-800">
            {judul} <span className="text-slate-400">({jumlah})</span>
          </h2>
          {aksi}
        </div>
        <p className="text-xs text-slate-500">{bantu}</p>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">{children}</div>
    </section>
  );
}

/** Kartu yang bisa diseret (mouse) atau diangkat dengan Spasi lalu dipindah dengan panah (keyboard). */
function Seret({
  id,
  children,
  label,
  testId,
}: {
  id: string;
  children: ReactNode;
  label: string;
  testId: string;
}) {
  const { setNodeRef, transform, isDragging, listeners, attributes } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
          : undefined
      }
      className={cn('relative', isDragging && 'opacity-80 shadow-lg')}
      data-testid={testId}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Seret ${label}`}
        title="Seret ke grup rit (atau Spasi lalu panah)"
        className="absolute top-2 left-1 cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}

function KartuOrder({
  p,
  rit,
  onIsi,
  onBuat,
}: {
  p: PerluDikirim;
  rit: Perjalanan[];
  onIsi: (idRit: number) => void;
  onBuat: () => void;
}) {
  return (
    <Seret id={`inv-${p.idPenjualan}`} label={p.nomor} testId={`order-kirim-${p.nomor}`}>
      <div className="rounded-md border bg-white p-2.5 pl-7 text-sm">
        <div className="flex flex-wrap items-start gap-1.5 pr-6">
          <Link
            to={`/penjualan/${p.idPenjualan}?dari=pengiriman`}
            className="font-mono text-xs font-semibold whitespace-nowrap text-blue-700"
          >
            {p.nomor}
          </Link>
          {p.kirimUlang && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              Kirim ulang
            </Badge>
          )}
          {p.bayarSaatTerima && (
            <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-800">
              Bayar di tempat
            </Badge>
          )}
          <MenuKartu label={p.nomor}>
            <DropdownMenuLabel>Masukkan ke rit</DropdownMenuLabel>
            {rit.length === 0 && (
              <DropdownMenuItem disabled>Belum ada rit rencana</DropdownMenuItem>
            )}
            {rit.map((r) => (
              <DropdownMenuItem key={r.id} onSelect={() => onIsi(r.id)}>
                {r.nomor} · {r.plat} · {jam(r.jadwalBerangkat)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onBuat}>Buat surat jalan sebagian…</DropdownMenuItem>
          </MenuKartu>
        </div>
        <div className="truncate font-medium">{p.namaPelanggan ?? '—'}</div>
        <div className="truncate text-xs text-slate-500">{p.alamatKirim ?? '—'}</div>
        <div className="mt-1 text-xs text-slate-700">
          {p.baris
            .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyBelumDikirim)} ${b.kodeSatuan}`)
            .join(' · ')}
        </div>
      </div>
    </Seret>
  );
}

function MenuKartu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-1 right-1"
          aria-label={`Aksi ${label}`}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function KartuSj({
  sj,
  rit,
  onIsi,
  onKeluar,
  onBatal,
}: {
  sj: BarisSuratJalan;
  rit: Perjalanan[];
  onIsi: (idRit: number) => void;
  onKeluar: () => void;
  onBatal: () => void;
}) {
  return (
    <Seret id={`sj-${sj.id}`} label={sj.nomor} testId={`kartu-${sj.nomor}`}>
      <div className="rounded-md border bg-white p-2 pl-7 text-sm">
        <div className="flex flex-wrap items-start gap-1.5 pr-6">
          <span className="font-mono text-xs font-semibold whitespace-nowrap">{sj.nomor}</span>
          {sj.status === 'DIMUAT' && (
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
              Dimuat
            </Badge>
          )}
          <MenuKartu label={sj.nomor}>
            <DropdownMenuLabel>Pindah ke rit</DropdownMenuLabel>
            {rit
              .filter((r) => r.id !== sj.idPerjalanan)
              .map((r) => (
                <DropdownMenuItem key={r.id} onSelect={() => onIsi(r.id)}>
                  {r.nomor} · {r.plat} · {jam(r.jadwalBerangkat)}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            {sj.idPerjalanan !== null && (
              <DropdownMenuItem onSelect={onKeluar}>Keluarkan dari rit</DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={onBatal}>
              Batalkan surat jalan…
            </DropdownMenuItem>
          </MenuKartu>
        </div>
        <div className="truncate font-medium">{sj.namaPelanggan ?? '—'}</div>
        <div className="truncate text-xs text-slate-500">{sj.alamatKirim}</div>
        <div className="mt-0.5 text-xs text-slate-700">
          {sj.baris
            .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyKirim)} ${b.kodeSatuan}`)
            .join(' · ')}
        </div>
      </div>
    </Seret>
  );
}

function GrupRit({
  rit,
  isi,
  semuaRit,
  terbuka,
  onBuka,
  aksiKartu,
  onBerangkat,
  onBatal,
}: {
  rit: Perjalanan;
  isi: BarisSuratJalan[];
  semuaRit: Perjalanan[];
  terbuka: boolean;
  onBuka: () => void;
  aksiKartu: (
    sj: BarisSuratJalan,
  ) => Pick<Parameters<typeof KartuSj>[0], 'onIsi' | 'onKeluar' | 'onBatal'>;
  onBerangkat: () => void;
  onBatal: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `rit-${rit.id}` });
  const muat = useMuatRit();
  const m = rit.muatan;
  const semuaDimuat = isi.length > 0 && isi.every((s) => s.status === 'DIMUAT');
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md border-2 bg-white',
        isOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200',
      )}
      data-testid={`rit-${rit.nomor}`}
    >
      <div className="flex items-start gap-1 p-2">
        <button
          type="button"
          onClick={onBuka}
          aria-label={terbuka ? `Tutup grup ${rit.nomor}` : `Buka grup ${rit.nomor}`}
          className="mt-0.5 rounded p-0.5 text-slate-500 hover:bg-slate-100"
        >
          {terbuka ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-mono text-xs font-semibold">{rit.nomor}</span>
            <span className="font-medium">{rit.plat}</span>
            <span className="text-xs text-slate-500">jam {jam(rit.jadwalBerangkat)}</span>
            {semuaDimuat && (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50 text-emerald-800"
              >
                Dimuat
              </Badge>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {rit.namaSopir} · {isi.length} surat jalan
          </div>
          {rit.catatan && (
            <div className="truncate text-xs text-slate-600" title={rit.catatan}>
              {rit.catatan}
            </div>
          )}
          {m && (
            <div className="mt-1" title={m.pesan.join(' ')}>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-full', WARNA_MUATAN[m.kesimpulan])}
                  style={{
                    width: `${Math.min(100, Math.max(m.persenBerat ?? 0, m.persenVolume ?? 0))}%`,
                  }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                {Number(m.beratKg).toLocaleString('id-ID')} kg
                {m.persenBerat !== null && ` (${m.persenBerat.toLocaleString('id-ID')}%)`}
                {m.persenVolume !== null && ` · volume ${m.persenVolume.toLocaleString('id-ID')}%`}
                {m.kesimpulan === 'DITOLAK' && <b className="text-red-700"> · melebihi</b>}
              </div>
              {m.barangTanpaData.length > 0 && (
                <div className="text-[11px] text-amber-700">
                  {m.barangTanpaData.length} barang belum punya data berat/ukuran (dihitung 0)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {terbuka && (
        <div className="space-y-1.5 px-2 pb-2">
          {isi.length === 0 && (
            <p className="rounded border border-dashed py-3 text-center text-xs text-slate-400">
              Seret order kirim ke sini
            </p>
          )}
          {isi.map((sj) => (
            <KartuSj key={sj.id} sj={sj} rit={semuaRit} {...aksiKartu(sj)} />
          ))}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {!semuaDimuat && isi.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={muat.isPending}
                onClick={() =>
                  void muat
                    .mutateAsync(rit.id)
                    .then(() => toast.success(`${rit.nomor}: barang dimuat.`))
                    .catch((err: unknown) => toast.error(pesanGalat(err)))
                }
              >
                <Check /> Dimuat
              </Button>
            )}
            <Button size="sm" disabled={isi.length === 0} onClick={onBerangkat}>
              <Truck /> Berangkat
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto text-red-700" onClick={onBatal}>
              <X /> Batal rit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function KartuJalan({
  p,
  sjAktif,
  kini,
  onHasil,
}: {
  p: Perjalanan;
  sjAktif: Map<number, BarisSuratJalan>;
  kini: number;
  onHasil: (sj: BarisSuratJalan) => void;
}) {
  const menit = p.waktuBerangkat
    ? Math.max(0, Math.floor((kini - new Date(p.waktuBerangkat).getTime()) / 60_000))
    : 0;
  const lama =
    menit > 360 ||
    (p.waktuBerangkat !== null &&
      formatWaktu(p.waktuBerangkat).slice(0, 10) !==
        formatWaktu(new Date(kini).toISOString()).slice(0, 10));
  return (
    <div
      className={cn('rounded-md border bg-white p-2.5 text-sm', lama && 'border-amber-400')}
      data-testid={`jalan-${p.nomor}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <span className="font-mono text-xs font-semibold whitespace-nowrap">{p.nomor}</span>
        <span
          className={cn(
            'text-xs whitespace-nowrap',
            lama ? 'font-semibold text-amber-700' : 'text-slate-500',
          )}
        >
          berangkat {jam(p.waktuBerangkat)} ·{' '}
          {Math.floor(menit / 60) > 0 ? `${Math.floor(menit / 60)} j ` : ''}
          {menit % 60} m
        </span>
      </div>
      <div className="flex items-center gap-1.5 font-medium">
        <Truck className="size-4 text-slate-500" /> {p.plat}
        <span className="font-normal text-slate-500">{p.jenisKendaraan}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        {p.namaSopir}
        {p.noHpSopir && (
          <a href={`tel:${p.noHpSopir}`} className="inline-flex items-center gap-0.5 text-blue-700">
            <Phone className="size-3" /> {p.noHpSopir}
          </a>
        )}
      </div>
      {lama && (
        <p className="mt-1 text-xs text-amber-800">
          Sudah lama di jalan. Bila sopir sudah kembali, catat hasilnya agar kendaraan & sopir
          bebas.
        </p>
      )}
      <ul className="mt-2 space-y-1.5">
        {p.suratJalan.map((s) => {
          const sj = sjAktif.get(s.id);
          return (
            <li key={s.id} className="rounded border bg-slate-50 p-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-28 flex-1 text-xs">
                  <div className="font-mono font-semibold whitespace-nowrap">{s.nomor}</div>
                  <div className="truncate">{s.namaPelanggan ?? '—'}</div>
                  <div className="truncate text-slate-500">{s.alamatKirim}</div>
                </div>
                {sj ? (
                  <Button
                    size="sm"
                    onClick={() => onHasil(sj)}
                    aria-label={`Catat hasil ${s.nomor}`}
                  >
                    <ClipboardCheck /> Catat hasil
                  </Button>
                ) : (
                  <span className="text-xs text-emerald-700">hasil dicatat</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DialogAlasan({
  judul,
  ket,
  label,
  saran,
  onTutup,
  onKirim,
}: {
  judul: string;
  ket: string;
  label: string;
  saran: readonly string[];
  onTutup: () => void;
  onKirim: (alasan: string) => Promise<unknown>;
}) {
  const [alasan, setAlasan] = useState('');
  const [proses, setProses] = useState(false);
  function kirim() {
    if (alasan.trim().length < 3) {
      toast.error('Alasan wajib diisi (min. 3 huruf).');
      return;
    }
    setProses(true);
    onKirim(alasan.trim())
      .then(onTutup)
      .catch((err: unknown) => toast.error(pesanGalat(err)))
      .finally(() => setProses(false));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>{ket}</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={alasan}
          maxLength={255}
          onChange={(e) => setAlasan(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && kirim()}
          placeholder="Alasan"
          aria-label={label}
        />
        <SaranAlasan saran={saran} onPilih={setAlasan} />
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button variant="destructive" disabled={proses} onClick={kirim}>
            Ya, batalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuatDariPapan({
  idPenjualan,
  onTutup,
  onCetak,
}: {
  idPenjualan: number;
  onTutup: () => void;
  onCetak: (sj: BarisSuratJalan) => void;
}) {
  const d = useDetailPenjualan(idPenjualan);
  if (!d.data) return null;
  return <DialogBuat p={d.data} onTutup={onTutup} onCetak={onCetak} />;
}

type DialogPapan =
  | { jenis: 'rit-baru' }
  | { jenis: 'berangkat'; rit: Perjalanan }
  | { jenis: 'batal-rit'; rit: Perjalanan }
  | { jenis: 'batal-sj'; sj: BarisSuratJalan }
  | { jenis: 'buat'; id: number }
  | { jenis: 'hasil'; sj: BarisSuratJalan }
  | null;

export function HalamanPengiriman() {
  const perlu = usePerluDikirim();
  const aktif = useDaftarSuratJalan({ status: 'AKTIF', cari: '' });
  const rencana = useDaftarPerjalanan({ status: 'DIRENCANAKAN' });
  const jalan = useDaftarPerjalanan({ status: 'JALAN' });
  const selesai = useDaftarPerjalanan({ status: 'SELESAI' });
  const isi = useIsiRit();
  const keluar = useKeluarRit();
  const batalSj = useBatalSuratJalan();
  const batalRit = useBatalRit();
  const [dialog, setDialog] = useState<DialogPapan>(null);
  const [cetakSj, setCetakSj] = useState<BarisSuratJalan | null>(null);
  const selesaiCetak = useCallback(() => setCetakSj(null), []);
  const [tertutup, setTertutup] = useState<Set<number>>(new Set());
  const [kini, setKini] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setKini(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const sensor = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const semuaSj = aktif.data?.data ?? [];
  const ritRencana = rencana.data?.data ?? [];
  const idRencana = new Set(ritRencana.map((r) => r.id));
  const siap = semuaSj.filter((s) => s.status === 'DIPROSES' || s.status === 'DIMUAT');
  const tanpaRit = siap.filter((s) => s.idPerjalanan === null || !idRencana.has(s.idPerjalanan));
  const sjDikirim = new Map(semuaSj.filter((s) => s.status === 'DIKIRIM').map((s) => [s.id, s]));
  const hariIni = formatTanggal(tanggalHariIni());
  const selesaiHariIni = (selesai.data?.data ?? []).filter(
    (r) => r.waktuKembali !== null && formatWaktu(r.waktuKembali).startsWith(hariIni),
  );

  const jalankan = (p: Promise<unknown>, pesan: string) =>
    void p.then(() => toast.success(pesan)).catch((err: unknown) => toast.error(pesanGalat(err)));

  function isiKe(idRit: number, data: { idSuratJalan?: number; idPenjualan?: number }) {
    const r = ritRencana.find((x) => x.id === idRit);
    jalankan(isi.mutateAsync({ id: idRit, ...data }), `Masuk rit ${r?.nomor ?? ''}.`);
  }

  function aksiKartu(sj: BarisSuratJalan) {
    return {
      onIsi: (idRit: number) => isiKe(idRit, { idSuratJalan: sj.id }),
      onKeluar: () => jalankan(keluar.mutateAsync(sj.id), `${sj.nomor} dikeluarkan dari rit.`),
      onBatal: () => setDialog({ jenis: 'batal-sj', sj }),
    };
  }

  function lepas(e: DragEndEvent) {
    const asal = String(e.active.id);
    const tujuan = e.over ? String(e.over.id) : null;
    if (!tujuan) return;
    const idAsal = Number(asal.split('-')[1]);
    if (tujuan.startsWith('rit-')) {
      const idRit = Number(tujuan.slice(4));
      if (asal.startsWith('inv-')) isiKe(idRit, { idPenjualan: idAsal });
      else if (siap.find((s) => s.id === idAsal)?.idPerjalanan !== idRit)
        isiKe(idRit, { idSuratJalan: idAsal });
    } else if (tujuan === 'tanpa-rit') {
      if (asal.startsWith('inv-')) setDialog({ jenis: 'buat', id: idAsal });
      else if (siap.find((s) => s.id === idAsal)?.idPerjalanan) {
        jalankan(keluar.mutateAsync(idAsal), 'Dikeluarkan dari rit.');
      }
    } else if (tujuan === 'backlog' && asal.startsWith('sj-')) {
      const sj = siap.find((s) => s.id === idAsal);
      if (sj) setDialog({ jenis: 'batal-sj', sj });
    }
  }

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if (dialog || e.ctrlKey || e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setDialog({ jenis: 'rit-baru' });
      }
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  });

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-2 p-3">
      <DndContext sensors={sensor} collisionDetection={pointerWithin} onDragEnd={lepas}>
        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto">
          <Kolom
            id="backlog"
            judul="Backlog"
            jumlah={perlu.data?.length ?? 0}
            bantu="Order kirim baru. Seret ke grup rit di kolom Dijadwalkan."
          >
            {(perlu.data ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                {perlu.isLoading ? 'Memuat…' : 'Tidak ada order kirim baru.'}
              </p>
            )}
            {(perlu.data ?? []).map((p) => (
              <KartuOrder
                key={p.idPenjualan}
                p={p}
                rit={ritRencana}
                onIsi={(idRit) => isiKe(idRit, { idPenjualan: p.idPenjualan })}
                onBuat={() => setDialog({ jenis: 'buat', id: p.idPenjualan })}
              />
            ))}
          </Kolom>
          <Kolom
            judul="Dijadwalkan"
            jumlah={ritRencana.length}
            bantu="Grup = rit (kendaraan, sopir, jam). Dimuat → Berangkat."
            aksi={
              <Button
                size="sm"
                className="h-7 shrink-0 px-2"
                onClick={() => setDialog({ jenis: 'rit-baru' })}
              >
                <CalendarPlus /> Rit baru <kbd className="ml-1 font-mono text-xs opacity-70">R</kbd>
              </Button>
            }
          >
            {ritRencana.map((r) => (
              <GrupRit
                key={r.id}
                rit={r}
                isi={siap.filter((s) => s.idPerjalanan === r.id)}
                semuaRit={ritRencana}
                terbuka={!tertutup.has(r.id)}
                onBuka={() =>
                  setTertutup((t) => {
                    const b = new Set(t);
                    if (b.has(r.id)) b.delete(r.id);
                    else b.add(r.id);
                    return b;
                  })
                }
                aksiKartu={aksiKartu}
                onBerangkat={() => setDialog({ jenis: 'berangkat', rit: r })}
                onBatal={() => setDialog({ jenis: 'batal-rit', rit: r })}
              />
            ))}
            <GrupTanpaRit>
              {tanpaRit.map((sj) => (
                <KartuSj key={sj.id} sj={sj} rit={ritRencana} {...aksiKartu(sj)} />
              ))}
            </GrupTanpaRit>
          </Kolom>
          <Kolom
            judul="Di jalan"
            jumlah={(jalan.data?.data ?? []).length}
            bantu="Sopir kembali: catat hasil tiap surat jalan."
          >
            {(jalan.data?.data ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                Tidak ada kendaraan di jalan.
              </p>
            )}
            {(jalan.data?.data ?? []).map((p) => (
              <KartuJalan
                key={p.id}
                p={p}
                sjAktif={sjDikirim}
                kini={kini}
                onHasil={(sj) => setDialog({ jenis: 'hasil', sj })}
              />
            ))}
          </Kolom>
          <Kolom
            judul="Selesai hari ini"
            jumlah={selesaiHariIni.length}
            bantu="Rit yang hasilnya sudah dicatat semua."
          >
            {selesaiHariIni.map((r) => (
              <div
                key={r.id}
                className="rounded-md border bg-white p-2 text-xs"
                data-testid={`selesai-${r.nomor}`}
              >
                <div className="flex flex-wrap justify-between gap-x-2">
                  <span className="font-mono font-semibold whitespace-nowrap">{r.nomor}</span>
                  <span className="whitespace-nowrap text-slate-500">
                    kembali {jam(r.waktuKembali)}
                  </span>
                </div>
                <div>
                  {r.plat} · {r.namaSopir} · {r.suratJalan.length} surat jalan
                </div>
              </div>
            ))}
          </Kolom>
        </div>
      </DndContext>
      <BilahTombol
        daftar={[
          { kunci: 'R', label: 'Rit baru' },
          { kunci: 'Spasi', label: 'Angkat kartu (pada pegangan) · panah pindah · Spasi lepas' },
          { kunci: '⋮', label: 'Menu kartu: masukkan/pindah/keluarkan/batalkan' },
        ]}
      />
      {dialog?.jenis === 'rit-baru' && <DialogRitBaru onTutup={() => setDialog(null)} />}
      {dialog?.jenis === 'berangkat' && (
        <DialogBerangkatRit rit={dialog.rit} onTutup={() => setDialog(null)} />
      )}
      {dialog?.jenis === 'hasil' && <DialogHasil sj={dialog.sj} onTutup={() => setDialog(null)} />}
      {dialog?.jenis === 'buat' && (
        <BuatDariPapan
          idPenjualan={dialog.id}
          onTutup={() => setDialog(null)}
          onCetak={setCetakSj}
        />
      )}
      {cetakSj && <CetakSuratJalan sj={cetakSj} onSelesai={selesaiCetak} />}
      {dialog?.jenis === 'batal-rit' && (
        <DialogAlasan
          judul={`Batalkan rit ${dialog.rit.nomor}?`}
          ket="Surat jalan di dalamnya tidak ikut batal; kembali ke grup Belum direncanakan."
          label="Alasan batal rit"
          saran={SARAN_ALASAN.batalRit}
          onTutup={() => setDialog(null)}
          onKirim={(alasan) =>
            batalRit
              .mutateAsync({ id: dialog.rit.id, alasan })
              .then(() => toast.success('Rit dibatalkan.'))
          }
        />
      )}
      {dialog?.jenis === 'batal-sj' && (
        <DialogAlasan
          judul={`Batalkan surat jalan ${dialog.sj.nomor}?`}
          ket="Barangnya kembali menjadi order kirim di Backlog."
          label="Alasan batal surat jalan"
          saran={SARAN_ALASAN.batalSuratJalan}
          onTutup={() => setDialog(null)}
          onKirim={(alasan) =>
            batalSj
              .mutateAsync({ id: dialog.sj.id, alasan })
              .then(() => toast.success(`${dialog.sj.nomor} dibatalkan.`))
          }
        />
      )}
    </div>
  );
}

function GrupTanpaRit({ children }: { children: ReactNode[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tanpa-rit' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-1.5 rounded-md border-2 border-dashed p-2',
        isOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300',
      )}
      data-testid="tanpa-rit"
    >
      <div className="text-xs font-semibold text-slate-600">
        Belum direncanakan ({children.length})
        <span className="block font-normal text-slate-500">
          Surat jalan tanpa rit: belum bisa berangkat. Seret ke grup rit.
        </span>
      </div>
      {children}
    </div>
  );
}
