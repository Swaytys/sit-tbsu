import {
  formatRupiah,
  JENIS_KAS_MANUAL,
  type BarisShift,
  type DetailShift,
  type HasilClerical,
  type JenisKasManual,
} from '@sit/shared';
import { Lock, LockOpen, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { GalatApi, pesanGalat } from '@/api/client';
import { useBarisPerHalaman } from '@/api/pengaturan';
import {
  useBukaShift,
  useCatatKas,
  useDaftarShift,
  useDetailShift,
  useShiftSaya,
  useTutupShift,
} from '@/api/penjualan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputRupiah } from '@/components/input-rupiah';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatTanggal, formatWaktu } from '@/lib/format';
import { LABEL_JENIS_KAS } from '@/lib/label';
import { cn } from '@/lib/utils';

function Angka({ label, nilai, tebal }: { label: string; nilai: number; tebal?: boolean }) {
  return (
    <div className={cn('flex justify-between', tebal && 'border-t pt-1 font-bold')}>
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums">{formatRupiah(nilai)}</span>
    </div>
  );
}

/** Hasil rekonsiliasi clerical check (mockup Clerical Check). */
export function KartuClerical({ c }: { c: HasilClerical }) {
  return (
    <div className="space-y-1 text-sm">
      <Angka label="Modal awal" nilai={c.modalAwal} />
      <Angka label="Penerimaan tunai (penjualan)" nilai={c.tunaiPenjualan} />
      <Angka label="Kas masuk lain" nilai={c.kasMasukLain} />
      <Angka label="Pengeluaran tunai (refund/kasbon/setor)" nilai={-c.kasKeluar} />
      <Angka label="Total saldo sistem" nilai={c.saldoSistem} tebal />
      <Angka label="Uang fisik dihitung" nilai={c.uangFisik} />
      <div
        className={cn(
          'flex justify-between rounded-md px-2 py-1 font-bold',
          c.selisih === 0
            ? 'bg-emerald-50 text-emerald-700'
            : c.selisih < 0
              ? 'bg-red-50 text-red-700'
              : 'bg-amber-50 text-amber-700',
        )}
        data-testid="selisih-clerical"
      >
        <span>{c.selisih === 0 ? 'Cocok' : c.selisih < 0 ? 'Kurang' : 'Lebih'}</span>
        <span className="tabular-nums">{formatRupiah(c.selisih)}</span>
      </div>
      {c.keterangan && <p className="text-slate-600">Keterangan: {c.keterangan}</p>}
      <p className="text-xs text-slate-400">
        {c.nomor} · diperiksa {c.namaPemeriksa} · {formatWaktu(c.tanggal)}
      </p>
    </div>
  );
}

function DaftarKas({ d }: { d: DetailShift }) {
  if (d.kas.length === 0)
    return <p className="text-sm text-slate-500">Belum ada kas masuk/keluar.</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y">
        {d.kas.map((k) => (
          <tr key={k.id}>
            <td className="py-1 text-xs text-slate-500">{formatWaktu(k.waktu).slice(11)}</td>
            <td className="py-1">
              {LABEL_JENIS_KAS[k.jenis]}
              {k.nomorDokumen && (
                <span className="font-mono text-xs text-slate-500"> {k.nomorDokumen}</span>
              )}
              {k.keterangan && <div className="text-xs text-slate-500">{k.keterangan}</div>}
            </td>
            <td
              className={cn(
                'py-1 text-right font-medium tabular-nums',
                k.arah === 'MASUK' ? 'text-emerald-700' : 'text-red-700',
              )}
            >
              {k.arah === 'MASUK' ? '+' : '−'}
              {formatRupiah(k.nominal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FormKas() {
  const catat = useCatatKas();
  const [jenis, setJenis] = useState<JenisKasManual>('KASBON');
  const [nominal, setNominal] = useState<number | null>(null);
  const [ket, setKet] = useState('');
  function simpan() {
    if (!nominal) return;
    catat
      .mutateAsync({ jenis, nominal, keterangan: ket.trim() || null })
      .then(() => {
        toast.success(`${LABEL_JENIS_KAS[jenis]} ${formatRupiah(nominal)} dicatat.`);
        setNominal(null);
        setKet('');
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <form
      className="grid grid-cols-[11rem_9rem_1fr_auto] items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        simpan();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="jenis-kas">Jenis</Label>
        <Select value={jenis} onValueChange={(v) => setJenis(v as JenisKasManual)}>
          <SelectTrigger id="jenis-kas" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JENIS_KAS_MANUAL.map((j) => (
              <SelectItem key={j} value={j}>
                {LABEL_JENIS_KAS[j]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="nominal-kas">Nominal</Label>
        <InputRupiah id="nominal-kas" value={nominal} onChange={setNominal} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ket-kas">Keterangan</Label>
        <Input
          id="ket-kas"
          value={ket}
          maxLength={255}
          onChange={(e) => setKet(e.target.value)}
          placeholder={
            jenis === 'KASBON' ? 'Siapa & untuk apa' : 'Opsional untuk setor/tarik owner'
          }
        />
      </div>
      <Button type="submit" disabled={!nominal || catat.isPending}>
        <Plus /> Catat
      </Button>
    </form>
  );
}

/** K4: blind count — uang fisik diinput sebelum angka sistem tampil. */
function FormTutup({
  idShift,
  onSelesai,
}: {
  idShift: number;
  onSelesai: (d: DetailShift) => void;
}) {
  const tutup = useTutupShift();
  const [uang, setUang] = useState<number | null>(null);
  const [ket, setKet] = useState('');
  const [perluKet, setPerluKet] = useState(false);
  function kirim() {
    if (uang === null) return;
    tutup
      .mutateAsync({ id: idShift, json: { uangFisik: uang, keterangan: ket.trim() || null } })
      .then(onSelesai)
      .catch((err: unknown) => {
        const d =
          err instanceof GalatApi
            ? (err.detail as { perluKeterangan?: boolean } | undefined)
            : undefined;
        if (d?.perluKeterangan) {
          setPerluKet(true);
          toast.warning(
            'Ada selisih dengan catatan sistem. Tulis keterangannya untuk menutup shift.',
          );
        } else {
          toast.error(pesanGalat(err));
        }
      });
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        kirim();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="uang-fisik">Hitung total uang tunai di laci kasir</Label>
        <InputRupiah
          id="uang-fisik"
          value={uang}
          onChange={setUang}
          disabled={perluKet}
          className="h-12 text-2xl font-bold"
        />
        <p className="text-xs text-slate-500">
          Hitung semua uang di laci (termasuk modal awal). Angka sistem baru tampil setelah shift
          ditutup.
        </p>
      </div>
      {perluKet && (
        <div className="space-y-1">
          <Label htmlFor="ket-selisih" className="text-red-700">
            Keterangan selisih wajib diisi
          </Label>
          <Input
            id="ket-selisih"
            autoFocus
            value={ket}
            maxLength={255}
            onChange={(e) => setKet(e.target.value)}
          />
        </div>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={uang === null || tutup.isPending || (perluKet && ket.trim().length < 3)}
      >
        <Lock /> Tutup shift
      </Button>
    </form>
  );
}

function ShiftSaya() {
  const saya = useShiftSaya();
  const detail = useDetailShift(saya.data?.id ?? null);
  const buka = useBukaShift();
  const [modal, setModal] = useState<number | null>(0);
  const [hasil, setHasil] = useState<DetailShift | null>(null);

  if (hasil?.clerical) {
    return (
      <Card className="max-w-lg gap-3 p-5">
        <h2 className="font-semibold">Shift {hasil.nomor} ditutup — hasil rekonsiliasi</h2>
        <KartuClerical c={hasil.clerical} />
        <Button variant="outline" onClick={() => setHasil(null)}>
          Selesai
        </Button>
      </Card>
    );
  }
  if (saya.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!saya.data) {
    return (
      <Card className="max-w-md gap-3 p-5">
        <h2 className="font-semibold">Belum ada shift terbuka</h2>
        <p className="text-sm text-slate-500">Isi uang modal yang ada di laci saat ini.</p>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            buka
              .mutateAsync(modal ?? 0)
              .then((s) => toast.success(`Shift ${s.nomor} dibuka.`))
              .catch((err: unknown) => toast.error(pesanGalat(err)));
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="modal-awal">Modal awal</Label>
            <InputRupiah id="modal-awal" value={modal} onChange={setModal} autoFocus />
          </div>
          <Button type="submit" disabled={buka.isPending}>
            <LockOpen /> Buka shift
          </Button>
        </form>
      </Card>
    );
  }
  const s = saya.data;
  return (
    <div className="grid grid-cols-[1fr_22rem] gap-4">
      <Card className="gap-3 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">
            Shift {s.nomor}{' '}
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Buka
            </Badge>
          </h2>
          <span className="text-sm text-slate-500">
            dibuka {formatWaktu(s.waktuBuka)} · modal {formatRupiah(s.modalAwal)}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-slate-700">
          Kas masuk / keluar (selain penjualan)
        </h3>
        <FormKas />
        {detail.data && <DaftarKas d={detail.data} />}
      </Card>
      <Card className="gap-3 p-5">
        <h2 className="font-semibold">Tutup shift & clerical check</h2>
        <FormTutup idShift={s.id} onSelesai={setHasil} />
      </Card>
    </div>
  );
}

function DialogShift({ id, onTutup }: { id: number; onTutup: () => void }) {
  const d = useDetailShift(id).data;
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Shift {d?.nomor} · {d?.namaKasir}
          </DialogTitle>
        </DialogHeader>
        {!d ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            {d.clerical ? (
              <KartuClerical c={d.clerical} />
            ) : d.ringkasan ? (
              <div className="space-y-1 text-sm">
                <Angka label="Modal awal" nilai={d.ringkasan.modalAwal} />
                <Angka label="Penerimaan tunai" nilai={d.ringkasan.tunaiPenjualan} />
                <Angka label="Kas masuk lain" nilai={d.ringkasan.kasMasukLain} />
                <Angka label="Pengeluaran tunai" nilai={-d.ringkasan.kasKeluar} />
                <Angka label="Saldo sistem saat ini" nilai={d.ringkasan.saldoSistem} tebal />
              </div>
            ) : null}
            <DaftarKas d={d} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Riwayat() {
  const semua = usePengguna().izin.includes('kas.shift.lihat_semua');
  const [halaman, setHalaman] = useState(1);
  const [selisih, setSelisih] = useState(false);
  const [buka, setBuka] = useState<number | null>(null);
  const perHalaman = useBarisPerHalaman();
  const daftar = useDaftarShift({ status: null, adaSelisih: selisih, halaman, perHalaman });
  const kolom: KolomTabel<BarisShift>[] = [
    {
      kunci: 'nomor',
      judul: 'Shift',
      sel: (s) => (
        <button
          type="button"
          className="font-mono text-xs font-medium text-blue-700"
          onClick={() => setBuka(s.id)}
        >
          {s.nomor}
        </button>
      ),
    },
    ...(semua ? [{ kunci: 'kasir', judul: 'Kasir', sel: (s: BarisShift) => s.namaKasir }] : []),
    { kunci: 'tanggal', judul: 'Tanggal', sel: (s) => formatTanggal(s.tanggalOperasional) },
    {
      kunci: 'waktu',
      judul: 'Buka – tutup',
      sel: (s) =>
        `${formatWaktu(s.waktuBuka).slice(11)} – ${s.waktuTutup ? formatWaktu(s.waktuTutup).slice(11) : '…'}`,
    },
    {
      kunci: 'modal',
      judul: 'Modal',
      className: 'text-right tabular-nums',
      sel: (s) => formatRupiah(s.modalAwal),
    },
    {
      kunci: 'sistem',
      judul: 'Saldo sistem',
      className: 'text-right tabular-nums',
      sel: (s) => (s.clerical ? formatRupiah(s.clerical.saldoSistem) : '—'),
    },
    {
      kunci: 'fisik',
      judul: 'Uang fisik',
      className: 'text-right tabular-nums',
      sel: (s) => (s.clerical ? formatRupiah(s.clerical.uangFisik) : '—'),
    },
    {
      kunci: 'selisih',
      judul: 'Selisih',
      className: 'text-right tabular-nums',
      sel: (s): ReactNode =>
        s.clerical ? (
          <span
            className={cn(
              'font-semibold',
              s.clerical.selisih < 0
                ? 'text-red-700'
                : s.clerical.selisih > 0
                  ? 'text-amber-700'
                  : 'text-emerald-700',
            )}
          >
            {formatRupiah(s.clerical.selisih)}
          </span>
        ) : (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Buka
          </Badge>
        ),
    },
    {
      kunci: 'ket',
      judul: 'Keterangan',
      sel: (s) => <span className="text-xs text-slate-600">{s.clerical?.keterangan ?? ''}</span>,
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 border-b p-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={selisih}
            onChange={(e) => {
              setSelisih(e.target.checked);
              setHalaman(1);
            }}
          />
          Hanya yang ada selisih
        </label>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(s) => s.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada shift."
      />
      {buka !== null && <DialogShift id={buka} onTutup={() => setBuka(null)} />}
    </Card>
  );
}

/** Kas › Shift & Clerical Check (docs/05 §10, mockup Clerical Check). */
export function HalamanShift() {
  const [url, setUrl] = useSearchParams();
  const semua = usePengguna().izin.includes('kas.shift.lihat_semua');
  const tab = url.get('tab') === 'riwayat' ? 'riwayat' : 'saya';
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Shift & Clerical Check</h1>
        <p className="text-sm text-slate-500">Rekonsiliasi uang fisik dengan catatan sistem.</p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => setUrl(v === 'saya' ? {} : { tab: v }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="saya">Shift saya</TabsTrigger>
          <TabsTrigger value="riwayat">{semua ? 'Semua shift' : 'Riwayat'}</TabsTrigger>
        </TabsList>
        <TabsContent value="saya">
          <ShiftSaya />
        </TabsContent>
        <TabsContent value="riwayat">
          <Riwayat />
        </TabsContent>
      </Tabs>
    </div>
  );
}
