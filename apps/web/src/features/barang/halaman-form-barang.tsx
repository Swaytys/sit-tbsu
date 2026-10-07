import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  skemaBarang,
  type DataBarang,
  type DetailBarang,
  type InputBarang,
  type JenisAtribut,
  type Kategori,
  type Merk,
  type MetodeHarga,
  type Pemasok,
  type Satuan,
  type TingkatHarga,
} from '@sit/shared';
import { AlertTriangle, ArrowLeft, ImagePlus, Lock, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type Path } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useDetailBarang, useHapusGambar, useSimpanBarang, useUnggahGambar } from '@/api/barang';
import { useDaftarPemasok, useDaftarTingkatHarga } from '@/api/mitra';
import {
  useDaftarJenisAtribut,
  useDaftarKategori,
  useDaftarMerk,
  useDaftarSatuan,
} from '@/api/referensi';
import { InputPersen } from '@/components/input-persen';
import { InputRupiah } from '@/components/input-rupiah';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { tampilkanGalatForm } from '@/lib/form';
import { formatDesimal } from '@/lib/format';
import { useCegahKeluar } from '@/lib/use-cegah-keluar';
import { rapikanPersen, teksMargin } from '../harga-jual/isian-harga';
import { KartuSatuanJual } from './kartu-satuan-jual';

type Referensi = {
  kategori: Kategori[];
  merk: Merk[];
  satuan: Satuan[];
  jenisAtribut: JenisAtribut[];
  tier: TingkatHarga[];
  pemasok: Pemasok[];
};

/** Rute `/barang/baru` dan `/barang/:id`: memuat data referensi dulu, lalu menampilkan form. */
export function HalamanFormBarang() {
  const { id } = useParams();
  const idBarang = id === undefined || id === 'baru' ? null : Number(id);
  const detail = useDetailBarang(idBarang);
  const kategori = useDaftarKategori();
  const merk = useDaftarMerk();
  const satuan = useDaftarSatuan();
  const jenisAtribut = useDaftarJenisAtribut();
  const tier = useDaftarTingkatHarga();
  const pemasok = useDaftarPemasok({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 100 });

  const semua = [
    kategori,
    merk,
    satuan,
    jenisAtribut,
    tier,
    pemasok,
    ...(idBarang ? [detail] : []),
  ];
  const galat = semua.find((q) => q.error)?.error;
  if (galat) {
    return <p className="p-6 text-sm text-red-600">{pesanGalat(galat)}</p>;
  }
  if (
    !kategori.data ||
    !merk.data ||
    !satuan.data ||
    !jenisAtribut.data ||
    !tier.data ||
    !pemasok.data ||
    (idBarang !== null && !detail.data)
  ) {
    return <p className="p-6 text-sm text-slate-500">Memuat…</p>;
  }
  return (
    <FormBarang
      key={idBarang ?? 'baru'}
      barang={detail.data ?? null}
      referensi={{
        kategori: kategori.data,
        merk: merk.data,
        satuan: satuan.data,
        jenisAtribut: jenisAtribut.data,
        tier: tier.data,
        pemasok: pemasok.data.data,
      }}
    />
  );
}

const TANPA = 'TANPA';

function nilaiAwal(b: DetailBarang | null, tierAktif: TingkatHarga[]): InputBarang {
  return {
    kode: b?.kode ?? '',
    barcode: b?.barcode ?? '',
    namaBarang: b?.namaBarang ?? '',
    idKategori: b?.idKategori ?? 0,
    idMerk: b?.idMerk ?? null,
    idSatuanDasar: b?.idSatuanDasar ?? 0,
    stokMinimum: b ? formatDesimal(b.stokMinimum).replaceAll('.', '') : '',
    hargaModalAwal: b?.hargaModalAwal ?? null,
    kepemilikan: b?.kepemilikan ?? 'MILIK_SENDIRI',
    idPemasokKonsinyasi: b?.idPemasokKonsinyasi ?? null,
    hargaTitip: b?.hargaTitip ?? null,
    keterangan: b?.keterangan ?? '',
    atribut: (b?.atribut ?? []).map((a) => ({
      idJenisAtribut: a.idJenisAtribut,
      nilai: a.tipeNilai === 'ANGKA' ? a.nilai.replace('.', ',') : a.nilai,
      idSatuan: a.idSatuan,
    })),
    hargaTier: tierAktif.map((t) => {
      const h = b?.harga.find((x) => x.idTingkatHarga === t.id);
      return {
        idTingkatHarga: t.id,
        hargaTetap: h?.metode === 'TETAP' ? h.hargaTetap : null,
        markupPersen: h?.metode === 'MARKUP' ? rapikanPersen(h.markupPersen) : null,
      };
    }),
    hargaOtomatis: b?.hargaOtomatis ?? false,
  };
}

