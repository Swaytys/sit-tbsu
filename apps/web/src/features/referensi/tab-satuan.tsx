import { zodResolver } from '@hookform/resolvers/zod';
import {
  JENIS_DIMENSI,
  JENIS_DIMENSI_FISIK,
  skemaSatuanInput,
  type DataSatuan,
  type InputSatuan,
  type Satuan,
  type StatusAktif,
} from '@sit/shared';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useDaftarSatuan, useSimpanSatuan, useStatusSatuan } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
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
import { Switch } from '@/components/ui/switch';
import { jalankanDenganToast } from '@/lib/aksi';
import { tampilkanGalatForm } from '@/lib/form';
import { formatDesimal } from '@/lib/format';
import { LABEL_JENIS_DIMENSI } from '@/lib/label';

const DIMENSI_FISIK: readonly string[] = JENIS_DIMENSI_FISIK;

/** numeric(18,6) dari API ke teks input berkoma, mis. "0.010000" → "0,01", "1000.000000" → "1000". */
function faktorUntukInput(nilai: string) {
  if (!nilai.includes('.')) return nilai;
  return nilai.replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

function DialogSatuan({
  satuan,
  semua,
  onTutup,
}: {
  satuan: Satuan | null;
  semua: Satuan[];
  onTutup: () => void;
}) {
  const simpan = useSimpanSatuan();
  const terkunci = (satuan?.jumlahDipakai ?? 0) > 0;
  const form = useForm<InputSatuan, unknown, DataSatuan>({
    resolver: zodResolver(skemaSatuanInput),
    defaultValues: {
      kode: satuan?.kode ?? '',
      nama: satuan?.nama ?? '',
      jenisDimensi: satuan?.jenisDimensi ?? 'PANJANG',
      faktorKeBasis: satuan ? faktorUntukInput(satuan.faktorKeBasis) : '1',
      isBasis: satuan?.isBasis ?? false,
    },
  });
  const [dimensi, isBasis, faktor, kode] = useWatch({
    control: form.control,
    name: ['jenisDimensi', 'isBasis', 'faktorKeBasis', 'kode'],
  });
  const fisik = DIMENSI_FISIK.includes(dimensi);
  const basis = semua.find((s) => s.jenisDimensi === dimensi && s.isBasis && s.id !== satuan?.id);

  async function kirim(data: DataSatuan) {
    try {
      await simpan.mutateAsync({ id: satuan?.id, json: data });
      toast.success(`Satuan ${data.kode} disimpan.`);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'kode',
        'nama',
        'jenisDimensi',
        'faktorKeBasis',
        'isBasis',
      ]);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{satuan ? 'Ubah satuan' : 'Tambah satuan'}</DialogTitle>
          {terkunci && (
            <DialogDescription className="flex items-center gap-1.5">
              <Lock className="size-3.5" /> Sudah dipakai {satuan?.jumlahDipakai} kali: dimensi,
              faktor, dan status basis dikunci.
            </DialogDescription>
          )}
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="kode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kode</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="cm" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama</FormLabel>
                  <FormControl>
                    <Input placeholder="Sentimeter" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="jenisDimensi"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Jenis dimensi</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={terkunci}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {JENIS_DIMENSI.map((d) => (
                        <SelectItem key={d} value={d}>
                          {LABEL_JENIS_DIMENSI[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!fisik && (
                    <FormDescription>
                      Satuan hitung berdiri sendiri (faktor 1). Konversi seperti “1 dus = 12 buah”
                      diatur per barang.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {fisik && (
              <>
                <FormField
                  control={form.control}
                  name="isBasis"
                  render={({ field }) => (
                    <FormItem className="col-span-2 flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Satuan basis dimensi ini</FormLabel>
                        <FormDescription>
                          {basis
                            ? `Basis saat ini: ${basis.kode}.`
                            : 'Dimensi ini belum punya basis.'}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(v) => {
                            field.onChange(v);
                            if (v) form.setValue('faktorKeBasis', '1');
                          }}
                          disabled={terkunci}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {!isBasis && (
                  <FormField
                    control={form.control}
                    name="faktorKeBasis"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Faktor ke satuan basis</FormLabel>
                        <FormControl>
                          <Input inputMode="decimal" disabled={terkunci} {...field} />
                        </FormControl>
                        <FormDescription>
                          1 {kode || '…'} = {faktor || '…'} {basis?.kode ?? '(basis)'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
            <DialogFooter className="col-span-2">
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

export function TabSatuan() {
  const daftar = useDaftarSatuan();
  const ubahStatus = useStatusSatuan();
  const [dialog, setDialog] = useState<{ satuan: Satuan | null } | null>(null);
  const data = daftar.data ?? [];

  // Kode satuan basis per dimensi fisik, untuk menampilkan "0,01 m" (hanya tampilan).
  const kodeBasis = new Map(
    data
      .filter((s) => s.isBasis && DIMENSI_FISIK.includes(s.jenisDimensi))
      .map((s) => [s.jenisDimensi, s.kode]),
  );

  const kolom: KolomTabel<Satuan>[] = [
    { kunci: 'kode', judul: 'Kode', sel: (s) => <span className="font-mono">{s.kode}</span> },
    { kunci: 'nama', judul: 'Nama', sel: (s) => s.nama },
    { kunci: 'dimensi', judul: 'Jenis dimensi', sel: (s) => LABEL_JENIS_DIMENSI[s.jenisDimensi] },
    {
      kunci: 'faktor',
      judul: 'Faktor ke basis',
      className: 'text-right tabular-nums',
      sel: (s) =>
        DIMENSI_FISIK.includes(s.jenisDimensi) ? (
          `${formatDesimal(s.faktorKeBasis)} ${kodeBasis.get(s.jenisDimensi) ?? ''}`
        ) : (
          <span className="text-slate-400" title="Konversi satuan hitung diatur per barang">
            —
          </span>
        ),
    },
    {
      kunci: 'basis',
      judul: 'Basis',
      sel: (s) =>
        DIMENSI_FISIK.includes(s.jenisDimensi) &&
        s.isBasis && (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Basis
          </Badge>
        ),
    },
    { kunci: 'pakai', judul: 'Dipakai', className: 'text-right', sel: (s) => s.jumlahDipakai },
    { kunci: 'status', judul: 'Status', sel: (s) => <BadgeStatusAktif status={s.statusAktif} /> },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (s) => (
        <MenuAksiMaster
          nama={s.kode}
          status={s.statusAktif}
          onUbah={() => setDialog({ satuan: s })}
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: s.id, statusAktif }),
              `Satuan ${s.kode} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
            )
          }
        />
      ),
    },
  ];

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between border-b p-3">
        <p className="text-sm text-slate-500">
          Satuan ukur dan satuan hitung. Konversi hanya berlaku antar-satuan berdimensi sama.
        </p>
        <Button size="sm" onClick={() => setDialog({ satuan: null })}>
          <Plus /> Tambah satuan
        </Button>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data}
        kunciBaris={(s) => s.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada data satuan."
      />
      {dialog && (
        <DialogSatuan satuan={dialog.satuan} semua={data} onTutup={() => setDialog(null)} />
      )}
    </Card>
  );
}
