import { zodResolver } from '@hookform/resolvers/zod';
import {
  KERTAS_DOKUMEN,
  LABEL_CARA_CETAK,
  LABEL_KERTAS_DOKUMEN,
  skemaProfilToko,
  STRUK_CETAK,
  type Pengaturan,
} from '@sit/shared';
import { FileText } from 'lucide-react';
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
import { KartuBagian } from './bagian';
import { ambilSetelanDokumen } from './setelan-dokumen';
import { useSimpanPengaturan } from './use-simpan-pengaturan';

type Masukan = z.input<typeof skemaProfilToko>;
type Keluaran = z.output<typeof skemaProfilToko>;

type Kolom =
  'invoiceCetak' | 'suratJalanCetak' | 'kertasInvoice' | 'kertasSuratJalan' | 'kertasDokumenLain';

const CETAK: [Kolom, string, string][] = [
  [
    'invoiceCetak',
    'Invoice pengantaran setelah dibuat',
    'Tanya dulu = muncul pemberitahuan dengan tombol Cetak. Kapan pun bisa dicetak dengan tombol P.',
  ],
  [
    'suratJalanCetak',
    'Surat jalan setelah dibuat',
    'Berlaku di layar pengantaran (tombol S), detail penjualan, dan papan Pengiriman.',
  ],
];

const KERTAS: [Kolom, string, string][] = [
  ['kertasInvoice', 'Kertas invoice', 'Invoice pengantaran dan cetak ulang invoice.'],
  ['kertasSuratJalan', 'Kertas surat jalan', 'Surat jalan dari semua halaman.'],
  [
    'kertasDokumenLain',
    'Kertas dokumen lain',
    'Nota setoran titipan dan nota retur ke pemasok. Laporan memakai arah kertasnya sendiri.',
  ],
];

/**
 * K-124: kapan invoice/surat jalan dicetak dan di kertas apa. Disimpan di server (berlaku untuk semua
 * komputer). Struk thermal diatur di kartu Struk penjualan dan Printer struk.
 */
export function FormDokumen({ pengaturan }: { pengaturan: Pengaturan }) {
  const simpan = useSimpanPengaturan();
  const form = useForm<Masukan, unknown, Keluaran>({
    resolver: zodResolver(skemaProfilToko),
    defaultValues: pengaturan.profil,
  });

  async function kirim(data: Keluaran) {
    const hasil = await simpan({
      profil: { ...pengaturan.profil, ...ambilSetelanDokumen(data) },
    });
    if (hasil) form.reset(hasil.profil);
  }

  function pilihan(
    nama: Kolom,
    label: string,
    ket: string,
    isi: readonly string[],
    teks: Record<string, string>,
  ) {
    return (
      <FormField
        key={nama}
        control={form.control}
        name={nama}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full" aria-label={label}>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {isi.map((n) => (
                  <SelectItem key={n} value={n}>
                    {teks[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>{ket}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} noValidate>
        <KartuBagian
          ikon={FileText}
          judul="Invoice, surat jalan & kertas"
          keterangan="Kapan dokumen lembaran dicetak dan di kertas apa. Berlaku untuk semua komputer."
          bisaSimpan={form.formState.isDirty}
          menyimpan={form.formState.isSubmitting}
        >
          <div className="grid grid-cols-2 gap-4">
            {CETAK.map(([n, l, k]) => pilihan(n, l, k, STRUK_CETAK, LABEL_CARA_CETAK))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {KERTAS.map(([n, l, k]) => pilihan(n, l, k, KERTAS_DOKUMEN, LABEL_KERTAS_DOKUMEN))}
          </div>
          <details className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
            <summary className="cursor-pointer font-medium">
              Cetak invoice/surat jalan tanpa jendela cetak (langsung keluar di printer A4)
            </summary>
            <div className="mt-2 space-y-2">
              <p>
                Peramban biasa selalu menampilkan jendela cetak untuk invoice dan surat jalan. Agar
                langsung keluar tanpa jendela, kerjakan sekali di komputer yang tersambung ke
                printer A4:
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Pastikan printer A4 sudah terpasang dan bisa mencetak halaman uji dari Windows.
                </li>
                <li>
                  Windows › <b>Setelan</b> › <b>Bluetooth &amp; perangkat</b> ›{' '}
                  <b>Printer &amp; pemindai</b>: matikan{' '}
                  <b>Biarkan Windows mengatur printer bawaan</b>, klik printer A4 ›{' '}
                  <b>Jadikan bawaan</b>.
                </li>
                <li>
                  Salin folder <code>scripts\kasir</code> dari server ke komputer ini, lalu klik dua
                  kali <code>buka-kasir.cmd</code> (buat pintasannya di desktop). Aplikasi terbuka
                  dalam <b>mode kasir</b>: semua cetakan jendela langsung ke printer bawaan.
                </li>
                <li>
                  Login di jendela itu. Bila komputer ini juga mencetak struk, siapkan printer struk
                  di kartu <b>Printer struk komputer ini</b> di atas{' '}
                  <b>di dalam jendela mode kasir</b> dan nyalakan cetak langsung: struk tetap ke
                  printer thermal, dokumen A4 ke printer bawaan, tidak tertukar.
                </li>
                <li>
                  Atur kertas di atas (bawaan A4 lanskap untuk invoice dan surat jalan), Simpan,
                  lalu coba cetak ulang satu invoice dari Detail penjualan.
                </li>
              </ol>
              <p>
                Bila hasilnya terpotong atau arahnya salah: buka Preferensi pencetakan printer A4 di
                Windows dan samakan ukuran kertasnya dengan pilihan di atas.
              </p>
            </div>
          </details>
        </KartuBagian>
      </form>
    </Form>
  );
}
