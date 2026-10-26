import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { useSetelanInteraksi } from '@/api/interaksi';
import {
  catatInteraksi,
  hentikanPencatat,
  kirimAntrean,
  mulaiPencatat,
} from '@/lib/pencatat-interaksi';

// Preferensi tampilan (bukan data bisnis): pemberitahuan cukup sekali per sesi peramban.
const KUNCI_INFO = 'sit.infoLogInteraksi';

/**
 * K-190: menyalakan pencatat interaksi bila Owner mengaktifkannya, mencatat lama di tiap halaman, dan memberi tahu
 * pengguna (etika penelitian) bahwa pemakaiannya dicatat tanpa isi ketikan.
 */
export function PencatatInteraksi() {
  const setelan = useSetelanInteraksi().data;
  const lokasi = useLocation();
  const aktif = setelan?.aktif ?? false;
  const tingkat = setelan?.tingkat ?? 'SEMUA';

  useEffect(() => {
    if (!aktif) {
      hentikanPencatat();
      return;
    }
    mulaiPencatat(tingkat);
    try {
      if (sessionStorage.getItem(KUNCI_INFO) !== '1') {
        sessionStorage.setItem(KUNCI_INFO, '1');
        toast.info(
          'Pemakaian aplikasi (halaman, tombol yang diklik) dicatat untuk penelitian. Isi ketikan, password, dan nominal tidak dicatat.',
          { duration: 10_000 },
        );
      }
    } catch {
      // Penyimpanan diblokir: pemberitahuan bisa muncul lagi, tidak masalah.
    }
  }, [aktif, tingkat]);

  useEffect(() => () => hentikanPencatat(), []);

  // Lama di halaman: dicatat saat pindah halaman dan saat tab disembunyikan/ditutup.
  const mulai = useRef(0);
  useEffect(() => {
    if (!aktif) return;
    const halaman = lokasi.pathname;
    mulai.current = performance.now();
    const catatLama = () => {
      catatInteraksi('HALAMAN', {
        halaman,
        elemen: document.title,
        angka: performance.now() - mulai.current,
      });
      mulai.current = performance.now();
    };
    const padaTampil = () => {
      if (document.visibilityState === 'hidden') {
        catatLama();
        void kirimAntrean(true);
      } else {
        mulai.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', padaTampil);
    return () => {
      document.removeEventListener('visibilitychange', padaTampil);
      if (document.visibilityState === 'visible') catatLama();
    };
  }, [aktif, lokasi.pathname]);

  return null;
}
