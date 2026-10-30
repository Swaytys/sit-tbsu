import type { InputUbahDataUsaha, JenisContoh, LangkahSetupLanjut } from '@sit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, api } from './client';

/** K-168: panduan penyiapan pertama dan contoh data. */

export function usePanduanPenyiapan(aktifkan = true) {
  return useQuery({
    queryKey: ['penyiapan'],
    queryFn: async () => ambilData(await api.penyiapan.$get()),
    enabled: aktifkan,
  });
}

/** Data master berubah (contoh dibuat/dinonaktifkan): semua daftar dimuat ulang. */
function useMutasiPenyiapan<T, H>(fn: (v: T) => Promise<H>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}

export function useIsiContoh() {
  return useMutasiPenyiapan(async (jenis: JenisContoh) =>
    ambilData(await api.penyiapan.contoh.$post({ json: { jenis } })),
  );
}

export function useNonaktifkanContoh() {
  return useMutasiPenyiapan(async () => ambilData(await api.penyiapan.contoh.nonaktifkan.$post()));
}

export function useTandaiProfil() {
  return useMutasiPenyiapan(async (selesai: boolean) =>
    ambilData(await api.penyiapan.tandai.$post({ json: { langkah: 'PROFIL', selesai } })),
  );
}

export function useSembunyikanPanduan() {
  return useMutasiPenyiapan(async (sembunyikan: boolean) =>
    ambilData(await api.penyiapan.sembunyikan.$post({ json: { sembunyikan } })),
  );
}

// --- K-205: setup awal ---

export function useSetupAwalStatus(aktifkan = true) {
  return useQuery({
    queryKey: ['penyiapan', 'setup-awal'],
    queryFn: async () => ambilData(await api.penyiapan['setup-awal'].$get()),
    enabled: aktifkan,
    staleTime: 60_000,
  });
}

export function useUbahDataUsaha() {
  return useMutasiPenyiapan(async (json: InputUbahDataUsaha) =>
    ambilData(await api.penyiapan['setup-awal'].usaha.$put({ json })),
  );
}

export function useSelesaiSetupAwal() {
  return useMutasiPenyiapan(async (dilewati: LangkahSetupLanjut[]) =>
    ambilData(await api.penyiapan['setup-awal'].selesai.$post({ json: { dilewati } })),
  );
}
