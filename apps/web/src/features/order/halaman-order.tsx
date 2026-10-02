import {
  formatRupiah,
  type BarisDaftarOrder,
  type DetailOrder,
  type StatusOrder,
} from '@sit/shared';
import {
  AlertCircle,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Unlock,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import {
  useBatalOrder,
  useDaftarOrder,
  useDetailOrder,
  useKirimOrder,
  useLepasOrder,
} from '@/api/penjualan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTunda } from '@/lib/use-tunda';
import { InputOrderCepat } from './input-order-cepat';

type Saring = 'AKTIF' | 'DRAFT' | 'SELESAI' | 'BATAL';
const SARING: Saring[] = ['AKTIF', 'DRAFT', 'SELESAI', 'BATAL'];
const LABEL_SARING: Record<Saring, string> = {
  AKTIF: 'Antrean',
  DRAFT: 'Draf',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

const LABEL_STATUS: Record<StatusOrder, string> = {
  DRAFT: 'Draf',
  MENUNGGU: 'Menunggu kasir',
  DIPROSES: 'Diproses',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

const WARNA_STATUS: Record<StatusOrder, string> = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-600',
  MENUNGGU: 'border-amber-200 bg-amber-100 text-amber-700',
  DIPROSES: 'border-blue-200 bg-blue-100 text-blue-700',
  SELESAI: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  BATAL: 'border-red-200 bg-red-50 text-red-600',
};

export function BadgeStatusOrder({ status }: { status: StatusOrder }) {
  return (
    <Badge variant="outline" className={WARNA_STATUS[status]}>
      {LABEL_STATUS[status]}
    </Badge>
  );
}

function namaPembeli(o: Pick<BarisDaftarOrder, 'namaPelanggan' | 'namaPembeli'>): string {
  return o.namaPelanggan ?? o.namaPembeli ?? 'Pembeli umum';
}

function KartuOrder({
  o,
  dipilih,
  onPilih,
}: {
  o: BarisDaftarOrder;
  dipilih: boolean;
  onPilih: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPilih}
      aria-pressed={dipilih}
      className={cn(
        'relative w-full rounded-lg border-2 p-3 text-left transition-all',
        dipilih
          ? 'border-blue-500 bg-blue-50/50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-blue-300',
        (o.status === 'SELESAI' || o.status === 'BATAL') && 'opacity-70',
      )}
    >
      {o.prioritas === 'TINGGI' && o.status === 'MENUNGGU' && (
        <span className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
          <AlertCircle className="size-3" /> Prioritas
        </span>
      )}
      <div className="mb-1.5 flex items-start justify-between">
        <span className="flex items-baseline gap-2">
          <span className="text-xl leading-none font-black tabular-nums">{o.noAntrean}</span>
          <span className="font-mono text-xs text-slate-500">{o.nomor}</span>
        </span>
        <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
          <Clock className="size-3" /> {formatWaktu(o.waktuMasukAntrean ?? o.tanggal).slice(11)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-slate-700">
        <User className="size-3.5 text-slate-400" />
        <span className="truncate font-medium">{namaPembeli(o)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-medium',
            o.jenisPenjualan === 'PENGANTARAN'
              ? 'bg-indigo-50 text-indigo-700'
              : 'bg-orange-50 text-orange-700',
          )}
        >
          {o.jenisPenjualan === 'PENGANTARAN' ? 'Pengantaran' : 'Langsung'}
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <Package className="size-3" /> {o.jumlahItem} barang
        </span>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-sm leading-tight">
        {o.ringkasan.slice(0, 3).map((r, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="truncate">{r.namaBarang}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatDesimal(r.qty)} {r.kodeSatuan}
            </span>
          </li>
        ))}
        {o.ringkasan.length > 3 && (
          <li className="text-xs text-slate-500">+{o.ringkasan.length - 3} barang lagi</li>
        )}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t pt-2">
        <span className="flex items-center gap-1">
          <BadgeStatusOrder status={o.status} />
          {o.basi && (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              Basi
            </Badge>
          )}
        </span>
        <span className="font-bold text-slate-800 tabular-nums">{formatRupiah(o.total)}</span>
      </div>
    </button>
  );
}

