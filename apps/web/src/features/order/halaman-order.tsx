import { formatRupiah, type BarisDaftarOrder, type StatusOrder } from '@sit/shared';
import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  Clock,
  FilePen,
  MapPin,
  Package,
  Pencil,
  Phone,
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
  useDaftarOrder,
  useDetailOrder,
  useKeDrafOrder,
  useKirimOrder,
  useLepasOrder,
} from '@/api/penjualan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDesimal, formatTanggal, formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTunda } from '@/lib/use-tunda';
import { DialogBatal } from './dialog-batal-order';
import { DialogSimpanOrder } from './dialog-simpan-order';
import { InputOrderCepat } from './input-order-cepat';

type Saring = 'AKTIF' | 'DISIMPAN' | 'DRAFT' | 'SELESAI' | 'BATAL';
const SARING: Saring[] = ['AKTIF', 'DISIMPAN', 'DRAFT', 'SELESAI', 'BATAL'];
const LABEL_SARING: Record<Saring, string> = {
  AKTIF: 'Antrean',
  DISIMPAN: 'Disimpan',
  DRAFT: 'Draf',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

/** Penjelasan singkat tiap tab daftar order (K-122). */
const KET_SARING: Record<Saring, string> = {
  AKTIF:
    'Order yang menunggu atau sedang di kasir; urut yang paling lama menunggu. Stoknya ditahan.',
  DISIMPAN:
    'Order yang dipesan sekarang dan diambil nanti; urut tanggal ambil. Stoknya ditahan. Kirim ke antrean atau langsung proses saat pembeli datang.',
  DRAFT: 'Order yang belum dikirim; stoknya belum ditahan.',
  SELESAI: 'Order yang sudah dibayar.',
  BATAL: 'Order yang dibatalkan.',
};

const LABEL_STATUS: Record<StatusOrder, string> = {
  DRAFT: 'Draf',
  MENUNGGU: 'Menunggu kasir',
  DIPROSES: 'Diproses',
  DISIMPAN: 'Disimpan',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

const WARNA_STATUS: Record<StatusOrder, string> = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-600',
  MENUNGGU: 'border-amber-200 bg-amber-100 text-amber-700',
  DIPROSES: 'border-blue-200 bg-blue-100 text-blue-700',
  DISIMPAN: 'border-violet-200 bg-violet-100 text-violet-700',
  SELESAI: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  BATAL: 'border-red-200 bg-red-50 text-red-600',
};

/** Order basi (docs/05 R7): terlalu lama menunggu di antrean; stoknya masih ditahan. */
const KETERANGAN_BASI =
  'Order terlalu lama menunggu di antrean (melewati batas di Pengaturan). Stoknya masih ditahan sampai order diselesaikan atau dibatalkan.';

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
      {o.status === 'DISIMPAN' && (
        <div
          className={cn(
            'mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold',
            o.lewatTanggalAmbil ? 'bg-red-100 text-red-800' : 'bg-violet-50 text-violet-800',
          )}
        >
          <CalendarClock className="size-3.5" /> Ambil {formatTanggal(o.tanggalAmbil)}
          {o.lewatTanggalAmbil && ' · lewat, hubungi pembeli'}
          <span className="ml-auto font-normal">{o.noHpPembeli}</span>
        </div>
      )}
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
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-red-700"
              title={KETERANGAN_BASI}
            >
              Basi
            </Badge>
          )}
        </span>
        <span className="font-bold text-slate-800 tabular-nums">{formatRupiah(o.total)}</span>
      </div>
    </button>
  );
}

