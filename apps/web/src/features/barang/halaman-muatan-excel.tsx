import type {
  BacaImportMuatan,
  BarisImportMentah,
  BarisImportMuatan,
  HasilImportMuatan,
  StatusBarisMuatan,
} from '@sit/shared';
import { AlertTriangle, ArrowLeft, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useBacaMuatan, usePratinjauMuatan, useSimpanMuatan } from '@/api/barang';
import { GalatApi, pesanGalat } from '@/api/client';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const GAYA_STATUS: Record<StatusBarisMuatan | 'MEMERIKSA', { label: string; kelas: string }> = {
  BERUBAH: { label: 'Berubah', kelas: 'border-blue-200 bg-blue-50 text-blue-700' },
  DISIMPAN: { label: 'Disimpan', kelas: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  SAMA: { label: 'Tetap', kelas: 'border-slate-200 bg-slate-50 text-slate-600' },
  GALAT: { label: 'Galat', kelas: 'border-red-200 bg-red-50 text-red-700' },
  MEMERIKSA: { label: 'Memeriksa…', kelas: 'border-slate-200 bg-white text-slate-500' },
};

type Baris = BarisImportMentah & { hasil: BarisImportMuatan | null };

function hasilDariGalat(err: unknown): HasilImportMuatan | null {
  if (!(err instanceof GalatApi)) return null;
  const detail = err.detail as { hasil?: HasilImportMuatan } | undefined;
  return detail?.hasil ?? null;
}

function gabung(baris: Baris[], hasil: HasilImportMuatan): Baris[] {
  const per = new Map(hasil.baris.map((h) => [h.nomorBaris, h]));
  return baris.map((b) => ({ ...b, hasil: per.get(b.nomorBaris) ?? b.hasil }));
}

/**
 * K-161: isi massal data muatan (berat, ukuran kemasan, curah) barang yang sudah ada lewat Excel. Unduh berkas →
 * isi → unggah → pratinjau (kolom Perubahan) → simpan. Tidak ada yang tersimpan sebelum Simpan ditekan.
 */
export function HalamanMuatanExcel() {
  const navigasi = useNavigate();
  const bacaBerkas = useBacaMuatan();
  const pratinjau = usePratinjauMuatan();
  const simpan = useSimpanMuatan();
  const [dibaca, setDibaca] = useState<BacaImportMuatan | null>(null);
  const [baris, setBaris] = useState<Baris[]>([]);

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
        kolom: hasilBaca.kolom,
        baris: hasilBaca.baris,
      });
      setBaris(gabung(awal, h));
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  async function simpanSemua() {
    if (!dibaca) return;
    try {
      const h = await simpan.mutateAsync({
        namaBerkas: dibaca.namaBerkas,
        kolom: dibaca.kolom,
        baris: baris.map(({ nomorBaris, nilai }) => ({ nomorBaris, nilai })),
      });
      toast.success(`Data muatan ${h.ringkasan.disimpan} barang disimpan.`);
      void navigasi('/barang');
    } catch (err) {
      const h = hasilDariGalat(err);
      if (h) setBaris((kini) => gabung(kini, h));
      toast.error(pesanGalat(err));
    }
  }

  const hitung = (s: StatusBarisMuatan) => baris.filter((b) => b.hasil?.status === s).length;
  const berubah = hitung('BERUBAH');
  const galat = hitung('GALAT');
  const memeriksa = baris.some((b) => b.hasil === null);
  const bisaSimpan = baris.length > 0 && !memeriksa && galat === 0 && berubah > 0;

  const kolom: KolomTabel<Baris>[] = [
    { kunci: 'baris', judul: 'Baris', className: 'w-16 text-right', sel: (b) => b.nomorBaris },
    {
      kunci: 'kode',
      judul: 'Kode',
      className: 'w-32',
      sel: (b) => <span className="font-mono text-xs">{b.nilai.kode ?? '—'}</span>,
    },
    {
      kunci: 'nama',
      judul: 'Nama barang',
      sel: (b) => b.hasil?.namaBarang || b.nilai.nama_barang || '—',
    },
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
      kunci: 'rincian',
      judul: 'Perubahan / keterangan',
      sel: (b) => {
        const daftar = b.hasil ? [...b.hasil.perubahan, ...b.hasil.pesan] : [];
        if (daftar.length === 0) return <span className="text-slate-400">—</span>;
        return (
          <ul className="list-disc space-y-0.5 pl-4 text-xs">
            {b.hasil?.perubahan.map((p) => (
              <li key={p} className="text-slate-700">
                {p}
              </li>
            ))}
            {b.hasil?.pesan.map((p) => (
              <li key={p} className="text-red-700">
                {p}
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      kunci: 'aksi',
      judul: <span className="sr-only">Aksi</span>,
      className: 'w-14 text-right',
      sel: (b) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Buang baris ${b.nomorBaris}`}
          title="Buang baris ini (barangnya tidak diubah)"
          onClick={() => setBaris((kini) => kini.filter((x) => x.nomorBaris !== b.nomorBaris))}
        >
          <Trash2 className="text-slate-500" />
        </Button>
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
          <h1 className="text-xl font-semibold text-slate-900">Data muatan lewat Excel</h1>
          <p className="text-sm text-slate-500">
            Isi berat dan ukuran kemasan banyak barang sekaligus. Hanya data muatan yang diubah.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Unduh daftar barang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              Berkas berisi kode, nama, satuan dasar, dan data muatan sekarang. Isi angka untuk{' '}
              <b>1 satuan dasar</b>: kg/cm/m³, atau tulis satuannya, mis. <b>500 g</b>,{' '}
              <b>700 mm</b>, <b>500 L</b>. Lembar Petunjuk menjelaskan setiap kolom.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href="/api/import/muatan/berkas?belum=1" download>
                  <Download /> Yang belum lengkap
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/api/import/muatan/berkas" download>
                  <Download /> Semua barang
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
              Berkas diperiksa dulu. Kolom <b>Perubahan</b> menunjukkan nilai lama → baru; baris
              bergalat diperbaiki di Excel lalu diunggah ulang, atau dibuang dari daftar.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <label className="relative cursor-pointer">
                  <Upload /> Pilih berkas .xlsx
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    aria-label="Berkas Excel data muatan"
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
          <div className="flex flex-wrap items-center gap-3 border-b p-3">
            <span className="text-sm font-medium text-slate-700">Pratinjau</span>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className={GAYA_STATUS.BERUBAH.kelas}>
                Berubah {berubah}
              </Badge>
              <Badge variant="outline" className={GAYA_STATUS.SAMA.kelas}>
                Tetap {hitung('SAMA')}
              </Badge>
              <Badge variant="outline" className={GAYA_STATUS.GALAT.kelas}>
                Galat {galat}
              </Badge>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {galat > 0 && (
                <span className="text-xs text-red-600">
                  Perbaiki atau buang baris bergalat sebelum menyimpan.
                </span>
              )}
              <Button disabled={!bisaSimpan || simpan.isPending} onClick={() => void simpanSemua()}>
                {simpan.isPending ? 'Menyimpan…' : `Simpan ${berubah} perubahan`}
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
    </div>
  );
}
