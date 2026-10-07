import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  skemaPenyelesaianKonsinyasi,
  type DataPenyelesaianKonsinyasi,
  type InputPenyelesaianKonsinyasi,
} from '@sit/shared';
import { ArrowLeft } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import {
  usePratinjauKonsinyasi,
  useRingkasanKonsinyasi,
  useSelesaikanKonsinyasi,
} from '@/api/konsinyasi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
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
import { formatTanggal, tanggalHariIni } from '@/lib/format';
import { tampilkanGalatForm } from '@/lib/form';
import { TabelSetoran } from './tabel-setoran';

/** Buat setoran konsinyasi (KSG) untuk satu pemasok sampai tanggal tertentu (docs/06 KS5). */
export function HalamanFormKonsinyasi() {
  const navigasi = useNavigate();
  const [url] = useSearchParams();
  const ringkasan = useRingkasanKonsinyasi();
  const simpan = useSelesaikanKonsinyasi();
  const hariIni = tanggalHariIni();
  const form = useForm<InputPenyelesaianKonsinyasi, unknown, DataPenyelesaianKonsinyasi>({
    resolver: zodResolver(skemaPenyelesaianKonsinyasi),
    defaultValues: {
      idPemasok: Number(url.get('pemasok')) || undefined,
      periodeSelesai: hariIni,
      catatan: '',
    },
  });
  const [idPemasok, periodeSelesai] = useWatch({
    control: form.control,
    name: ['idPemasok', 'periodeSelesai'],
  });
  const id = Number(idPemasok) || null;
  const tanggalSah =
    typeof periodeSelesai === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(periodeSelesai);
  const pratinjau = usePratinjauKonsinyasi(
    id && tanggalSah ? { idPemasok: id, periodeSelesai } : null,
  );
  const p = pratinjau.data;

  async function kirim(data: DataPenyelesaianKonsinyasi) {
    try {
      const hasil = await simpan.mutateAsync(data);
      toast.success(`Setoran ${hasil.nomor} disimpan: ${formatRupiah(hasil.total)}.`);
      void navigasi(`/konsinyasi/${hasil.id}`);
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['idPemasok', 'periodeSelesai', 'catatan']);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/konsinyasi" aria-label="Kembali ke konsinyasi">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Buat setoran konsinyasi</h1>
          <p className="text-sm text-slate-500">
            Semua penjualan barang titipan pemasok ini yang belum disetor sampai tanggal akhir
            periode ikut dihitung. Setoran tidak bisa diubah setelah disimpan.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid grid-cols-4 items-start gap-4">
              <FormField
                control={form.control}
                name="idPemasok"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Pemasok penitip</FormLabel>
                    <Select
                      value={typeof field.value === 'number' ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" aria-label="Pemasok penitip">
                          <SelectValue placeholder="Pilih pemasok" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(ringkasan.data ?? []).map((r) => (
                          <SelectItem key={r.idPemasok} value={String(r.idPemasok)}>
                            {r.namaPemasok} · belum disetor {formatRupiah(r.nilaiBelumDisetor)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodeSelesai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Penjualan sampai tanggal</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        max={hariIni}
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="catatan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Input placeholder="opsional" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {!id ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              Pilih pemasok untuk melihat pratinjau setoran.
            </Card>
          ) : pratinjau.error ? (
            <Card className="p-6 text-sm text-red-600">{pesanGalat(pratinjau.error)}</Card>
          ) : !p ? (
            <Card className="p-8 text-center text-sm text-slate-500">Menghitung…</Card>
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <div className="border-b p-3 text-sm text-slate-600">
                Periode penjualan {formatTanggal(p.periodeMulai)} –{' '}
                {formatTanggal(p.periodeSelesai)} · {p.jumlahBarisJual} baris penjualan
              </div>
              <TabelSetoran baris={p.baris} total={p.total} />
              {p.koreksiDitunda > 0 && (
                <p className="border-t bg-amber-50 p-3 text-sm text-amber-800">
                  {p.koreksiDitunda} retur pelanggan atas barang yang sudah disetor belum bisa
                  dikoreksi (belum ada penjualan baru dengan harga titip yang sama); akan dikoreksi
                  di setoran berikutnya.
                </p>
              )}
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            {p && p.baris.length > 0 && (
              <p className="mr-auto text-sm text-slate-500">
                {p.baris.length} baris barang · total setoran {formatRupiah(p.total)}
              </p>
            )}
            <Button type="button" variant="outline" asChild>
              <Link to="/konsinyasi">Batal</Link>
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || !p || p.jumlahBarisJual === 0}
            >
              {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan setoran'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
