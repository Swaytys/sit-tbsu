import { formatRupiah, type BarisBarang, type TingkatHarga } from '@sit/shared';
import { Download, Save, Search, Settings2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarBarang, useSimpanHarga } from '@/api/barang';
import { useDaftarKategori } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
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
import {
  gantiMetode,
  isianDari,
  isianSah,
  isianSama,
  keKirim,
  teksMargin,
  type IsianHarga,
} from './isian-harga';
import { IsianSel, PilihMetode } from './sel-harga';

const SEMUA_KATEGORI = 'SEMUA';

type Perubahan = { idBarang: number; idTingkatHarga: number; isi: IsianHarga };
const kunci = (idBarang: number, idTier: number) => `${idBarang}:${idTier}`;

function SelHarga({
  b,
  t,
  ubah,
  onUbah,
}: {
  b: BarisBarang;
  t: TingkatHarga;
  ubah: Perubahan | undefined;
  onUbah: (isi: IsianHarga) => void;
}) {
  const h = b.harga.find((x) => x.idTingkatHarga === t.id);
  const isi = ubah?.isi ?? isianDari(h);
  const label = `Harga ${t.nama} ${b.namaBarang}`;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1">
        {/* Tier default selalu harga tetap (K-047, K-086). */}
        {!t.isDefault && (
          <PilihMetode
            nilai={isi.metode}
            onUbah={(m) => onUbah(gantiMetode(isi, m, h, t))}
            t={t}
            label={`Metode harga ${t.nama} ${b.namaBarang}`}
          />
        )}
        <IsianSel
          isi={isi}
          h={h}
          onUbah={onUbah}
          label={label}
          berubah={ubah !== undefined}
          className="w-32"
        />
      </div>
      {!ubah && h && (
        <span className="text-[11px] text-slate-400 tabular-nums">
          {h.metode === 'MARKUP' && `= ${formatRupiah(h.hargaJual)}`}
          {h.metode === 'MARKUP' && h.margin != null && ' · '}
          {h.margin != null && (
            <span className={cn(h.margin < 0 && 'font-medium text-red-600')}>
              margin {teksMargin(h.margin)}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Tab harga per tier (docs/06 H13): tabel barang × tier, ubah sel langsung, simpan massal. */
export function TabHargaTier({ tierAktif }: { tierAktif: TingkatHarga[] }) {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [idKategori, setIdKategori] = useState<number | null>(null);
  const [perluTinjau, setPerluTinjau] = useState(false);
  const [halaman, setHalaman] = useState(1);
  const [perubahan, setPerubahan] = useState<Map<string, Perubahan>>(new Map());
  const [dialogTier, setDialogTier] = useState(false);

  const kategori = useDaftarKategori();
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarBarang({
    cari: cariTertunda,
    idKategori,
    status: 'AKTIF',
    perluTinjau,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const simpan = useSimpanHarga();

  function ubahSel(b: BarisBarang, t: TingkatHarga, isi: IsianHarga) {
    const baru = new Map(perubahan);
    const k = kunci(b.id, t.id);
    const tersimpan = isianDari(b.harga.find((x) => x.idTingkatHarga === t.id));
    if (isianSama(isi, tersimpan)) baru.delete(k);
    else baru.set(k, { idBarang: b.id, idTingkatHarga: t.id, isi });
    setPerubahan(baru);
  }

  const adaTidakSah = [...perubahan.values()].some((p) => !isianSah(p.isi));

  async function simpanSemua() {
    try {
      const hasil = await simpan.mutateAsync({
        perubahan: [...perubahan.values()].map((p) => ({
          idBarang: p.idBarang,
          idTingkatHarga: p.idTingkatHarga,
          ...keKirim(p.isi),
        })),
      });
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
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>
              per {b.kodeSatuan} · {b.namaKategori}
            </span>
            {b.hargaOtomatis && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                Otomatis
              </Badge>
            )}
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
          onUbah={(isi) => ubahSel(b, t, isi)}
        />
      ),
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-500">
          Pilih cara tiap harga: <b>Rp</b> harga tetap, <b>Tier</b> ikut markup tier, atau <b>%</b>{' '}
          markup sendiri. Harga markup dihitung dari dasar harga modal dan dibulatkan ke atas.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild>
            <a
              href={`/api/harga-barang/ekspor?${new URLSearchParams({
                ...(cariTertunda ? { cari: cariTertunda } : {}),
                ...(idKategori === null ? {} : { idKategori: String(idKategori) }),
              }).toString()}`}
              download
            >
              <Download /> Ekspor Excel
            </a>
          </Button>
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
            disabled={perubahan.size === 0 || adaTidakSah || simpan.isPending}
            onClick={() => void simpanSemua()}
          >
            <Save /> {simpan.isPending ? 'Menyimpan…' : `Simpan perubahan (${perubahan.size})`}
          </Button>
        </div>
      </div>

      {adaTidakSah && (
        <p className="text-sm text-red-600">
          Lengkapi sel bertanda merah: harga tetap wajib diisi, markup berupa persen 0–999 (maks. 2
          desimal).
        </p>
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
