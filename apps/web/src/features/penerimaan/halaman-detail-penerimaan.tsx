import { formatRupiah } from '@sit/shared';
import { ArrowLeft, Plus, Printer, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useTampilanToko } from '@/api/pengaturan';
import { useDetailPenerimaan } from '@/api/persediaan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDesimal, formatTanggal, formatWaktu } from '@/lib/format';
import { LABEL_JENIS_PENERIMAAN } from '@/lib/label';
import { DialogBayarHutang } from '../hutang/halaman-hutang';
import { BadgeHutang } from './halaman-penerimaan';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-800">{children}</div>
    </div>
  );
}

/** Detail penerimaan dan bukti terima yang bisa dicetak (docs/05 E6). */
export function HalamanDetailPenerimaan() {
  const id = Number(useParams().id);
  const detail = useDetailPenerimaan(id);
  const toko = useTampilanToko().data;
  const bolehBayar = usePengguna().izin.includes('hutang.kelola');
  const [bayar, setBayar] = useState(false);

  if (detail.error) return <p className="p-6 text-sm text-red-600">{pesanGalat(detail.error)}</p>;
  const p = detail.data;
  if (!p) return <p className="p-6 text-sm text-slate-500">Memuat…</p>;
  const konsinyasi = p.jenis === 'KONSINYASI';
  const total = p.baris.reduce((t, b) => t + b.subtotal, 0);

  return (
    <div className="space-y-4 p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/penerimaan" aria-label="Kembali ke riwayat penerimaan">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold text-slate-900">Penerimaan {p.nomor}</h1>
        </div>
        <div className="flex gap-2">
          {bolehBayar && p.sisaHutang > 0 && (
            <Button variant="outline" onClick={() => setBayar(true)}>
              <Wallet /> Bayar hutang
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/penerimaan/baru">
              <Plus /> Penerimaan baru
            </Link>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Cetak bukti terima
          </Button>
        </div>
      </div>

      <Card className="gap-4 p-6 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-lg font-bold">{toko?.namaToko}</div>
            <div className="text-sm text-slate-500">{toko?.namaBadanUsaha}</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold">BUKTI PENERIMAAN BARANG</div>
            <div className="font-mono text-sm">{p.nomor}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <Info label="Tanggal">{formatWaktu(p.tanggal)}</Info>
          <Info label="Pemasok">
            {p.namaPemasok}{' '}
            <span className="font-mono text-xs text-slate-500">({p.kodePemasok})</span>
          </Info>
          <Info label="Jenis">
            {LABEL_JENIS_PENERIMAAN[p.jenis]}
            {p.syaratBayar && ` · ${p.syaratBayar === 'TUNAI' ? 'Tunai' : 'Tempo'}`}
          </Info>
          <Info label="Status hutang">
            <BadgeHutang p={p} />
          </Info>
          <Info label="No. faktur pemasok">{p.noFakturPemasok ?? '—'}</Info>
          <Info label="No. surat jalan pemasok">{p.noSuratJalanPemasok ?? '—'}</Info>
          <Info label="Jatuh tempo">{formatTanggal(p.tanggalJatuhTempo)}</Info>
          <Info label="Dicatat oleh">{p.namaPengguna}</Info>
          {p.idOrderPembelian && (
            <Info label="Order pembelian">
              <Link
                className="text-blue-700 hover:underline"
                to={`/order-pembelian?status=&id=${p.idOrderPembelian}`}
              >
                {p.nomorOrderPembelian}
              </Link>
            </Info>
          )}
        </div>
        {p.catatan && <p className="text-sm text-slate-600">Catatan: {p.catatan}</p>}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Nama barang</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">
                {konsinyasi ? 'Harga titip' : 'Harga modal'}
              </TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.baris.map((b, i) => (
              <TableRow key={b.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-mono text-xs">{b.kodeBarang}</TableCell>
                <TableCell>{b.namaBarang}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDesimal(b.qtyMasuk)} {b.kodeSatuan}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(b.hargaModalMasuk)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(b.subtotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-right">
                {konsinyasi ? 'Nilai titipan' : 'Total faktur'}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatRupiah(konsinyasi ? total : p.totalFaktur)}
              </TableCell>
            </TableRow>
            {!konsinyasi && (
              <TableRow>
                <TableCell colSpan={5} className="text-right">
                  Sisa hutang
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(p.sisaHutang)}
                </TableCell>
              </TableRow>
            )}
          </TableFooter>
        </Table>

        {p.pembayaran.length > 0 && (
          <div className="text-sm text-slate-600">
            Pembayaran:{' '}
            {p.pembayaran
              .map(
                (x) =>
                  `${x.nomor} · ${formatRupiah(x.nominal)} (${x.metode === 'TUNAI' ? 'tunai' : 'transfer'})`,
              )
              .join('; ')}
          </div>
        )}

        <div className="mt-8 hidden grid-cols-2 gap-8 text-center text-sm print:grid">
          <div>
            Diserahkan,
            <div className="mt-16 border-t pt-1">{p.namaPemasok}</div>
          </div>
          <div>
            Diterima,
            <div className="mt-16 border-t pt-1">{p.namaPengguna}</div>
          </div>
        </div>
      </Card>
      {bayar && (
        <DialogBayarHutang
          h={{
            jenis: 'PENERIMAAN',
            id: p.id,
            nomor: p.nomor,
            namaPemasok: p.namaPemasok,
            sisa: p.sisaHutang,
            tanggalJatuhTempo: p.tanggalJatuhTempo,
          }}
          onTutup={() => setBayar(false)}
        />
      )}
    </div>
  );
}
