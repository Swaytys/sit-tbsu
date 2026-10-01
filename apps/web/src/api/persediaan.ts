import type {
  DataPenerimaan,
  DataPenyesuaian,
  DetailPenyesuaian,
  JenisPenerimaan,
  JenisPenyesuaian,
  StatusPenyesuaian,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, galatDariRespons } from './client';

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

// --- Penyesuaian stok ---

export type ParamDaftarPenyesuaian = {
  cari: string;
  jenis: JenisPenyesuaian | null;
  status: StatusPenyesuaian | null;
  halaman: number;
  perHalaman: number;
};

export function useDaftarPenyesuaian(p: ParamDaftarPenyesuaian) {
  return useQuery({
    queryKey: ['penyesuaian', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.penyesuaian.$get({
          query: {
            cari: p.cari || undefined,
            jenis: p.jenis ?? undefined,
            status: p.status ?? undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailPenyesuaian(id: number | null) {
  return useQuery({
    queryKey: ['penyesuaian', 'detail', id],
    queryFn: async () =>
      ambilData(await api.penyesuaian[':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null,
  });
}

/** Mutasi penyesuaian memuat ulang daftar penyesuaian, barang (stok), dan persediaan. */
function useMutasiPersediaan<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['penyesuaian', 'barang', 'persediaan'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ),
  });
}

const param = (id: number) => ({ id: String(id) });

export function useSimpanPenyesuaian() {
  return useMutasiPersediaan(async ({ id, json }: { id?: number; json: DataPenyesuaian }) =>
    ambilData(
      id === undefined
        ? await api.penyesuaian.$post({ json })
        : await api.penyesuaian[':id'].$put({ param: param(id), json }),
    ),
  );
}

export function useSelesaikanPenyesuaian() {
  return useMutasiPersediaan(async (id: number) =>
    ambilData(await api.penyesuaian[':id'].selesai.$post({ param: param(id) })),
  );
}

export function useBatalkanPenyesuaian() {
  return useMutasiPersediaan(async (id: number) =>
    ambilData(await api.penyesuaian[':id'].batal.$post({ param: param(id) })),
  );
}

export function useBuatLembarOpname() {
  return useMutasiPersediaan(async (json: { idKategori: number | null }) =>
    ambilData(await api.penyesuaian['lembar-opname'].$post({ json })),
  );
}

export function useImporSaldoAwal() {
  return useMutasiPersediaan(async (berkas: File): Promise<DetailPenyesuaian> => {
    const form = new FormData();
    form.set('berkas', berkas);
    const res = await fetch('/api/penyesuaian/saldo-awal/impor', { method: 'POST', body: form });
    if (!res.ok) throw await galatDariRespons(res);
    return ((await res.json()) as { data: DetailPenyesuaian }).data;
  });
}
