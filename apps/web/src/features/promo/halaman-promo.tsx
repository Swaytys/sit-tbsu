import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  JENIS_POTONGAN,
  LABEL_JENIS_POTONGAN,
  LABEL_SASARAN_PEMBELI,
  LABEL_SASARAN_PROMO,
  LABEL_STATUS_BERLAKU_PROMO,
  SASARAN_PROMO,
  skemaIsianPromo,
  STATUS_BERLAKU_PROMO,
  type DataPromo,
  type InputPromo,
  type Promo,
  type StatusAktif,
  type StatusBerlakuPromo,
} from '@sit/shared';
import { BookmarkPlus, CopyPlus, Lock, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useDaftarGolongan } from '@/api/mitra';
import { TeksLipat } from '@/components/teks-lipat';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarPromo, useSimpanPromo, useStatusPromo } from '@/api/promo';
import { BilahSaring, type SaringStatus } from '@/components/bilah-saring';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputPersen } from '@/components/input-persen';
import { InputRupiah } from '@/components/input-rupiah';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { PilihPelanggan } from '@/components/pilih-pelanggan';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
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
import { Textarea } from '@/components/ui/textarea';
import { jalankanDenganToast } from '@/lib/aksi';
import { tampilkanGalatForm } from '@/lib/form';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTunda } from '@/lib/use-tunda';
import {
  IsianWaktu,
  PilihHari,
  PilihKelompok,
  PilihSasaranBanyak,
  type IsianKelompok,
  type ItemSasaran,
} from './isian-kampanye';
import { isoLokal, NAMA_HARI } from './waktu-kampanye';

const SEMUA = 'SEMUA';

/** "10% (maks. Rp 5.000)", "Rp 500 per satuan", "harga Rp 48.000", atau "beli 10 gratis 1". */
function uraianPotongan(p: Promo): string {
  if (p.jenisPotongan === 'PERSEN') {
    const maks = p.maksPotongan === null ? '' : ` (maks. ${formatRupiah(p.maksPotongan)})`;
    return `${formatDesimal(p.potonganPersen ?? '0')}%${maks}`;
  }
  if (p.jenisPotongan === 'HARGA_KHUSUS') return `harga ${formatRupiah(p.hargaKhusus ?? 0)}/satuan`;
  const maks =
    p.maksKelipatan === null
      ? ''
      : p.maksKelipatan === 1
        ? ' (sekali)'
        : ` (maks. ${p.maksKelipatan}×)`;
  if (p.jenisPotongan === 'GRATIS') {
    return `beli ${formatDesimal(p.beliQty ?? '0')} gratis ${formatDesimal(p.gratisQty ?? '0')}${maks}`;
  }
  if (p.jenisPotongan === 'BELI_POTONG') {
    return `beli ${formatDesimal(p.beliQty ?? '0')} potong ${formatRupiah(p.potonganNominal ?? 0)}${maks}`;
  }
  return `${formatRupiah(p.potonganNominal ?? 0)} per satuan`;
}

/** K-185: "Cat + Avian; Semen + BRG-00001 Semen Gresik". */
function uraianKelompok(p: Promo): string {
  return p.kelompok
    .map((k) =>
      [k.namaKategori, k.namaMerk, k.kodeBarang ? `${k.kodeBarang} ${k.namaBarang ?? ''}` : null]
        .filter(Boolean)
        .join(' + '),
    )
    .join('; ');
}

function uraianSasaran(p: Promo): string {
  if (p.sasaran === 'SEMUA') return 'Semua barang';
  if (p.sasaran === 'KELOMPOK') return uraianKelompok(p);
  const awalan = p.sasaran === 'KATEGORI' ? 'Kategori ' : p.sasaran === 'MERK' ? 'Merk ' : '';
  return awalan + p.sasaranDaftar.map((s) => (s.kode ? `${s.kode} ${s.nama}` : s.nama)).join(', ');
}

