import type { SasaranPromo } from '@sit/shared';
import { X } from 'lucide-react';
import { useDaftarKategori, useDaftarMerk } from '@/api/referensi';
import { PilihBarang } from '@/components/pilih-barang';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { dariIsianWaktu, keIsianWaktu, NAMA_HARI } from './waktu-kampanye';

/*
 * K-163: isian kampanye promo (waktu sampai menit, hari & jam berlaku, sasaran banyak). Nilai waktu disimpan
 * di form sebagai ISO berzona toko (`…+07:00`), sesuai skema API.
 */

/** Waktu mulai/selesai sampai menit (WIB). */
export function IsianWaktu({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="datetime-local"
      aria-label={label}
      disabled={disabled}
      value={keIsianWaktu(value)}
      onChange={(e) => e.target.value && onChange(dariIsianWaktu(e.target.value))}
    />
  );
}

/** Tombol hari (Sen…Min); kosong = setiap hari. */
export function PilihHari({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (v: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Hari berlaku">
      {NAMA_HARI.map((n, i) => {
        const hari = i + 1;
        const aktif = value.includes(hari);
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={aktif}
            onClick={() =>
              onChange(aktif ? value.filter((h) => h !== hari) : [...value, hari].sort())
            }
            className={cn(
              'h-8 w-11 rounded-md border text-sm font-medium disabled:opacity-60',
              aktif
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {n}
          </button>
        );
      })}
      <span className="self-center pl-1 text-xs text-slate-500">
        {value.length === 0 ? 'setiap hari' : `${value.length} hari`}
      </span>
    </div>
  );
}

export type ItemSasaran = { id: number; nama: string };

const kelasPilih =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

/** Sasaran banyak: daftar terpilih (bisa dihapus satu-satu) + penambah sesuai jenis. */
export function PilihSasaranBanyak({
  sasaran,
  value,
  onChange,
  disabled,
}: {
  sasaran: Exclude<SasaranPromo, 'SEMUA'>;
  value: ItemSasaran[];
  onChange: (v: ItemSasaran[]) => void;
  disabled?: boolean;
}) {
  const kategori = useDaftarKategori('AKTIF');
  const merk = useDaftarMerk('AKTIF');
  const tambah = (x: ItemSasaran) => {
    if (!value.some((v) => v.id === x.id)) onChange([...value, x]);
  };
  const daftar = sasaran === 'KATEGORI' ? (kategori.data ?? []) : (merk.data ?? []);
  const apa = sasaran === 'BARANG' ? 'barang' : sasaran === 'KATEGORI' ? 'kategori' : 'merk';
  return (
    <div className="space-y-2">
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
        {value.length === 0 && (
          <span className="text-sm text-slate-400">Belum ada {apa} dipilih.</span>
        )}
        {value.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-sm text-blue-800"
          >
            {v.nama}
            {!disabled && (
              <button
                type="button"
                aria-label={`Hapus ${v.nama}`}
                onClick={() => onChange(value.filter((x) => x.id !== v.id))}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled &&
        (sasaran === 'BARANG' ? (
          <PilihBarang
            label="Tambah barang promo"
            onPilih={(b) => tambah({ id: b.id, nama: `${b.kode} · ${b.namaBarang}` })}
          />
        ) : (
          <select
            className={kelasPilih}
            aria-label={`Tambah ${apa} promo`}
            value=""
            onChange={(e) => {
              const id = Number(e.target.value);
              const x = daftar.find((d) => d.id === id);
              if (x) tambah({ id: x.id, nama: x.nama });
            }}
          >
            <option value="">+ Tambah {apa}…</option>
            {daftar
              .filter((d) => !value.some((v) => v.id === d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
          </select>
        ))}
    </div>
  );
}
