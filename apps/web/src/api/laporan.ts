import type { DokumenLaporan, JenisLaporan } from '@sit/shared';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ambilData, api } from './client';

/*
 * Laporan (Fase 7). Semua laporan berbentuk `DokumenLaporan` yang sama, sehingga diambil lewat satu
 * fungsi dengan query string yang juga dipakai tautan ekspor Excel (angka layar = angka berkas).
 */

/** Parameter laporan sebagai query string; nilai kosong dibuang. */
export function kueriLaporan(param: Record<string, string | undefined>): string {
  const isi = Object.entries(param).filter((e): e is [string, string] => !!e[1]);
  return new URLSearchParams(isi).toString();
}

/** Path API laporan, mis. `stok-rekap` atau `detail-invoice/12`. */
export function pathLaporan(kode: JenisLaporan, param: Record<string, string | undefined>) {
  return kode === 'detail-invoice' ? `detail-invoice/${param.id ?? ''}` : kode;
}

export function useDokumenLaporan(
  kode: JenisLaporan,
  param: Record<string, string | undefined>,
  aktif: boolean,
) {
  const kueri = kueriLaporan(kode === 'detail-invoice' ? {} : param);
  const path = pathLaporan(kode, param);
  return useQuery({
    queryKey: ['laporan', path, kueri],
    queryFn: async () =>
      ambilData<DokumenLaporan>(
        await fetch(`/api/laporan/${path}${kueri ? `?${kueri}` : ''}`, {
          credentials: 'same-origin',
        }),
      ),
    enabled: aktif,
    placeholderData: keepPreviousData,
    // Laporan dihitung saat diminta; tombol "Muat ulang" untuk angka terbaru.
    staleTime: 30_000,
  });
}

export function useCariInvoiceLaporan(p: { cari: string; dari?: string; sampai?: string }) {
  return useQuery({
    queryKey: ['laporan', 'cari-invoice', p],
    queryFn: async () =>
      ambilData(
        await api.laporan['detail-invoice'].$get({
          query: { cari: p.cari, dari: p.dari || undefined, sampai: p.sampai || undefined },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Mencatat cetak PDF di log aktivitas (pencetakan sendiri dilakukan peramban). */
export function useCatatCetakLaporan() {
  return useMutation({
    mutationFn: async (json: { kode: JenisLaporan; keterangan: string }) =>
      ambilData(await api.laporan.cetak.$post({ json })),
  });
}

// --- Dashboard ---

export function useRingkasanDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'ringkasan'],
    queryFn: async () => ambilData(await api.dashboard.ringkasan.$get()),
    refetchInterval: 60_000,
  });
}

export function useAktivitasDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'aktivitas'],
    queryFn: async () => ambilData(await api.dashboard.aktivitas.$get()),
    refetchInterval: 60_000,
  });
}
