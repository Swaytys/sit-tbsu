import { zodResolver } from '@hookform/resolvers/zod';
import {
  skemaKendaraan,
  skemaSopir,
  type DataKendaraan,
  type DataSopir,
  type InputKendaraan,
  type InputSopir,
  type Kendaraan,
  type SedangJalan,
  type Sopir,
  type StatusAktif,
} from '@sit/shared';
import { History, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useDaftarKendaraan,
  useDaftarPerjalanan,
  useDaftarSopir,
  useSimpanKendaraan,
  useSimpanSopir,
  useStatusKendaraan,
  useStatusSopir,
} from '@/api/armada';
import { usePengguna } from '@/api/auth';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { InputNoHp } from '@/components/input-no-hp';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { jalankanDenganToast } from '@/lib/aksi';
import { formatWaktu } from '@/lib/format';
import { tampilkanGalatForm } from '@/lib/form';
import { SelKesehatan } from './kesehatan';

/** Tanda "sedang jalan" (K-150): kendaraan/sopir ini belum bisa dipakai perjalanan lain. */
export function BadgeJalan({ jalan }: { jalan: SedangJalan | null }) {
  if (!jalan) return <span className="text-xs text-slate-400">Di toko</span>;
  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
      Sedang jalan · {jalan.nomor} · {formatWaktu(jalan.waktuBerangkat).slice(11)}
    </Badge>
  );
}

/** Isian bilangan bulat (kg/cm); kosong = null. */
function IsianBulat({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      inputMode="numeric"
      className="text-right"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 6);
        onChange(v === '' ? null : Number(v));
      }}
    />
  );
}

