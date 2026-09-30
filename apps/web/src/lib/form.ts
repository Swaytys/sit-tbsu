import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { GalatApi, pesanGalat } from '@/api/client';

/**
 * Menampilkan galat dari API pada form: pesan per kolom (dari validasi server) ditempel ke kolomnya,
 * selebihnya tampil sebagai toast. Pesan validasi klien dan server sama karena skema Zod-nya sama.
 */
export function tampilkanGalatForm<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  kolomDikenal: readonly Path<T>[],
): void {
  if (err instanceof GalatApi) {
    let ditempel = false;
    for (const [kolom, pesan] of Object.entries(err.kolom)) {
      const nama = kolomDikenal.find((k) => k === kolom);
      if (nama && pesan[0]) {
        setError(nama, { type: 'server', message: pesan[0] });
        ditempel = true;
      }
    }
    if (ditempel) return;
  }
  toast.error(pesanGalat(err));
}
