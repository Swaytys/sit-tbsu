import { zodResolver } from '@hookform/resolvers/zod';
import {
  skemaTingkatHargaInput,
  teksSyaratTier,
  type DataTingkatHarga,
  type InputTingkatHarga,
  type StatusAktif,
  type TingkatHarga,
} from '@sit/shared';
import { Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSimpanTier, useStatusTier } from '@/api/barang';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { InputAngka } from '@/components/input-angka';
import { InputRupiah } from '@/components/input-rupiah';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { BadgeStatusAktif } from '@/components/status-badge';
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
import { BadgeTierDasar } from './badge-tier-dasar';

const besarAwal = (teks: string) => teks.charAt(0).toUpperCase() + teks.slice(1);

function FormTier({ tier, onSelesai }: { tier: TingkatHarga | null; onSelesai: () => void }) {
  const simpan = useSimpanTier();
  const form = useForm<InputTingkatHarga, unknown, DataTingkatHarga>({
    resolver: zodResolver(skemaTingkatHargaInput),
    defaultValues: {
      kode: tier?.kode ?? '',
      nama: tier?.nama ?? '',
      markupDefaultPersen: tier?.markupDefaultPersen ? formatDesimal(tier.markupDefaultPersen) : '',
      minBelanja: tier?.minBelanja ?? null,
      urutan: tier?.urutan ?? 0,
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
        'minBelanja',
        'urutan',
      ]);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(kirim)(e)}
        className="grid grid-cols-6 gap-3 rounded-lg border bg-slate-50 p-3"
        noValidate
      >
        <p className="col-span-6 text-sm font-medium text-slate-800">
          {tier ? `Ubah tier ${tier.nama}` : 'Tier baru'}
        </p>
        <FormField
          control={form.control}
          name="kode"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Kode</FormLabel>
              <FormControl>
                <Input className="font-mono uppercase" placeholder="MEMBER" {...field} />
              </FormControl>
              <FormDescription className="text-xs">
                Nama singkat tanpa spasi, mis. GROSIR.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nama"
          render={({ field }) => (
            <FormItem className="col-span-3">
              <FormLabel>Nama tier</FormLabel>
              <FormControl>
                <Input placeholder="Member" {...field} />
              </FormControl>
              <FormDescription className="text-xs">
                Nama yang tampil di kasir dan struk.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="urutan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Urutan</FormLabel>
              <FormControl>
                <InputAngka {...field} min={0} />
              </FormControl>
              <FormDescription className="text-xs">Urutan tampil.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="markupDefaultPersen"
          render={({ field }) => (
            <FormItem className="col-span-3">
              <FormLabel>Markup (%)</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="20"
                  {...field}
                  value={typeof field.value === 'string' ? field.value : ''}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Persen keuntungan di atas harga modal, untuk semua barang.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {tier?.isDefault ? (
          <div className="col-span-3 space-y-2">
            <p className="text-sm font-medium">Berlaku untuk</p>
            <p className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-slate-600">
              Semua transaksi
            </p>
            <p className="text-xs text-slate-500">
              Harga dasar dipakai sebelum syarat belanja tier lain tercapai, jadi tidak punya syarat
              belanja.
            </p>
          </div>
        ) : (
          <FormField
            control={form.control}
            name="minBelanja"
            render={({ field }) => (
              <FormItem className="col-span-3">
                <FormLabel>Mulai belanja</FormLabel>
                <FormControl>
                  <InputRupiah {...field} placeholder="mis. 1.000.000" />
                </FormControl>
                <FormDescription className="text-xs">
                  Wajib diisi: total belanja satu transaksi agar tier ini dipakai otomatis untuk
                  semua barang.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="col-span-6 flex justify-end gap-2">
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

/** Master tingkat harga (docs/06 H1–H2, H8): tambah, ubah markup dan syarat belanja, nonaktifkan. */
export function DialogTier({ onTutup }: { onTutup: () => void }) {
  const tier = useDaftarTingkatHarga();
  const ubahStatus = useStatusTier();
  const [edit, setEdit] = useState<{ tier: TingkatHarga | null } | null>(null);
  const dasar = (tier.data ?? []).find((t) => t.isDefault);

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Kelola tier harga
            <Penjelasan judul="Cara kerja tier harga">
              <ButirPenjelasan>
                <li>
                  <b>Harga dasar</b>
                  {dasar ? ` (${dasar.nama})` : ''} dipakai semua transaksi. Tier ini selalu ada:
                  tidak bisa dinonaktifkan atau dipindah ke tier lain, tetapi nama dan markup-nya
                  boleh diubah.
                </li>
                <li>
                  Tier lain dipakai <b>otomatis untuk semua barang</b> begitu total belanja satu
                  transaksi mencapai <b>Mulai belanja</b>-nya. Total belanja dihitung dengan harga
                  dasar, sebelum promo dan diskon. Bila beberapa tier tercapai, dipakai yang syarat
                  belanjanya paling besar.
                </li>
                <li>
                  <b>Markup</b> = persen keuntungan di atas harga modal. Harga tier = harga modal +
                  markup, dibulatkan ke atas, dan berlaku untuk semua barang tanpa kecuali.
                </li>
                <li>
                  Setiap tier selain harga dasar wajib punya <b>Mulai belanja</b>. Tier tidak bisa
                  dipilih sendiri di kasir; pengecualian harga hanya lewat Promo, atau Harga manual
                  (khusus Admin/Owner, tercatat di log).
                </li>
                <li>
                  Setelah markup diubah, harga yang naik langsung berlaku (barang berharga
                  otomatis), sedangkan harga yang turun menunggu persetujuan di tab Tinjau Harga.
                </li>
                <li>
                  Potongan promo dihitung dari harga tier. Harga khusus untuk barang, pelanggan,
                  atau masa tertentu diatur di menu Promo.
                </li>
              </ButirPenjelasan>
            </Penjelasan>
          </DialogTitle>
          <DialogDescription>
            Tier harga menentukan harga jual semua barang menurut total belanja satu transaksi.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="text-right">Markup</TableHead>
              <TableHead>Berlaku untuk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tier.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.kode}</TableCell>
                <TableCell className="whitespace-normal">
                  <span className="mr-1.5">{t.nama}</span>
                  {t.isDefault && <BadgeTierDasar />}
                  {t.peringatan && (
                    <p className="mt-1 flex max-w-xs items-start gap-1 text-xs text-amber-700">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                      {t.peringatan}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.markupDefaultPersen ? `${formatDesimal(t.markupDefaultPersen)}%` : '—'}
                </TableCell>
                <TableCell>{besarAwal(teksSyaratTier(t))}</TableCell>
                <TableCell>
                  <BadgeStatusAktif status={t.statusAktif} />
                </TableCell>
                <TableCell className="text-right">
                  <MenuAksiMaster
                    nama={t.nama}
                    status={t.statusAktif}
                    bisaNonaktif={!t.isDefault}
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
