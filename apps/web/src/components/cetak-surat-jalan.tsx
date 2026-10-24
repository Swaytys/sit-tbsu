import { ukuranKertasCss, type BarisSuratJalan } from '@sit/shared';
import { useEffect } from 'react';
import { useTampilanToko } from '@/api/pengaturan';
import { AreaCetak } from './area-cetak';
import { SuratJalanA4 } from './dokumen-a4';

/**
 * K-124: mencetak satu surat jalan sekali (kertas sesuai Pengaturan), untuk halaman yang tidak punya area
 * cetaknya sendiri (papan Pengiriman). `onSelesai` dipanggil setelah jendela cetak ditutup.
 */
export function CetakSuratJalan({ sj, onSelesai }: { sj: BarisSuratJalan; onSelesai: () => void }) {
  const toko = useTampilanToko().data;
  useEffect(() => {
    if (!toko) return;
    const t = setTimeout(() => {
      window.print();
      onSelesai();
    }, 150);
    return () => clearTimeout(t);
  }, [toko, onSelesai]);
  if (!toko) return null;
  return (
    <AreaCetak ukuranKertas={ukuranKertasCss(toko.kertasSuratJalan)}>
      <SuratJalanA4 sj={sj} toko={toko} />
    </AreaCetak>
  );
}
