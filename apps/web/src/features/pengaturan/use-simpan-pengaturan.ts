import type { InputUbahPengaturan, Pengaturan } from '@sit/shared';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useUbahPengaturan } from '@/api/pengaturan';

/** Menyimpan sebagian pengaturan; mengembalikan pengaturan terbaru, atau null bila gagal (toast). */
export function useSimpanPengaturan() {
  const ubah = useUbahPengaturan();
  async function simpan(patch: InputUbahPengaturan): Promise<Pengaturan | null> {
    try {
      const hasil = await ubah.mutateAsync(patch);
      toast.success('Pengaturan disimpan.');
      return hasil;
    } catch (err) {
      toast.error(pesanGalat(err));
      return null;
    }
  }
  return simpan;
}
