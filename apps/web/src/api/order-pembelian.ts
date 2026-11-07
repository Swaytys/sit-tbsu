import type {
  DataAkhiriOrderPembelian,
  DataKonfirmasiOrderPembelian,
  DataOrderPembelian,
  DataUangMukaOrderPembelian,
  StatusOrderPembelian,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api } from './client';

/* K-125 order pembelian ke pemasok. */

export type SaringPO = {
  cari: string;
  status: StatusOrderPembelian | 'BERJALAN' | '';
  halaman: number;
  perHalaman: number;
};

export function useDaftarPO(p: SaringPO) {
  return useQuery({
    queryKey: ['order-pembelian', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api['order-pembelian'].$get({
          query: {
            cari: p.cari || undefined,
            status: p.status || undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailPO(id: number | null) {
  return useQuery({
    queryKey: ['order-pembelian', 'detail', id],
    queryFn: async () =>
      ambilData(await api['order-pembelian'][':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null && id > 0,
  });
}

/** K-225 (Owner): tandai barang yang pembeliannya selalu wajib disetujui Owner. */
export function useBarangKhusus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, perlu }: { id: number; perlu: boolean }) =>
      ambilData(
        await api['order-pembelian'].barang[':id'].khusus.$post({
          param: { id: String(id) },
          json: { perlu },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barang'] }),
  });
}

function useSegarkan() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['order-pembelian', 'persediaan', 'hutang', 'notifikasi'].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}

export function useSimpanPO() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: async ({ id, json }: { id: number | null; json: DataOrderPembelian }) =>
      ambilData(
        id === null
          ? await api['order-pembelian'].$post({ json })
          : await api['order-pembelian'][':id'].$patch({ param: { id: String(id) }, json }),
      ),
    onSuccess: segarkan,
  });
}

export function useAksiPO() {
  const segarkan = useSegarkan();
  const r = api['order-pembelian'][':id'];
  return {
    kirim: useMutation({
      mutationFn: async (id: number) =>
        ambilData(await r.kirim.$post({ param: { id: String(id) } })),
      onSuccess: segarkan,
    }),
    konfirmasi: useMutation({
      mutationFn: async ({ id, json }: { id: number; json: DataKonfirmasiOrderPembelian }) =>
        ambilData(await r.konfirmasi.$post({ param: { id: String(id) }, json })),
      onSuccess: segarkan,
    }),
    uangMuka: useMutation({
      mutationFn: async ({ id, json }: { id: number; json: DataUangMukaOrderPembelian }) =>
        ambilData(await r['uang-muka'].$post({ param: { id: String(id) }, json })),
      onSuccess: segarkan,
    }),
    ajukan: useMutation({
      mutationFn: async (id: number) =>
        ambilData(await r.ajukan.$post({ param: { id: String(id) } })),
      onSuccess: segarkan,
    }),
    setujui: useMutation({
      mutationFn: async ({ id, catatan }: { id: number; catatan: string }) =>
        ambilData(
          await r.setujui.$post({
            param: { id: String(id) },
            json: { catatan: catatan.trim() || undefined },
          }),
        ),
      onSuccess: segarkan,
    }),
    tolak: useMutation({
      mutationFn: async ({ id, alasan }: { id: number; alasan: string }) =>
        ambilData(await r.tolak.$post({ param: { id: String(id) }, json: { alasan } })),
      onSuccess: segarkan,
    }),
    akhiri: useMutation({
      mutationFn: async ({
        id,
        jenis,
        json,
      }: {
        id: number;
        jenis: 'tutup' | 'batal';
        json: DataAkhiriOrderPembelian;
      }) =>
        ambilData(
          jenis === 'tutup'
            ? await r.tutup.$post({ param: { id: String(id) }, json })
            : await r.batal.$post({ param: { id: String(id) }, json }),
        ),
      onSuccess: segarkan,
    }),
  };
}
