import type { PerluDikirim } from '@sit/shared';
import { Phone } from 'lucide-react';
import { Link } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDesimal, formatWaktu } from '@/lib/format';

/**
 * K-173: info cepat order kirim (pembeli, telepon, alamat, catatan, barang) tanpa membuka halaman invoice.
 */
export function InfoOrderKirim({ p, onTutup }: { p: PerluDikirim; onTutup: () => void }) {
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            {p.noAntrean !== null && (
              <span className="rounded bg-slate-900 px-1.5 text-lg font-black text-white">
                #{p.noAntrean}
              </span>
            )}
            {p.namaPelanggan ?? 'Pembeli umum'}
          </DialogTitle>
          <DialogDescription>
            {p.nomor} · {formatWaktu(p.tanggal)}
            {p.sebagian && ' · sebagian sudah dijadwalkan/dikirim'}
            {p.kirimUlang && ' · kirim ulang'}
            {p.bayarSaatTerima && ' · bayar di tempat'}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-slate-500">Telepon</dt>
          <dd>
            {p.noHp ? (
              <a href={`tel:${p.noHp}`} className="inline-flex items-center gap-1 text-blue-700">
                <Phone className="size-3.5" /> {p.noHp}
              </a>
            ) : (
              '—'
            )}
          </dd>
          <dt className="text-slate-500">Alamat</dt>
          <dd>{p.alamatKirim ?? '—'}</dd>
          <dt className="text-slate-500">Catatan</dt>
          <dd>{p.catatanKirim ?? '—'}</dd>
          <dt className="text-slate-500">Belum dikirim</dt>
          <dd>
            <ul className="space-y-0.5">
              {p.baris.map((b) => (
                <li key={b.namaBarang}>
                  {b.namaBarang}{' '}
                  <b className="tabular-nums">
                    {formatDesimal(b.qtyBelumDikirim)} {b.kodeSatuan}
                  </b>
                  {b.tanpaMuatan && (
                    <Link
                      to={`/barang/${b.idBarang}`}
                      className="ml-1 text-xs text-red-700 hover:underline"
                    >
                      isi data muatan
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
        <Link
          to={`/penjualan/${p.idPenjualan}?dari=pengiriman`}
          className="text-sm text-blue-700 hover:underline"
        >
          Buka invoice lengkap
        </Link>
      </DialogContent>
    </Dialog>
  );
}
