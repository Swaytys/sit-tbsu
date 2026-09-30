import type {
  BacaImportBarang,
  BarisImportBarang,
  BarisImportMentah,
  HasilImportBarang,
  StatusBarisImport,
} from '@sit/shared';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useBacaImport, usePratinjauImport, useSimpanImport } from '@/api/barang';
import { GalatApi, pesanGalat } from '@/api/client';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogBarisImport } from './dialog-baris-import';

const GAYA_STATUS: Record<StatusBarisImport | 'MEMERIKSA', { label: string; kelas: string }> = {
  SIAP: { label: 'Siap', kelas: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  DISIMPAN: { label: 'Disimpan', kelas: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  DILEWATI: { label: 'Dilewati', kelas: 'border-slate-200 bg-slate-50 text-slate-600' },
  GALAT: { label: 'Galat', kelas: 'border-red-200 bg-red-50 text-red-700' },
  MEMERIKSA: { label: 'Memeriksa…', kelas: 'border-slate-200 bg-white text-slate-500' },
};

type Baris = BarisImportMentah & { hasil: BarisImportBarang | null };

/** Hasil pratinjau yang ikut dikirim API saat simpan ditolak karena masih ada galat. */
function hasilDariGalat(err: unknown): HasilImportBarang | null {
  if (!(err instanceof GalatApi)) return null;
  const detail = err.detail as { hasil?: HasilImportBarang } | undefined;
  return detail?.hasil ?? null;
}

function gabung(baris: Baris[], hasil: HasilImportBarang): Baris[] {
  const per = new Map(hasil.baris.map((h) => [h.nomorBaris, h]));
  return baris.map((b) => ({ ...b, hasil: per.get(b.nomorBaris) ?? b.hasil }));
}

/**
 * Import Excel barang (K-056, K-061, K-064): unduh templat, unggah, pratinjau, perbaiki baris bergalat di
 * layar, simpan. Tidak ada yang disimpan sebelum tombol Simpan ditekan.
 */
export function HalamanImportBarang() {
  const navigasi = useNavigate();
  const bacaBerkas = useBacaImport();
  const pratinjau = usePratinjauImport();
  const simpan = useSimpanImport();
  const [dibaca, setDibaca] = useState<BacaImportBarang | null>(null);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [sunting, setSunting] = useState<Baris | null>(null);

  async function pilihBerkas(f: File | null) {
    setDibaca(null);
    setBaris([]);
    if (!f) return;
    try {
      const hasilBaca = await bacaBerkas.mutateAsync(f);
      setDibaca(hasilBaca);
      const awal = hasilBaca.baris.map((b) => ({ ...b, hasil: null }));
      setBaris(awal);
      const h = await pratinjau.mutateAsync({
        namaBerkas: hasilBaca.namaBerkas,
        baris: hasilBaca.baris,
      });
      setBaris(gabung(awal, h));
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  /** Periksa ulang satu baris setelah disunting; kode baris lain dikirim untuk cek kode ganda. */
  async function simpanSuntingan(nomorBaris: number, nilai: Record<string, string>) {
    setSunting(null);
    const baru = baris.map((b) => (b.nomorBaris === nomorBaris ? { ...b, nilai, hasil: null } : b));
    setBaris(baru);
    try {
      const h = await pratinjau.mutateAsync({
        namaBerkas: dibaca?.namaBerkas,
        baris: baru.filter((b) => b.nomorBaris === nomorBaris),
        kodeLain: baru
          .filter((b) => b.nomorBaris !== nomorBaris && b.nilai.kode)
          .map((b) => b.nilai.kode ?? ''),
      });
      setBaris((kini) => gabung(kini, h));
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  function hapusBaris(nomorBaris: number) {
    setBaris((kini) => kini.filter((b) => b.nomorBaris !== nomorBaris));
  }

  async function simpanSemua() {
    if (!dibaca) return;
    try {
      const h = await simpan.mutateAsync({
        namaBerkas: dibaca.namaBerkas,
        baris: baris.map(({ nomorBaris, nilai }) => ({ nomorBaris, nilai })),
      });
      toast.success(
        `${h.ringkasan.disimpan} barang ditambahkan` +
          (h.ringkasan.dilewati > 0 ? `, ${h.ringkasan.dilewati} dilewati.` : '.'),
      );
      void navigasi('/barang');
    } catch (err) {
      const h = hasilDariGalat(err);
      if (h) setBaris((kini) => gabung(kini, h));
      toast.error(pesanGalat(err));
    }
  }

  const hitung = (s: StatusBarisImport) => baris.filter((b) => b.hasil?.status === s).length;
  const siap = hitung('SIAP');
  const galat = hitung('GALAT');
  const memeriksa = baris.some((b) => b.hasil === null);
  const bisaSimpan = baris.length > 0 && !memeriksa && galat === 0 && siap > 0;

  const kolom: KolomTabel<Baris>[] = [
    { kunci: 'baris', judul: 'Baris', className: 'w-16 text-right', sel: (b) => b.nomorBaris },
    {
      kunci: 'kode',
      judul: 'Kode',
      className: 'w-32',
      sel: (b) => <span className="font-mono text-xs">{b.nilai.kode ?? '(otomatis)'}</span>,
    },
    { kunci: 'nama', judul: 'Nama barang', sel: (b) => b.nilai.nama_barang ?? '—' },
    {
      kunci: 'status',
      judul: 'Status',
      className: 'w-28',
      sel: (b) => {
        const g = GAYA_STATUS[b.hasil?.status ?? 'MEMERIKSA'];
        return (
          <Badge variant="outline" className={g.kelas}>
            {g.label}
          </Badge>
        );
      },
    },
    {
      kunci: 'pesan',
      judul: 'Keterangan',
      sel: (b) =>
        !b.hasil || b.hasil.pesan.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
            {b.hasil.pesan.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ),
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-24 text-right',
      sel: (b) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ubah baris ${b.nomorBaris}`}
            onClick={() => setSunting(b)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Buang baris ${b.nomorBaris}`}
            onClick={() => hapusBaris(b.nomorBaris)}
          >
            <Trash2 className="text-slate-500" />
          </Button>
        </div>
      ),
    },
  ];

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
              Templat <b>ringkas</b> berisi kolom yang paling sering dipakai; templat <b>lengkap</b>{' '}
              berisi semua kolom (harga tiap tier, atribut). Keduanya berisi daftar pilihan, lembar
              Contoh, dan Petunjuk.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href="/api/import/barang/templat?jenis=ringkas" download>
                  <Download /> Templat ringkas
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/api/import/barang/templat?jenis=lengkap" download>
                  <Download /> Templat lengkap
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Unggah berkas yang sudah diisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              Berkas diperiksa dulu (pratinjau). Baris bergalat bisa diubah atau dibuang langsung di
              tabel; belum ada yang disimpan sampai Anda menekan Simpan.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <label className="relative cursor-pointer">
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
              {dibaca && (
                <span className="flex items-center gap-1.5 text-slate-700">
                  <FileSpreadsheet className="size-4 text-emerald-600" /> {dibaca.namaBerkas}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {dibaca && dibaca.peringatan.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {dibaca.peringatan.map((p) => (
            <p key={p} className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" /> {p}
            </p>
          ))}
        </div>
      )}

      {(bacaBerkas.isPending || baris.length > 0) && (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex items-center gap-3 border-b p-3">
            <span className="text-sm font-medium text-slate-700">Pratinjau</span>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className={GAYA_STATUS.SIAP.kelas}>
                Siap {siap}
              </Badge>
              <Badge variant="outline" className={GAYA_STATUS.DILEWATI.kelas}>
                Dilewati {hitung('DILEWATI')}
              </Badge>
              <Badge variant="outline" className={GAYA_STATUS.GALAT.kelas}>
                Galat {galat}
              </Badge>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {galat > 0 && (
                <span className="text-xs text-red-600">
                  Ubah atau buang baris bergalat sebelum menyimpan.
                </span>
              )}
              <Button disabled={!bisaSimpan || simpan.isPending} onClick={() => void simpanSemua()}>
                {simpan.isPending ? 'Menyimpan…' : `Simpan ${siap} barang`}
              </Button>
            </div>
          </div>
          <DataTable
            kolom={kolom}
            data={baris.length > 0 ? baris : undefined}
            kunciBaris={(b) => b.nomorBaris}
            memuat={bacaBerkas.isPending}
            kosong="Semua baris sudah dibuang."
          />
        </Card>
      )}

      {sunting && dibaca && (
        <DialogBarisImport
          baris={sunting}
          kolom={dibaca.kolom}
          pesan={sunting.hasil?.pesan ?? []}
          onSimpan={(nilai) => void simpanSuntingan(sunting.nomorBaris, nilai)}
          onTutup={() => setSunting(null)}
        />
      )}
    </div>
  );
}
