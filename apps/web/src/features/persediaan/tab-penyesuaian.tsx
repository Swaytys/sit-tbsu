import type { BarisDaftarPenyesuaian, JenisPenyesuaian, StatusPenyesuaian } from '@sit/shared';
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  Flame,
  PackageMinus,
  PackagePlus,
  Pencil,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { useBuatLembarOpname, useDaftarPenyesuaian, useImporSaldoAwal } from '@/api/persediaan';
import { useDaftarKategori } from '@/api/referensi';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatWaktu } from '@/lib/format';
import { LABEL_JENIS_PENYESUAIAN, LABEL_STATUS_PENYESUAIAN } from '@/lib/label';

const SEMUA = 'SEMUA';

export function BadgeStatusPenyesuaian({ status }: { status: StatusPenyesuaian }) {
  const kelas: Record<StatusPenyesuaian, string> = {
    DRAFT: 'border-amber-200 bg-amber-50 text-amber-700',
    SELESAI: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    BATAL: 'border-slate-200 bg-slate-50 text-slate-500',
  };
  return (
    <Badge variant="outline" className={kelas[status]}>
      {LABEL_STATUS_PENYESUAIAN[status]}
    </Badge>
  );
}

function DialogLembarOpname({ onTutup }: { onTutup: () => void }) {
  const navigasi = useNavigate();
  const kategori = useDaftarKategori('AKTIF');
  const buat = useBuatLembarOpname();
  const [idKategori, setIdKategori] = useState<string>(SEMUA);

  async function lanjut() {
    try {
      const d = await buat.mutateAsync({
        idKategori: idKategori === SEMUA ? null : Number(idKategori),
      });
      toast.success(`Lembar opname ${d.nomor} dibuat (${d.baris.length} barang).`);
      void navigasi(`/persediaan/penyesuaian/${d.id}`);
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stok opname</DialogTitle>
          <DialogDescription>
            Membuat draf berisi barang aktif untuk dihitung. Cetak lembar hitungnya, isi hasil
            hitung, lalu selesaikan. Selisih dihitung dari stok sistem saat diselesaikan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="kategori-opname">Barang yang dihitung</Label>
          <Select value={idKategori} onValueChange={setIdKategori}>
            <SelectTrigger id="kategori-opname" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua barang aktif</SelectItem>
              {(kategori.data ?? []).map((k) => (
                <SelectItem key={k.id} value={String(k.id)}>
                  Kategori {k.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button disabled={buat.isPending} onClick={() => void lanjut()}>
            {buat.isPending ? 'Membuat…' : 'Buat lembar opname'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogImporSaldoAwal({ onTutup }: { onTutup: () => void }) {
  const navigasi = useNavigate();
  const impor = useImporSaldoAwal();

  async function unggah(berkas: File | undefined) {
    if (!berkas) return;
    try {
      const d = await impor.mutateAsync(berkas);
      toast.success(
        `Draf saldo awal ${d.nomor} dibuat (${d.baris.length} barang). Periksa lalu selesaikan.`,
      );
      void navigasi(`/persediaan/penyesuaian/${d.id}`);
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import saldo awal</DialogTitle>
          <DialogDescription>
            Templat berisi semua barang aktif dengan nilai per satuan saat ini. Isi kolom qty saja;
            baris kosong dilewati. Hasilnya draf saldo awal yang diperiksa dulu sebelum menambah
            stok.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/penyesuaian/saldo-awal/templat" download>
              <Download /> Unduh templat
            </a>
          </Button>
          <Button asChild disabled={impor.isPending}>
            <label className="relative cursor-pointer">
              <FileSpreadsheet /> {impor.isPending ? 'Membaca…' : 'Unggah berkas'}
              <input
                type="file"
                accept=".xlsx"
                className="sr-only"
                aria-label="Berkas saldo awal"
                onChange={(e) => {
                  void unggah(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Daftar dokumen penyesuaian (docs/05 §12) dan pintu masuk membuat dokumen baru. */
export function TabPenyesuaian() {
  const [jenis, setJenis] = useState<JenisPenyesuaian | null>(null);
  const [status, setStatus] = useState<StatusPenyesuaian | null>(null);
  const [halaman, setHalaman] = useState(1);
  const [dialog, setDialog] = useState<'opname' | 'impor' | null>(null);
  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPenyesuaian({
    cari: '',
    jenis,
    status,
    halaman,
    perHalaman: barisPerHalaman,
  });

  const kolom: KolomTabel<BarisDaftarPenyesuaian>[] = [
    {
      kunci: 'nomor',
      judul: 'Nomor',
      sel: (p) => (
        <Link
          to={`/persediaan/penyesuaian/${p.id}`}
          className="font-mono text-xs font-medium text-blue-700"
        >
          {p.nomor}
        </Link>
      ),
    },
    { kunci: 'waktu', judul: 'Dibuat', sel: (p) => formatWaktu(p.tanggal) },
    { kunci: 'jenis', judul: 'Jenis', sel: (p) => LABEL_JENIS_PENYESUAIAN[p.jenis] },
    { kunci: 'status', judul: 'Status', sel: (p) => <BadgeStatusPenyesuaian status={p.status} /> },
    { kunci: 'baris', judul: 'Barang', className: 'text-right', sel: (p) => p.jumlahBaris },
    {
      kunci: 'alasan',
      judul: 'Alasan',
      sel: (p) => <span className="text-xs text-slate-600">{p.alasan ?? '—'}</span>,
    },
    { kunci: 'oleh', judul: 'Oleh', sel: (p) => p.namaPengguna },
    {
      kunci: 'selesai',
      judul: 'Diselesaikan',
      sel: (p) => (p.waktuSelesai ? formatWaktu(p.waktuSelesai) : '—'),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/persediaan/penyesuaian/baru?jenis=SALDO_AWAL">
            <PackagePlus /> Saldo awal
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setDialog('impor')}>
          <FileSpreadsheet /> Import saldo awal
        </Button>
        <Button variant="outline" onClick={() => setDialog('opname')}>
          <ClipboardList /> Stok opname
        </Button>
        <Button variant="outline" asChild>
          <Link to="/persediaan/penyesuaian/baru?jenis=KOREKSI">
            <Pencil /> Koreksi
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/persediaan/penyesuaian/baru?jenis=RUSAK">
            <PackageMinus /> Stok rusak
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/persediaan/penyesuaian/baru?jenis=MUSNAH">
            <Flame /> Musnahkan stok rusak
          </Link>
        </Button>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-3 border-b p-3">
          <Select
            value={jenis ?? SEMUA}
            onValueChange={(v) => {
              setJenis(v === SEMUA ? null : (v as JenisPenyesuaian));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Saring jenis penyesuaian">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua jenis</SelectItem>
              {(['SALDO_AWAL', 'OPNAME', 'KOREKSI', 'RUSAK', 'MUSNAH'] as const).map((j) => (
                <SelectItem key={j} value={j}>
                  {LABEL_JENIS_PENYESUAIAN[j]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status ?? SEMUA}
            onValueChange={(v) => {
              setStatus(v === SEMUA ? null : (v as StatusPenyesuaian));
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Saring status penyesuaian">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua status</SelectItem>
              <SelectItem value="DRAFT">Draf</SelectItem>
              <SelectItem value="SELESAI">Selesai</SelectItem>
              <SelectItem value="BATAL">Batal</SelectItem>
            </SelectContent>
          </Select>
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
          kosong="Belum ada penyesuaian stok."
        />
      </Card>
      {dialog === 'opname' && <DialogLembarOpname onTutup={() => setDialog(null)} />}
      {dialog === 'impor' && <DialogImporSaldoAwal onTutup={() => setDialog(null)} />}
    </div>
  );
}
