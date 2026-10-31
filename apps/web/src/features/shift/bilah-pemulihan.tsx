import { formatRupiah } from '@sit/shared';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useMatiMendadak, useSelesaiPemulihan } from '@/api/data';
import { useDetailShift, useShiftSaya } from '@/api/penjualan';
import { Button } from '@/components/ui/button';
import { formatWaktu } from '@/lib/format';
import { bolehAkses } from '@/lib/menu';

/*
 * K-216: aplikasi mati mendadak (listrik/komputer mati, Windows dipaksa mati) saat shift terbuka. Bilah ini tampil di
 * atas semua halaman sampai pemegang shift menyatakan sudah memeriksa. Transaksi yang sudah tersimpan aman (database
 * mencatat tiap transaksi saat itu juga); yang perlu diperiksa hanya transaksi yang sedang diketik saat mati.
 */
export function BilahPemulihan() {
  const pengguna = usePengguna();
  const mati = useMatiMendadak().data;
  const shift = useShiftSaya(Boolean(mati)).data;
  const detail = useDetailShift(mati && shift ? shift.id : null).data;
  const selesai = useSelesaiPemulihan();
  const [buka, setBuka] = useState(true);
  if (!mati) return null;
  const bolehSelesai = bolehAkses(pengguna, 'kas.shift.kelola_sendiri');
  const r = detail?.ringkasan ?? null;

  return (
    <div
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden"
      data-testid="bilah-pemulihan"
    >
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1">
          <b>BonsaiUrip sebelumnya mati mendadak</b>
          {mati.terakhirHidup
            ? ` (terakhir aktif sekitar ${formatWaktu(mati.terakhirHidup)})`
            : ''}{' '}
          saat shift <b>{mati.shift ?? shift?.nomor ?? '-'}</b> masih terbuka. Data yang sudah
          tersimpan aman; periksa langkah di bawah.
        </p>
        <Button size="sm" variant="ghost" onClick={() => setBuka((b) => !b)}>
          {buka ? <ChevronUp /> : <ChevronDown />} {buka ? 'Ringkas' : 'Lihat langkah'}
        </Button>
      </div>
      {buka && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-amber-200 bg-white p-3">
            <p className="mb-2 font-semibold">Keadaan shift</p>
            {shift ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-slate-500">Nomor</dt>
                <dd>{shift.nomor}</dd>
                <dt className="text-slate-500">Dibuka</dt>
                <dd>
                  {formatWaktu(shift.waktuBuka)} oleh {shift.namaPembuka}
                </dd>
                <dt className="text-slate-500">Modal awal</dt>
                <dd>{formatRupiah(shift.modalAwal)}</dd>
                {r ? (
                  <>
                    <dt className="text-slate-500">Transaksi tercatat</dt>
                    <dd>{r.jumlahTransaksi}</dd>
                    <dt className="text-slate-500">Tunai dari penjualan</dt>
                    <dd>{formatRupiah(r.tunaiPenjualan)}</dd>
                    <dt className="text-slate-500">Kas masuk / keluar lain</dt>
                    <dd>
                      {formatRupiah(r.kasMasukLain)} / {formatRupiah(r.kasKeluar)}
                    </dd>
                    <dt className="text-slate-500">Uang laci seharusnya</dt>
                    <dd className="font-semibold">{formatRupiah(r.saldoSistem)}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-slate-500">Kas masuk/keluar dicatat</dt>
                    <dd>{detail?.kas.length ?? '…'}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-slate-600">
                Shift sudah ditutup. Tidak ada yang perlu dicocokkan.
              </p>
            )}
          </div>
          <div className="rounded-md border border-amber-200 bg-white p-3">
            <p className="mb-2 font-semibold">Langkah pemeriksaan</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Buka{' '}
                <Link className="text-blue-700 underline" to="/penjualan-langsung">
                  Penjualan Langsung › Riwayat
                </Link>
                : transaksi terakhir sebelum mati harus ada. Transaksi yang sedang diketik saat mati
                (belum dibayar) tidak tersimpan: catat ulang.
              </li>
              <li>
                Cocokkan struk/nota kertas terakhir dengan riwayat; pembayaran non-tunai cek di
                rekening.
              </li>
              <li>
                Hitung uang laci di{' '}
                <Link className="text-blue-700 underline" to="/shift">
                  Shift & Clerical Check
                </Link>{' '}
                (hitung susulan atau tutup shift). Selisih dijelaskan di keterangan.
              </li>
              <li>
                Lanjutkan berjualan di shift yang sama, atau tutup shift bila hari sudah selesai.
              </li>
              <li>
                Bila data tampak rusak (jarang): Owner memakai data dari cadangan harian di
                Pengaturan › Data.
              </li>
            </ol>
            {bolehSelesai && (
              <Button
                size="sm"
                className="mt-3"
                disabled={selesai.isPending}
                onClick={() =>
                  void selesai
                    .mutateAsync()
                    .then(() => toast.success('Pemeriksaan dicatat. Silakan lanjut bekerja.'))
                    .catch((err: unknown) => toast.error(pesanGalat(err)))
                }
              >
                {selesai.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Sudah
                saya periksa
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
