import { formatRupiah, type BarisBarang, type StatusAktif } from '@sit/shared';
import { Columns3, Download, FileSpreadsheet, ImageOff, Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePengguna } from '@/api/auth';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarBarang, useStatusBarang } from '@/api/barang';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { useDaftarKategori, useDaftarMerk } from '@/api/referensi';
import { BilahSaring, type SaringStatus } from '@/components/bilah-saring';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { MenuAksiMaster } from '@/components/menu-aksi-master';
import { BadgeStatusAktif, BadgeStatusStok } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { jalankanDenganToast } from '@/lib/aksi';
import { formatDesimal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { useKolomTampil } from './kolom-tampil';

const SEMUA_KATEGORI = 'SEMUA';

function GambarKecil({ b }: { b: BarisBarang }) {
  return b.gambar ? (
    <img src={b.gambar} alt="" className="size-9 rounded border object-cover" loading="lazy" />
  ) : (
    <div className="flex size-9 items-center justify-center rounded border bg-slate-50 text-slate-300">
      <ImageOff className="size-4" />
    </div>
  );
}

export function HalamanBarang() {
  const navigasi = useNavigate();
  const bolehImport = usePengguna().izin.includes('master.import.jalankan');
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useState<SaringStatus>('SEMUA');
  const [idKategori, setIdKategori] = useState<number | null>(null);
  const [idMerk, setIdMerk] = useState<number | null>(null);
  const [perluTinjau, setPerluTinjau] = useState(false);
  const [halaman, setHalaman] = useState(1);

  const kategori = useDaftarKategori();
  const merk = useDaftarMerk();
  const tier = useDaftarTingkatHarga();
  const tierAktif = (tier.data ?? []).filter((t) => t.statusAktif === 'AKTIF');
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarBarang({
    cari: cariTertunda,
    idKategori,
    idMerk,
    status,
    perluTinjau,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const ubahStatus = useStatusBarang();

  type KolomBarang = KolomTabel<BarisBarang> & { label: string; wajib?: boolean };
  const kolomTier: KolomBarang[] = tierAktif.map((t) => ({
    kunci: `tier-${t.id}`,
    label: `Harga ${t.nama}`,
    judul: `Harga ${t.nama}`,
    className: 'text-right tabular-nums',
    sel: (b) => {
      const h = b.harga.find((x) => x.idTingkatHarga === t.id);
      if (!h) return <span className="text-slate-300">—</span>;
      return (
        <span className={h.metode === 'IKUT_TIER' ? 'text-slate-500' : 'text-slate-800'}>
          {formatRupiah(h.hargaJual)}
        </span>
      );
    },
  }));

  const semuaKolom: KolomBarang[] = [
    {
      kunci: 'gambar',
      label: 'Gambar',
      judul: '',
      className: 'w-12',
      sel: (b) => <GambarKecil b={b} />,
    },
    {
      kunci: 'kode',
      label: 'Kode',
      wajib: true,
      judul: 'Kode',
      className: 'w-28',
      sel: (b) => <span className="font-mono text-xs text-slate-600">{b.kode}</span>,
    },
    {
      kunci: 'nama',
      label: 'Nama barang',
      wajib: true,
      judul: 'Nama barang',
      sel: (b) => (
        <div>
          <Link to={`/barang/${b.id}`} className="font-medium text-slate-900 hover:text-blue-700">
            {b.namaBarang}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>{b.kodeSatuan}</span>
            {b.kepemilikan === 'KONSINYASI' && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                Konsinyasi
              </Badge>
            )}
            {b.perluTinjauHarga && (
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                Perlu tinjau harga
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      kunci: 'kategori',
      label: 'Kategori & merk',
      judul: 'Kategori & merk',
      sel: (b) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{b.namaKategori}</Badge>
          {b.namaMerk && <span className="text-xs text-slate-500">{b.namaMerk}</span>}
        </div>
      ),
    },
    { kunci: 'barcode', label: 'Barcode', judul: 'Barcode', sel: (b) => b.barcode ?? '—' },
    ...kolomTier,
    {
      kunci: 'stok',
      label: 'Stok (min)',
      judul: 'Stok (min)',
      className: 'text-right tabular-nums',
      sel: (b) => (
        <span>
          <span className="font-medium">{formatDesimal(b.stokTersedia)}</span>{' '}
          <span className="text-xs text-slate-400">({formatDesimal(b.stokMinimum)})</span>
        </span>
      ),
    },
    {
      kunci: 'statusStok',
      label: 'Status stok',
      judul: 'Status stok',
      sel: (b) => <BadgeStatusStok status={b.statusStok} />,
    },
    {
      kunci: 'status',
      label: 'Status',
      judul: 'Status',
      sel: (b) => <BadgeStatusAktif status={b.statusAktif} />,
    },
  ];

  const kolomTampil = useKolomTampil(
    'barang',
    semuaKolom.filter((k) => !k.wajib).map((k) => k.kunci),
    ['barcode'],
  );
  const kolom: KolomTabel<BarisBarang>[] = [
    ...semuaKolom.filter((k) => k.wajib || kolomTampil.tampil(k.kunci)),
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (b) => (
        <MenuAksiMaster
          nama={b.namaBarang}
          status={b.statusAktif}
          onUbah={() => void navigasi(`/barang/${b.id}`)}
          onUbahStatus={(statusAktif: StatusAktif) =>
            void jalankanDenganToast(
              ubahStatus.mutateAsync({ id: b.id, statusAktif }),
              `Barang ${b.namaBarang} ${statusAktif === 'AKTIF' ? 'diaktifkan' : 'dinonaktifkan'}.`,
            )
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Data Barang</h1>
          <p className="text-sm text-slate-500">Kelola data barang, atribut, dan harga jual.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3 /> Atur kolom
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Kolom yang ditampilkan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {semuaKolom
                .filter((k) => !k.wajib)
                .map((k) => (
                  <DropdownMenuCheckboxItem
                    key={k.kunci}
                    checked={kolomTampil.tampil(k.kunci)}
                    onCheckedChange={() => kolomTampil.alih(k.kunci)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {k.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {bolehImport && (
            <>
              <Button variant="outline" asChild>
                <a href="/api/import/barang/ekspor" download>
                  <Download /> Ekspor Excel
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/barang/import">
                  <FileSpreadsheet /> Import Excel
                </Link>
              </Button>
            </>
          )}
          <Button variant="outline" asChild>
            <Link to="/barang/label">
              <Tags /> Cetak label
            </Link>
          </Button>
          <Button asChild>
            <Link to="/barang/baru">
              <Plus /> Tambah barang
            </Link>
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <BilahSaring
          cari={cari}
          onCari={(v) => {
            setCari(v);
            setHalaman(1);
          }}
          status={status}
          onStatus={(v) => {
            setStatus(v);
            setHalaman(1);
          }}
          placeholder="Cari kode, nama, barcode, atau merk…"
          label="Cari barang"
        >
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
          <Select
            value={idMerk === null ? SEMUA_KATEGORI : String(idMerk)}
            onValueChange={(v) => {
              setIdMerk(v === SEMUA_KATEGORI ? null : Number(v));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Saring merk">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA_KATEGORI}>Semua merk</SelectItem>
              {(merk.data ?? []).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.nama}
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
        </BilahSaring>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(b) => b.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Tidak ada barang yang cocok."
        />
      </Card>
    </div>
  );
}
