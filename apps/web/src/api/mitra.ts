import type { DataPelanggan, DataPemasok, StatusAktif } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/** Mitra: pelanggan dan pemasok (Fase 3), serta daftar tingkat harga untuk pilihan tier. */

export type ParamDaftarMitra = {
  cari: string;
  status: StatusAktif | 'SEMUA';
  halaman: number;
  perHalaman: number;
};

const query = (p: ParamDaftarMitra) => ({
  cari: p.cari || undefined,
  status: p.status,
  halaman: String(p.halaman),
  perHalaman: String(p.perHalaman),
});

export function useDaftarPelanggan(p: ParamDaftarMitra) {
  return useQuery({
    queryKey: ['pelanggan', p],
    queryFn: async () => ambilIsi(await api.pelanggan.$get({ query: query(p) })),
    placeholderData: keepPreviousData,
  });
}

export function useDaftarPemasok(p: ParamDaftarMitra) {
  return useQuery({
    queryKey: ['pemasok', p],
    queryFn: async () => ambilIsi(await api.pemasok.$get({ query: query(p) })),
    placeholderData: keepPreviousData,
  });
}

export function useDaftarTingkatHarga() {
  return useQuery({
    queryKey: ['tingkat-harga'],
    queryFn: async () => ambilData(await api['tingkat-harga'].$get()),
    staleTime: 5 * 60_000,
  });
}

/** Mutasi yang memuat ulang semua daftar dengan awalan kunci `akar` setelah berhasil. */
function useMutasi<TInput, THasil>(akar: string, fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: [akar] }),
  });
}

type Simpan<T> = { id?: number; json: T };
type Status = { id: number; statusAktif: StatusAktif };
const param = (id: number) => ({ id: String(id) });

export function useSimpanPelanggan() {
  return useMutasi('pelanggan', async ({ id, json }: Simpan<DataPelanggan>) =>
    ambilData(
      id === undefined
        ? await api.pelanggan.$post({ json })
        : await api.pelanggan[':id'].$patch({ param: param(id), json }),
    ),
  );
}

export function useStatusPelanggan() {
  return useMutasi('pelanggan', async ({ id, statusAktif }: Status) =>
    ambilData(
      await api.pelanggan[':id'].status.$patch({ param: param(id), json: { statusAktif } }),
    ),
  );
}

export function useSimpanPemasok() {
  return useMutasi('pemasok', async ({ id, json }: Simpan<DataPemasok>) =>
    ambilData(
      id === undefined
        ? await api.pemasok.$post({ json })
        : await api.pemasok[':id'].$patch({ param: param(id), json }),
    ),
  );
}

export function useStatusPemasok() {
  return useMutasi('pemasok', async ({ id, statusAktif }: Status) =>
    ambilData(await api.pemasok[':id'].status.$patch({ param: param(id), json: { statusAktif } })),
  );
}
