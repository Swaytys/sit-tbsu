import { TZDate } from '@date-fns/tz';
import { zodResolver } from '@hookform/resolvers/zod';
import { skemaProfilToko, type Pengaturan } from '@sit/shared';
import { format } from 'date-fns';
import { Store } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTampilanToko } from '@/api/pengaturan';
import { KartuBagian } from './bagian';
import { useSimpanPengaturan } from './use-simpan-pengaturan';

type Masukan = z.input<typeof skemaProfilToko>;
type Keluaran = z.output<typeof skemaProfilToko>;

/** Profil toko: kop struk, invoice, dan laporan (K-044). Pratinjau struk mengikuti isian. */
export function FormProfil({ pengaturan }: { pengaturan: Pengaturan }) {
  const simpan = useSimpanPengaturan();
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(skemaProfilToko),
    defaultValues: pengaturan.profil,
  });
  const nilai = useWatch({ control: form.control });
  const logo = useTampilanToko().data?.logo;
  const contohNomor = `${pengaturan.penomoran.prefix.STR}-${format(new TZDate(new Date(), 'Asia/Jakarta'), 'yyMMdd')}-001`;

  async function kirim(data: Keluaran) {
    const hasil = await simpan({ profil: data });
    if (hasil) form.reset(hasil.profil);
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} noValidate>
        <KartuBagian
          ikon={Store}
          judul="Profil toko"
          keterangan="Tampil di kop struk, invoice, surat jalan, dan laporan."
          bisaSimpan={form.formState.isDirty}
          menyimpan={form.formState.isSubmitting}
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="namaToko"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama toko (baris pertama kop)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="namaBadanUsaha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama badan usaha (baris kedua kop)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alamatToko"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telpToko"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telepon</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emailToko"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Boleh kosong" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="footerStruk"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Teks penutup struk</FormLabel>
                  <FormControl>
                    <Textarea rows={2} className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lebarStrukMm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lebar kertas struk</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="57">57 mm</SelectItem>
                      <SelectItem value="58">58 mm</SelectItem>
                      <SelectItem value="80">80 mm</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Sesuaikan dengan printer thermal kasir.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="strukCetak"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Cetak struk setelah bayar (penjualan langsung)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full" aria-label="Cetak struk setelah bayar">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="OTOMATIS">Langsung cetak</SelectItem>
                      <SelectItem value="TANYA">Tanya dulu (Enter = cetak, Esc = tidak)</SelectItem>
                      <SelectItem value="TIDAK">
                        Tidak dicetak (bisa cetak dari layar hasil)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Agar struk keluar tanpa jendela pratinjau, buka kasir lewat pintasan buka-kasir
                    (Chrome mode cetak senyap) dan jadikan printer thermal sebagai printer bawaan
                    Windows. Invoice pengantaran tetap memakai pratinjau A4.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(
              [
                [
                  'strukTampilkanNama',
                  'Kop struk memakai nama toko',
                  'Nama dan badan usaha di atas struk.',
                ],
                ['strukTampilkanLogo', 'Kop struk memakai logo toko', 'Logo dari kartu Logo toko.'],
              ] as const
            ).map(([nama, label, ket]) => (
              <FormField
                key={nama}
                control={form.control}
                name={nama}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div>
                      <FormLabel>{label}</FormLabel>
                      <FormDescription>{ket}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>

          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Pratinjau struk
            </p>
            <div className="mx-auto max-w-xs space-y-1 rounded border border-dashed border-slate-300 bg-white p-4 text-center font-mono text-xs text-slate-700">
              {nilai.strukTampilkanLogo && logo && (
                <img src={logo} alt="" className="mx-auto mb-1 size-10 object-contain grayscale" />
              )}
              {nilai.strukTampilkanNama && (
                <>
                  <p className="text-sm font-bold">{nilai.namaToko}</p>
                  {nilai.namaBadanUsaha && <p>{nilai.namaBadanUsaha}</p>}
                </>
              )}
              <p className="text-slate-500">{nilai.alamatToko}</p>
              {nilai.telpToko && <p className="text-slate-500">Telp: {nilai.telpToko}</p>}
              <div className="my-2 border-t border-dashed border-slate-300" />
              <p>No: {contohNomor}</p>
              <div className="my-2 border-t border-dashed border-slate-300" />
              <p className="whitespace-pre-line text-slate-500">{nilai.footerStruk}</p>
            </div>
          </div>
        </KartuBagian>
      </form>
    </Form>
  );
}
