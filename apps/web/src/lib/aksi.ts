import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';

/** Menjalankan aksi singkat (mis. ubah status) dengan toast berhasil/gagal. */
export async function jalankanDenganToast(
  aksi: Promise<unknown>,
  pesanBerhasil: string,
): Promise<boolean> {
  try {
    await aksi;
    toast.success(pesanBerhasil);
    return true;
  } catch (err) {
    toast.error(pesanGalat(err));
    return false;
  }
}
