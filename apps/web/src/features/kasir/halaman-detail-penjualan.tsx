import { formatRupiah, type DataPembayaran, type DetailPenjualan } from '@sit/shared';
import { ArrowLeft, PackageCheck, Printer, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useTampilanToko } from '@/api/pengaturan';
import {
  catatCetakUlang,
  useBayarPenjualan,
  useDetailPenjualan,
  useTandaiDiambil,
} from '@/api/penjualan';
import { AreaCetak } from '@/components/area-cetak';
import { BadgeStatusBayar } from '@/components/status-badge';
import { Struk } from '@/components/struk';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDesimal, formatTanggal, formatWaktu } from '@/lib/format';
import { LABEL_STATUS_PENGAMBILAN, LABEL_STATUS_PENGIRIMAN } from '@/lib/label';
import { PanelPembayaran } from './panel-pembayaran';

function Info({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{judul}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}

/** Terima pembayaran susulan (DP lanjutan, pelunasan, bayar saat terima; P8). */
export function DialogTerimaPembayaran({
  p,
  onTutup,
}: {
  p: Pick<DetailPenjualan, 'id' | 'nomor' | 'sisaTagihan'>;
  onTutup: () => void;
}) {
  const bayar = useBayarPenjualan();
  function kirim(daftar: DataPembayaran[]) {
    const [pembayaran] = daftar;
    if (!pembayaran) return;
    bayar
      .mutateAsync({ id: p.id, pembayaran })
      .then((h) => {
        toast.success(
          h.statusPembayaran === 'LUNAS'
            ? `${p.nomor} lunas.`
            : `Pembayaran dicatat; sisa ${formatRupiah(h.sisaTagihan)}.`,
        );
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="flex min-h-[480px] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terima pembayaran {p.nomor}</DialogTitle>
          <DialogDescription>Sisa tagihan {formatRupiah(p.sisaTagihan)}.</DialogDescription>
        </DialogHeader>
        <PanelPembayaran
          total={p.sisaTagihan}
          bolehKurang
          memproses={bayar.isPending}
          labelBayar="Simpan pembayaran"
          onBayar={kirim}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Detail penjualan (langsung/pengantaran): baris, pembayaran, cetak ulang, pelunasan, konfirmasi diambil. */
export function HalamanDetailPenjualan() {
  const { id } = useParams();
  const detail = useDetailPenjualan(Number(id));
  const toko = useTampilanToko().data;
  const saya = usePengguna();
  const diambil = useTandaiDiambil();
  const [dialogBayar, setDialogBayar] = useState(false);
  const p = detail.data;
  if (!p) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const langsung = p.jenisPenjualan === 'LANGSUNG';
  const lihatHpp = p.baris.some((b) => b.hppSaatTransaksi !== undefined);

  function cetakUlang() {
    if (!p) return;
    void catatCetakUlang(p.id)
      .then(() => window.print())
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              to={langsung ? '/penjualan-langsung?tab=riwayat' : '/penjualan-pengantaran'}
              aria-label="Kembali"
            >
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              {p.nomor} <BadgeStatusBayar status={p.statusPembayaran} />
              {p.statusTransaksi !== 'SELESAI' && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  {p.statusTransaksi === 'VOID' ? 'Void' : 'Void sebagian'}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-slate-500">
              {langsung ? 'Penjualan langsung' : 'Penjualan pengantaran'} · {formatWaktu(p.tanggal)}{' '}
              · kasir {p.namaKasir}
              {p.nomorOrder && ` · dari order ${p.nomorOrder}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {p.statusPengambilan === 'BELUM_DIAMBIL' && saya.izin.includes('penjualan.checkout') && (
            <Button
              variant="outline"
              disabled={diambil.isPending}
              onClick={() =>
                void diambil
                  .mutateAsync(p.id)
                  .then(() => toast.success('Barang sudah diambil.'))
                  .catch((err: unknown) => toast.error(pesanGalat(err)))
              }
            >
              <PackageCheck /> Sudah diambil
            </Button>
          )}
          {p.sisaTagihan > 0 &&
            p.statusTransaksi !== 'VOID' &&
            saya.izin.includes('penjualan.pembayaran.catat') && (
              <Button onClick={() => setDialogBayar(true)}>
                <Wallet /> Terima pembayaran
              </Button>
            )}
          {langsung && (
            <Button variant="outline" onClick={cetakUlang}>
              <Printer /> Cetak ulang struk
            </Button>
          )}
        </div>
      </div>

      <Card className="grid grid-cols-4 gap-4 p-5 text-sm">
        <Info judul="Pembeli">{p.namaPelanggan ?? p.namaPembeli ?? 'Pembeli umum'}</Info>
        <Info judul="Total">{formatRupiah(p.totalNeto)}</Info>
        <Info judul="Dibayar">{formatRupiah(p.totalDibayar)}</Info>
        <Info judul="Sisa tagihan">
          <span className={p.sisaTagihan > 0 ? 'text-red-600' : ''}>
            {formatRupiah(p.sisaTagihan)}
          </span>
        </Info>
        <Info judul={langsung ? 'Barang' : 'Pengiriman'}>
          {p.statusPengambilan
            ? LABEL_STATUS_PENGAMBILAN[p.statusPengambilan]
            : p.statusPengiriman
              ? LABEL_STATUS_PENGIRIMAN[p.statusPengiriman]
              : '—'}
        </Info>
        <Info judul="Jatuh tempo">{formatTanggal(p.tanggalJatuhTempo)}</Info>
        <Info judul="Shift">{p.nomorShift ?? '—'}</Info>
        {!langsung && <Info judul="Alamat kirim">{p.alamatKirim}</Info>}
      </Card>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barang</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead className="text-right">Diskon</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {lihatHpp && <TableHead className="text-right">HPP</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.baris.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.namaBarang}</div>
                  <div className="text-xs text-slate-500">
                    {b.hargaManual ? 'Harga manual' : b.namaTier}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDesimal(b.qty)} {b.kodeSatuan}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(b.hargaSatuan)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.diskonBaris > 0 ? formatRupiah(b.diskonBaris) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatRupiah(b.subtotal)}
                </TableCell>
                {lihatHpp && (
                  <TableCell className="text-right text-slate-500 tabular-nums">
                    {formatRupiah(b.hppSaatTransaksi ?? 0)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="ml-auto w-80 space-y-1 border-t p-4 text-sm">
          {p.diskonTransaksi > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Diskon transaksi</span>
              <span className="tabular-nums">− {formatRupiah(p.diskonTransaksi)}</span>
            </div>
          )}
          {p.ongkir > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Ongkos kirim</span>
              <span className="tabular-nums">{formatRupiah(p.ongkir)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(p.totalNeto)}</span>
          </div>
        </div>
      </Card>

      <Card className="gap-2 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Riwayat pembayaran</h2>
        {p.pembayaran.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada pembayaran.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {p.pembayaran.map((b) => (
                <tr key={b.id}>
                  <td className="py-1.5 font-mono text-xs">{b.nomor}</td>
                  <td className="py-1.5">{formatWaktu(b.tanggal)}</td>
                  <td className="py-1.5">
                    {b.jenis === 'PENUH' ? 'Penuh' : b.jenis === 'DP' ? 'DP' : 'Pelunasan'} ·{' '}
                    {b.metode === 'TUNAI' ? 'Tunai' : `${b.metode} ${b.rekening ?? ''}`}
                    {b.referensi && ` (${b.referensi})`}
                  </td>
                  <td className="py-1.5 text-slate-500">{b.namaPengguna}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">
                    {formatRupiah(b.nominal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialogBayar && <DialogTerimaPembayaran p={p} onTutup={() => setDialogBayar(false)} />}
      {langsung && toko && (
        <AreaCetak ukuranKertas={`${toko.lebarStrukMm}mm auto`}>
          <Struk p={p} toko={toko} />
        </AreaCetak>
      )}
    </div>
  );
}
