import { zodResolver } from '@hookform/resolvers/zod';
import { skemaKeamanan, type Pengaturan } from '@sit/shared';
import { ShieldCheck } from 'lucide-react';
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
import { InputAngka } from '@/components/input-angka';
import { KartuBagian } from './bagian';
import { useSimpanPengaturan } from './use-simpan-pengaturan';

type Masukan = z.input<typeof skemaKeamanan>;
type Keluaran = z.output<typeof skemaKeamanan>;

const KOLOM: { nama: keyof Masukan; label: string; ket: string }[] = [
  {
    nama: 'loginMaksGagal',
    label: 'Batas gagal login berturut',
    ket: 'Setelah sebanyak ini, akun dikunci sementara (3–20).',
  },
  { nama: 'loginKunciMenit', label: 'Lama kunci akun (menit)', ket: 'Lama akun terkunci.' },
  {
    nama: 'passwordMin',
    label: 'Panjang minimal password',
    ket: 'Minimal 8. Berlaku saat password dibuat atau diganti.',
  },
];

/** Aturan login dan password (docs/04 §7). */
export function FormKeamanan({ pengaturan }: { pengaturan: Pengaturan }) {
  const simpan = useSimpanPengaturan();
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(skemaKeamanan),
    defaultValues: pengaturan.keamanan,
  });

  async function kirim(data: Keluaran) {
    const hasil = await simpan({ keamanan: data });
    if (hasil) form.reset(hasil.keamanan);
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} noValidate>
        <KartuBagian
          ikon={ShieldCheck}
          judul="Keamanan login"
          keterangan="Idle timeout dan batas sesi diatur di server (.env), bukan di sini."
          bisaSimpan={form.formState.isDirty}
          menyimpan={form.formState.isSubmitting}
        >
          <div className="grid grid-cols-3 gap-4">
            {KOLOM.map((k) => (
              <FormField
                key={k.nama}
                control={form.control}
                name={k.nama}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{k.label}</FormLabel>
                    <FormControl>
                      <InputAngka {...field} min={1} />
                    </FormControl>
                    <FormDescription>{k.ket}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </KartuBagian>
      </form>
    </Form>
  );
}
