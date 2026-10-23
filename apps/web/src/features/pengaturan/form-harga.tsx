import { zodResolver } from '@hookform/resolvers/zod';
import { skemaHargaDiskon, type Pengaturan } from '@sit/shared';
import { Tag } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InputAngka } from '@/components/input-angka';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { KalkulatorHargaDasar } from './kalkulator-harga-dasar';
import { KartuBagian } from './bagian';
import { useSimpanPengaturan } from './use-simpan-pengaturan';

type Masukan = z.input<typeof skemaHargaDiskon>;
type Keluaran = z.output<typeof skemaHargaDiskon>;

/** Harga dasar: dasar markup dan pembulatan harga jual (K-009, K-010); diskon manual sudah dihapus (K-146). */
export function FormHarga({ pengaturan }: { pengaturan: Pengaturan }) {
  const simpan = useSimpanPengaturan();
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(skemaHargaDiskon),
    defaultValues: pengaturan.harga,
  });

  const [dasarDipilih, pembulatan] = useWatch({
    control: form.control,
    name: ['dasarMarkup', 'pembulatanHarga'],
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
          judul="Harga dasar"
          keterangan="Angka modal yang dipakai menghitung harga jual otomatis (markup tier), dan pembulatannya."
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
                      <SelectItem value="HPP_RATA2">Rata-rata tertimbang (Average)</SelectItem>
                      <SelectItem value="HARGA_BELI_TERAKHIR">
                        Harga beli terakhir (Latest cost)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Harga jual = dasar × (1 + markup tier), lalu dibulatkan.
                  </FormDescription>
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
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Penjelasan judul="Average, harga beli terakhir, LIFO, dan FIFO">
              <ButirPenjelasan>
                <li>
                  <b>Rata-rata tertimbang (Average / Weighted Average Cost).</b> Nilai stok dibagi
                  jumlah stok: setiap barang datang dengan harga baru, modal rata-ratanya bergeser
                  sebanding jumlahnya. Harga jual naik pelan dan stabil. Cocok untuk barang yang
                  harga belinya naik-turun sedikit (semen, pasir, besi).
                </li>
                <li>
                  <b>Harga beli terakhir (Latest cost / replacement cost).</b> Harga jual dihitung
                  dari harga pembelian paling baru, seakan-akan stok yang dijual harus dibeli lagi
                  dengan harga itu. Harga jual langsung mengikuti kenaikan pemasok, sehingga toko
                  tidak rugi saat harus belanja ulang. Ini <i>mirip</i> semangat LIFO (yang terakhir
                  masuk menentukan), tetapi bukan LIFO: stok tidak dinilai per lapisan pembelian.
                </li>
                <li>
                  <b>LIFO (Last In, First Out)</b> menilai stok dengan menganggap barang yang
                  terakhir masuk dijual lebih dulu. Untuk laporan keuangan di Indonesia, LIFO tidak
                  diperbolehkan (PSAK 14), jadi tidak disediakan sebagai metode penilaian.
                </li>
                <li>
                  <b>FIFO (First In, First Out)</b> menganggap barang yang lebih dulu masuk dijual
                  lebih dulu, sehingga dasar harganya adalah harga beli lama sampai stok lama habis.
                  Untuk itu sistem harus mencatat setiap lapisan pembelian; aplikasi ini memakai
                  rata-rata tertimbang (K-008), jadi FIFO hanya tampil sebagai pembanding di
                  kalkulator.
                </li>
                <li>
                  <b>Yang tidak berubah oleh pilihan ini:</b> nilai persediaan dan HPP di laporan
                  laba selalu rata-rata tertimbang. Pilihan ini hanya menentukan angka dasar harga
                  jual otomatis. Setelah diubah, barang yang harganya berubah ditandai{' '}
                  <i>perlu tinjau</i> (atau langsung naik bila harga otomatis).
                </li>
                <li>
                  <b>Pembulatan</b>: harga hasil markup dibulatkan <i>ke atas</i> ke kelipatan angka
                  ini, mis. Rp 69.115 dengan pembulatan Rp 500 menjadi Rp 69.500.
                </li>
              </ButirPenjelasan>
            </Penjelasan>
            <span className="pt-2">Bedanya Average, harga beli terakhir, LIFO, dan FIFO.</span>
          </div>
          <KalkulatorHargaDasar pembulatan={Number(pembulatan) || 1} dipilih={dasarDipilih} />
        </KartuBagian>
      </form>
    </Form>
  );
}
