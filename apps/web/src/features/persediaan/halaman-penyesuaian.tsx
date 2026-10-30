import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  JENIS_PENYESUAIAN_M1,
  kurangQty,
  skemaPenyesuaian,
  subtotalRupiah,
  type BarisBarang,
  type DataPenyesuaian,
  type DetailPenyesuaian,
  type InputPenyesuaian,
  type JenisPenyesuaianM1,
} from '@sit/shared';
import { ArrowLeft, Ban, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Path } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useDetailBarang } from '@/api/barang';
import { pesanGalat } from '@/api/client';
import { useTampilanToko } from '@/api/pengaturan';
import {
  useBatalkanPenyesuaian,
  useDetailPenyesuaian,
  useSelesaikanPenyesuaian,
  useSimpanPenyesuaian,
} from '@/api/persediaan';
import { DialogKonfirmasi } from '@/components/dialog-konfirmasi';
import { InputRupiah } from '@/components/input-rupiah';
import { PilihBarang } from '@/components/pilih-barang';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tampilkanGalatForm } from '@/lib/form';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { LABEL_JENIS_PENYESUAIAN } from '@/lib/label';
import { qtyDariIsian } from '@/lib/qty';
import { useCegahKeluar } from '@/lib/use-cegah-keluar';
import { BadgeStatusPenyesuaian } from './tab-penyesuaian';
import { SaranAlasan } from '@/components/saran-alasan';
import { SARAN_ALASAN } from '@/lib/saran-alasan';

type Info = { kode: string; nama: string; satuan: string; sistem: string; belum: string };

const PENJELASAN: Record<JenisPenyesuaianM1, string> = {
  SALDO_AWAL:
    'Stok awal saat mulai memakai sistem. Isi jumlah dan nilai per satuan; HPP dihitung rata-rata.',
  OPNAME:
    'Isi hasil hitung fisik. Selisih = fisik − stok sistem − barang terjual yang belum diambil, dihitung saat diselesaikan.',
  KOREKSI: 'Perbaikan stok langsung: + menambah, − mengurangi. Alasan wajib diisi.',
  RUSAK: 'Memindahkan barang dari stok jual ke stok rusak (tidak bisa dijual).',
  MUSNAH:
    'Mengeluarkan barang dari stok rusak karena dibuang. Nilainya menjadi kerugian toko; barang titipan yang dimusnahkan dibayar ke penitip di setoran berikutnya. Alasan wajib.',
};

/** "14.000" → "14", "2.500" → "2,5" (isian form). */
function keIsian(nilai: string | null): string {
  if (nilai === null) return '';
  return nilai.replace(/\.?0+$/, '').replace('.', ',') || '0';
}

/** Selisih bertanda: "-3.000" → "−3", "2.500" → "+2,5". */
function formatSelisih(v: string): string {
  if (!/[1-9]/.test(v)) return '0';
  return v.startsWith('-') ? `−${formatDesimal(v.slice(1))}` : `+${formatDesimal(v)}`;
}

/** Rute `/persediaan/penyesuaian/baru?jenis=…` dan `/persediaan/penyesuaian/:id`. */
export function HalamanPenyesuaian() {
  const { id } = useParams();
  const [cari] = useSearchParams();
  const idDok = id ? Number(id) : null;
  const detail = useDetailPenyesuaian(idDok);
  if (detail.error) return <p className="p-6 text-sm text-red-600">{pesanGalat(detail.error)}</p>;
  if (idDok !== null && !detail.data) return <p className="p-6 text-sm text-slate-500">Memuat…</p>;
  const d = detail.data ?? null;
  const dariUrl = cari.get('jenis') as JenisPenyesuaianM1 | null;
  const jenis: JenisPenyesuaianM1 = d
    ? d.jenis
    : dariUrl && JENIS_PENYESUAIAN_M1.includes(dariUrl)
      ? dariUrl
      : 'KOREKSI';
  if (d && d.status !== 'DRAFT') return <TampilanDokumen d={d} />;
  return <FormPenyesuaian key={d?.id ?? `baru-${jenis}`} dokumen={d} jenis={jenis} />;
}

