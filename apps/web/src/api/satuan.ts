import { useQuery } from '@tanstack/react-query';
import { ambilData, api } from './client';

export const kunciSatuan = {
  daftar: ['satuan', 'daftar'] as const,
};

/** Daftar satuan dari `GET /api/satuan`. */
export function useDaftarSatuan() {
  return useQuery({
    queryKey: kunciSatuan.daftar,
    queryFn: async () => ambilData(await api.satuan.$get()),
  });
}
