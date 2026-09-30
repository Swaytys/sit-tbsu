import { formatRupiah, type BarisBarang, type TingkatHarga } from '@sit/shared';
import { Save, Search, Settings2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useDaftarBarang, useSimpanHarga } from '@/api/barang';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { useDaftarKategori } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { InputRupiah } from '@/components/input-rupiah';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTunda } from '@/lib/use-tunda';
import { DialogTier } from './dialog-tier';

const SEMUA_KATEGORI = 'SEMUA';

type Perubahan = { idBarang: number; idTingkatHarga: number; hargaTetap: number | null };
const kunci = (idBarang: number, idTier: number) => `${idBarang}:${idTier}`;

/** Nilai tetap tersimpan di sel (null = ikut tier). */
function nilaiTersimpan(b: BarisBarang, idTier: number): number | null {
  const h = b.harga.find((x) => x.idTingkatHarga === idTier);
  return h?.metode === 'TETAP' ? h.hargaTetap : null;
}

function SelHarga({
  b,
  t,
  ubah,
  onUbah,
}: {
  b: BarisBarang;
  t: TingkatHarga;
  ubah: Perubahan | undefined;
  onUbah: (hargaTetap: number | null) => void;
}) {
  const h = b.harga.find((x) => x.idTingkatHarga === t.id);
  const nilai = ubah ? ubah.hargaTetap : nilaiTersimpan(b, t.id);
  const kosongDefault = t.isDefault && nilai === null;
  return (
    <div className="flex items-center justify-end gap-1">
      <InputRupiah
        value={nilai}
        onChange={onUbah}
        aria-label={`Harga ${t.nama} ${b.namaBarang}`}
        placeholder={h ? `${formatRupiah(h.hargaJual)} ikut` : 'Ikut tier'}
        className={cn(
          'h-8 w-36 text-sm',
          ubah && 'border-amber-300 bg-amber-50',
          kosongDefault && 'border-red-400',
        )}
      />
    </div>
  );
}

/** Harga Jual (docs/06 H13): tabel barang × tier, ubah sel langsung, simpan massal. */
export function HalamanHargaJual() {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [idKategori, setIdKategori] = useState<number | null>(null);
  const [perluTinjau, setPerluTinjau] = useState(false);
  const [halaman, setHalaman] = useState(1);
  const [perubahan, setPerubahan] = useState<Map<string, Perubahan>>(new Map());
  const [dialogTier, setDialogTier] = useState(false);

  const kategori = useDaftarKategori();
  const tier = useDaftarTingkatHarga();
  const tierAktif = (tier.data ?? []).filter((t) => t.statusAktif === 'AKTIF');
  const daftar = useDaftarBarang({
    cari: cariTertunda,
    idKategori,
    status: 'AKTIF',
    perluTinjau,
    halaman,
    perHalaman: 50,
  });
  const simpan = useSimpanHarga();

  function ubahSel(b: BarisBarang, t: TingkatHarga, hargaTetap: number | null) {
    const baru = new Map(perubahan);
    const k = kunci(b.id, t.id);
    if (hargaTetap === nilaiTersimpan(b, t.id)) baru.delete(k);
    else baru.set(k, { idBarang: b.id, idTingkatHarga: t.id, hargaTetap });
    setPerubahan(baru);
  }

  const idTierDefault = tierAktif.find((t) => t.isDefault)?.id;
  const adaDefaultKosong = [...perubahan.values()].some(
    (p) => p.idTingkatHarga === idTierDefault && p.hargaTetap === null,
  );

  async function simpanSemua() {
    try {
      const hasil = await simpan.mutateAsync({ perubahan: [...perubahan.values()] });
      toast.success(
        `Harga ${hasil.jumlahBarang} barang disimpan (${hasil.jumlahPerubahan} harga berubah).`,
      );
      setPerubahan(new Map());
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  const tampilDasar = daftar.data?.data.some((b) => b.dasarMarkup !== undefined) ?? false;
  const kolom: KolomTabel<BarisBarang>[] = [
    {
      kunci: 'kode',
      judul: 'Kode',
      className: 'w-28',
      sel: (b) => <span className="font-mono text-xs text-slate-600">{b.kode}</span>,
    },
    {
      kunci: 'nama',
      judul: 'Nama barang',
      sel: (b) => (
        <div>
          <Link to={`/barang/${b.id}`} className="font-medium text-slate-900 hover:text-blue-700">
            {b.namaBarang}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <span>
              per {b.kodeSatuan} · {b.namaKategori}
            </span>
            {b.perluTinjauHarga && (
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                Perlu tinjau
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    ...(tampilDasar
      ? [
          {
            kunci: 'dasar',
            judul: 'Dasar markup',
            className: 'text-right tabular-nums text-slate-500',
            sel: (b: BarisBarang) =>
              b.dasarMarkup === undefined ? '—' : formatRupiah(b.dasarMarkup),
          },
        ]
      : []),
    ...tierAktif.map((t) => ({
      kunci: `tier-${t.id}`,
      judul: (
        <span>
          {t.nama}
          {t.markupDefaultPersen && (
            <span className="ml-1 font-normal normal-case text-slate-400">
              (+{formatDesimal(t.markupDefaultPersen)}%)
            </span>
          )}
        </span>
      ),
      className: 'text-right',
      sel: (b: BarisBarang) => (
        <SelHarga
          b={b}
          t={t}
          ubah={perubahan.get(kunci(b.id, t.id))}
          onUbah={(v) => ubahSel(b, t, v)}
        />
      ),
    })),
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Harga Jual</h1>
          <p className="text-sm text-slate-500">
            Isi harga tetap per tier. Kosongkan sel tier non-default agar harganya ikut markup tier.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogTier(true)}>
            <Settings2 /> Kelola tier
          </Button>
          <Button
            variant="outline"
            disabled={perubahan.size === 0}
            onClick={() => setPerubahan(new Map())}
          >
            <Undo2 /> Batalkan
          </Button>
          <Button
            disabled={perubahan.size === 0 || adaDefaultKosong || simpan.isPending}
            onClick={() => void simpanSemua()}
          >
            <Save /> {simpan.isPending ? 'Menyimpan…' : `Simpan perubahan (${perubahan.size})`}
          </Button>
        </div>
      </div>

      {adaDefaultKosong && (
        <p className="text-sm text-red-600">Harga tier default tidak boleh dikosongkan.</p>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-3 border-b p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(1);
              }}
              placeholder="Cari kode, nama, barcode, atau merk…"
              className="pl-8"
              aria-label="Cari barang"
            />
          </div>
          <Select
            value={idKategori === null ? SEMUA_KATEGORI : String(idKategori)}
            onValueChange={(v) => {
              setIdKategori(v === SEMUA_KATEGORI ? null : Number(v));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Saring kategori">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA_KATEGORI}>Semua kategori</SelectItem>
              {(kategori.data ?? []).map((k) => (
                <SelectItem key={k.id} value={String(k.id)}>
                  {k.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            <Switch
              checked={perluTinjau}
              onCheckedChange={(v) => {
                setPerluTinjau(v);
                setHalaman(1);
              }}
            />
            Perlu tinjau harga
          </label>
        </div>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(b) => b.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Tidak ada barang aktif yang cocok."
        />
      </Card>

      {dialogTier && <DialogTier onTutup={() => setDialogTier(false)} />}
    </div>
  );
}
