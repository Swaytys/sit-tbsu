import type { KodeTur } from '@sit/shared';
import { createContext, useContext } from 'react';
import type { Tur } from './daftar-tur';

/** K-206: akses tur dari halaman mana pun (mulai tur, daftar tur sesuai peran). */
export type NilaiTur = {
  mulai: (kode: KodeTur) => void;
  turYangBoleh: Tur[];
};

export const KonteksTur = createContext<NilaiTur | null>(null);

export function useTur(): NilaiTur {
  const k = useContext(KonteksTur);
  if (!k) throw new Error('useTur() dipakai di luar PenyediaTur');
  return k;
}
