import type {
  DataBayarHutang,
  DataHutangAwal,
  DataPerpanjangJatuhTempo,
  DataReturPemasok,
  JenisDokumenHutang,
  PenyelesaianReturPemasok,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/** Hutang pemasok dan retur ke pemasok (Fase 10). */

export type ParamDaftarHutang = {
  cari: string;
  idPemasok: number | null;
  terlambat: boolean;
  halaman: number;
  perHalaman: number;
};

export function useDaftarHutang(p: ParamDaftarHutang) {
  return useQuery({
    queryKey: ['hutang', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.hutang.$get({
          query: {
            cari: p.cari || undefined,
            idPemasok: p.idPemasok === null ? undefined : String(p.idPemasok),
            terlambat: p.terlambat ? 'true' : undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function usePembayaranHutang(dokumen: { jenis: JenisDokumenHutang; id: number } | null) {
  return useQuery({
    queryKey: ['hutang', 'pembayaran', dokumen],
    queryFn: async () =>
      ambilData(
        await api.hutang[':jenis'][':id'].pembayaran.$get({
          param: { jenis: dokumen?.jenis ?? 'PENERIMAAN', id: String(dokumen?.id ?? 0) },
        }),
      ),
    enabled: dokumen !== null,
  });
}

/** Penerimaan pemasok yang masih berhutang (pilihan sumber retur POTONG_HUTANG). */
export function usePenerimaanBerhutang(idPemasok: number | null) {
  return useQuery({
    queryKey: ['hutang', 'penerimaan-pemasok', idPemasok],
    queryFn: async () =>
      ambilData(
        await api.hutang['penerimaan-pemasok'][':idPemasok'].$get({
          param: { idPemasok: String(idPemasok ?? 0) },
        }),
      ),
    enabled: idPemasok !== null,
  });
}

/** Membayar hutang mengubah daftar hutang, penerimaan, kas shift, dan notifikasi. */
export function useBayarHutang() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: DataBayarHutang) => ambilData(await api.hutang.bayar.$post({ json })),
    onSuccess: () =>
      Promise.all(
        ['hutang', 'penerimaan', 'shift', 'notifikasi', 'konsinyasi'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
}

/** K-241: catat hutang awal pemasok (sebelum memakai aplikasi). */
export function useCatatHutangAwal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: DataHutangAwal) => ambilData(await api.hutang.awal.$post({ json })),
    onSuccess: () =>
      Promise.all(['hutang', 'notifikasi'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}

/** K-237: Owner memperpanjang jatuh tempo hutang penerimaan. */
export function usePerpanjangJatuhTempo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, json }: { id: number; json: DataPerpanjangJatuhTempo }) =>
      ambilData(
        await api.hutang.penerimaan[':id'].perpanjang.$post({ param: { id: String(id) }, json }),
      ),
    onSuccess: () =>
      Promise.all(
        ['hutang', 'penerimaan', 'order-pembelian', 'notifikasi'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
}

// --- Retur ke pemasok ---

export type ParamDaftarReturPemasok = {
  cari: string;
  penyelesaian: PenyelesaianReturPemasok | null;
  halaman: number;
  perHalaman: number;
};

export function useDaftarReturPemasok(p: ParamDaftarReturPemasok) {
  return useQuery({
    queryKey: ['retur-pemasok', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api['retur-pemasok'].$get({
          query: {
            cari: p.cari || undefined,
            penyelesaian: p.penyelesaian ?? undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailReturPemasok(id: number) {
  return useQuery({
    queryKey: ['retur-pemasok', 'detail', id],
    queryFn: async () =>
      ambilData(await api['retur-pemasok'][':id'].$get({ param: { id: String(id) } })),
  });
}

/** Retur pemasok mengubah stok, hutang, penerimaan (barang pengganti), dan kas shift. */
export function useSimpanReturPemasok() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: DataReturPemasok) =>
      ambilData(await api['retur-pemasok'].$post({ json })),
    onSuccess: () =>
      Promise.all(
        ['retur-pemasok', 'hutang', 'penerimaan', 'barang', 'persediaan', 'shift'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
}
