import {
  formatRupiah,
  JENIS_KAS_MANUAL,
  type BarisShift,
  type DetailShift,
  type HasilClerical,
  type JenisKasManual,
  type ShiftAktif,
} from '@sit/shared';
import { Calculator, LockOpen, Pencil, Plus, RotateCcw, Save } from 'lucide-react';
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
  useSimpanHitungBuka,
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
import { KodeInfo } from '@/components/kode-info';

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
      <Angka label="Ditinggal untuk shift berikutnya" nilai={c.uangDitinggal} />
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
                <KodeInfo
                  nomor={k.nomorDokumen}
                  className="ml-1 font-mono text-xs text-slate-500"
                />
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
      className="grid grid-cols-2 items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        simpan();
      }}
    >
      <div className="min-w-0 space-y-1">
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
      <div className="min-w-0 space-y-1">
        <Label htmlFor="nominal-kas">Nominal</Label>
        <InputRupiah id="nominal-kas" value={nominal} onChange={setNominal} />
      </div>
      <div className="col-span-2 flex min-w-0 items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="ket-kas">Keterangan</Label>
          <Input
            id="ket-kas"
            value={ket}
            maxLength={255}
            onChange={(e) => setKet(e.target.value)}
            placeholder={jenis === 'KASBON' ? 'Siapa & untuk apa' : 'Opsional'}
          />
        </div>
        <Button type="submit" className="shrink-0" disabled={!nominal || catat.isPending}>
          <Plus /> Catat
        </Button>
      </div>
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
        title="Hitungan uang sudah dikirim; penutupan belum diselesaikan (keterangan dan uang ditinggal)."
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
        title={`Sudah melewati jam tutup ${s.waktu.jadwalTutup ?? ''}. Segera hitung uang shift dan tutup shift.`}
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

function Baris({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', tebal && 'border-t pt-1 font-bold')}>
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums">{nilai}</span>
    </div>
  );
}

/**
 * K-134: hitung susulan shift "buka dulu, hitung nanti" — hitung → hasil → hitung ulang sekali bila beda →
 * simpan. Pola sama dengan tutup shift.
 */
