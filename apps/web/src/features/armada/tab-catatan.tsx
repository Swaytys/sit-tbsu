import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  skemaCatatBbm,
  skemaCatatServis,
  type CatatanBbm,
  type CatatanServis,
  type DataCatatBbm,
  type DataCatatServis,
  type InputCatatBbm,
  type InputCatatServis,
} from '@sit/shared';
import { Ban, Fuel, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useBatalCatatan,
  useCatatBbm,
  useCatatServis,
  useDaftarBbm,
  useDaftarKendaraan,
  useDaftarServis,
  useDaftarSopir,
} from '@/api/armada';
import { pesanGalat } from '@/api/client';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputRupiah } from '@/components/input-rupiah';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formatTanggal, tanggalHariIni } from '@/lib/format';
import { tampilkanGalatForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import { tandaSurat } from './tanda-surat';

/*
 * K-162: catatan BBM dan servis (docs/13 §5). Pencatatan saja; tidak mengubah kas shift. Catatan salah
 * dibatalkan dengan alasan lalu dicatat ulang.
 */

const kelasPilih =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

/** Odometer (km bulat, sampai 7 angka); kosong = null. */
function IsianKm({
  value,
  onChange,
  label,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <Input
      inputMode="numeric"
      className="text-right"
      aria-label={label}
      placeholder="mis. 125400"
      value={value === null || value === undefined ? '' : value.toLocaleString('id-ID')}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 7);
        onChange(v === '' ? null : Number(v));
      }}
    />
  );
}

