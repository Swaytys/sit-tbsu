import type { DataJenisAtribut, DataKategori, DataSatuan, StatusAktif } from '@sit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, api } from './client';

/** Data referensi master: kategori, satuan, jenis atribut (Fase 3). */

export type SaringStatus = StatusAktif | 'SEMUA';

export const kunciReferensi = {
  kategori: (status: SaringStatus) => ['kategori', status] as const,
  satuan: (status: SaringStatus) => ['satuan', status] as const,
  jenisAtribut: (status: SaringStatus) => ['jenis-atribut', status] as const,
};

export function useDaftarKategori(status: SaringStatus = 'SEMUA') {
  return useQuery({
    queryKey: kunciReferensi.kategori(status),
    queryFn: async () => ambilData(await api.kategori.$get({ query: { status } })),
  });
}

export function useDaftarSatuan(status: SaringStatus = 'SEMUA') {
  return useQuery({
    queryKey: kunciReferensi.satuan(status),
    queryFn: async () => ambilData(await api.satuan.$get({ query: { status } })),
  });
}

export function useDaftarJenisAtribut(status: SaringStatus = 'SEMUA') {
  return useQuery({
    queryKey: kunciReferensi.jenisAtribut(status),
    queryFn: async () => ambilData(await api['jenis-atribut'].$get({ query: { status } })),
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

export function useSimpanKategori() {
  return useMutasi('kategori', async ({ id, json }: Simpan<DataKategori>) =>
    ambilData(
      id === undefined
        ? await api.kategori.$post({ json })
        : await api.kategori[':id'].$patch({ param: param(id), json }),
    ),
  );
}

export function useStatusKategori() {
  return useMutasi('kategori', async ({ id, statusAktif }: Status) =>
    ambilData(await api.kategori[':id'].status.$patch({ param: param(id), json: { statusAktif } })),
  );
}

export function useSimpanSatuan() {
  return useMutasi('satuan', async ({ id, json }: Simpan<DataSatuan>) =>
    ambilData(
      id === undefined
        ? await api.satuan.$post({ json })
        : await api.satuan[':id'].$patch({ param: param(id), json }),
    ),
  );
}

export function useStatusSatuan() {
  return useMutasi('satuan', async ({ id, statusAktif }: Status) =>
    ambilData(await api.satuan[':id'].status.$patch({ param: param(id), json: { statusAktif } })),
  );
}

export function useSimpanJenisAtribut() {
  return useMutasi('jenis-atribut', async ({ id, json }: Simpan<DataJenisAtribut>) =>
    ambilData(
      id === undefined
        ? await api['jenis-atribut'].$post({ json })
        : await api['jenis-atribut'][':id'].$patch({ param: param(id), json }),
    ),
  );
}

export function useStatusJenisAtribut() {
  return useMutasi('jenis-atribut', async ({ id, statusAktif }: Status) =>
    ambilData(
      await api['jenis-atribut'][':id'].status.$patch({ param: param(id), json: { statusAktif } }),
    ),
  );
}
