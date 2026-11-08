import { zodResolver } from '@hookform/resolvers/zod';
import {
  skemaHutangAwal,
  formatRupiah,
  KELOMPOK_UMUR,
  LABEL_KELOMPOK_UMUR,
  LABEL_METODE_PEMBAYARAN_PEMASOK,
  skemaBayarHutang,
  type BarisHutang,
  type DataBayarHutang,
  type InputBayarHutang,
  type StatusHutang,
} from '@sit/shared';
import { CalendarClock, FilePlus2, History, Search, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import {
  useBayarHutang,
  useDaftarHutang,
  usePembayaranHutang,
  useCatatHutangAwal,
  usePerpanjangJatuhTempo,
} from '@/api/hutang';
import { useDaftarPemasok } from '@/api/mitra';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputRupiah } from '@/components/input-rupiah';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTanggal, formatWaktu } from '@/lib/format';
import { tampilkanGalatForm } from '@/lib/form';
import { LABEL_STATUS_HUTANG } from '@/lib/label';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';
import { useIngat } from '@/lib/ingat-saring';

const SEMUA = 'SEMUA';

const WARNA_STATUS: Record<StatusHutang, string> = {
  TIDAK_ADA: 'border-slate-200 bg-slate-50 text-slate-600',
  BELUM_LUNAS: 'border-red-200 bg-red-50 text-red-700',
  SEBAGIAN: 'border-amber-200 bg-amber-50 text-amber-700',
  LUNAS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function BadgeStatusHutang({ status }: { status: StatusHutang }) {
  return (
    <Badge variant="outline" className={WARNA_STATUS[status]}>
      {LABEL_STATUS_HUTANG[status]}
    </Badge>
  );
}

/**
 * K-241: hutang ke pemasok dari sebelum memakai aplikasi (bagian Persediaan Awal). Satu faktur lama per simpan;
 * "Simpan & tambah lagi" mengosongkan isian kecuali pemasok, agar banyak faktur cepat dicatat.
 */
function DialogHutangAwal({ onTutup }: { onTutup: () => void }) {
  const catat = useCatatHutangAwal();
  const pemasok =
    useDaftarPemasok({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 100 }).data?.data ?? [];
  const [idPemasok, setIdPemasok] = useState(0);
  const [noFaktur, setNoFaktur] = useState('');
  const [tanggalFaktur, setTanggalFaktur] = useState('');
  const [sisa, setSisa] = useState(0);
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [catatan, setCatatan] = useState('');
  const [jumlah, setJumlah] = useState(0);
  function simpan(lagi: boolean) {
    const data = skemaHutangAwal.safeParse({
      idPemasok,
      noFakturLama: noFaktur,
      tanggalFaktur: tanggalFaktur || null,
      sisa,
      tanggalJatuhTempo: jatuhTempo,
      catatan,
    });
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    void catat
      .mutateAsync(data.data)
      .then((h) => {
        toast.success(`Hutang awal ${h.nomor} dicatat.`);
        setJumlah((n) => n + 1);
        if (!lagi) return onTutup();
        setNoFaktur('');
        setTanggalFaktur('');
        setSisa(0);
        setJatuhTempo('');
        setCatatan('');
        document.getElementById('hutang-awal-faktur')?.focus();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat hutang awal pemasok</DialogTitle>
          <DialogDescription>
            Faktur pemasok dari sebelum memakai aplikasi yang belum lunas. Tidak menambah stok (stok
            awal dicatat di Persediaan Awal). Tiap faktur satu catatan; faktur yang sama tidak bisa
            dicatat dua kali.{jumlah > 0 && ` Sudah dicatat sesi ini: ${jumlah}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            Pemasok
            <select
              className="h-9 rounded-md border bg-white px-2"
              aria-label="Pemasok hutang awal"
              value={idPemasok || ''}
              onChange={(e) => setIdPemasok(Number(e.target.value))}
            >
              <option value="">Pilih pemasok…</option>
              {pemasok.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namaPemasok}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            No. faktur lama (boleh kosong)
            <Input
              id="hutang-awal-faktur"
              value={noFaktur}
              maxLength={50}
              onChange={(e) => setNoFaktur(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal faktur (boleh kosong)
            <Input
              type="date"
              value={tanggalFaktur}
              onChange={(e) => setTanggalFaktur(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Sisa hutang
            <InputRupiah
              aria-label="Sisa hutang awal"
              value={sisa}
              onChange={(v) => setSisa(v ?? 0)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Jatuh tempo
            <Input
              type="date"
              aria-label="Jatuh tempo hutang awal"
              value={jatuhTempo}
              onChange={(e) => setJatuhTempo(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Catatan (boleh kosong)
            <Input value={catatan} maxLength={255} onChange={(e) => setCatatan(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Selesai
          </Button>
          <Button variant="outline" disabled={catat.isPending} onClick={() => simpan(true)}>
            Simpan & tambah lagi
          </Button>
          <Button disabled={catat.isPending} onClick={() => simpan(false)}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** K-237: Owner memperpanjang jatuh tempo; alasan wajib, riwayat tercatat. */
function DialogPerpanjang({ h, onTutup }: { h: BarisHutang; onTutup: () => void }) {
  const ubah = usePerpanjangJatuhTempo();
  const [tanggalBaru, setTanggalBaru] = useState('');
  const [alasan, setAlasan] = useState('');
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perpanjang jatuh tempo {h.nomor}</DialogTitle>
          <DialogDescription>
            {h.namaPemasok} · sisa {formatRupiah(h.sisa)} · jatuh tempo sekarang{' '}
            {formatTanggal(h.tanggalJatuhTempo)}
            {h.jumlahPerpanjang > 0 && ` · sudah diperpanjang ${h.jumlahPerpanjang}×`}. Tercatat di
            riwayat dan log.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-sm">
          Jatuh tempo baru
          <Input
            type="date"
            aria-label="Jatuh tempo baru"
            value={tanggalBaru}
            onChange={(e) => setTanggalBaru(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Alasan (kesepakatan dengan pemasok)
          <Input
            aria-label="Alasan perpanjangan"
            value={alasan}
            maxLength={255}
            onChange={(e) => setAlasan(e.target.value)}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button
            disabled={ubah.isPending || !tanggalBaru || alasan.trim().length < 5}
            onClick={() =>
              void ubah
                .mutateAsync({ id: h.id, json: { tanggalBaru, alasan } })
                .then(() => {
                  toast.success('Jatuh tempo diperpanjang.');
                  onTutup();
                })
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            Perpanjang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeteranganTempo({ h }: { h: BarisHutang }) {
  if (h.hariLewat === null) return <span className="text-slate-400">Tanpa jatuh tempo</span>;
  if (h.hariLewat > 0) {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        Terlambat {h.hariLewat} hari
      </Badge>
    );
  }
  const sisa = -h.hariLewat;
  return (
    <span className={sisa <= 3 ? 'text-amber-700' : 'text-slate-500'}>
      {sisa === 0 ? 'Hari ini' : `${sisa} hari lagi`}
    </span>
  );
}

/** Persediaan › Hutang Pemasok (docs/06 HT1–HT4): daftar dokumen terbuka, umur hutang, pembayaran. */
export function HalamanHutang() {
  const [url, setUrl] = useSearchParams();
  const terlambat = url.get('terlambat') === 'true';
  const idPemasok = Number(url.get('pemasok')) || null;
  const bolehBayar = usePengguna().izin.includes('hutang.kelola');
  const [cari, setCari] = useIngat('hutang.cari', '');
  const cariTertunda = useTunda(cari, 300);
  const [halaman, setHalaman] = useIngat('hutang.halaman', 1);
  const barisPerHalaman = useBarisPerHalaman();
  const [bayar, setBayar] = useState<BarisHutang | null>(null);
  const [riwayat, setRiwayat] = useState<BarisHutang | null>(null);
  const [perpanjang, setPerpanjang] = useState<BarisHutang | null>(null);
  const [hutangAwal, setHutangAwal] = useState(url.get('awal') === '1');
  const bolehPerpanjang = usePengguna().izin.includes('pembelian.setujui_semua');
  const daftar = useDaftarHutang({
    cari: cariTertunda,
    idPemasok,
    terlambat,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const r = daftar.data?.ringkasan;

  function atur(ubah: Record<string, string | null>) {
    const baru = new URLSearchParams(url);
    for (const [k, v] of Object.entries(ubah)) {
      if (v === null) baru.delete(k);
      else baru.set(k, v);
    }
    setUrl(baru, { replace: true });
    setHalaman(1);
  }

  const kolom: KolomTabel<BarisHutang>[] = [
    {
      kunci: 'nomor',
      judul: 'Dokumen',
      sel: (h) => (
        <div>
          {h.jenis === 'HUTANG_AWAL' ? (
            <span className="font-mono text-xs font-medium">{h.nomor}</span>
          ) : h.jenis === 'PENERIMAAN' ? (
            <Link
              to={`/penerimaan/${h.id}`}
              className="font-mono text-xs font-medium text-blue-700 hover:underline"
            >
              {h.nomor}
            </Link>
          ) : (
            <Link
              to={`/konsinyasi/${h.id}`}
              className="font-mono text-xs font-medium text-blue-700 hover:underline"
            >
              {h.nomor}
            </Link>
          )}
          <div className="max-w-64 truncate font-medium" title={h.namaPemasok}>
            {h.namaPemasok}
          </div>
          <div className="text-xs text-slate-500">
            {formatTanggal(h.tanggalOperasional)} ·{' '}
            {h.jenis === 'PENERIMAAN'
              ? 'pembelian'
              : h.jenis === 'HUTANG_AWAL'
                ? 'hutang awal (sebelum aplikasi)'
                : 'penyelesaian konsinyasi'}
            {h.noFaktur && ` · faktur ${h.noFaktur}`}
          </div>
        </div>
      ),
    },
    {
      kunci: 'tempo',
      judul: 'Jatuh tempo',
      sel: (h) => (
        <div>
          <div>{h.tanggalJatuhTempo ? formatTanggal(h.tanggalJatuhTempo) : '—'}</div>
          <div className="text-xs">
            <KeteranganTempo h={h} />
          </div>
        </div>
      ),
    },
    {
      kunci: 'total',
      judul: 'Total',
      className: 'text-right tabular-nums',
      sel: (h) => (
        <div>
          <div>{formatRupiah(h.total)}</div>
          {(h.dibayar > 0 || h.returPotong > 0) && (
            <div className="text-xs text-slate-500">
              {h.dibayar > 0 && `dibayar ${formatRupiah(h.dibayar)}`}
              {h.dibayar > 0 && h.returPotong > 0 && ' · '}
              {h.returPotong > 0 && `retur ${formatRupiah(h.returPotong)}`}
            </div>
          )}
        </div>
      ),
    },
    {
      kunci: 'sisa',
      judul: 'Sisa',
      className: 'text-right font-semibold tabular-nums',
      sel: (h) => formatRupiah(h.sisa),
    },
    { kunci: 'status', judul: 'Status', sel: (h) => <BadgeStatusHutang status={h.statusHutang} /> },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      sel: (h) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Riwayat pembayaran ${h.nomor}`}
            title="Riwayat pembayaran"
            onClick={() => setRiwayat(h)}
          >
            <History className="text-slate-500" />
          </Button>
          {bolehPerpanjang && h.jenis === 'PENERIMAAN' && h.tanggalJatuhTempo && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Perpanjang jatuh tempo ${h.nomor}`}
              title="Perpanjang jatuh tempo (Owner)"
              onClick={() => setPerpanjang(h)}
            >
              <CalendarClock className="text-slate-500" />
            </Button>
          )}
          {bolehBayar && (
            <Button size="sm" variant="outline" onClick={() => setBayar(h)}>
              <Wallet /> Bayar
            </Button>
          )}
        </div>
      ),
    },
  ];

  const umur = r?.umur;
  const totalUmur = r?.totalSisa ?? 0;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Hutang Pemasok</h1>
        <p className="text-sm text-slate-500">
          Pembelian tempo yang belum lunas. Bayar tunai keluar dari laci shift Anda; transfer
          dicatat dengan rekening tujuan.
        </p>
        {bolehBayar && (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setHutangAwal(true)}>
            <FilePlus2 /> Catat hutang awal pemasok
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => atur({ terlambat: null })}
          className={cn(
            'rounded-lg border bg-white p-3 text-left',
            !terlambat && 'border-blue-500 ring-1 ring-blue-500',
          )}
        >
          <div className="text-xs text-slate-500">Total hutang ({r?.jumlah ?? 0} dokumen)</div>
          <div className="text-xl font-semibold tabular-nums">
            {formatRupiah(r?.totalSisa ?? 0)}
          </div>
        </button>
        <button
          type="button"
          onClick={() => atur({ terlambat: terlambat ? null : 'true' })}
          className={cn(
            'rounded-lg border bg-white p-3 text-left',
            terlambat && 'border-red-500 ring-1 ring-red-500',
          )}
        >
          <div className="text-xs text-slate-500">
            Lewat jatuh tempo ({r?.jumlahTerlambat ?? 0})
          </div>
          <div className="text-xl font-semibold text-red-700 tabular-nums">
            {formatRupiah(r?.totalTerlambat ?? 0)}
          </div>
        </button>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-slate-500">Pemasok yang dihutangi</div>
          <div className="text-xl font-semibold tabular-nums">{r?.perPemasok.length ?? 0}</div>
        </div>
      </div>

      <Card className="gap-2 p-4" data-testid="umur-hutang">
        <div className="text-sm font-semibold text-slate-700">Umur hutang</div>
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
          {KELOMPOK_UMUR.map((k, i) =>
            umur && umur[k] > 0 && totalUmur > 0 ? (
              <div
                key={k}
                className={
                  ['bg-emerald-500', 'bg-amber-400', 'bg-orange-500', 'bg-red-500', 'bg-red-800'][i]
                }
                style={{ width: `${(umur[k] / totalUmur) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <div className="grid grid-cols-5 gap-2 text-sm">
          {KELOMPOK_UMUR.map((k) => (
            <div key={k}>
              <div className="text-xs text-slate-500">{LABEL_KELOMPOK_UMUR[k]}</div>
              <div className="font-medium tabular-nums">{formatRupiah(umur?.[k] ?? 0)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(1);
              }}
              placeholder="Cari nomor, faktur, atau pemasok…"
              className="pl-8"
              aria-label="Cari hutang"
            />
          </div>
          <Select
            value={idPemasok === null ? SEMUA : String(idPemasok)}
            onValueChange={(v) => atur({ pemasok: v === SEMUA ? null : v })}
          >
            <SelectTrigger className="w-96" aria-label="Saring pemasok">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua pemasok</SelectItem>
              {(r?.perPemasok ?? []).map((p) => (
                <SelectItem key={p.idPemasok} value={String(p.idPemasok)}>
                  {p.namaPemasok} · {p.jumlahDokumen} dokumen · {formatRupiah(p.totalSisa)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(h) => `${h.jenis}-${h.id}`}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Tidak ada hutang yang belum lunas."
        />
      </Card>
      {bayar && <DialogBayarHutang h={bayar} onTutup={() => setBayar(null)} />}
      {riwayat && <DialogRiwayatBayar h={riwayat} onTutup={() => setRiwayat(null)} />}
      {hutangAwal && <DialogHutangAwal onTutup={() => setHutangAwal(false)} />}
      {perpanjang && <DialogPerpanjang h={perpanjang} onTutup={() => setPerpanjang(null)} />}
    </div>
  );
}

/** HT2: bayar satu dokumen hutang, sebagian atau lunas. */
/** Data dokumen yang dibutuhkan dialog bayar (juga dipakai halaman detail setoran konsinyasi). */
export type DokumenBayar = Pick<
  BarisHutang,
  'jenis' | 'id' | 'nomor' | 'namaPemasok' | 'sisa' | 'tanggalJatuhTempo'
>;

export function DialogBayarHutang({ h, onTutup }: { h: DokumenBayar; onTutup: () => void }) {
  const bayar = useBayarHutang();
  const form = useForm<InputBayarHutang, unknown, DataBayarHutang>({
    resolver: zodResolver(skemaBayarHutang),
    defaultValues: {
      jenis: h.jenis,
      id: h.id,
      nominal: h.sisa,
      metode: 'TRANSFER',
      rekening: '',
      referensi: '',
      catatan: '',
    },
  });
  const metode = useWatch({ control: form.control, name: 'metode' });

  async function kirim(data: DataBayarHutang) {
    if (data.nominal > h.sisa) {
      form.setError('nominal', {
        message: `Nominal melebihi sisa hutang ${formatRupiah(h.sisa)}.`,
      });
      return;
    }
    try {
      const hasil = await bayar.mutateAsync(data);
      toast.success(
        hasil.statusHutang === 'LUNAS'
          ? `${hasil.nomor}: hutang ${h.nomor} lunas.`
          : `${hasil.nomor} dicatat; sisa hutang ${formatRupiah(hasil.sisa)}.`,
      );
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['nominal', 'metode', 'rekening', 'referensi']);
    }
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bayar hutang {h.nomor}</DialogTitle>
          <DialogDescription>
            {h.namaPemasok} · sisa {formatRupiah(h.sisa)}
            {h.tanggalJatuhTempo && ` · jatuh tempo ${formatTanggal(h.tanggalJatuhTempo)}`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="form-bayar-hutang"
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="space-y-3"
            noValidate
          >
            <FormField
              control={form.control}
              name="nominal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nominal</FormLabel>
                  <FormControl>
                    <InputRupiah {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metode</FormLabel>
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="radiogroup"
                    aria-label="Metode bayar"
                  >
                    {(['TRANSFER', 'TUNAI'] as const).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={field.value === m}
                        variant={field.value === m ? 'default' : 'outline'}
                        onClick={() => field.onChange(m)}
                      >
                        {m === 'TUNAI' ? 'Tunai (uang shift)' : 'Transfer'}
                      </Button>
                    ))}
                  </div>
                  {metode === 'TUNAI' && (
                    <FormDescription>
                      Uang keluar dari laci shift Anda dan tercatat sebagai kas &quot;Bayar
                      pemasok&quot;. Butuh shift kasir yang sedang buka.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {metode === 'TRANSFER' && (
              <FormField
                control={form.control}
                name="rekening"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rekening tujuan</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: BCA 123456 a.n. CV Maju"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="referensi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. referensi (wajib untuk transfer)</FormLabel>
                    <FormControl>
                      <Input placeholder="No. bukti" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="catatan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan (opsional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button type="submit" form="form-bayar-hutang" disabled={bayar.isPending}>
            {bayar.isPending ? 'Menyimpan…' : 'Simpan pembayaran'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogRiwayatBayar({ h, onTutup }: { h: BarisHutang; onTutup: () => void }) {
  const riwayat = usePembayaranHutang({ jenis: h.jenis, id: h.id });
  const data = riwayat.data ?? [];
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Riwayat pembayaran {h.nomor}</DialogTitle>
          <DialogDescription>
            Total {formatRupiah(h.total)} · dibayar {formatRupiah(h.dibayar)}
            {h.returPotong > 0 && ` · potongan retur ${formatRupiah(h.returPotong)}`} · sisa{' '}
            {formatRupiah(h.sisa)}
          </DialogDescription>
        </DialogHeader>
        {riwayat.isLoading ? (
          <p className="text-sm text-slate-500">Memuat…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada pembayaran.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {data.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 p-3">
                <div>
                  <div className="font-mono text-xs font-medium">{b.nomor}</div>
                  <div className="text-xs text-slate-500">
                    {formatWaktu(b.tanggal)} · {b.namaPengguna} ·{' '}
                    {LABEL_METODE_PEMBAYARAN_PEMASOK[b.metode]}
                    {b.rekening && ` · ${b.rekening}`}
                    {b.referensi && ` · ref ${b.referensi}`}
                  </div>
                  {b.catatan && <div className="text-xs text-slate-600">{b.catatan}</div>}
                </div>
                <div className="font-semibold tabular-nums">{formatRupiah(b.nominal)}</div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
