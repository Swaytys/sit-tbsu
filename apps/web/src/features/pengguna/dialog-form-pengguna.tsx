import { zodResolver } from '@hookform/resolvers/zod';
import {
  KET_PERAN,
  LABEL_PERAN,
  PERAN_DIATUR_ADMIN_SISTEM,
  skemaTambahPengguna,
  skemaUbahPengguna,
  type DataTambahPengguna,
  type DataUbahPengguna,
  type InputTambahPengguna,
  type InputUbahPengguna,
  type PenggunaDaftar,
  type Peran,
} from '@sit/shared';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { useTambahPengguna, useUbahPengguna } from '@/api/pengguna';
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
import { InputNoHp } from '@/components/input-no-hp';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tampilkanGalatForm } from '@/lib/form';

// Urutan pilihan peran dari yang paling tinggi (K-225).
const URUTAN_PERAN: Peran[] = [
  'OWNER',
  'ADMIN',
  'ADMIN_SISTEM',
  'ADMIN_PERSEDIAAN',
  'KASIR',
  'STAF_PENJUALAN',
  'PETUGAS_GUDANG',
];

/** K-225: selain Owner, pengelola akun hanya bisa memberi peran yang boleh diatur Administrator Sistem. */
function PilihPeran({ value, onChange }: { value: Peran; onChange: (p: Peran) => void }) {
  const saya = usePengguna();
  const pilihan =
    saya.peran === 'OWNER'
      ? URUTAN_PERAN
      : URUTAN_PERAN.filter((p) => PERAN_DIATUR_ADMIN_SISTEM.includes(p) || p === value);
  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={(v) => onChange(v as Peran)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih peran" />
        </SelectTrigger>
        <SelectContent>
          {pilihan.map((p) => (
            <SelectItem key={p} value={p}>
              {LABEL_PERAN[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-slate-500">{KET_PERAN[value]}</p>
    </div>
  );
}

export function InputPassword(props: ComponentProps<typeof Input>) {
  const [tampil, setTampil] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={tampil ? 'text' : 'password'} className="pr-9" />
      <button
        type="button"
        onClick={() => setTampil((t) => !t)}
        aria-label={tampil ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {tampil ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const KOLOM_TAMBAH = ['namaPengguna', 'username', 'peran', 'noHp', 'password'] as const;

export function DialogTambahPengguna({
  terbuka,
  onTutup,
}: {
  terbuka: boolean;
  onTutup: () => void;
}) {
  const tambah = useTambahPengguna();
  const form = useForm<InputTambahPengguna, unknown, DataTambahPengguna>({
    resolver: zodResolver(skemaTambahPengguna),
    defaultValues: { namaPengguna: '', username: '', peran: 'KASIR', noHp: '', password: '' },
  });

  async function kirim(nilai: DataTambahPengguna) {
    try {
      const baru = await tambah.mutateAsync(nilai);
      toast.success(
        `${baru.namaPengguna} ditambahkan (${baru.kode}). Ia wajib mengganti password saat login pertama.`,
      );
      form.reset();
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, KOLOM_TAMBAH);
    }
  }

  return (
    <Dialog open={terbuka} onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah pengguna</DialogTitle>
          <DialogDescription>
            Beri tahu pengguna password awalnya; ia wajib menggantinya saat login pertama.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="namaPengguna"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nama pengguna</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama lengkap" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input className="font-mono" placeholder="nama.panggilan" {...field} />
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
                    <InputNoHp value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="peran"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peran</FormLabel>
                  <PilihPeran value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password awal</FormLabel>
                  <FormControl>
                    <InputPassword autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>Minimal 8 karakter.</FormDescription>
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

const KOLOM_UBAH = ['namaPengguna', 'username', 'peran', 'noHp'] as const;

export function DialogUbahPengguna({
  pengguna,
  onTutup,
}: {
  pengguna: PenggunaDaftar;
  onTutup: () => void;
}) {
  const ubah = useUbahPengguna();
  const form = useForm<InputUbahPengguna, unknown, DataUbahPengguna>({
    resolver: zodResolver(skemaUbahPengguna),
    defaultValues: {
      namaPengguna: pengguna.namaPengguna,
      username: pengguna.username,
      peran: pengguna.peran,
      noHp: pengguna.noHp ?? '',
    },
  });

  async function kirim(nilai: DataUbahPengguna) {
    try {
      await ubah.mutateAsync({ id: pengguna.id, json: nilai });
      toast.success(`Data ${nilai.namaPengguna} disimpan.`);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, KOLOM_UBAH);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah pengguna</DialogTitle>
          <DialogDescription>
            {pengguna.kode} · Password diganti lewat menu “Reset password”.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="namaPengguna"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nama pengguna</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input className="font-mono" {...field} />
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
                    <InputNoHp value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="peran"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Peran</FormLabel>
                  <PilihPeran value={field.value} onChange={field.onChange} />
                  <FormDescription>
                    Perubahan peran langsung berlaku pada sesi yang sedang aktif.
                  </FormDescription>
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
