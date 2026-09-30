import type { AksiLog, InputUbahPengaturan } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

export const kunciPengaturan = {
  semua: ['pengaturan'] as const,
  log: (p: ParamDaftarLog) => ['log-aktivitas', p] as const,
};

export function usePengaturan() {
  return useQuery({
    queryKey: kunciPengaturan.semua,
    queryFn: async () => ambilData(await api.pengaturan.$get()),
  });
}

export function useUbahPengaturan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: InputUbahPengaturan) =>
      ambilData(await api.pengaturan.$patch({ json })),
    onSuccess: (data) => {
      qc.setQueryData(kunciPengaturan.semua, data);
      void qc.invalidateQueries({ queryKey: ['log-aktivitas'] });
    },
  });
}

export type ParamDaftarLog = {
  cari: string;
  aksi: AksiLog | '';
  halaman: number;
  perHalaman: number;
};

export function useDaftarLog(p: ParamDaftarLog) {
  return useQuery({
    queryKey: kunciPengaturan.log(p),
    queryFn: async () =>
      ambilIsi(
        await api['log-aktivitas'].$get({
          query: {
            cari: p.cari || undefined,
            aksi: p.aksi || undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}
