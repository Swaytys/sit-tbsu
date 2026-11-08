import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  LABEL_TINDAKAN_TOLAK,
  POLA_QTY,
  skemaPenerimaan,
  subtotalRupiah,
  teksSyaratBayarPO,
  TINDAKAN_TOLAK,
  type BarisBarang,
  type DataPenerimaan,
  type InputPenerimaan,
} from '@sit/shared';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Path } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useDaftarPemasok } from '@/api/mitra';
import { useDetailPO } from '@/api/order-pembelian';
import { useSimpanPenerimaan } from '@/api/persediaan';
import { InputRupiah } from '@/components/input-rupiah';
import { PilihBarang } from '@/components/pilih-barang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatDesimal, formatTanggal, tambahHariTanggal, tanggalHariIni } from '@/lib/format';
import { useCegahKeluar } from '@/lib/use-cegah-keluar';

/** Subtotal tampilan sementara (nilai final dihitung server, CLAUDE.md aturan 1). */
function subtotalTampil(qty: unknown, harga: unknown): number {
  const q = typeof qty === 'string' ? qty.trim().replace(',', '.') : '';
  if (!POLA_QTY.test(q) || typeof harga !== 'number') return 0;
  return subtotalRupiah(q, harga);
}

/** Catat penerimaan barang (docs/05 E1–E4). Tanggal = hari ini (tanggal operasional). */
export function HalamanFormPenerimaan() {
  const navigasi = useNavigate();
  const [url] = useSearchParams();
  // `?jenis=KONSINYASI&pemasok=<id>` dari halaman Konsinyasi.
  const titipanAwal = url.get('jenis') === 'KONSINYASI';
  const pemasokAwal = Number(url.get('pemasok')) || undefined;
  const simpan = useSimpanPenerimaan();
  const pemasok = useDaftarPemasok({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 100 });
  // Data tampilan barang per baris (kode, nama, satuan, harga titip).
  const [infoBarang, setInfoBarang] = useState<
    Record<number, Pick<BarisBarang, 'namaBarang' | 'kode' | 'kodeSatuan'> & { stokFisik?: string }>
  >({});
  // K-125: `?po=<id>` dari Order Pembelian: pemasok dan sisa barang yang belum datang langsung terisi.
  const idPO = Number(url.get('po')) || null;
  const po = useDetailPO(idPO).data;
  const poTerisi = useRef(false);
  // Pemasok PO selalu ada di pilihan (daftar pemasok dibatasi 100 baris).
  const daftarPemasok = [
    ...(pemasok.data?.data ?? []),
    ...(po && !(pemasok.data?.data ?? []).some((x) => x.id === po.idPemasok)
      ? [{ id: po.idPemasok, namaPemasok: po.namaPemasok }]
      : []),
  ];
  const infoPO: Record<
    number,
    { namaBarang: string; kode: string; kodeSatuan: string; stokFisik?: string }
  > = Object.fromEntries(
    (po?.baris ?? []).map((b) => [
      b.idBarang,
      { namaBarang: b.namaBarang, kode: b.kodeBarang, kodeSatuan: b.kodeSatuan },
    ]),
  );

  const form = useForm<InputPenerimaan, unknown, DataPenerimaan>({
    resolver: zodResolver(skemaPenerimaan),
    defaultValues: {
      jenis: titipanAwal ? 'KONSINYASI' : 'PEMBELIAN',
      idPemasok: pemasokAwal,
      syaratBayar: titipanAwal ? null : 'TUNAI',
      tanggalJatuhTempo: null,
      metodeBayar: 'TRANSFER',
      referensi: '',
      noFakturPemasok: '',
      noSuratJalanPemasok: '',
      catatan: '',
      baris: [],
    },
  });
  const baris = useFieldArray({ control: form.control, name: 'baris' });
  useEffect(() => {
    if (!po || poTerisi.current) return;
    poTerisi.current = true;
    const sisa = po.baris.filter((b) => Number(b.qtySisa) > 0);
    form.reset({
      ...form.getValues(),
      jenis: 'PEMBELIAN',
      idPemasok: po.idPemasok,
      idOrderPembelian: po.id,
      syaratBayar: form.getValues('syaratBayar') ?? 'TUNAI',
      baris: sisa.map((b) => ({
        idBarang: b.idBarang,
        qtyMasuk: b.qtySisa.replace(/\.?0+$/, ''),
        hargaModalMasuk: b.hargaBerlaku ?? 0,
        keterangan: '',
        idOrderPembelianDetail: b.id,
      })),
    });
  }, [po, form]);
  const [jenis, syarat, idPemasok, isiBaris, metodeBayar, bayarIsian] = useWatch({
    control: form.control,
    name: ['jenis', 'syaratBayar', 'idPemasok', 'baris', 'metodeBayar', 'bayarSekarang'],
  });
  // K-236: order dengan kesepakatan → syarat bayar dan jatuh tempo dari order (tidak bisa diganti di sini).
  const sepakat = po?.kesepakatan.syaratBayar ? po.kesepakatan : null;
  const konsinyasi = jenis === 'KONSINYASI';
  const { lewati, dialog: dialogKeluar } = useCegahKeluar(form.formState.isDirty);

  /** Hapus baris dengan kesempatan mengurungkan (salah pencet tidak menghilangkan isian). */
  function hapusBaris(i: number) {
    const nilai = form.getValues(`baris.${i}`);
    const nama =
      (infoBarang[nilai.idBarang] ?? infoPO[nilai.idBarang])?.namaBarang ?? `baris ${i + 1}`;
    baris.remove(i);
    toast(`${nama} dihapus dari daftar.`, {
      duration: 8000,
      action: {
        label: 'Urungkan',
        onClick: () => {
          const kini = form.getValues('baris');
          if (kini.some((b) => b.idBarang === nilai.idBarang)) return;
          baris.insert(Math.min(i, kini.length), nilai);
        },
      },
    });
  }
  const total = (isiBaris ?? []).reduce(
    (t, b) => t + subtotalTampil(b.qtyMasuk, b.hargaModalMasuk),
    0,
  );
  // K-237: perkiraan tampilan pembayaran (nilai final dari API).
  const umTerpakai = sepakat ? Math.min(po?.sisaUangMuka ?? 0, total) : 0;
  const sisaTagihan = total - umTerpakai;
  const wajibLunas = sepakat !== null && sepakat.syaratBayar !== 'TEMPO';
  const bayarEfektif = typeof bayarIsian === 'number' ? bayarIsian : wajibLunas ? sisaTagihan : 0;
  const kurangBayar = wajibLunas && bayarEfektif < sisaTagihan;

  function tambahBarang(b: BarisBarang) {
    const ada = (isiBaris ?? []).findIndex((x) => x.idBarang === b.id);
    if (ada >= 0) {
      toast.info(`${b.namaBarang} sudah ada di baris ${ada + 1}.`);
      form.setFocus(`baris.${ada}.qtyMasuk`);
      return;
    }
    setInfoBarang((lama) => ({ ...lama, [b.id]: b }));
    const harga = konsinyasi ? (b.hargaTitip ?? 0) : b.hargaBeliTerakhir || b.hargaModalAwal || 0;
    baris.append({ idBarang: b.id, qtyMasuk: '', hargaModalMasuk: harga, keterangan: '' });
    setTimeout(() => form.setFocus(`baris.${baris.fields.length}.qtyMasuk`), 0);
  }

  function gantiJenis(v: string) {
    const lama = {
      jenis: form.getValues('jenis'),
      syaratBayar: form.getValues('syaratBayar'),
      baris: form.getValues('baris'),
    };
    form.setValue('jenis', v as DataPenerimaan['jenis'], { shouldDirty: true });
    form.setValue('syaratBayar', v === 'KONSINYASI' ? null : 'TUNAI');
    if (lama.baris.length > 0) {
      baris.replace([]);
      toast('Daftar barang dikosongkan karena jenis penerimaan berubah.', {
        duration: 8000,
        action: {
          label: 'Urungkan',
          onClick: () => {
            form.setValue('jenis', lama.jenis);
            form.setValue('syaratBayar', lama.syaratBayar);
            baris.replace(lama.baris);
          },
        },
      });
    }
  }

  async function kirim(data: DataPenerimaan) {
    try {
      const hasil = await simpan.mutateAsync(data);
      toast.success(`Penerimaan ${hasil.nomor} disimpan; stok bertambah.`);
      lewati();
      void navigasi(`/penerimaan/${hasil.id}`);
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'idPemasok',
        'syaratBayar',
        'tanggalJatuhTempo',
        'referensi',
        'bayarSekarang',
        'alasanKurangBayar',
        'jatuhTempoKurangBayar',
        'baris',
        ...(isiBaris ?? []).flatMap((_, i) =>
          (['idBarang', 'qtyMasuk', 'hargaModalMasuk', 'qtyDitolak', 'alasanTolak'] as const).map(
            (k) => `baris.${i}.${k}` as Path<InputPenerimaan>,
          ),
        ),
      ]);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/penerimaan" aria-label="Kembali ke riwayat penerimaan">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Catat penerimaan barang{po?.nomor ? ` dari ${po.nomor}` : ''}
          </h1>
          <p className="text-sm text-slate-500">
            Nomor penerimaan dibuat otomatis saat disimpan. Penerimaan tidak bisa diubah setelah
            disimpan; koreksi lewat penyesuaian stok.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data penerimaan</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="idPemasok"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Pemasok</FormLabel>
                    <Select
                      disabled={po !== undefined}
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(v) => {
                        // Radix memanggil "" bila nilai belum ada di daftar; jangan menghapus pilihan.
                        if (!v) return;
                        field.onChange(Number(v));
                        if (konsinyasi && (isiBaris ?? []).length > 0) baris.replace([]);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih pemasok" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {daftarPemasok.map((p) => (
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
                name="jenis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis</FormLabel>
                    <Select value={field.value} onValueChange={gantiJenis}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PEMBELIAN">Pembelian</SelectItem>
                        <SelectItem value="KONSINYASI">Konsinyasi (titipan)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {sepakat && (
                <div
                  className="col-span-2 rounded-md border bg-slate-50 p-2 text-sm"
                  data-testid="syarat-dari-order"
                >
                  <p className="text-xs text-slate-500">
                    Syarat bayar dari order (tidak bisa diganti)
                  </p>
                  <p className="font-medium">{teksSyaratBayarPO(sepakat)}</p>
                  {sepakat.syaratBayar === 'TEMPO' && (
                    <p className="text-xs text-slate-600">
                      Jatuh tempo:{' '}
                      {formatTanggal(tambahHariTanggal(tanggalHariIni(), sepakat.tempoHari ?? 0))}
                    </p>
                  )}
                </div>
              )}
              {!konsinyasi && !sepakat && (
                <FormField
                  control={form.control}
                  name="syaratBayar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Syarat bayar</FormLabel>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(v) => {
                          field.onChange(v);
                          if (v === 'TUNAI') form.setValue('tanggalJatuhTempo', null);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TUNAI">Tunai (lunas)</SelectItem>
                          <SelectItem value="TEMPO">Tempo (hutang)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!konsinyasi && !sepakat && syarat === 'TEMPO' && (
                <FormField
                  control={form.control}
                  name="tanggalJatuhTempo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jatuh tempo</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!konsinyasi && (sepakat ? bayarEfektif > 0 : syarat === 'TUNAI') && (
                <FormField
                  control={form.control}
                  name="metodeBayar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dibayar lewat</FormLabel>
                      <Select value={field.value ?? 'TRANSFER'} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TRANSFER">Transfer</SelectItem>
                          <SelectItem value="TUNAI">Tunai (kas toko)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
              {!konsinyasi &&
                (sepakat ? bayarEfektif > 0 : syarat === 'TUNAI') &&
                metodeBayar !== 'TUNAI' && (
                  <FormField
                    control={form.control}
                    name="referensi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. referensi transfer (wajib)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="dari bukti transfer m-banking"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              <FormField
                control={form.control}
                name="noFakturPemasok"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. faktur pemasok</FormLabel>
                    <FormControl>
                      <Input placeholder="opsional" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="noSuratJalanPemasok"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. surat jalan pemasok</FormLabel>
                    <FormControl>
                      <Input placeholder="opsional" {...field} value={field.value ?? ''} />
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
                disabled={konsinyasi && !idPemasok}
                saring={(b) =>
                  konsinyasi
                    ? b.kepemilikan === 'KONSINYASI' && b.idPemasokKonsinyasi === idPemasok
                    : b.kepemilikan === 'MILIK_SENDIRI'
                }
                placeholder={
                  konsinyasi
                    ? idPemasok
                      ? 'Cari barang titipan pemasok ini…'
                      : 'Pilih pemasok dulu'
                    : 'Cari barang yang diterima (nama, kode, barcode, atribut)… lalu Enter'
                }
              />
              {konsinyasi && idPemasok && (
                <p className="text-xs text-slate-500">
                  Hanya barang yang terdaftar sebagai titipan pemasok ini.{' '}
                  <Link
                    to={`/barang/baru?titipan=${idPemasok}`}
                    target="_blank"
                    className="text-blue-700 hover:underline"
                  >
                    Daftarkan barang titipan baru
                  </Link>{' '}
                  (tab baru), lalu cari lagi di sini.
                </p>
              )}
              {form.formState.errors.baris?.message && (
                <p className="text-sm text-red-600">{form.formState.errors.baris.message}</p>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="w-36">{sepakat ? 'Diterima baik' : 'Qty terima'}</TableHead>
                  {sepakat && <TableHead className="w-56">Ditolak (rusak/tidak sesuai)</TableHead>}
                  <TableHead className="w-48">
                    {konsinyasi ? 'Harga titip' : 'Harga modal / satuan'}
                  </TableHead>
                  <TableHead className="w-40 text-right">Subtotal</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.fields.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={sepakat ? 7 : 6}
                      className="py-8 text-center text-sm text-slate-500"
                    >
                      Belum ada barang. Cari barang di atas untuk menambah baris.
                    </TableCell>
                  </TableRow>
                )}
                {baris.fields.map((f, i) => {
                  const b = infoBarang[f.idBarang] ?? infoPO[f.idBarang];
                  const isi = isiBaris?.[i];
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="text-slate-500">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{b?.namaBarang}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{b?.kode}</span> · stok sekarang{' '}
                          {b?.stokFisik ? formatDesimal(b.stokFisik) : '—'} {b?.kodeSatuan}
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
                          name={`baris.${i}.qtyMasuk`}
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
                      {sepakat && (
                        <TableCell className="space-y-1.5 align-top">
                          <FormField
                            control={form.control}
                            name={`baris.${i}.qtyDitolak`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    inputMode="decimal"
                                    placeholder="0"
                                    aria-label={`Ditolak ${b?.namaBarang ?? i + 1}`}
                                    {...field}
                                    value={typeof field.value === 'string' ? field.value : ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {/[1-9]/.test(
                            typeof isi?.qtyDitolak === 'string' ? isi.qtyDitolak : '',
                          ) && (
                            <>
                              <FormField
                                control={form.control}
                                name={`baris.${i}.alasanTolak`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        placeholder="Alasan (mis. sak sobek)"
                                        aria-label={`Alasan tolak ${b?.namaBarang ?? i + 1}`}
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
                                name={`baris.${i}.tindakanTolak`}
                                render={({ field }) => (
                                  <FormItem>
                                    <div
                                      className="flex gap-1"
                                      role="radiogroup"
                                      aria-label={`Tindak lanjut ${b?.namaBarang ?? i + 1}`}
                                    >
                                      {TINDAKAN_TOLAK.map((t) => (
                                        <Button
                                          key={t}
                                          type="button"
                                          size="sm"
                                          role="radio"
                                          aria-checked={field.value === t}
                                          variant={field.value === t ? 'default' : 'outline'}
                                          onClick={() => field.onChange(t)}
                                        >
                                          {LABEL_TINDAKAN_TOLAK[t]}
                                        </Button>
                                      ))}
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`baris.${i}.hargaModalMasuk`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <InputRupiah
                                  {...field}
                                  disabled={konsinyasi}
                                  aria-label={`Harga ${b?.namaBarang ?? i + 1}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(subtotalTampil(isi?.qtyMasuk, isi?.hargaModalMasuk))}
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
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={sepakat ? 5 : 4} className="text-right font-medium">
                    {konsinyasi
                      ? 'Nilai titipan (tidak menjadi hutang)'
                      : 'Total nilai barang masuk'}
                  </TableCell>
                  <TableCell className="text-right text-base font-semibold tabular-nums">
                    {formatRupiah(total)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </Card>

          {sepakat && (
            <Card data-testid="ringkasan-bayar-terima">
              <CardHeader>
                <CardTitle className="text-base">Pembayaran saat barang datang</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                  <dt>Nilai barang diterima baik</dt>
                  <dd className="text-right tabular-nums">{formatRupiah(total)}</dd>
                  <dt>Uang muka dipakai</dt>
                  <dd className="text-right tabular-nums">− {formatRupiah(umTerpakai)}</dd>
                  <dt className="font-medium">Sisa tagihan</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatRupiah(sisaTagihan)}
                  </dd>
                  <dt>Dibayar sekarang</dt>
                  <dd className="text-right tabular-nums">{formatRupiah(bayarEfektif)}</dd>
                  <dt className="font-semibold">Menjadi hutang</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {formatRupiah(Math.max(0, sisaTagihan - bayarEfektif))}
                  </dd>
                </dl>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="bayarSekarang"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Dibayar sekarang{' '}
                          <span className="font-normal text-slate-500">
                            ({wajibLunas ? 'kesepakatan: lunasi sisa tagihan' : 'boleh 0 (tempo)'})
                          </span>
                        </FormLabel>
                        <FormControl>
                          <InputRupiah
                            aria-label="Dibayar sekarang"
                            value={typeof field.value === 'number' ? field.value : bayarEfektif}
                            onChange={(v) => field.onChange(v ?? 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {kurangBayar && (
                    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      <p className="text-amber-900">
                        <b>Dibayar kurang dari kesepakatan.</b> Sisa{' '}
                        {formatRupiah(sisaTagihan - bayarEfektif)} menjadi hutang. Hanya Kepala
                        Toko/Owner yang bisa menyimpan ini; tercatat sebagai penyimpangan di order.
                      </p>
                      <FormField
                        control={form.control}
                        name="alasanKurangBayar"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alasan</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ''} maxLength={255} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="jatuhTempoKurangBayar"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jatuh tempo sisa</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                min={tanggalHariIni()}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <p className="mr-auto text-sm text-slate-500">
              Simpan menambah stok, menghitung ulang HPP, dan memperbarui harga beli terakhir.
            </p>
            <Button type="button" variant="outline" asChild>
              <Link to="/penerimaan">Batal</Link>
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || baris.fields.length === 0}
            >
              {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan penerimaan'}
            </Button>
          </div>
        </form>
      </Form>
      {dialogKeluar}
    </div>
  );
}
