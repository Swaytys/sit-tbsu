import {
  formatRupiah,
  LABEL_JENIS_PENJUALAN,
  LABEL_METODE_PEMBAYARAN,
  type BantuanSelisih,
  type TinjauanShift,
} from '@sit/shared';
import { Lightbulb, ListChecks } from 'lucide-react';
import { formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Tinjauan shift (K-121 butir 6): apa saja yang terjadi selama shift, terutama uang tunai di laci. */
export function TampilTinjauan({ t }: { t: TinjauanShift }) {
  return (
    <div className="space-y-3 text-sm" data-testid="tinjauan-shift">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border p-2">
          <p className="text-xs text-slate-500">Transaksi</p>
          <p className="text-lg font-bold">{t.jumlahTransaksi}</p>
          {t.perJenis.map((j) => (
            <p key={j.jenis} className="text-xs text-slate-600">
              {LABEL_JENIS_PENJUALAN[j.jenis]}: {j.jumlah} · {formatRupiah(j.total)}
            </p>
          ))}
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-slate-500">Pembayaran per cara</p>
          {t.perMetode.length === 0 && <p className="text-xs text-slate-500">Belum ada.</p>}
          {t.perMetode.map((m) => (
            <p key={m.metode} className="flex justify-between text-xs">
              <span>
                {LABEL_METODE_PEMBAYARAN[m.metode]} ({m.jumlah})
              </span>
              <b className="tabular-nums">{formatRupiah(m.total)}</b>
            </p>
          ))}
          <p className="mt-1 text-xs text-slate-500">
            Kembalian diberikan: {formatRupiah(t.totalKembalian)}
          </p>
        </div>
      </div>
      {(t.void.jumlah > 0 || t.retur.jumlah > 0) && (
        <p className="text-xs text-slate-600">
          Refund tunai: void {t.void.jumlah} ({formatRupiah(t.void.total)}) · retur {t.retur.jumlah}{' '}
          ({formatRupiah(t.retur.total)})
        </p>
      )}
      <div>
        <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Linimasa uang tunai di laci
        </p>
        <div className="max-h-80 overflow-y-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Jam</th>
                <th className="px-2 py-1 font-medium">Kejadian</th>
                <th className="px-2 py-1 text-right font-medium">Masuk</th>
                <th className="px-2 py-1 text-right font-medium">Keluar</th>
                <th className="px-2 py-1 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {t.linimasa.map((l, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-slate-500 tabular-nums">
                    {formatWaktu(l.waktu).slice(11)}
                  </td>
                  <td className="px-2 py-1">
                    {l.label}
                    {l.uangDiterima !== null && l.kembalian !== null && l.kembalian > 0 && (
                      <span className="block text-slate-500">
                        terima {formatRupiah(l.uangDiterima)}, kembalian {formatRupiah(l.kembalian)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right text-emerald-700 tabular-nums">
                    {l.masuk > 0 ? formatRupiah(l.masuk) : ''}
                  </td>
                  <td className="px-2 py-1 text-right text-red-700 tabular-nums">
                    {l.keluar > 0 ? formatRupiah(l.keluar) : ''}
                  </td>
                  <td className="px-2 py-1 text-right font-medium tabular-nums">
                    {formatRupiah(l.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Bantuan mencari sebab selisih (K-121 butir 7). Saran, bukan tuduhan. */
export function TampilBantuan({ b }: { b: BantuanSelisih }) {
  if (b.selisih === 0) return null;
  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border p-3 text-sm',
        b.dalamToleransi ? 'border-slate-200 bg-slate-50' : 'border-amber-300 bg-amber-50',
      )}
      data-testid="bantuan-selisih"
    >
      <p className="flex items-center gap-1.5 font-semibold text-slate-900">
        <Lightbulb className="size-4 text-amber-600" /> Bantuan mencari sebab selisih
      </p>
      {b.petunjuk.length > 0 && (
        <ul className="space-y-1">
          {b.petunjuk.map((p, i) => (
            <li key={i} className="rounded border border-amber-200 bg-white p-2">
              <b>{p.judul}</b>
              <span className="block text-slate-600">{p.rincian}</span>
            </li>
          ))}
        </ul>
      )}
      {b.periksa.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <ListChecks className="size-3.5" /> Periksa juga
          </p>
          <ul className="list-disc pl-5 text-xs text-slate-700">
            {b.periksa.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Ini saran dari kecocokan angka, bukan tuduhan. Data tidak diubah.
      </p>
    </div>
  );
}
