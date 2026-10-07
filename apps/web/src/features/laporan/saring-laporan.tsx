import {
  BATAS_PRODUK_TERLARIS,
  formatRupiah,
  LABEL_JENIS_PENJUALAN,
  type JenisLaporan,
} from '@sit/shared';
import { Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useCariInvoiceLaporan } from '@/api/laporan';
import { useDaftarPemasok } from '@/api/mitra';
import { useDaftarKategori } from '@/api/referensi';
import { PilihBarang } from '@/components/pilih-barang';
import { PilihPelanggan } from '@/components/pilih-pelanggan';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatTanggal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';
import { BERPERIODE } from './param';
import { PRESET_PERIODE, presetDari, rentangPreset } from './periode';

type Ubah = (perubahan: Record<string, string | null>) => void;

const KELAS_PILIH =
  'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

function Bidang({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-semibold tracking-wide text-slate-600 uppercase"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function Periode({ p, ubah }: { p: Record<string, string>; ubah: Ubah }) {
  const dari = p.dari ?? '';
  const sampai = p.sampai ?? '';
  const aktif = presetDari(dari, sampai);
  return (
    <>
      <Bidang label="Periode">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Pilihan periode">
          {PRESET_PERIODE.filter((x) => x.kode !== 'rentang').map((x) => (
            <button
              key={x.kode}
              type="button"
              aria-pressed={aktif === x.kode}
              onClick={() => ubah(rentangPreset(x.kode))}
              className={cn(
                'h-9 rounded-md border px-2.5 text-sm',
                aktif === x.kode
                  ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </Bidang>
      <Bidang label="Dari tanggal" htmlFor="laporan-dari">
        <Input
          id="laporan-dari"
          type="date"
          className="w-40"
          value={dari}
          onChange={(e) => ubah({ dari: e.target.value })}
        />
      </Bidang>
      <Bidang label="Sampai tanggal" htmlFor="laporan-sampai">
        <Input
          id="laporan-sampai"
          type="date"
          className="w-40"
          value={sampai}
          onChange={(e) => ubah({ sampai: e.target.value })}
        />
      </Bidang>
    </>
  );
}

function Kategori({ p, ubah }: { p: Record<string, string>; ubah: Ubah }) {
  const kategori = useDaftarKategori('AKTIF').data ?? [];
  return (
    <Bidang label="Kategori" htmlFor="laporan-kategori">
      <select
        id="laporan-kategori"
        className={KELAS_PILIH}
        value={p.idKategori ?? ''}
        onChange={(e) => ubah({ idKategori: e.target.value || null })}
      >
        <option value="">Semua kategori</option>
        {kategori.map((k) => (
          <option key={k.id} value={k.id}>
            {k.nama}
          </option>
        ))}
      </select>
    </Bidang>
  );
}

function Pilihan({
  label,
  id,
  nilai,
  opsi,
  onUbah,
}: {
  label: string;
  id: string;
  nilai: string;
  opsi: { nilai: string; label: string }[];
  onUbah: (v: string) => void;
}) {
  return (
    <Bidang label={label} htmlFor={id}>
      <select
        id={id}
        className={KELAS_PILIH}
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
      >
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </Bidang>
  );
}

function Pemasok({ p, ubah }: { p: Record<string, string>; ubah: Ubah }) {
  const pemasok =
    useDaftarPemasok({ cari: '', status: 'SEMUA', halaman: 1, perHalaman: 100 }).data?.data ?? [];
  return (
    <Bidang label="Pemasok" htmlFor="laporan-pemasok">
      <select
        id="laporan-pemasok"
        className={KELAS_PILIH}
        value={p.idPemasok ?? ''}
        onChange={(e) => ubah({ idPemasok: e.target.value || null })}
      >
        <option value="">Semua pemasok</option>
        {pemasok.map((x) => (
          <option key={x.id} value={x.id}>
            {x.namaPemasok}
          </option>
        ))}
      </select>
    </Bidang>
  );
}

/** Pilih satu barang (atau semua) untuk saringan laporan; label disimpan di URL agar tetap terbaca. */
function SaringBarang({
  p,
  ubah,
  label,
  wajib,
}: {
  p: Record<string, string>;
  ubah: Ubah;
  label: string;
  wajib?: boolean;
}) {
  return (
    <div className="w-80">
      <Bidang label="Barang">
        {p.idBarang ? (
          <div className="flex h-9 items-center justify-between rounded-md border border-slate-300 bg-white px-2 text-sm">
            <span className="truncate font-medium">{p._barang ?? `Barang #${p.idBarang}`}</span>
            <button
              type="button"
              className="text-xs text-blue-700 hover:underline"
              onClick={() => ubah({ idBarang: null, _barang: null })}
            >
              {wajib ? 'Ganti' : 'Semua barang'}
            </button>
          </div>
        ) : (
          <PilihBarang
            label={label}
            placeholder={wajib ? undefined : 'Semua barang (ketik untuk memilih satu)'}
            onPilih={(b) =>
              ubah({ idBarang: String(b.id), _barang: `${b.kode} · ${b.namaBarang}` })
            }
          />
        )}
      </Bidang>
    </div>
  );
}

/** Daftar transaksi untuk Laporan Detail Invoice: cari nomor/pembeli, pilih satu. */
function CariInvoice({ p, ubah }: { p: Record<string, string>; ubah: Ubah }) {
  const [cari, setCari] = useState('');
  const tunda = useTunda(cari, 300);
  const hasil = useCariInvoiceLaporan({ cari: tunda });
  return (
    <div className="w-full space-y-2">
      <Bidang label="Nomor transaksi / pembeli" htmlFor="laporan-cari-invoice">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            id="laporan-cari-invoice"
            className="pl-8"
            value={cari}
            placeholder="STR-… / INV-… / nama pelanggan"
            onChange={(e) => setCari(e.target.value)}
          />
        </div>
      </Bidang>
      <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
        {(hasil.data ?? []).map((k) => (
          <li key={k.id}>
            <button
              type="button"
              onClick={() => ubah({ id: String(k.id) })}
              className={cn(
                'rounded-md border px-2 py-1 text-left text-xs',
                p.id === String(k.id)
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white hover:border-blue-300',
              )}
            >
              <span className="font-mono font-semibold">{k.nomor}</span> ·{' '}
              {formatTanggal(k.tanggalOperasional)} · {k.namaPembeli ?? 'Pembeli umum'} ·{' '}
              {formatRupiah(k.totalNeto)}
            </button>
          </li>
        ))}
        {hasil.data?.length === 0 && <li className="text-sm text-slate-500">Tidak ditemukan.</li>}
      </ul>
    </div>
  );
}

/** Saringan sesuai jenis laporan; nilai disimpan di URL agar laporan bisa dibuka ulang/dibagikan. */
export function SaringLaporan({
  kode,
  p,
  ubah,
}: {
  kode: JenisLaporan;
  p: Record<string, string>;
  ubah: Ubah;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {BERPERIODE.has(kode) && <Periode p={p} ubah={ubah} />}
      {kode === 'nilai-persediaan' && (
        <Bidang label="Per tanggal" htmlFor="laporan-tanggal">
          <Input
            id="laporan-tanggal"
            type="date"
            className="w-40"
            value={p.tanggal ?? ''}
            onChange={(e) => ubah({ tanggal: e.target.value })}
          />
        </Bidang>
      )}
      {(kode === 'stok-rekap' ||
        kode === 'stok-minimum' ||
        kode === 'nilai-persediaan' ||
        kode === 'produk-terlaris' ||
        kode === 'riwayat-harga-beli') && <Kategori p={p} ubah={ubah} />}
      {kode === 'riwayat-harga-beli' && (
        <>
          <Pemasok p={p} ubah={ubah} />
          <SaringBarang p={p} ubah={ubah} label="Barang riwayat harga beli" />
        </>
      )}
      {kode === 'stok-rekap' && (
        <>
          <Pilihan
            label="Kepemilikan"
            id="laporan-kepemilikan"
            nilai={p.kepemilikan ?? ''}
            opsi={[
              { nilai: '', label: 'Semua' },
              { nilai: 'MILIK_SENDIRI', label: 'Milik sendiri' },
              { nilai: 'KONSINYASI', label: 'Titipan (konsinyasi)' },
            ]}
            onUbah={(v) => ubah({ kepemilikan: v || null })}
          />
          <Pilihan
            label="Barang"
            id="laporan-cakupan"
            nilai={p.cakupan ?? 'SEMUA'}
            opsi={[
              { nilai: 'SEMUA', label: 'Semua barang aktif' },
              { nilai: 'BERMUTASI', label: 'Hanya yang bermutasi' },
            ]}
            onUbah={(v) => ubah({ cakupan: v })}
          />
        </>
      )}
      {kode === 'kartu-stok' && <SaringBarang p={p} ubah={ubah} label="Barang kartu stok" wajib />}
      {kode === 'penjualan' && (
        <Pilihan
          label="Jenis penjualan"
          id="laporan-jenis"
          nilai={p.jenis ?? ''}
          opsi={[
            { nilai: '', label: 'Semua' },
            { nilai: 'LANGSUNG', label: LABEL_JENIS_PENJUALAN.LANGSUNG },
            { nilai: 'PENGANTARAN', label: LABEL_JENIS_PENJUALAN.PENGANTARAN },
          ]}
          onUbah={(v) => ubah({ jenis: v || null })}
        />
      )}
      {kode === 'produk-terlaris' && (
        <Pilihan
          label="Tampilkan"
          id="laporan-batas"
          nilai={p.batas ?? '10'}
          opsi={BATAS_PRODUK_TERLARIS.map((b) => ({
            nilai: String(b),
            label: b === 0 ? 'Semua barang' : `${b} teratas`,
          }))}
          onUbah={(v) => ubah({ batas: v })}
        />
      )}
      {kode === 'laba-kotor' && (
        <Pilihan
          label="Rincian"
          id="laporan-tampilan"
          nilai={p.tampilan ?? 'BARANG'}
          opsi={[
            { nilai: 'BARANG', label: 'Per barang' },
            { nilai: 'TRANSAKSI', label: 'Per transaksi' },
            { nilai: 'BARIS', label: 'Per baris (rancangan KP)' },
          ]}
          onUbah={(v) => ubah({ tampilan: v })}
        />
      )}
      {kode === 'piutang' && (
        <>
          <div className="w-72">
            <Bidang label="Pelanggan">
              <PilihPelanggan
                terpilih={
                  p.idPelanggan ? { id: Number(p.idPelanggan), nama: p._pelanggan ?? '' } : null
                }
                onPilih={(x) =>
                  ubah({
                    idPelanggan: x ? String(x.id) : null,
                    _pelanggan: x ? x.namaPelanggan : null,
                  })
                }
              />
            </Bidang>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.terlambat === 'true'}
              onChange={(e) => ubah({ terlambat: e.target.checked ? 'true' : null })}
            />
            Hanya yang lewat jatuh tempo
          </label>
        </>
      )}
      {kode === 'hutang' && (
        <>
          <Pemasok p={p} ubah={ubah} />
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.terlambat === 'true'}
              onChange={(e) => ubah({ terlambat: e.target.checked ? 'true' : null })}
            />
            Hanya yang lewat jatuh tempo
          </label>
        </>
      )}
      {kode === 'detail-invoice' && <CariInvoice p={p} ubah={ubah} />}
    </div>
  );
}
