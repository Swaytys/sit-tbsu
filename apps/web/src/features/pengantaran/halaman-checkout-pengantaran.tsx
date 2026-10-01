import { formatRupiah, skemaCheckout, type DataPembayaran } from '@sit/shared';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useCheckout, useDetailOrder, useLepasOrder } from '@/api/penjualan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDesimal } from '@/lib/format';
import { PanelPembayaran } from '../kasir/panel-pembayaran';

/**
 * Checkout order pengantaran menjadi invoice (docs/05 P7): pembayaran penuh, DP, atau tanpa pembayaran;
 * bayar saat terima; jatuh tempo (kosong = default term pelanggan).
 */
export function HalamanCheckoutPengantaran() {
  const [url] = useSearchParams();
  const idOrder = Number(url.get('order')) || null;
  const navigasi = useNavigate();
  const saya = usePengguna();
  const order = useDetailOrder(idOrder);
  const checkout = useCheckout();
  const lepas = useLepasOrder();
  const [bayarSaatTerima, setBayarSaatTerima] = useState(false);
  const [jatuhTempo, setJatuhTempo] = useState('');
  const o = order.data;

  if (!idOrder) {
    return <p className="p-6 text-sm text-slate-500">Pilih order pengantaran dari antrean.</p>;
  }
  if (!o) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const halangan =
    o.jenisPenjualan !== 'PENGANTARAN'
      ? 'Order ini bukan pengantaran.'
      : o.status === 'DIPROSES' && o.idKasirProses !== saya.id
        ? `Order sedang diproses ${o.namaKasirProses ?? 'kasir lain'}.`
        : o.status !== 'MENUNGGU' && o.status !== 'DIPROSES'
          ? `Order sudah ${o.status === 'SELESAI' ? 'selesai' : 'dibatalkan'}.`
          : null;

  function simpan(pembayaran: DataPembayaran[]) {
    const data = skemaCheckout.safeParse({
      idOrder,
      pembayaran,
      bayarSaatTerima,
      tanggalJatuhTempo: jatuhTempo || null,
    });
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    checkout
      .mutateAsync(data.data)
      .then((p) => {
        toast.success(`Invoice ${p.nomor} dibuat.`);
        void navigasi(`/penjualan/${p.id}`, { replace: true });
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/penjualan-pengantaran?tab=checkout" aria-label="Kembali">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Buat invoice dari {o.nomor}</h1>
          <p className="text-sm text-slate-500">
            {o.namaPelanggan} · dibuat {o.namaPengguna}
          </p>
        </div>
      </div>
      {halangan && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {halangan}
        </div>
      )}
      <div className="flex gap-4">
        <div className="flex-1 space-y-4">
          <Card className="gap-1 p-4 text-sm">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase">
              <MapPin className="size-4" /> Pengiriman
            </div>
            <div className="font-medium">{o.alamatKirim}</div>
            {o.catatanKirim && <div className="text-slate-600">{o.catatanKirim}</div>}
          </Card>
          <Card className="gap-0 py-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Barang</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Harga</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {o.baris.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2">{b.namaBarang}</td>
                    <td className="px-3 py-2 text-right">
                      {formatDesimal(b.qty)} {b.kodeSatuan}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatRupiah(b.hargaSatuan)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatRupiah(b.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-72 space-y-1 border-t p-4 text-sm">
              {o.diskonTransaksi > 0 && (
                <div className="flex justify-between">
                  <span>Diskon</span>
                  <span>− {formatRupiah(o.diskonTransaksi)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Ongkos kirim</span>
                <span>{formatRupiah(o.ongkir)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total tagihan</span>
                <span data-testid="total-invoice">{formatRupiah(o.total)}</span>
              </div>
            </div>
          </Card>
        </div>
        <Card className="flex w-[380px] shrink-0 flex-col gap-3 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={bayarSaatTerima}
              onChange={(e) => setBayarSaatTerima(e.target.checked)}
            />
            Pelanggan membayar saat barang diterima (ke sopir)
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-600">Jatuh tempo bila belum lunas</span>
            <Input
              type="date"
              value={jatuhTempo}
              onChange={(e) => setJatuhTempo(e.target.value)}
              className="h-8 w-40"
              aria-label="Tanggal jatuh tempo"
            />
          </label>
          <p className="text-xs text-slate-500">
            Kosongkan jatuh tempo untuk memakai term pelanggan. Pembayaran boleh penuh, DP, atau
            nanti.
          </p>
          <PanelPembayaran
            total={o.total}
            bolehKurang
            memproses={checkout.isPending}
            nonaktif={halangan !== null}
            labelBayar="Buat invoice"
            onBayar={simpan}
          />
          {o.status === 'DIPROSES' && o.idKasirProses === saya.id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void lepas
                  .mutateAsync(o.id)
                  .then(() => navigasi('/penjualan-pengantaran?tab=checkout'))
                  .catch((err: unknown) => toast.error(pesanGalat(err)))
              }
            >
              Kembalikan order ke antrean
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
