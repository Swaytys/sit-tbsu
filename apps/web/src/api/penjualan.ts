import type { DataOrder, JenisPenjualan, StatusOrder } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/** Penjualan (Fase 5): order & antrean. */

export type ParamDaftarOrder = {
  cari: string;
  status: StatusOrder | 'AKTIF' | null;
  jenis: JenisPenjualan | null;
  milikSaya: boolean;
  halaman: number;
  perHalaman: number;
};

export function useDaftarOrder(p: ParamDaftarOrder, opsi: { segarkanTiap?: number } = {}) {
  return useQuery({
    queryKey: ['order', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.order.$get({
          query: {
            cari: p.cari || undefined,
            status: p.status ?? undefined,
            jenis: p.jenis ?? undefined,
            milikSaya: p.milikSaya ? 'true' : undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: opsi.segarkanTiap,
  });
}

export function useDetailOrder(id: number | null) {
  return useQuery({
    queryKey: ['order', 'detail', id],
    queryFn: async () => ambilData(await api.order[':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null,
  });
}

/** Perubahan order memengaruhi stok tersedia (reservasi), jadi barang & persediaan ikut dimuat ulang. */
function useMutasiOrder<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['order', 'barang', 'persediaan'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ),
  });
}

const param = (id: number) => ({ id: String(id) });

export function useSimpanOrder() {
  return useMutasiOrder(
    async ({ id, json, kirim }: { id?: number; json: DataOrder; kirim: boolean }) =>
      ambilData(
        id === undefined
          ? await api.order.$post({ query: { kirim: kirim ? 'true' : 'false' }, json })
          : await api.order[':id'].$put({ param: param(id), json }),
      ),
  );
}

export function useKirimOrder() {
  return useMutasiOrder(async (id: number) =>
    ambilData(await api.order[':id'].kirim.$post({ param: param(id) })),
  );
}

export function useProsesOrder() {
  return useMutasiOrder(async (id: number) =>
    ambilData(await api.order[':id'].proses.$post({ param: param(id) })),
  );
}

export function useLepasOrder() {
  return useMutasiOrder(async (id: number) =>
    ambilData(await api.order[':id'].lepas.$post({ param: param(id) })),
  );
}

export function useBatalOrder() {
  return useMutasiOrder(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(await api.order[':id'].batal.$post({ param: param(id), json: { alasan } })),
  );
}

export function useStokTertahan() {
  return useQuery({
    queryKey: ['persediaan', 'tertahan'],
    queryFn: async () => ambilData(await api.stok.tertahan.$get()),
  });
}
