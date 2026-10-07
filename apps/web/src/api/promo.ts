import type { DataPromo, StatusAktif, StatusBerlakuPromo } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/** Master promo (docs/06 §3, Fase 9). */

export type ParamDaftarPromo = {
  cari: string;
  status: StatusAktif | 'SEMUA';
  berlaku: StatusBerlakuPromo | null;
  halaman: number;
  perHalaman: number;
};

export function useDaftarPromo(p: ParamDaftarPromo) {
  return useQuery({
    queryKey: ['promo', p],
    queryFn: async () =>
      ambilIsi(
        await api.promo.$get({
          query: {
            cari: p.cari || undefined,
            status: p.status,
            berlaku: p.berlaku ?? undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

function useMutasiPromo<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Promo memengaruhi pratinjau harga order/kasir yang sedang terbuka.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['promo'] }),
        qc.invalidateQueries({ queryKey: ['pratinjau-order'] }),
      ]),
  });
}

const param = (id: number) => ({ id: String(id) });

export function useSimpanPromo() {
  return useMutasiPromo(async ({ id, json }: { id?: number; json: DataPromo }) =>
    ambilData(
      id === undefined
        ? await api.promo.$post({ json })
        : await api.promo[':id'].$patch({ param: param(id), json }),
    ),
  );
}

export function useStatusPromo() {
  return useMutasiPromo(async ({ id, statusAktif }: { id: number; statusAktif: StatusAktif }) =>
    ambilData(await api.promo[':id'].status.$patch({ param: param(id), json: { statusAktif } })),
  );
}
