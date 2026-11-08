import {
  izinEfektif,
  LABEL_PERAN,
  type Izin,
  type PenggunaDaftar,
  type PeranKustom,
} from '@sit/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useAturIzinAkun, useDaftarPeranKustom } from '@/api/pengguna';
import { Button } from '@/components/ui/button';
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
import { PilihIzin } from './pilih-izin';
import { selisihIzin } from './selisih-izin';

const TANPA = 'tanpa';

/** Bawaan pembanding: izin peran, ditambah penyesuaian peran khusus bila dipilih. */
function dasarDari(peran: PenggunaDaftar['peran'], kustom: PeranKustom | undefined) {
  return izinEfektif(
    peran,
    kustom ? { tambah: kustom.izinTambah, cabut: kustom.izinCabut } : null,
    null,
  );
}

/**
 * K-243: Owner mengatur izin satu akun. Pilih peran khusus (opsional), lalu centang izin akhir; yang disimpan
 * hanya selisihnya terhadap bawaan, jadi perubahan izin bawaan peran di masa depan tetap ikut berlaku.
 */
export function DialogIzinAkun({
  pengguna,
  onTutup,
}: {
  pengguna: PenggunaDaftar;
  onTutup: () => void;
}) {
  const daftar = useDaftarPeranKustom();
  const atur = useAturIzinAkun();
  const pilihan = (daftar.data ?? []).filter(
    (k) => k.peranDasar === pengguna.peran && k.statusAktif === 'AKTIF',
  );
  // Peran khusus yang sudah dinonaktifkan tidak berlaku lagi; disimpan ulang sebagai "tanpa".
  const lamaNonaktif = (daftar.data ?? []).find(
    (k) => k.id === pengguna.idPeranKustom && k.statusAktif !== 'AKTIF',
  );
  const [idPilih, setIdKustom] = useState<number | null>(pengguna.idPeranKustom);
  const kustom = pilihan.find((k) => k.id === idPilih);
  const idKustom = kustom ? kustom.id : null;
  const dasar = dasarDari(pengguna.peran, kustom);
  // null = belum diubah: tampilkan izin akun saat ini (dihitung dari data yang sama dengan server).
  const [terpilihUbah, setTerpilih] = useState<Set<Izin> | null>(null);
  const terpilih =
    terpilihUbah ??
    izinEfektif(
      pengguna.peran,
      kustom ? { tambah: kustom.izinTambah, cabut: kustom.izinCabut } : null,
      { tambah: pengguna.izinTambah, cabut: pengguna.izinCabut },
    );

  function gantiKustom(nilai: string) {
    const idBaru = nilai === TANPA ? null : Number(nilai);
    // Penyesuaian akun yang sudah dicentang tetap dibawa ke bawaan yang baru.
    const { tambah, cabut } = selisihIzin(dasar, terpilih);
    const baru = dasarDari(
      pengguna.peran,
      pilihan.find((k) => k.id === idBaru),
    );
    for (const i of tambah) baru.add(i);
    for (const i of cabut) baru.delete(i);
    setIdKustom(idBaru);
    setTerpilih(baru);
  }

  async function simpan() {
    const { tambah, cabut } = selisihIzin(dasar, terpilih);
    try {
      await atur.mutateAsync({
        id: pengguna.id,
        json: { idPeranKustom: idKustom, izinTambah: tambah, izinCabut: cabut },
      });
      toast.success(
        `Izin ${pengguna.namaPengguna} disimpan (ditambah ${tambah.length}, dicabut ${cabut.length}). Berlaku langsung.`,
      );
      onTutup();
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  const labelDasar = kustom
    ? `${LABEL_PERAN[pengguna.peran]} + peran khusus "${kustom.nama}"`
    : LABEL_PERAN[pengguna.peran];

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Atur izin {pengguna.namaPengguna}</DialogTitle>
          <DialogDescription>
            Peran {LABEL_PERAN[pengguna.peran]}. Centang = boleh. Perubahan berlaku langsung tanpa
            login ulang dan tercatat di log aktivitas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void simpan();
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 space-y-1">
              <Label htmlFor="pilih-peran-kustom">Peran khusus</Label>
              <Select
                value={idKustom === null ? TANPA : String(idKustom)}
                onValueChange={gantiKustom}
              >
                <SelectTrigger id="pilih-peran-kustom" className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TANPA}>
                    Tanpa (bawaan {LABEL_PERAN[pengguna.peran]})
                  </SelectItem>
                  {pilihan.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="max-w-md flex-1 text-xs text-slate-500">
              {lamaNonaktif && (
                <span className="mb-1 block text-amber-700">
                  Peran khusus &ldquo;{lamaNonaktif.nama}&rdquo; sudah nonaktif dan tidak berlaku.
                </span>
              )}
              {pilihan.length === 0
                ? `Belum ada peran khusus berdasar ${LABEL_PERAN[pengguna.peran]}. Buat lewat tombol "Peran khusus" di atas tabel bila beberapa akun butuh izin yang sama.`
                : 'Peran khusus = paket izin untuk beberapa akun sekaligus. Centang di bawah = tambahan khusus akun ini.'}
            </p>
          </div>

          <PilihIzin
            dasar={dasar}
            terpilih={terpilih}
            onUbah={setTerpilih}
            labelDasar={labelDasar}
          />

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setTerpilih(new Set(dasar))}>
              Samakan dengan bawaan
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onTutup}>
                Batal
              </Button>
              <Button type="submit" disabled={atur.isPending || daftar.isLoading}>
                {atur.isPending ? 'Menyimpan…' : 'Simpan izin'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
