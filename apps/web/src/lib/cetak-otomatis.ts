import type { StrukCetak } from '@sit/shared';
import { toast } from 'sonner';

/**
 * K-124: setelah invoice pengantaran atau surat jalan dibuat, cetak menurut Pengaturan › Dokumen & kertas:
 * OTOMATIS = langsung dicetak; TANYA = pemberitahuan dengan tombol Cetak (tidak menghalangi layar);
 * TIDAK = tidak dicetak (tetap bisa dicetak dari tombol/halaman detail).
 */
export function cetakMenurutSetelan(
  mode: StrukCetak | undefined,
  dokumen: string,
  cetak: () => void,
): void {
  if (mode === 'OTOMATIS') cetak();
  else if (mode === 'TANYA') {
    toast(`Cetak ${dokumen} sekarang?`, {
      duration: 15000,
      action: { label: 'Cetak', onClick: cetak },
    });
  }
}
