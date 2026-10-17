import {
  formatRupiah,
  JENIS_KAS_MANUAL,
  type BarisShift,
  type DetailShift,
  type HasilClerical,
  type JenisKasManual,
  type ShiftAktif,
} from '@sit/shared';
import { Calculator, LockOpen, Pencil, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useBarisPerHalaman } from '@/api/pengaturan';
import {
  useCatatKas,
  useDaftarShift,
  useDetailShift,
  useHitungBuka,
  usePenjelasanSelisih,
  useShiftSaya,
} from '@/api/penjualan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputRupiah } from '@/components/input-rupiah';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
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
import { Textarea } from '@/components/ui/textarea';
import { formatTanggal, formatWaktu } from '@/lib/format';
import { LABEL_JENIS_KAS } from '@/lib/label';
import { cn } from '@/lib/utils';
import { useSekarang } from '../pos/use-sekarang';
import { AlurTutupShift } from './alur-tutup-shift';
import { DialogBukaShift } from './dialog-buka-shift';
import { DialogKoreksiModal } from './dialog-koreksi-modal';
import { HITUNG_KOSONG, keJsonHitung, totalHitung, type NilaiHitung } from './hitung-uang';
import { InputHitungUang } from './input-hitung-uang';
import { TabNonTunai } from './tab-nontunai';
import { TampilBantuan, TampilTinjauan } from './tinjauan-shift';

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
      <Angka label="Modal awal" nilai={c.modalAwal - c.koreksiModal} />
      {c.koreksiModal !== 0 && <Angka label="Koreksi modal" nilai={c.koreksiModal} />}
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
            : Math.abs(c.selisih) <= c.toleransi
              ? 'bg-slate-100 text-slate-700'
              : c.selisih < 0
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700',
        )}
        data-testid="selisih-clerical"
      >
        <span>
          {c.selisih === 0
            ? 'Cocok'
            : Math.abs(c.selisih) <= c.toleransi
              ? 'Selisih receh'
              : c.selisih < 0
                ? 'Kurang'
                : 'Lebih'}
        </span>
        <span className="tabular-nums">{formatRupiah(c.selisih)}</span>
      </div>
      {c.keterangan && <p className="text-slate-600">Keterangan: {c.keterangan}</p>}
      {c.jumlahHitung > 1 && (
        <p className="text-xs text-amber-800">Dihitung ulang (2 hitungan tercatat).</p>
      )}
      <Angka label="Ditinggal di laci (modal berikutnya)" nilai={c.uangDitinggal} />
      <Angka label="Disetor" nilai={c.uangFisik - c.uangDitinggal} />
      {c.penjelasanAtasan && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          <b>Terjelaskan</b> oleh {c.dijelaskanOleh}
          {c.dijelaskanPada ? ` (${formatWaktu(c.dijelaskanPada)})` : ''}: {c.penjelasanAtasan}
        </p>
      )}
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

/** Tanda shift BUKA: biasa, lewat jam tutup, atau dari hari sebelumnya (K-109). Status dari API. */
function TandaBuka({ s }: { s: Pick<BarisShift, 'waktu'> & { status?: BarisShift['status'] } }) {
  if (s.status === 'DIHITUNG') {
    return (
      <Badge
        variant="outline"
        className="border-blue-300 bg-blue-50 text-blue-800"
        title="Hitungan uang sudah dikirim; penutupan belum diselesaikan (keterangan dan uang ditinggal di laci)."
      >
        Sedang ditutup
      </Badge>
    );
  }
  if (s.waktu?.terlewat) {
    return (
      <Badge
        variant="outline"
        className="border-red-300 bg-red-50 text-red-700"
        title="Shift dari hari sebelumnya yang belum ditutup. Penjualan dan pencatatan uang pemiliknya terkunci sampai shift ini ditutup."
      >
        Terlewat, belum ditutup
      </Badge>
    );
  }
  if (s.waktu?.lewatJadwal) {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800"
        title={`Sudah melewati jam tutup ${s.waktu.jadwalTutup ?? ''}. Segera hitung uang di laci dan tutup shift.`}
      >
        Buka, lewat jam tutup
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
      title="Shift masih berjalan."
    >
      Buka
    </Badge>
  );
}

