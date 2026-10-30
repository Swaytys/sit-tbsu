import { formatNoHp, type DataMirip, type Izin } from '@sit/shared';
import { AlertTriangle, ExternalLink, OctagonX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { usePengguna } from '@/api/auth';
import { useHapusMaster, type JenisMaster } from '@/api/hapus-master';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Izin yang dipakai API untuk hapus permanen (K-199). */
const IZIN_HAPUS: Record<JenisMaster, Izin> = {
  barang: 'master.barang.kelola',
  pelanggan: 'master.pelanggan.atur_kredit',
  pemasok: 'master.pemasok.kelola',
};

const TAUTAN: Record<JenisMaster, (m: DataMirip) => string> = {
  barang: (m) => `/barang/${m.id}`,
  pelanggan: (m) => `/pelanggan?cari=${encodeURIComponent(m.kode)}`,
  pemasok: (m) => `/pemasok?cari=${encodeURIComponent(m.kode)}`,
};

/**
 * K-137: data yang sudah ada dan mirip dengan isian. Pengguna memilih: buka/pakai data yang ada (`onPakai`), atau
 * menegaskan ini data berbeda lalu menyimpan (`onTetapSimpan`, mengirim `abaikanMirip`).
 * K-199: data yang **sama persis** (nama dan No. HP sama; barang: nama sama) tidak bisa disimpan ganda. Pilihannya:
 * ubah isian sendiri, buka data yang ditemukan untuk diubah, atau hapus permanen salah satunya (hanya bila belum
 * pernah dipakai; API yang memeriksa). `idIni` = data yang sedang diubah (boleh dihapus juga).
 */
export function PanelMirip({
  mirip,
  apa,
  jenis,
  idIni,
  onPakai,
  onTetapSimpan,
  onTerhapus,
  menyimpan,
}: {
  mirip: DataMirip[];
  apa: string;
  jenis?: JenisMaster;
  idIni?: number | null;
  onPakai?: (m: DataMirip) => void;
  onTetapSimpan: () => void;
  /** Setelah hapus permanen: `ini` = data yang sedang diubah yang dihapus. */
  onTerhapus?: (hasil: { id: number; ini: boolean }) => void;
  menyimpan?: boolean;
}) {
  const persis = mirip.filter((m) => m.persis);
  const izin = usePengguna().izin;
  const bolehHapus = jenis !== undefined && izin.includes(IZIN_HAPUS[jenis]);
  const hapus = useHapusMaster(jenis ?? 'pelanggan');
  const [konfirmasi, setKonfirmasi] = useState<{ id: number; label: string; ini: boolean } | null>(
    null,
  );

  function jalankanHapus() {
    if (!konfirmasi) return;
    hapus
      .mutateAsync(konfirmasi.id)
      .then(() => {
        toast.success(`${konfirmasi.label} dihapus permanen.`);
        onTerhapus?.({ id: konfirmasi.id, ini: konfirmasi.ini });
        setKonfirmasi(null);
      })
      .catch((err: unknown) => {
        toast.error(pesanGalat(err), { duration: 10_000 });
        setKonfirmasi(null);
      });
  }

  if (persis.length > 0) {
    return (
      <div
        className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        role="alert"
        data-testid="panel-ganda"
      >
        <p className="flex items-center gap-1.5 font-semibold">
          <OctagonX className="size-4" /> {apa} yang sama persis sudah ada. Data ganda tidak boleh
          disimpan.
        </p>
        <ul className="space-y-1.5">
          {persis.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{m.kode}</span>
              <span className="font-medium">{m.nama}</span>
              {m.noHp && <span className="text-xs">{formatNoHp(m.noHp)}</span>}
              <span className="text-xs">
                ({m.alasan}
                {m.statusAktif === 'AKTIF' ? '' : ', nonaktif'})
              </span>
              {jenis && (
                <>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link to={TAUTAN[jenis](m)}>
                      <ExternalLink /> Buka &amp; ubah data itu
                    </Link>
                  </Button>
                  {bolehHapus && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700"
                      onClick={() =>
                        setKonfirmasi({ id: m.id, label: `${m.kode} ${m.nama}`, ini: false })
                      }
                    >
                      <Trash2 /> Hapus data itu
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs">
          Pilih salah satu: <b>ubah</b> nama atau No. HP di isian ini; <b>buka &amp; ubah</b> data
          yang sudah ada; atau <b>hapus</b> salah satunya. Hapus hanya bisa untuk data yang belum
          pernah dipakai transaksi; yang sudah dipakai harus diubah.
        </p>
        {bolehHapus && idIni != null && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700"
            onClick={() =>
              setKonfirmasi({ id: idIni, label: `${apa} yang sedang diubah`, ini: true })
            }
          >
            <Trash2 /> Hapus data yang sedang diubah ini
          </Button>
        )}
        {konfirmasi && (
          <Dialog open onOpenChange={(b) => !b && setKonfirmasi(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Hapus permanen {konfirmasi.label}?</DialogTitle>
                <DialogDescription>
                  Data ini hilang dari daftar dan tidak bisa dikembalikan (tercatat di log). Bila
                  ternyata sudah pernah dipakai transaksi, penghapusan ditolak dan Anda perlu
                  mengubah nama/No. HP-nya.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setKonfirmasi(null)}>
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={hapus.isPending}
                  onClick={jalankanHapus}
                >
                  <Trash2 /> {hapus.isPending ? 'Menghapus…' : 'Ya, hapus permanen'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div
      className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      role="alert"
      data-testid="panel-mirip"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="size-4" /> {apa} yang mirip sudah ada. Pastikan tidak dobel:
      </p>
      <ul className="space-y-1">
        {mirip.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{m.kode}</span>
            <span className="font-medium">{m.nama}</span>
            {m.noHp && <span className="text-xs">{formatNoHp(m.noHp)}</span>}
            <span className="text-xs text-amber-700">
              ({m.alasan}
              {m.statusAktif === 'AKTIF' ? '' : ', nonaktif'})
            </span>
            {onPakai && (
              <Button type="button" size="sm" variant="outline" onClick={() => onPakai(m)}>
                Pakai yang ini
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={menyimpan}
        onClick={onTetapSimpan}
      >
        Ini {apa.toLowerCase()} berbeda, tetap simpan
      </Button>
    </div>
  );
}
