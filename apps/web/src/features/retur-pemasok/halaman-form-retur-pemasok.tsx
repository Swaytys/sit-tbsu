import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  LABEL_PENYELESAIAN_RETUR_PEMASOK,
  PENYELESAIAN_RETUR_PEMASOK,
  POLA_QTY,
  skemaReturPemasok,
  subtotalRupiah,
  type BarisBarang,
  type DataReturPemasok,
  type InputReturPemasok,
  type KondisiStok,
  type PenyelesaianReturPemasok,
} from '@sit/shared';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Path } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useDetailBarang } from '@/api/barang';
import { usePenerimaanBerhutang, useSimpanReturPemasok } from '@/api/hutang';
import { useDaftarPemasok } from '@/api/mitra';
import { PilihBarang } from '@/components/pilih-barang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tampilkanGalatForm } from '@/lib/form';
import { formatDesimal, formatTanggal } from '@/lib/format';
import { useCegahKeluar } from '@/lib/use-cegah-keluar';

const PENJELASAN: Record<PenyelesaianReturPemasok, string> = {
  POTONG_HUTANG: 'Nilai retur mengurangi sisa hutang penerimaan yang dipilih.',
  GANTI_BARANG:
    'Pemasok mengganti dengan barang yang sama. Barang pengganti langsung dicatat masuk sebagai penerimaan yang dibayar dengan retur ini.',
  REFUND: 'Pemasok mengembalikan uang: tunai masuk uang shift, atau lewat transfer.',
  PENGEMBALIAN_TITIPAN: 'Barang titipan (konsinyasi) dikembalikan ke pemiliknya; tidak ada uang.',
};

/** Perkiraan tampilan (nilai final = HPP saat disimpan, dihitung server). */
function perkiraan(qty: unknown, hpp: number | undefined): number | null {
  const q = typeof qty === 'string' ? qty.trim().replace(',', '.') : '';
  if (hpp === undefined) return null;
  return POLA_QTY.test(q) ? subtotalRupiah(q, hpp) : 0;
}

