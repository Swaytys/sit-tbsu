import type { DataKontakSaya, DataPengaturanSaluran } from '@sit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, api } from './client';

/*
 * Saluran kode persetujuan (K-102): pengaturan toko (token bot Telegram, SMTP) dan kontak pribadi pengguna
 * (email, Telegram) untuk menerima kode sekali pakai.
 */

const KUNCI_TOKO = ['saluran'] as const;
const KUNCI_SAYA = ['saluran', 'saya'] as const;

export function usePengaturanSaluran() {
  return useQuery({
    queryKey: KUNCI_TOKO,
    queryFn: async () => ambilData(await api.saluran.$get()),
  });
}

export function useUbahPengaturanSaluran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: DataPengaturanSaluran) =>
      ambilData(await api.saluran.$patch({ json })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KUNCI_TOKO }),
  });
}

/** Kirim pesan uji ke kontak pengguna yang sedang login. */
export function useUjiSaluran() {
  return useMutation({ mutationFn: async () => ambilData(await api.saluran.uji.$post()) });
}

export function useKontakSaya() {
  return useQuery({
    queryKey: KUNCI_SAYA,
    queryFn: async () => ambilData(await api.saluran.saya.$get()),
  });
}

function useMutasiKontak<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KUNCI_TOKO }),
  });
}

export function useUbahKontakSaya() {
  return useMutasiKontak(async (json: DataKontakSaya) =>
    ambilData(await api.saluran.saya.$patch({ json })),
  );
}

/** Membuat tautan `t.me/<bot>?start=<kode>` untuk menghubungkan Telegram pengguna ini. */
export function useTautanTelegram() {
  return useMutation({
    mutationFn: async () => ambilData(await api.saluran.saya.telegram.tautan.$post()),
  });
}

export function usePeriksaTelegram() {
  return useMutasiKontak(async () => ambilData(await api.saluran.saya.telegram.periksa.$post()));
}

export function usePutusTelegram() {
  return useMutasiKontak(async () => ambilData(await api.saluran.saya.telegram.$delete()));
}
