import type {
  InputIzinAkun,
  InputPeranKustom,
  InputResetPassword,
  InputTambahPengguna,
  InputUbahPengguna,
  StatusAktif,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

export type ParamDaftarPengguna = {
  cari: string;
  status: StatusAktif | 'SEMUA';
  halaman: number;
  perHalaman: number;
};

export const kunciPengguna = {
  semua: ['pengguna'] as const,
  daftar: (p: ParamDaftarPengguna) => ['pengguna', 'daftar', p] as const,
};

export function useDaftarPengguna(p: ParamDaftarPengguna) {
  return useQuery({
    queryKey: kunciPengguna.daftar(p),
    queryFn: async () =>
      ambilIsi(
        await api.pengguna.$get({
          query: {
            cari: p.cari || undefined,
            status: p.status,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Semua mutasi pengguna memuat ulang daftar setelah berhasil. */
function useMutasiPengguna<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: kunciPengguna.semua }),
  });
}

export function useTambahPengguna() {
  return useMutasiPengguna(async (json: InputTambahPengguna) =>
    ambilData(await api.pengguna.$post({ json })),
  );
}

export function useUbahPengguna() {
  return useMutasiPengguna(async ({ id, json }: { id: number; json: InputUbahPengguna }) =>
    ambilData(await api.pengguna[':id'].$patch({ param: { id: String(id) }, json })),
  );
}

export function useNonaktifkanPengguna() {
  return useMutasiPengguna(async (id: number) =>
    ambilData(await api.pengguna[':id'].nonaktifkan.$post({ param: { id: String(id) } })),
  );
}

export function useAktifkanPengguna() {
  return useMutasiPengguna(async (id: number) =>
    ambilData(await api.pengguna[':id'].aktifkan.$post({ param: { id: String(id) } })),
  );
}

export function useResetPasswordPengguna() {
  return useMutasiPengguna(async ({ id, json }: { id: number; json: InputResetPassword }) =>
    ambilData(
      await api.pengguna[':id']['reset-password'].$post({ param: { id: String(id) }, json }),
    ),
  );
}

export function useCabutSesiPengguna() {
  return useMutasiPengguna(async (id: number) =>
    ambilData(await api.pengguna[':id']['cabut-sesi'].$post({ param: { id: String(id) } })),
  );
}

/* K-243: peran khusus dan izin per akun (hanya Owner yang mengubah). */

export function useDaftarPeranKustom(aktif = true) {
  return useQuery({
    queryKey: [...kunciPengguna.semua, 'peran-kustom'] as const,
    queryFn: async () => ambilData(await api.pengguna['peran-kustom'].$get()),
    enabled: aktif,
  });
}

export function useSimpanPeranKustom() {
  return useMutasiPengguna(async ({ id, json }: { id: number | null; json: InputPeranKustom }) =>
    id === null
      ? ambilData(await api.pengguna['peran-kustom'].$post({ json }))
      : ambilData(
          await api.pengguna['peran-kustom'][':id'].$patch({ param: { id: String(id) }, json }),
        ),
  );
}

export function useUbahStatusPeranKustom() {
  return useMutasiPengguna(async ({ id, statusAktif }: { id: number; statusAktif: StatusAktif }) =>
    ambilData(
      await api.pengguna['peran-kustom'][':id'].status.$patch({
        param: { id: String(id) },
        json: { statusAktif },
      }),
    ),
  );
}

export function useAturIzinAkun() {
  return useMutasiPengguna(async ({ id, json }: { id: number; json: InputIzinAkun }) =>
    ambilData(await api.pengguna[':id'].izin.$put({ param: { id: String(id) }, json })),
  );
}
