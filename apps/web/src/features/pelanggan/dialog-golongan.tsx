import { zodResolver } from '@hookform/resolvers/zod';
import {
  skemaGolonganPelanggan,
  type DataGolonganPelanggan,
  type GolonganPelanggan,
  type InputGolonganPelanggan,
} from '@sit/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useDaftarGolongan, useSimpanGolongan, useStatusGolongan } from '@/api/mitra';
import { pesanGalat } from '@/api/client';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tampilkanGalatForm } from '@/lib/form';

/**
 * Golongan pelanggan (K-097), mis. Distributor, Kontraktor, Tukang. Dipakai untuk menyasar promo ke
 * sekelompok pelanggan; harga jual tidak bergantung golongan.
 */
export function DialogGolongan({ onTutup }: { onTutup: () => void }) {
  const daftar = useDaftarGolongan();
  const simpan = useSimpanGolongan();
  const status = useStatusGolongan();
  const [ubah, setUbah] = useState<GolonganPelanggan | null>(null);

  const form = useForm<InputGolonganPelanggan, unknown, DataGolonganPelanggan>({
    resolver: zodResolver(skemaGolonganPelanggan),
    defaultValues: { nama: '', keterangan: '' },
  });

  function mulaiUbah(g: GolonganPelanggan | null) {
    setUbah(g);
    form.reset({ nama: g?.nama ?? '', keterangan: g?.keterangan ?? '' });
  }

  async function kirim(data: DataGolonganPelanggan) {
    try {
      const hasil = await simpan.mutateAsync({ id: ubah?.id, json: data });
      toast.success(`Golongan ${hasil.nama} disimpan.`);
      mulaiUbah(null);
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['nama', 'keterangan']);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Golongan pelanggan</DialogTitle>
          <DialogDescription>
            Kelompok pelanggan untuk sasaran promo (mis. Kontraktor, Tukang). Harga jual tidak
            bergantung golongan; harga grosir mengikuti jumlah beli.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead className="text-right">Pelanggan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(daftar.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-4 text-center text-sm text-slate-500">
                  Belum ada golongan.
                </TableCell>
              </TableRow>
            )}
            {(daftar.data ?? []).map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <div className="font-medium">{g.nama}</div>
                  {g.keterangan && <div className="text-xs text-slate-500">{g.keterangan}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{g.jumlahPelanggan}</TableCell>
                <TableCell>
                  <BadgeStatusAktif status={g.statusAktif} />
                </TableCell>
                <TableCell className="text-right">
                  <MenuAksiMaster
                    nama={g.nama}
                    status={g.statusAktif}
                    onUbah={() => mulaiUbah(g)}
                    onUbahStatus={(statusAktif) =>
                      void status
                        .mutateAsync({ id: g.id, statusAktif })
                        .then(() => toast.success(`Golongan ${g.nama} diperbarui.`))
                        .catch((err: unknown) => toast.error(pesanGalat(err)))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-lg border bg-slate-50 p-3"
            noValidate
          >
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ubah ? `Ubah ${ubah.nama}` : 'Golongan baru'}</FormLabel>
                  <FormControl>
                    <Input placeholder="mis. Kontraktor" {...field} />
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
                    <Input placeholder="Opsional" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              {ubah && (
                <Button type="button" variant="outline" onClick={() => mulaiUbah(null)}>
                  Batal
                </Button>
              )}
              <Button type="submit" disabled={simpan.isPending}>
                {simpan.isPending ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