function PanelDetail({ id }: { id: number }) {
  const navigasi = useNavigate();
  const saya = usePengguna();
  const detail = useDetailOrder(id);
  const kirim = useKirimOrder();
  const lepas = useLepasOrder();
  const keDraf = useKeDrafOrder();
  const [dialogBatal, setDialogBatal] = useState(false);
  const [dialogSimpan, setDialogSimpan] = useState(false);
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
  const pembuatAtauKasir = pembuat || izin('penjualan.checkout');
  const bolehUbah =
    (d.status === 'DRAFT' && pembuat) ||
    ((d.status === 'MENUNGGU' || d.status === 'DISIMPAN') && pembuatAtauKasir) ||
    (d.status === 'DIPROSES' && pemegang);
  const bolehBatal =
    d.status === 'DRAFT' || d.status === 'MENUNGGU' || d.status === 'DISIMPAN'
      ? pembuat || izin('penjualan.order.batal')
      : d.status === 'DIPROSES' &&
        izin('penjualan.order.batal') &&
        (pemegang || izin('penjualan.order.lepas_paksa'));
  // K-122: simpan untuk nanti dan kembali ke draf.
  const bolehSimpan =
    (d.status === 'DRAFT' && pembuat) ||
    (d.status === 'MENUNGGU' && pembuatAtauKasir) ||
    (d.status === 'DIPROSES' && pemegang);
  const bolehKeDraf =
    ((d.status === 'MENUNGGU' || d.status === 'DISIMPAN') && pembuatAtauKasir) ||
    (d.status === 'DIPROSES' && (pemegang || izin('penjualan.order.lepas_paksa')));
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Order {d.nomor}</h2>
            <BadgeStatusOrder status={d.status} />
            {d.basi && (
              <Badge
                variant="outline"
                className="border-red-200 bg-red-50 text-red-700"
                title={KETERANGAN_BASI}
              >
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
          {d.status === 'DISIMPAN' && (
            <p
              className={cn(
                'mt-1 flex flex-wrap items-center gap-x-3 text-sm font-semibold',
                d.lewatTanggalAmbil ? 'text-red-700' : 'text-violet-800',
              )}
            >
              <span className="flex items-center gap-1">
                <CalendarClock className="size-4" /> Diambil {formatTanggal(d.tanggalAmbil)}
                {d.lewatTanggalAmbil && ' (sudah lewat: hubungi pembeli)'}
              </span>
              {d.noHpPembeli && (
                <span className="flex items-center gap-1">
                  <Phone className="size-4" /> {d.noHpPembeli}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap justify-end gap-2">
          {bolehUbah && (
            <Button variant="outline" asChild>
              <Link to={`/order?ubah=${d.id}`}>
                <Pencil /> Ubah
              </Link>
            </Button>
          )}
          {bolehBatal && (
            <Button variant="outline" onClick={() => setDialogBatal(true)}>
              <X /> Batalkan
            </Button>
          )}
          {bolehSimpan && (
            <Button variant="outline" onClick={() => setDialogSimpan(true)}>
              <CalendarClock /> Simpan untuk nanti
            </Button>
          )}
          {bolehKeDraf && (
            <Button
              variant="outline"
              disabled={keDraf.isPending}
              title="Stok dilepas; daftar barang tetap tersimpan sebagai draf milik pembuat order"
              onClick={() =>
                jalankan(
                  keDraf.mutateAsync(d.id),
                  `Order ${d.nomor} dikembalikan ke draf; stoknya dilepas.`,
                )
              }
            >
              <FilePen /> Kembalikan ke draf
            </Button>
          )}
          {((d.status === 'DRAFT' && pembuat) || (d.status === 'DISIMPAN' && pembuatAtauKasir)) && (
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
            (d.status === 'MENUNGGU' ||
              d.status === 'DISIMPAN' ||
              (d.status === 'DIPROSES' && pemegang)) && (
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
                    {b.diskonPromo > 0 && (
                      <div className="text-xs text-emerald-700">
                        Promo {b.namaPromo} − {formatRupiah(b.diskonPromo)}
                      </div>
                    )}
                    {b.promoNonaktif && <div className="text-xs text-slate-400">promo dilepas</div>}
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
      {dialogSimpan && (
        <DialogSimpanOrder
          order={{
            nomor: d.nomor,
            namaPelanggan: d.namaPelanggan,
            namaPembeli: d.namaPembeli,
            noHp: d.noHpPembeli,
          }}
          siapkan={() => Promise.resolve(d.id)}
          onTersimpan={() => setDialogSimpan(false)}
          onTutup={() => setDialogSimpan(false)}
        />
      )}
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
          {semua ? 'Semua order.' : 'Order yang Anda buat.'} {KET_SARING[saring]}
        </p>
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
