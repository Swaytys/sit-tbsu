import {
  bolehLihatLaporan,
  DAFTAR_LAPORAN,
  GRUP_LAPORAN,
  infoLaporan,
  JENIS_LAPORAN,
  type JenisLaporan,
} from '@sit/shared';
import { Download, FileText, Printer, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useSearchParams } from 'react-router';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { kueriLaporan, useCatatCetakLaporan, useDokumenLaporan } from '@/api/laporan';
import { useTampilanToko } from '@/api/pengaturan';
import { AreaCetak } from '@/components/area-cetak';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DokumenLaporanFormal } from './dokumen-laporan';
import { teksCss } from './format-laporan';
import { paramAwal, periksaParam } from './param';
import { SaringLaporan } from './saring-laporan';

/** Kunci URL yang hanya untuk tampilan (nama barang/pelanggan terpilih), tidak dikirim ke API. */
const TAMPILAN = (k: string) => k.startsWith('_') || k === 'laporan';

/** Laporan operasional (docs/01 §5.9, rancangan KP §5.5.6.15): daftar per kelompok, saringan, dokumen. */
/** Lebar elemen (px), diperbarui saat ukuran berubah. */
function useLebar(ref: RefObject<HTMLDivElement | null>): number {
  const [lebar, setLebar] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const amati = new ResizeObserver(([e]) => setLebar(e?.contentRect.width ?? 0));
    amati.observe(el);
    return () => amati.disconnect();
  }, [ref]);
  return lebar;
}

/** Skala pratinjau: kertas A4 (96 dpi) diperkecil agar muat di wadah, tidak pernah diperbesar. */
function skalaPratinjau(lebarWadah: number, orientasi: 'potret' | 'lanskap'): number {
  const lebarKertas = ((orientasi === 'lanskap' ? 297 : 210) / 25.4) * 96;
  if (lebarWadah <= 0) return 1;
  return Math.min(1, lebarWadah / lebarKertas);
}

