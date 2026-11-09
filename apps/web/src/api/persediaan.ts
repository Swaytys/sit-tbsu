import type {
  DataPenerimaan,
  DataPenyesuaian,
  DetailPenyesuaian,
  InputHitungOpname,
  InputTimbangBarang,
  LembarHitung,
  JenisMutasi,
  JenisPenerimaan,
  JenisPenyesuaian,
  Kepemilikan,
  KondisiStok,
  StatusPenyesuaian,
  StatusStok,
  StatusSaranPesan,
  MetodeSaranPesan,
  TingkatLayananSaran,
} from '@sit/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambilData, ambilIsi, api, galatDariRespons, paramId } from './client';

/** Persediaan (Fase 4): penerimaan barang, penyesuaian, posisi dan kartu stok. */

export type ParamDaftarPenerimaan = {
  cari: string;
  jenis: JenisPenerimaan | null;
  /** K-225: hanya pembelian tanpa order pembelian. */
  tanpaOrder?: boolean;
  dari: string;
  sampai: string;
  halaman: number;
  perHalaman: number;
};

export function useDaftarPenerimaan(p: ParamDaftarPenerimaan) {
  return useQuery({
    queryKey: ['penerimaan', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.penerimaan.$get({
          query: {
            cari: p.cari || undefined,
            jenis: p.jenis ?? undefined,
            tanpaOrder: p.tanpaOrder ? 'true' : undefined,
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

export function useDetailPenerimaan(id: number) {
  return useQuery({
    queryKey: ['penerimaan', 'detail', id],
    queryFn: async () => ambilData(await api.penerimaan[':id'].$get({ param: { id: String(id) } })),
  });
}

/** Menyimpan penerimaan; stok dan harga barang ikut berubah, jadi daftar barang dimuat ulang. */
export function useSimpanPenerimaan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: DataPenerimaan) => ambilData(await api.penerimaan.$post({ json })),
    onSuccess: () =>
      Promise.all(
        ['penerimaan', 'barang', 'persediaan', 'order-pembelian'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
}

// --- Penyesuaian stok ---

/** K-240: ringkasan opname bertahap (kelas ABC, jatuh tempo, akurasi). */
export function useRingkasanOpname() {
  return useQuery({
    queryKey: ['penyesuaian', 'opname', 'ringkasan'],
    queryFn: async () => ambilData(await api.opname.ringkasan.$get()),
  });
}

/** K-240/K-227: susun daftar hitung harian acak (draf OPNAME) untuk satu penghitung. */
export function useSusunDaftarHarian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: { jumlah: number; idPenghitung: number }) =>
      ambilData(await api.opname['daftar-harian'].$post({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penyesuaian'] }),
  });
}

/** K-227: pengguna yang boleh menghitung opname (pilihan penugasan). */
export function usePenghitungOpname(aktif = true) {
  return useQuery({
    queryKey: ['penyesuaian', 'opname', 'penghitung'],
    queryFn: async () => ambilData(await api.opname.penghitung.$get()),
    enabled: aktif,
  });
}

/** K-227: lembar opname yang bisa dikerjakan pengguna ini. */
export function useTugasOpname(aktif = true) {
  return useQuery({
    queryKey: ['penyesuaian', 'opname', 'tugas'],
    queryFn: async () => ambilData(await api.opname.tugas.$get()),
    enabled: aktif,
  });
}

/** K-227: kinerja opname (akurasi per bulan, kelas, penghitung, sebab). */
export function useKinerjaOpname(aktif = true) {
  return useQuery({
    queryKey: ['penyesuaian', 'opname', 'kinerja'],
    queryFn: async () => ambilData(await api.opname.kinerja.$get()),
    enabled: aktif,
  });
}

/** K-227: lembar hitung (hitung buta) satu dokumen opname. */
export function useLembarHitung(id: number | null) {
  return useQuery({
    queryKey: ['penyesuaian', 'opname', 'lembar', id],
    queryFn: async () =>
      ambilData(await api.opname[':id'].lembar.$get({ param: paramId(id ?? 0) })),
    enabled: id !== null,
  });
}

export function useMulaiHitung() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      ambilData(await api.opname[':id'].mulai.$post({ param: paramId(id) })),
    onSuccess: (lembar) => {
      qc.setQueryData(['penyesuaian', 'opname', 'lembar', lembar.id], lembar);
      return qc.invalidateQueries({ queryKey: ['penyesuaian', 'opname', 'tugas'] });
    },
  });
}

export function useCatatHitung() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, json }: { id: number; json: InputHitungOpname }) =>
      ambilData(await api.opname[':id'].hitung.$post({ param: paramId(id), json })),
    // Baris yang baru dihitung diganti langsung (lembar panjang tidak dimuat ulang tiap Enter).
    onSuccess: (baru, { id }) => {
      qc.setQueryData<LembarHitung>(['penyesuaian', 'opname', 'lembar', id], (lama) =>
        lama
          ? { ...lama, baris: lama.baris.map((b) => (b.idBarang === baru.idBarang ? baru : b)) }
          : lama,
      );
      return Promise.all(
        [
          ['penyesuaian', 'detail', id],
          ['penyesuaian', 'opname', 'tugas'],
          ['penyesuaian', 'opname', 'ringkasan'],
        ].map((queryKey) => qc.invalidateQueries({ queryKey })),
      );
    },
  });
}

