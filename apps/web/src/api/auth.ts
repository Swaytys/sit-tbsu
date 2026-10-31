import type {
  InputGantiPassword,
  InputLogin,
  InputPulihkanPassword,
  InputResetLewatEmail,
  InputSetupAwal,
  KodeTur,
  PenggunaSaya,
  StatusPenyiapan,
  StatusTur,
} from '@sit/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ambilData, api, GalatApi } from './client';

export const kunciAuth = {
  saya: ['auth', 'saya'] as const,
};

/** Pengguna yang sedang login; `null` bila belum login atau sesi berakhir. */
export function useSaya() {
  return useQuery({
    queryKey: kunciAuth.saya,
    queryFn: async (): Promise<PenggunaSaya | null> => {
      try {
        return await ambilData(await api.auth.saya.$get());
      } catch (err) {
        if (err instanceof GalatApi && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Data pengguna login. Hanya dipakai di dalam rute yang dijaga `WajibLogin`. */
export function usePengguna(): PenggunaSaya {
  const { data } = useSaya();
  if (!data) throw new Error('usePengguna() dipakai di luar rute yang dijaga WajibLogin');
  return data;
}

/**
 * Mengganti pengguna yang login di peramban ini. Data yang dimuat untuk akun sebelumnya (kontak, shift,
 * notifikasi, daftar yang disaring izin) dibuang lebih dulu: tanpa ini, berpindah akun tanpa menekan Keluar
 * (masuk cepat, atau login lagi setelah sesi berakhir) menampilkan data akun lama sampai kadaluarsa (K-106).
 */
export function gantiPengguna(qc: QueryClient, pengguna: PenggunaSaya): void {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== kunciAuth.saya[0] });
  qc.setQueryData(kunciAuth.saya, pengguna);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InputLogin) => ambilData(await api.auth.login.$post({ json: input })),
    onSuccess: (pengguna) => gantiPengguna(qc, pengguna),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => ambilData(await api.auth.logout.$post()),
    onSettled: () => {
      // Tandai belum login dulu (penjaga rute langsung mengarah ke /login), lalu buang data lain milik
      // sesi sebelumnya. Jangan qc.clear(): itu memutus pengamat data "saya" sehingga layar tak berubah.
      qc.setQueryData(kunciAuth.saya, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== kunciAuth.saya[0] });
    },
  });
}

export function useGantiPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InputGantiPassword) =>
      ambilData(await api.auth['ganti-password'].$post({ json: input })),
    onSuccess: (pengguna) => qc.setQueryData(kunciAuth.saya, pengguna),
  });
}

// --- K-191: akun pertama dan pemulihan password ---

export function useStatusPenyiapan() {
  return useQuery({
    queryKey: ['auth', 'penyiapan'],
    queryFn: async () => ambilData(await api.auth.penyiapan.$get()),
    staleTime: 30_000,
  });
}

/** K-205: setup awal (data usaha + akun Owner pertama); langsung masuk. */
export function useSetupAwal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: InputSetupAwal) =>
      ambilData(await api.auth['setup-awal'].$post({ json })),
    onSuccess: (hasil, isi) => {
      gantiPengguna(qc, hasil.pengguna);
      const status: StatusPenyiapan = {
        perluAkunPertama: false,
        namaToko: isi.usaha.namaToko,
        sloganToko: isi.usaha.sloganToko,
        kotaToko: isi.usaha.kotaToko,
      };
      qc.setQueryData(['auth', 'penyiapan'], status);
    },
  });
}

/** K-209: minta kode verifikasi lupa password ke email. */
export function useMintaKodeEmail() {
  return useMutation({
    mutationFn: async (username: string) =>
      ambilData(await api.auth['lupa-email'].$post({ json: { username } })),
  });
}

export function useResetLewatEmail() {
  return useMutation({
    mutationFn: async (json: InputResetLewatEmail) =>
      ambilData(await api.auth['lupa-email'].reset.$post({ json })),
  });
}

// --- K-206: tur fitur ---

const kunciTur = ['auth', 'tur'] as const;

export function useStatusTur(aktif = true) {
  return useQuery({
    queryKey: kunciTur,
    queryFn: async (): Promise<StatusTur> => ambilData(await api.auth.tur.$get()),
    enabled: aktif,
    staleTime: 5 * 60_000,
  });
}

export function useCatatTur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: { kode: KodeTur; hasil: 'SELESAI' | 'DILEWATI' }) =>
      ambilData(await api.auth.tur.$post({ json })),
    onSuccess: (data) => qc.setQueryData(kunciTur, data),
  });
}

export function useUlangTur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kode: KodeTur | 'SEMUA') =>
      ambilData(await api.auth.tur.ulang.$post({ json: { kode } })),
    onSuccess: (data) => qc.setQueryData(kunciTur, data),
  });
}

export function usePulihkanPassword() {
  return useMutation({
    mutationFn: async (json: InputPulihkanPassword) =>
      ambilData(await api.auth.pulihkan.$post({ json })),
  });
}

export function useInfoKodePemulihan() {
  return useQuery({
    queryKey: ['auth', 'kode-pemulihan'],
    queryFn: async () => ambilData(await api.auth['kode-pemulihan'].$get()),
  });
}

export function useBuatKodePemulihan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) =>
      ambilData(await api.auth['kode-pemulihan'].$post({ json: { password } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'kode-pemulihan'] }),
  });
}
