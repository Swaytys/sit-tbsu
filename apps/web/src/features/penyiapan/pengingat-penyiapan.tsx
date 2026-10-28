import { ListChecks, X } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { usePanduanPenyiapan, useSembunyikanPanduan } from '@/api/penyiapan';
import { Button } from '@/components/ui/button';

/** K-168: pengingat di Dashboard selama langkah wajib panduan penyiapan belum selesai (Owner/Admin). */
export function PengingatPenyiapan() {
  const p = usePanduanPenyiapan().data;
  const sembunyi = useSembunyikanPanduan();
  if (!p || p.disembunyikan) return null;
  // Kendaraan dan printer bergantung toko/komputer: tidak membuat pengingat tetap muncul.
  const wajib = p.langkah.filter((s) => s.langkah !== 'ARMADA' && s.langkah !== 'PRINTER');
  const selesai = wajib.filter((s) => s.selesai).length;
  if (selesai === wajib.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
      data-testid="pengingat-penyiapan"
    >
      <ListChecks className="size-5 shrink-0" />
      <span className="flex-1">
        <b>Penyiapan toko belum selesai</b> ({selesai} dari {wajib.length} langkah wajib). Isi
        profil, rekening, akun karyawan, barang, stok awal, pelanggan, dan pemasok sebelum toko
        memakai aplikasi.
      </span>
      <Button asChild size="sm">
        <Link to="/penyiapan">Lanjutkan penyiapan</Link>
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Sembunyikan pengingat penyiapan"
        title="Sembunyikan (bisa ditampilkan lagi dari halaman Panduan penyiapan)"
        onClick={() =>
          void sembunyi.mutateAsync(true).catch((err: unknown) => toast.error(pesanGalat(err)))
        }
      >
        <X />
      </Button>
    </div>
  );
}
