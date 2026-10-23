import { useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Kata cari halaman daftar yang bisa diisi dari alamat (`?cari=…`, dipakai pencarian universal K-167). Bila
 * `?cari=` berubah saat halaman sudah terbuka, isinya ikut diganti (pola "state turunan" React, tanpa effect).
 */
export function useCariUrl(): [string, (v: string) => void] {
  const [url] = useSearchParams();
  const dariUrl = url.get('cari') ?? '';
  const [cari, setCari] = useState(dariUrl);
  const [terakhir, setTerakhir] = useState(dariUrl);
  if (dariUrl !== terakhir) {
    setTerakhir(dariUrl);
    setCari(dariUrl);
  }
  return [cari, setCari];
}
