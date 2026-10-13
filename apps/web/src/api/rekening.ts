import type {
  DataRekening,
  DataVerifikasiPembayaran,
  StatusAktif,
  StatusVerifikasi,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, paramId } from './client';

/*
 * Rekening toko (tujuan pembayaran non-tunai) dan pengecekan uang masuk non-tunai (K-111).
 */

/** Daftar rekening toko. Layar kasir memakai yang AKTIF; pengelola pengaturan bisa melihat SEMUA. */
export function useDaftarRekening(status: StatusAktif | 'SEMUA' = 'AKTIF', aktif = true) {
  return useQuery({
    queryKey: ['rekening', status],
    queryFn: async () => ambilData(await api.rekening.$get({ query: { status } })),
    enabled: aktif,
    staleTime: 60_000,
  });
}

function useMutasiRekening<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rekening'] }),
  });
}

export function useSimpanRekening() {
  return useMutasiRekening(async ({ id, json }: { id?: number | undefined; json: DataRekening }) =>
    ambilData(
      id === undefined
        ? await api.rekening.$post({ json })
        : await api.rekening[':id'].$patch({ param: paramId(id), json }),
    ),
  );
}

export function useStatusRekening() {
  return useMutasiRekening(async ({ id, statusAktif }: { id: number; statusAktif: StatusAktif }) =>
    ambilData(
      await api.rekening[':id'].status.$patch({ param: paramId(id), json: { statusAktif } }),
    ),
  );
}

export type ParamNonTunai = {
  status: StatusVerifikasi | null;
  idRekening: number | null;
  dari: string;
  sampai: string;
  cari: string;
  halaman: number;
  perHalaman: number;
};

export function useDaftarNonTunai(p: ParamNonTunai, aktif = true) {
  return useQuery({
    queryKey: ['nontunai', p],
    queryFn: async () =>
      ambilIsi(
        await api['pembayaran-nontunai'].$get({
          query: {
            status: p.status ?? undefined,
            idRekening: p.idRekening === null ? undefined : String(p.idRekening),
            dari: p.dari || undefined,
            sampai: p.sampai || undefined,
            cari: p.cari || undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    enabled: aktif,
    placeholderData: keepPreviousData,
  });
}

export function useVerifikasiNonTunai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, json }: { id: number; json: DataVerifikasiPembayaran }) =>
      ambilData(
        await api['pembayaran-nontunai'][':id'].verifikasi.$post({ param: paramId(id), json }),
      ),
    onSuccess: () =>
      Promise.all(
        ['nontunai', 'notifikasi', 'penjualan'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ),
  });
}
