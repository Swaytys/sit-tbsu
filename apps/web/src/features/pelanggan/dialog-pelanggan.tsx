import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  skemaPelanggan,
  type BawaanPelanggan,
  type DataPelanggan,
  type InputPelanggan,
  type Pelanggan,
} from '@sit/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import {
  useBawaanPelanggan,
  useDaftarGolongan,
  useMintaKodePelanggan,
  useSimpanPelanggan,
} from '@/api/mitra';
import { DialogKodeAtasan } from '@/components/dialog-kode-atasan';
import { InputAngka } from '@/components/input-angka';
import { InputRupiah } from '@/components/input-rupiah';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
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
import { tampilkanGalatForm } from '@/lib/form';

const TANPA_GOLONGAN = 'TANPA';

/** Ringkasan golongan/term/limit untuk pengguna tanpa izin mengaturnya. */
function ringkasKredit(p: Pelanggan | null): string {
  if (!p) return 'Pelanggan baru: tanpa golongan, term bawaan toko, tanpa limit kredit.';
  const golongan = p.namaGolongan ?? 'tanpa golongan';
  const limit = p.limitKredit === null ? 'tanpa limit' : `limit ${formatRupiah(p.limitKredit)}`;
  return `${golongan} · term ${p.termHari} hari · ${limit}.`;
}

export function DialogPelanggan(p: {
  pelanggan: Pelanggan | null;
  onTutup: () => void;
  /** Dipanggil setelah tersimpan, mis. layar kasir langsung memakai pelanggan yang baru dibuat. */
  onTersimpan?: (p: Pelanggan) => void;
}) {
  // Pelanggan baru: term dan limit bawaan toko dimuat dulu supaya langsung terisi di form (K-104).
  const bawaan = useBawaanPelanggan(p.pelanggan === null);
  if (p.pelanggan === null && bawaan.isLoading) return null;
  return <IsiDialogPelanggan {...p} bawaan={bawaan.data ?? null} />;
}

