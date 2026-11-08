import { DAFTAR_IZIN, IZIN_KHUSUS_OWNER, SEMUA_IZIN, type Izin } from '@sit/shared';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { selisihIzin } from './selisih-izin';

/*
 * K-243: daftar centang izin. Yang dicentang = izin akhir akun/peran. Tanda "ditambah"/"dicabut" dibanding izin
 * bawaan peran supaya Owner tahu persis apa yang berbeda dari peran standar. Izin khusus Owner tampil tetapi
 * tidak bisa dicentang.
 */

const KELOMPOK: { judul: string; awalan: string[] }[] = [
  { judul: 'Penjualan', awalan: ['penjualan'] },
  { judul: 'Retur dan void', awalan: ['retur', 'void'] },
  { judul: 'Kas', awalan: ['kas'] },
  { judul: 'Persediaan', awalan: ['persediaan'] },
  { judul: 'Pembelian, hutang, konsinyasi', awalan: ['pembelian', 'hutang', 'konsinyasi'] },
  { judul: 'Data master', awalan: ['master'] },
  { judul: 'Laporan dan dashboard', awalan: ['laporan', 'dashboard'] },
  { judul: 'Promo', awalan: ['promo'] },
  { judul: 'Sistem', awalan: ['sistem'] },
];

const KHUSUS_OWNER = new Set<string>(IZIN_KHUSUS_OWNER);

export function PilihIzin({
  dasar,
  terpilih,
  onUbah,
  labelDasar,
}: {
  dasar: ReadonlySet<Izin>;
  terpilih: ReadonlySet<Izin>;
  onUbah: (baru: Set<Izin>) => void;
  /** Nama bawaan pembanding, mis. "Kasir" atau "Kasir + peran khusus Kasir Antar". */
  labelDasar: string;
}) {
  const idDasar = useId();
  const [cari, setCari] = useState('');
  const [hanyaBerubah, setHanyaBerubah] = useState(false);
  const { tambah, cabut } = selisihIzin(dasar, terpilih);
  const kata = cari.trim().toLowerCase();

  const ubah = (i: Izin, centang: boolean) => {
    const baru = new Set(terpilih);
    if (centang) baru.add(i);
    else baru.delete(i);
    onUbah(baru);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari izin…"
            className="h-8 pl-8"
            aria-label="Cari izin"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-slate-600">
          <Checkbox
            checked={hanyaBerubah}
            onCheckedChange={(v) => setHanyaBerubah(v === true)}
            aria-label="Hanya yang berbeda dari bawaan"
          />
          Hanya yang berbeda
        </label>
      </div>
      <p id={idDasar} className="text-xs text-slate-500">
        Pembanding: bawaan <b>{labelDasar}</b> ({dasar.size} izin). Akhir {terpilih.size} izin ·{' '}
        <span className="text-emerald-700">ditambah {tambah.length}</span> ·{' '}
        <span className="text-red-700">dicabut {cabut.length}</span>
      </p>
      <div
        className="max-h-[50vh] overflow-y-auto rounded-md border p-2"
        aria-describedby={idDasar}
      >
        <div className="gap-x-4 md:columns-2">
          {KELOMPOK.map((k) => {
            const isi = SEMUA_IZIN.filter((i) => k.awalan.includes(i.split('.')[0] ?? ''))
              .filter(
                (i) => !kata || i.includes(kata) || DAFTAR_IZIN[i].toLowerCase().includes(kata),
              )
              .filter((i) => !hanyaBerubah || dasar.has(i) !== terpilih.has(i));
            if (isi.length === 0) return null;
            return (
              <fieldset key={k.judul} className="mb-3 min-w-0 break-inside-avoid">
                <legend className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {k.judul}
                </legend>
                <ul className="space-y-0.5">
                  {isi.map((i) => {
                    const khusus = KHUSUS_OWNER.has(i);
                    const punya = terpilih.has(i);
                    const asal = dasar.has(i);
                    return (
                      <li key={i}>
                        <label
                          className={cn(
                            'flex items-start gap-2 rounded px-1.5 py-1 text-sm',
                            khusus
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:bg-slate-50',
                            punya && !asal && 'bg-emerald-50',
                            !punya && asal && 'bg-red-50',
                          )}
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={punya}
                            disabled={khusus}
                            onCheckedChange={(v) => ubah(i, v === true)}
                            data-izin={i}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block leading-snug text-slate-800',
                                !punya && asal && 'line-through',
                              )}
                            >
                              {DAFTAR_IZIN[i]}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">{i}</span>
                            {khusus && (
                              <span className="ml-1.5 text-[11px] text-purple-700">
                                khusus Owner
                              </span>
                            )}
                            {punya && !asal && (
                              <span className="ml-1.5 text-[11px] font-medium text-emerald-700">
                                ditambah
                              </span>
                            )}
                            {!punya && asal && (
                              <span className="ml-1.5 text-[11px] font-medium text-red-700">
                                dicabut
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
      </div>
    </div>
  );
}
