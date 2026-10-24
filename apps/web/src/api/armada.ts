import type {
  DataBerangkat,
  InputRencanaRit,
  DataHasilSuratJalan,
  DataKendaraan,
  DataSopir,
  StatusAktif,
  StatusPerjalanan,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, paramId } from './client';

/** Kendaraan, sopir, perjalanan, dan hasil pengantaran (docs/05 S8–S12, K-149–K-151). */

type SaringStatus = StatusAktif | 'SEMUA';

export function useDaftarKendaraan(status: SaringStatus = 'SEMUA') {
  return useQuery({
    queryKey: ['armada', 'kendaraan', status],
    queryFn: async () => ambilData(await api.kendaraan.$get({ query: { status } })),
  });
}

export function useDaftarSopir(status: SaringStatus = 'SEMUA') {
  return useQuery({
    queryKey: ['armada', 'sopir', status],
    queryFn: async () => ambilData(await api.sopir.$get({ query: { status } })),
  });
}

export function useDaftarPerjalanan(p: {
  status?: StatusPerjalanan;
  idKendaraan?: number;
  idSopir?: number;
  halaman?: number;
}) {
  return useQuery({
    queryKey: ['armada', 'perjalanan', p],
    queryFn: async () =>
      ambilIsi(
        await api.perjalanan.$get({
          query: {
            status: p.status,
            idKendaraan: p.idKendaraan === undefined ? undefined : String(p.idKendaraan),
            idSopir: p.idSopir === undefined ? undefined : String(p.idSopir),
            halaman: String(p.halaman ?? 1),
            perHalaman: '50',
          },
        }),
      ),
    placeholderData: keepPreviousData,
    // Papan Pengiriman dipakai beberapa komputer: rit rencana dan rit jalan disegarkan berkala.
    refetchInterval: p.status === 'JALAN' || p.status === 'DIRENCANAKAN' ? 30_000 : false,
  });
}

export function usePerluDikirim() {
  return useQuery({
    queryKey: ['penjualan', 'surat-jalan', 'perlu-kirim'],
    queryFn: async () => ambilData(await api['surat-jalan']['perlu-kirim'].$get()),
    refetchInterval: 30_000,
  });
}

/** Memuat ulang armada (status sedang jalan) dan penjualan (surat jalan, pengiriman) setelah berhasil. */
function useMutasiArmada<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['armada'] }),
        qc.invalidateQueries({ queryKey: ['penjualan'] }),
        qc.invalidateQueries({ queryKey: ['koreksi'] }),
      ]),
  });
}

type Simpan<T> = { id?: number; json: T };
type Status = { id: number; statusAktif: StatusAktif };

export function useSimpanKendaraan() {
  return useMutasiArmada(async ({ id, json }: Simpan<DataKendaraan>) =>
    ambilData(
      id === undefined
        ? await api.kendaraan.$post({ json })
        : await api.kendaraan[':id'].$patch({ param: paramId(id), json }),
    ),
  );
}

export function useStatusKendaraan() {
  return useMutasiArmada(async ({ id, statusAktif }: Status) =>
    ambilData(
      await api.kendaraan[':id'].status.$patch({ param: paramId(id), json: { statusAktif } }),
    ),
  );
}

export function useSimpanSopir() {
  return useMutasiArmada(async ({ id, json }: Simpan<DataSopir>) =>
    ambilData(
      id === undefined
        ? await api.sopir.$post({ json })
        : await api.sopir[':id'].$patch({ param: paramId(id), json }),
    ),
  );
}

export function useStatusSopir() {
  return useMutasiArmada(async ({ id, statusAktif }: Status) =>
    ambilData(await api.sopir[':id'].status.$patch({ param: paramId(id), json: { statusAktif } })),
  );
}

export function useBerangkat() {
  return useMutasiArmada(async (json: DataBerangkat) =>
    ambilData(await api.perjalanan.$post({ json })),
  );
}

export function useCatatHasil() {
  return useMutasiArmada(async ({ id, json }: { id: number; json: DataHasilSuratJalan }) =>
    ambilData(await api['surat-jalan'][':id'].hasil.$post({ param: paramId(id), json })),
  );
}

/** K-161: pratinjau muatan rit sebelum berangkat (dihitung API; tidak menulis apa pun). */
export function usePratinjauMuatan(idKendaraan: number | null, idSuratJalan: number[]) {
  return useQuery({
    queryKey: ['armada', 'muatan', idKendaraan, idSuratJalan],
    queryFn: async () =>
      ambilData(
        await api.perjalanan['pratinjau-muatan'].$post({
          json: { idKendaraan: idKendaraan ?? 0, idSuratJalan },
        }),
      ),
    enabled: idKendaraan !== null && idSuratJalan.length > 0,
  });
}

// --- Rit rencana (K-160) ---

export function useRencanaRit() {
  return useMutasiArmada(async (json: InputRencanaRit) =>
    ambilData(await api.perjalanan.rencana.$post({ json })),
  );
}

export function useIsiRit() {
  return useMutasiArmada(
    async ({
      id,
      idSuratJalan,
      idPenjualan,
    }: {
      id: number;
      idSuratJalan?: number;
      idPenjualan?: number;
    }) =>
      ambilData(
        await api.perjalanan[':id'].isi.$post({
          param: paramId(id),
          json: { idSuratJalan, idPenjualan },
        }),
      ),
  );
}

export function useKeluarRit() {
  return useMutasiArmada(async (idSuratJalan: number) =>
    ambilData(await api.perjalanan.keluar.$post({ json: { idSuratJalan } })),
  );
}

export function useMuatRit() {
  return useMutasiArmada(async (id: number) =>
    ambilData(await api.perjalanan[':id'].dimuat.$post({ param: paramId(id) })),
  );
}

export function useBerangkatRit() {
  return useMutasiArmada(
    async ({ id, alasanMuatan }: { id: number; alasanMuatan: string | null }) =>
      ambilData(
        await api.perjalanan[':id'].berangkat.$post({ param: paramId(id), json: { alasanMuatan } }),
      ),
  );
}

export function useBatalRit() {
  return useMutasiArmada(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(await api.perjalanan[':id'].batal.$post({ param: paramId(id), json: { alasan } })),
  );
}
