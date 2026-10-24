import { formatRupiah, LABEL_METODE_PEMBAYARAN_PEMASOK, ukuranKertasCss } from '@sit/shared';
import { ArrowLeft, Printer, Wallet } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useDetailPenyelesaianKonsinyasi } from '@/api/konsinyasi';
import { useTampilanToko } from '@/api/pengaturan';
import { AreaCetak } from '@/components/area-cetak';
import { NotaSetoranKonsinyasiA4 } from '@/components/dokumen-a4';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTanggal, formatWaktu } from '@/lib/format';
import { BadgeStatusHutang, DialogBayarHutang } from '../hutang/halaman-hutang';
import { TabelSetoran } from './tabel-setoran';

function Info({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{judul}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}

/** Detail setoran konsinyasi (hanya baca), pembayaran, dan cetak nota setoran. */
export function HalamanDetailKonsinyasi() {
  const { id } = useParams();
  const detail = useDetailPenyelesaianKonsinyasi(Number(id));
  const toko = useTampilanToko().data;
  const bolehBayar = usePengguna().izin.includes('hutang.kelola');
  const [bayar, setBayar] = useState(false);
  const [cetak, setCetak] = useState(false);
  useEffect(() => {
    if (!cetak) return;
    const t = setTimeout(() => {
      window.print();
      setCetak(false);
    }, 150);
    return () => clearTimeout(t);
  }, [cetak]);

  if (detail.error) return <p className="p-6 text-sm text-red-600">{pesanGalat(detail.error)}</p>;
  const k = detail.data;
  if (!k) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/konsinyasi?tab=riwayat" aria-label="Kembali ke riwayat setoran">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              {k.nomor} <BadgeStatusHutang status={k.statusHutang} />
            </h1>
            <p className="text-sm text-slate-500">
              Setoran konsinyasi {k.namaPemasok} · {formatWaktu(k.tanggal)} · dibuat{' '}
              {k.namaPengguna}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {bolehBayar && k.sisaHutang > 0 && (
            <Button onClick={() => setBayar(true)}>
              <Wallet /> Bayar
            </Button>
          )}
          <Button variant="outline" onClick={() => setCetak(true)} disabled={!toko}>
            <Printer /> Cetak nota setoran
          </Button>
        </div>
      </div>

      <Card className="grid grid-cols-4 gap-4 p-5 text-sm">
        <Info judul="Periode penjualan">
          {formatTanggal(k.periodeMulai)} – {formatTanggal(k.periodeSelesai)}
        </Info>
        <Info judul="Total setoran">{formatRupiah(k.total)}</Info>
        <Info judul="Sudah dibayar">{formatRupiah(k.totalDibayar)}</Info>
        <Info judul="Sisa">
          <span className={k.sisaHutang > 0 ? 'text-red-600' : ''}>
            {formatRupiah(k.sisaHutang)}
          </span>
        </Info>
        {k.catatan && (
          <div className="col-span-4">
            <Info judul="Catatan">{k.catatan}</Info>
          </div>
        )}
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <TabelSetoran baris={k.baris} total={k.total} />
      </Card>

      <Card className="gap-0 py-0">
        <div className="border-b p-3 text-sm font-semibold text-slate-700">Pembayaran</div>
        {k.pembayaran.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">Belum ada pembayaran.</p>
        ) : (
          <ul className="divide-y text-sm">
            {k.pembayaran.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 p-3">
                <div>
                  <div className="font-mono text-xs font-medium">{b.nomor}</div>
                  <div className="text-xs text-slate-500">
                    {formatWaktu(b.tanggal)} · {b.namaPengguna} ·{' '}
                    {LABEL_METODE_PEMBAYARAN_PEMASOK[b.metode]}
                    {b.rekening && ` · ${b.rekening}`}
                    {b.referensi && ` · ref ${b.referensi}`}
                  </div>
                </div>
                <div className="font-semibold tabular-nums">{formatRupiah(b.nominal)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {bayar && (
        <DialogBayarHutang
          h={{
            jenis: 'KONSINYASI',
            id: k.id,
            nomor: k.nomor,
            namaPemasok: k.namaPemasok,
            sisa: k.sisaHutang,
            tanggalJatuhTempo: null,
          }}
          onTutup={() => setBayar(false)}
        />
      )}
      {cetak && toko && (
        <AreaCetak ukuranKertas={ukuranKertasCss(toko.kertasDokumenLain)}>
          <NotaSetoranKonsinyasiA4 k={k} toko={toko} />
        </AreaCetak>
      )}
    </div>
  );
}
