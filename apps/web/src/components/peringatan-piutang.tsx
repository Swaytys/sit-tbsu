import { formatRupiah } from '@sit/shared';
import { AlertTriangle } from 'lucide-react';
import { usePengguna } from '@/api/auth';
import { useDaftarPiutang } from '@/api/penjualan';

/** PT7: peringatan bila pelanggan punya piutang terlambat (tidak memblokir transaksi). */
export function PeringatanPiutang({ idPelanggan }: { idPelanggan: number | null }) {
  const boleh = usePengguna().izin.includes('penjualan.piutang.lihat');
  const data = useDaftarPiutang(
    { cari: '', idPelanggan, terlambat: true, halaman: 1, perHalaman: 10 },
    boleh && idPelanggan !== null,
  ).data;
  const daftar = data?.data ?? [];
  if (!boleh || idPelanggan === null || daftar.length === 0) return null;
  const total = daftar.reduce((t, p) => t + p.sisaTagihan, 0);
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800"
      role="status"
    >
      <AlertTriangle className="size-4 shrink-0" />
      Pelanggan ini punya {daftar.length} piutang terlambat, total {formatRupiah(total)}.
    </div>
  );
}
