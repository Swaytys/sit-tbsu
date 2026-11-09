import { formatRupiah, LABEL_SEBAB_SELISIH, type KelasABC } from '@sit/shared';
import { ClipboardCheck, ClipboardList, ListChecks, Play } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import {
  useDaftarPenyesuaian,
  useKinerjaOpname,
  usePenghitungOpname,
  useRingkasanOpname,
  useSusunDaftarHarian,
  useTugasOpname,
} from '@/api/persediaan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BadgeStatusPenyesuaian } from './tab-penyesuaian';

const KET_KELAS: Record<KelasABC, string> = {
  A: 'Penyumbang 80% nilai penjualan (paling penting)',
  B: '15% berikutnya',
  C: 'Sisanya, termasuk yang jarang laku',
};

const NAMA_BULAN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
const labelBulan = (b: string) => `${NAMA_BULAN[Number(b.slice(5, 7)) - 1] ?? b} ${b.slice(0, 4)}`;
const persen = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('id-ID')}%`);

/**
 * K-240/K-227: Stok Opname di halaman sendiri. Opname bertahap: barang dikelompokkan ABC menurut nilai penjualan 90
 * hari; tiap kelas punya selang hitung. Kepala Toko/Owner menyusun daftar hitung harian acak untuk satu penghitung;
 * penghitung mengisi tanpa melihat stok sistem (hitung buta) lewat lembar hitung; selisih wajib dihitung ulang orang
 * lain lalu diselesaikan Kepala Toko/Owner yang tidak ikut menghitung, dengan sebab baku.
 */
export function HalamanOpname() {
  const r = useRingkasanOpname().data;
  const izin = usePengguna().izin;
  const bolehAtur = izin.includes('persediaan.opname.atur');
  const bolehBuat = izin.includes('persediaan.penyesuaian.kelola');
  const bolehHitung = izin.includes('persediaan.opname.hitung');
  const daftar = useDaftarPenyesuaian({
    cari: '',
    jenis: 'OPNAME',
    status: null,
    halaman: 1,
    perHalaman: 25,
  }).data?.data;

  return (
    <div className="space-y-4 p-4 sm:p-6">
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
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="ringkasan-abc">
            {r.kelas.map((k) => (
              <Card key={k.kelas} className="gap-1 p-3">
                <p className="text-xs font-medium text-slate-500">
                  Kelas {k.kelas} · dihitung tiap {k.selangHari} hari
                </p>
                <p className="text-2xl font-bold tabular-nums">{k.jumlah} barang</p>
                <p
                  className={k.jatuhTempo > 0 ? 'text-sm text-amber-700' : 'text-sm text-slate-500'}
                >
                  {k.jatuhTempo} jatuh tempo hitung
                </p>
                <p className="text-xs text-slate-500">{KET_KELAS[k.kelas]}</p>
              </Card>
            ))}
            <Card className="gap-1 p-3">
              <p className="text-xs font-medium text-slate-500">Akurasi catatan 30 hari</p>
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  r.akurasi30Hari !== null && r.akurasi30Hari < 95 && 'text-red-600',
                )}
              >
                {persen(r.akurasi30Hari)}
              </p>
              <p className="text-xs text-slate-500">
                {r.barisDihitung30Hari} barang dihitung · selisih{' '}
                {formatRupiah(r.nilaiSelisih30Hari)}. Target ≥ 95%.
              </p>
            </Card>
          </div>
          <p className="text-sm text-slate-600" data-testid="ringkasan-opname-lain">
            Saran: <b>{r.saranPerHari} barang per hari kerja</b> agar semua kelas terhitung tepat
            waktu · belum dihitung tahun ini: <b>{r.belumDihitungTahunIni}</b> barang (usahakan
            habis sebelum tutup tahun) · barang rawan (berselisih berulang, dihitung tiap 30 hari):{' '}
            <b>{r.rawan}</b> · selisih sampai {formatRupiah(r.toleransiRp)} boleh tanpa hitung ulang
            (kelas A selalu dihitung ulang; atur di Pengaturan › Operasional).
          </p>
        </>
      )}

      {bolehHitung && <TugasSaya />}
      {bolehAtur && <SusunDaftar saran={r?.saranPerHari ?? 20} />}
      {bolehBuat && (
        <div>
          <Button variant="outline" asChild>
            <Link to="/persediaan/penyesuaian/baru?jenis=OPNAME">
              <ClipboardCheck /> Opname penuh / pilih barang sendiri
            </Link>
          </Button>
        </div>
      )}

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
                {p.status === 'DRAFT' && bolehHitung && (
                  <Link
                    to={`/opname/${p.id}/hitung`}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Lembar hitung
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {bolehAtur && <Kinerja />}
    </div>
  );
}

/** Lembar yang ditugaskan ke pengguna ini atau terbuka untuk semua penghitung. */
function TugasSaya() {
  const tugas = useTugasOpname().data;
  if (!tugas || tugas.length === 0) return null;
  return (
    <Card className="gap-2 p-4" data-testid="tugas-hitung">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <ClipboardList className="size-4 text-blue-600" /> Lembar hitung untuk Anda
      </p>
      <ul className="divide-y text-sm">
        {tugas.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="font-mono text-xs">{t.nomor}</span>
            <span className="text-slate-600">
              {t.ditugaskan ? 'Ditugaskan ke Anda' : 'Terbuka untuk semua penghitung'} ·{' '}
              {t.jumlahBaris} barang · Anda sudah menghitung {t.sudahSaya} · belum dihitung siapa
              pun {t.belumDihitung}
            </span>
            <Button size="sm" className="ml-auto" asChild>
              <Link to={`/opname/${t.id}/hitung`}>
                <Play /> {t.ditugaskan && !t.dimulai ? 'Mulai hitung' : 'Lanjutkan hitung'}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SusunDaftar({ saran }: { saran: number }) {
  const susun = useSusunDaftarHarian();
  const penghitung = usePenghitungOpname().data ?? [];
  const navigasi = useNavigate();
  const [jumlah, setJumlah] = useState('');
  const [idPenghitung, setIdPenghitung] = useState('');
  const n = Number(jumlah || saran) || 20;

  return (
    <Card className="flex flex-row flex-wrap items-end gap-3 p-4">
      <label className="grid gap-1 text-sm">
        Jumlah barang hari ini
        <Input
          className="w-28"
          inputMode="numeric"
          aria-label="Jumlah barang daftar harian"
          placeholder={String(saran)}
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <div className="grid gap-1 text-sm">
        <span id="label-penghitung">Penghitung</span>
        <Select value={idPenghitung} onValueChange={setIdPenghitung}>
          <SelectTrigger className="w-60" aria-labelledby="label-penghitung">
            <SelectValue placeholder="Pilih penghitung" />
          </SelectTrigger>
          <SelectContent>
            {penghitung.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nama} ({p.peran})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        disabled={susun.isPending || !idPenghitung}
        onClick={() =>
          void susun
            .mutateAsync({ jumlah: n, idPenghitung: Number(idPenghitung) })
            .then((d) => {
              toast.success(
                `Daftar hitung ${d.nomor} disusun (${d.baris.length} barang) untuk ${d.penghitung?.nama ?? ''}.`,
              );
              void navigasi(`/persediaan/penyesuaian/${d.id}`);
            })
            .catch((err: unknown) => toast.error(pesanGalat(err)))
        }
      >
        <ListChecks /> Susun daftar hitung hari ini
      </Button>
      <p className="basis-full text-xs text-slate-500">
        Cara kerja: susun daftar acak untuk satu penghitung → ia membuka <b>Lembar hitung</b> (di
        HP/komputer) dan menekan <b>Mulai hitung</b>; isinya baru terlihat saat itu → ia menghitung
        tanpa melihat stok sistem → barang yang berselisih melewati toleransi (kelas A: selisih
        berapa pun) <b>dihitung ulang orang lain</b>: tugaskan ulang lembar ke penghitung lain →
        bila dua hitungan sama, pilih <b>sebab</b> selisih lalu selesaikan. Yang ikut menghitung
        barang berselisih tidak boleh menyelesaikannya (kecuali Owner).
      </p>
    </Card>
  );
}

function Kinerja() {
  const k = useKinerjaOpname().data;
  if (!k) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="kinerja-opname">
      <Card className="gap-2 p-4">
        <p className="text-sm font-medium text-slate-800">Akurasi catatan per bulan</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1">Bulan</th>
              <th className="py-1 text-right">Dihitung</th>
              <th className="py-1 text-right">Cocok</th>
              <th className="py-1 text-right">Akurasi</th>
              <th className="py-1 text-right">Selisih bersih</th>
            </tr>
          </thead>
          <tbody>
            {k.bulan.map((b) => (
              <tr key={b.bulan} className="border-t">
                <td className="py-1">{labelBulan(b.bulan)}</td>
                <td className="py-1 text-right tabular-nums">{b.dihitung}</td>
                <td className="py-1 text-right tabular-nums">{b.cocok}</td>
                <td
                  className={cn(
                    'py-1 text-right tabular-nums',
                    b.akurasi !== null && b.akurasi < 95 && 'text-red-600',
                  )}
                >
                  {persen(b.akurasi)}
                </td>
                <td
                  className={cn(
                    'py-1 text-right tabular-nums',
                    b.nilaiBersih < 0 && 'text-red-600',
                  )}
                >
                  {formatRupiah(b.nilaiBersih)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500">
          Akurasi = barang yang cocok ÷ barang dihitung (target ≥ 95%). Selisih bersih negatif =
          nilai stok yang hilang.
        </p>
      </Card>
      <Card className="gap-2 p-4">
        <p className="text-sm font-medium text-slate-800">Penghitung (90 hari)</p>
        {k.penghitung.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada hitungan.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1">Nama</th>
                <th className="py-1 text-right">Hitungan</th>
                <th className="py-1 text-right">Tepat</th>
                <th className="py-1 text-right">Ketepatan</th>
              </tr>
            </thead>
            <tbody>
              {k.penghitung.map((p) => (
                <tr key={p.idPengguna} className="border-t">
                  <td className="py-1">{p.nama}</td>
                  <td className="py-1 text-right tabular-nums">{p.hitungan}</td>
                  <td className="py-1 text-right tabular-nums">{p.tepat}</td>
                  <td className="py-1 text-right tabular-nums">{persen(p.akurasi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-500">
          Tepat = hitungannya sama dengan hasil akhir yang disetujui. Ketepatan rendah berarti perlu
          pendampingan atau penataan rak.
        </p>
      </Card>
      <Card className="gap-2 p-4">
        <p className="text-sm font-medium text-slate-800">Per kelas (90 hari)</p>
        <table className="w-full text-sm">
          <tbody>
            {k.kelas.map((x) => (
              <tr key={x.kelas} className="border-t first:border-t-0">
                <td className="py-1">Kelas {x.kelas}</td>
                <td className="py-1 text-right tabular-nums">
                  {x.cocok}/{x.dihitung} cocok
                </td>
                <td className="py-1 text-right tabular-nums">{persen(x.akurasi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="gap-2 p-4">
        <p className="text-sm font-medium text-slate-800">Sebab selisih (90 hari)</p>
        {k.sebab.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada selisih.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {k.sebab.map((x) => (
                <tr key={x.sebab ?? 'kosong'} className="border-t first:border-t-0">
                  <td className="py-1">
                    {x.sebab ? LABEL_SEBAB_SELISIH[x.sebab] : 'Tanpa sebab (sebelum K-227)'}
                  </td>
                  <td className="py-1 text-right tabular-nums">{x.baris} barang</td>
                  <td
                    className={cn(
                      'py-1 text-right tabular-nums',
                      x.nilaiBersih < 0 && 'text-red-600',
                    )}
                  >
                    {formatRupiah(x.nilaiBersih)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
