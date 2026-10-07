import {
  formatRupiah,
  subtotalRupiah,
  POLA_QTY,
  type BarisRetur,
  type DataSetujui,
  type KandidatRetur,
  type KondisiRetur,
  type PenyelesaianRetur,
} from '@sit/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useBarisPerHalaman } from '@/api/pengaturan';
import {
  useAjukanRetur,
  useDaftarRetur,
  useKandidatRetur,
  useSetujuiRetur,
  useTolakRetur,
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
import { BadgePersetujuan, DialogPutuskan, IsianRefund } from './komponen';

const ALASAN_CEPAT = [
  'Barang cacat / rusak',
  'Kelebihan beli / sisa proyek',
  'Salah kirim barang',
] as const;

const LABEL_PENYELESAIAN: Record<PenyelesaianRetur, string> = {
  REFUND: 'Uang dikembalikan',
  TUKAR_BARANG: 'Tukar barang sama',
  POTONG_TAGIHAN: 'Potong tagihan',
};

const LABEL_KONDISI: Record<KondisiRetur, string> = {
  BAIK: 'Baik (kembali dijual)',
  RUSAK: 'Rusak',
  CACAT: 'Cacat',
};

type Isian = Record<number, { qty: string; kondisi: KondisiRetur }>;

function qtySah(q: string) {
  return POLA_QTY.test(q) && /[1-9]/.test(q);
}

function FormAjukan() {
  const langsungSetuju = usePengguna().izin.includes('retur.setujui');
  const [cari, setCari] = useState('');
  const kandidat = useKandidatRetur(useTunda(cari, 300));
  const ajukan = useAjukanRetur();
  const [pilih, setPilih] = useState<KandidatRetur | null>(null);
  const [isi, setIsi] = useState<Isian>({});
  const [alasan, setAlasan] = useState('');
  const [penyelesaian, setPenyelesaian] = useState<PenyelesaianRetur>('REFUND');
  const [refund, setRefund] = useState<DataSetujui>({ metodeRefund: 'TUNAI' });
  const [catatan, setCatatan] = useState('');

  const baris = (pilih?.baris ?? [])
    .map((b) => ({ b, i: isi[b.id] }))
    .filter((x) => x.i && qtySah(x.i.qty));
  const nilai = baris.reduce((t, x) => t + subtotalRupiah(x.i!.qty, x.b.hargaSatuanEfektif), 0);

  function ubahIsi(id: number, ubah: Partial<Isian[number]>) {
    setIsi((x) => ({ ...x, [id]: { qty: '', kondisi: 'BAIK', ...x[id], ...ubah } }));
  }

  function kirim() {
    if (!pilih) return;
    ajukan
      .mutateAsync({
        idPenjualan: pilih.id,
        alasan,
        penyelesaian,
        catatan: catatan.trim() || null,
        baris: baris.map((x) => ({
          idPenjualanDetail: x.b.id,
          qtyRetur: x.i!.qty.replace(',', '.'),
          kondisi: x.i!.kondisi,
          keterangan: null,
        })),
        persetujuan: refund,
      })
      .then((r) => {
        toast.success(
          r.status === 'DISETUJUI'
            ? `Retur ${r.nomor} disetujui; stok diperbarui.`
            : `Retur ${r.nomor} diajukan; menunggu persetujuan Admin/Owner.`,
        );
        setPilih(null);
        setIsi({});
        setAlasan('');
        setCatatan('');
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <div className="grid grid-cols-[22rem_1fr] gap-4">
      <Card className="gap-2 p-3">
        <Label htmlFor="cari-retur">Nomor invoice / struk</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            id="cari-retur"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="STR-… / INV-… / nama pelanggan"
            className="pl-8"
            autoFocus
          />
        </div>
        <ul className="max-h-[480px] space-y-1.5 overflow-auto">
          {(kandidat.data ?? []).map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => {
                  setPilih(k);
                  setIsi({});
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
                  {formatWaktu(k.tanggal)} · {k.namaPembeli ?? 'Pembeli umum'}
                </div>
              </button>
            </li>
          ))}
          {cari && kandidat.data?.length === 0 && (
            <li className="text-sm text-slate-500">Tidak ditemukan.</li>
          )}
        </ul>
      </Card>
      <Card className="gap-3 p-4">
        {!pilih ? (
          <p className="text-sm text-slate-500">
            Masukkan nomor invoice atau struk di sebelah kiri untuk memulai retur.
          </p>
        ) : (
          <>
            <h2 className="font-semibold">
              {pilih.nomor} · {pilih.namaPembeli ?? 'Pembeli umum'}
            </h2>
            <p className="text-xs text-slate-500">
              Isi qty retur barang yang dikembalikan; biarkan kosong untuk yang tidak diretur.
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">Barang</th>
                  <th className="py-1 text-right">Qty beli</th>
                  <th className="py-1 text-right">Harga</th>
                  <th className="w-24 py-1 text-right">Qty retur</th>
                  <th className="w-44 py-1">Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pilih.baris.map((b) => {
                  const bisa = /[1-9]/.test(b.qtyBisaRetur);
                  return (
                    <tr key={b.id} className={bisa ? '' : 'text-slate-400'}>
                      <td className="py-1.5">{b.namaBarang}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatDesimal(b.qty)} {b.kodeSatuan}
                        {b.qtyBisaRetur !== b.qty && (
                          <div className="text-xs">bisa {formatDesimal(b.qtyBisaRetur)}</div>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatRupiah(b.hargaSatuanEfektif)}
                      </td>
                      <td className="py-1.5">
                        <Input
                          className="h-8 text-right"
                          inputMode="decimal"
                          disabled={!bisa}
                          aria-label={`Qty retur ${b.namaBarang}`}
                          value={isi[b.id]?.qty ?? ''}
                          onChange={(e) => ubahIsi(b.id, { qty: e.target.value })}
                        />
                      </td>
                      <td className="py-1.5 pl-2">
                        <select
                          className="h-8 w-full rounded-md border bg-white px-1 text-sm"
                          disabled={!bisa}
                          aria-label={`Kondisi ${b.namaBarang}`}
                          value={isi[b.id]?.kondisi ?? 'BAIK'}
                          onChange={(e) =>
                            ubahIsi(b.id, { kondisi: e.target.value as KondisiRetur })
                          }
                        >
                          {(['BAIK', 'RUSAK', 'CACAT'] as const).map((k) => (
                            <option key={k} value={k}>
                              {LABEL_KONDISI[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="space-y-1">
              <Label htmlFor="alasan-retur">Alasan retur</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALASAN_CEPAT.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAlasan(a)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      alasan === a
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'hover:border-blue-300',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <Input
                id="alasan-retur"
                value={alasan}
                maxLength={255}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Atau tulis alasan lain"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipe penyelesaian</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['REFUND', 'TUKAR_BARANG', 'POTONG_TAGIHAN'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPenyelesaian(p)}
                    className={cn(
                      'rounded-md border-2 py-1.5 text-sm font-semibold',
                      penyelesaian === p
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200',
                    )}
                  >
                    {LABEL_PENYELESAIAN[p]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Kondisi baik kembali ke stok jual; rusak/cacat masuk stok rusak (tidak dijual lagi,
              diselesaikan di Stok Persediaan › Stok rusak).
              {penyelesaian === 'TUKAR_BARANG' &&
                ' Tukar mengambil barang pengganti dari stok baik; bila stok kurang, tukar sebagian lalu ajukan sisanya sebagai uang kembali atau potong tagihan.'}
            </p>
            {penyelesaian === 'REFUND' && (
              <IsianRefund
                nilai={refund}
                onUbah={setRefund}
                labelTunai={
                  langsungSetuju ? 'Tunai (laci shift saya)' : 'Tunai (dari laci penyetuju)'
                }
              />
            )}
            <Input
              value={catatan}
              maxLength={255}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan (opsional)"
              aria-label="Catatan retur"
            />
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span>
                {penyelesaian === 'TUKAR_BARANG' ? 'Nilai barang ditukar' : 'Total pengembalian'}
              </span>
              <span className="text-lg font-bold tabular-nums" data-testid="nilai-retur">
                {formatRupiah(nilai)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {langsungSetuju
                ? 'Anda berhak menyetujui: retur langsung berlaku.'
                : 'Membutuhkan otorisasi dari Admin/Owner. Stok barang bertambah setelah retur disetujui.'}
            </p>
            <Button
              disabled={baris.length === 0 || alasan.trim().length < 3 || ajukan.isPending}
              onClick={kirim}
            >
              {langsungSetuju ? 'Proses retur' : 'Ajukan retur'}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

function Daftar({ menunggu }: { menunggu: boolean }) {
  const bolehPutus = usePengguna().izin.includes('retur.setujui');
  const [halaman, setHalaman] = useState(1);
  const perHalaman = useBarisPerHalaman();
  const daftar = useDaftarRetur({ status: menunggu ? 'MENUNGGU' : null, halaman, perHalaman });
  const setujui = useSetujuiRetur();
  const tolak = useTolakRetur();
  const [putus, setPutus] = useState<BarisRetur | null>(null);
  const kolom: KolomTabel<BarisRetur>[] = [
    {
      kunci: 'nomor',
      judul: 'No. Retur',
      sel: (r) => <span className="font-mono text-xs">{r.nomor}</span>,
    },
    { kunci: 'tanggal', judul: 'Tanggal', sel: (r) => formatWaktu(r.tanggal) },
    {
      kunci: 'pj',
      judul: 'Transaksi',
      sel: (r) => <span className="font-mono text-xs">{r.nomorPenjualan}</span>,
    },
    {
      kunci: 'barang',
      judul: 'Barang',
      sel: (r) => (
        <span className="text-xs">
          {r.baris
            .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyRetur)} (${b.kondisi.toLowerCase()})`)
            .join(', ')}
        </span>
      ),
    },
    {
      kunci: 'penyelesaian',
      judul: 'Penyelesaian',
      sel: (r) => LABEL_PENYELESAIAN[r.penyelesaian],
    },
    {
      kunci: 'nilai',
      judul: 'Nilai',
      className: 'text-right tabular-nums',
      sel: (r) => formatRupiah(r.totalRetur),
    },
    { kunci: 'alasan', judul: 'Alasan', sel: (r) => <span className="text-xs">{r.alasan}</span> },
    { kunci: 'pengaju', judul: 'Pengaju', sel: (r) => r.namaPengaju },
    {
      kunci: 'status',
      judul: 'Status',
      sel: (r) => (
        <div>
          <BadgePersetujuan status={r.status} />
          {r.namaPenyetuju && <div className="text-xs text-slate-500">{r.namaPenyetuju}</div>}
          {r.alasanPenolakan && <div className="text-xs text-red-600">{r.alasanPenolakan}</div>}
          {r.catatan && <div className="text-xs text-slate-500">{r.catatan}</div>}
        </div>
      ),
    },
    ...(menunggu && bolehPutus
      ? [
          {
            kunci: 'aksi',
            judul: <span className="sr-only">Aksi</span>,
            sel: (r: BarisRetur) => (
              <Button size="sm" onClick={() => setPutus(r)}>
                Putuskan
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        meta={daftar.data?.meta}
        onHalaman={setHalaman}
        kunciBaris={(r) => r.id}
        memuat={daftar.isFetching}
        galat={daftar.error}
        onUlang={() => void daftar.refetch()}
        kosong={menunggu ? 'Tidak ada retur yang menunggu.' : 'Belum ada retur.'}
      />
      {putus && (
        <DialogPutuskan
          judul={`Retur ${putus.nomor} (${putus.nomorPenjualan})`}
          ringkasan={
            <>
              {putus.baris.map((b) => `${b.namaBarang} ${formatDesimal(b.qtyRetur)}`).join(', ')} —{' '}
              <b>{formatRupiah(putus.totalRetur)}</b>,{' '}
              {LABEL_PENYELESAIAN[putus.penyelesaian].toLowerCase()}
              {putus.metodeRefund && ` (${putus.metodeRefund.toLowerCase()})`}. Alasan:{' '}
              {putus.alasan}.
            </>
          }
          memproses={setujui.isPending || tolak.isPending}
          onTutup={() => setPutus(null)}
          onSetujui={(json) =>
            void setujui
              .mutateAsync({ id: putus.id, json })
              .then((r) => {
                toast.success(`Retur ${r.nomor} disetujui.`);
                setPutus(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
          onTolak={(alasan) =>
            void tolak
              .mutateAsync({ id: putus.id, alasan })
              .then(() => {
                toast.success(`Retur ${putus.nomor} ditolak.`);
                setPutus(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
        />
      )}
    </Card>
  );
}

/** Transaksi › Retur Penjualan (docs/05 §8, mockup Retur Penjualan). */
export function HalamanRetur() {
  const [url, setUrl] = useSearchParams();
  const bolehPutus = usePengguna().izin.includes('retur.setujui');
  const tab = url.get('tab') ?? 'ajukan';
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Retur Penjualan</h1>
        <p className="text-sm text-slate-500">
          Proses pengembalian barang dari pelanggan dan pengembalian dana.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setUrl({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="ajukan">Ajukan retur</TabsTrigger>
          {bolehPutus && <TabsTrigger value="persetujuan">Persetujuan</TabsTrigger>}
          <TabsTrigger value="riwayat">Riwayat retur</TabsTrigger>
        </TabsList>
        <TabsContent value="ajukan">
          <FormAjukan />
        </TabsContent>
        {bolehPutus && (
          <TabsContent value="persetujuan">
            <Daftar menunggu />
          </TabsContent>
        )}
        <TabsContent value="riwayat">
          <Daftar menunggu={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
