import { LABEL_PERAN, type PenggunaDaftar, type Peran, type StatusAktif } from '@sit/shared';
import {
  KeyRound,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { useBarisPerHalaman } from '@/api/pengaturan';
import { pesanGalat } from '@/api/client';
import {
  useAktifkanPengguna,
  useCabutSesiPengguna,
  useDaftarPengguna,
  useNonaktifkanPengguna,
} from '@/api/pengguna';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { DialogKonfirmasi } from '@/components/dialog-konfirmasi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatWaktu } from '@/lib/format';
import { LABEL_STATUS_AKTIF } from '@/lib/label';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';
import { DialogTambahPengguna, DialogUbahPengguna } from './dialog-form-pengguna';
import { DialogResetPassword } from './dialog-reset-password';

// Warna peran seperti mockup Data Pengguna.
const WARNA_PERAN: Record<Peran, string> = {
  OWNER: 'border-purple-200 bg-purple-50 text-purple-700',
  ADMIN: 'border-blue-200 bg-blue-50 text-blue-700',
  KASIR: 'border-teal-200 bg-teal-50 text-teal-700',
  STAF_PENJUALAN: 'border-slate-200 bg-slate-100 text-slate-600',
};

type Dialog =
  | { jenis: 'tambah' }
  | { jenis: 'ubah' | 'reset' | 'nonaktif' | 'aktif' | 'cabut'; pengguna: PenggunaDaftar }
  | null;

export function HalamanPengguna() {
  const saya = usePengguna();
  const [cari, setCari] = useState('');
  const cariTertunda = useTunda(cari, 300);
  const [status, setStatus] = useState<StatusAktif | 'SEMUA'>('SEMUA');
  const [halaman, setHalaman] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);

  const barisPerHalaman = useBarisPerHalaman();
  const daftar = useDaftarPengguna({
    cari: cariTertunda,
    status,
    halaman,
    perHalaman: barisPerHalaman,
  });
  const nonaktifkan = useNonaktifkanPengguna();
  const aktifkan = useAktifkanPengguna();
  const cabutSesi = useCabutSesiPengguna();

  const tutup = () => setDialog(null);

  /** Menjalankan aksi dengan toast; galat dilempar ulang agar dialog konfirmasi tetap terbuka. */
  async function jalankan(aksi: Promise<unknown>, pesanBerhasil: string) {
    try {
      await aksi;
      toast.success(pesanBerhasil);
    } catch (err) {
      toast.error(pesanGalat(err));
      throw err;
    }
  }

  const kolom: KolomTabel<PenggunaDaftar>[] = [
    {
      kunci: 'kode',
      judul: 'Kode',
      sel: (p) => <span className="font-mono text-xs text-slate-500">{p.kode}</span>,
    },
    {
      kunci: 'nama',
      judul: 'Nama pengguna',
      sel: (p) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-800">{p.namaPengguna}</span>
          {p.id === saya.id && <span className="text-xs text-slate-400">(Anda)</span>}
          {p.wajibGantiPassword && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              Wajib ganti password
            </Badge>
          )}
          {p.terkunciSampai && new Date(p.terkunciSampai) > new Date() && (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              Terkunci s.d. {formatWaktu(p.terkunciSampai).slice(-5)}
            </Badge>
          )}
        </div>
      ),
    },
    {
      kunci: 'username',
      judul: 'Username',
      sel: (p) => <span className="font-mono text-xs text-slate-600">{p.username}</span>,
    },
    {
      kunci: 'peran',
      judul: 'Peran',
      sel: (p) => (
        <Badge variant="outline" className={WARNA_PERAN[p.peran]}>
          {LABEL_PERAN[p.peran]}
        </Badge>
      ),
    },
    { kunci: 'hp', judul: 'No. HP', sel: (p) => <span className="text-xs">{p.noHp ?? '—'}</span> },
    {
      kunci: 'status',
      judul: 'Status',
      sel: (p) => (
        <Badge
          variant="outline"
          className={cn(
            p.statusAktif === 'AKTIF'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-slate-200 bg-slate-100 text-slate-500',
          )}
        >
          {LABEL_STATUS_AKTIF[p.statusAktif]}
        </Badge>
      ),
    },
    {
      kunci: 'login',
      judul: 'Login terakhir',
      sel: (p) => <span className="text-xs text-slate-600">{formatWaktu(p.loginTerakhir)}</span>,
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-12 text-right',
      sel: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${p.namaPengguna}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ jenis: 'ubah', pengguna: p })}>
              <Pencil /> Ubah data
            </DropdownMenuItem>
            {p.id !== saya.id && (
              <DropdownMenuItem onSelect={() => setDialog({ jenis: 'reset', pengguna: p })}>
                <KeyRound /> Reset password
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setDialog({ jenis: 'cabut', pengguna: p })}>
              <LogOut /> Akhiri semua sesi ({p.sesiAktif})
            </DropdownMenuItem>
            {p.id !== saya.id && (
              <>
                <DropdownMenuSeparator />
                {p.statusAktif === 'AKTIF' ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDialog({ jenis: 'nonaktif', pengguna: p })}
                  >
                    <UserX /> Nonaktifkan
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setDialog({ jenis: 'aktif', pengguna: p })}>
                    <UserCheck /> Aktifkan kembali
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <div className="mb-0.5 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">Data Pengguna</h1>
            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
              <Shield /> Owner saja
            </Badge>
          </div>
          <p className="text-sm text-slate-500">Kelola akun pengguna dan peran hak akses sistem.</p>
        </div>
        <Button onClick={() => setDialog({ jenis: 'tambah' })}>
          <Plus /> Tambah pengguna
        </Button>
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
              placeholder="Cari nama, username, atau kode…"
              className="pl-8"
              aria-label="Cari pengguna"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusAktif | 'SEMUA');
              setHalaman(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Saring status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEMUA">Semua status</SelectItem>
              <SelectItem value="AKTIF">Aktif</SelectItem>
              <SelectItem value="NONAKTIF">Nonaktif</SelectItem>
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
          kosong="Tidak ada pengguna yang cocok."
        />
      </Card>

      <DialogTambahPengguna terbuka={dialog?.jenis === 'tambah'} onTutup={tutup} />
      {dialog?.jenis === 'ubah' && (
        <DialogUbahPengguna pengguna={dialog.pengguna} onTutup={tutup} />
      )}
      {dialog?.jenis === 'reset' && (
        <DialogResetPassword pengguna={dialog.pengguna} onTutup={tutup} />
      )}

      {dialog &&
        (dialog.jenis === 'nonaktif' || dialog.jenis === 'aktif' || dialog.jenis === 'cabut') && (
          <DialogKonfirmasi
            terbuka
            onTutup={tutup}
            bahaya={dialog.jenis !== 'aktif'}
            judul={
              dialog.jenis === 'nonaktif'
                ? `Nonaktifkan ${dialog.pengguna.namaPengguna}?`
                : dialog.jenis === 'aktif'
                  ? `Aktifkan kembali ${dialog.pengguna.namaPengguna}?`
                  : `Akhiri semua sesi ${dialog.pengguna.namaPengguna}?`
            }
            pesan={
              dialog.jenis === 'nonaktif'
                ? 'Ia tidak bisa login lagi dan semua sesinya langsung diakhiri. Data dan riwayat transaksinya tetap tersimpan.'
                : dialog.jenis === 'aktif'
                  ? 'Ia bisa login lagi dengan password terakhirnya.'
                  : dialog.pengguna.id === saya.id
                    ? 'Anda akan keluar dari semua perangkat lain. Sesi yang sedang Anda pakai tetap aktif.'
                    : 'Ia harus login ulang di semua perangkat.'
            }
            labelKonfirmasi={
              dialog.jenis === 'nonaktif'
                ? 'Nonaktifkan'
                : dialog.jenis === 'aktif'
                  ? 'Aktifkan'
                  : 'Akhiri sesi'
            }
            onKonfirmasi={() => {
              const { id, namaPengguna } = dialog.pengguna;
              if (dialog.jenis === 'nonaktif') {
                return jalankan(nonaktifkan.mutateAsync(id), `${namaPengguna} dinonaktifkan.`);
              }
              if (dialog.jenis === 'aktif') {
                return jalankan(aktifkan.mutateAsync(id), `${namaPengguna} aktif kembali.`);
              }
              return jalankan(cabutSesi.mutateAsync(id), `Sesi ${namaPengguna} diakhiri.`);
            }}
          />
        )}
    </div>
  );
}
