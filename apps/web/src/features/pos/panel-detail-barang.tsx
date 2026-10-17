import {
  formatRupiah,
  kurangQty,
  LABEL_STATUS_STOK,
  type BarisBarang,
  type OpsiSatuanBaris,
} from '@sit/shared';
import { ImageOff } from 'lucide-react';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';
import { opsiDariBarang } from './model';

const WARNA_STATUS: Record<BarisBarang['statusStok'], string> = {
  HABIS: 'bg-red-100 text-red-800',
  KRITIS: 'bg-orange-100 text-orange-800',
  PERLU_RESTOCK: 'bg-amber-100 text-amber-800',
  AMAN: 'bg-emerald-100 text-emerald-800',
};

/**
 * Rincian lengkap barang yang sedang disorot di hasil cari layar kasir (K-114). Ditampilkan menutupi area papan
 * antrean (yang tidak dibutuhkan selama memilih barang), sehingga seluruh rincian terlihat tanpa menggulir.
 * Hanya menampilkan data yang sudah ada di hasil cari; tidak memuat ulang apa pun.
 */
export function PanelDetailBarang({
  b,
  o,
  qty,
}: {
  b: BarisBarang;
  /** Satuan yang sedang disorot (satuan dasar atau kemasan). */
  o: OpsiSatuanBaris;
  /** Qty yang akan ditambahkan bila Enter ditekan. */
  qty: string;
}) {
  const tier = (useDaftarTingkatHarga().data ?? [])
    .filter((t) => t.statusAktif === 'AKTIF')
    .sort((x, y) => (x.minBelanja ?? 0) - (y.minBelanja ?? 0));
  const opsi = opsiDariBarang(b);
  const dipesan = kurangQty(b.stokFisik, b.stokTersedia);
  const atribut = b.ringkasAtribut;

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col gap-3 overflow-y-auto rounded-md border-2 border-blue-300 bg-white p-4 shadow-xl"
      data-testid="panel-detail-barang"
      aria-live="polite"
    >
      <div className="flex gap-4">
        {b.gambar ? (
          <img
            src={b.gambar}
            alt=""
            className="size-36 shrink-0 rounded-md border bg-white object-contain"
          />
        ) : (
          <span
            className="flex size-36 shrink-0 flex-col items-center justify-center gap-1 rounded-md border bg-slate-50 text-xs text-slate-400"
            aria-hidden
          >
            <ImageOff className="size-8" />
            belum ada foto
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xl leading-tight font-bold text-slate-900">{b.namaBarang}</p>
          <p className="font-mono text-xs text-slate-500">
            {b.kode}
            {b.barcode && ` · barcode ${b.barcode}`}
          </p>
          <p className="text-sm text-slate-700">
            {b.namaKategori}
            {b.namaMerk && ` · ${b.namaMerk}`}
          </p>
          {b.kepemilikan === 'KONSINYASI' && (
            <p className="inline-block rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-800">
              Barang titipan {b.namaPemasokKonsinyasi ?? ''}
            </p>
          )}
          <p className="pt-1 text-sm">
            Akan ditambah:{' '}
            <b>
              {formatDesimal(qty)} {o.kodeSatuan}
            </b>
            {o.idSatuanJual !== null && (
              <span className="text-slate-500">
                {' '}
                (isi {formatDesimal(o.faktor)} {b.kodeSatuan})
              </span>
            )}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Tersedia', b.stokTersedia, 'stok yang bisa dijual sekarang'],
          ['Fisik', b.stokFisik, 'ada di toko, termasuk yang dipesan'],
          ['Dipesan', dipesan, 'ditahan order yang belum dibayar'],
          ['Minimum', b.stokMinimum, 'batas stok minimum'],
        ].map(([judul, nilai, ket]) => (
          <div key={judul} className="rounded-md border bg-slate-50 px-2 py-1.5" title={ket}>
            <p className="text-xs text-slate-500">{judul}</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatDesimal(nilai ?? '0')}{' '}
              <span className="text-xs font-normal text-slate-500">{b.kodeSatuan}</span>
            </p>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn('rounded px-2 py-0.5 font-semibold', WARNA_STATUS[b.statusStok])}>
          Stok {LABEL_STATUS_STOK[b.statusStok]}
        </span>
        {b.stokRusak !== '0' && Number(b.stokRusak) > 0 && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
            Rusak {formatDesimal(b.stokRusak)} {b.kodeSatuan} (tidak dijual)
          </span>
        )}
      </div>

      <section>
        <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Harga per satuan
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 font-medium">Satuan</th>
              {tier.map((t) => (
                <th key={t.id} className="py-1 text-right font-medium">
                  {t.nama}
                  {t.minBelanja !== null && !t.isDefault && (
                    <span className="block font-normal">
                      belanja ≥ {formatRupiah(t.minBelanja)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opsi.map((x) => (
              <tr
                key={x.idSatuanJual ?? 0}
                className={cn(
                  'border-t',
                  x.idSatuanJual === o.idSatuanJual && 'bg-blue-50 font-semibold',
                )}
              >
                <td className="py-1">
                  {x.kodeSatuan}
                  {x.idSatuanJual !== null && (
                    <span className="text-xs font-normal text-slate-500">
                      {' '}
                      isi {formatDesimal(x.faktor)} {b.kodeSatuan}
                    </span>
                  )}
                </td>
                {tier.map((t) => {
                  const h = x.hargaTier.find((y) => y.idTingkatHarga === t.id);
                  return (
                    <td key={t.id} className="py-1 text-right tabular-nums">
                      {h && h.hargaJual > 0 ? formatRupiah(h.hargaJual) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {atribut.length > 0 && (
        <section>
          <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Atribut
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
            {atribut.map((a) => (
              <div
                key={a.nama}
                className="flex justify-between gap-2 border-b border-dashed py-0.5"
              >
                <dt className="text-slate-500">{a.nama}</dt>
                <dd className="text-right font-medium">{a.nilai}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <p className="mt-auto text-xs text-slate-500">
        <kbd className="rounded border px-1 font-mono">Enter</kbd> atau klik = tambah ·{' '}
        <kbd className="rounded border px-1 font-mono">↑</kbd>/
        <kbd className="rounded border px-1 font-mono">↓</kbd> = barang lain ·{' '}
        <kbd className="rounded border px-1 font-mono">Esc</kbd> = tutup. Panel ini menutupi antrean
        hanya selama memilih barang.
      </p>
    </div>
  );
}
