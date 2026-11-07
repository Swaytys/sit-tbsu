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

/** K-219: data toko baru (kosong); data sekarang disimpan dan bisa dipakai lagi. */
export function useBuatDataBaru() {
  return useMutation({
    mutationFn: async (password: string) =>
      ambilData(await api.data.baru.$post({ json: { password } })),
  });
}

/** K-168: data latihan (contoh barang + stok, akun Owner yang sama); data sekarang disimpan. */
export function useBuatDataLatihan() {
  return useMutation({
    mutationFn: async (password: string) =>
      ambilData(await api.data.latihan.$post({ json: { password } })),
  });
}

/** K-219: dari halaman masuk, dengan username + password Owner data yang sedang dipakai. */
export type KredensialOwner = { username: string; password: string };

export function useDataTokoMasuk() {
  return useMutation({
    mutationFn: async (k: KredensialOwner) =>
      ambilData(await api.auth['data-toko'].daftar.$post({ json: k })),
  });
}

export function usePakaiDataMasuk() {
  return useMutation({
    mutationFn: async (p: KredensialOwner & { id: string }) =>
      ambilData(
        await api.auth['data-toko'][':id'].pakai.$post({
          param: { id: p.id },
          json: { username: p.username, password: p.password },
        }),
      ),
  });
}

export function useBuatDataBaruMasuk() {
  return useMutation({
    mutationFn: async (k: KredensialOwner) =>
      ambilData(await api.auth['data-toko'].baru.$post({ json: k })),
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

// --- K-217: akses HP/tablet lewat Tailscale ---

export function useAksesPerangkat() {
  return useQuery({
    queryKey: ['akses-perangkat'],
    queryFn: async () => ambilData(await api['akses-perangkat'].$get()),
  });
}

export function usePeriksaAkses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nyalakan: boolean) =>
      ambilData(
        nyalakan
          ? await api['akses-perangkat'].aktifkan.$post()
          : await api['akses-perangkat'].periksa.$post(),
      ),
    onSuccess: (data) => qc.setQueryData(['akses-perangkat'], data),
  });
}