/** Retur ke pemasok baru (docs/06 RP1–RP7). `?barang=<id>` mengisi satu baris dari stok rusak. */
export function HalamanFormReturPemasok() {
  const navigasi = useNavigate();
  const [url] = useSearchParams();
  const simpan = useSimpanReturPemasok();
  const pemasok = useDaftarPemasok({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 100 });
  const [info, setInfo] = useState<Record<number, BarisBarang>>({});

  const form = useForm<InputReturPemasok, unknown, DataReturPemasok>({
    resolver: zodResolver(skemaReturPemasok),
    defaultValues: {
      idPenerimaan: null,
      alasan: '',
      penyelesaian: 'POTONG_HUTANG',
      metodeRefund: null,
      referensi: '',
      catatan: '',
      baris: [],
    },
  });
  const baris = useFieldArray({ control: form.control, name: 'baris' });
  const [idPemasok, penyelesaian, idPenerimaan, metodeRefund, isiBaris] = useWatch({
    control: form.control,
    name: ['idPemasok', 'penyelesaian', 'idPenerimaan', 'metodeRefund', 'baris'],
  });
  const titipan = penyelesaian === 'PENGEMBALIAN_TITIPAN';
  const berhutang = usePenerimaanBerhutang(
    penyelesaian === 'POTONG_HUTANG' && idPemasok ? idPemasok : null,
  );
  const { lewati, dialog: dialogKeluar } = useCegahKeluar(form.formState.isDirty);

  // Isian awal dari tab Stok Rusak: satu barang, kondisi RUSAK, qty seluruh stok rusak.
  const idAwal = Number(url.get('barang')) || null;
  const awal = useDetailBarang(idAwal);
  const sudahAwal = useRef(false);
  useEffect(() => {
    const b = awal.data;
    if (!b || sudahAwal.current) return;
    sudahAwal.current = true;
    if (b.kepemilikan === 'KONSINYASI') {
      form.setValue('penyelesaian', 'PENGEMBALIAN_TITIPAN');
      if (b.idPemasokKonsinyasi) form.setValue('idPemasok', b.idPemasokKonsinyasi);
    }
    setInfo((lama) => ({ ...lama, [b.id]: b }));
    baris.append({
      idBarang: b.id,
      kondisiAsal: 'RUSAK',
      // "14.500" → "14,5" (isian form).
      qty: b.stokRusak.replace(/\.?0+$/, '').replace('.', ','),
      keterangan: '',
    });
  }, [awal.data, baris, form]);

  const totalPerkiraan = (isiBaris ?? []).reduce<number | null>((t, b) => {
    const p = perkiraan(b.qty, info[b.idBarang]?.hppRata2);
    return t === null || p === null ? null : t + p;
  }, 0);
  const sumber = (berhutang.data ?? []).find((p) => p.id === idPenerimaan);

  function hapusBaris(i: number) {
    const nilai = form.getValues(`baris.${i}`);
    const nama = info[nilai.idBarang]?.namaBarang ?? `baris ${i + 1}`;
    baris.remove(i);
    toast(`${nama} dihapus dari daftar.`, {
      duration: 8000,
      action: {
        label: 'Urungkan',
        onClick: () => baris.insert(Math.min(i, form.getValues('baris').length), nilai),
      },
    });
  }

  function tambahBarang(b: BarisBarang) {
    const ada = (isiBaris ?? []).filter((x) => x.idBarang === b.id);
    const kondisiAda = new Set(ada.map((x) => x.kondisiAsal));
    if (kondisiAda.has('BAIK') && kondisiAda.has('RUSAK')) {
      toast.info(`${b.namaBarang} sudah ada untuk stok baik dan rusak.`);
      return;
    }
    // Stok rusak lebih dulu bila ada (alasan retur paling umum), kecuali sudah ada barisnya.
    const kondisi: KondisiStok =
      kondisiAda.has('RUSAK') || !/[1-9]/.test(b.stokRusak) ? 'BAIK' : 'RUSAK';
    setInfo((lama) => ({ ...lama, [b.id]: b }));
    baris.append({ idBarang: b.id, kondisiAsal: kondisi, qty: '', keterangan: '' });
    setTimeout(() => form.setFocus(`baris.${baris.fields.length}.qty`), 0);
  }

  function gantiPenyelesaian(v: PenyelesaianReturPemasok) {
    const lamaTitipan = form.getValues('penyelesaian') === 'PENGEMBALIAN_TITIPAN';
    form.setValue('penyelesaian', v, { shouldDirty: true });
    if (v !== 'POTONG_HUTANG') form.setValue('idPenerimaan', null);
    if (v !== 'REFUND') form.setValue('metodeRefund', null);
    else if (!form.getValues('metodeRefund')) form.setValue('metodeRefund', 'TRANSFER');
    if (lamaTitipan !== (v === 'PENGEMBALIAN_TITIPAN') && form.getValues('baris').length > 0) {
      baris.replace([]);
      toast('Daftar barang dikosongkan: barang titipan dan barang milik toko tidak bisa dicampur.');
    }
  }

  async function kirim(data: DataReturPemasok) {
    try {
      const hasil = await simpan.mutateAsync(data);
      toast.success(`Retur ${hasil.nomor} disimpan; stok berkurang.`);
      for (const p of hasil.peringatan) toast.warning(p, { duration: 10000 });
      lewati();
      void navigasi(`/retur-pemasok/${hasil.id}`);
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'idPemasok',
        'idPenerimaan',
        'alasan',
        'metodeRefund',
        'baris',
        ...(isiBaris ?? []).flatMap((_, i) =>
          (['idBarang', 'qty'] as const).map((k) => `baris.${i}.${k}` as Path<InputReturPemasok>),
        ),
      ]);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/retur-pemasok" aria-label="Kembali ke daftar retur pemasok">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Retur ke pemasok</h1>
          <p className="text-sm text-slate-500">
            Nomor retur dibuat saat disimpan. Retur tidak bisa diubah atau dibatalkan setelah
            disimpan.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data retur</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-4 items-start gap-4">
              <FormField
                control={form.control}
                name="idPemasok"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Pemasok</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(v) => {
                        field.onChange(Number(v));
                        form.setValue('idPenerimaan', null);
                        if (titipan && form.getValues('baris').length > 0) baris.replace([]);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" aria-label="Pemasok">
                          <SelectValue placeholder="Pilih pemasok" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(pemasok.data?.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.namaPemasok}
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
                name="penyelesaian"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Penyelesaian</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => gantiPenyelesaian(v as PenyelesaianReturPemasok)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" aria-label="Penyelesaian">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PENYELESAIAN_RETUR_PEMASOK.map((p) => (
                          <SelectItem key={p} value={p}>
                            {LABEL_PENYELESAIAN_RETUR_PEMASOK[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{PENJELASAN[penyelesaian]}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {penyelesaian === 'POTONG_HUTANG' && (
                <FormField
                  control={form.control}
                  name="idPenerimaan"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Hutang yang dipotong</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(v) => field.onChange(Number(v))}
                        disabled={!idPemasok}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full" aria-label="Hutang yang dipotong">
                            <SelectValue
                              placeholder={
                                !idPemasok
                                  ? 'Pilih pemasok dulu'
                                  : (berhutang.data ?? []).length === 0
                                    ? 'Tidak ada hutang ke pemasok ini'
                                    : 'Pilih penerimaan'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(berhutang.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nomor} · {formatTanggal(p.tanggalOperasional)}
                              {p.noFaktur && ` · faktur ${p.noFaktur}`} · sisa{' '}
                              {formatRupiah(p.sisa)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {sumber && totalPerkiraan !== null && totalPerkiraan > sumber.sisa && (
                        <p className="text-sm text-amber-700">
                          Perkiraan nilai retur {formatRupiah(totalPerkiraan)} melebihi sisa hutang{' '}
                          {formatRupiah(sumber.sisa)}.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {penyelesaian === 'REFUND' && (
                <FormField
                  control={form.control}
                  name="metodeRefund"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Uang kembali lewat</FormLabel>
                      <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v)}>
                        <FormControl>
                          <SelectTrigger className="w-full" aria-label="Uang kembali lewat">
                            <SelectValue placeholder="Pilih" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TRANSFER">Transfer ke rekening toko</SelectItem>
                          <SelectItem value="TUNAI">Tunai ke uang shift</SelectItem>
                        </SelectContent>
                      </Select>
                      {metodeRefund === 'TUNAI' && (
                        <FormDescription>Butuh shift kasir Anda yang sedang buka.</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {penyelesaian === 'REFUND' && (
                <FormField
                  control={form.control}
                  name="referensi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. referensi (wajib untuk transfer)</FormLabel>
                      <FormControl>
                        <Input placeholder="No. bukti" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="alasan"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Alasan retur</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: semen menggumpal, kemasan sobek"
                        {...field}
                        value={field.value ?? ''}
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
                  <FormItem className="col-span-2">
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

          <Card className="gap-0 py-0">
            <div className="space-y-2 border-b p-4">
              <PilihBarang
                onPilih={tambahBarang}
                disabled={titipan && !idPemasok}
                saring={(b) =>
                  titipan
                    ? b.kepemilikan === 'KONSINYASI' && b.idPemasokKonsinyasi === idPemasok
                    : b.kepemilikan === 'MILIK_SENDIRI'
                }
                placeholder={
                  titipan
                    ? idPemasok
                      ? 'Cari barang titipan pemasok ini…'
                      : 'Pilih pemasok dulu'
                    : 'Cari barang yang dikembalikan (nama, kode, barcode, atribut)… lalu Enter'
                }
              />
              {form.formState.errors.baris?.message && (
                <p className="text-sm text-red-600">{form.formState.errors.baris.message}</p>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="w-44">Diambil dari</TableHead>
                  <TableHead className="w-36">Qty</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="w-40 text-right">Perkiraan nilai</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.fields.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                      Belum ada barang. Cari barang di atas untuk menambah baris.
                    </TableCell>
                  </TableRow>
                )}
                {baris.fields.map((f, i) => {
                  const b = info[f.idBarang];
                  const isi = isiBaris?.[i];
                  const nilai = perkiraan(isi?.qty, b?.hppRata2);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="text-slate-500">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{b?.namaBarang}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{b?.kode}</span> · baik{' '}
                          {b ? formatDesimal(b.stokFisik) : '—'} · rusak{' '}
                          {b ? formatDesimal(b.stokRusak) : '—'} {b?.kodeSatuan}
                        </div>
                        <FormField
                          control={form.control}
                          name={`baris.${i}.idBarang`}
                          render={() => (
                            <FormItem>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`baris.${i}.kondisiAsal`}
                          render={({ field }) => (
                            <FormItem>
                              <Select value={field.value ?? 'BAIK'} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger
                                    className="w-full"
                                    aria-label={`Kondisi ${b?.namaBarang ?? i + 1}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="RUSAK">Stok rusak</SelectItem>
                                  <SelectItem value="BAIK">Stok baik</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`baris.${i}.qty`}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-1.5">
                                <FormControl>
                                  <Input
                                    inputMode="decimal"
                                    aria-label={`Qty ${b?.namaBarang ?? i + 1}`}
                                    {...field}
                                    value={typeof field.value === 'string' ? field.value : ''}
                                  />
                                </FormControl>
                                <span className="text-xs text-slate-500">{b?.kodeSatuan}</span>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`baris.${i}.keterangan`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  aria-label={`Keterangan ${b?.namaBarang ?? i + 1}`}
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nilai === null ? '—' : formatRupiah(nilai)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Hapus baris ${i + 1}`}
                          onClick={() => hapusBaris(i)}
                        >
                          <Trash2 className="text-slate-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {totalPerkiraan !== null && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-medium">
                      Perkiraan nilai retur (HPP rata-rata saat ini)
                    </TableCell>
                    <TableCell className="text-right text-base font-semibold tabular-nums">
                      {formatRupiah(totalPerkiraan)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <p className="mr-auto text-sm text-slate-500">
              Simpan mengurangi stok dari kondisi yang dipilih dengan nilai HPP rata-rata saat itu.
            </p>
            <Button type="button" variant="outline" asChild>
              <Link to="/retur-pemasok">Batal</Link>
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || baris.fields.length === 0}
            >
              {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan retur'}
            </Button>
          </div>
        </form>
      </Form>
      {dialogKeluar}
    </div>
  );
}
