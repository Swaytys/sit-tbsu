import {
  formatRupiah,
  type BarisTinjauHarga,
  type TierTinjauHarga,
  type TingkatHarga,
} from '@sit/shared';
import { Check, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useAbaikanTinjau, useTerapkanTinjau, useTinjauHarga } from '@/api/barang';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarKategori } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { teksMargin } from './isian-harga';

const SEMUA_KATEGORI = 'SEMUA';

function keteranganMetode(t: TierTinjauHarga): string {
  const persen = t.markupPersen ? `+${formatDesimal(t.markupPersen)}%` : '';
  if (t.metode === 'IKUT_TIER') return `ikut tier ${persen}`;
  if (t.metode === 'MARKUP') return `markup ${persen}`;
  return t.hargaUsulan === null ? 'tetap' : `tetap, usulan ${persen}`;
}

/** Satu tier: harga sekarang → usulan, dan margin terhadap dasar baru (semua angka dari API). */
function SelTinjau({ t, redup }: { t: TierTinjauHarga | undefined; redup: boolean }) {
  if (!t) return <span className="text-slate-300">—</span>;
  const usulan = t.hargaUsulan;
  const berubah = usulan !== null && usulan !== t.hargaSekarang;
  return (
    <div className={cn('text-right tabular-nums', redup && 'opacity-40')}>
      <div className="text-sm whitespace-nowrap">
        <span className={cn(berubah && 'text-slate-400 line-through decoration-slate-300')}>
          {formatRupiah(t.hargaSekarang)}
        </span>
        {berubah && (
          <>
            <span className="mx-1 text-slate-400">→</span>
            <span
              className={cn(
                'font-medium',
                usulan > t.hargaSekarang ? 'text-emerald-700' : 'text-red-600',
              )}
            >
              {formatRupiah(usulan)}
            </span>
          </>
        )}
      </div>
      <div className="text-[11px] whitespace-nowrap text-slate-400">{keteranganMetode(t)}</div>
      {t.marginSekarang !== null && (
        <div className="text-[11px] whitespace-nowrap text-slate-400">
          margin{' '}
          <span className={cn(t.marginSekarang < 0 && 'font-medium text-red-600')}>
            {teksMargin(t.marginSekarang)}
          </span>
          {berubah && t.marginUsulan !== null && ` → ${teksMargin(t.marginUsulan)}`}
        </div>
      )}
    </div>
  );
}

/**
 * Tinjau Harga (docs/06 H6, K-086): barang yang dasar harga modal atau markup tiernya berubah. Terapkan =
 * harga diganti usulan (harga Normal hanya bila dipilih); Abaikan = harga tidak diubah, tanda dilepas.
 */