function DialogBatal({ d, onTutup }: { d: DetailOrder; onTutup: () => void }) {
  const batal = useBatalOrder();
  const [alasan, setAlasan] = useState('');
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan order {d.nomor}?</DialogTitle>
          <DialogDescription>
            Barang yang ditahan order ini dilepas kembali ke stok tersedia. Order yang dibatalkan
            tidak bisa dipakai lagi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="alasan-batal" className="text-sm font-medium">
            Alasan batal
          </label>
          <Input
            id="alasan-batal"
            value={alasan}
            maxLength={255}
            onChange={(e) => setAlasan(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button
            variant="destructive"
            disabled={alasan.trim().length < 3 || batal.isPending}
            onClick={() =>
              void batal
                .mutateAsync({ id: d.id, alasan: alasan.trim() })
                .then(() => {
                  toast.success(`Order ${d.nomor} dibatalkan.`);
                  onTutup();
                })
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            Batalkan order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PanelDetail({ id }: { id: number }) {
  const navigasi = useNavigate();
  const saya = usePengguna();
  const detail = useDetailOrder(id);
  const kirim = useKirimOrder();
  const lepas = useLepasOrder();
  const [dialogBatal, setDialogBatal] = useState(false);
  const d = detail.data;
  if (!d) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const izin = (k: Parameters<typeof saya.izin.includes>[0]) => saya.izin.includes(k);
  const pembuat = d.idPengguna === saya.id;
  const pemegang = d.idKasirProses === saya.id;
  const bolehUbah =
    (d.status === 'DRAFT' && pembuat) ||
    (d.status === 'MENUNGGU' && (pembuat || izin('penjualan.checkout'))) ||
    (d.status === 'DIPROSES' && pemegang);
  const bolehBatal =
    d.status === 'DRAFT' || d.status === 'MENUNGGU'
      ? pembuat || izin('penjualan.order.batal')
      : d.status === 'DIPROSES' &&
        izin('penjualan.order.batal') &&
        (pemegang || izin('penjualan.order.lepas_paksa'));
  const jalankan = (p: Promise<unknown>, pesan: string) =>
    void p.then(() => toast.success(pesan)).catch((err: unknown) => toast.error(pesanGalat(err)));

  /** Layar POS memproses (mengunci) order ini sendiri saat dibuka (K-073). */
  function prosesKePembayaran() {
    if (!d) return;
    void navigasi(
      d.jenisPenjualan === 'PENGANTARAN'
        ? `/penjualan-pengantaran?order=${d.id}`
        : `/penjualan-langsung?order=${d.id}`,
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b p-5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Order {d.nomor}</h2>
            <BadgeStatusOrder status={d.status} />
            {d.basi && (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                Basi
              </Badge>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <User className="size-4" /> {namaPembeli(d)} (
              {d.jenisPenjualan === 'PENGANTARAN' ? 'pengantaran' : 'langsung'})
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-4" /> Dibuat {d.namaPengguna} · {formatWaktu(d.tanggal)}
            </span>
            {d.namaKasirProses && <span>Diproses {d.namaKasirProses}</span>}
          </p>
          {d.alasanBatal && <p className="mt-1 text-sm text-red-600">Batal: {d.alasanBatal}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {bolehUbah && (
            <Button variant="outline" asChild>
              <Link to={`/order/${d.id}/ubah`}>
                <Pencil /> Ubah
              </Link>
            </Button>
          )}
          {bolehBatal && (
            <Button variant="outline" onClick={() => setDialogBatal(true)}>
              <X /> Batalkan
            </Button>
          )}
          {d.status === 'DRAFT' && pembuat && (
            <Button
              disabled={kirim.isPending}
              onClick={() =>
                jalankan(kirim.mutateAsync(d.id), `Order ${d.nomor} masuk antrean kasir.`)
              }
            >
              <Send /> Kirim ke antrean
            </Button>
          )}
          {d.status === 'DIPROSES' && (pemegang || izin('penjualan.order.lepas_paksa')) && (
            <Button
              variant="outline"
              disabled={lepas.isPending}
              onClick={() =>
                jalankan(lepas.mutateAsync(d.id), `Order ${d.nomor} kembali ke antrean.`)
              }
            >
              <Unlock /> {pemegang ? 'Kembalikan ke antrean' : 'Lepas paksa'}
            </Button>
          )}
          {izin('penjualan.checkout') &&
            (d.status === 'MENUNGGU' || (d.status === 'DIPROSES' && pemegang)) && (
              <Button onClick={prosesKePembayaran}>
                Proses ke pembayaran <ChevronRight />
              </Button>
            )}
        </div>
      </div>

      {d.jenisPenjualan === 'PENGANTARAN' && (
        <div className="border-b bg-indigo-50/30 px-5 py-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wider text-indigo-900 uppercase">
            <MapPin className="size-4" /> Informasi pengiriman
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">Alamat tujuan</div>
              <div className="font-medium">{d.alamatKirim}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Catatan pengiriman</div>
              <div>{d.catatanKirim ?? '—'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-slate-50 p-5">
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-xs text-slate-600 uppercase">
              <tr>
                <th className="w-10 px-3 py-2 text-center">No</th>
                <th className="px-3 py-2 text-left">Barang</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Harga</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.baris.map((b, i) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 text-center text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{b.namaBarang}</div>
                    <div className="text-xs text-slate-500">
                      {b.hargaManual ? 'Harga manual' : b.namaTier}
                      {b.catatanItem && ` · ${b.catatanItem}`}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-bold">
                      {formatDesimal(b.qty)} {b.kodeSatuan}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatRupiah(b.hargaSatuan)}
                    {b.diskonBaris > 0 && (
                      <div className="text-xs text-red-600">− {formatRupiah(b.diskonBaris)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatRupiah(b.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.catatan && <p className="mt-3 text-sm text-slate-600">Catatan: {d.catatan}</p>}
      </div>

      <div className="border-t bg-white p-5">
        <div className="ml-auto max-w-sm space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal ({d.baris.length} barang)</span>
            <span className="tabular-nums">{formatRupiah(d.subtotal)}</span>
          </div>
          {d.diskonTransaksi > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Diskon transaksi</span>
              <span className="tabular-nums">− {formatRupiah(d.diskonTransaksi)}</span>
            </div>
          )}
          {d.ongkir > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Ongkos kirim</span>
              <span className="tabular-nums">{formatRupiah(d.ongkir)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 font-bold">
            <span>Total tagihan</span>
            <span className="text-xl text-blue-700 tabular-nums">{formatRupiah(d.total)}</span>
          </div>
        </div>
      </div>
      {dialogBatal && <DialogBatal d={d} onTutup={() => setDialogBatal(false)} />}
    </div>
  );
}

/** Daftar order: antrean (kiri) dan detail order terpilih (kanan), seperti mockup. */
function DaftarOrder() {
  const [url, setUrl] = useSearchParams();
  const saya = usePengguna();
  const semua = saya.izin.includes('penjualan.order.lihat_semua');
  const diminta = url.get('status');
  const saring: Saring =
    diminta === 'MENUNGGU' ? 'AKTIF' : (SARING.find((s) => s === diminta) ?? 'AKTIF');
  const idTerpilih = Number(url.get('id')) || null;
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const daftar = useDaftarOrder(
    {
      cari: cariTertunda,
      status: saring,
      jenis: null,
      milikSaya: false,
      halaman: 1,
      perHalaman: 100,
    },
    { segarkanTiap: saring === 'AKTIF' ? 15_000 : undefined },
  );
  const data = daftar.data?.data ?? [];
  const terpilih = idTerpilih ?? data[0]?.id ?? null;

  function atur(ubah: Record<string, string | null>) {
    const baru = new URLSearchParams(url);
    for (const [k, v] of Object.entries(ubah)) {
      if (v === null) baru.delete(k);
      else baru.set(k, v);
    }
    setUrl(baru, { replace: true });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">
          {semua ? 'Semua order; antrean urut yang paling lama menunggu.' : 'Order yang Anda buat.'}
        </p>
        <Button asChild variant="outline">
          <Link to="/order/baru">
            <Plus /> Form order lengkap
          </Link>
        </Button>
      </div>

      <div className="flex min-h-[560px] flex-1 gap-4 overflow-hidden">
        <div className="flex w-1/3 min-w-80 flex-col overflow-hidden rounded-xl border bg-white">
          <div className="space-y-2 border-b bg-slate-50 p-3">
            <Tabs value={saring} onValueChange={(v) => atur({ status: v, id: null })}>
              <TabsList className="w-full">
                {SARING.map((s) => (
                  <TabsTrigger key={s} value={s} className="flex-1">
                    {LABEL_SARING[s]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nomor atau pembeli…"
                className="pl-8"
                aria-label="Cari order"
              />
            </div>
          </div>
          <div
            className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/50 p-3"
            aria-label="Daftar order"
          >
            {daftar.isLoading &&
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 w-full" />)}
            {!daftar.isLoading && data.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">Tidak ada order.</p>
            )}
            {data.map((o) => (
              <KartuOrder
                key={o.id}
                o={o}
                dipilih={o.id === terpilih}
                onPilih={() => atur({ id: String(o.id) })}
              />
            ))}
          </div>
        </div>
        <div className="flex w-2/3 flex-col overflow-hidden rounded-xl border bg-white">
          {terpilih === null ? (
            <p className="m-auto text-sm text-slate-500">
              Pilih order di kiri untuk melihat detail.
            </p>
          ) : (
            <PanelDetail key={terpilih} id={terpilih} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Transaksi › Order Penjualan: "Input cepat" (bawaan, untuk Staf di lantai toko; K-073) dan "Daftar order"
 * (riwayat, detail, ubah, batal).
 */
export function HalamanOrder() {
  const [url, setUrl] = useSearchParams();
  const daftar = url.get('tampil') === 'daftar' || url.has('id') || url.has('status');
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <Tabs
        value={daftar ? 'daftar' : 'cepat'}
        onValueChange={(v) => setUrl(v === 'daftar' ? { tampil: 'daftar' } : {}, { replace: true })}
      >
        <TabsList className="h-8">
          <TabsTrigger value="cepat">Input cepat</TabsTrigger>
          <TabsTrigger value="daftar">Daftar order</TabsTrigger>
        </TabsList>
      </Tabs>
      {daftar ? <DaftarOrder /> : <InputOrderCepat />}
    </div>
  );
}
