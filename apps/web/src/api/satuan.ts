import { useQuery } from '@tanstack/react-query';
import { api, galatDariRespons } from './client';

export const kunciSatuan = {
  daftar: ['satuan', 'daftar'] as const,
};

/** Daftar satuan dari `GET /api/satuan`. */
export function useDaftarSatuan() {
  return useQuery({
    queryKey: kunciSatuan.daftar,
    queryFn: async () => {
      const res = await api.satuan.$get();
      if (!res.ok) throw await galatDariRespons(res);
      const body = await res.json();
      return body.data;
    },
  });
}
