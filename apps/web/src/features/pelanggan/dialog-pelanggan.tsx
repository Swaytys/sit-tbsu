import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  skemaPelanggan,
  type DataPelanggan,
  type InputPelanggan,
  type Pelanggan,
} from '@sit/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { useDaftarTingkatHarga, useSimpanPelanggan } from '@/api/mitra';
import { InputAngka } from '@/components/input-angka';
import { InputRupiah } from '@/components/input-rupiah';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { tampilkanGalatForm } from '@/lib/form';

const TIER_DEFAULT = 'DEFAULT';

/** Ringkasan tier/term/limit untuk pengguna tanpa izin mengaturnya. */
function ringkasKredit(p: Pelanggan | null): string {
  if (!p) return 'Pelanggan baru memakai tier default, term bawaan toko, dan tanpa limit kredit.';
  const tier = p.namaTingkatHarga ?? 'default toko';
  const limit = p.limitKredit === null ? 'tanpa limit' : `limit ${formatRupiah(p.limitKredit)}`;
  return `Tier ${tier} · term ${p.termHari} hari · ${limit}.`;
}

export function DialogPelanggan({
  pelanggan,
  onTutup,
}: {
  pelanggan: Pelanggan | null;
  onTutup: () => void;
}) {
  const saya = usePengguna();
  const bolehKredit = saya.izin.includes('master.pelanggan.atur_kredit');
  const tier = useDaftarTingkatHarga();
  const simpan = useSimpanPelanggan();

  const form = useForm<InputPelanggan, unknown, DataPelanggan>({
    resolver: zodResolver(skemaPelanggan),
    defaultValues: {
      namaPelanggan: pelanggan?.namaPelanggan ?? '',
      noHp: pelanggan?.noHp ?? '',
      email: pelanggan?.email ?? '',
      alamat: pelanggan?.alamat ?? '',
      keterangan: pelanggan?.keterangan ?? '',
      idTingkatHarga: pelanggan?.idTingkatHarga ?? null,
      // Kosong = term bawaan toko (konfigurasi), diisi API.
      termHari: pelanggan?.termHari ?? '',
      limitKredit: pelanggan?.limitKredit ?? null,
    },
  });

  // Tier nonaktif tetap tampil bila sedang dipakai pelanggan ini.
  const pilihanTier = (tier.data ?? []).filter(
    (t) => t.statusAktif === 'AKTIF' || t.id === pelanggan?.idTingkatHarga,
  );
  const tierDefault = tier.data?.find((t) => t.isDefault);

  async function kirim(data: DataPelanggan) {
    // Tanpa izin: kolom kredit tidak dikirim, sehingga API memakai bawaan / nilai lama (K-059).
    const json: DataPelanggan = bolehKredit
      ? data
      : { ...data, idTingkatHarga: undefined, termHari: undefined, limitKredit: undefined };
    try {
      const hasil = await simpan.mutateAsync({ id: pelanggan?.id, json });
      toast.success(
        pelanggan
          ? `Data ${hasil.namaPelanggan} disimpan.`
          : `Pelanggan ${hasil.namaPelanggan} ditambahkan (${hasil.kode}).`,
      );
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'namaPelanggan',
        'noHp',
        'email',
        'alamat',
        'keterangan',
        'idTingkatHarga',
        'termHari',
        'limitKredit',
      ]);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {pelanggan ? `Ubah pelanggan ${pelanggan.kode}` : 'Tambah pelanggan'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="namaPelanggan"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nama pelanggan</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama lengkap / nama usaha" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="noHp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>No. HP</FormLabel>
                  <FormControl>
                    <Input inputMode="tel" placeholder="08xx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="opsional"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alamat"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {bolehKredit ? (
              <fieldset className="col-span-2 grid grid-cols-[1fr_7rem_1fr] gap-4 rounded-lg border p-3">
                <legend className="px-1 text-xs font-medium text-slate-500">
                  Harga &amp; kredit
                </legend>
                <FormField
                  control={form.control}
                  name="idTingkatHarga"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tier harga</FormLabel>
                      <Select
                        value={field.value == null ? TIER_DEFAULT : String(field.value)}
                        onValueChange={(v) => field.onChange(v === TIER_DEFAULT ? null : Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={TIER_DEFAULT}>
                            Default ({tierDefault?.nama ?? 'toko'})
                          </SelectItem>
                          {pilihanTier.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.nama}
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
                  name="termHari"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Term (hari)</FormLabel>
                      <FormControl>
                        <InputAngka {...field} min={0} max={365} placeholder="Bawaan" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="limitKredit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limit kredit</FormLabel>
                      <FormControl>
                        <InputRupiah {...field} placeholder="Tanpa limit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormDescription className="col-span-3">
                  Term = jatuh tempo piutang sejak tanggal transaksi. Limit kredit disimpan dulu;
                  pemeriksaannya saat checkout menyusul di tahap berikutnya.
                </FormDescription>
              </fieldset>
            ) : (
              <p className="col-span-2 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
                {ringkasKredit(pelanggan)} Tier, term, dan limit kredit diatur Admin/Owner.
              </p>
            )}

            <FormField
              control={form.control}
              name="keterangan"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      className="resize-none"
                      placeholder="Catatan tambahan…"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
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
