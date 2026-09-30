import { zodResolver } from '@hookform/resolvers/zod';
import { skemaGantiPassword, type InputGantiPassword } from '@sit/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useGantiPassword } from '@/api/auth';
import { Button } from '@/components/ui/button';
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
import { tampilkanGalatForm } from '@/lib/form';

const KOLOM = ['passwordLama', 'passwordBaru', 'konfirmasi'] as const;

/** Form ganti password sendiri (dipakai halaman wajib ganti dan halaman akun). */
export function FormGantiPassword({ onBerhasil }: { onBerhasil: () => void }) {
  const ganti = useGantiPassword();
  const form = useForm<InputGantiPassword>({
    resolver: zodResolver(skemaGantiPassword),
    defaultValues: { passwordLama: '', passwordBaru: '', konfirmasi: '' },
  });

  async function kirim(nilai: InputGantiPassword) {
    try {
      await ganti.mutateAsync(nilai);
      toast.success('Password berhasil diganti.');
      form.reset();
      onBerhasil();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, KOLOM);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="passwordLama"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password lama</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="passwordBaru"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password baru</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>Minimal 8 karakter, berbeda dari password lama.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="konfirmasi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ulangi password baru</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan password baru'}
        </Button>
      </form>
    </Form>
  );
}
