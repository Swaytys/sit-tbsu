import type {
  InputRencanaRit,
  DataHasilSuratJalan,
  DataKendaraan,
  DataSopir,
  InputCatatBbm,
  InputCatatServis,
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

export function useCatatHasil() {
  return useMutasiArmada(async ({ id, json }: { id: number; json: DataHasilSuratJalan }) =>
    ambilData(await api['surat-jalan'][':id'].hasil.$post({ param: paramId(id), json })),
  );
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

// --- Catatan BBM dan servis, statistik (K-162) ---

/** Notifikasi ikut dimuat ulang: pengingat servis bergantung pada odometer dan catatan servis. */
function useMutasiCatatan<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['armada'] }),
        qc.invalidateQueries({ queryKey: ['notifikasi'] }),
      ]),
  });
}

export function useDaftarBbm(p: { idKendaraan?: number; halaman: number }) {
  return useQuery({
    queryKey: ['armada', 'bbm', p],
    queryFn: async () =>
      ambilIsi(
        await api.armada.bbm.$get({
          query: {
            idKendaraan: p.idKendaraan === undefined ? undefined : String(p.idKendaraan),
            halaman: String(p.halaman),
            perHalaman: '25',
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDaftarServis(p: { idKendaraan?: number; halaman: number }) {
  return useQuery({
    queryKey: ['armada', 'servis', p],
    queryFn: async () =>
      ambilIsi(
        await api.armada.servis.$get({
          query: {
            idKendaraan: p.idKendaraan === undefined ? undefined : String(p.idKendaraan),
            halaman: String(p.halaman),
            perHalaman: '25',
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCatatBbm() {
  return useMutasiCatatan(async (json: InputCatatBbm) =>
    ambilData(await api.armada.bbm.$post({ json })),
  );
}

export function useCatatServis() {
  return useMutasiCatatan(async (json: InputCatatServis) =>
    ambilData(await api.armada.servis.$post({ json })),
  );
}

export function useBatalCatatan() {
  return useMutasiCatatan(
    async ({ jenis, id, alasan }: { jenis: 'bbm' | 'servis'; id: number; alasan: string }) =>
      ambilData(
        jenis === 'bbm'
          ? await api.armada.bbm[':id'].batal.$post({ param: paramId(id), json: { alasan } })
          : await api.armada.servis[':id'].batal.$post({ param: paramId(id), json: { alasan } }),
      ),
  );
}

export function useStatistikArmada(p: { dari: string; sampai: string }) {
  return useQuery({
    queryKey: ['armada', 'statistik', p],
    queryFn: async () => ambilData(await api.armada.statistik.$get({ query: p })),
    placeholderData: keepPreviousData,
  });
}
