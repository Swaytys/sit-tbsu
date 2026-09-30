import { zodResolver } from '@hookform/resolvers/zod';
import {
  skemaKategori,
  type DataKategori,
  type InputKategori,
  type Kategori,
  type StatusAktif,
} from '@sit/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useDaftarKategori, useSimpanKategori, useStatusKategori } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputAngka } from '@/components/input-angka';
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

function DialogKategori({ kategori, onTutup }: { kategori: Kategori | null; onTutup: () => void }) {
  const simpan = useSimpanKategori();
  const form = useForm<InputKategori, unknown, DataKategori>({
    resolver: zodResolver(skemaKategori),
    defaultValues: {
      nama: kategori?.nama ?? '',
      keterangan: kategori?.keterangan ?? '',
      urutan: kategori?.urutan ?? 0,
    },
  });

  async function kirim(data: DataKategori) {
    try {
      await simpan.mutateAsync({ id: kategori?.id, json: data });
      toast.success(`Kategori ${data.nama} disimpan.`);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['nama', 'keterangan', 'urutan']);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kategori ? 'Ubah kategori' : 'Tambah kategori'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama kategori</FormLabel>
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
            <FormField
              control={form.control}
              name="urutan"
              render={({ field }) => (
                <FormItem className="max-w-32">
                  <FormLabel>Urutan tampil</FormLabel>
                  <FormControl>
                    <InputAngka {...field} min={0} />
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

export function TabKategori() {
  const daftar = useDaftarKategori();
  const ubahStatus = useStatusKategori();
  const [dialog, setDialog] = useState<{ kategori: Kategori | null } | null>(null);

  const kolom: KolomTabel<Kategori>[] = [
    {
      kunci: 'nama',
      judul: 'Nama kategori',
      sel: (k) => <span className="font-medium">{k.nama}</span>,
    },
    { kunci: 'ket', judul: 'Keterangan', sel: (k) => k.keterangan ?? '—' },
    { kunci: 'urutan', judul: 'Urutan', className: 'w-20 text-right', sel: (k) => k.urutan },
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
          onUbah={() => setDialog({ kategori: k })}
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: k.id, statusAktif }),
              `Kategori ${k.nama} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
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
          Pengelompokan barang untuk pencarian, filter, dan laporan.
        </p>
        <Button size="sm" onClick={() => setDialog({ kategori: null })}>
          <Plus /> Tambah kategori
        </Button>
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data}
        kunciBaris={(k) => k.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada kategori."
      />
      {dialog && <DialogKategori kategori={dialog.kategori} onTutup={() => setDialog(null)} />}
    </Card>
  );
}
