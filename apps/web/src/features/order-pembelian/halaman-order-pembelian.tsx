import {
  CARA_KIRIM_PO,
  formatRupiah,
  KET_SYARAT_BAYAR_PO,
  LABEL_CARA_KIRIM_PO,
  LABEL_STATUS_ORDER_PEMBELIAN,
  LABEL_SYARAT_BAYAR_PO,
  SYARAT_BAYAR_PO,
  teksSyaratBayarPO,
  type CaraKirimPO,
  type SyaratBayarPO,
  POLA_QTY,
  skemaOrderPembelian,
  subtotalRupiah,
  ukuranKertasCss,
  type BarisBarang,
  type DetailOrderPembelian,
  type StatusOrderPembelian,
} from '@sit/shared';
import {
  CheckCircle2,
  ClipboardCopy,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useDaftarPemasok } from '@/api/mitra';
import {
  mintaKodePO,
  useAksiPO,
  useDaftarPO,
  useDetailPO,
  useSimpanPO,
  type SaringPO,
} from '@/api/order-pembelian';
import { usePengguna } from '@/api/auth';
import { DialogKodeAtasan } from '@/components/dialog-kode-atasan';
import { useSaldoDeposit } from '@/api/hutang';
import { DialogBayarHutang, type DokumenBayar } from '@/features/hutang/halaman-hutang';
import { useTampilanToko } from '@/api/pengaturan';
import { AreaCetak } from '@/components/area-cetak';
import { OrderPembelianA4 } from '@/components/dokumen-a4';
import { InputRupiah } from '@/components/input-rupiah';
import { SaranAlasan } from '@/components/saran-alasan';
import { SARAN_ALASAN } from '@/lib/saran-alasan';
import { PilihBarang } from '@/components/pilih-barang';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatDesimal,
  formatTanggal,
  formatWaktu,
  tambahHariTanggal,
  tanggalHariIni,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useIngat } from '@/lib/ingat-saring';

/*
 * K-125 Persediaan › Order Pembelian: daftar PO (kiri) dan rinciannya (kanan) dengan aksi sesuai status. Angka
 * dan status dari server; layar hanya menampilkan. Barang diterima lewat halaman Penerimaan Barang dari PO.
 */

const WARNA: Record<StatusOrderPembelian, string> = {
  DRAF: 'border-slate-300 bg-slate-50 text-slate-700',
  DIAJUKAN: 'border-orange-300 bg-orange-50 text-orange-800',
  DISETUJUI: 'border-teal-300 bg-teal-50 text-teal-800',
  DIPESAN: 'border-blue-300 bg-blue-50 text-blue-800',
  DIKONFIRMASI: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  SEBAGIAN: 'border-amber-300 bg-amber-50 text-amber-900',
  SELESAI: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  DITUTUP: 'border-slate-300 bg-slate-100 text-slate-600',
  BATAL: 'border-red-300 bg-red-50 text-red-700',
};

const SARINGAN: { nilai: SaringPO['status']; label: string }[] = [
  { nilai: 'BERJALAN', label: 'Menunggu barang' },
  { nilai: 'DRAF', label: 'Draf' },
  { nilai: 'DIAJUKAN', label: 'Menunggu persetujuan' },
  { nilai: 'DISETUJUI', label: 'Disetujui' },
  { nilai: 'SELESAI', label: 'Selesai' },
  { nilai: '', label: 'Semua' },
];

export function BadgePO({ status }: { status: StatusOrderPembelian }) {
  return (
    <Badge variant="outline" className={WARNA[status]}>
      {LABEL_STATUS_ORDER_PEMBELIAN[status]}
    </Badge>
  );
}

/** Teks untuk WhatsApp/pesan ke pemasok. */
function teksPesan(po: DetailOrderPembelian, namaToko: string): string {
  return [
    `Order pembelian ${po.nomor ?? ''} dari ${namaToko}`,
    `Kepada: ${po.namaPemasok}`,
    '',
    ...po.baris.map(
      (b, i) => `${i + 1}. ${b.namaBarang}: ${formatDesimal(b.qtyBerlaku)} ${b.kodeSatuan}`,
    ),
    '',
    `Syarat bayar: ${teksSyaratBayarPO(po.kesepakatan)}`,
    po.kesepakatan.tanggalKirimDiminta
      ? `Mohon dikirim paling lambat ${formatTanggal(po.kesepakatan.tanggalKirimDiminta)}` +
        (po.kesepakatan.caraKirim === 'DIAMBIL' ? ' (kami ambil sendiri).' : '.')
      : '',
    po.catatan ? `Catatan: ${po.catatan}` : '',
    'Mohon konfirmasi ketersediaan dan tanggal kirim. Terima kasih.',
  ]
    .filter((x, i, a) => !(x === '' && a[i - 1] === ''))
    .join('\n');
}

type BarisIsian = {
  idBarang: number;
  nama: string;
  kode: string;
  satuan: string;
  qty: string;
  harga: number;
};

