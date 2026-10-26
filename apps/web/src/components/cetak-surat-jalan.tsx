import { ukuranKertasCss, type BarisSuratJalan } from '@sit/shared';
import { useEffect } from 'react';
import { useTampilanToko } from '@/api/pengaturan';
import { AreaCetak } from './area-cetak';
import { SuratJalanA4 } from './dokumen-a4';

/**
 * K-124/K-174: mencetak satu atau beberapa surat jalan sekaligus (mis. semua surat jalan satu rit saat berangkat),
 * kertas sesuai Pengaturan, tiap surat jalan mulai di halaman baru. `judulBerkas` menjadi nama berkas bawaan saat
 * pengguna memilih "Simpan sebagai PDF" di jendela cetak. `onSelesai` dipanggil setelah jendela cetak ditutup.
 */
export function CetakSuratJalan({
  daftar,
  judulBerkas,
  onSelesai,
}: {
  daftar: BarisSuratJalan[];
  judulBerkas?: string;
  onSelesai: () => void;
}) {
  const toko = useTampilanToko().data;
  useEffect(() => {
    if (!toko) return;
    const judulLama = document.title;
    if (judulBerkas) document.title = judulBerkas;
    const t = setTimeout(() => {
      window.print();
      document.title = judulLama;
      onSelesai();
    }, 150);
    return () => {
      clearTimeout(t);
      document.title = judulLama;
    };
  }, [toko, judulBerkas, onSelesai]);
  if (!toko) return null;
  return (
    <AreaCetak ukuranKertas={ukuranKertasCss(toko.kertasSuratJalan)}>
      {daftar.map((sj, i) => (
        <div key={sj.id} className={i < daftar.length - 1 ? 'break-after-page' : undefined}>
          <SuratJalanA4 sj={sj} toko={toko} />
        </div>
      ))}
    </AreaCetak>
  );
}