function KartuHitungSusulan({ s }: { s: ShiftAktif }) {
  const kirim = useHitungBuka();
  const simpan = useSimpanHitungBuka();
  const [n, setN] = useState<NilaiHitung>(HITUNG_KOSONG);
  const [yakin, setYakin] = useState(false);
  const [ulang, setUlang] = useState(false);
  const total = totalHitung(n);
  const kini = useSekarang();
  const lewat = s.batasHitungBuka !== null && Date.parse(s.batasHitungBuka) <= kini;
  const h = s.hitungBuka;
  const tampilForm = h === null || ulang;

  function kirimHitungan() {
    kirim
      .mutateAsync({ id: s.id, json: keJsonHitung(n) })
      .then(() => {
        setYakin(false);
        setUlang(false);
        setN(HITUNG_KOSONG);
      })
      .catch((err: unknown) => {
        setYakin(false);
        toast.error(pesanGalat(err));
      });
  }

  return (
    <Card
      className={cn(
        'gap-3 p-5',
        lewat ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50',
      )}
      data-testid="hitung-susulan"
    >
      <h2 className="flex flex-wrap items-center gap-2 font-semibold">
        <Calculator className="size-4" /> Hitung uang shift
        <span className="text-sm font-normal text-slate-600">
          batas {s.batasHitungBuka ? formatWaktu(s.batasHitungBuka).slice(11) : '—'}
          {lewat && <b className="text-red-700"> (lewat)</b>}
        </span>
      </h2>
      {tampilForm ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (total === null) return;
            if (!yakin) setYakin(true);
            else kirimHitungan();
          }}
        >
          <p className="text-sm text-slate-700">
            Hitung <b>semua</b> uang shift, termasuk uang penjualan tadi. Tidak perlu dipisah:
            sistem tahu uang yang masuk dan kembalian yang keluar.
          </p>
          <InputHitungUang
            id="susulan"
            nilai={n}
            autoFocus={ulang}
            onUbah={(v) => {
              setN(v);
              setYakin(false);
            }}
          />
          {!yakin ? (
            <Button type="submit" className="w-full" disabled={total === null}>
              {ulang ? 'Kirim hitung ulang' : 'Kirim hitungan'}
            </Button>
          ) : (
            <div className="space-y-2 rounded-lg border-2 border-blue-300 bg-white p-3 text-sm">
              <p>
                Laci berisi <b>{formatRupiah(total ?? 0)}</b>? Hitungan ini tercatat
                {ulang ? ' (hitung ulang terakhir).' : '.'}
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
          {ulang && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setUlang(false)}>
              Batal hitung ulang
            </Button>
          )}
        </form>
      ) : (
        <div className="space-y-3" data-testid="hasil-hitung-susulan">
          <div className="space-y-1 rounded-lg border bg-white p-3 text-sm">
            <Baris label="Uang shift dihitung" nilai={formatRupiah(h.laci)} />
            <Baris label="− Uang masuk sejak buka" nilai={formatRupiah(h.masukSejakBuka)} />
            <Baris label="= Modal saat buka" nilai={formatRupiah(h.modalSaatBuka)} tebal />
            <Baris
              label="Kemarin ditinggal"
              nilai={h.ditinggalKemarin === null ? '—' : formatRupiah(h.ditinggalKemarin)}
            />
          </div>
          <p
            className={cn(
              'rounded-md px-3 py-2 font-bold',
              h.selisih === 0
                ? 'bg-emerald-50 text-emerald-800'
                : h.dalamToleransi
                  ? 'bg-slate-100 text-slate-800'
                  : 'bg-red-50 text-red-800',
            )}
            data-testid="selisih-semalam"
          >
            {h.selisih === 0
              ? 'Cocok dengan uang kemarin'
              : `Selisih semalam ${formatRupiah(h.selisih)}${h.dalamToleransi ? ' (receh)' : ''}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {h.bolehHitungUlang && (
              <Button variant="outline" onClick={() => setUlang(true)}>
                <RotateCcw /> Hitung ulang (sekali)
              </Button>
            )}
            <Button
              autoFocus
              disabled={simpan.isPending}
              onClick={() =>
                void simpan
                  .mutateAsync(s.id)
                  .then(() => toast.success('Hitung uang shift disimpan; modal awal sudah benar.'))
                  .catch((err: unknown) => toast.error(pesanGalat(err)))
              }
            >
              <Save /> Simpan hasil
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {h.jumlahHitung >= 2 ? 'Sudah dihitung ulang. ' : ''}Salah hitung setelah disimpan:
            pakai Koreksi modal.
          </p>
        </div>
      )}
    </Card>
  );
}

function ShiftSaya() {
  const saya = useShiftSaya(true, true);
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
        <h2 className="font-semibold">Shift toko belum dibuka</h2>
        <p className="text-sm text-slate-500">
          Uang tunai baru bisa diterima setelah shift dibuka.
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
  const menungguHitung = s.batasHitungBuka !== null;
  return (
    <div className="space-y-4">
      {menungguHitung && <KartuHitungSusulan s={s} />}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0 gap-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              Shift toko {s.nomor} <TandaBuka s={{ waktu: s }} />
            </h2>
            <span className="text-sm text-slate-500">
              dibuka {s.namaPembuka}, {formatWaktu(s.waktuBuka)} · modal {formatRupiah(modal)}
              {s.koreksiModal !== 0 && ` (dikoreksi ${formatRupiah(s.koreksiModal)})`}
              {s.jadwalTutup && ` · jadwal tutup ${s.jadwalTutup}`}
            </span>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={menungguHitung}
              onClick={() => setKoreksi(true)}
            >
              <Pencil /> Koreksi modal
            </Button>
            <span className="ml-2 text-xs text-slate-500">
              {menungguHitung
                ? 'Tersedia setelah hitung uang shift disimpan.'
                : s.adaTransaksiTunai && !atasan
                  ? 'Salah ketik modal. Sudah ada transaksi tunai: butuh kode atasan.'
                  : 'Salah ketik modal.'}
            </span>
          </div>
          {koreksi && (
            <DialogKoreksiModal shift={s} atasan={atasan} onTutup={() => setKoreksi(false)} />
          )}
          {s.terlewat && (
            <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
              Shift tanggal {formatTanggal(s.tanggalOperasional)} belum ditutup. Uang tunai tidak
              bisa dicatat sampai ditutup: hitung laci di kotak <b>Tutup shift</b>, lalu buka shift
              baru.
            </p>
          )}
          <h3 className="text-sm font-semibold text-slate-700">
            Kas masuk / keluar (selain penjualan)
          </h3>
          <FormKas />
          {detail.data && <DaftarKas d={detail.data} />}
        </Card>
        <Card className="min-w-0 gap-3 p-5">
          <h2 className="font-semibold">Tutup shift</h2>
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
  const [, setUrl] = useSearchParams();
  const semua = saya.izin.includes('kas.shift.lihat_semua');
  // K-132, U10: hanya ada satu shift terbuka; ia ditutup di tab Shift toko, bukan dari riwayat.
  const berjalan = d !== undefined && d.status !== 'TUTUP';
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Shift {d?.nomor} · dibuka {d?.namaKasir}
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
            {berjalan && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <span>
                  Ini shift toko yang sedang berjalan. Hitung dan tutup di tab Shift toko.
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    onTutup();
                    setUrl({}, { replace: true });
                  }}
                >
                  Ke tab Shift toko
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Riwayat() {
  const [halaman, setHalaman] = useState(1);
  const [selisih, setSelisih] = useState(false);
  const [buka, setBuka] = useState<number | null>(null);
  const perHalaman = useBarisPerHalaman();
  const daftar = useDaftarShift({
    status: null,
    adaSelisih: selisih,
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
    { kunci: 'kasir', judul: 'Dibuka oleh', sel: (s: BarisShift) => s.namaKasir },
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
        <span className="ml-auto text-xs text-slate-500">Klik nomor shift untuk rinciannya.</span>
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
          <p className="text-sm text-slate-500">Cocokkan uang shift dan rekening dengan catatan.</p>
        </div>
        <Penjelasan judul="Cara kerja shift">
          <ButirPenjelasan>
            <li>
              <b>Shift</b> = masa uang tunai toko dipegang, dari buka sampai tutup. Hanya ada{' '}
              <b>satu shift terbuka</b>; siapa pun yang berizin boleh membuka dan menutupnya. Setiap
              uang tunai tercatat di shift itu beserta nama pencatatnya.
            </li>
            <li>
              <b>Buka shift</b>: <i>Pakai uang kemarin</i> (uang tidak disentuh),{' '}
              <i>Hitung sekarang</i>, atau <i>Buka dulu, hitung nanti</i> (toko sudah ramai).
            </li>
            <li>
              <b>Hitung nanti</b>: hitung semua uang shift, tanpa memisah uang penjualan. Contoh:
              laci Rp 160.000 − masuk sejak buka Rp 15.000 = modal saat buka Rp 145.000. Kemarin
              ditinggal Rp 150.000 → selisih semalam −Rp 5.000 (tercatat untuk Owner). Beda besar:
              hitung ulang sekali, lalu simpan.
            </li>
            <li>
              <b>Salah ketik modal</b>: Koreksi modal. Setelah ada transaksi tunai butuh kode
              atasan.
            </li>
            <li>
              <b>Tambah uang shift</b> (mis. receh habis) dan <b>setor ke owner</b>: catat di Kas
              masuk / keluar. Bukan penjualan.
            </li>
            <li>
              <b>Tutup shift</b>: (1) hitung uang shift tanpa melihat angka sistem, kirim; (2) lihat
              selisih, tinjauan, dan bantuan mencari selisih; hitung ulang sekali bila perlu; isi
              keterangan bila selisih di atas toleransi; isi uang ditinggal untuk besok.
            </li>
            <li>
              <b>Pembeli datang setelah tutup</b>: buka shift baru (Pakai uang kemarin, 1 Enter).
            </li>
            <li>
              <b>Shift kemarin belum ditutup</b>: uang tunai terkunci sampai ditutup. Sistem tidak
              pernah menutup shift sendiri.
            </li>
          </ButirPenjelasan>
        </Penjelasan>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => setUrl(v === 'saya' ? {} : { tab: v }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="saya">Shift toko</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
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
