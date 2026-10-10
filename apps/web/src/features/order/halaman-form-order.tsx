import { zodResolver } from '@hookform/resolvers/zod';
import {
  bandingQty,
  kunciBaris,
  kurangQty,
  tambahQty,
  formatRupiah,
  skemaOrder,
  subtotalRupiah,
  POLA_QTY,
  type BarisBarang,
  type DataOrder,
  type DetailOrder,
  type InputOrder,
  type OpsiSatuanBaris,
  type InputPratinjauOrder,
} from '@sit/shared';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type Path } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { GalatApi } from '@/api/client';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { useDetailOrder, useKirimOrder, usePratinjauOrder, useSimpanOrder } from '@/api/penjualan';
import { DialogKonfirmasi } from '@/components/dialog-konfirmasi';
import { InfoPromo } from '@/components/info-promo';
import { InfoTierBelanja } from '@/components/info-tier-belanja';
import { InputRupiah } from '@/components/input-rupiah';
import { PilihBarang } from '@/components/pilih-barang';
import { PeringatanPiutang } from '@/components/peringatan-piutang';
import { PilihPelanggan } from '@/components/pilih-pelanggan';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tampilkanGalatForm } from '@/lib/form';
import { formatDesimal } from '@/lib/format';
import { useCegahKeluar } from '@/lib/use-cegah-keluar';
import { opsiDariBarang, qtySah, rapikanQty, satuanAwal } from '../pos/model';

/** Info tampilan per barang di form (bukan bagian data yang dikirim). */
type InfoBarang = {
  kode: string;
  nama: string;
  /** Satuan dasar (stok). */
  satuan: string;
  stokTersedia: string;
  /** Pilihan satuan baris dengan harga per tier (K-091). */
  opsiSatuan: OpsiSatuanBaris[];
};

function teksQty(v: unknown): string | null {
  const t = typeof v === 'string' ? v.trim().replace(',', '.') : '';
  return POLA_QTY.test(t) ? t : null;
}

/** Order penjualan: buat (`/order/baru`) atau ubah (`/order/:id/ubah`). */
export function HalamanFormOrder() {
  const { id } = useParams();
  const idOrder = id ? Number(id) : null;
  const detail = useDetailOrder(idOrder);
  if (idOrder !== null && !detail.data) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <FormOrder key={detail.data?.id ?? 'baru'} dokumen={detail.data ?? null} />;
}

/** Qty ±1 dari isian teks (koma boleh); isian tidak sah dianggap 0, hasil di bawah 1 tidak diterapkan. */
function qtyGeser(nilai: unknown, arah: 1 | -1): string {
  const teks = typeof nilai === 'string' ? nilai.replace(',', '.') : '';
  const dasar = qtySah(teks) ? teks : '0';
  const q = arah === 1 ? tambahQty(dasar, 1) : kurangQty(dasar, 1);
  return bandingQty(q, 0) > 0 ? rapikanQty(q) : typeof nilai === 'string' ? nilai : '1';
}

