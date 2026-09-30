import { useEffect, useState } from 'react';

/** Nilai yang baru diperbarui setelah `ms` milidetik tanpa perubahan (mis. kotak pencarian). */
export function useTunda<T>(nilai: T, ms: number): T {
  const [tertunda, setTertunda] = useState(nilai);
  useEffect(() => {
    const penunda = setTimeout(() => setTertunda(nilai), ms);
    return () => clearTimeout(penunda);
  }, [nilai, ms]);
  return tertunda;
}
