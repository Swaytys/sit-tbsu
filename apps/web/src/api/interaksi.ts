import type { JenisInteraksi, SetelanInteraksi } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/** K-190: log interaksi penelitian. */

export function useSetelanInteraksi(aktifkan = true) {
  return useQuery({
    queryKey: ['interaksi', 'setelan'],
    queryFn: async () => ambilData(await api['log-interaksi'].setelan.$get()),
    enabled: aktifkan,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useRingkasanInteraksi() {
  return useQuery({
    queryKey: ['interaksi', 'ringkasan'],
    queryFn: async () => ambilData(await api['log-interaksi'].ringkasan.$get()),
  });
}

export function useUbahSetelanInteraksi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: SetelanInteraksi) =>
      ambilData(await api['log-interaksi'].setelan.$put({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interaksi'] }),
  });
}

export type SaringInteraksiWeb = {
  jenis?: JenisInteraksi | undefined;
  lokasi?: string;
  idPengguna?: number | undefined;
  dari?: string;
  sampai?: string;
};

export function useDaftarInteraksi(
  p: SaringInteraksiWeb & { halaman: number; perHalaman: number },
) {
  return useQuery({
    queryKey: ['interaksi', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api['log-interaksi'].$get({
          query: {
            jenis: p.jenis,
            lokasi: p.lokasi || undefined,
            idPengguna: p.idPengguna ? String(p.idPengguna) : undefined,
            dari: p.dari || undefined,
            sampai: p.sampai || undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}
