import {
  bandingQty,
  formatRupiah,
  subtotalRupiah,
  type BarisRetur,
  type DataSetujui,
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
  useBatalRetur,
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
import { qtySah } from '@/lib/qty';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';
import {
  BadgePersetujuan,
  DialogBatalPengajuan,
  DialogKodeKoreksi,
  DialogPutuskan,
  IsianRefund,
  SelStatusKoreksi,
} from './komponen';

const ALASAN_CEPAT = [
  'Barang cacat / rusak',
  'Kelebihan beli / sisa proyek',
  'Salah kirim barang',
] as const;

const LABEL_PENYELESAIAN: Record<PenyelesaianRetur, string> = {
  REFUND: 'Uang dikembalikan',
  TUKAR_BARANG: 'Tukar barang sama (tukar guling)',
  POTONG_TAGIHAN: 'Potong tagihan',
};

const LABEL_KONDISI: Record<KondisiRetur, string> = {
  BAIK: 'Baik (kembali dijual)',
  RUSAK: 'Rusak',
  CACAT: 'Cacat',
};

type Isian = Record<number, { qty: string; kondisi: KondisiRetur }>;

const adaQty = (q: string) => /[1-9]/.test(q);

function ringkasBaris(r: BarisRetur) {
  return r.baris
    .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyRetur)} ${b.kodeSatuan}`)
    .join(', ');
}

function FormAjukan() {
  const langsungSetuju = usePengguna().izin.includes('retur.setujui');
  const [cari, setCari] = useState('');
  const kandidat = useKandidatRetur(useTunda(cari, 300));
  const ajukan = useAjukanRetur();
  // Hanya id yang disimpan: isi transaksi (sisa qty, riwayat retur) selalu diambil dari data terbaru.
  const [idPilih, setIdPilih] = useState<number | null>(null);
  const pilih = (kandidat.data ?? []).find((k) => k.id === idPilih) ?? null;
  // T7: potong tagihan hanya mengurangi sisa tagihan transaksi itu sendiri; tanpa tagihan tidak ditawarkan.
  const adaTagihan = (pilih?.sisaTagihan ?? 0) > 0;
  const [isi, setIsi] = useState<Isian>({});
  const [alasan, setAlasan] = useState('');
  const [penyelesaian, setPenyelesaian] = useState<PenyelesaianRetur>('REFUND');
  const [refund, setRefund] = useState<DataSetujui>({ metodeRefund: 'TUNAI' });
  const [catatan, setCatatan] = useState('');
  /** Retur yang baru diajukan dan menunggu: langsung ditawari persetujuan dengan kode atasan (K-102). */
  const [kodeUntuk, setKodeUntuk] = useState<{ dok: BarisRetur; refund: DataSetujui } | null>(null);

  const baris = (pilih?.baris ?? [])
    .map((b) => ({ b, i: isi[b.id] }))
    .filter((x) => x.i && qtySah(x.i.qty.replace(',', '.')));
  const nilai = baris.reduce(
    (t, x) => t + subtotalRupiah(x.i!.qty.replace(',', '.'), x.b.hargaSatuanEfektif),
    0,
  );
  // Tampilan saja: batas yang berlaku tetap diperiksa API saat dikirim.
  const melebihi = baris.some((x) => bandingQty(x.i!.qty.replace(',', '.'), x.b.qtyBisaRetur) > 0);
  const lebihDariTagihan =
    penyelesaian === 'POTONG_TAGIHAN' && pilih !== null && nilai > pilih.sisaTagihan;
  const tanpaAtasan = !langsungSetuju && nilai > 0 && nilai <= (pilih?.sisaBatasBebas ?? 0);
  const langsung = langsungSetuju || tanpaAtasan;

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
        if (r.status === 'MENUNGGU') setKodeUntuk({ dok: r, refund });
        // Transaksi tetap terpilih: sisa qty dan riwayat returnya langsung tampil.
        setIsi({});
        setAlasan('');
        setCatatan('');
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <div className="grid grid-cols-[22rem_1fr] gap-4">
      <Card className="gap-2 p-3">
        <Label htmlFor="cari-retur">Pilih transaksi yang diretur</Label>
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
        <p className="text-xs text-slate-500">
          {cari.trim()
            ? 'Hasil pencarian (paling banyak 20).'
            : '20 transaksi terbaru. Ketik nomor struk/invoice atau nama pembeli untuk mencari yang lebih lama.'}
        </p>
        <ul className="max-h-[480px] space-y-1.5 overflow-auto">
          {(kandidat.data ?? []).map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => {
                  setIdPilih(k.id);
                  setIsi({});
                  // Pilihan yang tidak berlaku untuk transaksi ini tidak dibawa dari transaksi sebelumnya.
                  if (k.sisaTagihan <= 0)
                    setPenyelesaian((p) => (p === 'POTONG_TAGIHAN' ? 'REFUND' : p));
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
                  {k.retur.length > 0 && ` · ${k.retur.length} retur`}
                </div>
                {k.sisaTagihan > 0 && (
                  <div className="text-xs font-medium text-amber-700">
                    Belum lunas: sisa tagihan {formatRupiah(k.sisaTagihan)}
                  </div>
                )}
              </button>
            </li>
          ))}
          {kandidat.data?.length === 0 && (
            <li className="text-sm text-slate-500">
              {cari.trim() ? 'Tidak ditemukan.' : 'Belum ada penjualan yang bisa diretur.'}
            </li>
          )}
        </ul>
      </Card>
      <Card className="gap-3 p-4">
        {!pilih ? (
          <p className="text-sm text-slate-500">
            Klik transaksi di daftar sebelah kiri untuk memulai retur. Daftar itu menampilkan
            transaksi terbaru; transaksi lama dicari dengan nomor struk/invoice atau nama pembeli.
          </p>
        ) : (
          <>
            <h2 className="font-semibold">
              {pilih.nomor} · {pilih.namaPembeli ?? 'Pembeli umum'}
            </h2>
            <p className="text-sm text-slate-600" data-testid="tagihan-retur">
              Total {formatRupiah(pilih.totalNeto)} · sudah dibayar{' '}
              {formatRupiah(pilih.dibayarBersih)} ·{' '}
              {adaTagihan ? (
                <b className="text-amber-700">sisa tagihan {formatRupiah(pilih.sisaTagihan)}</b>
              ) : (
                <b className="text-emerald-700">lunas (tidak ada tagihan)</b>
              )}
            </p>
            {pilih.retur.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm">
                <div className="font-medium text-amber-900">
                  Transaksi ini sudah punya {pilih.retur.length} retur
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                  {pilih.retur.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-mono">{r.nomor}</span>
                      <span>{formatWaktu(r.tanggal)}</span>
                      <BadgePersetujuan status={r.status} />
                      <span>{r.ringkasan}</span>
                      <span className="tabular-nums">{formatRupiah(r.totalRetur)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-slate-600">
                  Kolom <b>Sisa</b> di bawah sudah dikurangi retur yang disetujui dan yang masih
                  menunggu. Retur yang sudah disetujui tidak bisa diubah; yang masih menunggu bisa
                  dibatalkan di tab Menunggu persetujuan.
                </p>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Isi qty retur barang yang dikembalikan (paling banyak sebesar kolom Sisa); biarkan
              kosong untuk yang tidak diretur.
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left">Barang</th>
                  <th className="px-2 py-1 text-right">Dibeli</th>
                  <th className="px-2 py-1 text-right">Sudah diretur</th>
                  <th className="px-2 py-1 text-right">Sisa</th>
                  <th className="px-2 py-1 text-right">Harga</th>
                  <th className="w-24 py-1 text-right">Qty retur</th>
                  <th className="w-44 py-1">Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pilih.baris.map((b) => {
                  const bisa = adaQty(b.qtyBisaRetur);
                  const diisi = isi[b.id]?.qty.replace(',', '.') ?? '';
                  const lebih = qtySah(diisi) && bandingQty(diisi, b.qtyBisaRetur) > 0;
                  return (
                    <tr key={b.id} className={bisa ? '' : 'text-slate-400'}>
                      <td className="py-1.5">
                        {b.namaBarang}
                        {b.statusItem === 'VOID' && <span className="text-xs"> (void)</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                        {formatDesimal(b.qty)} {b.kodeSatuan}
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                        {adaQty(b.qtyDiretur)
                          ? `${formatDesimal(b.qtyDiretur)} ${b.kodeSatuan}`
                          : '—'}
                        {adaQty(b.qtyMenunggu) && (
                          <div className="text-xs text-amber-700">
                            + {formatDesimal(b.qtyMenunggu)} menunggu
                          </div>
                        )}
                      </td>
                      <td
                        className="px-2 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums"
                        data-testid={`sisa-retur-${b.id}`}
                      >
                        {bisa ? `${formatDesimal(b.qtyBisaRetur)} ${b.kodeSatuan}` : 'habis'}
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                        {formatRupiah(b.hargaSatuanEfektif)}
                      </td>
                      <td className="py-1.5 pl-2">
                        <Input
                          className={cn('h-8 text-right', lebih && 'border-red-500')}
                          inputMode="decimal"
                          disabled={!bisa}
                          placeholder={bisa ? `maks. ${formatDesimal(b.qtyBisaRetur)}` : ''}
                          aria-label={`Qty retur ${b.namaBarang}`}
                          aria-invalid={lebih}
                          value={isi[b.id]?.qty ?? ''}
                          onChange={(e) => ubahIsi(b.id, { qty: e.target.value })}
                        />
                        {lebih && (
                          <div className="text-right text-xs text-red-600">
                            maksimal {formatDesimal(b.qtyBisaRetur)}
                          </div>
                        )}
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
              <div className={cn('grid gap-2', adaTagihan ? 'grid-cols-3' : 'grid-cols-2')}>
                {(
                  [
                    'REFUND',
                    'TUKAR_BARANG',
                    ...(adaTagihan ? (['POTONG_TAGIHAN'] as const) : []),
                  ] as const
                ).map((p) => (
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
                ' Tukar guling = barang yang dikembalikan diganti barang yang sama dengan jumlah yang sama, tanpa uang berpindah. Pengganti diambil dari stok baik; bila stok kurang, tukar sebagian lalu ajukan sisanya sebagai uang kembali.'}
              {penyelesaian === 'POTONG_TAGIHAN' &&
                ` Potong tagihan = nilai retur mengurangi sisa tagihan transaksi ini (${formatRupiah(pilih.sisaTagihan)}), tanpa uang keluar.`}
              {!adaTagihan && ' Potong tagihan tidak ditawarkan karena transaksi ini sudah lunas.'}
            </p>
            {lebihDariTagihan && (
              <p className="text-sm font-medium text-red-600" role="alert">
                Nilai retur {formatRupiah(nilai)} lebih besar dari sisa tagihan{' '}
                {formatRupiah(pilih.sisaTagihan)}. Pilih &quot;Uang dikembalikan&quot;: bagian yang
                melebihi uang yang sudah dibayar otomatis memotong tagihan.
              </p>
            )}
            {penyelesaian === 'REFUND' && (
              <IsianRefund
                nilai={refund}
                onUbah={setRefund}
                labelTunai={langsung ? 'Tunai (laci toko)' : 'Tunai'}
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
            <p className="text-xs text-slate-500" data-testid="info-persetujuan">
              {langsungSetuju
                ? 'Anda berhak menyetujui: retur langsung berlaku.'
                : tanpaAtasan
                  ? `Nilai retur masih di dalam batas tanpa persetujuan (sisa ${formatRupiah(pilih.sisaBatasBebas)} untuk transaksi ini): retur langsung berlaku dan tercatat atas nama Anda.`
                  : 'Butuh persetujuan Admin/Owner. Setelah diajukan, Anda bisa meminta kode sekali pakai yang dikirim ke atasan, atau menunggu atasan menyetujui dari akunnya. Stok dan uang baru berubah setelah disetujui.'}
            </p>
            <Button
              disabled={
                baris.length === 0 ||
                melebihi ||
                lebihDariTagihan ||
                alasan.trim().length < 3 ||
                ajukan.isPending
              }
              onClick={kirim}
            >
              {langsung ? 'Proses retur' : 'Ajukan & minta persetujuan'}
            </Button>
            {kodeUntuk && (
              <DialogKodeKoreksi
                jenis="retur"
                dok={kodeUntuk.dok}
                ringkasan={
                  <>
                    {kodeUntuk.dok.baris
                      .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyRetur)} ${b.kodeSatuan}`)
                      .join(', ')}{' '}
                    — <b>{formatRupiah(kodeUntuk.dok.totalRetur)}</b>,{' '}
                    {LABEL_PENYELESAIAN[kodeUntuk.dok.penyelesaian].toLowerCase()}. Alasan:{' '}
                    {kodeUntuk.dok.alasan}.
                  </>
                }
                refundAwal={kodeUntuk.refund}
                tampilRefund={false}
                labelTutup="Nanti saja, tunggu persetujuan"
                onTutup={() => setKodeUntuk(null)}
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
  const bolehPutus = saya.izin.includes('retur.setujui');
  const [halaman, setHalaman] = useState(1);
  const perHalaman = useBarisPerHalaman();
  const daftar = useDaftarRetur({ status: menunggu ? 'MENUNGGU' : null, halaman, perHalaman });
  const setujui = useSetujuiRetur();
  const tolak = useTolakRetur();
  const batal = useBatalRetur();
  const [putus, setPutus] = useState<BarisRetur | null>(null);
  const [diTempat, setDiTempat] = useState<BarisRetur | null>(null);
  const [dibatalkan, setDibatalkan] = useState<BarisRetur | null>(null);

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
      className: 'whitespace-normal',
      sel: (r) => (
        <span className="text-xs">
          {r.baris
            .map(
              (b) =>
                `${b.namaBarang} ${formatDesimal(b.qtyRetur)} ${b.kodeSatuan} (${b.kondisi.toLowerCase()})`,
            )
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
      sel: (r) => <SelStatusKoreksi {...r} />,
    },
    ...(menunggu
      ? [
          {
            kunci: 'aksi',
            judul: <span className="sr-only">Aksi</span>,
            sel: (r: BarisRetur) => (
              <div className="flex justify-end gap-1.5">
                {bolehPutus ? (
                  <Button size="sm" onClick={() => setPutus(r)}>
                    Putuskan
                  </Button>
                ) : (
                  r.idPengaju === saya.id && (
                    <Button size="sm" onClick={() => setDiTempat(r)}>
                      Setujui dengan kode
                    </Button>
                  )
                )}
                {(bolehPutus || r.idPengaju === saya.id) && (
                  <Button size="sm" variant="outline" onClick={() => setDibatalkan(r)}>
                    Batalkan
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];
  const ringkasan = (r: BarisRetur) => (
    <>
      {ringkasBaris(r)} — <b>{formatRupiah(r.totalRetur)}</b>,{' '}
      {LABEL_PENYELESAIAN[r.penyelesaian].toLowerCase()}
      {r.metodeRefund && ` (${r.metodeRefund.toLowerCase()})`}. Alasan: {r.alasan}. Diajukan{' '}
      {r.namaPengaju}.
    </>
  );
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {menunggu && !bolehPutus && (
        <p className="border-b bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Retur di bawah menunggu Admin/Owner. <b>Setujui dengan kode</b>: sistem mengirim kode
          sekali pakai ke atasan, lalu Anda mengetik kode yang disebutkan atasan. <b>Batalkan</b>:
          tarik pengajuan Anda yang salah input, lalu ajukan lagi.
        </p>
      )}
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
          ringkasan={ringkasan(putus)}
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
      {diTempat && (
        <DialogKodeKoreksi
          jenis="retur"
          dok={diTempat}
          ringkasan={ringkasan(diTempat)}
          refundAwal={{ metodeRefund: diTempat.metodeRefund }}
          tampilRefund={diTempat.penyelesaian === 'REFUND'}
          onTutup={() => setDiTempat(null)}
        />
      )}
      {dibatalkan && (
        <DialogBatalPengajuan
          judul={`Batalkan pengajuan retur ${dibatalkan.nomor}?`}
          memproses={batal.isPending}
          onTutup={() => setDibatalkan(null)}
          onBatal={(alasan) =>
            void batal
              .mutateAsync({ id: dibatalkan.id, alasan })
              .then((r) => {
                toast.success(`Pengajuan retur ${r.nomor} dibatalkan.`);
                setDibatalkan(null);
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
          <TabsTrigger value="persetujuan">Menunggu persetujuan</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat retur</TabsTrigger>
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
