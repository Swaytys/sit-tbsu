import { zodResolver } from '@hookform/resolvers/zod';
import { skemaMerk, type DataMerk, type InputMerk, type Merk, type StatusAktif } from '@sit/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useDaftarMerk, useSimpanMerk, useStatusMerk } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
import { jalankanDenganToast } from '@/lib/aksi';
import { tampilkanGalatForm } from '@/lib/form';

function DialogMerk({ merk, onTutup }: { merk: Merk | null; onTutup: () => void }) {
  const simpan = useSimpanMerk();
  const form = useForm<InputMerk, unknown, DataMerk>({
    resolver: zodResolver(skemaMerk),
    defaultValues: {
      nama: merk?.nama ?? '',
      keterangan: merk?.keterangan ?? '',
    },
  });

  async function kirim(data: DataMerk) {
    try {
      await simpan.mutateAsync({ id: merk?.id, json: data });
      toast.success(`Merk ${data.nama} disimpan.`);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['nama', 'keterangan']);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{merk ? 'Ubah merk' : 'Tambah merk'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama merk</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="keterangan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
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

export function TabMerk() {
  const daftar = useDaftarMerk();
  const ubahStatus = useStatusMerk();
  const [dialog, setDialog] = useState<{ merk: Merk | null } | null>(null);

  const kolom: KolomTabel<Merk>[] = [
    {
      kunci: 'nama',
      judul: 'Nama merk',
      sel: (k) => <span className="font-medium">{k.nama}</span>,
    },
    { kunci: 'ket', judul: 'Keterangan', sel: (k) => k.keterangan ?? '—' },
    {
      kunci: 'barang',
      judul: 'Jumlah barang',
      className: 'w-32 text-right',
      sel: (k) => k.jumlahBarang,
    },
    {
      kunci: 'status',
      judul: 'Status',
      className: 'w-28',
      sel: (k) => <BadgeStatusAktif status={k.statusAktif} />,
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (k) => (
        <MenuAksiMaster
          nama={k.nama}
          status={k.statusAktif}
          onUbah={() => setDialog({ merk: k })}
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: k.id, statusAktif }),
              `Merk ${k.nama} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
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
          Merk barang dipilih dari daftar ini agar tidak diketik ulang.
        </p>
        <Button size="sm" onClick={() => setDialog({ merk: null })}>
          <Plus /> Tambah merk
        </Button>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data}
        kunciBaris={(k) => k.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada merk."
      />
      {dialog && <DialogMerk merk={dialog.merk} onTutup={() => setDialog(null)} />}
    </Card>
  );
}
