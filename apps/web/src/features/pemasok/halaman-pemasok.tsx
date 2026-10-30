import { zodResolver } from '@hookform/resolvers/zod';
import {
  skemaPemasok,
  type DataPemasok,
  type InputPemasok,
  type Pemasok,
  type StatusAktif,
  type DataMirip,
} from '@sit/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useDaftarPemasok, useSimpanPemasok, useStatusPemasok } from '@/api/mitra';
import { useCariUrl } from '@/lib/use-cari-url';
import { TeksLipat } from '@/components/teks-lipat';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { BilahSaring, type SaringStatus } from '@/components/bilah-saring';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { InputNoHp } from '@/components/input-no-hp';
import { PanelMirip } from '@/components/panel-mirip';
import { miripDariGalat } from '@/lib/mirip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { jalankanDenganToast } from '@/lib/aksi';
import { tampilkanGalatForm } from '@/lib/form';
import { useTunda } from '@/lib/use-tunda';
import { useIngat } from '@/lib/ingat-saring';

function DialogPemasok({ pemasok, onTutup }: { pemasok: Pemasok | null; onTutup: () => void }) {
  const simpan = useSimpanPemasok();
  const form = useForm<InputPemasok, unknown, DataPemasok>({
    resolver: zodResolver(skemaPemasok),
    defaultValues: {
      namaPemasok: pemasok?.namaPemasok ?? '',
      noHp: pemasok?.noHp ?? '',
      kontakPerson: pemasok?.kontakPerson ?? '',
      alamat: pemasok?.alamat ?? '',
      keterangan: pemasok?.keterangan ?? '',
      lamaKirimHari: pemasok?.lamaKirimHari ?? '',
      jarakBelanjaHari: pemasok?.jarakBelanjaHari ?? '',
      versi: pemasok?.versi ?? null,
    },
  });

  const [mirip, setMirip] = useState<DataMirip[] | null>(null);

  async function kirim(data: DataPemasok) {
    setMirip(null);
    try {
      const hasil = await simpan.mutateAsync({ id: pemasok?.id, json: data });
      toast.success(
        pemasok
          ? `Data ${hasil.namaPemasok} disimpan.`
          : `Pemasok ${hasil.namaPemasok} ditambahkan (${hasil.kode}).`,
      );
      onTutup();
    } catch (err) {
      const m = miripDariGalat(err);
      if (m) {
        setMirip(m);
        return;
      }
      tampilkanGalatForm(err, form.setError, [
        'namaPemasok',
        'noHp',
        'kontakPerson',
        'alamat',
        'keterangan',
        'lamaKirimHari',
        'jarakBelanjaHari',
      ]);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pemasok ? `Ubah pemasok ${pemasok.kode}` : 'Tambah pemasok'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(kirim)(e)}
            className="grid grid-cols-2 gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="namaPemasok"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nama pemasok</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama perusahaan / toko" autoFocus {...field} />
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
                  <FormLabel>No. HP / telepon</FormLabel>
                  <FormControl>
                    <InputNoHp value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kontakPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontak person</FormLabel>
                  <FormControl>
                    <Input placeholder="opsional" {...field} value={field.value ?? ''} />
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
            {(['lamaKirimHari', 'jarakBelanjaHari'] as const).map((nama) => (
              <FormField
                key={nama}
                control={form.control}
                name={nama}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {nama === 'lamaKirimHari' ? 'Lama kirim (hari)' : 'Belanja tiap (hari)'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="kosong = bawaan toko"
                        {...field}
                        value={
                          typeof field.value === 'number' || typeof field.value === 'string'
                            ? String(field.value)
                            : ''
                        }
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {nama === 'lamaKirimHari'
                        ? 'Dari memesan sampai barang tiba. Dipakai saran pesan ulang.'
                        : 'Jarak antara dua kali belanja ke pemasok ini.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
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
                      placeholder="Mis. barang yang dipasok, syarat pembayaran…"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mirip && (
              <div className="col-span-2">
                <PanelMirip
                  mirip={mirip}
                  apa="Pemasok"
                  jenis="pemasok"
                  idIni={pemasok?.id ?? null}
                  onTerhapus={({ ini }) => (ini ? onTutup() : setMirip(null))}
                  onTetapSimpan={() =>
                    void form.handleSubmit((d) => kirim({ ...d, abaikanMirip: true }))()
                  }
                />
              </div>
            )}
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

export function HalamanPemasok() {
  const [cari, setCari] = useCariUrl('pemasok');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useIngat<SaringStatus>('pemasok.status', 'SEMUA');
  const [halaman, setHalaman] = useIngat('pemasok.halaman', 1);
  const [dialog, setDialog] = useState<{ pemasok: Pemasok | null } | null>(null);

  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPemasok({
    cari: cariTertunda,
    status,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const ubahStatus = useStatusPemasok();

  const kolom: KolomTabel<Pemasok>[] = [
    {
      kunci: 'kode',
      judul: 'Kode',
      className: 'w-28',
      sel: (p) => <span className="font-mono text-xs text-slate-500">{p.kode}</span>,
    },
    {
      kunci: 'nama',
      judul: 'Nama pemasok',
      sel: (p) => (
        <div>
          <div className="font-medium">{p.namaPemasok}</div>
          {p.keterangan && <div className="text-xs text-slate-500">{p.keterangan}</div>}
        </div>
      ),
    },
    { kunci: 'hp', judul: 'No. HP', sel: (p) => p.noHp ?? '—' },
    { kunci: 'kontak', judul: 'Kontak person', sel: (p) => p.kontakPerson ?? '—' },
    {
      kunci: 'alamat',
      judul: 'Alamat',
      sel: (p) => <TeksLipat teks={p.alamat ?? '—'} className="max-w-64 text-xs text-slate-500" />,
    },
    { kunci: 'status', judul: 'Status', sel: (p) => <BadgeStatusAktif status={p.statusAktif} /> },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (p) => (
        <MenuAksiMaster
          nama={p.namaPemasok}
          status={p.statusAktif}
          onUbah={() => setDialog({ pemasok: p })}
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: p.id, statusAktif }),
              `Pemasok ${p.namaPemasok} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
            )
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-xl font-semibold text-slate-900">Data Pemasok</h1>
          <p className="text-sm text-slate-500">Kelola daftar pemasok barang.</p>
        </div>
        <Button onClick={() => setDialog({ pemasok: null })}>
          <Plus /> Tambah pemasok
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
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
          placeholder="Cari nama, kode, No. HP, atau kontak…"
          label="Cari pemasok"
        />
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(p) => p.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Tidak ada pemasok yang cocok."
        />
      </Card>

      {dialog && <DialogPemasok pemasok={dialog.pemasok} onTutup={() => setDialog(null)} />}
    </div>
  );
}