export function TabTinjauHarga({ tierAktif }: { tierAktif: TingkatHarga[] }) {
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [idKategori, setIdKategori] = useState<number | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [terpilih, setTerpilih] = useState<ReadonlySet<number>>(new Set());
  const [termasukDefault, setTermasukDefault] = useState(true);

  const kategori = useDaftarKategori();
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useTinjauHarga({
    cari: cariTertunda,
    idKategori,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const terapkan = useTerapkanTinjau();
  const abaikan = useAbaikanTinjau();
  const sibuk = terapkan.isPending || abaikan.isPending;

  const data = daftar.data?.data ?? [];
  const pilihan = data.filter((b) => terpilih.has(b.id));
  const semuaTerpilih = data.length > 0 && pilihan.length === data.length;
  const tierDefault = tierAktif.find((t) => t.isDefault);

  function pilih(id: number, ya: boolean) {
    const baru = new Set(terpilih);
    if (ya) baru.add(id);
    else baru.delete(id);
    setTerpilih(baru);
  }

  async function jalankanTerapkan(baris: BarisTinjauHarga[]) {
    try {
      const hasil = await terapkan.mutateAsync({
        barang: baris.map((b) => ({ idBarang: b.id, dasar: b.dasarBaru })),
        termasukTierDefault: termasukDefault,
      });
      toast.success(
        `Usulan harga ${hasil.jumlahBarang} barang diterapkan (${hasil.jumlahPerubahan} harga berubah).`,
      );
      setTerpilih(new Set());
    } catch (err) {
      toast.error(pesanGalat(err));
      void daftar.refetch();
    }
  }

  async function jalankanAbaikan(baris: BarisTinjauHarga[]) {
    try {
      const hasil = await abaikan.mutateAsync({ idBarang: baris.map((b) => b.id) });
      toast.success(`${hasil.jumlahBarang} barang diabaikan; harganya tidak diubah.`);
      setTerpilih(new Set());
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  const kolom: KolomTabel<BarisTinjauHarga>[] = [
    {
      kunci: 'pilih',
      judul: (
        <Checkbox
          checked={semuaTerpilih}
          onCheckedChange={(v) =>
            setTerpilih(v === true ? new Set(data.map((b) => b.id)) : new Set())
          }
          aria-label="Pilih semua barang di halaman ini"
        />
      ),
      className: 'w-8',
      sel: (b) => (
        <Checkbox
          checked={terpilih.has(b.id)}
          onCheckedChange={(v) => pilih(b.id, v === true)}
          aria-label={`Pilih ${b.namaBarang}`}
        />
      ),
    },
    {
      kunci: 'barang',
      judul: 'Barang',
      sel: (b) => (
        <div>
          <Link to={`/barang/${b.id}`} className="font-medium text-slate-900 hover:text-blue-700">
            {b.namaBarang}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span className="font-mono">{b.kode}</span>
            <span>
              per {b.kodeSatuan} · {b.namaKategori}
            </span>
            {b.hargaOtomatis && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                Otomatis
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      kunci: 'dasar',
      judul: 'Dasar markup',
      className: 'text-right',
      sel: (b) => {
        const lama = b.tier.find((t) => t.dasarLama !== null)?.dasarLama ?? null;
        return (
          <div className="text-right text-sm whitespace-nowrap tabular-nums">
            {lama !== null && lama !== b.dasarBaru && (
              <>
                <span className="text-slate-400">{formatRupiah(lama)}</span>
                <span className="mx-1 text-slate-400">→</span>
              </>
            )}
            <span className="font-medium">{formatRupiah(b.dasarBaru)}</span>
          </div>
        );
      },
    },
    ...tierAktif.map((t) => ({
      kunci: `tier-${t.id}`,
      judul: t.nama,
      className: 'text-right',
      sel: (b: BarisTinjauHarga) => (
        <SelTinjau
          t={b.tier.find((x) => x.idTingkatHarga === t.id)}
          redup={t.isDefault && !termasukDefault}
        />
      ),
    })),
    {
      kunci: 'aksi',
      judul: '',
      className: 'w-44 text-right',
      sel: (b) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" disabled={sibuk} onClick={() => void jalankanTerapkan([b])}>
            <Check /> Terapkan
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={sibuk}
            onClick={() => void jalankanAbaikan([b])}
          >
            <X /> Abaikan
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-500">
          Barang muncul di sini bila dasar harga modal atau markup tier berubah. <b>Terapkan</b>{' '}
          mengganti harga dengan usulan; <b>Abaikan</b> membiarkan harga dan melepas tanda.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            disabled={pilihan.length === 0 || sibuk}
            onClick={() => void jalankanAbaikan(pilihan)}
          >
            <X /> Abaikan terpilih ({pilihan.length})
          </Button>
          <Button
            disabled={pilihan.length === 0 || sibuk}
            onClick={() => void jalankanTerapkan(pilihan)}
          >
            <Check /> Terapkan terpilih ({pilihan.length})
          </Button>
        </div>
      </div>

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
              placeholder="Cari kode, nama, atau barcode…"
              className="pl-8"
              aria-label="Cari barang ditinjau"
            />
          </div>
          <Select
            value={idKategori === null ? SEMUA_KATEGORI : String(idKategori)}
            onValueChange={(v) => {
              setIdKategori(v === SEMUA_KATEGORI ? null : Number(v));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Saring kategori ditinjau">
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
          {tierDefault && (
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
              <Switch checked={termasukDefault} onCheckedChange={setTermasukDefault} />
              Ganti juga harga {tierDefault.nama} dengan usulan
            </label>
          )}
        </div>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={(h) => {
            setHalaman(h);
            setTerpilih(new Set());
          }}
          kunciBaris={(b) => b.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Tidak ada barang yang perlu ditinjau harganya."
        />
      </Card>
    </div>
  );
}