function FormOrder({ dokumen }: { dokumen: DetailOrder | null }) {
  const navigasi = useNavigate();
  const pengguna = usePengguna();
  const bolehManual = pengguna.izin.includes('penjualan.harga_manual');
  const bolehDiskon = pengguna.izin.includes('penjualan.diskon');
  const bolehLepasPromo = pengguna.izin.includes('penjualan.checkout');
  const simpan = useSimpanOrder();
  const kirimAntrean = useKirimOrder();
  const tierAktif = (useDaftarTingkatHarga().data ?? []).filter((t) => t.statusAktif === 'AKTIF');
  const tierDefault = tierAktif.find((t) => t.isDefault)?.id ?? null;
  const [pelanggan, setPelanggan] = useState<{
    id: number;
    nama: string;
    alamat: string | null;
  } | null>(
    dokumen?.idPelanggan
      ? {
          id: dokumen.idPelanggan,
          nama: dokumen.namaPelanggan ?? '',
          alamat: dokumen.alamatKirim,
        }
      : null,
  );
  const [info, setInfo] = useState<Record<number, InfoBarang>>(() =>
    Object.fromEntries(
      (dokumen?.baris ?? []).map((b) => [
        b.idBarang,
        {
          kode: b.kodeBarang,
          nama: b.namaBarang,
          satuan: b.kodeSatuanDasar,
          stokTersedia: b.stokTersedia,
          opsiSatuan: b.opsiSatuan,
        },
      ]),
    ),
  );
  const [persenTransaksi, setPersenTransaksi] = useState(false);
  const [konfirmasiModal, setKonfirmasiModal] = useState<{
    data: DataOrder;
    kirim: boolean;
  } | null>(null);

  const form = useForm<InputOrder, unknown, DataOrder>({
    resolver: zodResolver(skemaOrder),
    defaultValues: {
      jenisPenjualan: dokumen?.jenisPenjualan ?? 'LANGSUNG',
      idPelanggan: dokumen?.idPelanggan ?? null,
      namaPembeli: dokumen?.namaPembeli ?? '',
      prioritas: dokumen?.prioritas ?? 'NORMAL',
      alamatKirim: dokumen?.alamatKirim ?? '',
      catatanKirim: dokumen?.catatanKirim ?? '',
      ongkir: dokumen?.ongkir ?? 0,
      diskonTransaksi: dokumen?.diskonTransaksi ?? 0,
      diskonTransaksiPersen: null,
      catatan: dokumen?.catatan ?? '',
      setujuDiBawahModal: false,
      baris: (dokumen?.baris ?? []).map((b) => ({
        idBarang: b.idBarang,
        idSatuanJual: b.idSatuanJual,
        qty: b.qty.includes('.') ? b.qty.replace(/\.?0+$/, '') : b.qty,
        hargaManual: b.hargaManual,
        hargaSatuan: b.hargaManual ? b.hargaSatuan : null,
        diskonBaris: b.diskonBaris,
        diskonBarisPersen: null,
        catatanItem: b.catatanItem ?? '',
        tanpaPromo: b.promoNonaktif,
      })),
    },
  });
  const baris = useFieldArray({ control: form.control, name: 'baris' });
  const [jenis, isi, ongkir, diskonTransaksi, diskonPersen, idPelanggan] = useWatch({
    control: form.control,
    name: [
      'jenisPenjualan',
      'baris',
      'ongkir',
      'diskonTransaksi',
      'diskonTransaksiPersen',
      'idPelanggan',
    ],
  });
  const { lewati, dialog: dialogKeluar } = useCegahKeluar(form.formState.isDirty);
  const antar = jenis === 'PENGANTARAN';
  // K-098: harga awal tier dasar; tier lain dipakai otomatis menurut total nilai belanja (API).
  const tierBawaan = tierDefault;
  const dapatDiubahPembuat = !dokumen || dokumen.status === 'DRAFT';

  function hargaBaris(i: number): number | null {
    const b = isi?.[i];
    if (!b) return null;
    if (b.hargaManual) return typeof b.hargaSatuan === 'number' ? b.hargaSatuan : null;
    const lama = dokumen?.baris.find(
      (x) => x.idBarang === b.idBarang && x.idSatuanJual === (b.idSatuanJual ?? null),
    );
    // Perkiraan sebelum pratinjau API tiba; tier selalu ditentukan API menurut nilai belanja (K-098).
    const idTier = lama?.idTingkatHarga ?? tierBawaan;
    const idSj = b.idSatuanJual ?? null;
    if (lama && !lama.hargaManual && lama.idTingkatHarga === idTier && lama.idSatuanJual === idSj)
      return lama.hargaSatuan;
    return hargaTierBaris(i).find((h) => h.idTingkatHarga === idTier)?.hargaJual ?? null;
  }

  /** Harga per tier untuk satuan baris i (K-091). */
  function hargaTierBaris(i: number) {
    const b = isi?.[i];
    if (!b) return [];
    const opsi = info[b.idBarang]?.opsiSatuan ?? [];
    return opsi.find((o) => o.idSatuanJual === (b.idSatuanJual ?? null))?.hargaTier ?? [];
  }

  function subtotalBaris(i: number): number {
    const q = teksQty(isi?.[i]?.qty);
    const h = hargaBaris(i);
    if (!q || h === null) return 0;
    const diskon = typeof isi?.[i]?.diskonBaris === 'number' ? isi[i].diskonBaris : 0;
    return Math.max(0, subtotalRupiah(q, h) - diskon);
  }

  const subtotal = (isi ?? []).reduce((t, _, i) => t + subtotalBaris(i), 0);
  const diskonT = persenTransaksi
    ? Math.round((subtotal * Number(diskonPersen ?? 0)) / 100)
    : typeof diskonTransaksi === 'number'
      ? diskonTransaksi
      : 0;
  const totalPerkiraan = subtotal - diskonT + (typeof ongkir === 'number' ? ongkir : 0);

  // PR5: harga, promo, diskon, saran tier, dan total dari API setiap isi berubah (bila qty sudah sah).
  const semuaQtySah = (isi ?? []).length > 0 && (isi ?? []).every((b) => teksQty(b.qty) !== null);
  const isianPratinjau: InputPratinjauOrder | null = semuaQtySah
    ? {
        idOrder: dokumen?.id ?? null,
        order: {
          jenisPenjualan: jenis ?? 'LANGSUNG',
          idPelanggan: typeof idPelanggan === 'number' ? idPelanggan : null,
          ongkir: typeof ongkir === 'number' ? ongkir : 0,
          diskonTransaksi: persenTransaksi
            ? 0
            : typeof diskonTransaksi === 'number'
              ? diskonTransaksi
              : 0,
          diskonTransaksiPersen: persenTransaksi ? (diskonPersen ?? null) : null,
          baris: (isi ?? []).map((b) => ({
            idBarang: b.idBarang,
            idSatuanJual: b.idSatuanJual ?? null,
            qty: teksQty(b.qty) ?? '0',
            hargaManual: b.hargaManual === true,
            hargaSatuan: b.hargaManual && typeof b.hargaSatuan === 'number' ? b.hargaSatuan : null,
            diskonBaris: typeof b.diskonBaris === 'number' ? b.diskonBaris : 0,
            tanpaPromo: b.tanpaPromo === true,
          })),
        },
      }
    : null;
  const pratinjau = usePratinjauOrder(isianPratinjau);
  const pratinjauBaris = new Map(
    (pratinjau.data?.baris ?? []).map((b) => [kunciBaris(b.idBarang, b.idSatuanJual), b]),
  );
  const hasil = pratinjau.segar ? pratinjau.data : undefined;
  const namaTier = (id: number) => tierAktif.find((t) => t.id === id)?.nama ?? 'tier lain';

  function tambah(b: BarisBarang) {
    const satuan = satuanAwal(b);
    const ada = (isi ?? []).findIndex(
      (x) => x.idBarang === b.id && (x.idSatuanJual ?? null) === satuan,
    );
    if (ada >= 0) {
      toast.info(`${b.namaBarang} sudah ada di baris ${ada + 1}.`);
      form.setFocus(`baris.${ada}.qty`);
      return;
    }
    setInfo((lama) => ({
      ...lama,
      [b.id]: {
        kode: b.kode,
        nama: b.namaBarang,
        satuan: b.kodeSatuan,
        stokTersedia: b.stokTersedia,
        opsiSatuan: opsiDariBarang(b),
      },
    }));
    baris.append({
      idBarang: b.id,
      idSatuanJual: satuan,
      qty: '1',
      hargaManual: false,
      hargaSatuan: null,
      diskonBaris: 0,
      diskonBarisPersen: null,
      catatanItem: '',
      tanpaPromo: false,
    });
    setTimeout(() => form.setFocus(`baris.${baris.fields.length}.qty`), 0);
  }

  function hapusBaris(i: number) {
    const nilai = form.getValues(`baris.${i}`);
    const nama = info[nilai.idBarang]?.nama ?? `baris ${i + 1}`;
    baris.remove(i);
    toast(`${nama} dihapus dari order.`, {
      duration: 8000,
      action: {
        label: 'Urungkan',
        onClick: () => {
          const kini = form.getValues('baris');
          if (
            kini.some((b) => b.idBarang === nilai.idBarang && b.idSatuanJual === nilai.idSatuanJual)
          )
            return;
          baris.insert(Math.min(i, kini.length), nilai);
        },
      },
    });
  }

  function pilihPelanggan(p: Parameters<Parameters<typeof PilihPelanggan>[0]['onPilih']>[0]) {
    setPelanggan(p ? { id: p.id, nama: p.namaPelanggan, alamat: p.alamat } : null);
    form.setValue('idPelanggan', p?.id ?? null, { shouldDirty: true, shouldValidate: true });
    if (p?.alamat && !form.getValues('alamatKirim')) {
      form.setValue('alamatKirim', p.alamat, { shouldDirty: true });
    }
  }

  async function kirimData(data: DataOrder, kirim: boolean) {
    const json: DataOrder = persenTransaksi
      ? { ...data, diskonTransaksi: 0 }
      : { ...data, diskonTransaksiPersen: null };
    try {
      let hasil = await simpan.mutateAsync({ id: dokumen?.id, json, kirim });
      // Draf lama: simpan dulu, lalu kirim ke antrean lewat aksi terpisah.
      if (dokumen && kirim && hasil.status === 'DRAFT') {
        hasil = await kirimAntrean.mutateAsync(dokumen.id);
      }
      toast.success(
        hasil.status === 'MENUNGGU'
          ? `Order ${hasil.nomor} masuk antrean kasir.`
          : `Order ${hasil.nomor} disimpan.`,
      );
      lewati();
      void navigasi(`/order?id=${hasil.id}`);
    } catch (err) {
      if (
        err instanceof GalatApi &&
        err.kode === 'KONFLIK' &&
        err.message.includes('di bawah modal')
      ) {
        setKonfirmasiModal({ data: { ...json, setujuDiBawahModal: true }, kirim });
        return;
      }
      tampilkanGalatForm(err, form.setError, [
        'idPelanggan',
        'alamatKirim',
        'diskonTransaksi',
        'baris',
        ...(isi ?? []).flatMap((_, i) =>
          (['idBarang', 'qty', 'idTingkatHarga', 'hargaSatuan', 'diskonBaris'] as const).map(
            (k) => `baris.${i}.${k}` as Path<InputOrder>,
          ),
        ),
      ]);
    }
  }

  const sedangKirim = simpan.isPending || kirimAntrean.isPending;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={dokumen ? `/order?id=${dokumen.id}` : '/order'} aria-label="Kembali ke antrean">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {dokumen ? `Ubah order ${dokumen.nomor}` : 'Buat order baru'}
          </h1>
          <p className="text-sm text-slate-500">
            Harga mengikuti total belanja (tier harga dipakai otomatis saat syaratnya tercapai) dan
            promo yang berlaku. Barang ditahan (stok tersedia berkurang) setelah order masuk
            antrean.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit((d) => kirimData(d, true))(e)}
          className="space-y-4"
          noValidate
        >
          <Card>
            <CardContent className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="jenisPenjualan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis penjualan</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LANGSUNG">Langsung (ambil di toko)</SelectItem>
                        <SelectItem value="PENGANTARAN">Pengantaran</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="idPelanggan"
                render={() => (
                  <FormItem className="col-span-2">
                    <FormLabel>Pelanggan{antar ? '' : ' (opsional)'}</FormLabel>
                    <PilihPelanggan
                      terpilih={pelanggan}
                      onPilih={pilihPelanggan}
                      label="Cari pelanggan"
                    />
                    <PeringatanPiutang idPelanggan={pelanggan?.id ?? null} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prioritas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioritas</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="TINGGI">Tinggi</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {!antar && !pelanggan && (
                <FormField
                  control={form.control}
                  name="namaPembeli"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nama pembeli (opsional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Mis. Tukang (Bp. Joko)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {antar && (
                <>
                  <FormField
                    control={form.control}
                    name="alamatKirim"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Alamat kirim</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="catatanKirim"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catatan kirim</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ongkir"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ongkos kirim</FormLabel>
                        <FormControl>
                          <InputRupiah {...field} aria-label="Ongkos kirim" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={form.control}
                name="catatan"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <div className="border-b p-4">
              <PilihBarang onPilih={tambah} />
              {form.formState.errors.baris?.message && (
                <p className="mt-2 text-sm text-red-600">{form.formState.errors.baris.message}</p>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Tersedia</TableHead>
                  <TableHead className="w-28">Qty</TableHead>
                  <TableHead className="w-56">Harga</TableHead>
                  {bolehDiskon && <TableHead className="w-36">Diskon</TableHead>}
                  <TableHead className="text-right">Subtotal</TableHead>
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
                  const manual = isi?.[i]?.hargaManual === true;
                  const pr = pratinjauBaris.get(kunciBaris(f.idBarang, isi?.[i]?.idSatuanJual));
                  const harga = pr?.hargaSatuan ?? hargaBaris(i);
                  const tanpaPromo = isi?.[i]?.tanpaPromo === true;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="text-slate-500">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{inf?.nama}</div>
                        <div className="font-mono text-xs text-slate-500">{inf?.kode}</div>
                        <InfoPromo
                          p={pr}
                          className="mt-0.5"
                          aksi={
                            bolehLepasPromo && (pr?.idPromo != null || tanpaPromo) ? (
                              <button
                                type="button"
                                className="text-blue-700 underline"
                                onClick={() =>
                                  form.setValue(`baris.${i}.tanpaPromo`, !tanpaPromo, {
                                    shouldDirty: true,
                                  })
                                }
                              >
                                {tanpaPromo ? 'Pasang lagi' : 'Lepas promo'}
                              </button>
                            ) : null
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {inf ? formatDesimal(inf.stokTersedia) : '—'} {inf?.satuan}
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`baris.${i}.qty`}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Kurangi 1 ${inf?.nama ?? i + 1}`}
                                  onClick={() => field.onChange(qtyGeser(field.value, -1))}
                                >
                                  <Minus />
                                </Button>
                                <FormControl>
                                  <Input
                                    inputMode="decimal"
                                    aria-label={`Qty ${inf?.nama ?? i + 1}`}
                                    {...field}
                                    value={typeof field.value === 'string' ? field.value : ''}
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Tambah 1 ${inf?.nama ?? i + 1}`}
                                  onClick={() => field.onChange(qtyGeser(field.value, 1))}
                                >
                                  <Plus />
                                </Button>
                                {(inf?.opsiSatuan.length ?? 0) > 1 ? (
                                  <select
                                    aria-label={`Satuan ${inf?.nama ?? i + 1}`}
                                    className="h-9 rounded-md border border-slate-300 bg-white px-1 text-sm"
                                    value={String(isi?.[i]?.idSatuanJual ?? '')}
                                    onChange={(e) =>
                                      form.setValue(
                                        `baris.${i}.idSatuanJual`,
                                        e.target.value ? Number(e.target.value) : null,
                                        { shouldDirty: true },
                                      )
                                    }
                                  >
                                    {inf?.opsiSatuan.map((o) => (
                                      <option
                                        key={o.idSatuanJual ?? 0}
                                        value={o.idSatuanJual ?? ''}
                                      >
                                        {o.kodeSatuan}
                                        {o.idSatuanJual !== null
                                          ? ` (isi ${formatDesimal(o.faktor)} ${inf?.satuan ?? ''})`
                                          : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-xs text-slate-500">{inf?.satuan}</span>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        {manual ? (
                          <FormField
                            control={form.control}
                            name={`baris.${i}.hargaSatuan`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <InputRupiah
                                    {...field}
                                    aria-label={`Harga manual ${inf?.nama ?? i + 1}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          // K-099: tier selalu otomatis (total belanja); hanya ditampilkan.
                          <div className="text-sm tabular-nums">
                            {harga === null ? (
                              <span className="text-slate-500">Harga belum ada</span>
                            ) : (
                              formatRupiah(harga)
                            )}
                            {pr?.idTingkatHarga != null && pr.idTingkatHarga !== tierBawaan && (
                              <div className="text-xs text-blue-700">
                                harga {namaTier(pr.idTingkatHarga)}
                              </div>
                            )}
                          </div>
                        )}
                        {bolehManual && (
                          <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                            <Checkbox
                              checked={manual}
                              onCheckedChange={(c) => {
                                form.setValue(`baris.${i}.hargaManual`, c === true, {
                                  shouldDirty: true,
                                });
                                form.setValue(`baris.${i}.hargaSatuan`, c === true ? harga : null);
                              }}
                              aria-label={`Harga manual ${inf?.nama ?? i + 1}`}
                            />
                            Harga manual
                          </label>
                        )}
                      </TableCell>
                      {bolehDiskon && (
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`baris.${i}.diskonBaris`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <InputRupiah
                                    {...field}
                                    aria-label={`Diskon ${inf?.nama ?? i + 1}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatRupiah(pr?.subtotal ?? subtotalBaris(i))}
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
            </Table>
            <div className="ml-auto w-96 space-y-1.5 border-t p-4 text-sm">
              {hasil && hasil.totalDiskonPromo > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Potongan promo</span>
                  <span className="tabular-nums">−{formatRupiah(hasil.totalDiskonPromo)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="tabular-nums">{formatRupiah(hasil?.subtotal ?? subtotal)}</span>
              </div>
              {bolehDiskon && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Diskon transaksi</span>
                  <div className="flex items-center gap-1">
                    <Select
                      value={persenTransaksi ? 'PERSEN' : 'RUPIAH'}
                      onValueChange={(v) => {
                        setPersenTransaksi(v === 'PERSEN');
                        form.setValue('diskonTransaksi', 0);
                        form.setValue('diskonTransaksiPersen', null);
                      }}
                    >
                      <SelectTrigger className="w-20" aria-label="Jenis diskon transaksi">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RUPIAH">Rp</SelectItem>
                        <SelectItem value="PERSEN">%</SelectItem>
                      </SelectContent>
                    </Select>
                    {persenTransaksi ? (
                      <FormField
                        control={form.control}
                        name="diskonTransaksiPersen"
                        render={({ field }) => (
                          <Input
                            className="w-24 text-right"
                            inputMode="decimal"
                            aria-label="Diskon transaksi persen"
                            {...field}
                            value={typeof field.value === 'string' ? field.value : ''}
                          />
                        )}
                      />
                    ) : (
                      <FormField
                        control={form.control}
                        name="diskonTransaksi"
                        render={({ field }) => (
                          <div className="w-36">
                            <InputRupiah {...field} aria-label="Diskon transaksi" />
                          </div>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}
              {form.formState.errors.diskonTransaksi?.message && (
                <p className="text-right text-xs text-red-600">
                  {form.formState.errors.diskonTransaksi.message}
                </p>
              )}
              {antar && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ongkos kirim</span>
                  <span className="tabular-nums">
                    {formatRupiah(typeof ongkir === 'number' ? ongkir : 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total{hasil ? '' : ' (perkiraan)'}</span>
                <span className="text-blue-700 tabular-nums" data-testid="total-order">
                  {formatRupiah(hasil?.total ?? totalPerkiraan)}
                </span>
              </div>
              <InfoTierBelanja
                info={hasil?.tierBelanja}
                idTierDasar={tierDefault}
                namaTier={namaTier}
              />
              <p className="text-xs text-slate-400">
                {pratinjau.galat && !hasil
                  ? 'Total belum bisa dihitung; periksa isian.'
                  : 'Promo dihitung ulang saat dibayar di kasir.'}
              </p>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            {dapatDiubahPembuat && (
              <Button
                type="button"
                variant="outline"
                disabled={sedangKirim}
                onClick={() => void form.handleSubmit((d) => kirimData(d, false))()}
              >
                Simpan draf
              </Button>
            )}
            <Button type="submit" disabled={sedangKirim || baris.fields.length === 0}>
              {sedangKirim
                ? 'Menyimpan…'
                : dapatDiubahPembuat
                  ? 'Kirim ke antrean'
                  : 'Simpan perubahan'}
            </Button>
          </div>
        </form>
      </Form>
      {dialogKeluar}
      <DialogKonfirmasi
        terbuka={konfirmasiModal !== null}
        onTutup={() => setKonfirmasiModal(null)}
        judul="Harga di bawah modal"
        pesan="Ada harga manual di bawah modal barang. Lanjutkan? Persetujuan ini dicatat di log."
        labelKonfirmasi="Ya, lanjutkan"
        bahaya
        onKonfirmasi={async () => {
          if (konfirmasiModal) await kirimData(konfirmasiModal.data, konfirmasiModal.kirim);
        }}
      />
    </div>
  );
}
