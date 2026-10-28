import type { KelompokSasaran, SasaranPromo } from '@sit/shared';
import { Plus, X } from 'lucide-react';
import { Fragment } from 'react';
import { useDaftarKategori, useDaftarMerk } from '@/api/referensi';
import { PilihBarang } from '@/components/pilih-barang';
import { Button } from '@/components/ui/button';
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
  sasaran: Exclude<SasaranPromo, 'SEMUA' | 'KELOMPOK'>;
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

/** K-185: satu kelompok di form beserta nama barangnya (kategori/merk diambil dari daftar referensi). */
export type IsianKelompok = KelompokSasaran & { namaBarang: string | null };

/**
 * K-185: kelompok sasaran. Tiap kelompok = kategori DAN merk DAN barang (yang diisi saja); barang cocok bila
 * memenuhi salah satu kelompok. Pilihan barang di kelompok disaring menurut kategori/merk kelompok itu.
 */
export function PilihKelompok({
  value,
  onChange,
  disabled,
}: {
  value: IsianKelompok[];
  onChange: (v: IsianKelompok[]) => void;
  disabled?: boolean;
}) {
  const kategori = useDaftarKategori('AKTIF').data ?? [];
  const merk = useDaftarMerk('AKTIF').data ?? [];
  const ganti = (i: number, k: Partial<IsianKelompok>) =>
    onChange(value.map((x, j) => (j === i ? { ...x, ...k } : x)));
  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-sm text-slate-400">Belum ada kelompok. Klik Tambah kelompok.</p>
      )}
      {value.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <p className="pl-1 text-xs font-semibold text-slate-500" aria-hidden>
              ATAU
            </p>
          )}
          <div
            className="grid grid-cols-[auto_1fr_auto_1fr_auto_1.6fr_auto] items-center gap-1.5 rounded-md border bg-slate-50 p-2 text-sm"
            role="group"
            aria-label={`Kelompok ${i + 1}`}
          >
            <span className="font-semibold text-slate-600">{i + 1}.</span>
            <select
              className={kelasPilih}
              aria-label={`Kategori kelompok ${i + 1}`}
              disabled={disabled}
              value={k.idKategori ?? ''}
              onChange={(e) =>
                ganti(i, {
                  idKategori: e.target.value ? Number(e.target.value) : null,
                  idBarang: null,
                  namaBarang: null,
                })
              }
            >
              <option value="">Semua kategori</option>
              {kategori.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nama}
                </option>
              ))}
            </select>
            <span className="text-xs font-semibold text-slate-500">DAN</span>
            <select
              className={kelasPilih}
              aria-label={`Merk kelompok ${i + 1}`}
              disabled={disabled}
              value={k.idMerk ?? ''}
              onChange={(e) =>
                ganti(i, {
                  idMerk: e.target.value ? Number(e.target.value) : null,
                  idBarang: null,
                  namaBarang: null,
                })
              }
            >
              <option value="">Semua merk</option>
              {merk.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nama}
                </option>
              ))}
            </select>
            <span className="text-xs font-semibold text-slate-500">DAN</span>
            {k.idBarang !== null ? (
              <span className="inline-flex min-w-0 items-center gap-1 rounded bg-blue-50 px-2 py-1 text-blue-800">
                <span className="truncate">{k.namaBarang ?? `#${k.idBarang}`}</span>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Hapus barang kelompok ${i + 1}`}
                    onClick={() => ganti(i, { idBarang: null, namaBarang: null })}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ) : disabled ? (
              <span className="text-slate-500">Semua barang</span>
            ) : (
              <PilihBarang
                label={`Barang kelompok ${i + 1}`}
                placeholder="Semua barang (atau cari satu)"
                saring={(b) =>
                  (k.idKategori === null || b.idKategori === k.idKategori) &&
                  (k.idMerk === null || b.idMerk === k.idMerk)
                }
                onPilih={(b) =>
                  ganti(i, { idBarang: b.id, namaBarang: `${b.kode} · ${b.namaBarang}` })
                }
              />
            )}
            {!disabled ? (
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                aria-label={`Hapus kelompok ${i + 1}`}
                title="Hapus kelompok"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" />
              </button>
            ) : (
              <span />
            )}
          </div>
        </Fragment>
      ))}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...value,
              { idKategori: null, idMerk: null, idBarang: null, namaBarang: null },
            ])
          }
        >
          <Plus /> Tambah kelompok
        </Button>
      )}
    </div>
  );
}
