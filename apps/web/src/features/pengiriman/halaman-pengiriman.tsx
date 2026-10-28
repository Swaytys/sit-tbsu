import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type ClientRect,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import type { BarisSuratJalan, Perjalanan, PerluDikirim } from '@sit/shared';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  GripVertical,
  Info,
  MoreVertical,
  Phone,
  Printer,
  Truck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { useDaftarSuratJalan, useDetailPenjualan } from '@/api/penjualan';
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
import { DialogBerangkatRit, DialogRitBaru, type CaraCetakRit } from './dialog-rit';
import { InfoOrderKirim } from './info-order-kirim';

/*
 * Logistik › Pengiriman (K-160, K-174, docs/13 §4): papan kartu. Order kirim (Backlog) diseret ke grup rit
 * (Dijadwalkan): saat itu surat jalannya dibuat dengan sopir dan kendaraan rit. Rit dimuat lalu berangkat (semua
 * surat jalannya dicetak/disimpan PDF), sopir kembali → catat hasil (Selesai). Keluar dari rit atau batal rit
 * membatalkan surat jalan sehingga order kembali ke Backlog. Status kartu selalu dari dokumen (surat jalan & rit);
 * menyeret kartu menjalankan aksi yang sama dengan tombol/menunya.
 */

const WARNA_MUATAN = {
  AMAN: 'bg-emerald-500',
  HAMPIR_PENUH: 'bg-amber-500',
  KONFIRMASI: 'bg-orange-500',
  DITOLAK: 'bg-red-600',
} as const;

const jam = (iso: string | null) => (iso ? formatWaktu(iso).slice(11) : '—');

const PENANDA_HASIL = {
  SEMUA_DITERIMA: ['Terkirim semua', 'border-emerald-300 bg-emerald-50 text-emerald-800'],
  ADA_KEMBALI: ['Ada yang kembali', 'border-amber-300 bg-amber-50 text-amber-800'],
  ADA_RUSAK: ['Ada yang rusak', 'border-red-300 bg-red-50 text-red-700'],
} as const;

/** K-176: penanda hasil pengantaran satu surat jalan (rinciannya di detail invoice). */
function PenandaHasil({ h }: { h: Perjalanan['suratJalan'][number]['hasilRingkas'] }) {
  if (!h) return null;
  const [teks, kelas] = PENANDA_HASIL[h];
  return (
    <Badge variant="outline" className={kelas} data-testid="penanda-hasil">
      {teks}
    </Badge>
  );
}

