import { pintasanLengkap, type AksiPintasan, type PintasanPengguna } from '@sit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, api } from './client';

/** K-145: tombol pintasan pengguna yang sedang masuk (ubahan + bawaan). */
const kunci = ['pintasan'] as const;

export function usePintasanPengguna() {
  return useQuery({
    queryKey: kunci,
    queryFn: async (): Promise<PintasanPengguna> => ambilData(await api.auth.pintasan.$get()),
    staleTime: 5 * 60_000,
  });
}

/** Semua aksi dengan tombolnya; selama memuat memakai bawaan. */
export function usePintasan(): Record<AksiPintasan, string> {
  return pintasanLengkap(usePintasanPengguna().data);
}

export function useSimpanPintasan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: PintasanPengguna) => ambilData(await api.auth.pintasan.$put({ json })),
    onSuccess: (data) => qc.setQueryData(kunci, data),
  });
}