function IsiDialogPelanggan({
  pelanggan,
  bawaan,
  onTutup,
  onTersimpan,
}: {
  pelanggan: Pelanggan | null;
  bawaan: BawaanPelanggan | null;
  onTutup: () => void;
  onTersimpan?: (p: Pelanggan) => void;
}) {
  const saya = usePengguna();
  const bolehKredit = saya.izin.includes('master.pelanggan.atur_kredit');
  const golongan = useDaftarGolongan();
  const simpan = useSimpanPelanggan();
  const mintaKode = useMintaKodePelanggan();
  // K-107: mengubah pelanggan yang sudah ada tanpa izin atur kredit butuh kode sekali pakai dari atasan.
  const butuhKode = pelanggan !== null && !bolehKredit;
  const [menungguKode, setMenungguKode] = useState<DataPelanggan | null>(null);

  const form = useForm<InputPelanggan, unknown, DataPelanggan>({
    resolver: zodResolver(skemaPelanggan),
    defaultValues: {
      namaPelanggan: pelanggan?.namaPelanggan ?? '',
      noHp: pelanggan?.noHp ?? '',
      email: pelanggan?.email ?? '',
      alamat: pelanggan?.alamat ?? '',
      keterangan: pelanggan?.keterangan ?? '',
      idGolongan: pelanggan?.idGolongan ?? null,
      // Kosong = term bawaan toko (konfigurasi), diisi API.
      termHari: pelanggan?.termHari ?? '',
      limitKredit: pelanggan ? pelanggan.limitKredit : (bawaan?.limitKredit ?? null),
      jadikanLimitBawaan: false,
    },
  });

  // Dibaca saat render agar react-hook-form memperbaruinya (formState hanya melacak yang dibaca di render).
  const adaPerubahan = form.formState.isDirty;

  // Golongan nonaktif tetap tampil bila sedang dipakai pelanggan ini.
  const pilihanGolongan = (golongan.data ?? []).filter(
    (g) => g.statusAktif === 'AKTIF' || g.id === pelanggan?.idGolongan,
  );

  async function kirim(data: DataPelanggan) {
    // Tanpa izin: kolom kredit tidak dikirim, sehingga API memakai bawaan / nilai lama (K-059).
    const json: DataPelanggan = bolehKredit
      ? data
      : {
          ...data,
          idGolongan: undefined,
          termHari: undefined,
          limitKredit: undefined,
          jadikanLimitBawaan: undefined,
        };
    if (butuhKode) {
      if (!adaPerubahan) {
        onTutup();
        return;
      }
      setMenungguKode(json);
      return;
    }
    try {
      const hasil = await simpan.mutateAsync({ id: pelanggan?.id, json });
      toast.success(
        pelanggan
          ? `Data ${hasil.namaPelanggan} disimpan.`
          : `Pelanggan ${hasil.namaPelanggan} ditambahkan (${hasil.kode}).`,
      );
      onTersimpan?.(hasil);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'namaPelanggan',
        'noHp',
        'email',
        'alamat',
        'keterangan',
        'idGolongan',
        'termHari',
        'limitKredit',
      ]);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {pelanggan ? `Ubah pelanggan ${pelanggan.kode}` : 'Tambah pelanggan'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="namaPelanggan"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nama pelanggan</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama lengkap / nama usaha" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="noHp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>No. HP</FormLabel>
                  <FormControl>
                    <Input inputMode="tel" placeholder="08xx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="opsional"
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
              name="alamat"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {bolehKredit ? (
              <fieldset className="col-span-2 grid grid-cols-[1fr_7rem_1fr] gap-4 rounded-lg border p-3">
                <legend className="px-1 text-xs font-medium text-slate-500">
                  Golongan &amp; kredit
                </legend>
                <FormField
                  control={form.control}
                  name="idGolongan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Golongan</FormLabel>
                      <Select
                        value={field.value == null ? TANPA_GOLONGAN : String(field.value)}
                        onValueChange={(v) =>
                          field.onChange(v === TANPA_GOLONGAN ? null : Number(v))
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full" aria-label="Golongan pelanggan">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={TANPA_GOLONGAN}>Tanpa golongan</SelectItem>
                          {pilihanGolongan.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">Untuk sasaran promo.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="termHari"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Term (hari)</FormLabel>
                      <FormControl>
                        <InputAngka {...field} min={0} max={365} placeholder="Bawaan" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="limitKredit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limit kredit</FormLabel>
                      <FormControl>
                        <InputRupiah {...field} placeholder="Tanpa limit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!pelanggan && (
                  <FormField
                    control={form.control}
                    name="jadikanLimitBawaan"
                    render={({ field }) => (
                      <FormItem className="col-span-3 flex items-start gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value === true}
                            onCheckedChange={(v) => field.onChange(v === true)}
                          />
                        </FormControl>
                        <div className="space-y-0.5">
                          <FormLabel className="font-normal">
                            Jadikan limit ini bawaan untuk pelanggan baru berikutnya
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Bawaan sekarang:{' '}
                            {bawaan?.limitKredit == null
                              ? 'tanpa limit'
                              : formatRupiah(bawaan.limitKredit)}
                            . Kosongkan limit lalu centang untuk kembali ke tanpa limit.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                <FormDescription className="col-span-3">
                  Term = jatuh tempo piutang sejak tanggal transaksi. Penjualan tidak lunas yang
                  membuat piutang pelanggan melewati limit butuh persetujuan Admin/Owner.
                </FormDescription>
              </fieldset>
            ) : (
              <p className="col-span-2 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
                {ringkasKredit(pelanggan)} Tier, term, dan limit kredit diatur Admin/Owner.
              </p>
            )}

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
                      placeholder="Catatan tambahan…"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {butuhKode && (
              <p className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                Mengubah data pelanggan yang sudah ada butuh persetujuan Admin/Owner. Setelah
                menekan tombol di bawah, sistem mengirim kode sekali pakai beserta rincian perubahan
                ke atasan; ketik kode yang disebutkan atasan untuk menyimpan.
              </p>
            )}
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={onTutup}>
                Batal
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Menyimpan…'
                  : butuhKode
                    ? 'Simpan dengan persetujuan…'
                    : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        {menungguKode && pelanggan && (
          <DialogKodeAtasan
            judul="Persetujuan perubahan data pelanggan"
            ringkasan={
              <>
                Perubahan data <b>{pelanggan.namaPelanggan}</b> ({pelanggan.kode}):
                <ul className="mt-1 list-disc pl-5">
                  {PERUBAHAN.filter(([k]) => (pelanggan[k] ?? '') !== (menungguKode[k] ?? '')).map(
                    ([k, label]) => (
                      <li key={k}>
                        {label}: {pelanggan[k] || '(kosong)'} → {menungguKode[k] || '(kosong)'}
                      </li>
                    ),
                  )}
                </ul>
              </>
            }
            mintaKode={() =>
              mintaKode.mutateAsync({
                id: pelanggan.id,
                json: { aksi: 'UBAH', data: menungguKode },
              })
            }
            kunci={`pelanggan-ubah:${pelanggan.id}:${JSON.stringify(menungguKode)}`}
            memproses={simpan.isPending}
            onTutup={() => setMenungguKode(null)}
            onSetujui={(kodeAtasan) =>
              void simpan
                .mutateAsync({ id: pelanggan.id, json: menungguKode, kodeAtasan })
                .then((hasil) => {
                  toast.success(`Data ${hasil.namaPelanggan} disimpan.`);
                  onTersimpan?.(hasil);
                  onTutup();
                })
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Kolom yang bisa diubah tanpa izin atur kredit, untuk ringkasan di dialog kode. */
const PERUBAHAN = [
  ['namaPelanggan', 'Nama'],
  ['noHp', 'No. HP'],
  ['email', 'Email'],
  ['alamat', 'Alamat'],
  ['keterangan', 'Keterangan'],
] as const;
