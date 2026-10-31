import type {
  InputEksporData,
  ManifestData,
  MatiMendadak,
  SnapshotHarian,
  StatusData,
} from '@sit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, api, galatDariRespons } from './client';

/** K-213: kelola data aplikasi (Pengaturan › Data). */

const kunci = ['data-aplikasi'] as const;

export function useStatusData() {
  return useQuery({
    queryKey: kunci,
    queryFn: async (): Promise<StatusData> => ambilData(await api.data.$get()),
  });
}

export function useSalinanData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) =>
      ambilData(await api.data.salinan.$post({ json: { label } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: kunci }),
  });
}

/** Setelah data diganti, sesi lama dicabut: halaman dimuat ulang ke halaman masuk. */
export function usePakaiData() {
  return useMutation({
    mutationFn: async (p: { id: string; password: string }) =>
      ambilData(
        await api.data[':id'].pakai.$post({ param: { id: p.id }, json: { password: p.password } }),
      ),
  });
}

export function useHapusData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; password: string }) =>
      ambilData(
        await api.data[':id'].hapus.$post({ param: { id: p.id }, json: { password: p.password } }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: kunci }),
  });
}

/** Mengunduh berkas .bonsai terenkripsi. */
export function useEksporData() {
  return useMutation({
    mutationFn: async (json: InputEksporData) => {
      const res = await fetch('/api/data/ekspor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      if (!res.ok) throw await galatDariRespons(res);
      const nama =
        /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
        'BonsaiUrip.bonsai';
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = nama;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return nama;
    },
  });
}

async function kirimImpor(alamat: string, berkas: File, sandi: string): Promise<ManifestData> {
  const form = new FormData();
  form.set('berkas', berkas);
  form.set('sandi', sandi);
  const res = await fetch(alamat, { method: 'POST', body: form });
  if (!res.ok) throw await galatDariRespons(res);
  return ((await res.json()) as { data: ManifestData }).data;
}

export function useImporData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { berkas: File; sandi: string }) =>
      kirimImpor('/api/data/impor', p.berkas, p.sandi),
    onSuccess: () => qc.invalidateQueries({ queryKey: kunci }),
  });
}

export function useSnapshotHarian(aktif: boolean) {
  return useQuery({
    queryKey: [...kunci, 'harian'],
    queryFn: async (): Promise<SnapshotHarian[]> =>
      ambilData(await api.data['cadangan-harian'].$get()),
    enabled: aktif,
  });
}

export function useAmbilHarian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      ambilData(await api.data['cadangan-harian'][':id'].$post({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: kunci }),
  });
}

// --- Setup awal: lanjutkan data yang sudah ada (belum ada pengguna) ---

export function useDataSetup(aktif: boolean) {
  return useQuery({
    queryKey: ['setup-data'],
    queryFn: async (): Promise<ManifestData[]> => ambilData(await api.auth['setup-data'].$get()),
    enabled: aktif,
  });
}

export function usePakaiDataSetup() {
  return useMutation({
    mutationFn: async (id: string) =>
      ambilData(await api.auth['setup-data'][':id'].pakai.$post({ param: { id } })),
  });
}

export function useImporDataSetup() {
  return useMutation({
    mutationFn: async (p: { berkas: File; sandi: string }) =>
      kirimImpor('/api/auth/setup-data/impor', p.berkas, p.sandi),
  });
}

// --- K-216: pemulihan setelah mati mendadak ---

export function useMatiMendadak() {
  return useQuery({
    queryKey: ['pemulihan'],
    queryFn: async (): Promise<MatiMendadak | null> => ambilData(await api.pemulihan.$get()),
    staleTime: 5 * 60_000,
  });
}

export function useSelesaiPemulihan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => ambilData(await api.pemulihan.selesai.$post()),
    onSuccess: () => qc.setQueryData(['pemulihan'], null),
  });
}
