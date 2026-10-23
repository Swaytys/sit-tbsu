import { zodResolver } from '@hookform/resolvers/zod';
import {
  JENIS_REKENING,
  LABEL_JENIS_REKENING,
  labelRekening,
  skemaRekening,
  type DataRekening,
  type InputRekening,
  type JenisRekening,
  type RekeningToko,
  type StatusAktif,
} from '@sit/shared';
import { Landmark, Plus, Star } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useDaftarRekening, useSimpanRekening, useStatusRekening } from '@/api/rekening';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
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
import { Skeleton } from '@/components/ui/skeleton';
import { jalankanDenganToast } from '@/lib/aksi';
import { tampilkanGalatForm } from '@/lib/form';

/** Teks isian menurut jenis rekening: apa yang ditulis di tiap kolom. */
const ISIAN: Record<JenisRekening, { bank: string; contohBank: string; nomor: string }> = {
  TRANSFER: {
    bank: 'Nama bank',
    contohBank: 'mis. BCA',
    nomor: 'Nomor rekening',
  },
  EDC: {
    bank: 'Nama mesin EDC',
    contohBank: 'mis. EDC BRI',
    nomor: 'Nomor terminal / TID (opsional)',
  },
  QRIS: {
    bank: 'Nama QRIS',
    contohBank: 'mis. QRIS BCA',
    nomor: 'ID merchant / NMID (opsional)',
  },
};

