import { TZDate } from '@date-fns/tz';
import { zodResolver } from '@hookform/resolvers/zod';
import { KODE_DOKUMEN, LABEL_KODE_DOKUMEN, skemaPenomoran, type Pengaturan } from '@sit/shared';
import { format } from 'date-fns';
import { Hash } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { InputAngka, KartuBagian } from './bagian';
import { useSimpanPengaturan } from './use-simpan-pengaturan';

type Masukan = z.input<typeof skemaPenomoran>;
type Keluaran = z.output<typeof skemaPenomoran>;

/** Prefix nomor dokumen (K-022). Mengubah prefix tidak mengubah nomor yang sudah terbit (N2). */
export function FormPenomoran({ pengaturan }: { pengaturan: Pengaturan }) {
  const simpan = useSimpanPengaturan();
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(skemaPenomoran),
    defaultValues: pengaturan.penomoran,
  });
  const digitNomor: unknown = useWatch({ control: form.control, name: 'digitNomor' });
  const digit = typeof digitNomor === 'number' ? digitNomor : Number(digitNomor) || 3;
  const hariIni = format(new TZDate(new Date(), 'Asia/Jakarta'), 'yyMMdd');

  async function kirim(data: Keluaran) {
    const hasil = await simpan({ penomoran: data });
    if (hasil) form.reset(hasil.penomoran);
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} noValidate>
        <KartuBagian
          ikon={Hash}
          judul="Penomoran dokumen"
          keterangan="Format PREFIX-YYMMDD-NNN, urut ulang setiap hari. Perubahan tidak mengubah nomor yang sudah terbit."
          bisaSimpan={form.formState.isDirty}
          menyimpan={form.formState.isSubmitting}
        >
          <div className="grid grid-cols-3 gap-4">
            {KODE_DOKUMEN.map((kode) => (
              <FormField
                key={kode}
                control={form.control}
                name={`prefix.${kode}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{LABEL_KODE_DOKUMEN[kode]}</FormLabel>
                    <FormControl>
                      <Input className="font-mono uppercase" maxLength={5} {...field} />
                    </FormControl>
                    <FormDescription className="font-mono text-xs">
                      {(field.value || kode).toUpperCase()}-{hariIni}-{'1'.padStart(digit, '0')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name="digitNomor"
            render={({ field }) => (
              <FormItem className="max-w-48">
                <FormLabel>Digit nomor urut</FormLabel>
                <FormControl>
                  <InputAngka {...field} min={3} max={6} />
                </FormControl>
                <FormDescription>
                  Melebar otomatis bila melewati batas dalam sehari.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </KartuBagian>
      </form>
    </Form>
  );
}
