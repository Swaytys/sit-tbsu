import type { DataPenyelesaianKonsinyasi } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/** Konsinyasi: posisi per pemasok penitip dan penyelesaian (setoran) KSG (Fase 11). */

export function useRingkasanKonsinyasi() {
  return useQuery({
    queryKey: ['konsinyasi', 'ringkasan'],
    queryFn: async () => ambilData(await api.konsinyasi.ringkasan.$get()),
  });
}

export function usePratinjauKonsinyasi(p: { idPemasok: number; periodeSelesai: string } | null) {
  return useQuery({
    queryKey: ['konsinyasi', 'pratinjau', p],
    queryFn: async () =>
      ambilData(
        await api.konsinyasi.pratinjau.$get({
          query: { idPemasok: String(p?.idPemasok ?? 0), periodeSelesai: p?.periodeSelesai ?? '' },
        }),
      ),
    enabled: p !== null,
    retry: false,
  });
}

export function useDaftarPenyelesaianKonsinyasi(p: {
  cari: string;
  idPemasok: number | null;
  halaman: number;
  perHalaman: number;
}) {
  return useQuery({
    queryKey: ['konsinyasi', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.konsinyasi.$get({
          query: {
            cari: p.cari || undefined,
            idPemasok: p.idPemasok === null ? undefined : String(p.idPemasok),
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailPenyelesaianKonsinyasi(id: number) {
  return useQuery({
    queryKey: ['konsinyasi', 'detail', id],
    queryFn: async () => ambilData(await api.konsinyasi[':id'].$get({ param: { id: String(id) } })),
  });
}

/** Menyimpan setoran membentuk hutang baru (Hutang Pemasok) dan mengubah ringkasan. */
export function useSelesaikanKonsinyasi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: DataPenyelesaianKonsinyasi) =>
      ambilData(await api.konsinyasi.$post({ json })),
    onSuccess: () =>
      Promise.all(['konsinyasi', 'hutang'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}
