import type { StatusAktif } from '@sit/shared';
import { MoreHorizontal, Pencil, Power, PowerOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Menu aksi baris data master: ubah dan nonaktifkan/aktifkan kembali. Data master tidak dihapus
 * (CLAUDE.md aturan 4), jadi tidak ada aksi hapus.
 */
export function MenuAksiMaster({
  nama,
  status,
  onUbah,
  onUbahStatus,
  tambahan,
}: {
  nama: string;
  status: StatusAktif;
  onUbah: () => void;
  onUbahStatus: (status: StatusAktif) => void;
  tambahan?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${nama}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onUbah}>
          <Pencil /> Ubah
        </DropdownMenuItem>
        {tambahan}
        <DropdownMenuSeparator />
        {status === 'AKTIF' ? (
          <DropdownMenuItem variant="destructive" onSelect={() => onUbahStatus('NONAKTIF')}>
            <PowerOff /> Nonaktifkan
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onUbahStatus('AKTIF')}>
            <Power /> Aktifkan kembali
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
