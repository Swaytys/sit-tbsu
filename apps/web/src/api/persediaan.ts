import type { DataPenerimaan, JenisPenerimaan } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/** Persediaan (Fase 4): penerimaan barang, penyesuaian, posisi dan kartu stok. */

export type ParamDaftarPenerimaan = {
  cari: string;
  jenis: JenisPenerimaan | null;
  dari: string;
  sampai: string;
  halaman: number;
  perHalaman: number;
};

export function useDaftarPenerimaan(p: ParamDaftarPenerimaan) {
  return useQuery({
    queryKey: ['penerimaan', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.penerimaan.$get({
          query: {
            cari: p.cari || undefined,
            jenis: p.jenis ?? undefined,
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

export function useDetailPenerimaan(id: number) {
  return useQuery({
    queryKey: ['penerimaan', 'detail', id],
    queryFn: async () => ambilData(await api.penerimaan[':id'].$get({ param: { id: String(id) } })),
  });
}

/** Menyimpan penerimaan; stok dan harga barang ikut berubah, jadi daftar barang dimuat ulang. */
export function useSimpanPenerimaan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: DataPenerimaan) => ambilData(await api.penerimaan.$post({ json })),
    onSuccess: () =>
      Promise.all(
        ['penerimaan', 'barang', 'persediaan'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ),
  });
}
