import { formatRupiah, type BarisVoid, type DataAtasan, type DataSetujui } from '@sit/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useBarisPerHalaman } from '@/api/pengaturan';
import {
  useAjukanVoid,
  useBatalVoid,
  useDaftarVoid,
  useKandidatVoid,
  useSetujuiVoid,
  useSetujuiVoidDiTempat,
  useTolakVoid,
} from '@/api/penjualan';
import { DataTable, type KolomTabel } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';
import {
  DialogAtasan,
  DialogBatalPengajuan,
  DialogPutuskan,
  IsianRefund,
  SelStatusKoreksi,
} from './komponen';

function FormAjukan() {
  const saya = usePengguna();
  const langsungSetuju = saya.izin.includes('void.setujui');
  const [cari, setCari] = useState('');
  const kandidat = useKandidatVoid(useTunda(cari, 300));
  const ajukan = useAjukanVoid();
  // Hanya id yang disimpan: isi transaksi selalu diambil dari data terbaru.
  const [idPilih, setIdPilih] = useState<number | null>(null);
  const pilih = (kandidat.data ?? []).find((k) => k.id === idPilih) ?? null;
  const [item, setItem] = useState<number[]>([]);
  const [alasan, setAlasan] = useState('');
  const [refund, setRefund] = useState<DataSetujui>({ metodeRefund: 'TUNAI' });
  const [mintaAtasan, setMintaAtasan] = useState(false);

  const normal = pilih?.baris.filter((b) => b.statusItem === 'NORMAL') ?? [];
  const semua = normal.length > 0 && item.length === normal.length;
  const nilai = normal.filter((b) => item.includes(b.id)).reduce((t, b) => t + b.subtotal, 0);
  const tanpaAtasan = !langsungSetuju && nilai > 0 && nilai <= (pilih?.sisaBatasBebas ?? 0);
  const langsung = langsungSetuju || tanpaAtasan;

  function kirim(atasan: DataAtasan | null) {
    if (!pilih) return;
    ajukan
      .mutateAsync({
        idPenjualan: pilih.id,
        lingkup: semua ? 'TRANSAKSI' : 'ITEM',
        idDetail: semua ? [] : item,
        alasan,
        persetujuan: refund,
        atasan,
      })
      .then((v) => {
        toast.success(
          v.status === 'DISETUJUI'
            ? `Void ${v.nomor} disetujui${v.nominalRefund ? `; kembalikan ${formatRupiah(v.nominalRefund)}` : ''}.`
            : `Void ${v.nomor} diajukan; menunggu persetujuan Admin/Owner.`,
        );
        setMintaAtasan(false);
        setIdPilih(null);
        setItem([]);
        setAlasan('');
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <div className="grid grid-cols-[22rem_1fr] gap-4">
      <Card className="gap-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nomor/pembeli…"
            className="pl-8"
            aria-label="Cari transaksi"
          />
        </div>
        <p className="text-xs text-slate-500">Hanya transaksi pada shift yang masih terbuka.</p>
        <ul className="max-h-[480px] space-y-1.5 overflow-auto">
          {(kandidat.data ?? []).map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => {
                  setIdPilih(k.id);
                  setItem([]);
                }}
                className={cn(
                  'w-full rounded-md border p-2 text-left text-sm',
                  pilih?.id === k.id ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300',
                )}
              >
                <div className="flex justify-between">
                  <span className="font-mono text-xs font-semibold">{k.nomor}</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(k.totalNeto)}</span>
                </div>
                <div className="truncate text-xs text-slate-500">
                  {formatWaktu(k.tanggal).slice(11)} · {k.namaPembeli ?? 'Pembeli umum'} ·{' '}
                  {k.baris.map((b) => b.namaBarang).join(', ')}
                </div>
              </button>
            </li>
          ))}
          {kandidat.data?.length === 0 && (
            <li className="text-sm text-slate-500">Tidak ada transaksi.</li>
          )}
        </ul>
      </Card>
      <Card className="gap-3 p-4">
        {!pilih ? (
          <p className="text-sm text-slate-500">Pilih transaksi di kiri.</p>
        ) : (
          <>
            <h2 className="font-semibold">
              {pilih.nomor} · {pilih.namaPembeli ?? 'Pembeli umum'} · kasir {pilih.namaKasir}
            </h2>
            <Label>Pilih barang yang di-void</Label>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {pilih.baris.map((b) => (
                  <tr key={b.id} className={b.statusItem !== 'NORMAL' ? 'text-slate-400' : ''}>
                    <td className="w-8 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Void ${b.namaBarang}`}
                        disabled={b.statusItem !== 'NORMAL'}
                        checked={item.includes(b.id)}
                        onChange={(e) =>
                          setItem((x) =>
                            e.target.checked ? [...x, b.id] : x.filter((y) => y !== b.id),
                          )
                        }
                      />
                    </td>
                    <td className="py-1.5">
                      {b.namaBarang}
                      {b.statusItem !== 'NORMAL' && ` (${b.statusItem.toLowerCase()})`}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatDesimal(b.qty)} {b.kodeSatuan}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatRupiah(b.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-blue-700 hover:underline"
                onClick={() => setItem(semua ? [] : normal.map((b) => b.id))}
              >
                {semua ? 'Kosongkan pilihan' : 'Pilih semua (void transaksi)'}
              </button>
              <span>
                Lingkup: <b>{semua ? 'Transaksi' : 'Per item'}</b> · nilai{' '}
                <b className="tabular-nums">{formatRupiah(nilai)}</b>
              </span>
            </div>
            <div className="space-y-1">
              <Label htmlFor="alasan-void">Alasan void</Label>
              <Input
                id="alasan-void"
                value={alasan}
                maxLength={255}
                onChange={(e) => setAlasan(e.target.value)}
              />
            </div>
            <IsianRefund
              nilai={refund}
              onUbah={setRefund}
              labelTunai={langsung ? 'Tunai (laci shift saya)' : 'Tunai'}
            />
            <p className="text-xs text-slate-500" data-testid="info-persetujuan">
              {langsungSetuju
                ? 'Anda berhak menyetujui: void langsung berlaku, stok dikembalikan.'
                : tanpaAtasan
                  ? `Nilai void masih di dalam batas tanpa persetujuan (sisa ${formatRupiah(pilih.sisaBatasBebas)} untuk transaksi ini): void langsung berlaku dan tercatat atas nama Anda.`
                  : 'Butuh persetujuan Admin/Owner. Atasan bisa menyetujui di layar ini sekarang, atau void diajukan dan menunggu. Stok dan uang baru berubah setelah disetujui.'}
            </p>
            <Button
              disabled={item.length === 0 || alasan.trim().length < 3 || ajukan.isPending}
              onClick={() => (langsung ? kirim(null) : setMintaAtasan(true))}
            >
              {langsung ? 'Void sekarang' : 'Lanjut: minta persetujuan'}
            </Button>
            {mintaAtasan && (
              <DialogAtasan
                judul={`Persetujuan void ${pilih.nomor}`}
                ringkasan={
                  <>
                    {normal
                      .filter((b) => item.includes(b.id))
                      .map((b) => `${b.namaBarang} ${formatDesimal(b.qty)} ${b.kodeSatuan}`)
                      .join(', ')}{' '}
                    — <b>{formatRupiah(nilai)}</b>. Alasan: {alasan}.
                  </>
                }
                memproses={ajukan.isPending}
                onSetujui={kirim}
                onAjukanSaja={() => kirim(null)}
                onTutup={() => setMintaAtasan(false)}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function Daftar({ menunggu }: { menunggu: boolean }) {
  const saya = usePengguna();
  const bolehPutus = saya.izin.includes('void.setujui');
  const [halaman, setHalaman] = useState(1);
  const perHalaman = useBarisPerHalaman();
  const daftar = useDaftarVoid({ status: menunggu ? 'MENUNGGU' : null, halaman, perHalaman });
  const setujui = useSetujuiVoid();
  const setujuiDiTempat = useSetujuiVoidDiTempat();
  const tolak = useTolakVoid();
  const batal = useBatalVoid();
  const [putus, setPutus] = useState<BarisVoid | null>(null);
  const [diTempat, setDiTempat] = useState<BarisVoid | null>(null);
  const [refundDiTempat, setRefundDiTempat] = useState<DataSetujui>({ metodeRefund: 'TUNAI' });
  const [dibatalkan, setDibatalkan] = useState<BarisVoid | null>(null);
  const kolom: KolomTabel<BarisVoid>[] = [
    {
      kunci: 'nomor',
      judul: 'No. Void',
      sel: (v) => <span className="font-mono text-xs">{v.nomor}</span>,
    },
    { kunci: 'tanggal', judul: 'Tanggal', sel: (v) => formatWaktu(v.tanggal) },
    {
      kunci: 'pj',
      judul: 'Transaksi',
      sel: (v) => <span className="font-mono text-xs">{v.nomorPenjualan}</span>,
    },
    {
      kunci: 'lingkup',
      judul: 'Lingkup',
      sel: (v) => (v.lingkup === 'TRANSAKSI' ? 'Transaksi' : 'Item'),
    },
    {
      kunci: 'barang',
      judul: 'Barang',
      sel: (v) => (
        <span className="text-xs">
          {v.baris.map((b) => `${b.namaBarang} ${formatDesimal(b.qtyDasar)}`).join(', ')}
        </span>
      ),
    },
    {
      kunci: 'nilai',
      judul: 'Nilai',
      className: 'text-right tabular-nums',
      sel: (v) => formatRupiah(v.nominalVoid),
    },
    { kunci: 'alasan', judul: 'Alasan', sel: (v) => <span className="text-xs">{v.alasan}</span> },
    { kunci: 'pengaju', judul: 'Pengaju', sel: (v) => v.namaPengaju },
    {
      kunci: 'status',
      judul: 'Status',
      sel: (v) => <SelStatusKoreksi {...v} />,
    },
    ...(menunggu
      ? [
          {
            kunci: 'aksi',
            judul: <span className="sr-only">Aksi</span>,
            sel: (v: BarisVoid) => (
              <div className="flex justify-end gap-1.5">
                {bolehPutus ? (
                  <Button size="sm" onClick={() => setPutus(v)}>
                    Putuskan
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setDiTempat(v)}>
                    Setujui di tempat
                  </Button>
                )}
                {(bolehPutus || v.idPengaju === saya.id) && (
                  <Button size="sm" variant="outline" onClick={() => setDibatalkan(v)}>
                    Batalkan
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];
  const ringkasan = (v: BarisVoid) => (
    <>
      {v.baris.map((b) => `${b.namaBarang} ${formatDesimal(b.qtyDasar)}`).join(', ')} —{' '}
      <b>{formatRupiah(v.nominalVoid)}</b>. Alasan: {v.alasan}. Diajukan {v.namaPengaju}.
    </>
  );
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {menunggu && !bolehPutus && (
        <p className="border-b bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Void di bawah menunggu Admin/Owner. <b>Setujui di tempat</b>: atasan mengetik akunnya di
          layar ini. <b>Batalkan</b>: tarik pengajuan Anda yang salah input, lalu ajukan lagi.
        </p>
      )}
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(v) => v.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong={menunggu ? 'Tidak ada void yang menunggu.' : 'Belum ada void.'}
      />
      {putus && (
        <DialogPutuskan
          judul={`Void ${putus.nomor} (${putus.nomorPenjualan})`}
          ringkasan={ringkasan(putus)}
          memproses={setujui.isPending || tolak.isPending}
          onTutup={() => setPutus(null)}
          onSetujui={(json) =>
            void setujui
              .mutateAsync({ id: putus.id, json })
              .then((v) => {
                toast.success(
                  `Void ${v.nomor} disetujui${v.nominalRefund ? `; kembalikan ${formatRupiah(v.nominalRefund)}` : ''}.`,
                );
                setPutus(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
          onTolak={(alasan) =>
            void tolak
              .mutateAsync({ id: putus.id, alasan })
              .then(() => {
                toast.success(`Void ${putus.nomor} ditolak.`);
                setPutus(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
        />
      )}
      {diTempat && (
        <DialogAtasan
          judul={`Persetujuan void ${diTempat.nomor}`}
          ringkasan={ringkasan(diTempat)}
          memproses={setujuiDiTempat.isPending}
          isianRefund={{ nilai: refundDiTempat, onUbah: setRefundDiTempat }}
          onTutup={() => setDiTempat(null)}
          onSetujui={(atasan) =>
            void setujuiDiTempat
              .mutateAsync({ id: diTempat.id, json: { ...refundDiTempat, atasan } })
              .then((v) => {
                toast.success(
                  `Void ${v.nomor} disetujui ${v.namaPenyetuju ?? 'atasan'}${v.nominalRefund ? `; kembalikan ${formatRupiah(v.nominalRefund)}` : ''}.`,
                );
                setDiTempat(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
        />
      )}
      {dibatalkan && (
        <DialogBatalPengajuan
          judul={`Batalkan pengajuan void ${dibatalkan.nomor}?`}
          memproses={batal.isPending}
          onTutup={() => setDibatalkan(null)}
          onBatal={(alasan) =>
            void batal
              .mutateAsync({ id: dibatalkan.id, alasan })
              .then((v) => {
                toast.success(`Pengajuan void ${v.nomor} dibatalkan.`);
                setDibatalkan(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
        />
      )}
    </Card>
  );
}

/** Transaksi › Void Transaksi (docs/05 §9, mockup Void Transaksi). */
export function HalamanVoid() {
  const [url, setUrl] = useSearchParams();
  const tab = url.get('tab') ?? 'ajukan';
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Void Transaksi</h1>
        <p className="text-sm text-slate-500">
          Batalkan transaksi pada shift yang masih terbuka (salah input, pembeli batal). Stok dan
          uang kembali setelah void disetujui.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="ajukan">Ajukan void</TabsTrigger>
          <TabsTrigger value="persetujuan">Menunggu persetujuan</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat void</TabsTrigger>
        </TabsList>
        <TabsContent value="ajukan">
          <FormAjukan />
        </TabsContent>
        <TabsContent value="persetujuan">
          <Daftar menunggu />
        </TabsContent>
        <TabsContent value="riwayat">
          <Daftar menunggu={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
