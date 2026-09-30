import { zodResolver } from '@hookform/resolvers/zod';
import { skemaResetPassword, type InputResetPassword, type PenggunaDaftar } from '@sit/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useResetPasswordPengguna } from '@/api/pengguna';
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
import { tampilkanGalatForm } from '@/lib/form';
import { InputPassword } from './dialog-form-pengguna';

/** Owner mengisi password baru; pengguna wajib menggantinya saat login berikutnya (docs/04 §7). */
export function DialogResetPassword({
  pengguna,
  onTutup,
}: {
  pengguna: PenggunaDaftar;
  onTutup: () => void;
}) {
  const reset = useResetPasswordPengguna();
  const form = useForm<InputResetPassword>({
    resolver: zodResolver(skemaResetPassword),
    defaultValues: { passwordBaru: '' },
  });

  async function kirim(nilai: InputResetPassword) {
    try {
      await reset.mutateAsync({ id: pengguna.id, json: nilai });
      toast.success(
        `Password ${pengguna.namaPengguna} direset. Semua sesinya diakhiri; ia wajib mengganti password saat login.`,
      );
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['passwordBaru']);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {pengguna.namaPengguna} ({pengguna.username}) akan keluar dari semua perangkat dan wajib
            mengganti password saat login berikutnya.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="passwordBaru"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password baru</FormLabel>
                  <FormControl>
                    <InputPassword autoComplete="new-password" autoFocus {...field} />
                  </FormControl>
                  <FormDescription>
                    Minimal 8 karakter. Sampaikan langsung ke pengguna.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onTutup}>
                Batal
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Menyimpan…' : 'Reset password'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
