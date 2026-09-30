import { useState } from 'react';

/**
 * Pilihan kolom tabel yang ditampilkan ("atur kolom"). Disimpan di localStorage karena hanya preferensi
 * tampilan (CLAUDE.md: bukan data bisnis). Kolom baru yang belum pernah diatur tampil sesuai bawaan.
 */
export function useKolomTampil(nama: string, semua: string[], tersembunyiBawaan: string[] = []) {
  const kunci = `kolom-tampil:${nama}`;
  const [tersembunyi, setTersembunyi] = useState<Set<string>>(() => {
    try {
      const simpanan = localStorage.getItem(kunci);
      if (simpanan) return new Set(JSON.parse(simpanan) as string[]);
    } catch {
      // Penyimpanan browser tidak tersedia/rusak: pakai bawaan.
    }
    return new Set(tersembunyiBawaan);
  });

  return {
    tampil: (kolom: string) => !tersembunyi.has(kolom),
    alih: (kolom: string) => {
      const baru = new Set(tersembunyi);
      if (baru.has(kolom)) baru.delete(kolom);
      else baru.add(kolom);
      setTersembunyi(baru);
      try {
        localStorage.setItem(kunci, JSON.stringify([...baru].filter((k) => semua.includes(k))));
      } catch {
        // Abaikan: preferensi hanya berlaku sampai halaman dimuat ulang.
      }
    },
  };
}