/** Metode awal per tier: tier default selalu TETAP; barang baru = ikut tier (K-047). */
function metodeAwal(b: DetailBarang | null, tierAktif: TingkatHarga[]): MetodeHarga[] {
  return tierAktif.map((t) =>
    t.isDefault
      ? 'TETAP'
      : (b?.harga.find((x) => x.idTingkatHarga === t.id)?.metode ?? 'IKUT_TIER'),
  );
}

function FormBarang({ barang, referensi }: { barang: DetailBarang | null; referensi: Referensi }) {
  const navigasi = useNavigate();
  const simpan = useSimpanBarang();
  const unggah = useUnggahGambar();
  const hapusGambar = useHapusGambar();
  const [berkasBaru, setBerkasBaru] = useState<File | null>(null);
  const bolehKelolaHarga = usePengguna().izin.includes('master.harga.kelola');

  const tierAktif = referensi.tier.filter((t) => t.statusAktif === 'AKTIF');
  const kategoriPilihan = referensi.kategori.filter(
    (k) => k.statusAktif === 'AKTIF' || k.id === barang?.idKategori,
  );
  const merkPilihan = referensi.merk.filter(
    (m) => m.statusAktif === 'AKTIF' || m.id === barang?.idMerk,
  );
  const satuanPilihan = referensi.satuan.filter(
    (s) => s.statusAktif === 'AKTIF' || s.id === barang?.idSatuanDasar,
  );
  const pemasokPilihan: { id: number; nama: string }[] = referensi.pemasok.map((p) => ({
    id: p.id,
    nama: p.namaPemasok,
  }));
  if (
    barang?.idPemasokKonsinyasi &&
    !pemasokPilihan.some((p) => p.id === barang.idPemasokKonsinyasi)
  ) {
    pemasokPilihan.push({
      id: barang.idPemasokKonsinyasi,
      nama: barang.namaPemasokKonsinyasi ?? '(nonaktif)',
    });
  }
  const adaStok = barang !== null && barang.stokFisik !== '0.000';

  const form = useForm<InputBarang, unknown, DataBarang>({
    resolver: zodResolver(skemaBarang),
    defaultValues: nilaiAwal(barang, tierAktif),
  });
  // Metode dipilih eksplisit (H4) agar "Tetap" yang dikosongkan tidak diam-diam menjadi "Ikut tier".
  const [metode, setMetode] = useState<MetodeHarga[]>(() => metodeAwal(barang, tierAktif));

  function ubahMetode(i: number, t: TingkatHarga, m: MetodeHarga) {
    const kini = barang?.harga.find((h) => h.idTingkatHarga === t.id);
    const opsi = { shouldDirty: true, shouldValidate: false };
    const tetap = form.getValues(`hargaTier.${i}.hargaTetap`);
    const persen = form.getValues(`hargaTier.${i}.markupPersen`);
    form.setValue(
      `hargaTier.${i}.hargaTetap`,
      m === 'TETAP' ? (typeof tetap === 'number' ? tetap : (kini?.hargaJual ?? null)) : null,
      opsi,
    );
    form.setValue(
      `hargaTier.${i}.markupPersen`,
      m === 'MARKUP'
        ? typeof persen === 'string'
          ? persen
          : rapikanPersen(kini?.markupPersen ?? t.markupDefaultPersen)
        : null,
      opsi,
    );
    form.clearErrors(`hargaTier.${i}`);
    setMetode(metode.map((x, j) => (j === i ? m : x)));
  }

  /** Isian wajib sesuai metode (skema Zod tidak tahu metode yang dipilih di layar). */
  function cekMetode(data: DataBarang): boolean {
    let sah = true;
    tierAktif.forEach((t, i) => {
      const h = data.hargaTier?.[i];
      if (metode[i] === 'TETAP' && (h?.hargaTetap ?? null) === null) {
        form.setError(`hargaTier.${i}.hargaTetap`, {
          message: t.isDefault
            ? `Harga ${t.nama} wajib diisi.`
            : 'Isi harga tetap, atau pilih cara lain.',
        });
        sah = false;
      }
      if (metode[i] === 'MARKUP' && (h?.markupPersen ?? null) === null) {
        form.setError(`hargaTier.${i}.markupPersen`, { message: 'Isi persen markup.' });
        sah = false;
      }
    });
    return sah;
  }
  const atribut = useFieldArray({ control: form.control, name: 'atribut' });
  const [kepemilikan, atributDiisi] = useWatch({
    control: form.control,
    name: ['kepemilikan', 'atribut'],
  });
  const barisAtribut = atributDiisi ?? [];
  const { lewati, dialog: dialogKeluar } = useCegahKeluar(
    form.formState.isDirty || berkasBaru !== null,
  );

  async function kirim(data: DataBarang) {
    if (!cekMetode(data)) return;
    // Saat ubah, harga hanya dikirim bila bagian harga disentuh (menyimpan harga melepas tanda tinjau).
    const json: DataBarang =
      barang && !form.getFieldState('hargaTier').isDirty ? { ...data, hargaTier: undefined } : data;
    try {
      const hasil = await simpan.mutateAsync({ id: barang?.id, json });
      if (berkasBaru) {
        try {
          await unggah.mutateAsync({ id: hasil.id, berkas: berkasBaru });
        } catch (err) {
          toast.error(`Barang tersimpan, tetapi gambar gagal diunggah: ${pesanGalat(err)}`);
        }
      }
      toast.success(
        barang
          ? `Barang ${hasil.namaBarang} disimpan.`
          : `Barang ${hasil.namaBarang} ditambahkan (${hasil.kode}).`,
      );
      lewati();
      void navigasi('/barang');
    } catch (err) {
      const kolomAtribut = barisAtribut.flatMap((_, i) =>
        (['idJenisAtribut', 'nilai', 'idSatuan'] as const).map(
          (k) => `atribut.${i}.${k}` as Path<InputBarang>,
        ),
      );
      tampilkanGalatForm(err, form.setError, [
        'kode',
        'barcode',
        'namaBarang',
        'idKategori',
        'idMerk',
        'idSatuanDasar',
        'stokMinimum',
        'hargaModalAwal',
        'kepemilikan',
        'idPemasokKonsinyasi',
        'hargaTitip',
        'keterangan',
        'hargaTier',
        ...kolomAtribut,
      ]);
    }
  }

  async function hapusGambarSekarang() {
    if (!barang) return;
    try {
      await hapusGambar.mutateAsync(barang.id);
      toast.success('Gambar dihapus.');
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  const pratinjau = berkasBaru ? URL.createObjectURL(berkasBaru) : barang?.gambar;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/barang" aria-label="Kembali ke daftar barang">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {barang ? `Ubah barang ${barang.kode}` : 'Tambah barang'}
          </h1>
          <p className="text-sm text-slate-500">
            {barang ? barang.namaBarang : 'Isi data barang, atribut, dan harga jual per tier.'}
          </p>
        </div>
      </div>

      {barang?.perluTinjauHarga && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          <AlertTriangle className="size-4" />
          Dasar harga barang ini berubah. Tinjau harga jual di bawah lalu simpan untuk melepas
          tanda.
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(kirim)(e)}
          className="grid grid-cols-3 gap-4"
          noValidate
        >
          <div className="col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identitas barang</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="kode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kode barang</FormLabel>
                      <FormControl>
                        <Input
                          className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                          placeholder="Otomatis (BRG-00001)"
                          {...field}
                          value={typeof field.value === 'string' ? field.value : ''}
                        />
                      </FormControl>
                      <FormDescription>Kosongkan untuk kode otomatis.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="opsional" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="namaBarang"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nama barang</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mis. Semen Gresik 40 kg"
                          autoFocus={!barang}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="idKategori"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih kategori" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {kategoriPilihan.map((k) => (
                            <SelectItem key={k.id} value={String(k.id)}>
                              {k.nama}
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
                  name="idMerk"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merk</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : TANPA}
                        onValueChange={(v) => field.onChange(v === TANPA ? null : Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={TANPA}>Tanpa merk</SelectItem>
                          {merkPilihan.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.nama}
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
                  name="keterangan"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Keterangan</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          className="resize-none"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Satuan, stok, dan kepemilikan</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="idSatuanDasar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Satuan dasar</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(v) => field.onChange(Number(v))}
                        disabled={barang?.sudahAdaMutasi}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih satuan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {satuanPilihan.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.kode} — {s.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {barang?.sudahAdaMutasi
                          ? 'Dikunci: sudah ada mutasi stok.'
                          : 'Satuan tempat stok dicatat.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stokMinimum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stok minimum</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="Bawaan toko"
                          {...field}
                          value={typeof field.value === 'string' ? field.value : ''}
                        />
                      </FormControl>
                      <FormDescription>Dalam satuan dasar.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kepemilikan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kepemilikan</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={adaStok}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MILIK_SENDIRI">Milik sendiri</SelectItem>
                          <SelectItem value="KONSINYASI">Konsinyasi (titipan)</SelectItem>
                        </SelectContent>
                      </Select>
                      {adaStok && (
                        <FormDescription>Dikunci selama barang masih punya stok.</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {kepemilikan === 'KONSINYASI' ? (
                  <>
                    <FormField
                      control={form.control}
                      name="idPemasokKonsinyasi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pemasok penitip</FormLabel>
                          <Select
                            value={field.value ? String(field.value) : ''}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih pemasok" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {pemasokPilihan.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.nama}
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
                      name="hargaTitip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Harga titip</FormLabel>
                          <FormControl>
                            <InputRupiah {...field} />
                          </FormControl>
                          <FormDescription>
                            Dibayar ke pemasok per satuan yang laku.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <FormField
                    control={form.control}
                    name="hargaModalAwal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Harga modal awal</FormLabel>
                        <FormControl>
                          <InputRupiah {...field} disabled={barang?.sudahAdaMutasi} />
                        </FormControl>
                        <FormDescription>
                          {barang?.sudahAdaMutasi
                            ? 'Dikunci: HPP sekarang mengikuti penerimaan.'
                            : 'Dasar HPP dan markup sebelum ada penerimaan.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Atribut</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => atribut.append({ idJenisAtribut: 0, nilai: '', idSatuan: null })}
                >
                  <Plus /> Tambah atribut
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {atribut.fields.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Belum ada atribut. Contoh: panjang 6 m, tebal 0,75 mm, warna abu-abu.
                  </p>
                )}
                {atribut.fields.map((f, i) => {
                  const jenis = referensi.jenisAtribut.find(
                    (j) => j.id === barisAtribut[i]?.idJenisAtribut,
                  );
                  const pakaiSatuan = jenis?.tipeNilai === 'ANGKA' && jenis.jenisDimensi !== null;
                  const satuanAtribut = referensi.satuan.filter(
                    (s) => s.jenisDimensi === jenis?.jenisDimensi && s.statusAktif === 'AKTIF',
                  );
                  return (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1fr_1fr_8rem_auto] items-start gap-2"
                    >
                      <FormField
                        control={form.control}
                        name={`atribut.${i}.idJenisAtribut`}
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              value={field.value ? String(field.value) : ''}
                              onValueChange={(v) => {
                                field.onChange(Number(v));
                                form.setValue(`atribut.${i}.idSatuan`, null);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger
                                  className="w-full"
                                  aria-label={`Jenis atribut ${i + 1}`}
                                >
                                  <SelectValue placeholder="Jenis atribut" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {referensi.jenisAtribut
                                  .filter((j) => j.statusAktif === 'AKTIF' || j.id === field.value)
                                  .map((j) => (
                                    <SelectItem key={j.id} value={String(j.id)}>
                                      {j.nama}
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
                        name={`atribut.${i}.nilai`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                aria-label={`Nilai atribut ${i + 1}`}
                                inputMode={jenis?.tipeNilai === 'ANGKA' ? 'decimal' : 'text'}
                                placeholder={jenis?.tipeNilai === 'ANGKA' ? 'Angka' : 'Nilai'}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`atribut.${i}.idSatuan`}
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              value={field.value ? String(field.value) : TANPA}
                              onValueChange={(v) => field.onChange(v === TANPA ? null : Number(v))}
                              disabled={!pakaiSatuan}
                            >
                              <FormControl>
                                <SelectTrigger
                                  className="w-full"
                                  aria-label={`Satuan atribut ${i + 1}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={TANPA}>
                                  {pakaiSatuan ? 'Satuan' : '—'}
                                </SelectItem>
                                {satuanAtribut.map((s) => (
                                  <SelectItem key={s.id} value={String(s.id)}>
                                    {s.kode}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus atribut ${i + 1}`}
                        onClick={() => atribut.remove(i)}
                      >
                        <Trash2 className="text-slate-500" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Harga jual per tier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tierAktif.map((t, i) => {
                  const kini = barang?.harga.find((h) => h.idTingkatHarga === t.id);
                  const m = metode[i] ?? 'IKUT_TIER';
                  const keterangan =
                    kini && m === kini.metode
                      ? [
                          m === 'MARKUP' ? `= ${formatRupiah(kini.hargaJual)}` : null,
                          kini.margin != null ? `margin ${teksMargin(kini.margin)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : '';
                  return (
                    <div key={t.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {t.nama}
                          {t.isDefault && <span className="text-red-500">*</span>}
                        </span>
                        {!t.isDefault && (
                          <Select
                            value={m}
                            onValueChange={(v) => ubahMetode(i, t, v as MetodeHarga)}
                          >
                            <SelectTrigger
                              className="h-7 w-40 text-xs"
                              aria-label={`Cara menentukan harga ${t.nama}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TETAP">Harga tetap</SelectItem>
                              <SelectItem value="IKUT_TIER">
                                Ikut tier
                                {t.markupDefaultPersen
                                  ? ` (+${formatDesimal(t.markupDefaultPersen)}%)`
                                  : ''}
                              </SelectItem>
                              <SelectItem value="MARKUP">Markup sendiri (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {m === 'TETAP' && (
                        <FormField
                          control={form.control}
                          name={`hargaTier.${i}.hargaTetap`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <InputRupiah
                                  {...field}
                                  aria-label={`Harga ${t.nama}`}
                                  placeholder="Wajib diisi"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {m === 'MARKUP' && (
                        <FormField
                          control={form.control}
                          name={`hargaTier.${i}.markupPersen`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <InputPersen
                                  name={field.name}
                                  ref={field.ref}
                                  onBlur={field.onBlur}
                                  value={typeof field.value === 'string' ? field.value : null}
                                  onChange={field.onChange}
                                  aria-label={`Markup ${t.nama} (%)`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {m === 'IKUT_TIER' && (
                        <div className="flex h-9 items-center justify-end rounded-md border border-dashed px-3 text-sm text-slate-500 tabular-nums">
                          {kini?.metode === 'IKUT_TIER'
                            ? formatRupiah(kini.hargaJual)
                            : 'dihitung saat disimpan'}
                        </div>
                      )}
                      {keterangan && <p className="text-xs text-slate-500">{keterangan}</p>}
                    </div>
                  );
                })}
                <p className="text-xs text-slate-500">
                  Ikut tier dan markup sendiri dihitung dari dasar harga modal lalu dibulatkan ke
                  atas. Harga {tierAktif.find((t) => t.isDefault)?.nama ?? 'default'} selalu harga
                  tetap.
                </p>
                <FormField
                  control={form.control}
                  name="hargaOtomatis"
                  render={({ field }) => (
                    <FormItem className="flex items-start justify-between gap-3 rounded-md border p-3">
                      <div className="space-y-1">
                        <FormLabel>Harga otomatis</FormLabel>
                        <FormDescription className="text-xs">
                          Harga ikut tier dan markup langsung naik saat harga modal naik; bila
                          turun, menunggu Tinjau Harga. Harga tetap tidak pernah berubah otomatis.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === true}
                          onCheckedChange={field.onChange}
                          disabled={!bolehKelolaHarga}
                          aria-label="Harga otomatis"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.formState.errors.hargaTier?.message && (
                  <p className="text-sm text-red-600">{form.formState.errors.hargaTier.message}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gambar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pratinjau ? (
                  <img
                    src={pratinjau}
                    alt="Gambar barang"
                    className="aspect-square w-full rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed text-sm text-slate-400">
                    Belum ada gambar
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <ImagePlus /> Pilih gambar
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        aria-label="Berkas gambar"
                        onChange={(e) => setBerkasBaru(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </Button>
                  {berkasBaru && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBerkasBaru(null)}
                    >
                      <X /> Batal pilih
                    </Button>
                  )}
                  {!berkasBaru && barang?.gambar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void hapusGambarSekarang()}
                    >
                      <Trash2 /> Hapus
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">JPG, PNG, atau WebP, maksimal 2 MB.</p>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/barang">Batal</Link>
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan barang'}
              </Button>
            </div>
            {barang?.sudahAdaMutasi && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="size-3" /> Beberapa isian dikunci karena sudah ada mutasi stok.
              </p>
            )}
          </div>
        </form>
      </Form>
      {barang && (
        <KartuSatuanJual barang={barang} satuan={referensi.satuan} tier={referensi.tier} />
      )}
      {dialogKeluar}
    </div>
  );
}