/** Buat/ubah draf order pembelian. */
function DialogDraf({
  awal,
  onTutup,
  onTersimpan,
}: {
  awal: DetailOrderPembelian | null;
  onTutup: () => void;
  onTersimpan: (id: number) => void;
}) {
  const simpan = useSimpanPO();
  const pemasok =
    useDaftarPemasok({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 100 }).data?.data ?? [];
  const [idPemasok, setIdPemasok] = useState<number>(awal?.idPemasok ?? 0);
  const [catatan, setCatatan] = useState(awal?.catatan ?? '');
  // K-236: kesepakatan dengan pemasok (wajib lengkap sebelum diajukan/dikirim).
  const k0 = awal?.kesepakatan;
  const [tanggalKirim, setTanggalKirim] = useState(k0?.tanggalKirimDiminta ?? '');
  const [caraKirim, setCaraKirim] = useState<CaraKirimPO | ''>(k0?.caraKirim ?? 'DIANTAR');
  const [syarat, setSyarat] = useState<SyaratBayarPO | ''>(k0?.syaratBayar ?? '');
  const [tempoHari, setTempoHari] = useState(k0?.tempoHari ? String(k0.tempoHari) : '');
  const [uangMuka, setUangMuka] = useState(k0?.uangMukaRencana ?? 0);
  const [metodeRencana, setMetodeRencana] = useState<'TUNAI' | 'TRANSFER'>(
    k0?.metodeBayarRencana ?? 'TRANSFER',
  );
  function pilihPemasok(id: number) {
    setIdPemasok(id);
    const pm = pemasok.find((p) => p.id === id);
    if (!pm) return;
    // Bawaan dari Data Pemasok, tetap tampil dan bisa diubah.
    if (!tanggalKirim) setTanggalKirim(tambahHariTanggal(tanggalHariIni(), pm.lamaKirimHari ?? 3));
    if (!syarat) setSyarat(pm.tempoHari ? 'TEMPO' : 'SAAT_TERIMA');
    if (!tempoHari && pm.tempoHari) setTempoHari(String(pm.tempoHari));
  }
  const [baris, setBaris] = useState<BarisIsian[]>(
    awal?.baris.map((b) => ({
      idBarang: b.idBarang,
      nama: b.namaBarang,
      kode: b.kodeBarang,
      satuan: b.kodeSatuan,
      qty: b.qtyPesan.replace(/\.?0+$/, ''),
      harga: b.hargaPerkiraan ?? 0,
    })) ?? [],
  );

  function tambah(b: BarisBarang) {
    if (baris.some((x) => x.idBarang === b.id)) {
      toast.info(`${b.namaBarang} sudah ada di daftar.`);
      return;
    }
    setBaris((x) => [
      ...x,
      {
        idBarang: b.id,
        nama: b.namaBarang,
        kode: b.kode,
        satuan: b.kodeSatuan,
        qty: '',
        harga: b.hargaBeliTerakhir || b.hargaModalAwal || 0,
      },
    ]);
  }

  const total = baris.reduce(
    (t, b) =>
      t +
      (POLA_QTY.test(b.qty.replace(',', '.'))
        ? subtotalRupiah(b.qty.replace(',', '.'), b.harga)
        : 0),
    0,
  );

  function kirim() {
    const data = skemaOrderPembelian.safeParse({
      idPemasok,
      catatan,
      tanggalKirimDiminta: tanggalKirim,
      caraKirim,
      syaratBayar: syarat,
      tempoHari: syarat === 'TEMPO' ? tempoHari : '',
      uangMukaRencana: syarat === 'DI_MUKA' ? 0 : uangMuka,
      metodeBayarRencana: metodeRencana,
      baris: baris.map((b) => ({
        idBarang: b.idBarang,
        qty: b.qty.replace(',', '.'),
        harga: b.harga,
      })),
    });
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    simpan
      .mutateAsync({ id: awal?.id ?? null, json: data.data })
      .then((po) => {
        toast.success(awal ? 'Draf order pembelian disimpan.' : 'Draf order pembelian dibuat.');
        onTersimpan(po.id);
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{awal ? 'Ubah draf order pembelian' : 'Order pembelian baru'}</DialogTitle>
          <DialogDescription>
            Pilih pemasok dan barang yang dipesan. Draf masih bisa diubah; setelah dikirim ke
            pemasok, isinya terkunci.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-sm">
          Pemasok
          <select
            className="h-9 rounded-md border bg-white px-2"
            aria-label="Pemasok"
            value={idPemasok || ''}
            onChange={(e) => pilihPemasok(Number(e.target.value))}
          >
            <option value="">Pilih pemasok…</option>
            {pemasok.map((p) => (
              <option key={p.id} value={p.id}>
                {p.namaPemasok}
              </option>
            ))}
          </select>
        </label>
        <PilihBarang
          onPilih={tambah}
          saring={(b) => b.kepemilikan === 'MILIK_SENDIRI'}
          label="Tambah barang"
        />
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 text-left font-medium">Barang</th>
              <th className="w-28 py-1 text-right font-medium">Qty</th>
              <th className="w-40 py-1 text-right font-medium">Harga beli / satuan</th>
              <th className="w-32 py-1 text-right font-medium">Jumlah</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {baris.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  Belum ada barang. Cari barang di atas.
                </td>
              </tr>
            )}
            {baris.map((b, i) => (
              <tr key={b.idBarang}>
                <td className="py-1.5">
                  <p className="font-medium">{b.nama}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{b.kode}</span> · {b.satuan}
                  </p>
                </td>
                <td className="py-1.5">
                  <Input
                    className="h-8 text-right"
                    inputMode="decimal"
                    aria-label={`Qty ${b.nama}`}
                    value={b.qty}
                    onChange={(e) =>
                      setBaris((x) =>
                        x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)),
                      )
                    }
                  />
                </td>
                <td className="py-1.5">
                  <InputRupiah
                    className="h-8"
                    aria-label={`Harga ${b.nama}`}
                    value={b.harga}
                    onChange={(v) =>
                      setBaris((x) => x.map((y, j) => (j === i ? { ...y, harga: v ?? 0 } : y)))
                    }
                  />
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {POLA_QTY.test(b.qty.replace(',', '.'))
                    ? formatRupiah(subtotalRupiah(b.qty.replace(',', '.'), b.harga))
                    : '—'}
                </td>
                <td className="py-1.5 text-right">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Hapus ${b.nama}`}
                    onClick={() => setBaris((x) => x.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={3} className="py-2 text-right">
                Perkiraan total
              </td>
              <td className="py-2 text-right tabular-nums">{formatRupiah(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <fieldset
          className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
          data-testid="kesepakatan"
        >
          <legend className="px-1 text-sm font-medium">
            Kesepakatan dengan pemasok (wajib sebelum dikirim)
          </legend>
          <label className="grid gap-1 text-sm">
            Dikirim paling lambat
            <Input
              type="date"
              aria-label="Tanggal kirim diminta"
              value={tanggalKirim}
              min={tanggalHariIni()}
              onChange={(e) => setTanggalKirim(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Cara kirim
            <select
              className="h-9 rounded-md border bg-white px-2"
              aria-label="Cara kirim"
              value={caraKirim}
              onChange={(e) => setCaraKirim(e.target.value as CaraKirimPO)}
            >
              {CARA_KIRIM_PO.map((c) => (
                <option key={c} value={c}>
                  {LABEL_CARA_KIRIM_PO[c]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-sm sm:col-span-2">
            Syarat bayar
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Syarat bayar">
              {SYARAT_BAYAR_PO.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  role="radio"
                  aria-checked={syarat === s}
                  variant={syarat === s ? 'default' : 'outline'}
                  onClick={() => setSyarat(s)}
                >
                  {LABEL_SYARAT_BAYAR_PO[s]}
                </Button>
              ))}
            </div>
            {syarat && <p className="text-xs text-slate-500">{KET_SYARAT_BAYAR_PO[syarat]}</p>}
          </div>
          {syarat === 'TEMPO' && (
            <label className="grid gap-1 text-sm">
              Lama tempo (hari sejak barang diterima)
              <Input
                inputMode="numeric"
                aria-label="Lama tempo"
                value={tempoHari}
                onChange={(e) => setTempoHari(e.target.value.replace(/\D/g, ''))}
              />
            </label>
          )}
          {syarat && syarat !== 'DI_MUKA' && (
            <label className="grid gap-1 text-sm">
              Uang muka yang direncanakan (boleh 0)
              <InputRupiah
                aria-label="Uang muka rencana"
                value={uangMuka}
                onChange={(v) => setUangMuka(v ?? 0)}
              />
            </label>
          )}
          <label className="grid gap-1 text-sm">
            Rencana cara bayar
            <select
              className="h-9 rounded-md border bg-white px-2"
              aria-label="Rencana cara bayar"
              value={metodeRencana}
              onChange={(e) => setMetodeRencana(e.target.value as 'TUNAI' | 'TRANSFER')}
            >
              <option value="TRANSFER">Transfer</option>
              <option value="TUNAI">Tunai</option>
            </select>
          </label>
        </fieldset>
        <label className="grid gap-1 text-sm">
          Catatan untuk pemasok (boleh kosong)
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={255} />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button onClick={kirim} disabled={simpan.isPending}>
            {simpan.isPending ? 'Menyimpan…' : 'Simpan draf'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogKonfirmasi({ po, onTutup }: { po: DetailOrderPembelian; onTutup: () => void }) {
  const { konfirmasi } = useAksiPO();
  const [janji, setJanji] = useState(po.tanggalJanjiKirim ?? tanggalHariIni());
  const [isi, setIsi] = useState<Record<number, { qty: string; harga: number | null }>>(() =>
    Object.fromEntries(
      po.baris.map((b) => [
        b.id,
        { qty: b.qtyBerlaku.replace(/\.?0+$/, ''), harga: b.hargaBerlaku ?? null },
      ]),
    ),
  );
  function kirim() {
    const baris = po.baris.flatMap((b) => {
      const x = isi[b.id];
      if (!x) return [];
      const qtyBaru = x.qty.replace(',', '.');
      const qtyBerubah = Number(qtyBaru) !== Number(b.qtyBerlaku);
      const hargaBerubah = b.hargaBerlaku !== undefined && x.harga !== b.hargaBerlaku;
      if (!qtyBerubah && !hargaBerubah) return [];
      return [
        {
          id: b.id,
          ...(qtyBerubah ? { qty: qtyBaru } : {}),
          ...(hargaBerubah && x.harga !== null ? { harga: x.harga } : {}),
        },
      ];
    });
    konfirmasi
      .mutateAsync({ id: po.id, json: { tanggalJanjiKirim: janji, baris } })
      .then(() => {
        toast.success('Konfirmasi pemasok dicatat.');
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Konfirmasi pemasok {po.nomor}</DialogTitle>
          <DialogDescription>
            Catat tanggal pemasok berjanji mengirim. Ubah qty/harga hanya bila pemasok mengubahnya;
            angka pesanan awal tetap tersimpan.
          </DialogDescription>
        </DialogHeader>
        <label className="grid w-48 gap-1 text-sm">
          Tanggal janji kirim
          <Input type="date" value={janji} onChange={(e) => setJanji(e.target.value)} />
        </label>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 text-left font-medium">Barang</th>
              <th className="py-1 text-right font-medium">Dipesan</th>
              <th className="w-28 py-1 text-right font-medium">Qty dikirim</th>
              {po.baris[0]?.hargaBerlaku !== undefined && (
                <th className="w-40 py-1 text-right font-medium">Harga</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {po.baris.map((b) => (
              <tr key={b.id}>
                <td className="py-1.5">{b.namaBarang}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatDesimal(b.qtyPesan)} {b.kodeSatuan}
                </td>
                <td className="py-1.5">
                  <Input
                    className="h-8 text-right"
                    inputMode="decimal"
                    aria-label={`Qty dikirim ${b.namaBarang}`}
                    value={isi[b.id]?.qty ?? ''}
                    onChange={(e) =>
                      setIsi((x) => ({
                        ...x,
                        [b.id]: { qty: e.target.value, harga: x[b.id]?.harga ?? null },
                      }))
                    }
                  />
                </td>
                {b.hargaBerlaku !== undefined && (
                  <td className="py-1.5">
                    <InputRupiah
                      className="h-8"
                      aria-label={`Harga ${b.namaBarang}`}
                      value={isi[b.id]?.harga ?? 0}
                      onChange={(v) =>
                        setIsi((x) => ({ ...x, [b.id]: { qty: x[b.id]?.qty ?? '', harga: v } }))
                      }
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button onClick={kirim} disabled={konfirmasi.isPending}>
            Simpan konfirmasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogUangMuka({ po, onTutup }: { po: DetailOrderPembelian; onTutup: () => void }) {
  const { uangMuka } = useAksiPO();
  const [nominal, setNominal] = useState<number | null>(null);
  const [metode, setMetode] = useState<'TRANSFER' | 'TUNAI' | 'DEPOSIT'>('TRANSFER');
  const deposit = useSaldoDeposit(po.idPemasok).data?.saldo ?? 0;
  // K-225: rekening dari Data Pemasok (selain Owner tidak bisa mentransfer ke rekening lain).
  const rekeningPemasok =
    useDaftarPemasok({ cari: '', status: 'SEMUA', halaman: 1, perHalaman: 100 }).data?.data.find(
      (x) => x.id === po.idPemasok,
    )?.rekening ?? '';
  // null = belum diketik: memakai rekening Data Pemasok.
  const [rekeningKetik, setRekening] = useState<string | null>(null);
  const rekening = rekeningKetik ?? rekeningPemasok;
  const [referensi, setReferensi] = useState('');
  function kirim() {
    uangMuka
      .mutateAsync({
        id: po.id,
        json: { nominal: nominal ?? 0, metode, rekening, referensi },
      })
      .then(() => {
        toast.success('Uang muka dicatat.');
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Uang muka {po.nomor}</DialogTitle>
          <DialogDescription>
            Bila pemasok minta dibayar dulu. Saat barang diterima, uang muka otomatis menjadi
            pembayaran fakturnya. Tunai keluar dari laci shift yang terbuka.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-sm">
          Nominal
          <InputRupiah aria-label="Nominal uang muka" value={nominal} onChange={setNominal} />
        </label>
        <div className="flex gap-2" role="group" aria-label="Cara bayar">
          {(deposit > 0
            ? (['TRANSFER', 'TUNAI', 'DEPOSIT'] as const)
            : (['TRANSFER', 'TUNAI'] as const)
          ).map((m) => (
            <Button
              key={m}
              type="button"
              variant={metode === m ? 'default' : 'outline'}
              onClick={() => setMetode(m)}
            >
              {m === 'TRANSFER' ? 'Transfer' : m === 'TUNAI' ? 'Tunai' : 'Pakai deposit'}
            </Button>
          ))}
        </div>
        {deposit > 0 && (
          <p className="text-xs text-slate-500">
            Deposit {po.namaPemasok}: {formatRupiah(deposit)} (kelebihan uang muka order lama).
          </p>
        )}
        {metode === 'TRANSFER' && (
          <>
            <label className="grid gap-1 text-sm">
              Rekening tujuan (pemasok)
              <Input
                value={rekening}
                onChange={(e) => setRekening(e.target.value)}
                maxLength={60}
              />
            </label>
            <label className="grid gap-1 text-sm">
              No. referensi transfer (wajib)
              <Input
                value={referensi}
                onChange={(e) => setReferensi(e.target.value)}
                maxLength={60}
              />
            </label>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button onClick={kirim} disabled={uangMuka.isPending}>
            Catat uang muka
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogAkhiri({
  po,
  jenis,
  onTutup,
}: {
  po: DetailOrderPembelian;
  jenis: 'tutup' | 'batal';
  onTutup: () => void;
}) {
  const { akhiri } = useAksiPO();
  const [alasan, setAlasan] = useState('');
  const [metodeKembali, setMetodeKembali] = useState<'TRANSFER' | 'TUNAI' | 'DEPOSIT'>('TRANSFER');
  const adaSisa = po.sisaUangMuka > 0;
  function kirim() {
    akhiri
      .mutateAsync({
        id: po.id,
        jenis,
        json: { alasan, ...(adaSisa ? { metodeKembali } : {}) },
      })
      .then(() => {
        toast.success(jenis === 'tutup' ? 'Sisa order ditutup.' : 'Order pembelian dibatalkan.');
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {jenis === 'tutup' ? 'Tutup sisa' : 'Batalkan'} {po.nomor ?? 'draf'}
          </DialogTitle>
          <DialogDescription>
            {jenis === 'tutup'
              ? 'Barang yang belum datang tidak ditunggu lagi. Penerimaan yang sudah ada tetap berlaku.'
              : 'Order dibatalkan. Hanya bisa sebelum ada barang yang diterima.'}
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-sm">
          Alasan
          <Input
            aria-label={jenis === 'tutup' ? 'Alasan tutup' : 'Alasan batal'}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            maxLength={255}
          />
        </label>
        <SaranAlasan
          saran={jenis === 'tutup' ? SARAN_ALASAN.tutupPO : SARAN_ALASAN.batalPO}
          onPilih={setAlasan}
        />
        {adaSisa && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <p>
              Sisa uang muka <b>{formatRupiah(po.sisaUangMuka)}</b> dikembalikan pemasok lewat, atau
              disimpan sebagai <b>deposit</b> untuk order/tagihan berikutnya ke pemasok ini:
            </p>
            <div className="flex gap-2">
              {(['TRANSFER', 'TUNAI', 'DEPOSIT'] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={metodeKembali === m ? 'default' : 'outline'}
                  onClick={() => setMetodeKembali(m)}
                >
                  {m === 'TRANSFER'
                    ? 'Transfer'
                    : m === 'TUNAI'
                      ? 'Tunai (masuk laci)'
                      : 'Jadikan deposit'}
                </Button>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button variant="destructive" onClick={kirim} disabled={akhiri.isPending}>
            {jenis === 'tutup' ? 'Tutup sisa' : 'Batalkan order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** K-225: Setujui (catatan opsional) atau Tolak (alasan wajib, order kembali ke draf). */
function DialogPutusan({
  po,
  jenis,
  onTutup,
}: {
  po: DetailOrderPembelian;
  jenis: 'setujui' | 'tolak';
  onTutup: () => void;
}) {
  const { setujui, tolak } = useAksiPO();
  const [teks, setTeks] = useState('');
  const jalan = jenis === 'setujui' ? setujui : tolak;
  const kurang = jenis === 'tolak' && teks.trim().length < 3;
  function kirim() {
    const p =
      jenis === 'setujui'
        ? setujui.mutateAsync({ id: po.id, catatan: teks })
        : tolak.mutateAsync({ id: po.id, alasan: teks.trim() });
    p.then(() => {
      toast.success(
        jenis === 'setujui'
          ? 'Order disetujui. Pembuat order kini bisa mengirimnya ke pemasok.'
          : 'Order dikembalikan ke draf dengan alasan penolakan.',
      );
      onTutup();
    }).catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {jenis === 'setujui' ? 'Setujui' : 'Tolak'} draf #{po.id} · {po.namaPemasok}
          </DialogTitle>
          <DialogDescription>
            {jenis === 'setujui'
              ? 'Setelah disetujui, isi order terkunci dan siap dikirim ke pemasok.'
              : 'Order kembali menjadi draf. Pembuat memperbaiki lalu mengajukan lagi.'}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {po.persetujuan.alasan.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <label className="grid gap-1 text-sm">
          {jenis === 'setujui' ? 'Catatan (boleh kosong)' : 'Alasan penolakan'}
          <Input
            aria-label={jenis === 'setujui' ? 'Catatan persetujuan' : 'Alasan penolakan'}
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            maxLength={255}
            autoFocus
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button
            variant={jenis === 'setujui' ? 'default' : 'destructive'}
            onClick={kirim}
            disabled={jalan.isPending || kurang}
          >
            {jenis === 'setujui' ? 'Setujui order' : 'Tolak order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** K-238/K-235: ringkasan uang order (uang muka belum terpakai, sisa tagihan, keterlambatan). */
function KotakRingkasanUang({ r }: { r: NonNullable<DetailOrderPembelian['ringkasanUang']> }) {
  const baris: [string, number, string?][] = [
    ['Nilai order', r.nilaiOrder],
    ['Uang muka dibayar', r.uangMukaDibayar],
    ['Uang muka terpakai', r.uangMukaTerpakai],
    ['Uang muka belum terpakai', r.uangMukaBelumTerpakai],
    ['Nilai barang diterima', r.nilaiDiterima],
    ['Dibayar saat/sesudah datang', r.dibayarSaatDatang],
  ];
  return (
    <div className="rounded-md border p-3 text-sm" data-testid="ringkasan-uang-po">
      <p className="mb-1 font-medium text-slate-700">Ringkasan uang</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        {baris.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-600">{k}</dt>
            <dd className="text-right tabular-nums">{formatRupiah(v)}</dd>
          </div>
        ))}
        <dt className="font-semibold">Sisa tagihan (hutang)</dt>
        <dd className="text-right font-semibold tabular-nums">{formatRupiah(r.sisaTagihan)}</dd>
      </dl>
      {r.sisaTagihan > 0 && r.jatuhTempoTerdekat && (
        <p
          className={cn(
            'mt-1 text-xs',
            r.terlambatHari ? 'font-semibold text-red-700' : 'text-slate-500',
          )}
        >
          {r.terlambatHari
            ? `Terlambat ${r.terlambatHari} hari (jatuh tempo ${formatTanggal(r.jatuhTempoTerdekat)})`
            : `Jatuh tempo terdekat ${formatTanggal(r.jatuhTempoTerdekat)}`}
        </p>
      )}
      {r.uangMukaBelumTerpakai > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Uang muka belum terpakai otomatis dipakai saat barang berikutnya datang; bila order
          ditutup, dicatat dikembalikan pemasok.
        </p>
      )}
    </div>
  );
}

/** K-238: riwayat order dari log aktivitas. */
function KotakRiwayat({ riwayat }: { riwayat: DetailOrderPembelian['riwayat'] }) {
  if (riwayat.length === 0) return null;
  return (
    <div className="rounded-md border p-3 text-sm" data-testid="riwayat-po">
      <p className="mb-1 font-medium text-slate-700">Riwayat</p>
      <ol className="space-y-1.5 border-l pl-3">
        {riwayat.map((r, i) => (
          <li key={i}>
            <p className="text-xs text-slate-500">
              {formatWaktu(r.waktu)} · {r.nama ?? 'sistem'}
            </p>
            <p className="text-slate-700">{r.ringkasan}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** K-236/K-238: kesepakatan dengan pemasok di rincian order. */
function KotakKesepakatan({ po }: { po: DetailOrderPembelian }) {
  const k = po.kesepakatan;
  return (
    <div className="space-y-2" data-testid="kotak-kesepakatan">
      <dl className="grid gap-x-4 gap-y-1 rounded-md border bg-slate-50 p-3 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-slate-500">Syarat bayar</dt>
          <dd className="font-medium">{teksSyaratBayarPO(k)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Dikirim paling lambat</dt>
          <dd className="font-medium">{formatTanggal(k.tanggalKirimDiminta)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Cara kirim</dt>
          <dd className="font-medium">{k.caraKirim ? LABEL_CARA_KIRIM_PO[k.caraKirim] : '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Janji pemasok</dt>
          <dd className="font-medium">
            {po.tanggalJanjiKirim ? formatTanggal(po.tanggalJanjiKirim) : 'belum dikonfirmasi'}
            {k.jumlahUbahJanji > 0 && (
              <span className="text-amber-700">
                {' '}
                (diubah {k.jumlahUbahJanji}× dari {formatTanggal(k.tanggalJanjiAwal)})
              </span>
            )}
          </dd>
        </div>
      </dl>
      {k.kurang.length > 0 && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="kesepakatan-kurang"
        >
          <p className="font-medium">Lengkapi kesepakatan dulu (tekan Ubah):</p>
          <ul className="list-disc pl-5">
            {k.kurang.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** K-225: kotak keadaan persetujuan di rincian order. */
function KotakPersetujuan({ po }: { po: DetailOrderPembelian }) {
  const p = po.persetujuan;
  const ditolak = po.status === 'DRAF' && !!p.catatan?.startsWith('Ditolak:');
  if (p.namaPenyetuju && !['DRAF', 'DIAJUKAN'].includes(po.status)) {
    return (
      <div className="rounded-md border border-teal-300 bg-teal-50 p-3 text-sm text-teal-900">
        Disetujui <b>{p.namaPenyetuju}</b> · {formatWaktu(p.disetujuiPada)}
        {p.catatan && ` · ${p.catatan}`}
      </div>
    );
  }
  if (!['DRAF', 'DIAJUKAN'].includes(po.status)) return null;
  if (p.alasan.length === 0 && !ditolak) return null;
  return (
    <div
      className={cn(
        'space-y-1 rounded-md border p-3 text-sm',
        po.status === 'DIAJUKAN'
          ? 'border-orange-300 bg-orange-50 text-orange-900'
          : 'border-amber-300 bg-amber-50 text-amber-900',
      )}
      data-testid="kotak-persetujuan"
    >
      {ditolak && (
        <p className="font-semibold text-red-700">
          {p.catatan} {p.namaPenyetuju && `(${p.namaPenyetuju})`}
        </p>
      )}
      {p.alasan.length > 0 && (
        <>
          <p className="font-medium">
            {po.status === 'DIAJUKAN' ? 'Menunggu persetujuan ' : 'Wajib disetujui '}
            {p.perluOwner ? 'Owner' : 'Kepala Toko atau Owner'} karena:
          </p>
          <ul className="list-disc pl-5">
            {p.alasan.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Dialogan =
  'draf' | 'konfirmasi' | 'uang-muka' | 'tutup' | 'batal' | 'setujui' | 'tolak' | 'kode' | null;

function Rincian({ id, onUbah }: { id: number; onUbah: (d: DetailOrderPembelian) => void }) {
  const q = useDetailPO(id);
  const toko = useTampilanToko().data;
  const { kirim, ajukan, setujuiKode } = useAksiPO();
  const saya = usePengguna();
  const [dialog, setDialog] = useState<Dialogan>(null);
  const [tagihan, setTagihan] = useState<DokumenBayar | null>(null);
  const bolehBayarHutang = saya.izin.includes('hutang.kelola');
  const [cetak, setCetak] = useState(false);
  useEffect(() => {
    if (!cetak) return;
    const t = setTimeout(() => {
      window.print();
      setCetak(false);
    }, 150);
    return () => clearTimeout(t);
  }, [cetak]);

  const po = q.data;
  // K-234: gagal dimuat → pesan + Coba lagi (bukan kotak abu-abu tanpa akhir).
  if (q.isError) {
    return (
      <Card className="items-center gap-3 p-6 text-center" data-testid="rincian-po-galat">
        <p className="text-sm text-red-700">{pesanGalat(q.error)}</p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
          <RefreshCw /> Coba lagi
        </Button>
      </Card>
    );
  }
  if (!po) return <Skeleton className="h-64 w-full" />;
  const berjalan = ['DIPESAN', 'DIKONFIRMASI', 'SEBAGIAN'].includes(po.status);
  const owner = saya.izin.includes('pembelian.setujui_semua');
  // Tampilan saja; aturan tetap di server (pembuat ≠ penyetuju, batas Owner).
  const perluSetuju = po.status === 'DRAF' && po.persetujuan.alasan.length > 0 && !owner;
  const bolehPutus =
    po.status === 'DIAJUKAN' &&
    saya.izin.includes('pembelian.setujui') &&
    (owner || (po.persetujuan.idPembuat !== saya.id && !po.persetujuan.perluOwner));
  const adaHarga = po.baris.some((b) => b.hargaBerlaku !== undefined);
  const adaTolak = po.baris.some((b) => Number(b.qtyDitolak) > 0);

  return (
    <Card className="@container gap-3 p-4" data-testid="rincian-po">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {po.nomor ?? `Draf #${po.id}`} <BadgePO status={po.status} />
          </h2>
          <p className="text-sm text-slate-600">
            {po.namaPemasok} · dibuat {po.namaPembuat}
            {po.tanggalDipesan && ` · dipesan ${formatTanggal(po.tanggalDipesan)}`}
            {po.tanggalJanjiKirim && ` · janji kirim ${formatTanggal(po.tanggalJanjiKirim)}`}
          </p>
          {po.terlambat && (
            <p className="text-sm font-semibold text-red-700">Lewat tanggal janji kirim.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {po.status === 'DRAF' && (
            <>
              <Button variant="outline" size="sm" onClick={() => onUbah(po)}>
                Ubah
              </Button>
              {perluSetuju && (
                <Button
                  size="sm"
                  disabled={ajukan.isPending || po.kesepakatan.kurang.length > 0}
                  onClick={() =>
                    void ajukan
                      .mutateAsync(po.id)
                      .then(() =>
                        toast.success('Order diajukan. Penyetuju mendapat notifikasi di lonceng.'),
                      )
                      .catch((err: unknown) => toast.error(pesanGalat(err)))
                  }
                >
                  <ShieldCheck /> Ajukan persetujuan
                </Button>
              )}
            </>
          )}
          {po.status === 'DIAJUKAN' && !bolehPutus && (
            <Button size="sm" variant="outline" onClick={() => setDialog('kode')}>
              <ShieldCheck /> Minta kode ke {po.persetujuan.perluOwner ? 'Owner' : 'penyetuju'}
            </Button>
          )}
          {bolehPutus && (
            <>
              <Button size="sm" onClick={() => setDialog('setujui')}>
                <CheckCircle2 /> Setujui
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-700"
                onClick={() => setDialog('tolak')}
              >
                <Undo2 /> Tolak
              </Button>
            </>
          )}
          {((po.status === 'DRAF' && !perluSetuju) || po.status === 'DISETUJUI') && (
            <>
              <Button
                size="sm"
                disabled={kirim.isPending || po.kesepakatan.kurang.length > 0}
                onClick={() =>
                  void kirim
                    .mutateAsync(po.id)
                    .then((x) =>
                      toast.success(
                        `Order ${x.nomor} dikirim. Cetak atau salin teksnya untuk pemasok.`,
                      ),
                    )
                    .catch((err: unknown) => toast.error(pesanGalat(err)))
                }
              >
                <Send /> Kirim ke pemasok
              </Button>
            </>
          )}
          {berjalan && (
            <Button size="sm" asChild>
              <Link to={`/penerimaan/baru?po=${po.id}`}>
                <PackagePlus /> Terima barang
              </Link>
            </Button>
          )}
          {berjalan && (
            <Button variant="outline" size="sm" onClick={() => setDialog('konfirmasi')}>
              Konfirmasi pemasok
            </Button>
          )}
          {/* K-238: uang muka hanya sebelum barang pertama datang; sesudahnya Bayar tagihan per penerimaan. */}
          {['DIPESAN', 'DIKONFIRMASI'].includes(po.status) && adaHarga && (
            <Button variant="outline" size="sm" onClick={() => setDialog('uang-muka')}>
              Uang muka
            </Button>
          )}
          {!['DRAF', 'DIAJUKAN', 'DISETUJUI'].includes(po.status) && (
            <>
              <Button variant="outline" size="sm" onClick={() => setCetak(true)}>
                <Printer /> Cetak
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(teksPesan(po, toko?.namaToko ?? ''))
                    .then(() => toast.success('Teks pesanan disalin. Tempel di WhatsApp pemasok.'))
                    .catch(() => toast.error('Peramban menolak menyalin; pakai Cetak.'))
                }
              >
                <ClipboardCopy /> Salin teks
              </Button>
            </>
          )}
          {po.status === 'SEBAGIAN' && (
            <Button variant="outline" size="sm" onClick={() => setDialog('tutup')}>
              Tutup sisa
            </Button>
          )}
          {['DRAF', 'DIAJUKAN', 'DISETUJUI', 'DIPESAN', 'DIKONFIRMASI'].includes(po.status) &&
            po.penerimaan.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-700"
                onClick={() => setDialog('batal')}
              >
                Batalkan
              </Button>
            )}
        </div>
      </div>

      <div className="grid gap-4 @3xl:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-3">
          <KotakKesepakatan po={po} />
          <KotakPersetujuan po={po} />
          <table className="w-full text-sm [&_td]:px-1.5 [&_td:first-child]:pl-0 [&_th]:px-1.5 [&_th]:whitespace-nowrap [&_th:first-child]:pl-0">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left font-medium">Barang</th>
                <th className="py-1 text-right font-medium">Dipesan</th>
                <th className="py-1 text-right font-medium">Diterima</th>
                {adaTolak && <th className="py-1 text-right font-medium">Ditolak</th>}
                <th className="py-1 text-right font-medium">Belum datang</th>
                {adaHarga && <th className="py-1 text-right font-medium">Harga</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {po.baris.map((b) => (
                <tr key={b.id}>
                  <td className="py-1.5">
                    <p className="font-medium">{b.namaBarang}</p>
                    <p className="font-mono text-xs text-slate-500">{b.kodeBarang}</p>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatDesimal(b.qtyBerlaku)} {b.kodeSatuan}
                    {b.qtyKonfirmasi !== null && b.qtyKonfirmasi !== b.qtyPesan && (
                      <p className="text-xs text-slate-500">
                        pesan awal {formatDesimal(b.qtyPesan)}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatDesimal(b.qtyDiterima)}</td>
                  {adaTolak && (
                    <td className="py-1.5 text-right tabular-nums">
                      {Number(b.qtyDitolak) > 0 ? (
                        <span className="text-red-700">
                          {formatDesimal(b.qtyDitolak)}
                          {Number(b.qtyDipotong) > 0 && (
                            <span className="block text-xs text-slate-500">
                              {formatDesimal(b.qtyDipotong)} order dikurangi
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td
                    className={cn(
                      'py-1.5 text-right tabular-nums',
                      Number(b.qtySisa) > 0 && 'font-semibold',
                    )}
                  >
                    {formatDesimal(b.qtySisa)}
                  </td>
                  {adaHarga && (
                    <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                      {formatRupiah(b.hargaBerlaku ?? 0)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {po.catatan && <p className="text-sm text-slate-600">Catatan: {po.catatan}</p>}
          {po.alasanTutup && (
            <p className="text-sm text-slate-600">Alasan tutup/batal: {po.alasanTutup}</p>
          )}
          {po.penerimaan.length > 0 && (
            <div className="text-sm" data-testid="penerimaan-po">
              <p className="mb-1 font-medium text-slate-700">Penerimaan dan tagihan</p>
              <table className="w-full [&_td]:px-1.5 [&_td]:py-1 [&_td:first-child]:pl-0 [&_th]:px-1.5 [&_th:first-child]:pl-0">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="text-left font-medium">Nomor</th>
                    {adaHarga && <th className="text-right font-medium">Nilai</th>}
                    {adaHarga && <th className="text-right font-medium">Sisa tagihan</th>}
                    <th className="text-left font-medium">Jatuh tempo</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {po.penerimaan.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link className="text-blue-700 hover:underline" to={`/penerimaan/${t.id}`}>
                          {t.nomor}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {formatTanggal(t.tanggal)}
                          {t.penyimpanganBayar && (
                            <span className="text-amber-700"> · bayar kurang dari kesepakatan</span>
                          )}
                        </span>
                      </td>
                      {adaHarga && (
                        <td className="text-right tabular-nums">{formatRupiah(t.totalFaktur)}</td>
                      )}
                      {adaHarga && (
                        <td className="text-right font-medium tabular-nums">
                          {t.sisa > 0 ? formatRupiah(t.sisa) : 'Lunas'}
                        </td>
                      )}
                      <td>
                        {t.sisa > 0 && t.tanggalJatuhTempo ? (
                          <>
                            {formatTanggal(t.tanggalJatuhTempo)}
                            {t.hariLewat !== null && t.hariLewat > 0 && (
                              <span className="block text-xs font-semibold text-red-700">
                                Terlambat {t.hariLewat} hari
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="text-right">
                        {bolehBayarHutang && t.sisa > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setTagihan({
                                jenis: 'PENERIMAAN',
                                idPemasok: po.idPemasok,
                                id: t.id,
                                nomor: t.nomor,
                                namaPemasok: po.namaPemasok,
                                sisa: t.sisa,
                                tanggalJatuhTempo: t.tanggalJatuhTempo,
                              })
                            }
                          >
                            <Wallet /> Bayar tagihan
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          {po.ringkasanUang && <KotakRingkasanUang r={po.ringkasanUang} />}
          <KotakRiwayat riwayat={po.riwayat} />
        </div>
      </div>

      {dialog === 'konfirmasi' && <DialogKonfirmasi po={po} onTutup={() => setDialog(null)} />}
      {dialog === 'uang-muka' && <DialogUangMuka po={po} onTutup={() => setDialog(null)} />}
      {tagihan && <DialogBayarHutang h={tagihan} onTutup={() => setTagihan(null)} />}
      {dialog === 'kode' && (
        <DialogKodeAtasan
          judul={`Persetujuan jarak jauh draf #${po.id}`}
          kunci={`po-${po.id}`}
          ringkasan={
            <>
              Kode dikirim ke Telegram/email{' '}
              {po.persetujuan.perluOwner ? 'Owner' : 'Kepala Toko dan Owner'} beserta ringkasan
              order. Bila setuju, penyetuju menyebutkan kodenya kepada Anda (telepon/WA); order
              tercatat disetujui atas namanya.
            </>
          }
          mintaKode={() => mintaKodePO(po.id)}
          memproses={setujuiKode.isPending}
          onSetujui={(k) =>
            void setujuiKode
              .mutateAsync({ id: po.id, json: k })
              .then(() => {
                toast.success('Order disetujui lewat kode. Sekarang bisa dikirim ke pemasok.');
                setDialog(null);
              })
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
          onTutup={() => setDialog(null)}
        />
      )}
      {(dialog === 'setujui' || dialog === 'tolak') && (
        <DialogPutusan po={po} jenis={dialog} onTutup={() => setDialog(null)} />
      )}
      {(dialog === 'tutup' || dialog === 'batal') && (
        <DialogAkhiri po={po} jenis={dialog} onTutup={() => setDialog(null)} />
      )}
      {cetak && toko && (
        <AreaCetak ukuranKertas={ukuranKertasCss(toko.kertasDokumenLain)}>
          <OrderPembelianA4 po={po} toko={toko} />
        </AreaCetak>
      )}
    </Card>
  );
}

/** K-125: halaman Persediaan › Order Pembelian. */
export function HalamanOrderPembelian() {
  const [url, setUrl] = useSearchParams();
  const [saring, setSaring] = useIngat<SaringPO>('po.saring', {
    cari: '',
    status: (url.get('status') as SaringPO['status'] | null) ?? 'BERJALAN',
    halaman: 1,
    perHalaman: 50,
  });
  const pilih = Number(url.get('id')) || null;
  const q = useDaftarPO(saring);
  const [draf, setDraf] = useState<{ awal: DetailOrderPembelian | null } | null>(null);

  function pilihId(id: number) {
    const u = new URLSearchParams(url);
    u.set('id', String(id));
    setUrl(u, { replace: true });
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Order Pembelian</h1>
          <p className="text-sm text-slate-500">
            Pesanan ke pemasok sebelum barang datang. Barang yang sudah dipesan mengurangi saran
            pesan; barang diterima lewat Penerimaan Barang.
          </p>
        </div>
        <Button onClick={() => setDraf({ awal: null })}>
          <Plus /> Order pembelian baru
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr] xl:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="gap-2 p-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Saring status">
            {SARINGAN.map((s) => (
              <button
                key={s.label}
                type="button"
                aria-pressed={saring.status === s.nilai}
                onClick={() => setSaring((x) => ({ ...x, status: s.nilai, halaman: 1 }))}
                className={cn(
                  'h-8 rounded-md border px-2.5 text-sm',
                  saring.status === s.nilai
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'bg-white hover:bg-slate-50',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Cari nomor atau pemasok"
            aria-label="Cari order pembelian"
            value={saring.cari}
            onChange={(e) => setSaring((x) => ({ ...x, cari: e.target.value, halaman: 1 }))}
          />
          {q.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (q.data?.data.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Belum ada order pembelian.</p>
          ) : (
            <ul className="divide-y" data-testid="daftar-po">
              {q.data?.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pilihId(p.id)}
                    className={cn(
                      'w-full px-2 py-2 text-left hover:bg-slate-50',
                      pilih === p.id && 'bg-blue-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.nomor ?? `Draf #${p.id}`}</span>
                      <BadgePO status={p.status} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {p.namaPemasok} · {p.jumlahBarang} barang
                      {p.totalPerkiraan !== undefined && ` · ${formatRupiah(p.totalPerkiraan)}`}
                    </p>
                    {p.terlambat && (
                      <p className="text-xs font-semibold text-red-700">Lewat janji kirim</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {pilih ? (
          <Rincian id={pilih} onUbah={(d) => setDraf({ awal: d })} />
        ) : (
          <Card className="p-8 text-center text-sm text-slate-500">
            Pilih order di sebelah kiri, atau buat order pembelian baru. Dari tab Perencanaan
            Pengadaan juga bisa langsung membuat order per pemasok.
          </Card>
        )}
      </div>

      {draf && (
        <DialogDraf
          awal={draf.awal}
          onTutup={() => setDraf(null)}
          onTersimpan={(id) => {
            setDraf(null);
            setSaring((x) => ({ ...x, status: x.status === 'BERJALAN' ? 'DRAF' : x.status }));
            pilihId(id);
          }}
        />
      )}
    </div>
  );
}
