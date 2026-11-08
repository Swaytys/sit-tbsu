import {
  izinEfektif,
  LABEL_PERAN,
  PERAN,
  skemaPeranKustom,
  type Izin,
  type Peran,
  type PeranKustom,
} from '@sit/shared';
import { ArrowLeft, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import {
  useDaftarPeranKustom,
  useSimpanPeranKustom,
  useUbahStatusPeranKustom,
} from '@/api/pengguna';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PilihIzin } from './pilih-izin';
import { selisihIzin } from './selisih-izin';

const PERAN_DASAR = PERAN.filter((p) => p !== 'OWNER');
const bawaan = (peran: Peran) => izinEfektif(peran, null, null);

type Galat = Partial<Record<'nama' | 'peranDasar' | 'keterangan', string>>;

/**
 * K-243: peran khusus = peran dasar + izin ditambah/dicabut, untuk beberapa akun yang tugasnya sama (mis.
 * "Kasir Pengantaran"). Hanya Owner yang membuat dan mengubah.
 */
export function DialogPeranKustom({ onTutup }: { onTutup: () => void }) {
  const daftar = useDaftarPeranKustom();
  const ubahStatus = useUbahStatusPeranKustom();
  const [edit, setEdit] = useState<PeranKustom | 'baru' | null>(null);

  async function gantiStatus(k: PeranKustom) {
    const statusAktif = k.statusAktif === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    try {
      await ubahStatus.mutateAsync({ id: k.id, statusAktif });
      toast.success(
        statusAktif === 'AKTIF'
          ? `Peran "${k.nama}" aktif kembali.`
          : `Peran "${k.nama}" dinonaktifkan; ${k.jumlahPengguna} akun kembali ke izin bawaan perannya.`,
      );
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-4xl">
        {edit ? (
          <FormPeran awal={edit === 'baru' ? null : edit} onSelesai={() => setEdit(null)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Peran khusus</DialogTitle>
              <DialogDescription>
                Paket izin untuk beberapa akun dengan tugas sama, mis. &ldquo;Kasir
                Pengantaran&rdquo; = Kasir + mengurus surat jalan dan rit. Pasang ke akun lewat menu
                &ldquo;Atur izin&rdquo;.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Peran dasar</th>
                    <th className="px-3 py-2">Penyesuaian</th>
                    <th className="px-3 py-2 text-right">Akun</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(daftar.data ?? []).map((k) => (
                    <tr key={k.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{k.nama}</div>
                        {k.keterangan && (
                          <div className="text-xs text-slate-500">{k.keterangan}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">{LABEL_PERAN[k.peranDasar]}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="text-emerald-700">+{k.izinTambah.length}</span>{' '}
                        <span className="text-red-700">−{k.izinCabut.length}</span> izin
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.jumlahPengguna}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            k.statusAktif === 'AKTIF'
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-slate-200 bg-slate-100 text-slate-500',
                          )}
                        >
                          {k.statusAktif === 'AKTIF' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => setEdit(k)}>
                          <Pencil /> Ubah
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={ubahStatus.isPending}
                          onClick={() => void gantiStatus(k)}
                        >
                          {k.statusAktif === 'AKTIF' ? (
                            <>
                              <UserX /> Nonaktifkan
                            </>
                          ) : (
                            <>
                              <UserCheck /> Aktifkan
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {daftar.data?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        Belum ada peran khusus. Semua akun memakai izin bawaan perannya.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button onClick={() => setEdit('baru')}>
                <Plus /> Tambah peran khusus
              </Button>
              <Button variant="outline" onClick={onTutup}>
                Tutup
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormPeran({ awal, onSelesai }: { awal: PeranKustom | null; onSelesai: () => void }) {
  const simpan = useSimpanPeranKustom();
  const [nama, setNama] = useState(awal?.nama ?? '');
  const [peranDasar, setPeranDasar] = useState<Peran>(awal?.peranDasar ?? 'KASIR');
  const [keterangan, setKeterangan] = useState(awal?.keterangan ?? '');
  const [terpilih, setTerpilih] = useState<Set<Izin>>(() =>
    izinEfektif(
      awal?.peranDasar ?? 'KASIR',
      awal ? { tambah: awal.izinTambah, cabut: awal.izinCabut } : null,
      null,
    ),
  );
  const [galat, setGalat] = useState<Galat>({});
  const dasar = bawaan(peranDasar);
  const dipakai = (awal?.jumlahPengguna ?? 0) > 0;

  function gantiDasar(v: string) {
    // Selisih yang sudah dicentang dibawa ke peran dasar yang baru.
    const { tambah, cabut } = selisihIzin(dasar, terpilih);
    const baru = bawaan(v as Peran);
    for (const i of tambah) baru.add(i);
    for (const i of cabut) baru.delete(i);
    setPeranDasar(v as Peran);
    setTerpilih(baru);
  }

  async function kirim() {
    const { tambah, cabut } = selisihIzin(dasar, terpilih);
    const hasil = skemaPeranKustom.safeParse({
      nama,
      peranDasar,
      keterangan,
      izinTambah: tambah,
      izinCabut: cabut,
    });
    if (!hasil.success) {
      const g: Galat = {};
      for (const m of hasil.error.issues) {
        const k = m.path[0] as keyof Galat;
        g[k] ??= m.message;
      }
      setGalat(g);
      return;
    }
    setGalat({});
    try {
      await simpan.mutateAsync({ id: awal?.id ?? null, json: hasil.data });
      toast.success(
        `Peran khusus "${hasil.data.nama}" disimpan${dipakai ? `; ${awal?.jumlahPengguna} akun langsung mengikuti` : ''}.`,
      );
      onSelesai();
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void kirim();
      }}
    >
      <DialogHeader>
        <DialogTitle>{awal ? `Ubah peran "${awal.nama}"` : 'Tambah peran khusus'}</DialogTitle>
        <DialogDescription>
          Pilih peran dasar, lalu centang izin akhirnya. Yang disimpan hanya bedanya dari bawaan.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="nama-peran">Nama peran</Label>
          <Input
            id="nama-peran"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="mis. Kasir Pengantaran"
            autoFocus
            aria-invalid={!!galat.nama}
          />
          {galat.nama && <p className="text-xs text-red-600">{galat.nama}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="dasar-peran">Peran dasar</Label>
          <Select value={peranDasar} onValueChange={gantiDasar} disabled={dipakai}>
            <SelectTrigger id="dasar-peran" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERAN_DASAR.map((p) => (
                <SelectItem key={p} value={p}>
                  {LABEL_PERAN[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dipakai && (
            <p className="text-xs text-slate-500">
              Dipakai {awal?.jumlahPengguna} akun; peran dasar tidak bisa diganti.
            </p>
          )}
          {galat.peranDasar && <p className="text-xs text-red-600">{galat.peranDasar}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ket-peran">Keterangan (opsional)</Label>
          <Input
            id="ket-peran"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="mis. kasir shift pagi yang juga mengatur rit"
          />
          {galat.keterangan && <p className="text-xs text-red-600">{galat.keterangan}</p>}
        </div>
      </div>
      <PilihIzin
        dasar={dasar}
        terpilih={terpilih}
        onUbah={setTerpilih}
        labelDasar={LABEL_PERAN[peranDasar]}
      />
      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="outline" onClick={onSelesai}>
          <ArrowLeft /> Kembali ke daftar
        </Button>
        <Button type="submit" disabled={simpan.isPending}>
          {simpan.isPending ? 'Menyimpan…' : 'Simpan peran'}
        </Button>
      </DialogFooter>
    </form>
  );
}