function DialogRekening({
  rekening,
  jenisAwal,
  onTutup,
}: {
  rekening: RekeningToko | null;
  jenisAwal: JenisRekening;
  onTutup: () => void;
}) {
  const simpan = useSimpanRekening();
  const form = useForm<InputRekening, unknown, DataRekening>({
    resolver: zodResolver(skemaRekening),
    defaultValues: {
      jenis: rekening?.jenis ?? jenisAwal,
      bank: rekening?.bank ?? '',
      nomor: rekening?.nomor ?? '',
      atasNama: rekening?.atasNama ?? '',
      isDefault: rekening?.isDefault ?? false,
    },
  });
  const [jenis, bank, nomor, atasNama] = useWatch({
    control: form.control,
    name: ['jenis', 'bank', 'nomor', 'atasNama'],
  });
  const isian = ISIAN[jenis];

  async function kirim(data: DataRekening) {
    try {
      const hasil = await simpan.mutateAsync({ id: rekening?.id, json: data });
      toast.success(
        rekening ? `Rekening ${hasil.nama} disimpan.` : `Rekening ${hasil.nama} ditambahkan.`,
      );
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['jenis', 'bank', 'nomor', 'atasNama', 'isDefault']);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {rekening ? 'Ubah rekening penerimaan' : 'Tambah rekening penerimaan'}
          </DialogTitle>
          <DialogDescription>
            Rekening, mesin EDC, atau QRIS tempat toko menerima pembayaran non-tunai. Kasir memilih
            dari daftar ini, jadi tulis sejelas yang ingin terbaca di layar kasir.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="jenis"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Jenis</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full" aria-label="Jenis rekening">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {JENIS_REKENING.map((j) => (
                        <SelectItem key={j} value={j}>
                          {LABEL_JENIS_REKENING[j]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Menentukan pada cara bayar mana rekening ini muncul di layar kasir: Transfer,
                    EDC, atau QRIS.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bank"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isian.bank}</FormLabel>
                  <FormControl>
                    <Input placeholder={isian.contohBank} maxLength={30} autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nomor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isian.nomor}</FormLabel>
                  <FormControl>
                    <Input maxLength={30} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="atasNama"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Atas nama (opsional)</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={40}
                      placeholder="mis. UD Sumber Urip"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="col-span-2 rounded-md bg-slate-50 p-2 text-sm">
              Tampil di layar kasir dan tercatat di pembayaran sebagai:{' '}
              <b>{bank ? labelRekening({ bank, nomor, atasNama }) : '(isi nama dulu)'}</b>
            </p>
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="col-span-2 flex items-start gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="font-normal">
                      Jadikan bawaan untuk {LABEL_JENIS_REKENING[jenis]}
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Rekening bawaan langsung terpilih saat kasir memilih cara bayar ini, sehingga
                      kasir tidak perlu memilih apa pun. Satu bawaan per jenis.
                    </FormDescription>
                  </div>
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
 * Pengaturan › Pembayaran (K-111, U12): daftar rekening penerimaan (bank/e-wallet, EDC, QRIS) milik toko. Kasir memilih dari
 * daftar ini saat menerima pembayaran non-tunai (tidak mengetik nomor), dan daftar yang sama dipakai untuk
 * refund lewat transfer serta pengecekan uang masuk. Rekening tidak dihapus; dinonaktifkan.
 */
export function TabPembayaran() {
  const daftar = useDaftarRekening('SEMUA');
  const simpan = useSimpanRekening();
  const ubahStatus = useStatusRekening();
  const [dialog, setDialog] = useState<{
    rekening: RekeningToko | null;
    jenis: JenisRekening;
  } | null>(null);

  if (!daftar.data) {
    return daftar.error ? (
      <p className="text-sm text-red-600">{pesanGalat(daftar.error)}</p>
    ) : (
      <Skeleton className="h-64 w-full" />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80 space-y-1 text-sm text-slate-600">
          <h2 className="font-semibold text-slate-900">Rekening penerima pembayaran non-tunai</h2>
          <p>
            Daftarkan sekali semua tempat toko menerima uang non-tunai: rekening bank dan e-wallet
            (OVO, GoPay, DANA, ShopeePay; dipilih saat <b>Transfer</b>), mesin EDC, dan QRIS. Kasir
            hanya memilih dari daftar ini (yang bertanda <b>Bawaan</b> terpilih sendiri) dan mengisi
            No. referensinya; tujuan tidak bisa diketik. Cara bayar yang belum punya rekening di
            sini tidak bisa dipakai di kasir.
          </p>
        </div>
        <Penjelasan judul="Cara kerja rekening penerimaan dan pengecekan uang masuk">
          <ButirPenjelasan>
            <li>
              <b>Tiga jenis.</b> <i>Rekening bank / e-wallet</i> muncul saat kasir memilih Transfer
              (e-wallet seperti OVO/GoPay/DANA termasuk di sini), <i>Mesin EDC</i> saat memilih EDC
              (kartu debit/kredit), dan <i>QRIS</i> saat memilih QRIS.
            </li>
            <li>
              <b>Bawaan.</b> Tiap jenis boleh punya satu rekening bawaan; itulah yang langsung
              terpilih di layar kasir. Bila toko hanya punya satu rekening untuk sebuah jenis,
              jadikan ia bawaan supaya kasir tidak perlu memilih.
            </li>
            <li>
              <b>Nonaktifkan, bukan hapus.</b> Rekening yang tidak dipakai lagi dinonaktifkan agar
              hilang dari pilihan kasir; pembayaran lama yang memakainya tetap utuh.
            </li>
            <li>
              <b>Uang benar-benar masuk?</b> Sistem ini tidak tersambung ke bank, jadi tiap
              pembayaran non-tunai dicatat kasir dengan status <i>Belum dicek</i>. Admin/Owner
              membuka <b>Shift &amp; Clerical Check › Cek uang non-tunai</b>, mencocokkannya dengan
              mutasi m-banking (atau rekap settlement EDC, atau riwayat QRIS), lalu menandai{' '}
              <i>Sudah masuk</i> atau <i>Tidak masuk</i>.
            </li>
            <li>
              <b>Kenapa tidak otomatis?</b> Membaca mutasi rekening secara otomatis hanya bisa lewat
              kerja sama resmi dengan bank atau penyedia pembayaran (payment gateway), yang berbayar
              per transaksi. Itu dicatat sebagai rencana pengembangan; daftar rekening ini sudah
              menjadi dasarnya.
            </li>
            <li>
              <b>Refund retur/void lewat transfer</b> juga memilih rekening asal uangnya dari daftar
              ini.
            </li>
            <li>
              <b>No. referensi wajib</b> (4–40 huruf/angka) untuk tiap pembayaran non-tunai: nomor
              referensi di bukti transfer, nomor approval/trace di struk EDC, atau nomor referensi
              di notifikasi QRIS. Nomor inilah yang dicocokkan saat cek uang masuk.
            </li>
          </ButirPenjelasan>
        </Penjelasan>
      </div>

      {JENIS_REKENING.map((jenis) => {
        const isi = daftar.data.filter((r) => r.jenis === jenis);
        const adaBawaan = isi.some((r) => r.isDefault && r.statusAktif === 'AKTIF');
        return (
          <Card
            key={jenis}
            className="gap-0 overflow-hidden py-0"
            data-testid={`rekening-${jenis}`}
          >
            <div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Landmark className="size-4 text-blue-600" /> {LABEL_JENIS_REKENING[jenis]}
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialog({ rekening: null, jenis })}
              >
                <Plus /> Tambah
              </Button>
            </div>
            {isi.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">
                Belum ada. Selama kosong, kasir yang memilih cara bayar ini diminta mengetik
                tujuannya sendiri.
              </p>
            ) : (
              <ul className="divide-y">
                {isi.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{r.nama}</div>
                    </div>
                    {r.isDefault && r.statusAktif === 'AKTIF' && (
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700"
                        title="Langsung terpilih di layar kasir untuk cara bayar ini."
                      >
                        <Star /> Bawaan
                      </Badge>
                    )}
                    <BadgeStatusAktif status={r.statusAktif} />
                    <MenuAksiMaster
                      nama={r.nama}
                      status={r.statusAktif}
                      onUbah={() => setDialog({ rekening: r, jenis: r.jenis })}
                      onUbahStatus={(statusAktif: StatusAktif) =>
                        void jalankanDenganToast(
                          ubahStatus.mutateAsync({ id: r.id, statusAktif }),
                          `Rekening ${r.nama} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
                        )
                      }
                      tambahan={
                        r.statusAktif === 'AKTIF' && !r.isDefault ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              void jalankanDenganToast(
                                simpan.mutateAsync({
                                  id: r.id,
                                  json: {
                                    jenis: r.jenis,
                                    bank: r.bank,
                                    nomor: r.nomor,
                                    atasNama: r.atasNama,
                                    isDefault: true,
                                  },
                                }),
                                `${r.nama} menjadi bawaan ${LABEL_JENIS_REKENING[r.jenis]}.`,
                              )
                            }
                          >
                            <Star /> Jadikan bawaan
                          </DropdownMenuItem>
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            {isi.some((r) => r.statusAktif === 'AKTIF') && !adaBawaan && (
              <p className="border-t bg-amber-50 px-5 py-2 text-xs text-amber-900">
                Belum ada bawaan untuk jenis ini: yang terpilih di layar kasir adalah baris pertama.
                Buka menu titik tiga › <b>Jadikan bawaan</b> pada rekening yang paling sering
                dipakai.
              </p>
            )}
          </Card>
        );
      })}

      {dialog && (
        <DialogRekening
          rekening={dialog.rekening}
          jenisAwal={dialog.jenis}
          onTutup={() => setDialog(null)}
        />
      )}
    </div>
  );
}
