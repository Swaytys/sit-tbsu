import type {
  DataGolonganPelanggan,
  DataKodePersetujuan,
  DataMintaKodePelanggan,
  DataPelanggan,
  DataPemasok,
  StatusAktif,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, paramId } from './client';

/** Mitra: pelanggan, golongan pelanggan (K-097), dan pemasok (Fase 3), serta daftar tingkat harga. */

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

/** Term dan limit kredit bawaan pelanggan baru (K-104); dimuat saat form tambah pelanggan dibuka. */
export function useBawaanPelanggan(aktif: boolean) {
  return useQuery({
    queryKey: ['pelanggan', 'bawaan'],
    queryFn: async () => ambilData(await api.pelanggan.bawaan.$get()),
    enabled: aktif,
    staleTime: 0,
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

/** `kodeAtasan`: kode sekali pakai dari Admin/Owner, wajib bila pengubahnya tanpa izin atur kredit (K-107). */
type KodeAtasan = { kodeAtasan?: DataKodePersetujuan | null };

export function useSimpanPelanggan() {
  return useMutasi(
    'pelanggan',
    async ({ id, json, kodeAtasan }: Simpan<DataPelanggan> & KodeAtasan) =>
      ambilData(
        id === undefined
          ? await api.pelanggan.$post({ json })
          : await api.pelanggan[':id'].$patch({
              param: paramId(id),
              json: { ...json, kodeAtasan: kodeAtasan ?? null },
            }),
      ),
  );
}

export function useStatusPelanggan() {
  return useMutasi('pelanggan', async ({ id, statusAktif, kodeAtasan }: Status & KodeAtasan) =>
    ambilData(
      await api.pelanggan[':id'].status.$patch({
        param: paramId(id),
        json: { statusAktif, kodeAtasan: kodeAtasan ?? null },
      }),
    ),
  );
}

/** Meminta kode sekali pakai ke Admin/Owner untuk satu perubahan data/status pelanggan (K-107). */
export function useMintaKodePelanggan() {
  return useMutation({
    mutationFn: async ({ id, json }: { id: number; json: DataMintaKodePelanggan }) =>
      ambilData(await api.pelanggan[':id']['minta-kode'].$post({ param: paramId(id), json })),
  });
}

export function useSimpanPemasok() {
  return useMutasi('pemasok', async ({ id, json }: Simpan<DataPemasok>) =>
    ambilData(
      id === undefined
        ? await api.pemasok.$post({ json })
        : await api.pemasok[':id'].$patch({ param: paramId(id), json }),
    ),
  );
}

export function useStatusPemasok() {
  return useMutasi('pemasok', async ({ id, statusAktif }: Status) =>
    ambilData(
      await api.pemasok[':id'].status.$patch({ param: paramId(id), json: { statusAktif } }),
    ),
  );
}

// --- Golongan pelanggan (K-097: sasaran promo) ---

export function useDaftarGolongan(status: StatusAktif | 'SEMUA' = 'SEMUA') {
  return useQuery({
    queryKey: ['golongan-pelanggan', status],
    queryFn: async () => ambilData(await api['golongan-pelanggan'].$get({ query: { status } })),
  });
}

export function useSimpanGolongan() {
  return useMutasi('golongan-pelanggan', async ({ id, json }: Simpan<DataGolonganPelanggan>) =>
    ambilData(
      id === undefined
        ? await api['golongan-pelanggan'].$post({ json })
        : await api['golongan-pelanggan'][':id'].$patch({ param: paramId(id), json }),
    ),
  );
}

export function useStatusGolongan() {
  return useMutasi('golongan-pelanggan', async ({ id, statusAktif }: Status) =>
    ambilData(
      await api['golongan-pelanggan'][':id'].status.$patch({
        param: paramId(id),
        json: { statusAktif },
      }),
    ),
  );
}
