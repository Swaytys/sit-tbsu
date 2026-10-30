import {
  useCallback,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react';

/*
 * K-202: isian cari dan saringan halaman daftar diingat selama aplikasi terbuka, supaya kembali dari halaman ubah atau
 * detail (mis. Data Barang dicari "semen" → ubah barang → simpan) daftar tetap seperti sebelumnya. Klik menu di
 * sidebar = mulai dari awal (semua ingatan dihapus, juga untuk halaman yang sedang terbuka). Hanya di memori (bukan
 * data bisnis; hilang saat muat ulang).
 */

const simpanan = new Map<string, unknown>();
let generasi = 0;
const pendengar = new Set<() => void>();

/** Dipanggil saat pengguna membuka halaman lewat menu: semua saringan kembali ke awal. */
export function lupakanSaring(): void {
  simpanan.clear();
  generasi += 1;
  for (const f of pendengar) f();
}

function dengar(f: () => void) {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

/** Seperti `useState`, tetapi nilainya diingat per `kunci` (unik per halaman, mis. "barang.status"). */
export function useIngat<T>(kunci: string, awal: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const nilaiAwal = () => (typeof awal === 'function' ? (awal as () => T)() : awal);
  const gen = useSyncExternalStore(dengar, () => generasi);
  const [nilai, setNilai] = useState<T>(() =>
    simpanan.has(kunci) ? (simpanan.get(kunci) as T) : nilaiAwal(),
  );
  // Menu diklik saat halaman ini terbuka: kembali ke nilai awal (pola "state turunan", tanpa effect).
  const [genDipakai, setGenDipakai] = useState(gen);
  if (genDipakai !== gen) {
    setGenDipakai(gen);
    setNilai(nilaiAwal());
  }
  const atur = useCallback<Dispatch<SetStateAction<T>>>(
    (v) =>
      setNilai((lama) => {
        const baru = typeof v === 'function' ? (v as (l: T) => T)(lama) : v;
        simpanan.set(kunci, baru);
        return baru;
      }),
    [kunci],
  );
  return [nilai, atur];
}
