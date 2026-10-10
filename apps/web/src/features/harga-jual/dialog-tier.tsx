import { zodResolver } from '@hookform/resolvers/zod';
import {
  skemaTingkatHargaInput,
  type DataTingkatHarga,
  type InputTingkatHarga,
  type StatusAktif,
  type TingkatHarga,
} from '@sit/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSimpanTier, useStatusTier } from '@/api/barang';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { InputAngka } from '@/components/input-angka';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { jalankanDenganToast } from '@/lib/aksi';
import { formatDesimal } from '@/lib/format';
import { tampilkanGalatForm } from '@/lib/form';

function FormTier({ tier, onSelesai }: { tier: TingkatHarga | null; onSelesai: () => void }) {
  const simpan = useSimpanTier();
  const form = useForm<InputTingkatHarga, unknown, DataTingkatHarga>({
    resolver: zodResolver(skemaTingkatHargaInput),
    defaultValues: {
      kode: tier?.kode ?? '',
      nama: tier?.nama ?? '',
      markupDefaultPersen: tier?.markupDefaultPersen ? formatDesimal(tier.markupDefaultPersen) : '',
      urutan: tier?.urutan ?? 0,
      minQty: tier?.minQty ? formatDesimal(tier.minQty).replaceAll('.', '') : '',
    },
  });

  async function kirim(data: DataTingkatHarga) {
    try {
      await simpan.mutateAsync({ id: tier?.id, json: data });
      toast.success(`Tier ${data.nama} disimpan.`);
      onSelesai();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'kode',
        'nama',
        'markupDefaultPersen',
        'minQty',
        'urutan',
      ]);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(kirim)(e)}
        className="grid grid-cols-5 gap-3 rounded-lg border bg-slate-50 p-3"
        noValidate
      >
        <FormField
          control={form.control}
          name="kode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kode</FormLabel>
              <FormControl>
                <Input className="font-mono uppercase" placeholder="MEMBER" {...field} />
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
              <FormLabel>Nama tier</FormLabel>
              <FormControl>
                <Input placeholder="Member" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="markupDefaultPersen"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Markup (%)</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="20"
                  {...field}
                  value={typeof field.value === 'string' ? field.value : ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!tier?.isDefault && (
          <FormField
            control={form.control}
            name="minQty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mulai qty</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="mis. 10"
                    {...field}
                    value={typeof field.value === 'string' ? field.value : ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="urutan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Urutan</FormLabel>
              <FormControl>
                <InputAngka {...field} min={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormDescription className="col-span-5">
          {tier?.isDefault
            ? 'Tier default dipakai semua pembeli yang belum memenuhi syarat qty tier lain.'
            : 'Mulai qty: harga tier ini dipakai otomatis bila pembeli membeli sebanyak itu (satuan dasar). Kosong = hanya bila dipilih manual. Bisa diubah per barang di form barang.'}
        </FormDescription>
        <div className="col-span-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSelesai}>
            Batal
          </Button>
          <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan tier'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Master tingkat harga (docs/06 H1–H2): tambah, ubah markup, nonaktifkan. */
export function DialogTier({ onTutup }: { onTutup: () => void }) {
  const tier = useDaftarTingkatHarga();
  const ubahStatus = useStatusTier();
  const [edit, setEdit] = useState<{ tier: TingkatHarga | null } | null>(null);

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kelola tier harga</DialogTitle>
          <DialogDescription>
            Harga jual ditentukan jumlah beli: Normal untuk semua pembeli; tier lain dipakai
            otomatis bila qty mencapai "mulai qty". Harga khusus pelanggan tertentu diatur di Promo.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="text-right">Markup</TableHead>
              <TableHead className="text-right">Mulai qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tier.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.kode}</TableCell>
                <TableCell>
                  {t.nama}{' '}
                  {t.isDefault && (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      Default
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.markupDefaultPersen ? `${formatDesimal(t.markupDefaultPersen)}%` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.isDefault ? 'semua' : t.minQty ? formatDesimal(t.minQty) : 'manual'}
                </TableCell>
                <TableCell>
                  <BadgeStatusAktif status={t.statusAktif} />
                </TableCell>
                <TableCell className="text-right">
                  <MenuAksiMaster
                    nama={t.nama}
                    status={t.statusAktif}
                    onUbah={() => setEdit({ tier: t })}
                    onUbahStatus={(statusAktif: StatusAktif) =>
                      void jalankanDenganToast(
                        ubahStatus.mutateAsync({ id: t.id, statusAktif }),
                        `Tier ${t.nama} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {edit ? (
          <FormTier
            key={edit.tier?.id ?? 'baru'}
            tier={edit.tier}
            onSelesai={() => setEdit(null)}
          />
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit({ tier: null })}>
              <Plus /> Tambah tier
            </Button>
            <Button onClick={onTutup}>Tutup</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
