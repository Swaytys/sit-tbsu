import { zodResolver } from '@hookform/resolvers/zod';
import {
  JENIS_DIMENSI,
  skemaJenisAtribut,
  type DataJenisAtribut,
  type InputJenisAtribut,
  type JenisAtribut,
  type JenisDimensi,
  type StatusAktif,
} from '@sit/shared';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useDaftarJenisAtribut,
  useSimpanJenisAtribut,
  useStatusJenisAtribut,
} from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputAngka } from '@/components/input-angka';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
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
import { jalankanDenganToast } from '@/lib/aksi';
import { tampilkanGalatForm } from '@/lib/form';
import { LABEL_JENIS_DIMENSI } from '@/lib/label';

const TANPA = 'TANPA';

function DialogJenisAtribut({
  jenis,
  onTutup,
}: {
  jenis: JenisAtribut | null;
  onTutup: () => void;
}) {
  const simpan = useSimpanJenisAtribut();
  const terkunci = (jenis?.jumlahBarang ?? 0) > 0;
  const form = useForm<InputJenisAtribut, unknown, DataJenisAtribut>({
    resolver: zodResolver(skemaJenisAtribut),
    defaultValues: {
      kode: jenis?.kode ?? '',
      nama: jenis?.nama ?? '',
      tipeNilai: jenis?.tipeNilai ?? 'ANGKA',
      jenisDimensi: jenis ? jenis.jenisDimensi : 'PANJANG',
      urutan: jenis?.urutan ?? 0,
    },
  });
  const tipe = useWatch({ control: form.control, name: 'tipeNilai' });

  async function kirim(data: DataJenisAtribut) {
    try {
      await simpan.mutateAsync({ id: jenis?.id, json: data });
      toast.success(`Atribut ${data.nama} disimpan.`);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'kode',
        'nama',
        'tipeNilai',
        'jenisDimensi',
        'urutan',
      ]);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jenis ? 'Ubah jenis atribut' : 'Tambah jenis atribut'}</DialogTitle>
          {terkunci && (
            <DialogDescription className="flex items-center gap-1.5">
              <Lock className="size-3.5" /> Dipakai {jenis?.jumlahBarang} barang: tipe dan dimensi
              dikunci.
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
                    <Input
                      className="font-mono uppercase"
                      placeholder="PANJANG"
                      autoFocus
                      {...field}
                    />
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
                    <Input placeholder="Panjang" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tipeNilai"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe nilai</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      if (v === 'TEKS') form.setValue('jenisDimensi', null);
                    }}
                    disabled={terkunci}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ANGKA">Angka</SelectItem>
                      <SelectItem value="TEKS">Teks</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="jenisDimensi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dimensi satuan</FormLabel>
                  <Select
                    value={field.value ?? TANPA}
                    onValueChange={(v) => field.onChange(v === TANPA ? null : (v as JenisDimensi))}
                    disabled={terkunci || tipe === 'TEKS'}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={TANPA}>Tanpa satuan</SelectItem>
                      {JENIS_DIMENSI.map((d) => (
                        <SelectItem key={d} value={d}>
                          {LABEL_JENIS_DIMENSI[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="urutan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urutan tampil</FormLabel>
                  <FormControl>
                    <InputAngka {...field} min={0} />
                  </FormControl>
                  <FormDescription>Urutan di form barang.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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

export function TabJenisAtribut() {
  const daftar = useDaftarJenisAtribut();
  const ubahStatus = useStatusJenisAtribut();
  const [dialog, setDialog] = useState<{ jenis: JenisAtribut | null } | null>(null);

  const kolom: KolomTabel<JenisAtribut>[] = [
    {
      kunci: 'kode',
      judul: 'Kode',
      sel: (j) => <span className="font-mono text-xs">{j.kode}</span>,
    },
    { kunci: 'nama', judul: 'Nama', sel: (j) => <span className="font-medium">{j.nama}</span> },
    {
      kunci: 'tipe',
      judul: 'Tipe nilai',
      sel: (j) => (j.tipeNilai === 'ANGKA' ? 'Angka' : 'Teks'),
    },
    {
      kunci: 'dimensi',
      judul: 'Dimensi satuan',
      sel: (j) => (j.jenisDimensi ? LABEL_JENIS_DIMENSI[j.jenisDimensi] : '—'),
    },
    { kunci: 'barang', judul: 'Dipakai', className: 'text-right', sel: (j) => j.jumlahBarang },
    { kunci: 'status', judul: 'Status', sel: (j) => <BadgeStatusAktif status={j.statusAktif} /> },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (j) => (
        <MenuAksiMaster
          nama={j.nama}
          status={j.statusAktif}
          onUbah={() => setDialog({ jenis: j })}
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: j.id, statusAktif }),
              `Atribut ${j.nama} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
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
          Atribut deskriptif barang (panjang, warna, tebal, …). Atribut angka berdimensi memakai
          satuan berdimensi sama.
        </p>
        <Button size="sm" onClick={() => setDialog({ jenis: null })}>
          <Plus /> Tambah atribut
        </Button>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data}
        kunciBaris={(j) => j.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada jenis atribut."
      />
      {dialog && <DialogJenisAtribut jenis={dialog.jenis} onTutup={() => setDialog(null)} />}
    </Card>
  );
}