export function useTugaskanOpname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idPenghitung }: { id: number; idPenghitung: number | null }) =>
      ambilData(
        await api.opname[':id'].penghitung.$patch({ param: paramId(id), json: { idPenghitung } }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penyesuaian'] }),
  });
}

/** K-227: data timbang barang (berat sekian buah). */
export function useAturTimbang() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ idBarang, json }: { idBarang: number; json: InputTimbangBarang }) =>
      ambilData(await api.opname.barang[':id'].timbang.$put({ param: paramId(idBarang), json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barang'] }),
  });
}

export type ParamDaftarPenyesuaian = {
  cari: string;
  jenis: JenisPenyesuaian | null;
  status: StatusPenyesuaian | null;
  halaman: number;
  perHalaman: number;
};

export function useDaftarPenyesuaian(p: ParamDaftarPenyesuaian) {
  return useQuery({
    queryKey: ['penyesuaian', 'daftar', p],
    queryFn: async () =>
      ambilIsi(
        await api.penyesuaian.$get({
          query: {
            cari: p.cari || undefined,
            jenis: p.jenis ?? undefined,
            status: p.status ?? undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDetailPenyesuaian(id: number | null) {
  return useQuery({
    queryKey: ['penyesuaian', 'detail', id],
    queryFn: async () =>
      ambilData(await api.penyesuaian[':id'].$get({ param: { id: String(id) } })),
    enabled: id !== null,
  });
}

/** Mutasi penyesuaian memuat ulang daftar penyesuaian, barang (stok), dan persediaan. */
function useMutasiPersediaan<TInput, THasil>(fn: (input: TInput) => Promise<THasil>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['penyesuaian', 'barang', 'persediaan'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      ),
  });
}

export function useSimpanPenyesuaian() {
  return useMutasiPersediaan(async ({ id, json }: { id?: number; json: DataPenyesuaian }) =>
    ambilData(
      id === undefined
        ? await api.penyesuaian.$post({ json })
        : await api.penyesuaian[':id'].$put({ param: paramId(id), json }),
    ),
  );
}

export function useSelesaikanPenyesuaian() {
  return useMutasiPersediaan(async (id: number) =>
    ambilData(await api.penyesuaian[':id'].selesai.$post({ param: paramId(id) })),
  );
}

export function useBatalkanPenyesuaian() {
  return useMutasiPersediaan(async (id: number) =>
    ambilData(await api.penyesuaian[':id'].batal.$post({ param: paramId(id) })),
  );
}

export function useBuatLembarOpname() {
  return useMutasiPersediaan(async (json: { idKategori: number | null }) =>
    ambilData(await api.penyesuaian['lembar-opname'].$post({ json })),
  );
}

export function useImporSaldoAwal() {
  return useMutasiPersediaan(async (berkas: File): Promise<DetailPenyesuaian> => {
    const form = new FormData();
    form.set('berkas', berkas);
    const res = await fetch('/api/penyesuaian/saldo-awal/impor', { method: 'POST', body: form });
    if (!res.ok) throw await galatDariRespons(res);
    return ((await res.json()) as { data: DetailPenyesuaian }).data;
  });
}

// --- Posisi stok, mutasi, kartu stok ---

export type ParamDaftarStok = {
  cari: string;
  idKategori: number | null;
  statusStok: StatusStok | null;
  kepemilikan: Kepemilikan | null;
  halaman: number;
  perHalaman: number;
};

/** Query string yang sama untuk daftar dan ekspor posisi stok. */
export function queryStok(p: Omit<ParamDaftarStok, 'halaman' | 'perHalaman'>) {
  return {
    cari: p.cari || undefined,
    idKategori: p.idKategori === null ? undefined : String(p.idKategori),
    statusStok: p.statusStok ?? undefined,
    kepemilikan: p.kepemilikan ?? undefined,
  };
}

export function useDaftarStok(p: ParamDaftarStok) {
  return useQuery({
    queryKey: ['persediaan', 'stok', p],
    queryFn: async () =>
      ambilIsi(
        await api.stok.$get({
          query: {
            ...queryStok(p),
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export type ParamDaftarMutasi = {
  cari: string;
  idBarang: number | null;
  jenis: JenisMutasi | null;
  kepemilikan?: Kepemilikan | null;
  kondisi?: KondisiStok | null;
  dari: string;
  sampai: string;
  halaman: number;
  perHalaman: number;
};

export function useDaftarMutasi(p: ParamDaftarMutasi) {
  return useQuery({
    queryKey: ['persediaan', 'mutasi', p],
    queryFn: async () =>
      ambilIsi(
        await api.stok.mutasi.$get({
          query: {
            cari: p.cari || undefined,
            idBarang: p.idBarang === null ? undefined : String(p.idBarang),
            jenis: p.jenis ?? undefined,
            dari: p.dari || undefined,
            sampai: p.sampai || undefined,
            kepemilikan: p.kepemilikan ?? undefined,
            kondisi: p.kondisi ?? undefined,
            halaman: String(p.halaman),
            perHalaman: String(p.perHalaman),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useKartuStok(
  idBarang: number | null,
  p: { kondisi: KondisiStok; dari: string; sampai: string },
) {
  return useQuery({
    queryKey: ['persediaan', 'kartu', idBarang, p],
    queryFn: async () =>
      ambilData(await api.stok.kartu[':id'].$get({ param: { id: String(idBarang) }, query: p })),
    enabled: idBarang !== null && p.dari !== '' && p.sampai !== '' && p.dari <= p.sampai,
  });
}

// --- Peringatan stok (ST2/ST3) ---

/** Notifikasi topbar; dihitung ulang tiap menit dan saat jendela kembali aktif. */
export function useNotifikasi() {
  return useQuery({
    queryKey: ['persediaan', 'notifikasi'],
    queryFn: async () => ambilData(await api.notifikasi.$get()),
    refetchInterval: 60_000,
  });
}

export function usePeringatanStok(aktif: boolean) {
  return useQuery({
    queryKey: ['persediaan', 'peringatan'],
    queryFn: async () => ambilData(await api.dashboard['peringatan-stok'].$get()),
    enabled: aktif,
  });
}

// --- Rekomendasi pemesanan ulang (K-113) ---

/** Saran pesan: dihitung server setiap kali diminta dari penjualan N hari terakhir dan parameter pemasok. */
export type SaringSaranPesan = {
  tampil: 'PERLU' | 'SEMUA' | StatusSaranPesan;
  idPemasok?: number | undefined;
  idKategori?: number | undefined;
  cari?: string | undefined;
  /** K-127. */
  metode: MetodeSaranPesan;
  layanan: TingkatLayananSaran;
};

export function useSaranPesan(p: SaringSaranPesan) {
  return useQuery({
    queryKey: ['persediaan', 'saran-pesan', p],
    queryFn: async () =>
      ambilData(
        await api['saran-pesan'].$get({
          query: {
            tampil: p.tampil,
            ...(p.idPemasok ? { idPemasok: String(p.idPemasok) } : {}),
            ...(p.idKategori ? { idKategori: String(p.idKategori) } : {}),
            ...(p.cari ? { cari: p.cari } : {}),
            metode: p.metode,
            layanan: String(p.layanan),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}