function Judul({ d, jenis }: { d: DetailPenyesuaian | null; jenis: JenisPenyesuaianM1 }) {
  return (
    <div className="flex items-center gap-3 print:hidden">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link to="/persediaan?tab=penyesuaian" aria-label="Kembali ke daftar penyesuaian">
          <ArrowLeft />
        </Link>
      </Button>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          {LABEL_JENIS_PENYESUAIAN[jenis]} {d ? d.nomor : '(baru)'}
          {d && <BadgeStatusPenyesuaian status={d.status} />}
        </h1>
        <p className="text-sm text-slate-500">{PENJELASAN[jenis]}</p>
      </div>
    </div>
  );
}

function FormPenyesuaian({
  dokumen,
  jenis,
}: {
  dokumen: DetailPenyesuaian | null;
  jenis: JenisPenyesuaianM1;
}) {
  const navigasi = useNavigate();
  const simpan = useSimpanPenyesuaian();
  const selesaikan = useSelesaikanPenyesuaian();
  const batalkan = useBatalkanPenyesuaian();
  const toko = useTampilanToko().data;
  const [konfirmasi, setKonfirmasi] = useState<'selesai' | 'batal' | null>(null);
  const [info, setInfo] = useState<Record<number, Info>>(() =>
    Object.fromEntries(
      (dokumen?.baris ?? []).map((b) => [
        b.idBarang,
        {
          kode: b.kodeBarang,
          nama: b.namaBarang,
          satuan: b.kodeSatuan,
          sistem: b.qtySistem,
          belum: b.qtyBelumDiambil,
        },
      ]),
    ),
  );

  const form = useForm<InputPenyesuaian, unknown, DataPenyesuaian>({
    resolver: zodResolver(skemaPenyesuaian),
    defaultValues: {
      jenis,
      alasan: dokumen?.alasan ?? '',
      catatan: dokumen?.catatan ?? '',
      baris: (dokumen?.baris ?? []).map((b) => ({
        idBarang: b.idBarang,
        qtyFisik: keIsian(b.qtyFisik),
        qtySelisih:
          jenis === 'RUSAK' || jenis === 'MUSNAH'
            ? keIsian(kurangQty(0, b.qtySelisih))
            : jenis === 'KOREKSI'
              ? keIsian(b.qtySelisih)
              : '',
        hppSatuan: jenis === 'SALDO_AWAL' ? b.hppSatuan : null,
        keterangan: b.keterangan ?? '',
        dikecualikan: b.dikecualikan,
        alasanKecuali: b.alasanKecuali ?? '',
      })),
    },
  });
  const baris = useFieldArray({ control: form.control, name: 'baris' });
  const isi = useWatch({ control: form.control, name: 'baris' }) ?? [];
  const { lewati, dialog: dialogKeluar } = useCegahKeluar(form.formState.isDirty);

  // `?barang=<id>` (dari tab Stok rusak): dokumen baru langsung berisi barang itu.
  const [url] = useSearchParams();
  const idAwal = dokumen ? null : Number(url.get('barang')) || null;
  const awal = useDetailBarang(idAwal);
  const sudahAwal = useRef(false);

  /** Hapus baris dengan kesempatan mengurungkan (salah pencet tidak menghilangkan isian). */
  function hapusBaris(i: number) {
    const nilai = form.getValues(`baris.${i}`);
    const nama = info[nilai.idBarang]?.nama ?? `baris ${i + 1}`;
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

  function tambah(b: BarisBarang) {
    const ada = isi.findIndex((x) => x.idBarang === b.id);
    if (ada >= 0) {
      toast.info(`${b.namaBarang} sudah ada di baris ${ada + 1}.`);
      return;
    }
    setInfo((lama) => ({
      ...lama,
      [b.id]: {
        kode: b.kode,
        nama: b.namaBarang,
        satuan: b.kodeSatuan,
        sistem: jenis === 'MUSNAH' ? b.stokRusak : b.stokFisik,
        belum: '0.000',
      },
    }));
    baris.append({
      idBarang: b.id,
      qtyFisik: '',
      qtySelisih: '',
      hppSatuan:
        jenis === 'SALDO_AWAL'
          ? b.kepemilikan === 'KONSINYASI'
            ? (b.hargaTitip ?? 0)
            : (b.hppRata2 ?? 0)
          : null,
      keterangan: '',
      dikecualikan: false,
      alasanKecuali: '',
    });
  }

  useEffect(() => {
    if (!awal.data || sudahAwal.current) return;
    sudahAwal.current = true;
    tambah(awal.data);
    // Pemusnahan: usulkan seluruh stok rusak; tetap bisa diubah.
    if (jenis === 'MUSNAH') {
      form.setValue('baris.0.qtySelisih', keIsian(awal.data.stokRusak), { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup sekali saat data barang tiba
  }, [awal.data]);

  // K-069: barang yang sudah tersimpan di dokumen OPNAME tidak dihapus, tetapi dikecualikan dengan alasan.
  const tersimpan = new Set(
    jenis === 'OPNAME' ? (dokumen?.baris ?? []).map((b) => b.idBarang) : [],
  );
  const [kecualikan, setKecualikan] = useState<number | null>(null);

  function terapkanKecuali(i: number, alasan: string) {
    form.setValue(`baris.${i}.dikecualikan`, true, { shouldDirty: true });
    form.setValue(`baris.${i}.alasanKecuali`, alasan, { shouldDirty: true });
    form.setValue(`baris.${i}.qtyFisik`, '', { shouldDirty: true });
  }

  function sertakanLagi(i: number) {
    form.setValue(`baris.${i}.dikecualikan`, false, { shouldDirty: true });
    form.setValue(`baris.${i}.alasanKecuali`, '', { shouldDirty: true });
  }

  const jumlahKecuali = isi.filter((b) => b.dikecualikan).length;
  const jumlahTerisi = isi.filter((b) => !b.dikecualikan && qtyDariIsian(b.qtyFisik)).length;

  async function simpanDraf(data: DataPenyesuaian): Promise<DetailPenyesuaian | null> {
    try {
      return await simpan.mutateAsync({ id: dokumen?.id, json: data });
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'alasan',
        'baris',
        ...isi.flatMap((_, i) =>
          (['idBarang', 'qtyFisik', 'qtySelisih', 'hppSatuan'] as const).map(
            (k) => `baris.${i}.${k}` as Path<InputPenyesuaian>,
          ),
        ),
      ]);
      return null;
    }
  }

  async function kirimDraf(data: DataPenyesuaian) {
    const hasil = await simpanDraf(data);
    if (!hasil) return;
    toast.success(`Draf ${hasil.nomor} disimpan.`);
    if (!dokumen) {
      lewati();
      void navigasi(`/persediaan/penyesuaian/${hasil.id}`, { replace: true });
    } else form.reset(form.getValues());
  }

  async function kirimSelesai() {
    const valid = await form.trigger();
    if (!valid) return;
    const data = skemaPenyesuaian.parse(form.getValues());
    const hasil = await simpanDraf(data);
    if (!hasil) return;
    try {
      const akhir = await selesaikan.mutateAsync(hasil.id);
      toast.success(`${akhir.nomor} selesai; stok diperbarui.`);
      lewati();
      void navigasi(`/persediaan/penyesuaian/${akhir.id}`, { replace: true });
    } catch (err) {
      toast.error(pesanGalat(err));
      if (!dokumen) {
        lewati();
        void navigasi(`/persediaan/penyesuaian/${hasil.id}`, { replace: true });
      }
    }
  }

  const kolomQty =
    jenis === 'OPNAME'
      ? 'Fisik dihitung'
      : jenis === 'SALDO_AWAL'
        ? 'Jumlah awal'
        : jenis === 'RUSAK'
          ? 'Qty rusak'
          : jenis === 'MUSNAH'
            ? 'Qty dimusnahkan'
            : 'Selisih (+/−)';
  const namaQty = jenis === 'OPNAME' || jenis === 'SALDO_AWAL' ? 'qtyFisik' : 'qtySelisih';
  const totalSaldoAwal =
    jenis === 'SALDO_AWAL'
      ? isi.reduce((t, b) => {
          const q = qtyDariIsian(b.qtyFisik);
          return t + (q && typeof b.hppSatuan === 'number' ? subtotalRupiah(q, b.hppSatuan) : 0);
        }, 0)
      : 0;

  return (
    <div className="space-y-4 p-6">
      <Judul d={dokumen} jenis={jenis} />

      {/* Lembar hitung opname untuk dicetak. */}
      {jenis === 'OPNAME' && dokumen && (
        <div className="hidden text-sm print:block">
          <div className="mb-3 flex justify-between border-b pb-2">
            <div>
              <div className="text-base font-bold">{toko?.namaToko}</div>
              <div>Lembar hitung stok opname {dokumen.nomor}</div>
            </div>
            <div className="text-right">Dicetak {formatWaktu(new Date().toISOString())}</div>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b">
                {[
                  'No',
                  'Kode',
                  'Nama barang',
                  'Satuan',
                  'Sistem',
                  'Belum diambil',
                  'Fisik dihitung',
                  'Catatan',
                ].map((h) => (
                  <th key={h} className="border px-1 py-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dokumen.baris.map((b, i) => (
                <tr key={b.id}>
                  <td className="border px-1 py-1.5">{i + 1}</td>
                  <td className="border px-1 font-mono">{b.kodeBarang}</td>
                  <td className="border px-1">{b.namaBarang}</td>
                  <td className="border px-1">{b.kodeSatuan}</td>
                  <td className="border px-1 text-right">{formatDesimal(b.qtySistem)}</td>
                  <td className="border px-1 text-right">{formatDesimal(b.qtyBelumDiambil)}</td>
                  {b.dikecualikan ? (
                    <td colSpan={2} className="border px-1 italic">
                      Dikecualikan: {b.alasanKecuali}
                    </td>
                  ) : (
                    <>
                      <td className="w-24 border px-1" />
                      <td className="w-32 border px-1" />
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(kirimDraf)(e)}
          className="space-y-4 print:hidden"
          noValidate
        >
          <Card>
            <CardContent className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="alasan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Alasan{jenis === 'KOREKSI' || jenis === 'MUSNAH' ? '' : ' (opsional)'}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    {jenis === 'KOREKSI' && (
                      <SaranAlasan saran={SARAN_ALASAN.koreksiStok} onPilih={field.onChange} />
                    )}
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
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <div className="border-b p-4">
              <PilihBarang
                onPilih={tambah}
                hanyaRusak={jenis === 'MUSNAH'}
                placeholder={
                  jenis === 'MUSNAH'
                    ? 'Cari barang yang punya stok rusak (nama, kode, barcode, atribut)…'
                    : undefined
                }
              />
              {jenis === 'OPNAME' && baris.fields.length > 0 && (
                <p className="mt-2 text-xs text-slate-500" data-testid="ringkasan-opname">
                  {baris.fields.length} barang · {jumlahTerisi} sudah diisi · {jumlahKecuali}{' '}
                  dikecualikan · {baris.fields.length - jumlahTerisi - jumlahKecuali} belum diisi.
                  Barang di lembar tidak bisa dihapus; kecualikan dengan alasan bila tidak dihitung.
                </p>
              )}
              {form.formState.errors.baris?.message && (
                <p className="mt-2 text-sm text-red-600">{form.formState.errors.baris.message}</p>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">
                    {jenis === 'MUSNAH' ? 'Stok rusak' : 'Stok sistem'}
                  </TableHead>
                  {jenis === 'OPNAME' && (
                    <TableHead className="text-right">Belum diambil</TableHead>
                  )}
                  <TableHead className="w-40">{kolomQty}</TableHead>
                  {jenis === 'OPNAME' && <TableHead className="text-right">Selisih</TableHead>}
                  {jenis === 'SALDO_AWAL' && <TableHead className="w-44">Nilai / satuan</TableHead>}
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.fields.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">
                      Belum ada barang. Cari barang di atas untuk menambah baris.
                    </TableCell>
                  </TableRow>
                )}
                {baris.fields.map((f, i) => {
                  const inf = info[f.idBarang];
                  const dikecualikan = isi[i]?.dikecualikan === true;
                  const fisik = dikecualikan ? null : qtyDariIsian(isi[i]?.qtyFisik);
                  const selisih =
                    fisik && inf ? kurangQty(kurangQty(fisik, inf.sistem), inf.belum) : null;
                  return (
                    <TableRow
                      key={f.id}
                      className={dikecualikan ? 'bg-slate-50 text-slate-400' : ''}
                    >
                      <TableCell className="text-slate-500">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{inf?.nama}</div>
                        <div className="font-mono text-xs text-slate-500">{inf?.kode}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inf ? formatDesimal(inf.sistem) : '—'} {inf?.satuan}
                      </TableCell>
                      {jenis === 'OPNAME' && (
                        <TableCell className="text-right tabular-nums">
                          {inf ? formatDesimal(inf.belum) : '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        {dikecualikan ? (
                          <div className="text-xs">
                            <Badge variant="outline" className="border-slate-300 text-slate-600">
                              Dikecualikan
                            </Badge>
                            <div className="mt-1 text-slate-600">{isi[i]?.alasanKecuali}</div>
                          </div>
                        ) : (
                          <FormField
                            control={form.control}
                            name={`baris.${i}.${namaQty}`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    inputMode="decimal"
                                    aria-label={`${kolomQty} ${inf?.nama ?? i + 1}`}
                                    {...field}
                                    value={typeof field.value === 'string' ? field.value : ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </TableCell>
                      {jenis === 'OPNAME' && (
                        <TableCell
                          className={`text-right tabular-nums ${selisih?.startsWith('-') ? 'text-red-600' : selisih && /[1-9]/.test(selisih) ? 'text-emerald-700' : ''}`}
                        >
                          {selisih === null ? '—' : formatSelisih(selisih)}
                        </TableCell>
                      )}
                      {jenis === 'SALDO_AWAL' && (
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`baris.${i}.hppSatuan`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <InputRupiah
                                    {...field}
                                    aria-label={`Nilai ${inf?.nama ?? i + 1}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`baris.${i}.keterangan`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  aria-label={`Keterangan ${inf?.nama ?? i + 1}`}
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        {!tersimpan.has(f.idBarang) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Hapus baris ${i + 1}`}
                            onClick={() => hapusBaris(i)}
                          >
                            <Trash2 className="text-slate-500" />
                          </Button>
                        ) : dikecualikan ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Sertakan lagi ${inf?.nama ?? i + 1}`}
                            title="Sertakan lagi"
                            onClick={() => sertakanLagi(i)}
                          >
                            <RotateCcw className="text-slate-500" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Kecualikan ${inf?.nama ?? i + 1}`}
                            title="Kecualikan dari opname"
                            onClick={() => setKecualikan(i)}
                          >
                            <Ban className="text-slate-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {jenis === 'SALDO_AWAL' && (
              <div className="border-t p-3 text-right text-sm">
                Perkiraan nilai stok awal:{' '}
                <span className="font-semibold">{formatRupiah(totalSaldoAwal)}</span>
              </div>
            )}
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {jenis === 'OPNAME' && dokumen && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                onClick={() => window.print()}
              >
                <Printer /> Cetak lembar hitung
              </Button>
            )}
            {dokumen && (
              <Button type="button" variant="ghost" onClick={() => setKonfirmasi('batal')}>
                Batalkan draf
              </Button>
            )}
            <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
              Simpan draf
            </Button>
            <Button
              type="button"
              disabled={baris.fields.length === 0 || simpan.isPending || selesaikan.isPending}
              onClick={() => setKonfirmasi('selesai')}
            >
              {selesaikan.isPending ? 'Menyelesaikan…' : 'Simpan & selesaikan'}
            </Button>
          </div>
        </form>
      </Form>
      {dialogKeluar}
      {kecualikan !== null && (
        <DialogKecualikan
          nama={info[isi[kecualikan]?.idBarang ?? 0]?.nama ?? ''}
          onTutup={() => setKecualikan(null)}
          onSimpan={(alasan) => {
            terapkanKecuali(kecualikan, alasan);
            setKecualikan(null);
          }}
        />
      )}

      <DialogKonfirmasi
        terbuka={konfirmasi === 'selesai'}
        onTutup={() => setKonfirmasi(null)}
        judul="Selesaikan penyesuaian?"
        pesan="Stok akan diperbarui sesuai dokumen ini dan tidak bisa dibatalkan. Kesalahan diperbaiki dengan penyesuaian baru."
        labelKonfirmasi="Selesaikan"
        onKonfirmasi={kirimSelesai}
      />
      <DialogKonfirmasi
        terbuka={konfirmasi === 'batal'}
        onTutup={() => setKonfirmasi(null)}
        bahaya
        judul={`Batalkan draf ${dokumen?.nomor ?? ''}?`}
        pesan="Draf yang dibatalkan tidak mengubah stok dan tidak bisa dipakai lagi."
        labelKonfirmasi="Batalkan draf"
        onKonfirmasi={async () => {
          if (!dokumen) return;
          try {
            await batalkan.mutateAsync(dokumen.id);
            toast.success(`Draf ${dokumen.nomor} dibatalkan.`);
          } catch (err) {
            toast.error(pesanGalat(err));
          }
        }}
      />
    </div>
  );
}

/** Dokumen SELESAI/BATAL: hanya baca. */
function TampilanDokumen({ d }: { d: DetailPenyesuaian }) {
  const jenis = d.jenis;
  return (
    <div className="space-y-4 p-6">
      <Judul d={d} jenis={jenis} />
      <Card className="gap-0 py-0">
        <div className="grid grid-cols-4 gap-4 border-b p-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">Dibuat</div>
            {formatWaktu(d.tanggal)} · {d.namaPengguna}
          </div>
          <div>
            <div className="text-xs text-slate-500">Diselesaikan</div>
            {d.waktuSelesai ? formatWaktu(d.waktuSelesai) : '—'}
          </div>
          <div>
            <div className="text-xs text-slate-500">Alasan</div>
            {d.alasan ?? '—'}
          </div>
          <div>
            <div className="text-xs text-slate-500">Catatan</div>
            {d.catatan ?? '—'}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barang</TableHead>
              <TableHead className="text-right">
                {jenis === 'MUSNAH' ? 'Stok rusak' : 'Stok sistem'}
              </TableHead>
              {jenis === 'OPNAME' && <TableHead className="text-right">Belum diambil</TableHead>}
              {(jenis === 'OPNAME' || jenis === 'SALDO_AWAL') && (
                <TableHead className="text-right">
                  {jenis === 'OPNAME' ? 'Fisik' : 'Jumlah awal'}
                </TableHead>
              )}
              <TableHead className="text-right">Selisih</TableHead>
              <TableHead className="text-right">Nilai / satuan</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.baris.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.namaBarang}</div>
                  <div className="font-mono text-xs text-slate-500">{b.kodeBarang}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDesimal(b.qtySistem)} {b.kodeSatuan}
                </TableCell>
                {jenis === 'OPNAME' && (
                  <TableCell className="text-right tabular-nums">
                    {formatDesimal(b.qtyBelumDiambil)}
                  </TableCell>
                )}
                {(jenis === 'OPNAME' || jenis === 'SALDO_AWAL') && (
                  <TableCell className="text-right tabular-nums">
                    {b.qtyFisik === null ? '—' : formatDesimal(b.qtyFisik)}
                  </TableCell>
                )}
                <TableCell
                  className={`text-right tabular-nums ${b.qtySelisih.startsWith('-') ? 'text-red-600' : 'text-emerald-700'}`}
                >
                  {b.dikecualikan ? '—' : formatSelisih(b.qtySelisih)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.dikecualikan ? '—' : formatRupiah(b.hppSatuan)}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {b.dikecualikan ? (
                    <div>
                      <Badge variant="outline" className="border-slate-300 text-slate-600">
                        Dikecualikan
                      </Badge>{' '}
                      {b.alasanKecuali}
                      <div className="text-slate-400">
                        oleh {b.namaPenggunaKecuali} · {formatWaktu(b.waktuKecuali)}
                      </div>
                    </div>
                  ) : (
                    (b.keterangan ?? '—')
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/** K-069: alasan wajib saat mengecualikan barang dari opname. */
function DialogKecualikan({
  nama,
  onTutup,
  onSimpan,
}: {
  nama: string;
  onTutup: () => void;
  onSimpan: (alasan: string) => void;
}) {
  const [alasan, setAlasan] = useState('');
  const valid = alasan.trim().length >= 3;
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kecualikan {nama} dari opname?</DialogTitle>
          <DialogDescription>
            Barang tetap tercatat di dokumen sebagai &quot;dikecualikan&quot; beserta alasan, nama
            Anda, dan waktunya. Stoknya tidak diubah oleh opname ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="alasan-kecuali" className="text-sm font-medium">
            Alasan
          </label>
          <Input
            id="alasan-kecuali"
            value={alasan}
            maxLength={150}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: gudang belakang terkunci"
            autoFocus
          />
          <SaranAlasan saran={SARAN_ALASAN.kecualiOpname} onPilih={setAlasan} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button disabled={!valid} onClick={() => onSimpan(alasan.trim())}>
            Kecualikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