/** K-121: hitung susulan untuk shift yang dibuka dengan "hitung nanti". */
function KartuHitungSusulan({ s }: { s: ShiftAktif }) {
  const kirim = useHitungBuka();
  const [n, setN] = useState<NilaiHitung>(HITUNG_KOSONG);
  const [yakin, setYakin] = useState(false);
  const total = totalHitung(n);
  const kini = useSekarang();
  const lewat = s.batasHitungBuka !== null && Date.parse(s.batasHitungBuka) <= kini;
  return (
    <Card
      className={cn(
        'gap-3 p-5',
        lewat ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50',
      )}
      data-testid="hitung-susulan"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Calculator className="size-4" /> Hitung uang laci (shift dibuka dengan "hitung nanti")
      </h2>
      <p className="text-sm text-slate-700">
        Hitung semua uang di laci <b>sekarang</b>, termasuk uang penjualan yang sudah masuk. Sistem
        menghitung modal sebenarnya saat buka = hasil hitungan − (tunai masuk − tunai keluar sejak
        shift dibuka). Batas: {s.batasHitungBuka ? formatWaktu(s.batasHitungBuka).slice(11) : '—'}
        {lewat && <b className="text-red-700"> (sudah lewat)</b>}.
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (total === null) return;
          if (!yakin) {
            setYakin(true);
            return;
          }
          kirim
            .mutateAsync({ id: s.id, json: keJsonHitung(n) })
            .then((h) =>
              toast.success(
                h.koreksiModal === 0
                  ? 'Hitungan cocok dengan modal sementara.'
                  : `Modal saat buka dikoreksi ${formatRupiah(h.koreksiModal)} (selisih semalam).`,
              ),
            )
            .catch((err: unknown) => {
              setYakin(false);
              toast.error(pesanGalat(err));
            });
        }}
      >
        <InputHitungUang
          id="susulan"
          nilai={n}
          onUbah={(v) => {
            setN(v);
            setYakin(false);
          }}
        />
        {!yakin ? (
          <Button type="submit" className="w-full" disabled={total === null}>
            Kirim hitungan susulan
          </Button>
        ) : (
          <div className="space-y-2 rounded-lg border-2 border-blue-300 bg-white p-3 text-sm">
            <p>
              Kirim hitungan <b>{formatRupiah(total ?? 0)}</b> sebagai isi laci saat ini? Hitungan
              susulan hanya sekali; selisihnya dicatat sebagai koreksi modal dan terlihat atasan.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setYakin(false)}>
                Kembali
              </Button>
              <Button type="submit" autoFocus disabled={kirim.isPending}>
                Ya, kirim
              </Button>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}

