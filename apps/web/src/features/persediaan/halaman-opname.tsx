import { formatRupiah, type KelasABC } from '@sit/shared';
import { ClipboardCheck, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useDaftarPenyesuaian, useRingkasanOpname, useSusunDaftarHarian } from '@/api/persediaan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWaktu } from '@/lib/format';
import { BadgeStatusPenyesuaian } from './tab-penyesuaian';

const KET_KELAS: Record<KelasABC, string> = {
  A: 'Penyumbang 80% nilai penjualan (paling penting)',
  B: '15% berikutnya',
  C: 'Sisanya, termasuk yang jarang laku',
};

/**
 * K-240/K-227: Stok Opname di halaman sendiri. Opname bertahap: barang dikelompokkan ABC menurut nilai penjualan 90
 * hari; tiap kelas punya selang hitung. Kepala Toko/Owner menyusun daftar hitung harian acak; penghitung mengisi
 * tanpa melihat stok sistem (hitung buta); selisih diselesaikan Kepala Toko/Owner dengan sebabnya.
 */
export function HalamanOpname() {
  const r = useRingkasanOpname().data;
  const bolehAtur = usePengguna().izin.includes('persediaan.opname.atur');
  const bolehBuat = usePengguna().izin.includes('persediaan.penyesuaian.kelola');
  const susun = useSusunDaftarHarian();
  const navigasi = useNavigate();
  const [jumlah, setJumlah] = useState('20');
  const daftar = useDaftarPenyesuaian({
    cari: '',
    jenis: 'OPNAME',
    status: null,
    halaman: 1,
    perHalaman: 25,
  }).data?.data;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Stok Opname</h1>
        <p className="text-sm text-slate-500">
          Menghitung stok sedikit-sedikit tiap hari (opname bertahap), bukan sekaligus sehari penuh.
          Barang penting dihitung lebih sering; pilihan barang harian acak sehingga tidak bisa
          ditebak.
        </p>
      </div>

      {!r ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <div className="grid gap-3 md:grid-cols-4" data-testid="ringkasan-abc">
          {r.kelas.map((k) => (
            <Card key={k.kelas} className="gap-1 p-3">
              <p className="text-xs font-medium text-slate-500">
                Kelas {k.kelas} · dihitung tiap {k.selangHari} hari
              </p>
              <p className="text-2xl font-bold tabular-nums">{k.jumlah} barang</p>
              <p className={k.jatuhTempo > 0 ? 'text-sm text-amber-700' : 'text-sm text-slate-500'}>
                {k.jatuhTempo} jatuh tempo hitung
              </p>
              <p className="text-xs text-slate-500">{KET_KELAS[k.kelas]}</p>
            </Card>
          ))}
          <Card className="gap-1 p-3">
            <p className="text-xs font-medium text-slate-500">Akurasi catatan 30 hari</p>
            <p className="text-2xl font-bold tabular-nums">
              {r.akurasi30Hari === null ? '—' : `${r.akurasi30Hari}%`}
            </p>
            <p className="text-xs text-slate-500">
              {r.barisDihitung30Hari} barang dihitung · selisih {formatRupiah(r.nilaiSelisih30Hari)}
              . Target ≥ 95%.
            </p>
          </Card>
        </div>
      )}

      <Card className="flex flex-row flex-wrap items-end gap-3 p-4">
        {bolehAtur && (
          <>
            <label className="grid gap-1 text-sm">
              Jumlah barang hari ini
              <Input
                className="w-28"
                inputMode="numeric"
                aria-label="Jumlah barang daftar harian"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <Button
              disabled={susun.isPending}
              onClick={() =>
                void susun
                  .mutateAsync(Number(jumlah) || 20)
                  .then((d) => {
                    toast.success(`Daftar hitung ${d.nomor} disusun (${d.baris.length} barang).`);
                    void navigasi(`/persediaan/penyesuaian/${d.id}`);
                  })
                  .catch((err: unknown) => toast.error(pesanGalat(err)))
              }
            >
              <ListChecks /> Susun daftar hitung hari ini
            </Button>
          </>
        )}
        {bolehBuat && (
          <Button variant="outline" asChild>
            <Link to="/persediaan/penyesuaian/baru?jenis=OPNAME">
              <ClipboardCheck /> Opname penuh / pilih sendiri
            </Link>
          </Button>
        )}
        <p className="basis-full text-xs text-slate-500">
          Cara kerja: Kepala Toko/Owner menyusun daftar acak → berikan ke penghitung → penghitung
          mengisi jumlah fisik tanpa melihat stok sistem → simpan draf → Kepala Toko/Owner
          memeriksa; barang yang berselisih wajib diberi sebab (salah serah, rusak, salah input,
          hilang, belum tercatat) lalu diselesaikan. Bila ragu, hitung ulang oleh orang lain sebelum
          diselesaikan.
        </p>
      </Card>

      <Card className="gap-0 p-0">
        <p className="border-b px-4 py-2 text-sm font-medium text-slate-700">Daftar opname</p>
        {!daftar ? (
          <Skeleton className="m-4 h-20" />
        ) : daftar.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Belum ada opname.</p>
        ) : (
          <ul className="divide-y text-sm">
            {daftar.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <Link
                  to={`/persediaan/penyesuaian/${p.id}`}
                  className="font-mono text-xs font-medium text-blue-700 hover:underline"
                >
                  {p.nomor}
                </Link>
                <span className="text-slate-500">{formatWaktu(p.tanggal)}</span>
                <BadgeStatusPenyesuaian status={p.status} />
                <span className="text-slate-600">
                  {p.jumlahBaris} barang · {p.namaPengguna}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
