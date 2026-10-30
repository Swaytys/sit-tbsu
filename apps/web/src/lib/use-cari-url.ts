import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useIngat } from './ingat-saring';

/**
 * Kata cari halaman daftar yang bisa diisi dari alamat (`?cari=…`, dipakai pencarian universal K-167). Bila
 * `?cari=` berubah saat halaman sudah terbuka, isinya ikut diganti (pola "state turunan" React, tanpa effect).
 * K-202: tanpa `?cari=`, kata cari terakhir halaman ini diingat (`kunci`).
 */
export function useCariUrl(kunci: string): [string, (v: string) => void] {
  const [url] = useSearchParams();
  const dariUrl = url.get('cari');
  const [cari, setCari] = useIngat(`${kunci}.cari`, dariUrl ?? '');
  // `undefined` = belum pernah dibaca: `?cari=` saat halaman dibuka menang atas ingatan.
  const [terakhir, setTerakhir] = useState<string | null | undefined>(undefined);
  if (dariUrl !== terakhir) {
    setTerakhir(dariUrl);
    if (dariUrl !== null) setCari(dariUrl);
  }
  return [cari, setCari];
}
