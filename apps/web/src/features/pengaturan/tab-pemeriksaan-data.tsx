import { formatNoHp } from '@sit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Wand2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ambilData, api, pesanGalat } from '@/api/client';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/*
 * K-137 butir 3: Pengaturan › Pemeriksaan data (Admin/Owner). Data lama yang kemungkinan dobel atau formatnya
 * salah, dengan tautan ke datanya untuk diperbaiki; tombol rapikan No. HP otomatis.
 */

const HALAMAN = { pelanggan: '/pelanggan', pemasok: '/pemasok', barang: '/barang' } as const;
const LABEL = { pelanggan: 'Pelanggan', pemasok: 'Pemasok', barang: 'Barang' } as const;

export function TabPemeriksaanData() {
  const qc = useQueryClient();
  const hasil = useQuery({
    queryKey: ['pemeriksaan-data'],
    queryFn: async () => ambilData(await api['pemeriksaan-data'].$get()),
  });
  const rapikan = useMutation({
    mutationFn: async () => ambilData(await api['pemeriksaan-data']['rapikan-no-hp'].$post()),
    onSuccess: () => qc.invalidateQueries(),
  });
  const h = hasil.data;
  const bisaDirapikan = (h?.format ?? []).some((f) => f.alasan.includes('bisa dirapikan'));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-80">
          <h2 className="font-semibold text-slate-900">Pemeriksaan data</h2>
          <p className="text-sm text-slate-500">
            Data lama yang mungkin dobel atau formatnya salah. Data baru sudah dicegah otomatis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Penjelasan judul="Cara memakai pemeriksaan data">
            <ButirPenjelasan>
              <li>
                <b>Kemungkinan dobel</b>: nama sama setelah dirapikan (huruf besar/kecil, spasi,
                tanda baca, awalan Toko/CV/PT/Pak/Bu diabaikan) atau No. HP sama. Klik kodenya untuk
                membuka data itu; bila memang dobel, pakai salah satu dan nonaktifkan yang lain.
              </li>
              <li>
                <b>Format salah</b>: No. HP belum format internasional (+62…) atau nama berspasi
                berlebih. <b>Rapikan No. HP</b> memperbaiki semua yang bisa diperbaiki otomatis (0
                di depan diganti +62); sisanya diperbaiki manual.
              </li>
              <li>Nama tidak diubah otomatis; simpan ulang datanya untuk merapikan spasi.</li>
            </ButirPenjelasan>
          </Penjelasan>
          <Button variant="outline" size="sm" onClick={() => void hasil.refetch()}>
            <RefreshCw /> Periksa ulang
          </Button>
          <Button
            size="sm"
            disabled={!bisaDirapikan || rapikan.isPending}
            onClick={() =>
              void rapikan
                .mutateAsync()
                .then((r) =>
                  toast.success(
                    `${r.diubah} No. HP dirapikan.` +
                      (r.gagal.length > 0 ? ` ${r.gagal.length} perlu diperbaiki manual.` : ''),
                  ),
                )
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            <Wand2 /> Rapikan No. HP
          </Button>
        </div>
      </div>
      {hasil.isLoading && <p className="text-sm text-slate-500">Memeriksa…</p>}
      {h && (
        <>
          <Card className="gap-2 p-4" data-testid="kemungkinan-dobel">
            <h3 className="text-sm font-semibold text-slate-800">
              Kemungkinan dobel ({h.ganda.length} kelompok)
            </h3>
            {h.ganda.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada.</p>
            ) : (
              <ul className="divide-y text-sm">
                {h.ganda.map((g) => (
                  <li key={`${g.jenis}-${g.alasan}-${g.data[0]?.id}`} className="py-2">
                    <div className="text-xs text-slate-500">
                      {LABEL[g.jenis]} · {g.alasan}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {g.data.map((d) => (
                        <Link
                          key={d.id}
                          to={`${HALAMAN[g.jenis]}?cari=${encodeURIComponent(d.kode)}`}
                          className="text-blue-700 hover:underline"
                        >
                          <span className="font-mono text-xs">{d.kode}</span> {d.nama}
                          {d.noHp && ` · ${formatNoHp(d.noHp)}`}
                          {d.statusAktif !== 'AKTIF' && ' (nonaktif)'}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="gap-2 p-4" data-testid="format-salah">
            <h3 className="text-sm font-semibold text-slate-800">
              Format salah ({h.format.length})
            </h3>
            {h.format.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada.</p>
            ) : (
              <ul className="divide-y text-sm">
                {h.format.map((f) => (
                  <li key={`${f.jenis}-${f.id}`} className="flex flex-wrap gap-x-3 py-1.5">
                    <Link
                      to={`${HALAMAN[f.jenis]}?cari=${encodeURIComponent(f.kode)}`}
                      className="text-blue-700 hover:underline"
                    >
                      <span className="font-mono text-xs">{f.kode}</span> {f.nama}
                    </Link>
                    <span className="text-xs text-slate-500">{LABEL[f.jenis]}</span>
                    <span className="text-xs text-amber-800">{f.alasan}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