function DialogKendaraan({ k, onTutup }: { k: Kendaraan | null; onTutup: () => void }) {
  const simpan = useSimpanKendaraan();
  const form = useForm<InputKendaraan, unknown, DataKendaraan>({
    resolver: zodResolver(skemaKendaraan),
    defaultValues: {
      plat: k?.plat ?? '',
      jenis: k?.jenis ?? '',
      kapasitasKg: k?.kapasitasKg ?? null,
      bakPanjangCm: k?.bakPanjangCm ?? null,
      bakLebarCm: k?.bakLebarCm ?? null,
      bakTinggiCm: k?.bakTinggiCm ?? null,
      berlakuStnk: k?.berlakuStnk ?? null,
      berlakuKir: k?.berlakuKir ?? null,
      servisTiapKm: k?.servisTiapKm ?? null,
      servisTiapBulan: k?.servisTiapBulan ?? null,
      catatan: k?.catatan ?? '',
    },
  });
  async function kirim(data: DataKendaraan) {
    try {
      await simpan.mutateAsync({ id: k?.id, json: data });
      toast.success(`Kendaraan ${data.plat} disimpan.`);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'plat',
        'jenis',
        'kapasitasKg',
        'servisTiapKm',
        'servisTiapBulan',
        'catatan',
      ]);
    }
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{k ? `Ubah kendaraan ${k.plat}` : 'Tambah kendaraan'}</DialogTitle>
          <DialogDescription>Plat ditulis seperti di STNK, mis. S 1234 AB.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="plat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plat nomor</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="S 1234 AB" className="uppercase" {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input placeholder="Pikap, Truk engkel, Motor roda tiga…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kapasitasKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daya angkut (kg)</FormLabel>
                  <FormControl>
                    <IsianBulat value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <p className="text-xs text-slate-500">
                    Dari buku uji KIR / STNK (JBI dikurangi berat kosong). Kosong = berat muatan
                    tidak diperiksa.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <p className="mb-1 text-sm font-medium">Ukuran bak (cm, bagian dalam)</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['bakPanjangCm', 'Panjang'],
                    ['bakLebarCm', 'Lebar'],
                    ['bakTinggiCm', 'Tinggi dinding'],
                  ] as const
                ).map(([nama, label]) => (
                  <FormField
                    key={nama}
                    control={form.control}
                    name={nama}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-slate-600">{label}</FormLabel>
                        <FormControl>
                          <IsianBulat value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['berlakuStnk', 'STNK berlaku sampai'],
                  ['berlakuKir', 'KIR berlaku sampai'],
                ] as const
              ).map(([nama, label]) => (
                <FormField
                  key={nama}
                  control={form.control}
                  name={nama}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-slate-600">{label}</FormLabel>
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
              ))}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Servis berkala (boleh salah satu)</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['servisTiapKm', 'Tiap … km'],
                    ['servisTiapBulan', 'Tiap … bulan'],
                  ] as const
                ).map(([nama, label]) => (
                  <FormField
                    key={nama}
                    control={form.control}
                    name={nama}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-slate-600">{label}</FormLabel>
                        <FormControl>
                          <IsianBulat value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Mis. 5000 km atau 6 bulan. Pengingat muncul 500 km / 14 hari sebelumnya, dihitung
                dari catatan servis terakhir.
              </p>
            </div>
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
            <DialogFooter>
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

function DialogSopir({ s, onTutup }: { s: Sopir | null; onTutup: () => void }) {
  const simpan = useSimpanSopir();
  const form = useForm<InputSopir, unknown, DataSopir>({
    resolver: zodResolver(skemaSopir),
    defaultValues: { nama: s?.nama ?? '', noHp: s?.noHp ?? '', catatan: s?.catatan ?? '' },
  });
  async function kirim(data: DataSopir) {
    try {
      await simpan.mutateAsync({ id: s?.id, json: data });
      toast.success(`Sopir ${data.nama} disimpan.`);
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, ['nama', 'noHp', 'catatan']);
    }
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{s ? `Ubah sopir ${s.nama}` : 'Tambah sopir'}</DialogTitle>
          <DialogDescription>
            Sopir tidak punya akun; hasil antar dicatat admin/kasir di toko.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(kirim)(e)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
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
                  <FormLabel>No. HP (boleh kosong)</FormLabel>
                  <FormControl>
                    <InputNoHp value={field.value} onChange={field.onChange} />
                  </FormControl>
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
            <DialogFooter>
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

/** Riwayat perjalanan satu kendaraan atau satu sopir (S12). */
function DialogRiwayat({
  judul,
  saring,
  onTutup,
}: {
  judul: string;
  saring: { idKendaraan?: number; idSopir?: number };
  onTutup: () => void;
}) {
  const daftar = useDaftarPerjalanan(saring);
  const data = daftar.data?.data ?? [];
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Riwayat perjalanan {judul}</DialogTitle>
          <DialogDescription>50 perjalanan terbaru.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {data.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {daftar.isLoading ? 'Memuat…' : 'Belum pernah berangkat.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">Perjalanan</th>
                  <th className="py-1 text-left">Berangkat</th>
                  <th className="py-1 text-left">Kembali</th>
                  <th className="py-1 text-left">Kendaraan · sopir</th>
                  <th className="py-1 text-left">Surat jalan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="py-1.5 font-mono text-xs">{p.nomor}</td>
                    <td className="py-1.5">
                      {p.waktuBerangkat
                        ? formatWaktu(p.waktuBerangkat)
                        : `rencana ${formatWaktu(p.jadwalBerangkat)}`}
                    </td>
                    <td className="py-1.5">
                      {p.waktuKembali ? (
                        formatWaktu(p.waktuKembali)
                      ) : p.status === 'JALAN' && p.waktuBerangkat ? (
                        <BadgeJalan
                          jalan={{
                            idPerjalanan: p.id,
                            nomor: p.nomor,
                            waktuBerangkat: p.waktuBerangkat,
                          }}
                        />
                      ) : p.status === 'BATAL' ? (
                        `batal: ${p.alasanBatal ?? ''}`
                      ) : (
                        'belum berangkat'
                      )}
                    </td>
                    <td className="py-1.5">
                      {p.plat} · {p.namaSopir}
                    </td>
                    <td className="py-1.5 text-xs">
                      {p.suratJalan.map((s) => (
                        <div key={s.id}>
                          {s.nomor} · {s.namaPelanggan ?? '—'}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabKendaraan({ bolehKelola }: { bolehKelola: boolean }) {
  const daftar = useDaftarKendaraan();
  const status = useStatusKendaraan();
  const [dialog, setDialog] = useState<{ k: Kendaraan | null } | null>(null);
  const [riwayat, setRiwayat] = useState<Kendaraan | null>(null);
  const kolom: KolomTabel<Kendaraan>[] = [
    {
      kunci: 'plat',
      judul: 'Plat',
      sel: (k) => <span className="font-mono font-medium">{k.plat}</span>,
    },
    { kunci: 'jenis', judul: 'Jenis', sel: (k) => k.jenis },
    {
      kunci: 'kapasitas',
      judul: 'Daya angkut · bak',
      className: 'w-44 text-right',
      sel: (k) => (
        <div className="text-right">
          <div>{k.kapasitasKg ? `${k.kapasitasKg.toLocaleString('id-ID')} kg` : '—'}</div>
          <div className="text-xs text-slate-500">
            {k.bakPanjangCm && k.bakLebarCm && k.bakTinggiCm
              ? `${k.bakPanjangCm}×${k.bakLebarCm}×${k.bakTinggiCm} cm`
              : 'bak belum diisi'}
          </div>
        </div>
      ),
    },
    { kunci: 'jalan', judul: 'Posisi', sel: (k) => <BadgeJalan jalan={k.sedangJalan} /> },
    { kunci: 'kesehatan', judul: 'Odometer · servis · surat', sel: (k) => <SelKesehatan k={k} /> },
    {
      kunci: 'trip',
      judul: 'Perjalanan',
      className: 'w-28 text-right',
      sel: (k) => (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
          onClick={() => setRiwayat(k)}
          aria-label={`Riwayat perjalanan ${k.plat}`}
        >
          <History className="size-3.5" /> {k.jumlahPerjalanan}
        </button>
      ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      className: 'w-28',
      sel: (k) => <BadgeStatusAktif status={k.statusAktif} />,
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (k) =>
        bolehKelola && (
          <MenuAksiMaster
            nama={k.plat}
            status={k.statusAktif}
            onUbah={() => setDialog({ k })}
            onUbahStatus={(statusAktif: StatusAktif) =>
              void jalankanDenganToast(
                status.mutateAsync({ id: k.id, statusAktif }),
                `Kendaraan ${k.plat} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
              )
            }
          />
        ),
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between border-b p-3">
        <p className="text-sm text-slate-500">
          Dipilih saat berangkat. Kendaraan yang sedang jalan tidak bisa dipakai perjalanan lain.
        </p>
        {bolehKelola && (
          <Button size="sm" onClick={() => setDialog({ k: null })}>
            <Plus /> Tambah kendaraan
          </Button>
        )}
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data}
        kunciBaris={(k) => k.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada kendaraan."
      />
      {dialog && <DialogKendaraan k={dialog.k} onTutup={() => setDialog(null)} />}
      {riwayat && (
        <DialogRiwayat
          judul={riwayat.plat}
          saring={{ idKendaraan: riwayat.id }}
          onTutup={() => setRiwayat(null)}
        />
      )}
    </Card>
  );
}

function TabSopir({ bolehKelola }: { bolehKelola: boolean }) {
  const daftar = useDaftarSopir();
  const status = useStatusSopir();
  const [dialog, setDialog] = useState<{ s: Sopir | null } | null>(null);
  const [riwayat, setRiwayat] = useState<Sopir | null>(null);
  const kolom: KolomTabel<Sopir>[] = [
    { kunci: 'nama', judul: 'Nama', sel: (s) => <span className="font-medium">{s.nama}</span> },
    { kunci: 'hp', judul: 'No. HP', sel: (s) => s.noHp ?? '—' },
    { kunci: 'jalan', judul: 'Posisi', sel: (s) => <BadgeJalan jalan={s.sedangJalan} /> },
    {
      kunci: 'trip',
      judul: 'Perjalanan',
      className: 'w-28 text-right',
      sel: (s) => (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
          onClick={() => setRiwayat(s)}
          aria-label={`Riwayat perjalanan ${s.nama}`}
        >
          <History className="size-3.5" /> {s.jumlahPerjalanan}
        </button>
      ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      className: 'w-28',
      sel: (s) => <BadgeStatusAktif status={s.statusAktif} />,
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (s) =>
        bolehKelola && (
          <MenuAksiMaster
            nama={s.nama}
            status={s.statusAktif}
            onUbah={() => setDialog({ s })}
            onUbahStatus={(statusAktif: StatusAktif) =>
              void jalankanDenganToast(
                status.mutateAsync({ id: s.id, statusAktif }),
                `Sopir ${s.nama} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
              )
            }
          />
        ),
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between border-b p-3">
        <p className="text-sm text-slate-500">
          Dipilih saat berangkat. Sopir yang sedang jalan tidak bisa dipakai perjalanan lain.
        </p>
        {bolehKelola && (
          <Button size="sm" onClick={() => setDialog({ s: null })}>
            <Plus /> Tambah sopir
          </Button>
        )}
      </div>
      <DataTable
        kolom={kolom}
        data={daftar.data}
        kunciBaris={(s) => s.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong="Belum ada sopir."
      />
      {dialog && <DialogSopir s={dialog.s} onTutup={() => setDialog(null)} />}
      {riwayat && (
        <DialogRiwayat
          judul={riwayat.nama}
          saring={{ idSopir: riwayat.id }}
          onTutup={() => setRiwayat(null)}
        />
      )}
    </Card>
  );
}

/**
 * Logistik › Kendaraan & Sopir (K-150): data tetap untuk pengantaran, riwayat perjalanan, catatan BBM dan servis,
 * serta statistik armada (K-162).
 */
export function HalamanArmada() {
  const bolehKelola = usePengguna().izin.includes('master.armada.kelola');
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Kendaraan & Sopir</h1>
        <p className="text-sm text-slate-500">
          Dipilih saat barang berangkat, tidak diketik ulang. Yang tidak dipakai lagi dinonaktifkan.
        </p>
      </div>
      <Tabs defaultValue="kendaraan">
        <TabsList>
          <TabsTrigger value="kendaraan">Kendaraan</TabsTrigger>
          <TabsTrigger value="sopir">Sopir</TabsTrigger>
          {/* K-178: BBM, servis, dan statistik armada ditunda ke versi dengan pembukuan; data tetap utuh. */}
        </TabsList>
        <TabsContent value="kendaraan">
          <TabKendaraan bolehKelola={bolehKelola} />
        </TabsContent>
        <TabsContent value="sopir">
          <TabSopir bolehKelola={bolehKelola} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
