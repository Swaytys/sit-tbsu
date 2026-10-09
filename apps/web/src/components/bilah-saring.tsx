import type { StatusAktif } from '@sit/shared';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SaringStatus = StatusAktif | 'SEMUA';

/**
 * Bilah di atas tabel data master: kotak cari, saring status, dan isi tambahan di kanan. Kotak cari selalu
 * selebar tetap (tidak terdesak saringan); saringan yang banyak turun ke baris berikutnya.
 */
export function BilahSaring({
  cari,
  onCari,
  status,
  onStatus,
  placeholder,
  label,
  tampilStatus = true,
  children,
}: {
  cari: string;
  onCari: (cari: string) => void;
  status: SaringStatus;
  onStatus: (status: SaringStatus) => void;
  placeholder: string;
  /** Nama aksesibel kotak cari, mis. "Cari pelanggan". */
  label: string;
  /** Saring status ditampilkan (halaman dengan pilihan saringan bisa menyembunyikannya). */
  tampilStatus?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b p-3">
      <div className="relative w-80 max-w-full shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          value={cari}
          onChange={(e) => onCari(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
          aria-label={label}
        />
      </div>
      {tampilStatus && (
        <Select value={status} onValueChange={(v) => onStatus(v as SaringStatus)}>
          <SelectTrigger className="w-40" aria-label="Saring status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua status</SelectItem>
            <SelectItem value="AKTIF">Aktif</SelectItem>
            <SelectItem value="NONAKTIF">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      )}
      {children}
    </div>
  );
}
