import { zodResolver } from '@hookform/resolvers/zod';
import { LABEL_PERAN, PERAN, skemaHargaDiskon, type Pengaturan } from '@sit/shared';
import { Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InputAngka, KartuBagian } from './bagian';
import { useSimpanPengaturan } from './use-simpan-pengaturan';

type Masukan = z.input<typeof skemaHargaDiskon>;
type Keluaran = z.output<typeof skemaHargaDiskon>;

/** Dasar markup, pembulatan harga (K-009, K-010), dan batas diskon per peran (K-012). */
export function FormHarga({ pengaturan }: { pengaturan: Pengaturan }) {
  const simpan = useSimpanPengaturan();
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(skemaHargaDiskon),
    defaultValues: pengaturan.harga,
  });

  async function kirim(data: Keluaran) {
    const hasil = await simpan({ harga: data });
    if (hasil) form.reset(hasil.harga);
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} noValidate>
        <KartuBagian
          ikon={Tag}
          judul="Harga dan diskon"
          keterangan="Dipakai perhitungan harga jual per tier dan batas diskon saat order/checkout."
          bisaSimpan={form.formState.isDirty}
          menyimpan={form.formState.isSubmitting}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dasarMarkup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dasar markup</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="HARGA_BELI_TERAKHIR">Harga beli terakhir</SelectItem>
                      <SelectItem value="HPP_RATA2">HPP rata-rata</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Angka yang dikali markup tier untuk harga jual.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pembulatanHarga"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Pembulatan harga <span className="font-normal text-slate-400">(Rp)</span>
                  </FormLabel>
                  <FormControl>
                    <InputAngka {...field} min={1} />
                  </FormControl>
                  <FormDescription>
                    Harga hasil markup dibulatkan ke atas ke kelipatan ini.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Batas diskon per peran (%)</p>
            <div className="grid grid-cols-4 gap-4">
              {PERAN.map((peran) => (
                <FormField
                  key={peran}
                  control={form.control}
                  name={`batasDiskonPersen.${peran}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-normal">{LABEL_PERAN[peran]}</FormLabel>
                      <FormControl>
                        <InputAngka {...field} min={0} max={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
        </KartuBagian>
      </form>
    </Form>
  );
}