function ShiftSaya() {
  const saya = useShiftSaya();
  const pengguna = usePengguna();
  const atasan = pengguna.izin.includes('kas.shift.lihat_semua');
  const detail = useDetailShift(saya.data?.id ?? null);
  const [hasil, setHasil] = useState<DetailShift | null>(null);
  const [dialogBuka, setDialogBuka] = useState(false);
  const [koreksi, setKoreksi] = useState(false);

  if (hasil?.clerical) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-5">
          <h2 className="font-semibold">Shift {hasil.nomor} ditutup — hasil rekonsiliasi</h2>
          <KartuClerical c={hasil.clerical} />
          {hasil.bantuan && <TampilBantuan b={hasil.bantuan} />}
          <Button variant="outline" onClick={() => setHasil(null)}>
            Selesai
          </Button>
        </Card>
        {hasil.tinjauan && (
          <Card className="gap-3 p-5">
            <h2 className="font-semibold">Tinjauan shift</h2>
            <TampilTinjauan t={hasil.tinjauan} />
          </Card>
        )}
      </div>
    );
  }
  if (saya.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!saya.data) {
    return (
      <Card className="max-w-md gap-3 p-5">
        <h2 className="font-semibold">Belum ada shift terbuka</h2>
        <p className="text-sm text-slate-500">
          Buka shift sebelum menerima uang tunai. Ada tiga cara: sama dengan uang ditinggal kemarin,
          hitung sekarang, atau buka dulu lalu hitung nanti.
        </p>
        <Button onClick={() => setDialogBuka(true)} autoFocus>
          <LockOpen /> Buka shift
        </Button>
        {dialogBuka && <DialogBukaShift onTutup={() => setDialogBuka(false)} />}
      </Card>
    );
  }
  const s = saya.data;
  if (s.status === 'DIHITUNG') {
    return (
      <Card className="gap-3 p-5">
        <h2 className="font-semibold">Tutup shift {s.nomor}: hasil hitungan</h2>
        <AlurTutupShift idShift={s.id} status="DIHITUNG" onSelesai={setHasil} />
      </Card>
    );
  }
  const modal = s.modalAwal + s.koreksiModal;
  return (
    <div className="space-y-4">
      {s.batasHitungBuka && <KartuHitungSusulan s={s} />}
      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              Shift {s.nomor} <TandaBuka s={{ waktu: s }} />
            </h2>
            <span className="text-sm text-slate-500">
              dibuka {formatWaktu(s.waktuBuka)} · modal {formatRupiah(modal)}
              {s.koreksiModal !== 0 && ` (dikoreksi ${formatRupiah(s.koreksiModal)})`}
              {s.jadwalTutup && ` · jadwal tutup ${s.jadwalTutup}`}
            </span>
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={() => setKoreksi(true)}>
              <Pencil /> Koreksi modal
            </Button>
            <span className="ml-2 text-xs text-slate-500">
              Untuk salah ketik modal awal.
              {s.adaTransaksiTunai && !atasan && ' Sudah ada transaksi tunai: butuh kode atasan.'}
            </span>
          </div>
          {koreksi && (
            <DialogKoreksiModal shift={s} atasan={atasan} onTutup={() => setKoreksi(false)} />
          )}
          {s.terlewat && (
            <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
              Shift ini dari tanggal {formatTanggal(s.tanggalOperasional)} dan belum ditutup. Selama
              belum ditutup Anda tidak bisa mencatat penjualan atau kas. Hitung uang di laci, isi di
              kotak <b>Tutup shift & clerical check</b>, lalu buka shift baru.
            </p>
          )}
          <h3 className="text-sm font-semibold text-slate-700">
            Kas masuk / keluar (selain penjualan)
          </h3>
          <FormKas />
          {detail.data && <DaftarKas d={detail.data} />}
        </Card>
        <Card className="gap-3 p-5">
          <h2 className="font-semibold">Tutup shift & clerical check</h2>
          <AlurTutupShift idShift={s.id} status="BUKA" onSelesai={setHasil} />
        </Card>
      </div>
    </div>
  );
}

/** K-121 butir 8: penjelasan selisih oleh Admin/Owner setelah shift ditutup. */
function FormPenjelasan({ id }: { id: number }) {
  const jelaskan = usePenjelasanSelisih();
  const [isi, setIsi] = useState('');
  return (
    <form
      className="space-y-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        jelaskan
          .mutateAsync({ id, penjelasan: isi.trim() })
          .then(() => toast.success('Penjelasan selisih disimpan.'))
          .catch((err: unknown) => toast.error(pesanGalat(err)));
      }}
    >
      <Label htmlFor="penjelasan-selisih">Penjelasan selisih (Admin/Owner)</Label>
      <Textarea
        id="penjelasan-selisih"
        rows={2}
        value={isi}
        maxLength={255}
        onChange={(e) => setIsi(e.target.value)}
        placeholder="Sebab selisih yang ditemukan setelah shift ditutup. Angka tidak berubah."
      />
      <Button type="submit" size="sm" disabled={isi.trim().length < 3 || jelaskan.isPending}>
        Tandai terjelaskan
      </Button>
    </form>
  );
}