function PilihKendaraan({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const kendaraan = useDaftarKendaraan('AKTIF');
  return (
    <select
      autoFocus
      className={kelasPilih}
      aria-label="Kendaraan"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
    >
      <option value="">— pilih kendaraan —</option>
      {(kendaraan.data ?? []).map((k) => (
        <option key={k.id} value={k.id}>
          {k.plat} · {k.jenis}
          {k.kesehatan.odometerKm !== null
            ? ` · terakhir ${k.kesehatan.odometerKm.toLocaleString('id-ID')} km`
            : ''}
          {tandaSurat(k)}
        </option>
      ))}
    </select>
  );
}

function DialogBbm({ onTutup }: { onTutup: () => void }) {
  const catat = useCatatBbm();
  const sopir = useDaftarSopir('AKTIF');
  const form = useForm<InputCatatBbm, unknown, DataCatatBbm>({
    resolver: zodResolver(skemaCatatBbm),
    defaultValues: {
      tanggal: tanggalHariIni(),
      idSopir: null,
      idPerjalanan: null,
      odometerKm: null,
      liter: '',
      totalRp: undefined,
      penuh: false,
      catatan: '',
    },
  });
  async function kirim(data: DataCatatBbm) {
    try {
      await catat.mutateAsync(data);
      toast.success('Catatan BBM disimpan.');
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'idKendaraan',
        'tanggal',
        'idSopir',
        'idPerjalanan',
        'odometerKm',
        'liter',
        'totalRp',
      ]);
    }
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat BBM</DialogTitle>
          <DialogDescription>
            Salin dari struk SPBU. Odometer = angka km di dasbor saat mengisi. Tidak mengubah uang
            shift; bila dibayar dari laci, catat juga di Shift sebagai uang keluar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-3" noValidate>
            <FormField
              control={form.control}
              name="idKendaraan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kendaraan</FormLabel>
                  <PilihKendaraan value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="tanggal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal</FormLabel>
                    <FormControl>
                      <Input type="date" max={tanggalHariIni()} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="idSopir"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sopir (boleh kosong)</FormLabel>
                    <select
                      className={kelasPilih}
                      aria-label="Sopir"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      <option value="">—</option>
                      {(sopir.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nama}
                        </option>
                      ))}
                    </select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="odometerKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Odometer (km, boleh kosong)</FormLabel>
                  <FormControl>
                    <IsianKm label="Odometer" value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="liter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liter</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        className="text-right"
                        placeholder="mis. 35,5"
                        aria-label="Liter"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value.replace(/[^\d,.]/g, ''))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="totalRp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total bayar</FormLabel>
                    <FormControl>
                      <InputRupiah
                        aria-label="Total bayar"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="penuh"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Tangki diisi penuh</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder="mis. SPBU Peterongan"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onTutup}>
                Batal
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DialogServis({ onTutup }: { onTutup: () => void }) {
  const catat = useCatatServis();
  const form = useForm<InputCatatServis, unknown, DataCatatServis>({
    resolver: zodResolver(skemaCatatServis),
    defaultValues: {
      tanggal: tanggalHariIni(),
      odometerKm: null,
      jenis: '',
      biayaRp: undefined,
      bengkel: '',
      catatan: '',
    },
  });
  async function kirim(data: DataCatatServis) {
    try {
      await catat.mutateAsync(data);
      toast.success('Catatan servis disimpan.');
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'idKendaraan',
        'tanggal',
        'odometerKm',
        'jenis',
        'biayaRp',
      ]);
    }
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat servis</DialogTitle>
          <DialogDescription>
            Servis terakhir menjadi dasar pengingat servis berikutnya (atur jaraknya di data
            kendaraan).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-3" noValidate>
            <FormField
              control={form.control}
              name="idKendaraan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kendaraan</FormLabel>
                  <PilihKendaraan value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="tanggal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal</FormLabel>
                    <FormControl>
                      <Input type="date" max={tanggalHariIni()} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="odometerKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Odometer (km)</FormLabel>
                    <FormControl>
                      <IsianKm label="Odometer" value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="jenis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis servis</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="mis. Ganti oli + filter, Servis rem" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="biayaRp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biaya</FormLabel>
                    <FormControl>
                      <InputRupiah
                        aria-label="Biaya"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bengkel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bengkel</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onTutup}>
                Batal
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** Batalkan catatan yang salah (alasan wajib). */
function DialogBatal({
  jenis,
  id,
  label,
  onTutup,
}: {
  jenis: 'bbm' | 'servis';
  id: number;
  label: string;
  onTutup: () => void;
}) {
  const batal = useBatalCatatan();
  const [alasan, setAlasan] = useState('');
  function kirim() {
    if (alasan.trim().length < 3) {
      toast.error('Tulis alasannya (min. 3 huruf).');
      return;
    }
    batal
      .mutateAsync({ jenis, id, alasan: alasan.trim() })
      .then(() => {
        toast.success('Catatan dibatalkan.');
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan catatan</DialogTitle>
          <DialogDescription>
            {label}. Catatan tetap terlihat bertanda batal dan tidak dihitung lagi. Catat ulang bila
            angkanya salah.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Alasan batal"
          placeholder="mis. Salah ketik odometer"
          value={alasan}
          maxLength={255}
          onChange={(e) => setAlasan(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && kirim()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button variant="destructive" disabled={batal.isPending} onClick={kirim}>
            {batal.isPending ? 'Memproses…' : 'Batalkan catatan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaringKendaraan({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const kendaraan = useDaftarKendaraan();
  return (
    <select
      className={cn(kelasPilih, 'w-56')}
      aria-label="Saring kendaraan"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
    >
      <option value="">Semua kendaraan</option>
      {(kendaraan.data ?? []).map((k) => (
        <option key={k.id} value={k.id}>
          {k.plat}
        </option>
      ))}
    </select>
  );
}

const km = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('id-ID')} km`);

function SelBatal({ c }: { c: { batalPada: string | null; alasanBatal: string | null } }) {
  if (!c.batalPada) return null;
  return (
    <Badge
      variant="outline"
      className="border-red-200 bg-red-50 text-red-700"
      title={c.alasanBatal ?? ''}
    >
      Batal: {c.alasanBatal}
    </Badge>
  );
}

export function TabBbm({ bolehBatal }: { bolehBatal: boolean }) {
  const [idKendaraan, setIdKendaraan] = useState<number | undefined>();
  const [halaman, setHalaman] = useState(1);
  const daftar = useDaftarBbm({ idKendaraan, halaman });
  const [dialog, setDialog] = useState(false);
  const [batal, setBatal] = useState<CatatanBbm | null>(null);
  const kolom: KolomTabel<CatatanBbm>[] = [
    { kunci: 'tanggal', judul: 'Tanggal', className: 'w-28', sel: (c) => formatTanggal(c.tanggal) },
    { kunci: 'plat', judul: 'Kendaraan', sel: (c) => <span className="font-mono">{c.plat}</span> },
    { kunci: 'sopir', judul: 'Sopir', sel: (c) => c.namaSopir ?? '—' },
    { kunci: 'odo', judul: 'Odometer', className: 'text-right', sel: (c) => km(c.odometerKm) },
    {
      kunci: 'liter',
      judul: 'Liter',
      className: 'text-right',
      sel: (c) => (
        <span>
          {c.liter.replace('.', ',')} L
          {c.penuh && <span className="ml-1 text-xs text-slate-500">(penuh)</span>}
        </span>
      ),
    },
    { kunci: 'rp', judul: 'Total', className: 'text-right', sel: (c) => formatRupiah(c.totalRp) },
    {
      kunci: 'ket',
      judul: 'Keterangan',
      sel: (c) => (
        <div className="space-y-0.5 text-xs">
          <div className="text-slate-500">
            {c.catatan ? `${c.catatan} · ` : ''}oleh {c.pencatat}
          </div>
          <SelBatal c={c} />
        </div>
      ),
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (c) =>
        bolehBatal &&
        !c.batalPada && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Batalkan catatan BBM ${c.plat} ${formatTanggal(c.tanggal)}`}
            title="Batalkan catatan yang salah"
            onClick={() => setBatal(c)}
          >
            <Ban className="text-slate-500" />
          </Button>
        ),
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <SaringKendaraan
          value={idKendaraan}
          onChange={(v) => {
            setIdKendaraan(v);
            setHalaman(1);
          }}
        />
        <p className="text-sm text-slate-500">
          Isi BBM dari struk SPBU; dipakai menghitung km per liter.
        </p>
        <Button size="sm" className="ml-auto" onClick={() => setDialog(true)}>
          <Fuel /> Catat BBM
        </Button>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(c) => c.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada catatan BBM."
      />
      {dialog && <DialogBbm onTutup={() => setDialog(false)} />}
      {batal && (
        <DialogBatal
          jenis="bbm"
          id={batal.id}
          label={`BBM ${batal.plat} ${formatTanggal(batal.tanggal)}, ${batal.liter.replace('.', ',')} L`}
          onTutup={() => setBatal(null)}
        />
      )}
    </Card>
  );
}

export function TabServis({ bolehKelola }: { bolehKelola: boolean }) {
  const [idKendaraan, setIdKendaraan] = useState<number | undefined>();
  const [halaman, setHalaman] = useState(1);
  const daftar = useDaftarServis({ idKendaraan, halaman });
  const [dialog, setDialog] = useState(false);
  const [batal, setBatal] = useState<CatatanServis | null>(null);
  const kolom: KolomTabel<CatatanServis>[] = [
    { kunci: 'tanggal', judul: 'Tanggal', className: 'w-28', sel: (c) => formatTanggal(c.tanggal) },
    { kunci: 'plat', judul: 'Kendaraan', sel: (c) => <span className="font-mono">{c.plat}</span> },
    { kunci: 'jenis', judul: 'Jenis servis', sel: (c) => c.jenis },
    { kunci: 'odo', judul: 'Odometer', className: 'text-right', sel: (c) => km(c.odometerKm) },
    { kunci: 'rp', judul: 'Biaya', className: 'text-right', sel: (c) => formatRupiah(c.biayaRp) },
    {
      kunci: 'ket',
      judul: 'Keterangan',
      sel: (c) => (
        <div className="space-y-0.5 text-xs">
          <div className="text-slate-500">
            {[c.bengkel, c.catatan].filter(Boolean).join(' · ')}
            {c.bengkel || c.catatan ? ' · ' : ''}oleh {c.pencatat}
          </div>
          <SelBatal c={c} />
        </div>
      ),
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (c) =>
        bolehKelola &&
        !c.batalPada && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Batalkan catatan servis ${c.plat} ${formatTanggal(c.tanggal)}`}
            title="Batalkan catatan yang salah"
            onClick={() => setBatal(c)}
          >
            <Ban className="text-slate-500" />
          </Button>
        ),
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <SaringKendaraan
          value={idKendaraan}
          onChange={(v) => {
            setIdKendaraan(v);
            setHalaman(1);
          }}
        />
        <p className="text-sm text-slate-500">
          Servis terakhir menentukan pengingat servis berikutnya.
        </p>
        {bolehKelola && (
          <Button size="sm" className="ml-auto" onClick={() => setDialog(true)}>
            <Wrench /> Catat servis
          </Button>
        )}
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(c) => c.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada catatan servis."
      />
      {dialog && <DialogServis onTutup={() => setDialog(false)} />}
      {batal && (
        <DialogBatal
          jenis="servis"
          id={batal.id}
          label={`Servis ${batal.plat} ${formatTanggal(batal.tanggal)}: ${batal.jenis}`}
          onTutup={() => setBatal(null)}
        />
      )}
    </Card>
  );
}