/** Hari dan jam harian, mis. "Sen, Rab · 13:00–15:00"; kosong bila setiap hari sepanjang hari. */
function uraianHariJam(p: Promo): string {
  return [
    p.hariBerlaku.length > 0 ? p.hariBerlaku.map((h) => NAMA_HARI[h - 1]).join(', ') : null,
    p.jamMulai && p.jamSelesai ? `${p.jamMulai}–${p.jamSelesai}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function uraianSyarat(p: Promo): string {
  const syarat = [
    p.sasaranPembeli === 'GOLONGAN' ? `golongan ${p.namaGolongan ?? '—'}` : null,
    p.sasaranPembeli === 'PELANGGAN' ? `${p.pelanggan.length} pelanggan` : null,
    p.minQty !== null ? `qty ≥ ${formatDesimal(p.minQty)}` : null,
    p.minBelanja !== null ? `belanja ≥ ${formatRupiah(p.minBelanja)}` : null,
    p.minBelanjaPelanggan !== null
      ? `belanja ${p.hariBelanja ?? 0} hari ≥ ${formatRupiah(p.minBelanjaPelanggan)}`
      : null,
  ].filter(Boolean);
  return syarat.length > 0 ? syarat.join(' · ') : '—';
}

const WARNA_BERLAKU: Record<StatusBerlakuPromo, string> = {
  BERJALAN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TERJADWAL: 'border-blue-200 bg-blue-50 text-blue-700',
  BERAKHIR: 'border-slate-200 bg-slate-50 text-slate-500',
};

/** Nilai awal waktu promo baru: sekarang sampai 7 hari lagi pukul 23:59 (WIB). */
function waktuAwal(): { mulai: string; selesai: string } {
  const mulai = isoLokal(new Date());
  const selesai = isoLokal(new Date(Date.now() + 7 * 86_400_000));
  return {
    mulai: `${mulai.slice(0, 16)}:00+07:00`,
    selesai: `${selesai.slice(0, 10)}T23:59:00+07:00`,
  };
}

/**
 * Buat/ubah promo atau templat kampanye (K-163). `dasar` = isi awal untuk promo/templat baru (dari templat, atau
 * promo yang disimpan sebagai templat); waktunya selalu diisi ulang.
 */
function DialogPromo({
  promo,
  dasar,
  templat,
  onTutup,
}: {
  promo: Promo | null;
  dasar: Promo | null;
  templat: boolean;
  onTutup: () => void;
}) {
  const simpan = useSimpanPromo();
  const golongan = useDaftarGolongan('AKTIF');
  const terkunci = (promo?.jumlahPemakaian ?? 0) > 0;
  const sumber = promo ?? dasar;
  const modeTemplat = promo ? promo.templat : templat;
  /** Nama pelanggan berhak yang sudah dipilih (sasaran PELANGGAN). */
  const [namaPelanggan, setNamaPelanggan] = useState<Map<number, string>>(
    () => new Map((sumber?.pelanggan ?? []).map((p) => [p.id, p.nama])),
  );
  const [itemSasaran, setItemSasaran] = useState<ItemSasaran[]>(() =>
    (sumber?.sasaranDaftar ?? []).map((s) => ({
      id: s.id,
      nama: s.kode ? `${s.kode} · ${s.nama}` : s.nama,
    })),
  );
  const [isiKelompok, setIsiKelompok] = useState<IsianKelompok[]>(() =>
    (sumber?.kelompok ?? []).map((k) => ({
      idKategori: k.idKategori,
      idMerk: k.idMerk,
      idBarang: k.idBarang,
      namaBarang: k.kodeBarang ? `${k.kodeBarang} · ${k.namaBarang ?? ''}` : null,
    })),
  );
  const awal = waktuAwal();
  const form = useForm<InputPromo, unknown, DataPromo>({
    resolver: zodResolver(skemaIsianPromo),
    defaultValues: {
      nama: sumber?.nama ?? '',
      mulaiPada: promo ? isoLokal(promo.mulaiPada) : awal.mulai,
      selesaiPada: promo ? isoLokal(promo.selesaiPada) : awal.selesai,
      hariBerlaku: sumber?.hariBerlaku ?? [],
      jamMulai: sumber?.jamMulai ?? null,
      jamSelesai: sumber?.jamSelesai ?? null,
      jenisPotongan: sumber?.jenisPotongan ?? 'PERSEN',
      potonganPersen: sumber?.potonganPersen ? formatDesimal(sumber.potonganPersen) : null,
      potonganNominal: sumber?.potonganNominal ?? null,
      maksPotongan: sumber?.maksPotongan ?? null,
      hargaKhusus: sumber?.hargaKhusus ?? null,
      beliQty: sumber?.beliQty ? formatDesimal(sumber.beliQty) : null,
      gratisQty: sumber?.gratisQty ? formatDesimal(sumber.gratisQty) : null,
      maksKelipatan: sumber?.maksKelipatan ?? null,
      sasaran: sumber?.sasaran ?? 'SEMUA',
      idSasaran: (sumber?.sasaranDaftar ?? []).map((s) => s.id),
      kelompok: (sumber?.kelompok ?? []).map((k) => ({
        idKategori: k.idKategori,
        idMerk: k.idMerk,
        idBarang: k.idBarang,
      })),
      minQty: sumber?.minQty ? formatDesimal(sumber.minQty) : null,
      minBelanja: sumber?.minBelanja ?? null,
      keterangan: sumber?.keterangan ?? '',
      sasaranPembeli: sumber?.sasaranPembeli ?? 'SEMUA',
      idGolongan: sumber?.idGolongan ?? null,
      idPelanggan: (sumber?.pelanggan ?? []).map((p) => p.id),
      minBelanjaPelanggan: sumber?.minBelanjaPelanggan ?? null,
      hariBelanja: sumber?.hariBelanja ?? null,
      anggaran: sumber?.anggaran ?? null,
      maksPerPembeli: sumber?.maksPerPembeli ?? null,
      templat: modeTemplat,
    },
  });
  const [jenis, sasaran, sasaranPembeli, idPelanggan] = useWatch({
    control: form.control,
    name: ['jenisPotongan', 'sasaran', 'sasaranPembeli', 'idPelanggan'],
  });

  async function kirim(data: DataPromo) {
    try {
      const hasil = await simpan.mutateAsync({ id: promo?.id, json: data });
      const apa = hasil.templat ? 'Templat' : 'Promo';
      toast.success(
        promo ? `${apa} ${hasil.nama} disimpan.` : `${apa} ${hasil.nama} dibuat (${hasil.kode}).`,
      );
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'nama',
        'mulaiPada',
        'selesaiPada',
        'hariBerlaku',
        'jamMulai',
        'jamSelesai',
        'jenisPotongan',
        'potonganPersen',
        'potonganNominal',
        'maksPotongan',
        'hargaKhusus',
        'beliQty',
        'gratisQty',
        'maksKelipatan',
        'sasaran',
        'idSasaran',
        'kelompok',
        'minQty',
        'minBelanja',
        'keterangan',
        'sasaranPembeli',
        'idGolongan',
        'idPelanggan',
        'minBelanjaPelanggan',
        'hariBelanja',
        'anggaran',
        'maksPerPembeli',
      ]);
    }
  }

  const judul = promo
    ? `Ubah ${promo.templat ? 'templat' : 'promo'} ${promo.kode}`
    : modeTemplat
      ? 'Simpan sebagai templat kampanye'
      : dasar
        ? `Promo baru dari templat "${dasar.nama}"`
        : 'Buat promo';

  /** Isian qty desimal (min qty, beli/gratis): teks; kosong = null. */
  const isianQty = (
    field: {
      name: string;
      ref: React.Ref<HTMLInputElement>;
      onBlur: () => void;
      value: unknown;
      onChange: (v: string | null) => void;
    },
    label: string,
    placeholder?: string,
  ) => (
    <Input
      inputMode="decimal"
      placeholder={placeholder}
      disabled={terkunci}
      aria-label={label}
      name={field.name}
      ref={field.ref}
      onBlur={field.onBlur}
      value={typeof field.value === 'string' ? field.value : ''}
      onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
    />
  );

  /** K-194: berapa kali beli-gratis / beli-potong berlaku per baris. */
  const isianKelipatan = (
    <FormField
      control={form.control}
      name="maksKelipatan"
      render={({ field }) => {
        const nilai = typeof field.value === 'number' ? field.value : null;
        return (
          <FormItem>
            <FormLabel>Berlaku per baris</FormLabel>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Berlaku per baris"
            >
              {(
                [
                  [null, 'Tanpa batas'],
                  [1, 'Sekali'],
                ] as const
              ).map(([v, label]) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={nilai === v ? 'default' : 'outline'}
                  disabled={terkunci}
                  aria-pressed={nilai === v}
                  onClick={() => field.onChange(v)}
                >
                  {label}
                </Button>
              ))}
              <span className="text-sm text-slate-500">atau paling banyak</span>
              <Input
                className="h-8 w-20 text-right"
                inputMode="numeric"
                disabled={terkunci}
                aria-label="Paling banyak berapa kali"
                placeholder="mis. 3"
                value={nilai !== null && nilai > 1 ? String(nilai) : ''}
                onChange={(e) => {
                  const t = e.target.value.replace(/\D/g, '');
                  field.onChange(t === '' ? null : Number(t));
                }}
              />
              <span className="text-sm text-slate-500">kali</span>
            </div>
            <FormDescription>
              Mis. beli 2 potong Rp 2.000, paling banyak 2 kali: qty 9 tetap dipotong Rp 4.000.
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>
            {modeTemplat
              ? 'Templat tidak pernah berlaku. Pakai templat untuk membuat promo baru dengan isian yang sama; waktu diisi saat dipakai.'
              : 'Kampanye = waktu + syarat + manfaat. Manfaat dihitung dari harga tier baris barang. Bila beberapa promo cocok, dipakai manfaat terbesar. Tidak berlaku untuk harga manual.'}
          </DialogDescription>
        </DialogHeader>
        {terkunci && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
            <Lock className="mt-0.5 size-4 shrink-0" />
            Promo ini sudah dipakai di {promo?.jumlahPemakaian} baris penjualan, jadi aturannya
            dikunci. Nama, keterangan, waktu selesai, anggaran, dan batas per pembeli masih bisa
            diubah; untuk aturan berbeda buat promo baru.
          </p>
        )}
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nama {modeTemplat ? 'templat' : 'promo'}</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. Promo Semen Oktober" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <fieldset className="col-span-2 grid grid-cols-2 gap-4 rounded-lg border p-3">
              <legend className="px-1 text-xs font-medium text-slate-500">1. Waktu berlaku</legend>
              {!modeTemplat && (
                <>
                  <FormField
                    control={form.control}
                    name="mulaiPada"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mulai (tanggal & jam)</FormLabel>
                        <FormControl>
                          <IsianWaktu
                            label="Waktu mulai"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={terkunci}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="selesaiPada"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selesai (tanggal & jam)</FormLabel>
                        <FormControl>
                          <IsianWaktu
                            label="Waktu selesai"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={form.control}
                name="hariBerlaku"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Hanya hari (kosong = setiap hari)</FormLabel>
                    <PilihHari
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={terkunci}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jamMulai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jam harian mulai (opsional)</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        aria-label="Jam harian mulai"
                        disabled={terkunci}
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jamSelesai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>sampai jam</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        aria-label="Jam harian selesai"
                        disabled={terkunci}
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormDescription>
                      Mis. 13:00–15:00 (happy hour). Kosong = sepanjang hari.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <fieldset className="col-span-2 grid grid-cols-2 gap-4 rounded-lg border p-3">
              <legend className="px-1 text-xs font-medium text-slate-500">2. Barang</legend>
              <FormField
                control={form.control}
                name="sasaran"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Berlaku untuk</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setItemSasaran([]);
                        form.setValue('idSasaran', []);
                        setIsiKelompok([]);
                        form.setValue('kelompok', []);
                      }}
                      disabled={terkunci}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" aria-label="Sasaran promo">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SASARAN_PROMO.map((s) => (
                          <SelectItem key={s} value={s}>
                            {LABEL_SASARAN_PROMO[s]}
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
                name="minQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimal qty per baris, satuan dasar (opsional)</FormLabel>
                    <FormControl>{isianQty(field, 'Minimal qty', 'Tanpa syarat')}</FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {sasaran === 'KELOMPOK' && (
                <FormField
                  control={form.control}
                  name="kelompok"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Kelompok sasaran</FormLabel>
                      <FormDescription>
                        Dalam satu kelompok semua isian harus cocok (mis. kategori Cat DAN merk
                        Avian = hanya cat merk Avian). Barang kena promo bila cocok dengan salah
                        satu kelompok.
                      </FormDescription>
                      <PilihKelompok
                        value={isiKelompok}
                        disabled={terkunci}
                        onChange={(v) => {
                          setIsiKelompok(v);
                          field.onChange(
                            v.map(({ idKategori, idMerk, idBarang }) => ({
                              idKategori,
                              idMerk,
                              idBarang,
                            })),
                          );
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {sasaran !== 'SEMUA' && sasaran !== 'KELOMPOK' && (
                <FormField
                  control={form.control}
                  name="idSasaran"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>{LABEL_SASARAN_PROMO[sasaran]}</FormLabel>
                      <PilihSasaranBanyak
                        sasaran={sasaran}
                        value={itemSasaran}
                        disabled={terkunci}
                        onChange={(v) => {
                          setItemSasaran(v);
                          field.onChange(v.map((x) => x.id));
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </fieldset>

            <fieldset className="col-span-2 grid grid-cols-2 gap-4 rounded-lg border p-3">
              <legend className="px-1 text-xs font-medium text-slate-500">3. Manfaat</legend>
              <FormField
                control={form.control}
                name="jenisPotongan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis manfaat</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (v !== 'GRATIS' && v !== 'BELI_POTONG')
                          form.setValue('maksKelipatan', null);
                      }}
                      disabled={terkunci}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" aria-label="Jenis manfaat">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {JENIS_POTONGAN.map((j) => (
                          <SelectItem key={j} value={j}>
                            {LABEL_JENIS_POTONGAN[j]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {jenis === 'PERSEN' && (
                <>
                  <FormField
                    control={form.control}
                    name="potonganPersen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potongan (%)</FormLabel>
                        <FormControl>
                          <InputPersen
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={typeof field.value === 'string' ? field.value : null}
                            onChange={field.onChange}
                            disabled={terkunci}
                            aria-label="Potongan persen"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maksPotongan"
                    render={({ field }) => (
                      <FormItem className="col-start-2">
                        <FormLabel>Batas potongan per baris (opsional)</FormLabel>
                        <FormControl>
                          <InputRupiah
                            {...field}
                            disabled={terkunci}
                            placeholder="Tanpa batas"
                            aria-label="Batas potongan"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {jenis === 'NOMINAL' && (
                <FormField
                  control={form.control}
                  name="potonganNominal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Potongan per satuan dasar</FormLabel>
                      <FormControl>
                        <InputRupiah
                          {...field}
                          disabled={terkunci}
                          aria-label="Potongan per satuan"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {jenis === 'HARGA_KHUSUS' && (
                <FormField
                  control={form.control}
                  name="hargaKhusus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga jual jadi per satuan dasar</FormLabel>
                      <FormControl>
                        <InputRupiah {...field} disabled={terkunci} aria-label="Harga khusus" />
                      </FormControl>
                      <FormDescription>
                        Yang dibayar pembeli per satuan, bukan besar potongannya. Mis. harga Rp
                        50.000, isi Rp 48.000 → pembeli bayar Rp 48.000 (hemat Rp 2.000). Tidak
                        berlaku bila harga tier barang sudah lebih murah.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {jenis === 'GRATIS' && (
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="beliQty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setiap beli</FormLabel>
                        <FormControl>{isianQty(field, 'Qty beli', 'mis. 10')}</FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gratisQty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>gratis</FormLabel>
                        <FormControl>{isianQty(field, 'Qty gratis', 'mis. 1')}</FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="col-span-2 text-xs text-slate-500">
                    Barang yang sama, satuan dasar. Kasir mengetik qty yang dibawa pembeli (termasuk
                    yang gratis); mis. beli 10 gratis 1, qty 22 = 2 gratis.
                  </p>
                  <div className="col-span-2">{isianKelipatan}</div>
                </div>
              )}
              {jenis === 'BELI_POTONG' && (
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="beliQty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setiap beli</FormLabel>
                        <FormControl>{isianQty(field, 'Qty beli', 'mis. 2')}</FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="potonganNominal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>potong</FormLabel>
                        <FormControl>
                          <InputRupiah
                            {...field}
                            disabled={terkunci}
                            aria-label="Potongan per kelipatan"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="col-span-2 text-xs text-slate-500">
                    Satuan dasar, berlaku per kelipatan: beli 2 potong Rp 2.000 → qty 5 dipotong Rp
                    4.000 (dua kali 2), qty 1 tidak dipotong.
                  </p>
                  <div className="col-span-2">{isianKelipatan}</div>
                </div>
              )}
            </fieldset>

            <fieldset className="col-span-2 grid grid-cols-2 gap-4 rounded-lg border p-3">
              <legend className="px-1 text-xs font-medium text-slate-500">
                4. Syarat belanja dan pembeli (opsional)
              </legend>
              <FormField
                control={form.control}
                name="minBelanja"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimal total belanja</FormLabel>
                    <FormControl>
                      <InputRupiah
                        {...field}
                        disabled={terkunci}
                        placeholder="Tanpa syarat"
                        aria-label="Minimal total belanja"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sasaranPembeli"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Untuk pembeli</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={terkunci}>
                      <FormControl>
                        <SelectTrigger className="w-full" aria-label="Sasaran pembeli">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SEMUA">{LABEL_SASARAN_PEMBELI.SEMUA}</SelectItem>
                        <SelectItem value="GOLONGAN">{LABEL_SASARAN_PEMBELI.GOLONGAN}</SelectItem>
                        <SelectItem value="PELANGGAN">{LABEL_SASARAN_PEMBELI.PELANGGAN}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {sasaranPembeli === 'GOLONGAN' && (
                <FormField
                  control={form.control}
                  name="idGolongan"
                  render={({ field }) => (
                    <FormItem className="col-start-2">
                      <FormLabel>Golongan pelanggan</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(v) => field.onChange(Number(v))}
                        disabled={terkunci}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full" aria-label="Golongan promo">
                            <SelectValue placeholder="Pilih golongan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(golongan.data ?? []).map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {sasaranPembeli === 'PELANGGAN' && (
                <FormField
                  control={form.control}
                  name="idPelanggan"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Pelanggan yang berhak</FormLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {(idPelanggan ?? []).map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-sm text-blue-800"
                          >
                            {namaPelanggan.get(id) ?? `#${id}`}
                            {!terkunci && (
                              <button
                                type="button"
                                aria-label={`Hapus ${namaPelanggan.get(id) ?? id}`}
                                onClick={() =>
                                  field.onChange((field.value ?? []).filter((x) => x !== id))
                                }
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {!terkunci && (
                        <PilihPelanggan
                          terpilih={null}
                          label="Tambah pelanggan"
                          onPilih={(p) => {
                            if (!p || (field.value ?? []).includes(p.id)) return;
                            setNamaPelanggan((m) => new Map(m).set(p.id, p.namaPelanggan));
                            field.onChange([...(field.value ?? []), p.id]);
                          }}
                        />
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="minBelanjaPelanggan"
                render={({ field }) => (
                  <FormItem className="col-start-1">
                    <FormLabel>Riwayat belanja pelanggan minimal</FormLabel>
                    <FormControl>
                      <InputRupiah
                        {...field}
                        disabled={terkunci}
                        placeholder="Tanpa syarat"
                        aria-label="Belanja pelanggan minimal"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hariBelanja"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>dalam … hari terakhir</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="mis. 30"
                        disabled={terkunci}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={
                          typeof field.value === 'number' || typeof field.value === 'string'
                            ? String(field.value)
                            : ''
                        }
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : e.target.value)
                        }
                        aria-label="Jumlah hari belanja"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            {/* K-110: batas uang promo. Boleh diubah walau promo sudah dipakai (bukan aturan potongan). */}
            <fieldset className="col-span-2 grid grid-cols-2 gap-4 rounded-lg border p-3">
              <legend className="px-1 text-xs font-medium text-slate-500">
                5. Batas uang promo (opsional)
              </legend>
              <FormField
                control={form.control}
                name="anggaran"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anggaran promo</FormLabel>
                    <FormControl>
                      <InputRupiah {...field} placeholder="Tanpa batas" />
                    </FormControl>
                    <FormDescription>
                      Jumlah seluruh potongan yang boleh diberikan promo ini. Setelah tercapai,
                      promo berhenti sendiri.
                      {promo && promo.totalDiskon > 0 && (
                        <> Sudah terpakai {formatRupiah(promo.totalDiskon)}.</>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maksPerPembeli"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potongan paling banyak per pembeli</FormLabel>
                    <FormControl>
                      <InputRupiah {...field} placeholder="Tanpa batas" />
                    </FormControl>
                    <FormDescription>
                      Supaya satu pembeli tidak menghabiskan anggaran. Pelanggan terdata: dijumlah
                      dari semua transaksinya. Pembeli umum: per transaksi. Harus lebih kecil dari
                      anggaran.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
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
                      placeholder="Opsional, mis. kerja sama pemasok"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={onTutup}>
                Batal
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Master promo (docs/06 §3, docs/04 §4 "Promo"): daftar, buat, ubah, nonaktifkan. Tidak ada hapus.
 * Sejak K-110 tampil sebagai tab Pengaturan › Promo (bukan menu sendiri).
 */
export function TabPromo() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useState<SaringStatus>('SEMUA');
  const [berlaku, setBerlaku] = useState<StatusBerlakuPromo | null>(null);
  const [halaman, setHalaman] = useState(1);
  /** K-163: daftar promo atau daftar templat kampanye. */
  const [modeTemplat, setModeTemplat] = useState(false);
  const [dialog, setDialog] = useState<{
    promo: Promo | null;
    dasar: Promo | null;
    templat: boolean;
  } | null>(null);

  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPromo({
    cari: cariTertunda,
    status,
    berlaku,
    templat: modeTemplat,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const ubahStatus = useStatusPromo();

  const kolom: KolomTabel<Promo>[] = [
    {
      kunci: 'kode',
      judul: 'Kode',
      className: 'w-28',
      sel: (p) => <span className="font-mono text-xs text-slate-500">{p.kode}</span>,
    },
    {
      kunci: 'nama',
      judul: 'Nama promo',
      sel: (p) => (
        <div className="max-w-48 whitespace-normal">
          <div className="font-medium">{p.nama}</div>
          {p.keterangan && <div className="text-xs text-slate-500">{p.keterangan}</div>}
        </div>
      ),
    },
    {
      kunci: 'periode',
      judul: 'Waktu',
      sel: (p) => (
        <div className="text-sm tabular-nums">
          {!p.templat && (
            <div className="whitespace-nowrap">
              {formatWaktu(p.mulaiPada)} –<br />
              {formatWaktu(p.selesaiPada)}
            </div>
          )}
          {uraianHariJam(p) && <div className="text-xs text-blue-700">{uraianHariJam(p)}</div>}
        </div>
      ),
    },
    { kunci: 'potongan', judul: 'Manfaat', sel: (p) => uraianPotongan(p) },
    {
      kunci: 'sasaran',
      judul: 'Berlaku untuk · syarat',
      sel: (p) => (
        <div className="max-w-52 space-y-0.5 whitespace-normal">
          <TeksLipat teks={uraianSasaran(p)} className="text-sm" />
          {uraianSyarat(p) !== '—' && (
            <div className="text-xs text-slate-500">{uraianSyarat(p)}</div>
          )}
        </div>
      ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      // Promo nonaktif tidak berlaku walau masanya berjalan; yang aktif ditandai menurut masanya.
      sel: (p) =>
        p.statusAktif === 'NONAKTIF' ? (
          <BadgeStatusAktif status="NONAKTIF" />
        ) : (
          <Badge variant="outline" className={cn(WARNA_BERLAKU[p.statusBerlaku])}>
            {LABEL_STATUS_BERLAKU_PROMO[p.statusBerlaku]}
          </Badge>
        ),
    },
    {
      kunci: 'pakai',
      judul: 'Terpakai',
      className: 'text-right',
      // K-110: uang promo yang sudah "mengucur", dan sisa anggarannya bila promo dibatasi.
      sel: (p) => (
        <div className="leading-tight" data-testid={`realisasi-promo-${p.id}`}>
          <div className="font-semibold tabular-nums">
            {p.totalDiskon > 0 ? formatRupiah(p.totalDiskon) : '—'}
          </div>
          <div className="text-xs text-slate-500">
            {p.jumlahPemakaian > 0 ? `${p.jumlahPemakaian} baris` : 'belum dipakai'}
          </div>
          {p.anggaran !== null && p.sisaAnggaran !== null && (
            <div
              className={cn(
                'text-xs tabular-nums',
                p.sisaAnggaran === 0 ? 'font-semibold text-red-600' : 'text-slate-500',
              )}
            >
              {p.sisaAnggaran === 0
                ? `anggaran ${formatRupiah(p.anggaran)} habis`
                : `sisa ${formatRupiah(p.sisaAnggaran)} dari ${formatRupiah(p.anggaran)}`}
            </div>
          )}
          {p.maksPerPembeli !== null && (
            <div className="text-xs text-slate-500 tabular-nums">
              maks. {formatRupiah(p.maksPerPembeli)}/pembeli
            </div>
          )}
        </div>
      ),
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (p) => (
        <MenuAksiMaster
          nama={p.nama}
          status={p.statusAktif}
          onUbah={() => setDialog({ promo: p, dasar: null, templat: p.templat })}
          tambahan={
            p.templat ? (
              <DropdownMenuItem
                onSelect={() => setDialog({ promo: null, dasar: p, templat: false })}
              >
                <CopyPlus /> Pakai templat (promo baru)
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() => setDialog({ promo: null, dasar: p, templat: true })}
              >
                <BookmarkPlus /> Simpan sebagai templat
              </DropdownMenuItem>
            )
          }
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: p.id, statusAktif }),
              `Promo ${p.nama} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
            )
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <h2 className="font-semibold text-slate-900">Promo</h2>
          <p className="text-sm text-slate-500">
            Potongan harga otomatis per baris barang selama periode promo, beserta jumlah potongan
            yang sudah diberikan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Penjelasan judul="Cara kerja promo">
            <ButirPenjelasan>
              <li>
                Promo (kampanye) = <b>waktu</b> + <b>barang</b> + <b>manfaat</b> + syarat. Waktu
                diisi sampai jam dan menit; boleh dibatasi hari tertentu dan jam harian (mis. happy
                hour 13:00–15:00). Barang: semua, atau beberapa barang/kategori/merk sekaligus.
              </li>
              <li>
                <b>Kombinasi</b>: tiap kelompok berisi kategori, merk, dan/atau barang yang harus
                cocok semuanya (kategori Cat DAN merk Avian = hanya cat Avian). Boleh beberapa
                kelompok; barang kena promo bila cocok dengan salah satunya.
              </li>
              <li>
                Manfaat: potongan persen; potongan rupiah per satuan; <b>harga khusus</b> = harga
                jual jadi per satuan (yang dibayar pembeli, mis. Rp 50.000 → Rp 48.000), bukan besar
                potongan; <b>beli X gratis Y</b> (barang yang sama; kasir mengetik seluruh qty yang
                dibawa, yang gratis dipotong otomatis); <b>beli N potong Rp X</b> per kelipatan N
                (beli 2 potong Rp 2.000: qty 5 dipotong Rp 4.000).
              </li>
              <li>
                <b>Templat kampanye</b> menyimpan isian promo untuk dipakai lagi (menu ⋯ › Simpan
                sebagai templat; di tampilan Templat: ⋯ › Pakai templat). Templat tidak pernah
                berlaku sendiri.
              </li>
              <li>
                Syarat boleh digabung: minimal qty barang itu, minimal total belanja transaksi,
                pembeli tertentu (golongan atau pelanggan), dan total belanja pelanggan dalam sekian
                hari terakhir.
              </li>
              <li>
                <b>Urutan hitung:</b> harga tier lebih dulu (menurut total belanja, diatur di Harga
                Jual), lalu potongan promo dihitung dari harga tier itu, lalu diskon dari kasir.
              </li>
              <li>
                Satu baris barang hanya mendapat satu promo. Bila beberapa promo cocok, dipakai yang
                potongannya terbesar.
              </li>
              <li>
                Promo yang membuat harga di bawah modal dilewati otomatis untuk Kasir dan Staf
                Penjualan. Promo tidak berlaku untuk baris berharga manual.
              </li>
              <li>
                <b>Potongan diberikan</b> = jumlah rupiah potongan promo itu di semua penjualan
                (penjualan yang di-void tidak dihitung). <b>Anggaran promo</b> membatasi jumlah itu:
                bila sisa anggaran lebih kecil dari potongan sebuah baris, baris itu hanya dipotong
                sebesar sisanya, dan setelah habis promo berhenti.{' '}
                <b>Potongan paling banyak per pembeli</b> mencegah satu pembeli menghabiskan
                anggaran.
              </li>
              <li>
                Status <b>Terjadwal</b> = belum mulai, <b>Berjalan</b> = sedang berlaku,{' '}
                <b>Berakhir</b> = lewat waktu selesai, <b>Nonaktif</b> = dimatikan. Aturan promo
                yang sudah dipakai di penjualan dikunci; untuk aturan lain buat promo baru.
              </li>
            </ButirPenjelasan>
          </Penjelasan>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Tampilan promo">
            {(
              [
                [false, 'Promo'],
                [true, 'Templat kampanye'],
              ] as const
            ).map(([nilai, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={modeTemplat === nilai}
                onClick={() => {
                  setModeTemplat(nilai);
                  setHalaman(1);
                }}
                className={cn(
                  'rounded px-3 py-1 text-sm font-medium',
                  modeTemplat === nilai
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button onClick={() => setDialog({ promo: null, dasar: null, templat: modeTemplat })}>
            <Plus /> {modeTemplat ? 'Buat templat' : 'Buat promo'}
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-3 border-b pr-3">
          <div className="flex-1">
            <BilahSaring
              cari={cari}
              onCari={(v) => {
                setCari(v);
                setHalaman(1);
              }}
              status={status}
              onStatus={(v) => {
                setStatus(v);
                setHalaman(1);
              }}
              placeholder="Cari kode atau nama promo…"
              label="Cari promo"
            />
          </div>
          <Select
            value={berlaku ?? SEMUA}
            onValueChange={(v) => {
              setBerlaku(v === SEMUA ? null : (v as StatusBerlakuPromo));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Saring masa promo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua masa</SelectItem>
              {STATUS_BERLAKU_PROMO.map((s) => (
                <SelectItem key={s} value={s}>
                  {LABEL_STATUS_BERLAKU_PROMO[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(p) => p.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong={
            modeTemplat
              ? 'Belum ada templat. Buka menu ⋯ sebuah promo › Simpan sebagai templat, atau Buat templat.'
              : 'Belum ada promo yang cocok.'
          }
        />
      </Card>

      {dialog && (
        <DialogPromo
          promo={dialog.promo}
          dasar={dialog.dasar}
          templat={dialog.templat}
          onTutup={() => setDialog(null)}
        />
      )}
    </div>
  );
}