function DialogShift({ id, onTutup }: { id: number; onTutup: () => void }) {
  const d = useDetailShift(id).data;
  const saya = usePengguna();
  // K6: pemilik shift, atau pemegang `kas.shift.lihat_semua` (kasir lupa menutup), boleh menutup.
  const semua = saya.izin.includes('kas.shift.lihat_semua');
  const bolehTutup = d !== undefined && d.status !== 'TUTUP' && (d.idKasir === saya.id || semua);
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-4xl">
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
              <>
                <KartuClerical c={d.clerical} />
                {d.bantuan && <TampilBantuan b={d.bantuan} />}
                {semua && d.clerical.selisih !== 0 && !d.clerical.penjelasanAtasan && (
                  <FormPenjelasan id={d.id} />
                )}
              </>
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
            {d.tinjauan && d.status === 'TUTUP' && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-semibold">Tinjauan shift</summary>
                <div className="mt-2">
                  <TampilTinjauan t={d.tinjauan} />
                </div>
              </details>
            )}
            {bolehTutup && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <h3 className="text-sm font-semibold text-amber-900">
                  Tutup shift ini{d.idKasir !== saya.id ? ` (milik ${d.namaKasir})` : ''}
                </h3>
                {d.idKasir !== saya.id && (
                  <p className="text-xs text-amber-900">
                    Dipakai bila kasirnya lupa menutup atau tidak ada di toko. Hitung sendiri uang
                    di laci kasir itu lalu isi di bawah. Shift tercatat ditutup oleh Anda; kasir itu
                    bisa membuka shift baru sesudahnya.
                  </p>
                )}
                <AlurTutupShift
                  idShift={d.id}
                  status={d.status === 'DIHITUNG' ? 'DIHITUNG' : 'BUKA'}
                  milikSendiri={d.idKasir === saya.id}
                  onSelesai={() => toast.success(`Shift ${d.nomor} ditutup.`)}
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Riwayat() {
  const semua = usePengguna().izin.includes('kas.shift.lihat_semua');
  const [url] = useSearchParams();
  const [halaman, setHalaman] = useState(1);
  const [selisih, setSelisih] = useState(false);
  // Dibuka dari notifikasi "Shift perlu ditutup" (…?perlu=1): langsung disaring.
  const [perlu, setPerlu] = useState(url.get('perlu') === '1');
  const [buka, setBuka] = useState<number | null>(null);
  const perHalaman = useBarisPerHalaman();
  const daftar = useDaftarShift({
    status: null,
    adaSelisih: selisih,
    perluDitutup: perlu,
    halaman,
    perHalaman,
  });
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
          <TandaBuka s={s} />
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
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={perlu}
            onChange={(e) => {
              setPerlu(e.target.checked);
              setHalaman(1);
            }}
          />
          Hanya yang perlu ditutup (lewat jam tutup atau lewat hari)
        </label>
        {semua && (
          <span className="ml-auto text-xs text-slate-500">
            Klik nomor shift untuk melihat rinciannya; shift yang masih buka bisa ditutup dari sana.
          </span>
        )}
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
  const izin = usePengguna().izin;
  const semua = izin.includes('kas.shift.lihat_semua');
  // K-111: pengecekan uang masuk non-tunai, pasangan clerical check untuk uang yang tidak lewat laci.
  const bolehCek = izin.includes('kas.nontunai.verifikasi');
  const diminta = url.get('tab');
  const tab =
    diminta === 'riwayat' ? 'riwayat' : diminta === 'nontunai' && bolehCek ? 'nontunai' : 'saya';
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-xl font-semibold text-slate-900">Shift & Clerical Check</h1>
          <p className="text-sm text-slate-500">
            Rekonsiliasi uang dengan catatan sistem: uang tunai di laci (shift) dan uang non-tunai
            di rekening.
          </p>
        </div>
        <Penjelasan judul="Cara kerja shift dan clerical check">
          <ButirPenjelasan>
            <li>
              <b>Shift</b> = masa seorang kasir memegang laci uang. Dibuka dengan mengisi modal awal
              di laci; semua uang tunai yang diterima atau dikeluarkan kasir itu tercatat di
              shiftnya.
            </li>
            <li>
              <b>Buka shift, tiga cara</b>: (1) <i>sama dengan uang ditinggal kemarin</i> bila laci
              tidak disentuh sejak shift terakhir ditutup; (2) <i>hitung sekarang</i>, per pecahan
              atau ketik total; (3) <i>buka dulu, hitung nanti</i> bila toko sudah ramai: hitung
              uang laci dalam batas waktu, lalu sistem menghitung modal sebenarnya saat buka = hasil
              hitungan − (tunai masuk − tunai keluar sejak buka). Contoh: kemarin ditinggal Rp
              150.000; pukul 08.40 laci berisi Rp 160.000; sejak buka ada penjualan tunai Rp 20.000
              dan kasbon Rp 5.000 (bersih Rp 15.000) → modal saat buka Rp 145.000, jadi semalam
              berkurang Rp 5.000. Selisih semalam ini dicatat dan terlihat Owner.
            </li>
            <li>
              <b>Salah ketik modal?</b> Pakai <i>Koreksi modal</i>. Sebelum ada transaksi tunai
              boleh sendiri; sesudahnya butuh kode Admin/Owner. Angka lama tidak dihapus.
            </li>
            <li>
              <b>Tutup shift = clerical check, dua langkah</b>: (1) hitung uang di laci dan kirim
              tanpa melihat angka sistem; hitungan ini tercatat dan shift berhenti menerima uang.
              (2) Sistem menampilkan saldo menurut catatan, <b>selisih</b>, tinjauan shift (semua
              uang masuk/keluar), dan <b>bantuan mencari selisih</b>. Bila selisih di luar toleransi
              Anda boleh hitung ulang <b>sekali</b> (kedua hitungan tercatat), lalu keterangan
              wajib. Isi uang yang ditinggal di laci untuk besok; sisanya disetor.
            </li>
            <li>
              <b>Selisih receh</b>: selisih sampai batas toleransi (Pengaturan › Operasional, bawaan
              Rp 1.000) tidak dianggap masalah dan tidak perlu keterangan.
            </li>
            <li>
              <b>Sebab selisih ditemukan setelah shift ditutup?</b> Admin/Owner menulis penjelasan
              di rincian shift (tab Semua shift); angka tetap, selisih ditandai terjelaskan.
            </li>
            <li>
              <b>Sistem tidak pernah menutup shift sendiri</b>, karena menutup butuh hitungan uang
              sungguhan. Yang dilakukan sistem adalah mengingatkan dan, bila perlu, mengunci.
            </li>
            <li>
              <b>Jadwal shift</b> (diatur Admin/Owner di Pengaturan › Operasional): 15 menit sebelum
              jam tutup muncul pengingat; setelah jam tutup lewat muncul peringatan kuning dan
              Admin/Owner diberi tahu lewat lonceng dan Telegram/email. Penjualan masih bisa.
            </li>
            <li>
              <b>Shift terlewat</b> = shift dari hari sebelumnya yang belum ditutup (tanda merah).
              Pemiliknya <b>tidak bisa mencatat penjualan atau kas</b> sampai shift itu ditutup,
              supaya satu shift tidak memuat uang beberapa hari.
            </li>
            <li>
              <b>Kasir lupa menutup atau tidak ada di toko?</b> Admin/Owner membuka tab Semua shift,
              mengeklik nomor shiftnya, menghitung uang di laci kasir itu, lalu mengisi bagian{' '}
              <i>Tutup shift ini</i>. Shift tercatat ditutup oleh Admin/Owner tersebut.
            </li>
            <li>
              Shift yang sudah ditutup tidak bisa dibuka lagi. Koreksi dicatat di shift berikutnya
              lewat kas masuk/keluar lain dengan keterangan.
            </li>
          </ButirPenjelasan>
        </Penjelasan>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => setUrl(v === 'saya' ? {} : { tab: v }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="saya">Shift saya</TabsTrigger>
          <TabsTrigger value="riwayat">{semua ? 'Semua shift' : 'Riwayat'}</TabsTrigger>
          {bolehCek && <TabsTrigger value="nontunai">Cek uang non-tunai</TabsTrigger>}
        </TabsList>
        <TabsContent value="saya">
          <ShiftSaya />
        </TabsContent>
        <TabsContent value="riwayat">
          <Riwayat />
        </TabsContent>
        {bolehCek && (
          <TabsContent value="nontunai">
            <TabNonTunai />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
