import type {
  DataBarang,
  DataTingkatHarga,
  DetailBarang,
  HasilImportBarang,
  InputSimpanHarga,
  StatusAktif,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, galatDariRespons } from './client';

/** Barang, harga jual per tier, dan tingkat harga (Fase 3). */

export type ParamDaftarBarang = {
  cari: string;
  idKategori: number | null;
  idMerk?: number | null;
  status: StatusAktif | 'SEMUA';
  perluTinjau: boolean;
  halaman: number;
  perHalaman: number;
};

export function useDaftarBarang(p: ParamDaftarBarang) {
  return useQuery({
    queryKey: ['barang', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.barang.$get({
          query: {
            cari: p.cari || undefined,
            idKategori: p.idKategori === null ? undefined : String(p.idKategori),
            idMerk: p.idMerk ? String(p.idMerk) : undefined,
            status: p.status,
            perluTinjau: p.perluTinjau ? 'true' : undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailBarang(id: number | null) {
  return useQuery({
    queryKey: ['barang', 'detail', id],
    queryFn: async () => ambilData(await api.barang[':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null,
  });
}

/** Mutasi barang/harga memuat ulang daftar barang (harga tampil di daftar) setelah berhasil. */
function useMutasi<TInput, THasil>(akar: string[], fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(akar.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}

const param = (id: number) => ({ id: String(id) });

export function useSimpanBarang() {
  return useMutasi(['barang'], async ({ id, json }: { id?: number; json: DataBarang }) =>
    ambilData(
      id === undefined
        ? await api.barang.$post({ json })
        : await api.barang[':id'].$patch({ param: param(id), json }),
    ),
  );
}

export function useStatusBarang() {
  return useMutasi(
    ['barang'],
    async ({ id, statusAktif }: { id: number; statusAktif: StatusAktif }) =>
      ambilData(await api.barang[':id'].status.$patch({ param: param(id), json: { statusAktif } })),
  );
}

/** Unggah gambar lewat form multipart (bukan JSON, jadi tidak lewat klien RPC). */
export function useUnggahGambar() {
  return useMutasi(['barang'], async ({ id, berkas }: { id: number; berkas: File }) => {
    const form = new FormData();
    form.set('berkas', berkas);
    const res = await fetch(`/api/barang/${id}/gambar`, { method: 'POST', body: form });
    if (!res.ok) throw await galatDariRespons(res);
    return ((await res.json()) as { data: DetailBarang }).data;
  });
}

export function useHapusGambar() {
  return useMutasi(['barang'], async (id: number) =>
    ambilData(await api.barang[':id'].gambar.$delete({ param: param(id) })),
  );
}

export function useSimpanHarga() {
  return useMutasi(['barang'], async (json: InputSimpanHarga) =>
    ambilData(await api['harga-barang'].$put({ json })),
  );
}

export function useSimpanTier() {
  return useMutasi(
    ['tingkat-harga', 'barang'],
    async ({ id, json }: { id?: number; json: DataTingkatHarga }) =>
      ambilData(
        id === undefined
          ? await api['tingkat-harga'].$post({ json })
          : await api['tingkat-harga'][':id'].$patch({ param: param(id), json }),
      ),
  );
}

export function useStatusTier() {
  return useMutasi(
    ['tingkat-harga', 'barang'],
    async ({ id, statusAktif }: { id: number; statusAktif: StatusAktif }) =>
      ambilData(
        await api['tingkat-harga'][':id'].status.$patch({
          param: param(id),
          json: { statusAktif },
        }),
      ),
  );
}

async function kirimBerkasImport(path: string, berkas: File): Promise<HasilImportBarang> {
  const form = new FormData();
  form.set('berkas', berkas);
  const res = await fetch(path, { method: 'POST', body: form });
  if (!res.ok) throw await galatDariRespons(res);
  return ((await res.json()) as { data: HasilImportBarang }).data;
}

/** Pratinjau import: tidak menyimpan apa pun. */
export function usePratinjauImport() {
  return useMutation({
    mutationFn: (berkas: File) => kirimBerkasImport('/api/import/barang/pratinjau', berkas),
  });
}

export function useSimpanImport() {
  return useMutasi(['barang'], (berkas: File) => kirimBerkasImport('/api/import/barang', berkas));
}
