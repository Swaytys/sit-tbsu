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
  | 'shiftJamBuka'
  | 'shiftJamTutup'
  | 'barisPerHalaman'
  | 'batasReturTanpaSetuju'
  | 'batasVoidTanpaSetuju'
  | 'poBatasTanpaPersetujuan'
  | 'poBatasKepalaToko'
  | 'penerimaanTanpaPoDibatasi'
  | 'penerimaanTanpaPoBatas'
  | 'poPenerimaBeda'
  | 'hutangBatasKepalaToko'
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
    nama: 'toleransiSelisihKas',
    label: 'Toleransi selisih kas',
    satuan: 'rupiah',
    ket: 'Selisih tutup shift sampai nilai ini ditandai "selisih receh" dan tidak perlu keterangan.',
  },
  {
    nama: 'batasHitungBukaMenit',
    label: 'Batas hitung susulan',
    satuan: 'menit',
    ket: 'Shift yang dibuka dengan "hitung nanti" harus dihitung dalam waktu ini (diingatkan).',
  },
  {
    nama: 'saranPesanPeriodeHari',
    label: 'Pengadaan: periode penjualan',
    satuan: 'hari',
    ket: 'Rata-rata jual per hari dihitung dari penjualan sekian hari terakhir (sampai kemarin).',
  },
  {
    nama: 'saranPesanHariPengaman',
    label: 'Pengadaan: stok pengaman',
    satuan: 'hari',
    ket: 'Cadangan = rata-rata jual per hari × hari ini, untuk penjualan ramai/kiriman telat.',
  },
  {
    nama: 'saranPesanLamaKirim',
    label: 'Pengadaan: lama kirim bawaan',
    satuan: 'hari',
    ket: 'Dipakai bila lama kirim di Data Pemasok kosong.',
  },
  {
    nama: 'saranPesanJarakBelanja',
    label: 'Pengadaan: belanja tiap',
    satuan: 'hari',
    ket: 'Dipakai bila jarak belanja di Data Pemasok kosong.',
  },
  {
    nama: 'muatanFaktorIsiPersen',
    label: 'Muatan: faktor isi bak',
    satuan: '%',
    ket: 'Bagian ruang bak yang realistis terisi barang (barang tidak pernah rapat 100%). Bawaan 85%.',
  },
  {
    nama: 'muatanToleransiPersen',
    label: 'Muatan: batas toleransi',
    satuan: '%',
    ket: 'Berat/ruang di atas 100% sampai angka ini boleh berangkat dengan alasan tertulis; di atasnya rit tidak bisa berangkat (ganti kendaraan). Bawaan 110%.',
  },
  {
    nama: 'muatanJulurMaksCm',
    label: 'Muatan: julur maksimum',
    satuan: 'cm',
    ket: 'Barang boleh lebih panjang dari bak sampai sekian cm, dengan alasan tertulis. Sesuaikan aturan/kebijakan toko.',
  },
  {
    nama: 'poAmbangNaikPersen',
    label: 'Order pembelian: ambang naik harga',
    satuan: '%',
    ket: 'Harga beli di order yang naik lebih dari persen ini dari harga beli terakhir wajib disetujui (K-225).',
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
  nama:
    'autoBatalOrderBasi' | 'checkoutWajibShift' | 'penerimaanTanpaPoDibatasi' | 'poPenerimaBeda';
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
          </div>
          {/* K-099: batas nilai retur/void yang boleh diproses Kasir tanpa atasan. */}
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Retur dan void tanpa persetujuan atasan</p>
            <p className="text-muted-foreground text-sm">
              Kasir boleh memproses sendiri retur/void sampai nilai ini per transaksi (retur atau
              void sebelumnya atas transaksi yang sama ikut dihitung). Di atas nilai ini butuh
              Admin/Owner: lewat kode sekali pakai yang dikirim ke atasan (tab Persetujuan) atau
              dari akun atasan sendiri. Isi Rp 0 bila semua retur/void harus disetujui atasan.
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
          {/* K-225: persetujuan order pembelian (pemisahan tugas siklus pembelian). */}
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Persetujuan order pembelian</p>
            <p className="text-muted-foreground text-sm">
              Order pembelian di atas batas pertama, berisi barang yang ditandai wajib disetujui
              Owner, harga belinya naik melewati ambang, atau harganya belum diisi, harus diajukan
              dan disetujui dulu sebelum dikirim ke pemasok. Pembuat order tidak bisa menyetujui
              ordernya sendiri. Kepala Toko menyetujui sampai batas kedua; di atasnya hanya Owner.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {(
                [
                  { nama: 'poBatasTanpaPersetujuan', label: 'Boleh tanpa persetujuan sampai' },
                  { nama: 'poBatasKepalaToko', label: 'Kepala Toko menyetujui sampai' },
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
                        <InputRupiah {...field} onChange={(v) => field.onChange(v ?? 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
          {/* K-225 tahap 3: pengendalian penerimaan barang. */}
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Penerimaan barang</p>
            <Saklar
              control={form.control}
              nama="penerimaanTanpaPoDibatasi"
              label="Pembelian tanpa order pembelian dibatasi"
              ket="Bila aktif, penerimaan tanpa order hanya untuk pembelian tunai sampai batas di bawah; di atasnya atau tempo wajib lewat order pembelian. Owner tetap boleh. Penerimaan tanpa order bisa ditinjau di Penerimaan Barang › Tanpa order."
            />
            <FormField
              control={form.control}
              name="penerimaanTanpaPoBatas"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Batas pembelian tunai tanpa order</FormLabel>
                  <FormControl>
                    <InputRupiah {...field} onChange={(v) => field.onChange(v ?? 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hutangBatasKepalaToko"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Kepala Toko membayar hutang sampai (per pembayaran)</FormLabel>
                  <FormControl>
                    <InputRupiah {...field} onChange={(v) => field.onChange(v ?? 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Saklar
              control={form.control}
              nama="poPenerimaBeda"
              label="Penerima barang bukan pembuat order"
              ket="Bila aktif, pembuat order pembelian tidak bisa mencatat penerimaan ordernya sendiri (Owner tetap boleh). Matikan bila karyawan sedikit; siapa membuat dan siapa menerima tetap tercatat."
            />
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
          {/* K-109: jadwal shift toko; dibekukan ke tiap shift saat shift itu dibuka. */}
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Jadwal shift</p>
            <p className="text-muted-foreground text-sm">
              Jam toko biasanya membuka dan menutup shift. Dipakai untuk mengingatkan, bukan menutup
              otomatis (menutup shift butuh hitungan uang di laci):
            </p>
            <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5 text-sm">
              <li>15 menit sebelum jam tutup: pengingat biru di layar kasir.</li>
              <li>
                Lewat jam tutup: peringatan kuning di layar kasir, notifikasi lonceng, dan pesan
                Telegram/email ke Admin/Owner. Penjualan masih bisa.
              </li>
              <li>
                Ganti hari dan shift belum ditutup: penjualan dan pencatatan uang kasir itu terkunci
                sampai shiftnya ditutup (berlaku juga tanpa jadwal).
              </li>
              <li>
                <b>Perubahan jadwal baru berlaku untuk shift yang dibuka setelah disimpan.</b> Shift
                yang sedang berjalan tetap memakai jadwal saat ia dibuka.
              </li>
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {(
                [
                  { nama: 'shiftJamBuka', label: 'Jam buka shift' },
                  { nama: 'shiftJamTutup', label: 'Jam tutup shift' },
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
                        <Input type="time" {...field} className="w-40" />
                      </FormControl>
                      <FormDescription>
                        Kosongkan bila tidak memakai jadwal. Contoh: 09:00 dan 17:30.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
        </KartuBagian>
      </form>
    </Form>
  );
}
