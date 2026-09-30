import type { BarisImportBarang, HasilImportBarang, StatusBarisImport } from '@sit/shared';
import { ArrowLeft, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePratinjauImport, useSimpanImport } from '@/api/barang';
import { GalatApi, pesanGalat } from '@/api/client';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const GAYA_STATUS: Record<StatusBarisImport, { label: string; kelas: string }> = {
  SIAP: { label: 'Siap', kelas: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  DISIMPAN: { label: 'Disimpan', kelas: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  DILEWATI: { label: 'Dilewati', kelas: 'border-slate-200 bg-slate-50 text-slate-600' },
  GALAT: { label: 'Galat', kelas: 'border-red-200 bg-red-50 text-red-700' },
};

/** Hasil pratinjau yang ikut dikirim API saat simpan ditolak karena masih ada galat. */
function hasilDariGalat(err: unknown): HasilImportBarang | null {
  if (!(err instanceof GalatApi)) return null;
  const detail = err.detail as { hasil?: HasilImportBarang } | undefined;
  return detail?.hasil ?? null;
}

/** Import Excel barang (docs/07 Fase 3, K-056): unduh templat, unggah, pratinjau, simpan. */
export function HalamanImportBarang() {
  const navigasi = useNavigate();
  const pratinjau = usePratinjauImport();
  const simpan = useSimpanImport();
  const [berkas, setBerkas] = useState<File | null>(null);
  const [hasil, setHasil] = useState<HasilImportBarang | null>(null);

  async function pilihBerkas(f: File | null) {
    setBerkas(f);
    setHasil(null);
    if (!f) return;
    try {
      setHasil(await pratinjau.mutateAsync(f));
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  async function simpanSemua() {
    if (!berkas) return;
    try {
      const h = await simpan.mutateAsync(berkas);
      toast.success(
        `${h.ringkasan.disimpan} barang ditambahkan` +
          (h.ringkasan.dilewati > 0 ? `, ${h.ringkasan.dilewati} dilewati.` : '.'),
      );
      void navigasi('/barang');
    } catch (err) {
      const h = hasilDariGalat(err);
      if (h) setHasil(h);
      toast.error(pesanGalat(err));
    }
  }

  const kolom: KolomTabel<BarisImportBarang>[] = [
    { kunci: 'baris', judul: 'Baris', className: 'w-16 text-right', sel: (b) => b.nomorBaris },
    {
      kunci: 'kode',
      judul: 'Kode',
      className: 'w-32',
      sel: (b) => <span className="font-mono text-xs">{b.kode ?? '(otomatis)'}</span>,
    },
    { kunci: 'nama', judul: 'Nama barang', sel: (b) => b.namaBarang || '—' },
    {
      kunci: 'status',
      judul: 'Status',
      className: 'w-28',
      sel: (b) => (
        <Badge variant="outline" className={GAYA_STATUS[b.status].kelas}>
          {GAYA_STATUS[b.status].label}
        </Badge>
      ),
    },
    {
      kunci: 'pesan',
      judul: 'Keterangan',
      sel: (b) =>
        b.pesan.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
            {b.pesan.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ),
    },
  ];

  const r = hasil?.ringkasan;
  const bisaSimpan = r !== undefined && r.galat === 0 && r.siap > 0;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/barang" aria-label="Kembali ke daftar barang">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Import barang dari Excel</h1>
          <p className="text-sm text-slate-500">
            Hanya menambah barang baru. Baris dengan kode yang sudah ada dilewati.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Unduh templat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              Templat berisi kolom sesuai tier harga dan jenis atribut yang aktif, lembar Referensi
              (kategori, satuan, pemasok), dan lembar Petunjuk.
            </p>
            <Button variant="outline" asChild>
              <a href="/api/import/barang/templat" download>
                <Download /> Unduh templat Excel
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Unggah berkas yang sudah diisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              Berkas diperiksa dulu (pratinjau); belum ada yang disimpan sampai Anda menekan Simpan.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload /> Pilih berkas .xlsx
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    aria-label="Berkas Excel"
                    onChange={(e) => {
                      void pilihBerkas(e.target.files?.[0] ?? null);
                      e.target.value = '';
                    }}
                  />
                </label>
              </Button>
              {berkas && (
                <span className="flex items-center gap-1.5 text-slate-700">
                  <FileSpreadsheet className="size-4 text-emerald-600" /> {berkas.name}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {(pratinjau.isPending || hasil) && (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex items-center gap-3 border-b p-3">
            <span className="text-sm font-medium text-slate-700">Pratinjau</span>
            {r && (
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className={GAYA_STATUS.SIAP.kelas}>
                  Siap {r.siap}
                </Badge>
                <Badge variant="outline" className={GAYA_STATUS.DILEWATI.kelas}>
                  Dilewati {r.dilewati}
                </Badge>
                <Badge variant="outline" className={GAYA_STATUS.GALAT.kelas}>
                  Galat {r.galat}
                </Badge>
              </div>
            )}
            <div className="ml-auto flex items-center gap-3">
              {r && r.galat > 0 && (
                <span className="text-xs text-red-600">
                  Perbaiki baris bergalat di Excel lalu unggah ulang.
                </span>
              )}
              <Button disabled={!bisaSimpan || simpan.isPending} onClick={() => void simpanSemua()}>
                {simpan.isPending ? 'Menyimpan…' : `Simpan ${r?.siap ?? 0} barang`}
              </Button>
            </div>
          </div>
          <DataTable
            kolom={kolom}
            data={hasil?.baris}
            kunciBaris={(b) => b.nomorBaris}
            memuat={pratinjau.isPending}
            kosong="Berkas tidak berisi baris data."
          />
        </Card>
      )}
    </div>
  );
}
