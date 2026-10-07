import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatRupiah,
  LABEL_JENIS_POTONGAN,
  LABEL_SASARAN_PROMO,
  LABEL_STATUS_BERLAKU_PROMO,
  skemaPromo,
  STATUS_BERLAKU_PROMO,
  type DataPromo,
  type InputPromo,
  type Promo,
  type StatusAktif,
  type StatusBerlakuPromo,
} from '@sit/shared';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarPromo, useSimpanPromo, useStatusPromo } from '@/api/promo';
import { useDaftarKategori } from '@/api/referensi';
import { BilahSaring, type SaringStatus } from '@/components/bilah-saring';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputPersen } from '@/components/input-persen';
import { InputRupiah } from '@/components/input-rupiah';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { PilihBarang } from '@/components/pilih-barang';
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
import { formatDesimal, formatTanggal, tanggalHariIni } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTunda } from '@/lib/use-tunda';

const SEMUA = 'SEMUA';

/** "10% (maks. Rp 5.000)" atau "Rp 500 per satuan". */
function uraianPotongan(p: Promo): string {
  if (p.jenisPotongan === 'PERSEN') {
    const maks = p.maksPotongan === null ? '' : ` (maks. ${formatRupiah(p.maksPotongan)})`;
    return `${formatDesimal(p.potonganPersen ?? '0')}%${maks}`;
  }
  return `${formatRupiah(p.potonganNominal ?? 0)} per satuan`;
}

function uraianSasaran(p: Promo): string {
  if (p.sasaran === 'KATEGORI') return `Kategori ${p.namaKategori ?? '—'}`;
  if (p.sasaran === 'BARANG') return `${p.kodeBarang ?? ''} ${p.namaBarang ?? '—'}`.trim();
  return 'Semua barang';
}

function uraianSyarat(p: Promo): string {
  const syarat = [
    p.minQty !== null ? `qty ≥ ${formatDesimal(p.minQty)}` : null,
    p.minBelanja !== null ? `belanja ≥ ${formatRupiah(p.minBelanja)}` : null,
  ].filter(Boolean);
  return syarat.length > 0 ? syarat.join(' · ') : '—';
}

const WARNA_BERLAKU: Record<StatusBerlakuPromo, string> = {
  BERJALAN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TERJADWAL: 'border-blue-200 bg-blue-50 text-blue-700',
  BERAKHIR: 'border-slate-200 bg-slate-50 text-slate-500',
};

