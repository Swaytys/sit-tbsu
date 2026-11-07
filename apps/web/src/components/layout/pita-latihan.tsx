import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router';
import { useSaya, useStatusPenyiapan } from '@/api/auth';

/**
 * K-168: pita MODE LATIHAN selama data latihan dipakai, agar tidak ada yang mengira transaksi latihan adalah
 * transaksi sungguhan. Owner mendapat tautan kembali ke data toko asli (Pengaturan › Data toko).
 */
export function PitaLatihan() {
  const status = useStatusPenyiapan();
  const saya = useSaya();
  if (!status.data?.modeLatihan) return null;
  const owner = saya.data?.peran === 'OWNER';
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-violet-300 bg-violet-100 px-4 py-1.5 text-sm text-violet-900 print:hidden"
    >
      <GraduationCap className="size-4 shrink-0" />
      <b>MODE LATIHAN</b>
      <span className="min-w-0 flex-1">
        Data ini untuk berlatih, bukan data toko sungguhan. Transaksi di sini tidak memengaruhi data
        asli.
      </span>
      {owner && (
        <Link
          to="/pengaturan?tab=data"
          className="rounded border border-violet-400 bg-white px-2 py-0.5 text-xs font-medium hover:bg-violet-50"
        >
          Kembali ke data toko asli
        </Link>
      )}
    </div>
  );
}
