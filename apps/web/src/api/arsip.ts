import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, api } from './client';

/** Arsip tahunan / tutup tahun (K-165, Owner). */

export function useDaftarTahunArsip() {
  return useQuery({
    queryKey: ['arsip'],
    queryFn: async () => ambilData(await api.arsip.$get()),
  });
}

function useMutasiArsip<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arsip'] }),
  });
}

const param = (tahun: number) => ({ tahun: String(tahun) });

export function useTutupTahun() {
  return useMutasiArsip(async (tahun: number) =>
    ambilData(await api.arsip[':tahun'].tutup.$post({ param: param(tahun) })),
  );
}

export function useBukaTahun() {
  return useMutasiArsip(async ({ tahun, alasan }: { tahun: number; alasan: string }) =>
    ambilData(await api.arsip[':tahun'].buka.$post({ param: param(tahun), json: { alasan } })),
  );
}

export function usePeriksaArsip() {
  return useMutation({
    mutationFn: async (tahun: number) =>
      ambilData(await api.arsip[':tahun'].periksa.$post({ param: param(tahun) })),
  });
}
