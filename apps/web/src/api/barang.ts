import type {
  DataBarang,
  DataSimpanSatuanJual,
  DataTingkatHarga,
  DetailBarang,
  BacaImportBarang,
  BacaImportMuatan,
  InputAbaikanTinjau,
  InputProsesImport,
  InputProsesMuatan,
  InputHargaOtomatis,
  InputSimpanHarga,
  InputTerapkanTinjau,
  Kepemilikan,
  StatusAktif,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, galatDariRespons, paramId } from './client';

/** Barang, harga jual per tier, dan tingkat harga (Fase 3). */

export type ParamDaftarBarang = {
  cari: string;
  idKategori: number | null;
  idMerk?: number | null;
  status: StatusAktif | 'SEMUA';
  perluTinjau: boolean;
  /** Hanya barang yang punya stok rusak. */
  adaRusak?: boolean;
  /** K-161: hanya barang yang data muatannya belum lengkap. */
  muatanBelum?: boolean;
  kepemilikan?: Kepemilikan | null;
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
            adaRusak: p.adaRusak ? 'true' : undefined,
            muatanBelum: p.muatanBelum ? 'true' : undefined,
            kepemilikan: p.kepemilikan ?? undefined,
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

export function useSimpanBarang() {
  return useMutasi(['barang'], async ({ id, json }: { id?: number; json: DataBarang }) =>
    ambilData(
      id === undefined
        ? await api.barang.$post({ json })
        : await api.barang[':id'].$patch({ param: paramId(id), json }),
    ),
  );
}

/** Simpan satuan jual barang (K-091); harga satuan jual ikut berubah. */
export function useSimpanSatuanJual() {
  return useMutasi(['barang'], async ({ id, json }: { id: number; json: DataSimpanSatuanJual }) =>
    ambilData(await api.barang[':id']['satuan-jual'].$put({ param: paramId(id), json })),
  );
}

export function useStatusBarang() {
  return useMutasi(
    ['barang'],
    async ({ id, statusAktif }: { id: number; statusAktif: StatusAktif }) =>
      ambilData(
        await api.barang[':id'].status.$patch({ param: paramId(id), json: { statusAktif } }),
      ),
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
    ambilData(await api.barang[':id'].gambar.$delete({ param: paramId(id) })),
  );
}

export function useSimpanHarga() {
  return useMutasi(['barang'], async (json: InputSimpanHarga) =>
    ambilData(await api['harga-barang'].$put({ json })),
  );
}

/** H7 (K-094): sakelar harga otomatis dari halaman Harga Jual. */
export function useHargaOtomatis() {
  return useMutasi(['barang'], async (json: InputHargaOtomatis) =>
    ambilData(await api['harga-barang'].otomatis.$put({ json })),
  );
}

// --- Tinjau Harga (docs/06 H6). Kunci kueri di bawah 'barang' agar ikut dimuat ulang setelah simpan. ---

export type ParamTinjauHarga = {
  cari: string;
  idKategori: number | null;
  halaman: number;
  perHalaman: number;
};

export function useTinjauHarga(p: ParamTinjauHarga, aktif = true) {
  return useQuery({
    queryKey: ['barang', 'tinjau', p],
    queryFn: async () =>
      ambilIsi(
        await api['harga-barang'].tinjau.$get({
          query: {
            cari: p.cari || undefined,
            idKategori: p.idKategori === null ? undefined : String(p.idKategori),
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled: aktif,
  });
}

export function useTerapkanTinjau() {
  return useMutasi(['barang'], async (json: InputTerapkanTinjau) =>
    ambilData(await api['harga-barang'].tinjau.terapkan.$post({ json })),
  );
}

export function useAbaikanTinjau() {
  return useMutasi(['barang'], async (json: InputAbaikanTinjau) =>
    ambilData(await api['harga-barang'].tinjau.abaikan.$post({ json })),
  );
}

export function useSimpanTier() {
  return useMutasi(
    ['tingkat-harga', 'barang'],
    async ({ id, json }: { id?: number; json: DataTingkatHarga }) =>
      ambilData(
        id === undefined
          ? await api['tingkat-harga'].$post({ json })
          : await api['tingkat-harga'][':id'].$patch({ param: paramId(id), json }),
      ),
  );
}

export function useStatusTier() {
  return useMutasi(
    ['tingkat-harga', 'barang'],
    async ({ id, statusAktif }: { id: number; statusAktif: StatusAktif }) =>
      ambilData(
        await api['tingkat-harga'][':id'].status.$patch({
          param: paramId(id),
          json: { statusAktif },
        }),
      ),
  );
}

/** Membaca berkas Excel menjadi baris teks (belum divalidasi, belum disimpan). */
export function useBacaImport() {
  return useMutation({
    mutationFn: async (berkas: File): Promise<BacaImportBarang> => {
      const form = new FormData();
      form.set('berkas', berkas);
      const res = await fetch('/api/import/barang/baca', { method: 'POST', body: form });
      if (!res.ok) throw await galatDariRespons(res);
      return ((await res.json()) as { data: BacaImportBarang }).data;
    },
  });
}

/** Pratinjau import: tidak menyimpan apa pun. */
export function usePratinjauImport() {
  return useMutation({
    mutationFn: async (json: InputProsesImport) =>
      ambilData(await api.import.barang.pratinjau.$post({ json })),
  });
}

export function useSimpanImport() {
  return useMutasi(['barang'], async (json: InputProsesImport) =>
    ambilData(await api.import.barang.$post({ json })),
  );
}

// --- Isi massal data muatan lewat Excel (K-161) ---

export function useBacaMuatan() {
  return useMutation({
    mutationFn: async (berkas: File): Promise<BacaImportMuatan> => {
      const form = new FormData();
      form.set('berkas', berkas);
      const res = await fetch('/api/import/muatan/baca', { method: 'POST', body: form });
      if (!res.ok) throw await galatDariRespons(res);
      return ((await res.json()) as { data: BacaImportMuatan }).data;
    },
  });
}

/** Pratinjau: tidak menyimpan apa pun. */
export function usePratinjauMuatan() {
  return useMutation({
    mutationFn: async (json: InputProsesMuatan) =>
      ambilData(await api.import.muatan.pratinjau.$post({ json })),
  });
}

export function useSimpanMuatan() {
  return useMutasi(['barang'], async (json: InputProsesMuatan) =>
    ambilData(await api.import.muatan.$post({ json })),
  );
}
