import { formatRupiah, type BarisDaftarPenerimaan, type JenisPenerimaan } from '@sit/shared';
import { Plus, Search } from 'lucide-react';
import { useDaftarPO } from '@/api/order-pembelian';
import { BadgePO } from '@/features/order-pembelian/halaman-order-pembelian';
import { Link } from 'react-router';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useDaftarPenerimaan } from '@/api/persediaan';
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
import { formatTanggal, formatWaktu } from '@/lib/format';
import { LABEL_JENIS_PENERIMAAN, LABEL_STATUS_HUTANG } from '@/lib/label';
import { useTunda } from '@/lib/use-tunda';
import { useIngat } from '@/lib/ingat-saring';

const SEMUA = 'SEMUA';

export function BadgeHutang({ p }: { p: Pick<BarisDaftarPenerimaan, 'statusHutang'> }) {
  const kelas: Record<string, string> = {
    LUNAS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    BELUM_LUNAS: 'border-amber-200 bg-amber-50 text-amber-700',
    SEBAGIAN: 'border-amber-200 bg-amber-50 text-amber-700',
    TIDAK_ADA: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return (
    <Badge variant="outline" className={kelas[p.statusHutang]}>
      {LABEL_STATUS_HUTANG[p.statusHutang]}
    </Badge>
  );
}

/** Riwayat penerimaan barang (docs/05 E6). */
export function HalamanPenerimaan() {
  const [cari, setCari] = useIngat('penerimaan.cari', '');
  const cariTertunda = useTunda(cari, 300);
  const [jenis, setJenis] = useIngat<JenisPenerimaan | null>('penerimaan.jenis', null);
  const [dari, setDari] = useIngat('penerimaan.dari', '');
  const [sampai, setSampai] = useIngat('penerimaan.sampai', '');
  const [halaman, setHalaman] = useIngat('penerimaan.halaman', 1);
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPenerimaan({
    cari: cariTertunda,
    jenis,
    dari,
    sampai,
    halaman,
    perHalaman: barisPerHalaman,
  });

  const kolom: KolomTabel<BarisDaftarPenerimaan>[] = [
    {
      kunci: 'nomor',
      judul: 'Nomor',
      sel: (p) => (
        <Link to={`/penerimaan/${p.id}`} className="font-mono text-xs font-medium text-blue-700">
          {p.nomor}
        </Link>
      ),
    },
    { kunci: 'tanggal', judul: 'Waktu', sel: (p) => formatWaktu(p.tanggal) },
    {
      kunci: 'pemasok',
      judul: 'Pemasok',
      sel: (p) => (
        <div>
          <div className="font-medium">{p.namaPemasok}</div>
          {p.noFakturPemasok && (
            <div className="text-xs text-slate-500">Faktur {p.noFakturPemasok}</div>
          )}
        </div>
      ),
    },
    {
      kunci: 'jenis',
      judul: 'Jenis',
      sel: (p) =>
        `${LABEL_JENIS_PENERIMAAN[p.jenis]}${p.syaratBayar ? ` · ${p.syaratBayar === 'TUNAI' ? 'Tunai' : 'Tempo'}` : ''}`,
    },
    { kunci: 'baris', judul: 'Barang', className: 'text-right', sel: (p) => p.jumlahBaris },
    {
      kunci: 'total',
      judul: 'Total faktur',
      className: 'text-right tabular-nums',
      sel: (p) => (p.jenis === 'KONSINYASI' ? '—' : formatRupiah(p.totalFaktur)),
    },
    {
      kunci: 'hutang',
      judul: 'Hutang',
      sel: (p) => (
        <div className="space-y-0.5">
          <BadgeHutang p={p} />
          {p.tanggalJatuhTempo && p.sisaHutang > 0 && (
            <div className="text-xs text-slate-500">
              {formatRupiah(p.sisaHutang)} · jatuh tempo {formatTanggal(p.tanggalJatuhTempo)}
            </div>
          )}
        </div>
      ),
    },
    { kunci: 'oleh', judul: 'Dicatat oleh', sel: (p) => p.namaPengguna },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-xl font-semibold text-slate-900">Penerimaan Barang</h1>
          <p className="text-sm text-slate-500">
            Barang masuk dari pemasok menambah stok dan memperbarui HPP.
          </p>
        </div>
        <Button asChild>
          <Link to="/penerimaan/baru">
            <Plus /> Catat penerimaan
          </Link>
        </Button>
      </div>

      <OrderPembelianMenunggu />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(1);
              }}
              placeholder="Cari nomor, faktur, surat jalan, atau pemasok…"
              className="pl-8"
              aria-label="Cari penerimaan"
            />
          </div>
          <Select
            value={jenis ?? SEMUA}
            onValueChange={(v) => {
              setJenis(v === SEMUA ? null : (v as JenisPenerimaan));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Saring jenis">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua jenis</SelectItem>
              <SelectItem value="PEMBELIAN">Pembelian</SelectItem>
              <SelectItem value="KONSINYASI">Konsinyasi</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Dari
            <Input
              type="date"
              className="w-40"
              value={dari}
              onChange={(e) => {
                setDari(e.target.value);
                setHalaman(1);
              }}
              aria-label="Dari tanggal"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            s.d.
            <Input
              type="date"
              className="w-40"
              value={sampai}
              onChange={(e) => {
                setSampai(e.target.value);
                setHalaman(1);
              }}
              aria-label="Sampai tanggal"
            />
          </label>
        </div>
        <DataTable
          kolom={kolom}
          data={daftar.data?.data}
          meta={daftar.data?.meta}
          onHalaman={setHalaman}
          kunciBaris={(p) => p.id}
          memuat={daftar.isFetching}
          galat={daftar.error}
          onUlang={() => void daftar.refetch()}
          kosong="Belum ada penerimaan barang."
        />
      </Card>
    </div>
  );
}

/** K-179: order pembelian yang menunggu barang/konfirmasi, dengan tombol langsung terima. */
function OrderPembelianMenunggu() {
  const q = useDaftarPO({ cari: '', status: 'BERJALAN', halaman: 1, perHalaman: 20 });
  const daftar = q.data?.data ?? [];
  if (daftar.length === 0) return null;
  return (
    <Card className="gap-2 p-3" data-testid="po-menunggu">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          Order pembelian menunggu barang ({q.data?.meta.total ?? daftar.length})
        </h2>
        <Link className="text-sm text-blue-700 hover:underline" to="/order-pembelian">
          Semua order pembelian
        </Link>
      </div>
      <ul className="divide-y text-sm">
        {daftar.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="min-w-0">
              <Link
                className="font-medium text-blue-700 hover:underline"
                to={`/order-pembelian?status=&id=${p.id}`}
              >
                {p.nomor}
              </Link>{' '}
              <BadgePO status={p.status} /> · {p.namaPemasok} · {p.jumlahBarang} barang
              {p.tanggalJanjiKirim && ` · janji ${formatTanggal(p.tanggalJanjiKirim)}`}
              {p.terlambat && <b className="ml-1 text-red-700">terlambat</b>}
            </span>
            <span className="flex gap-2">
              {p.status === 'DIPESAN' && (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/order-pembelian?status=&id=${p.id}`}>Konfirmasi</Link>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link to={`/penerimaan/baru?po=${p.id}`}>Terima</Link>
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