const ARAH: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};
const pusat = (r: ClientRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * K-177: seret dengan keyboard. Panah tidak menggeser kartu 25 px (terlalu lambat dan tidak pernah "kena" tujuan),
 * tetapi melompat ke tempat lepas terdekat ke arah itu: Backlog atau grup rit. Tujuan terpilih disimpan di `tujuan`
 * dan dipakai deteksi tabrakan, karena keyboard tidak punya posisi penunjuk.
 */
function koordinatPapan(tujuan: { current: string | null }): KeyboardCoordinateGetter {
  return (e, { context }) => {
    const arah = ARAH[e.code];
    if (!arah || !context.collisionRect) return undefined;
    e.preventDefault();
    const dariRect = tujuan.current ? context.droppableRects.get(tujuan.current) : undefined;
    const asal = pusat(dariRect ?? context.collisionRect);
    let terbaik: { id: string; rect: ClientRect; skor: number } | null = null;
    for (const c of context.droppableContainers.getEnabled()) {
      const id = String(c.id);
      const rect = context.droppableRects.get(c.id);
      if (!rect || id === tujuan.current) continue;
      const p = pusat(rect);
      const maju = (p.x - asal.x) * arah[0] + (p.y - asal.y) * arah[1];
      if (maju <= 10) continue;
      const samping = Math.abs((p.x - asal.x) * arah[1]) + Math.abs((p.y - asal.y) * arah[0]);
      const skor = maju + samping * 2;
      if (!terbaik || skor < terbaik.skor) terbaik = { id, rect, skor };
    }
    if (!terbaik) return undefined;
    tujuan.current = terbaik.id;
    return { x: terbaik.rect.left + 8, y: terbaik.rect.top + 8 };
  };
}

function Kolom({
  id,
  judul,
  jumlah,
  bantu,
  aksi,
  bawah,
  children,
}: {
  id?: string;
  judul: string;
  jumlah: number;
  bantu: string;
  aksi?: ReactNode;
  /** Baris tambahan di bawah keterangan kolom (mis. saringan). */
  bawah?: ReactNode;
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
        {bawah}
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

/** Nomor antrean order asal: kode pendek yang mudah diingat (juga setelah order dibagi). */
function Antrean({ n }: { n: number | null }) {
  if (n === null) return null;
  return (
    <span
      className="rounded bg-slate-900 px-1.5 text-sm leading-5 font-black text-white"
      title="Nomor antrean order"
    >
      #{n}
    </span>
  );
}

function KartuOrder({
  p,
  rit,
  hariIni,
  onIsi,
  onBuat,
  onInfo,
}: {
  p: PerluDikirim;
  rit: Perjalanan[];
  hariIni: boolean;
  onIsi: (idRit: number) => void;
  onBuat: () => void;
  onInfo: () => void;
}) {
  return (
    <Seret id={`inv-${p.idPenjualan}`} label={p.nomor} testId={`order-kirim-${p.nomor}`}>
      <div
        className={cn(
          'rounded-md border border-l-4 bg-white p-2.5 pl-7 text-sm',
          p.kirimUlang
            ? 'border-l-orange-400'
            : p.sebagian
              ? 'border-l-amber-400 bg-amber-50/40'
              : 'border-l-blue-400',
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 pr-12">
          <Antrean n={p.noAntrean} />
          <Link
            to={`/penjualan/${p.idPenjualan}?dari=pengiriman`}
            className="font-mono text-xs font-semibold whitespace-nowrap text-blue-700"
          >
            {p.nomor}
          </Link>
          {p.kirimUlang && (
            <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800">
              Kirim ulang
            </Badge>
          )}
          {!p.kirimUlang && p.sebagian && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              Sisa dibagi
            </Badge>
          )}
          <Badge
            variant="outline"
            className={hariIni ? 'border-emerald-300 text-emerald-700' : 'text-slate-500'}
          >
            {hariIni ? 'Hari ini' : formatWaktu(p.tanggal).slice(0, 10)}
          </Badge>
          {p.bayarSaatTerima && (
            <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-800">
              Bayar di tempat
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-1 right-8"
            aria-label={`Info ${p.nomor}`}
            title="Info cepat: pembeli, telepon, catatan, barang"
            onClick={onInfo}
          >
            <Info />
          </Button>
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
            <DropdownMenuItem onSelect={onBuat}>Kirim sebagian / pilih rit…</DropdownMenuItem>
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
      {/* Fokus tidak dikembalikan ke tombol ⋮: aksi menu bisa membuka dialog (Enter berikutnya milik dialog). */}
      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function KartuSj({
  sj,
  rit,
  onIsi,
  onKeluar,
}: {
  sj: BarisSuratJalan;
  rit: Perjalanan[];
  onIsi: (idRit: number) => void;
  onKeluar: () => void;
}) {
  return (
    <Seret id={`sj-${sj.id}`} label={sj.nomor} testId={`kartu-${sj.nomor}`}>
      <div className="rounded-md border bg-white p-2 pl-7 text-sm">
        <div className="flex flex-wrap items-center gap-1.5 pr-6">
          <Antrean n={sj.noAntrean} />
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
            <DropdownMenuItem variant="destructive" onSelect={onKeluar}>
              Keluarkan ke Backlog (surat jalan batal)
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
  onCetak,
}: {
  rit: Perjalanan;
  isi: BarisSuratJalan[];
  semuaRit: Perjalanan[];
  terbuka: boolean;
  onBuka: () => void;
  aksiKartu: (sj: BarisSuratJalan) => Pick<Parameters<typeof KartuSj>[0], 'onIsi' | 'onKeluar'>;
  onBerangkat: () => void;
  onBatal: () => void;
  onCetak: () => void;
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
            <Button
              size="sm"
              variant="outline"
              disabled={isi.length === 0}
              onClick={onCetak}
              aria-label={`Cetak surat jalan ${rit.nomor}`}
            >
              <Printer /> Cetak
            </Button>
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
  onCetak,
}: {
  p: Perjalanan;
  sjAktif: Map<number, BarisSuratJalan>;
  kini: number;
  onHasil: (sj: BarisSuratJalan) => void;
  onCetak: () => void;
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
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          onClick={onCetak}
          aria-label={`Cetak surat jalan ${p.nomor}`}
          title="Cetak ulang surat jalan rit ini"
        >
          <Printer />
        </Button>
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
                  <PenandaHasil h={s.hasilRingkas} />
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
  idRit,
  onTutup,
}: {
  idPenjualan: number;
  idRit?: number;
  onTutup: () => void;
}) {
  const d = useDetailPenjualan(idPenjualan);
  if (!d.data) return null;
  return <DialogBuat p={d.data} idRitAwal={idRit} onTutup={onTutup} />;
}

type DialogPapan =
  | { jenis: 'rit-baru' }
  | { jenis: 'berangkat'; rit: Perjalanan }
  | { jenis: 'batal-rit'; rit: Perjalanan }
  | { jenis: 'buat'; id: number; idRit?: number }
  | { jenis: 'hasil'; sj: BarisSuratJalan }
  | { jenis: 'info'; p: PerluDikirim }
  | null;

type Cetakan = { daftar: BarisSuratJalan[]; judulBerkas?: string };

export function HalamanPengiriman() {
  const perlu = usePerluDikirim();
  const aktif = useDaftarSuratJalan({ status: 'AKTIF', cari: '' });
  const rencana = useDaftarPerjalanan({ status: 'DIRENCANAKAN' });
  const jalan = useDaftarPerjalanan({ status: 'JALAN' });
  const selesai = useDaftarPerjalanan({ status: 'SELESAI' });
  const isi = useIsiRit();
  const keluar = useKeluarRit();
  const batalRit = useBatalRit();
  const [dialog, setDialog] = useState<DialogPapan>(null);
  const [cetakan, setCetakan] = useState<Cetakan | null>(null);
  const selesaiCetak = useCallback(() => setCetakan(null), []);
  const [tertutup, setTertutup] = useState<Set<number>>(new Set());
  const [kini, setKini] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setKini(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const tujuanKeyboard = useRef<string | null>(null);
  const sensor = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (e, a) => koordinatPapan(tujuanKeyboard)(e, a),
    }),
  );
  // Mouse: tempat di bawah penunjuk. Keyboard: tempat yang dipilih dengan panah (koordinatPapan).
  const deteksi: CollisionDetection = (args) =>
    args.pointerCoordinates
      ? pointerWithin(args)
      : tujuanKeyboard.current
        ? [{ id: tujuanKeyboard.current }]
        : [];

  const semuaSj = aktif.data?.data ?? [];
  const ritRencana = rencana.data?.data ?? [];
  const idRencana = new Set(ritRencana.map((r) => r.id));
  const siap = semuaSj.filter((s) => s.status === 'DIPROSES' || s.status === 'DIMUAT');
  // Data lama (sebelum K-174): surat jalan tanpa rit. Tampil terpisah sampai dimasukkan ke rit atau dikeluarkan.
  const tanpaRit = siap.filter((s) => s.idPerjalanan === null || !idRencana.has(s.idPerjalanan));
  const isiRit = (id: number) => semuaSj.filter((s) => s.idPerjalanan === id);

  function cetak(daftar: BarisSuratJalan[], nomorRit: string, cara: CaraCetakRit = 'CETAK') {
    if (daftar.length === 0) {
      toast.error(`Rit ${nomorRit} belum punya surat jalan.`);
      return;
    }
    if (cara === 'PDF') {
      toast.info('Di jendela cetak, pilih tujuan "Simpan sebagai PDF", lalu Simpan.', {
        duration: 10000,
      });
    }
    setCetakan({ daftar, judulBerkas: `Surat jalan ${nomorRit}` });
  }
  const [saringBacklog, setSaringBacklog] = useState<'SEMUA' | 'HARI_INI' | 'LAMA'>('SEMUA');
  const hariIniIso = tanggalHariIni();
  // Tanggal invoice di zona toko (ISO tersimpan UTC).
  const diHariIni = (p: PerluDikirim) =>
    formatWaktu(p.tanggal).startsWith(formatTanggal(hariIniIso));
  const backlog = (perlu.data ?? []).filter((p) =>
    saringBacklog === 'SEMUA' ? true : saringBacklog === 'HARI_INI' ? diHariIni(p) : !diHariIni(p),
  );
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
      onKeluar: () =>
        jalankan(
          keluar.mutateAsync(sj.id),
          `${sj.nomor} batal; ${sj.nomorPenjualan} kembali ke Backlog.`,
        ),
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
    } else if (tujuan === 'backlog' && asal.startsWith('sj-')) {
      const sj = siap.find((s) => s.id === idAsal);
      if (sj) aksiKartu(sj).onKeluar();
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
      <DndContext
        sensors={sensor}
        collisionDetection={deteksi}
        onDragStart={() => {
          tujuanKeyboard.current = null;
        }}
        onDragEnd={(e) => {
          tujuanKeyboard.current = null;
          lepas(e);
        }}
        onDragCancel={() => {
          tujuanKeyboard.current = null;
        }}
      >
        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto">
          <Kolom
            id="backlog"
            judul="Backlog"
            jumlah={backlog.length}
            bantu="Order belum masuk rit. Seret ke grup rit: surat jalannya dibuat saat itu."
            bawah={
              <div
                className="mt-1 flex w-fit rounded-md border text-xs"
                role="group"
                aria-label="Saring Backlog"
              >
                {(
                  [
                    ['SEMUA', 'Semua'],
                    ['HARI_INI', 'Hari ini'],
                    ['LAMA', 'Lebih lama'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={saringBacklog === v}
                    onClick={() => setSaringBacklog(v)}
                    className={cn(
                      'px-1.5 py-0.5',
                      saringBacklog === v ? 'bg-slate-900 text-white' : 'hover:bg-slate-100',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            {backlog.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                {perlu.isLoading ? 'Memuat…' : 'Tidak ada order kirim baru.'}
              </p>
            )}
            {backlog.map((p) => (
              <KartuOrder
                key={p.idPenjualan}
                p={p}
                hariIni={diHariIni(p)}
                onInfo={() => setDialog({ jenis: 'info', p })}
                rit={ritRencana}
                onIsi={(idRit) => isiKe(idRit, { idPenjualan: p.idPenjualan })}
                onBuat={() => setDialog({ jenis: 'buat', id: p.idPenjualan })}
              />
            ))}
          </Kolom>
          <Kolom
            judul="Dijadwalkan"
            jumlah={ritRencana.length}
            bantu="Grup = rit (kendaraan, sopir, jam). Dimuat → Berangkat (cetak surat jalan)."
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
                onCetak={() => cetak(isiRit(r.id), r.nomor)}
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
            {tanpaRit.length > 0 && (
              <GrupTanpaRit>
                {tanpaRit.map((sj) => (
                  <KartuSj key={sj.id} sj={sj} rit={ritRencana} {...aksiKartu(sj)} />
                ))}
              </GrupTanpaRit>
            )}
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
                onCetak={() => cetak(isiRit(p.id), p.nomor)}
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
                <ul className="mt-1 space-y-0.5">
                  {r.suratJalan.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-1">
                      <Link
                        to={`/penjualan/${s.idPenjualan}?dari=pengiriman`}
                        className="font-mono text-blue-700 hover:underline"
                      >
                        {s.nomor}
                      </Link>
                      <span className="truncate text-slate-600">{s.namaPelanggan ?? '—'}</span>
                      <PenandaHasil h={s.hasilRingkas} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Kolom>
        </div>
      </DndContext>
      <BilahTombol
        daftar={[
          { kunci: 'R', label: 'Rit baru' },
          {
            kunci: 'Spasi',
            label:
              'Angkat kartu (Tab ke pegangan ⋮⋮) · panah pilih Backlog/rit · Spasi lepas · Esc batal',
          },
          { kunci: '⋮', label: 'Menu kartu: masukkan ke rit, kirim sebagian, pindah, keluarkan' },
        ]}
      />
      {dialog?.jenis === 'rit-baru' && <DialogRitBaru onTutup={() => setDialog(null)} />}
      {dialog?.jenis === 'berangkat' && (
        <DialogBerangkatRit
          rit={dialog.rit}
          isi={isiRit(dialog.rit.id)}
          onTutup={() => setDialog(null)}
          onCetak={(daftar, cara) => cetak(daftar, dialog.rit.nomor, cara)}
        />
      )}
      {dialog?.jenis === 'hasil' && <DialogHasil sj={dialog.sj} onTutup={() => setDialog(null)} />}
      {dialog?.jenis === 'info' && <InfoOrderKirim p={dialog.p} onTutup={() => setDialog(null)} />}
      {dialog?.jenis === 'buat' && (
        <BuatDariPapan
          idPenjualan={dialog.id}
          idRit={dialog.idRit}
          onTutup={() => setDialog(null)}
        />
      )}
      {cetakan && (
        <CetakSuratJalan
          daftar={cetakan.daftar}
          judulBerkas={cetakan.judulBerkas}
          onSelesai={selesaiCetak}
        />
      )}
      {dialog?.jenis === 'batal-rit' && (
        <DialogAlasan
          judul={`Batalkan rit ${dialog.rit.nomor}?`}
          ket="Surat jalan di dalamnya ikut batal; ordernya kembali ke Backlog."
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
    </div>
  );
}

/** Surat jalan lama (dibuat sebelum K-174) yang belum punya rit: hanya bisa dimasukkan ke rit atau dikeluarkan. */
function GrupTanpaRit({ children }: { children: ReactNode[] }) {
  return (
    <div
      className="space-y-1.5 rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-2"
      data-testid="tanpa-rit"
    >
      <div className="text-xs font-semibold text-amber-900">
        Surat jalan lama tanpa rit ({children.length})
        <span className="block font-normal">
          Belum ada sopir & kendaraan. Seret ke grup rit, atau keluarkan ke Backlog.
        </span>
      </div>
      {children}
    </div>
  );
}
