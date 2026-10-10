import type {
  DataCheckout,
  DataKasShift,
  DataOrder,
  DataPembayaran,
  DataRetur,
  DataSetujui,
  DataSetujuiDiTempat,
  DataSuratJalan,
  DataTutupShift,
  DataVoid,
  InputPratinjauOrder,
  JenisPenjualan,
  StatusOrder,
  StatusPembayaran,
  StatusPengambilan,
  StatusPersetujuan,
  StatusShift,
  StatusSuratJalan,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTunda } from '@/lib/use-tunda';
import { ambilData, ambilIsi, api, paramId } from './client';

/** Penjualan (Fase 5): order & antrean. */

export type ParamDaftarOrder = {
  cari: string;
  status: StatusOrder | 'AKTIF' | null;
  jenis: JenisPenjualan | null;
  milikSaya: boolean;
  halaman: number;
  perHalaman: number;
};

export function useDaftarOrder(p: ParamDaftarOrder, opsi: { segarkanTiap?: number } = {}) {
  return useQuery({
    queryKey: ['order', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.order.$get({
          query: {
            cari: p.cari || undefined,
            status: p.status ?? undefined,
            jenis: p.jenis ?? undefined,
            milikSaya: p.milikSaya ? 'true' : undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: opsi.segarkanTiap,
  });
}

export function useDetailOrder(id: number | null) {
  return useQuery({
    queryKey: ['order', 'detail', id],
    queryFn: async () => ambilData(await api.order[':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null,
  });
}

/** Perubahan order memengaruhi stok tersedia (reservasi), jadi barang & persediaan ikut dimuat ulang. */
function useMutasiOrder<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['order', 'barang', 'persediaan'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ),
  });
}

export function useSimpanOrder() {
  return useMutasiOrder(
    async ({ id, json, kirim }: { id?: number; json: DataOrder; kirim: boolean }) =>
      ambilData(
        id === undefined
          ? await api.order.$post({ query: { kirim: kirim ? 'true' : 'false' }, json })
          : await api.order[':id'].$put({ param: paramId(id), json }),
      ),
  );
}

/**
 * PR5: pratinjau harga, promo, diskon, saran tier, dan total dari API setiap isi order berubah (ditunda
 * sebentar agar ketikan cepat tidak memicu banyak permintaan). `segar` = hasil sesuai isian terbaru.
 */
export function usePratinjauOrder(input: InputPratinjauOrder | null) {
  const kunci = input === null ? null : JSON.stringify(input);
  const tertunda = useTunda(kunci, 200);
  const q = useQuery({
    queryKey: ['pratinjau-order', tertunda],
    queryFn: async () =>
      ambilData(
        await api.order.pratinjau.$post({
          json: JSON.parse(tertunda ?? '{}') as InputPratinjauOrder,
        }),
      ),
    enabled: tertunda !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const segar =
    kunci !== null && tertunda === kunci && q.isSuccess && !q.isPlaceholderData && !q.isFetching;
  return { data: kunci === null ? undefined : q.data, segar, galat: q.error, memuat: q.isFetching };
}

export function useKirimOrder() {
  return useMutasiOrder(async (id: number) =>
    ambilData(await api.order[':id'].kirim.$post({ param: paramId(id) })),
  );
}

export function useProsesOrder() {
  return useMutasiOrder(async (id: number) =>
    ambilData(await api.order[':id'].proses.$post({ param: paramId(id) })),
  );
}

export function useLepasOrder() {
  return useMutasiOrder(async (id: number) =>
    ambilData(await api.order[':id'].lepas.$post({ param: paramId(id) })),
  );
}

export function useBatalOrder() {
  return useMutasiOrder(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(await api.order[':id'].batal.$post({ param: paramId(id), json: { alasan } })),
  );
}

export function useStokTertahan() {
  return useQuery({
    queryKey: ['persediaan', 'tertahan'],
    queryFn: async () => ambilData(await api.stok.tertahan.$get()),
  });
}

// --- Checkout, pembayaran, riwayat penjualan, shift ---

export function useShiftSaya(aktif = true) {
  return useQuery({
    queryKey: ['shift', 'saya'],
    queryFn: async () => ambilData(await api.shift.saya.$get()),
    enabled: aktif,
  });
}

export function useBukaShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modalAwal: number) =>
      ambilData(await api.shift.buka.$post({ json: { modalAwal } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift'] }),
  });
}

/** Checkout memengaruhi order, stok, dan daftar penjualan. */
function useMutasiPenjualan<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['penjualan', 'order', 'barang', 'persediaan'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
}

export function useCheckout() {
  return useMutasiPenjualan(async (json: DataCheckout) =>
    ambilData(await api.penjualan.checkout.$post({ json })),
  );
}

export function useBayarPenjualan() {
  return useMutasiPenjualan(
    async ({ id, pembayaran }: { id: number; pembayaran: DataPembayaran }) =>
      ambilData(
        await api.penjualan[':id'].pembayaran.$post({ param: paramId(id), json: { pembayaran } }),
      ),
  );
}

export function useTandaiDiambil() {
  return useMutasiPenjualan(async (id: number) =>
    ambilData(await api.penjualan[':id'].diambil.$post({ param: paramId(id) })),
  );
}

export async function catatCetakUlang(id: number): Promise<void> {
  await ambilData(await api.penjualan[':id']['cetak-ulang'].$post({ param: paramId(id) }));
}

export type ParamDaftarPenjualan = {
  cari: string;
  jenis: JenisPenjualan | null;
  statusPembayaran: StatusPembayaran | null;
  statusPengambilan: StatusPengambilan | null;
  dari: string;
  sampai: string;
  halaman: number;
  perHalaman: number;
};

export function useDaftarPenjualan(p: ParamDaftarPenjualan) {
  return useQuery({
    queryKey: ['penjualan', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.penjualan.$get({
          query: {
            cari: p.cari || undefined,
            jenis: p.jenis ?? undefined,
            statusPembayaran: p.statusPembayaran ?? undefined,
            statusPengambilan: p.statusPengambilan ?? undefined,
            dari: p.dari || undefined,
            sampai: p.sampai || undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailPenjualan(id: number | null) {
  return useQuery({
    queryKey: ['penjualan', 'detail', id],
    queryFn: async () => ambilData(await api.penjualan[':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null,
  });
}

// --- Surat jalan ---

export function useDaftarSuratJalan(p: {
  status: StatusSuratJalan | 'AKTIF' | null;
  cari: string;
}) {
  return useQuery({
    queryKey: ['penjualan', 'surat-jalan', p],
    queryFn: async () =>
      ambilIsi(
        await api['surat-jalan'].$get({
          query: {
            status: p.status ?? undefined,
            cari: p.cari || undefined,
            perHalaman: '100',
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useBuatSuratJalan() {
  return useMutasiPenjualan(async ({ id, json }: { id: number; json: DataSuratJalan }) =>
    ambilData(await api.penjualan[':id']['surat-jalan'].$post({ param: paramId(id), json })),
  );
}

export function useStatusSuratJalan() {
  return useMutasiPenjualan(
    async ({
      id,
      status,
      sopir,
      kendaraan,
    }: {
      id: number;
      status: 'DIMUAT' | 'DIKIRIM' | 'SELESAI';
      sopir?: string | null;
      kendaraan?: string | null;
    }) =>
      ambilData(
        await api['surat-jalan'][':id'].status.$post({
          param: paramId(id),
          json: { status, sopir, kendaraan },
        }),
      ),
  );
}

export function useBatalSuratJalan() {
  return useMutasiPenjualan(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(
      await api['surat-jalan'][':id'].batal.$post({ param: paramId(id), json: { alasan } }),
    ),
  );
}

// --- Piutang ---

export function useDaftarPiutang(
  p: {
    cari: string;
    idPelanggan: number | null;
    terlambat: boolean;
    halaman: number;
    perHalaman: number;
  },
  aktif = true,
) {
  return useQuery({
    queryKey: ['penjualan', 'piutang', p],
    queryFn: async () =>
      ambilIsi(
        await api.piutang.$get({
          query: {
            cari: p.cari || undefined,
            idPelanggan: p.idPelanggan === null ? undefined : String(p.idPelanggan),
            terlambat: p.terlambat ? 'true' : undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled: aktif,
  });
}

// --- Papan antrean POS (K-073) ---

/** Tiket antrean satu jenis (MENUNGGU & DIPROSES, FIFO) dengan isi barang. */
export function usePapanAntrean(jenis: JenisPenjualan) {
  return useQuery({
    queryKey: ['order', 'antrean', jenis],
    queryFn: async () => ambilData(await api.order.antrean.$get({ query: { jenis } })),
    // Cadangan bila siaran terputus; perubahan normal datang lewat useSiaranAntrean.
    refetchInterval: 60_000,
  });
}

/**
 * Berlangganan siaran perubahan antrean (Server-Sent Events). Setiap tanda "berubah" memuat ulang semua data
 * order yang sedang tampil. EventSource menyambung ulang sendiri bila koneksi putus.
 */
export function useSiaranAntrean() {
  const qc = useQueryClient();
  useEffect(() => {
    const sumber = new EventSource('/api/order/antrean/siaran');
    const muatUlang = () => void qc.invalidateQueries({ queryKey: ['order'] });
    sumber.addEventListener('antrean', muatUlang);
    return () => sumber.close();
  }, [qc]);
}

// --- Shift & clerical (Fase 6) ---

export function useDaftarShift(p: {
  status: StatusShift | null;
  adaSelisih: boolean;
  halaman: number;
  perHalaman: number;
}) {
  return useQuery({
    queryKey: ['shift', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.shift.$get({
          query: {
            status: p.status ?? undefined,
            adaSelisih: p.adaSelisih ? 'true' : undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailShift(id: number | null) {
  return useQuery({
    queryKey: ['shift', 'detail', id],
    queryFn: async () => ambilData(await api.shift[':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null,
  });
}

function useMutasiShift<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(['shift', 'order'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}

export function useCatatKas() {
  return useMutasiShift(async (json: DataKasShift) =>
    ambilData(await api.shift.kas.$post({ json })),
  );
}

export function useTutupShift() {
  return useMutasiShift(async ({ id, json }: { id: number; json: DataTutupShift }) =>
    ambilData(await api.shift[':id'].tutup.$post({ param: paramId(id), json })),
  );
}

// --- Void & retur (Fase 6) ---

function useMutasiKoreksi<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['koreksi', 'penjualan', 'barang', 'persediaan', 'shift'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
}

export function useKandidatVoid(cari: string) {
  return useQuery({
    queryKey: ['koreksi', 'void', 'kandidat', cari],
    queryFn: async () =>
      ambilData(await api.void.kandidat.$get({ query: { cari: cari || undefined } })),
    placeholderData: keepPreviousData,
  });
}

export function useDaftarVoid(p: {
  status: StatusPersetujuan | null;
  halaman: number;
  perHalaman: number;
}) {
  return useQuery({
    queryKey: ['koreksi', 'void', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.void.$get({
          query: {
            status: p.status ?? undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAjukanVoid() {
  return useMutasiKoreksi(async (json: DataVoid) => ambilData(await api.void.$post({ json })));
}

export function useSetujuiVoid() {
  return useMutasiKoreksi(async ({ id, json }: { id: number; json: DataSetujui }) =>
    ambilData(await api.void[':id'].setujui.$post({ param: paramId(id), json })),
  );
}

/** K-099: atasan menyetujui pengajuan MENUNGGU di layar pengaju. */
export function useSetujuiVoidDiTempat() {
  return useMutasiKoreksi(async ({ id, json }: { id: number; json: DataSetujuiDiTempat }) =>
    ambilData(await api.void[':id']['setujui-di-tempat'].$post({ param: paramId(id), json })),
  );
}

export function useBatalVoid() {
  return useMutasiKoreksi(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(await api.void[':id'].batal.$post({ param: paramId(id), json: { alasan } })),
  );
}

export function useTolakVoid() {
  return useMutasiKoreksi(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(await api.void[':id'].tolak.$post({ param: paramId(id), json: { alasan } })),
  );
}

export function useKandidatRetur(cari: string) {
  return useQuery({
    queryKey: ['koreksi', 'retur', 'kandidat', cari],
    queryFn: async () => ambilData(await api.retur.kandidat.$get({ query: { cari } })),
    enabled: cari.trim().length > 0,
  });
}

export function useDaftarRetur(p: {
  status: StatusPersetujuan | null;
  halaman: number;
  perHalaman: number;
}) {
  return useQuery({
    queryKey: ['koreksi', 'retur', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.retur.$get({
          query: {
            status: p.status ?? undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAjukanRetur() {
  return useMutasiKoreksi(async (json: DataRetur) => ambilData(await api.retur.$post({ json })));
}

export function useSetujuiRetur() {
  return useMutasiKoreksi(async ({ id, json }: { id: number; json: DataSetujui }) =>
    ambilData(await api.retur[':id'].setujui.$post({ param: paramId(id), json })),
  );
}

/** K-099: atasan menyetujui pengajuan MENUNGGU di layar pengaju. */
export function useSetujuiReturDiTempat() {
  return useMutasiKoreksi(async ({ id, json }: { id: number; json: DataSetujuiDiTempat }) =>
    ambilData(await api.retur[':id']['setujui-di-tempat'].$post({ param: paramId(id), json })),
  );
}

export function useBatalRetur() {
  return useMutasiKoreksi(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(await api.retur[':id'].batal.$post({ param: paramId(id), json: { alasan } })),
  );
}

export function useTolakRetur() {
  return useMutasiKoreksi(async ({ id, alasan }: { id: number; alasan: string }) =>
    ambilData(await api.retur[':id'].tolak.$post({ param: paramId(id), json: { alasan } })),
  );
}
