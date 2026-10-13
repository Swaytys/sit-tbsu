import { AlarmClock, Lock } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { usePengguna } from '@/api/auth';
import { useShiftSaya } from '@/api/penjualan';
import { useSekarang } from '@/features/pos/use-sekarang';
import { formatTanggal } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Berapa menit sebelum jam tutup pengingat "sebentar lagi tutup" mulai tampil. */
const MENIT_PENGINGAT = 15;

/**
 * Peringatan shift di atas setiap halaman (K-109), untuk pengguna yang memegang shift:
 * - merah: shift dari hari sebelumnya belum ditutup, penjualan dan pencatatan uang terkunci;
 * - kuning: jam tutup shift sudah lewat (penjualan masih bisa);
 * - biru: jam tutup tinggal beberapa menit.
 * Jadwal dan status "terlewat" dari API; hitungan menit menuju jam tutup hanya untuk tampilan.
 */
export function PeringatanShift() {
  const bolehShift = usePengguna().izin.includes('kas.shift.kelola_sendiri');
  const shift = useShiftSaya(bolehShift).data;
  const kini = useSekarang();
  const diHalamanShift = useLocation().pathname === '/shift';
  if (!shift) return null;

  const batas = shift.batasTutup ? Date.parse(shift.batasTutup) : null;
  const sisaMenit = batas === null ? null : Math.ceil((batas - kini) / 60_000);
  const lewat = shift.lewatJadwal || (sisaMenit !== null && sisaMenit <= 0);
  const tingkat = shift.terlewat
    ? 'terlewat'
    : lewat
      ? 'lewat'
      : sisaMenit !== null && sisaMenit <= MENIT_PENGINGAT
        ? 'segera'
        : null;
  if (tingkat === null) return null;

  return (
    <div
      role={tingkat === 'segera' ? 'status' : 'alert'}
      data-testid="peringatan-shift"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-2 text-sm print:hidden',
        tingkat === 'terlewat' && 'border-red-300 bg-red-50 text-red-900',
        tingkat === 'lewat' && 'border-amber-300 bg-amber-50 text-amber-900',
        tingkat === 'segera' && 'border-blue-200 bg-blue-50 text-blue-900',
      )}
    >
      {tingkat === 'terlewat' ? (
        <Lock className="size-4 shrink-0" />
      ) : (
        <AlarmClock className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        {tingkat === 'terlewat' && (
          <>
            <b>
              Shift {shift.nomor} tanggal {formatTanggal(shift.tanggalOperasional)} belum ditutup.
            </b>{' '}
            Penjualan dan pencatatan uang Anda terkunci sampai shift itu ditutup: hitung uang di
            laci, tutup shift, lalu buka shift baru untuk hari ini.
          </>
        )}
        {tingkat === 'lewat' && (
          <>
            <b>Sudah lewat jam tutup shift ({shift.jadwalTutup}).</b> Selesaikan transaksi yang
            sedang berjalan, lalu hitung uang di laci dan tutup shift {shift.nomor}. Admin/Owner
            sudah diberi tahu.
          </>
        )}
        {tingkat === 'segera' && (
          <>
            Shift dijadwalkan tutup pukul <b>{shift.jadwalTutup}</b> ({sisaMenit} menit lagi).
            Siapkan penutupan: selesaikan antrean dan hitung uang di laci.
          </>
        )}
      </span>
      {!diHalamanShift && (
        <Link
          to="/shift"
          className="shrink-0 rounded-md border border-current px-2 py-0.5 text-xs font-semibold hover:bg-white/60"
        >
          {tingkat === 'segera' ? 'Buka halaman shift' : 'Tutup shift sekarang'}
        </Link>
      )}
    </div>
  );
}