export function HalamanLaporan() {
  const wadahPratinjau = useRef<HTMLDivElement>(null);
  const lebarWadah = useLebar(wadahPratinjau);
  const pengguna = usePengguna();
  const toko = useTampilanToko().data;
  const bolehEkspor = pengguna.izin.includes('laporan.ekspor');
  const tersedia = DAFTAR_LAPORAN.filter((l) => bolehLihatLaporan(pengguna.izin, l.kode));
  const [url, setUrl] = useSearchParams();
  const diminta = url.get('laporan');
  const kode: JenisLaporan =
    diminta &&
    (JENIS_LAPORAN as readonly string[]).includes(diminta) &&
    tersedia.some((l) => l.kode === diminta)
      ? (diminta as JenisLaporan)
      : (tersedia[0]?.kode ?? 'penjualan');

  const semua = Object.fromEntries(url.entries());
  const param = Object.fromEntries(Object.entries(semua).filter(([k]) => !TAMPILAN(k)));
  const galat = periksaParam(kode, param);
  const dokumen = useDokumenLaporan(kode, param, galat === null);
  const catatCetak = useCatatCetakLaporan();
  const [mencetak, setMencetak] = useState(false);

  // Laporan baru dibuka atau parameternya belum lengkap (mis. tautan /laporan?laporan=penjualan):
  // lengkapi dengan nilai awal tanpa menimpa yang sudah ada.
  useEffect(() => {
    const awal = paramAwal(kode);
    const sama = url.get('laporan') === kode;
    if (sama && Object.keys(awal).every((k) => url.has(k))) return;
    const baru = new URLSearchParams(sama ? url : undefined);
    baru.set('laporan', kode);
    for (const [k, v] of Object.entries(awal)) if (!baru.has(k)) baru.set(k, v);
    setUrl(baru, { replace: true });
  }, [kode, url, setUrl]);

  useEffect(() => {
    if (!mencetak) return;
    const t = setTimeout(() => {
      window.print();
      setMencetak(false);
    }, 200);
    return () => clearTimeout(t);
  }, [mencetak]);

  function pilihLaporan(k: JenisLaporan) {
    setUrl({ laporan: k, ...paramAwal(k) });
  }

  function ubah(perubahan: Record<string, string | null>) {
    const baru = new URLSearchParams(url);
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null || v === '') baru.delete(k);
      else baru.set(k, v);
    }
    setUrl(baru, { replace: true });
  }

  const d = dokumen.data?.kode === kode ? dokumen.data : undefined;
  const hrefEkspor = `/api/laporan/ekspor/${kode}?${kueriLaporan(param)}`;

  function cetak() {
    if (!d) return;
    setMencetak(true);
    catatCetak.mutate({ kode, keterangan: d.subjudul[0] ?? '' });
  }

  const cssCetak = d
    ? `@page { size: A4 ${d.orientasi === 'lanskap' ? 'landscape' : 'portrait'}; margin: 14mm 12mm 16mm;
  @bottom-left { content: "${teksCss(`${toko?.namaToko ?? ''} · ${d.judul}`)}"; font-size: 8pt; color: #475569; }
  @bottom-right { content: "Halaman " counter(page) " dari " counter(pages); font-size: 8pt; color: #475569; } }
.area-cetak .dokumen-laporan { font-size: 9.5pt; }
.area-cetak * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`
    : '';

  return (
    <div className="flex gap-4 p-6">
      <aside className="w-64 shrink-0">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-3 text-sm font-bold tracking-wide text-slate-800 uppercase">
            <FileText className="size-4 text-blue-600" /> Daftar Laporan
          </div>
          <nav className="space-y-3 p-2" aria-label="Daftar laporan">
            {(Object.keys(GRUP_LAPORAN) as (keyof typeof GRUP_LAPORAN)[]).map((g) => {
              const isi = tersedia.filter((l) => l.grup === g);
              if (isi.length === 0) return null;
              return (
                <div key={g}>
                  <div className="px-2 py-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    {GRUP_LAPORAN[g]}
                  </div>
                  {isi.map((l) => (
                    <button
                      key={l.kode}
                      type="button"
                      onClick={() => pilihLaporan(l.kode)}
                      aria-current={kode === l.kode ? 'page' : undefined}
                      className={cn(
                        'w-full rounded-md px-2 py-1.5 text-left text-sm',
                        kode === l.kode
                          ? 'bg-blue-50 font-semibold text-blue-700'
                          : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      {l.nama}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        </Card>
      </aside>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{infoLaporan(kode).judul}</h1>
            <p className="text-sm text-slate-500">{infoLaporan(kode).deskripsi}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              onClick={() => void dokumen.refetch()}
              disabled={galat !== null || dokumen.isFetching}
            >
              <RefreshCw className={cn(dokumen.isFetching && 'animate-spin')} /> Muat ulang
            </Button>
            {bolehEkspor && (
              <>
                <Button variant="outline" onClick={cetak} disabled={!d || dokumen.isFetching}>
                  <Printer /> Cetak / PDF
                </Button>
                <Button asChild>
                  <a
                    href={d ? hrefEkspor : undefined}
                    download
                    aria-disabled={!d}
                    className={cn(!d && 'pointer-events-none opacity-50')}
                  >
                    <Download /> Ekspor Excel
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="gap-0 p-4">
          <SaringLaporan kode={kode} p={semua} ubah={ubah} />
          {galat && kode !== 'detail-invoice' && kode !== 'kartu-stok' && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {galat}
            </p>
          )}
        </Card>

        <div ref={wadahPratinjau} className="overflow-hidden rounded-lg bg-slate-100 p-6">
          {galat !== null && (kode === 'kartu-stok' || kode === 'detail-invoice') ? (
            <p className="py-16 text-center text-sm text-slate-500">
              {kode === 'kartu-stok'
                ? 'Pilih barang untuk menampilkan kartu stoknya.'
                : 'Cari dan pilih transaksi untuk menampilkan rinciannya.'}
            </p>
          ) : dokumen.error ? (
            <div className="py-16 text-center text-sm">
              <p className="text-red-600">{pesanGalat(dokumen.error)}</p>
              <Button variant="outline" className="mt-3" onClick={() => void dokumen.refetch()}>
                Coba lagi
              </Button>
            </div>
          ) : d && toko ? (
            <div
              className={cn(dokumen.isFetching && 'opacity-60 transition-opacity')}
              // Kertas diperkecil agar muat di layar; isi dan tata letaknya sama dengan hasil cetak.
              style={{ zoom: skalaPratinjau(lebarWadah, d.orientasi) }}
            >
              <DokumenLaporanFormal d={d} toko={toko} />
            </div>
          ) : (
            <div className="mx-auto max-w-[900px] space-y-3 bg-white p-10">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}
        </div>
      </div>

      {mencetak && d && toko && (
        <AreaCetak ukuranKertas="A4" css={cssCetak}>
          <DokumenLaporanFormal d={d} toko={toko} cetak />
        </AreaCetak>
      )}
    </div>
  );
}
