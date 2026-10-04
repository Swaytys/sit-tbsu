import type { AksiLog, InputUbahPengaturan, TampilanToko } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, galatDariRespons } from './client';

export const kunciPengaturan = {
  semua: ['pengaturan'] as const,
  log: (p: ParamDaftarLog) => ['log-aktivitas', p] as const,
};

export function usePengaturan() {
  return useQuery({
    queryKey: kunciPengaturan.semua,
    queryFn: async () => ambilData(await api.pengaturan.$get()),
  });
}

export function useUbahPengaturan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: InputUbahPengaturan) =>
      ambilData(await api.pengaturan.$patch({ json })),
    onSuccess: (data) => {
      qc.setQueryData(kunciPengaturan.semua, data);
      void qc.invalidateQueries({ queryKey: ['log-aktivitas'] });
      void qc.invalidateQueries({ queryKey: ['tampilan'] });
    },
  });
}

export type ParamDaftarLog = {
  cari: string;
  aksi: AksiLog | '';
  halaman: number;
  perHalaman: number;
};

export function useDaftarLog(p: ParamDaftarLog) {
  return useQuery({
    queryKey: kunciPengaturan.log(p),
    queryFn: async () =>
      ambilIsi(
        await api['log-aktivitas'].$get({
          query: {
            cari: p.cari || undefined,
            aksi: p.aksi || undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Nama toko, logo, dan jumlah baris per halaman (semua pengguna login; K-065). */
export function useTampilanToko() {
  return useQuery({
    queryKey: ['tampilan'],
    queryFn: async () => ambilData(await api.pengaturan.tampilan.$get()),
    staleTime: 5 * 60_000,
  });
}

/** Jumlah baris per halaman tabel sesuai pengaturan toko. */
export function useBarisPerHalaman(): number {
  return useTampilanToko().data?.barisPerHalaman ?? 25;
}

export function useUnggahLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (berkas: File): Promise<TampilanToko> => {
      const form = new FormData();
      form.set('berkas', berkas);
      const res = await fetch('/api/pengaturan/logo', { method: 'POST', body: form });
      if (!res.ok) throw await galatDariRespons(res);
      return ((await res.json()) as { data: TampilanToko }).data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['tampilan'], data);
      void qc.invalidateQueries({ queryKey: ['log-aktivitas'] });
    },
  });
}

export function useHapusLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => ambilData(await api.pengaturan.logo.$delete()),
    onSuccess: (data) => {
      qc.setQueryData(['tampilan'], data);
      void qc.invalidateQueries({ queryKey: ['log-aktivitas'] });
    },
  });
}

// --- Cadangan data (Owner, K-084) ---

export function useStatusCadangan(aktif: boolean) {
  return useQuery({
    queryKey: ['cadangan'],
    queryFn: async () => ambilData(await api.cadangan.$get()),
    enabled: aktif,
    // Selama cadangan/uji pulih berjalan, status diperbarui tiap 3 detik.
    refetchInterval: (q) => (q.state.data?.sedangBerjalan ? 3000 : false),
  });
}

export function useJalankanCadangan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jenis: 'cadangan' | 'uji-pulih') =>
      ambilData(
        jenis === 'cadangan'
          ? await api.cadangan.jalankan.$post()
          : await api.cadangan['uji-pulih'].$post(),
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['cadangan'] });
      void qc.invalidateQueries({ queryKey: ['notifikasi'] });
    },
  });
}
