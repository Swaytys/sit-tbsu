import { zodResolver } from '@hookform/resolvers/zod';
import { PILIHAN_BARIS_PER_HALAMAN, skemaOperasional, type Pengaturan } from '@sit/shared';
import { Settings2 } from 'lucide-react';
import { useForm, type Control } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import { InputAngka } from '@/components/input-angka';
import { InputRupiah } from '@/components/input-rupiah';
import { Input } from '@/components/ui/input';
import { KartuBagian } from './bagian';
import { useSimpanPengaturan } from './use-simpan-pengaturan';

type Masukan = z.input<typeof skemaOperasional>;
type Keluaran = z.output<typeof skemaOperasional>;
type KolomAngka = Exclude<
  keyof Masukan,
  | 'autoBatalOrderBasi'
  | 'checkoutWajibShift'
  | 'barisPerHalaman'
  | 'rekeningTransfer'
  | 'rekeningEdc'
  | 'batasReturTanpaSetuju'
  | 'batasVoidTanpaSetuju'
>;

const KOLOM_ANGKA: { nama: KolomAngka; label: string; satuan: string; ket: string }[] = [
  {
    nama: 'ambangRestockPersen',
    label: 'Ambang perlu restock',
    satuan: '%',
    ket: 'Stok ≤ minimum × (1 + ambang) ditandai PERLU RESTOCK (K-023).',
  },
  {
    nama: 'stokMinimumDefault',
    label: 'Stok minimum bawaan',
    satuan: 'satuan',
    ket: 'Diisikan otomatis saat membuat barang baru.',
  },
  {
    nama: 'batasUmurOrderJam',
    label: 'Batas umur order',
    satuan: 'jam',
    ket: 'Order menunggu lebih lama dari ini ditandai basi (R7).',
  },
  {
    nama: 'batasKunciOrderMenit',
    label: 'Batas kunci order diproses',
    satuan: 'menit',
    ket: 'Order yang dikunci kasir lebih lama dari ini kembali ke antrean (R8).',
  },
  {
    nama: 'termHariDefault',
    label: 'Term piutang pelanggan baru',
    satuan: 'hari',
    ket: 'Jangka waktu bayar bawaan untuk pelanggan baru.',
  },
  {
    nama: 'jatuhTempoDefaultHari',
    label: 'Jatuh tempo bawaan',
    satuan: 'hari',
    ket: 'Dipakai bila term pelanggan 0 (P7).',
  },
];

function Saklar({
  control,
  nama,
  label,
  ket,
}: {
  control: Control<Masukan, unknown, Keluaran>;
  nama: 'autoBatalOrderBasi' | 'checkoutWajibShift';
  label: string;
  ket: string;
}) {
  return (
    <FormField
      control={control}
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
  );
}

/** Ambang stok, order basi/kunci, dan bawaan piutang (docs/05 §3, §15; docs/06). */
export function FormOperasional({ pengaturan }: { pengaturan: Pengaturan }) {
  const simpan = useSimpanPengaturan();
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(skemaOperasional),
    defaultValues: pengaturan.operasional,
  });

  async function kirim(data: Keluaran) {
    const hasil = await simpan({ operasional: data });
    if (hasil) form.reset(hasil.operasional);
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} noValidate>
        <KartuBagian
          ikon={Settings2}
          judul="Operasional"
          keterangan="Aturan stok, antrean order, dan piutang yang dipakai sistem sehari-hari."
          bisaSimpan={form.formState.isDirty}
          menyimpan={form.formState.isSubmitting}
        >
          <div className="grid grid-cols-2 gap-4">
            {KOLOM_ANGKA.map((k) => (
              <FormField
                key={k.nama}
                control={form.control}
                name={k.nama}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {k.label} <span className="font-normal text-slate-400">({k.satuan})</span>
                    </FormLabel>
                    <FormControl>
                      <InputAngka {...field} min={0} />
                    </FormControl>
                    <FormDescription>{k.ket}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="barisPerHalaman"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Baris per halaman tabel</FormLabel>
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
                      {PILIHAN_BARIS_PER_HALAMAN.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} baris
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Jumlah baris per halaman di semua tabel data.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {(
              [
                {
                  nama: 'rekeningTransfer',
                  label: 'Rekening bawaan transfer',
                  ket: 'Terisi otomatis saat kasir memilih Transfer (mis. BCA 1234567890).',
                },
                {
                  nama: 'rekeningEdc',
                  label: 'Mesin EDC bawaan',
                  ket: 'Terisi otomatis saat kasir memilih EDC (mis. EDC BRI).',
                },
              ] as const
            ).map((k) => (
              <FormField
                key={k.nama}
                control={form.control}
                name={k.nama}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{k.label}</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={60} />
                    </FormControl>
                    <FormDescription>{k.ket}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          {/* K-099: batas nilai retur/void yang boleh diproses Kasir tanpa atasan. */}
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Retur dan void tanpa persetujuan atasan</p>
            <p className="text-muted-foreground text-sm">
              Kasir boleh memproses sendiri retur/void sampai nilai ini per transaksi (retur atau
              void sebelumnya atas transaksi yang sama ikut dihitung). Di atas nilai ini butuh
              Admin/Owner, yang bisa menyetujui langsung di layar kasir dengan mengetik akunnya. Isi
              Rp 0 bila semua retur/void harus disetujui atasan.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {(
                [
                  { nama: 'batasReturTanpaSetuju', label: 'Batas retur per transaksi' },
                  { nama: 'batasVoidTanpaSetuju', label: 'Batas void per transaksi' },
                ] as const
              ).map((k) => (
                <FormField
                  key={k.nama}
                  control={form.control}
                  name={k.nama}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{k.label}</FormLabel>
                      <FormControl>
                        <InputRupiah
                          {...field}
                          onChange={(v) => field.onChange(v ?? 0)}
                          placeholder="0 = selalu butuh atasan"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
          <Saklar
            control={form.control}
            nama="autoBatalOrderBasi"
            label="Batalkan order basi otomatis"
            ket="Bila aktif, order basi dibatalkan sistem dan stok yang ditahan dilepas (K-007)."
          />
          <Saklar
            control={form.control}
            nama="checkoutWajibShift"
            label="Pembayaran tunai wajib shift terbuka"
            ket="Kasir harus membuka shift sebelum menerima uang tunai (K-018)."
          />
        </KartuBagian>
      </form>
    </Form>
  );
}