function DialogPromo({ promo, onTutup }: { promo: Promo | null; onTutup: () => void }) {
  const simpan = useSimpanPromo();
  const kategori = useDaftarKategori();
  const terkunci = (promo?.jumlahPemakaian ?? 0) > 0;
  const [barangDipilih, setBarangDipilih] = useState<string | null>(
    promo?.idBarang ? `${promo.kodeBarang ?? ''} · ${promo.namaBarang ?? ''}` : null,
  );
  const form = useForm<InputPromo, unknown, DataPromo>({
    resolver: zodResolver(skemaPromo),
    defaultValues: {
      nama: promo?.nama ?? '',
      tanggalMulai: promo?.tanggalMulai ?? tanggalHariIni(),
      tanggalSelesai: promo?.tanggalSelesai ?? tanggalHariIni(),
      jenisPotongan: promo?.jenisPotongan ?? 'PERSEN',
      potonganPersen: promo?.potonganPersen ? formatDesimal(promo.potonganPersen) : null,
      potonganNominal: promo?.potonganNominal ?? null,
      maksPotongan: promo?.maksPotongan ?? null,
      sasaran: promo?.sasaran ?? 'SEMUA',
      idKategori: promo?.idKategori ?? null,
      idBarang: promo?.idBarang ?? null,
      minQty: promo?.minQty ? formatDesimal(promo.minQty) : null,
      minBelanja: promo?.minBelanja ?? null,
      keterangan: promo?.keterangan ?? '',
    },
  });
  const [jenis, sasaran] = useWatch({ control: form.control, name: ['jenisPotongan', 'sasaran'] });

  async function kirim(data: DataPromo) {
    try {
      const hasil = await simpan.mutateAsync({ id: promo?.id, json: data });
      toast.success(
        promo ? `Promo ${hasil.nama} disimpan.` : `Promo ${hasil.nama} dibuat (${hasil.kode}).`,
      );
      onTutup();
    } catch (err) {
      tampilkanGalatForm(err, form.setError, [
        'nama',
        'tanggalMulai',
        'tanggalSelesai',
        'jenisPotongan',
        'potonganPersen',
        'potonganNominal',
        'maksPotongan',
        'sasaran',
        'idKategori',
        'idBarang',
        'minQty',
        'minBelanja',
        'keterangan',
      ]);
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{promo ? `Ubah promo ${promo.kode}` : 'Buat promo'}</DialogTitle>
          <DialogDescription>
            Potongan dihitung per baris barang saat order dan saat dibayar di kasir, selama tanggal
            mulai sampai tanggal selesai (keduanya termasuk). Bila beberapa promo cocok, dipakai
            potongan terbesar. Tidak berlaku untuk harga manual.
          </DialogDescription>
        </DialogHeader>
        {terkunci && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
            <Lock className="mt-0.5 size-4 shrink-0" />
            Promo ini sudah dipakai di {promo?.jumlahPemakaian} baris penjualan, jadi aturannya
            dikunci. Nama, keterangan, dan tanggal selesai masih bisa diubah; untuk aturan berbeda
            buat promo baru.
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
                  <FormLabel>Nama promo</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. Promo Semen Oktober" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tanggalMulai"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal mulai</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={terkunci} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tanggalSelesai"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal selesai</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="jenisPotongan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis potongan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={terkunci}>
                    <FormControl>
                      <SelectTrigger aria-label="Jenis potongan">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PERSEN">{LABEL_JENIS_POTONGAN.PERSEN}</SelectItem>
                      <SelectItem value="NOMINAL">{LABEL_JENIS_POTONGAN.NOMINAL}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {jenis === 'PERSEN' ? (
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
            ) : (
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
            {jenis === 'PERSEN' && (
              <FormField
                control={form.control}
                name="maksPotongan"
                render={({ field }) => (
                  <FormItem className="col-span-2">
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
            )}
            <FormField
              control={form.control}
              name="sasaran"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Berlaku untuk</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={terkunci}>
                    <FormControl>
                      <SelectTrigger aria-label="Sasaran promo">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SEMUA">{LABEL_SASARAN_PROMO.SEMUA}</SelectItem>
                      <SelectItem value="KATEGORI">{LABEL_SASARAN_PROMO.KATEGORI}</SelectItem>
                      <SelectItem value="BARANG">{LABEL_SASARAN_PROMO.BARANG}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {sasaran === 'KATEGORI' && (
              <FormField
                control={form.control}
                name="idKategori"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={terkunci}
                    >
                      <FormControl>
                        <SelectTrigger aria-label="Kategori promo">
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(kategori.data ?? [])
                          .filter((k) => k.statusAktif === 'AKTIF' || k.id === field.value)
                          .map((k) => (
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
            )}
            {sasaran === 'BARANG' && (
              <FormField
                control={form.control}
                name="idBarang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barang</FormLabel>
                    {barangDipilih && (
                      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                        <span className="truncate">{barangDipilih}</span>
                        {!terkunci && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBarangDipilih(null);
                              field.onChange(null);
                            }}
                          >
                            Ganti
                          </Button>
                        )}
                      </div>
                    )}
                    {!barangDipilih && (
                      <PilihBarang
                        label="Barang promo"
                        onPilih={(b) => {
                          field.onChange(b.id);
                          setBarangDipilih(`${b.kode} · ${b.namaBarang}`);
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
              name="minQty"
              render={({ field }) => (
                <FormItem className="col-start-1">
                  <FormLabel>Minimal qty per baris, satuan dasar (opsional)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="Tanpa syarat"
                      disabled={terkunci}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={typeof field.value === 'string' ? field.value : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : e.target.value)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minBelanja"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimal total belanja (opsional)</FormLabel>
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

/** Master promo (docs/06 §3, docs/04 §4 "Promo"): daftar, buat, ubah, nonaktifkan. Tidak ada hapus. */
export function HalamanPromo() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useState<SaringStatus>('SEMUA');
  const [berlaku, setBerlaku] = useState<StatusBerlakuPromo | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [dialog, setDialog] = useState<{ promo: Promo | null } | null>(null);

  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPromo({
    cari: cariTertunda,
    status,
    berlaku,
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
        <div>
          <div className="font-medium">{p.nama}</div>
          {p.keterangan && <div className="text-xs text-slate-500">{p.keterangan}</div>}
        </div>
      ),
    },
    {
      kunci: 'periode',
      judul: 'Periode',
      sel: (p) => (
        <span className="text-sm whitespace-nowrap tabular-nums">
          {p.tanggalMulai === p.tanggalSelesai
            ? formatTanggal(p.tanggalMulai)
            : `${formatTanggal(p.tanggalMulai)} – ${formatTanggal(p.tanggalSelesai)}`}
        </span>
      ),
    },
    { kunci: 'potongan', judul: 'Potongan', sel: (p) => uraianPotongan(p) },
    {
      kunci: 'sasaran',
      judul: 'Berlaku untuk',
      sel: (p) => (
        <span className="block max-w-56 truncate text-sm" title={uraianSasaran(p)}>
          {uraianSasaran(p)}
        </span>
      ),
    },
    {
      kunci: 'syarat',
      judul: 'Syarat',
      sel: (p) => <span className="text-xs text-slate-500">{uraianSyarat(p)}</span>,
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
      judul: 'Dipakai',
      className: 'text-right tabular-nums',
      sel: (p) => (p.jumlahPemakaian > 0 ? `${p.jumlahPemakaian} baris` : '—'),
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (p) => (
        <MenuAksiMaster
          nama={p.nama}
          status={p.statusAktif}
          onUbah={() => setDialog({ promo: p })}
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
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Promo</h1>
          <p className="text-sm text-slate-500">
            Potongan harga otomatis per baris barang selama periode promo.
          </p>
        </div>
        <Button onClick={() => setDialog({ promo: null })}>
          <Plus /> Buat promo
        </Button>
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
          kosong="Belum ada promo yang cocok."
        />
      </Card>

      {dialog && <DialogPromo promo={dialog.promo} onTutup={() => setDialog(null)} />}
    </div>
  );
}
