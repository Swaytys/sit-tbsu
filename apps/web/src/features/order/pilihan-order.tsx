import { formatRupiah, type BarisDaftarOrder } from '@sit/shared';
import { CalendarClock, FilePen, Undo2, X } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useDaftarOrder, useKeDrafOrder, useLepasOrder } from '@/api/penjualan';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDesimal } from '@/lib/format';
import { DialogSimpanOrder } from './dialog-simpan-order';
import { DialogBatal } from './dialog-batal-order';

type OrderRingkas = Pick<
  BarisDaftarOrder,
  'id' | 'nomor' | 'noAntrean' | 'namaPelanggan' | 'namaPembeli' | 'noHpPembeli'
>;

const namaPembeli = (o: OrderRingkas) => o.namaPelanggan ?? o.namaPembeli ?? 'Pembeli umum';

/**
 * Pilihan untuk order yang sedang dipegang kasir saat transaksinya tidak diteruskan (K-122): kembali ke antrean
 * (A), simpan untuk diambil nanti (S), atau kembali ke draf (D). Perubahan di layar yang belum dibayar dibuang.
 */
export function DialogPilihanOrder({
  order,
  onKeAntrean,
  onSelesai,
  onTutup,
}: {
  order: OrderRingkas;
  onKeAntrean: () => Promise<void>;
  onSelesai: () => void;
  onTutup: () => void;
}) {
  const keDraf = useKeDrafOrder();
  const [simpan, setSimpan] = useState(false);
  const [memproses, setMemproses] = useState(false);

  async function jalankan(kerja: () => Promise<void>) {
    if (memproses) return;
    setMemproses(true);
    try {
      await kerja();
      onSelesai();
    } catch (err) {
      toast.error(pesanGalat(err));
    } finally {
      setMemproses(false);
    }
  }

  const antrean = () => jalankan(onKeAntrean);
  const draf = () =>
    jalankan(async () => {
      await keDraf.mutateAsync(order.id);
      toast.success(
        `Antrean ${order.noAntrean} dikembalikan ke draf; stoknya dilepas, barangnya tetap tersimpan.`,
      );
    });

  const tombol = useEffectEvent((e: KeyboardEvent) => {
    if (simpan || memproses) return;
    const k = e.key.toLowerCase();
    if (k === 'a') {
      e.preventDefault();
      void antrean();
    } else if (k === 's') {
      e.preventDefault();
      setSimpan(true);
    } else if (k === 'd') {
      e.preventDefault();
      void draf();
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => tombol(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (simpan) {
    return (
      <DialogSimpanOrder
        order={{
          nomor: order.nomor,
          namaPelanggan: order.namaPelanggan,
          namaPembeli: order.namaPembeli,
          noHp: order.noHpPembeli,
        }}
        siapkan={() => Promise.resolve(order.id)}
        onTersimpan={() => onSelesai()}
        onTutup={() => setSimpan(false)}
      />
    );
  }

  const pilihan: {
    kunci: string;
    judul: string;
    ket: string;
    ikon: typeof Undo2;
    aksi: () => void;
  }[] = [
    {
      kunci: 'A',
      judul: 'Kembalikan ke antrean',
      ket: 'Pembeli masih di toko dan akan dilayani lagi. Stok tetap ditahan.',
      ikon: Undo2,
      aksi: () => void antrean(),
    },
    {
      kunci: 'S',
      judul: 'Simpan untuk diambil nanti…',
      ket: 'Pembeli datang lagi lain waktu (isi No. HP dan tanggal ambil). Stok tetap ditahan, order keluar dari antrean.',
      ikon: CalendarClock,
      aksi: () => setSimpan(true),
    },
    {
      kunci: 'D',
      judul: 'Kembalikan ke draf',
      ket: 'Pembeli batal untuk sementara (mis. lupa membawa dompet). Stok dilepas; daftar barangnya tetap tersimpan sebagai draf.',
      ikon: FilePen,
      aksi: () => void draf(),
    },
  ];

  return (
    <Dialog open onOpenChange={(b) => !b && !memproses && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Antrean {order.noAntrean} ({namaPembeli(order)}): mau diapakan?
          </DialogTitle>
          <DialogDescription>
            Order tidak dihapus. Perubahan barang dan isian pembayaran di layar ini yang belum
            dibayar dibuang.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {pilihan.map((p) => (
            <button
              key={p.kunci}
              type="button"
              disabled={memproses}
              onClick={p.aksi}
              className="flex w-full items-start gap-3 rounded-lg border p-3 text-left hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
            >
              <kbd className="mt-0.5 min-w-7 rounded border bg-slate-50 px-1.5 text-center font-mono text-xs">
                {p.kunci}
              </kbd>
              <span>
                <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <p.ikon className="size-4" /> {p.judul}
                </span>
                <span className="block text-sm text-slate-600">{p.ket}</span>
              </span>
            </button>
          ))}
          <p className="text-xs text-slate-500">
            <kbd className="font-mono">Esc</kbd> = kembali ke transaksi.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tutup shift (K-121 butir 9, K-133): semua order yang belum selesai (di antrean dan sedang di kasir), dengan
 * pilihan per order. Yang tidak diubah tetap di antrean (stok tetap ditahan); yang sedang di kasir kembali ke
 * antrean saat shift ditutup.
 */
export function DaftarOrderBelumSelesai() {
  const saya = usePengguna();
  const izin = (k: Parameters<typeof saya.izin.includes>[0]) => saya.izin.includes(k);
  const daftar = useDaftarOrder({
    cari: '',
    status: 'AKTIF',
    jenis: null,
    milikSaya: false,
    halaman: 1,
    perHalaman: 100,
  });
  const lepas = useLepasOrder();
  const keDraf = useKeDrafOrder();
  const [simpan, setSimpan] = useState<BarisDaftarOrder | null>(null);
  const [batal, setBatal] = useState<BarisDaftarOrder | null>(null);
  const data = daftar.data?.data ?? [];
  if (data.length === 0) return null;
  const jalankan = (p: Promise<unknown>, pesan: string) =>
    void p.then(() => toast.success(pesan)).catch((err: unknown) => toast.error(pesanGalat(err)));

  return (
    <div
      className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3"
      data-testid="order-belum-selesai"
    >
      <p className="text-sm font-semibold text-amber-900">{data.length} order belum selesai</p>
      <p className="text-xs text-amber-900">
        Yang tidak diubah tetap di antrean (stok tetap ditahan).
      </p>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto">
        {data.map((o) => {
          const diKasir = o.status === 'DIPROSES';
          const pegangSaya = diKasir && o.idKasirProses === saya.id;
          const bolehLepas = diKasir && (pegangSaya || izin('penjualan.order.lepas_paksa'));
          const bolehDraf = !diKasir || bolehLepas;
          const bolehSimpan = !diKasir || pegangSaya;
          const bolehBatal =
            izin('penjualan.order.batal') &&
            (!diKasir || pegangSaya || izin('penjualan.order.lepas_paksa'));
          return (
            <li key={o.id} className="rounded-md border bg-white p-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span>
                  <b className="tabular-nums">Antrean {o.noAntrean}</b> · {namaPembeli(o)}
                  <span className="text-xs text-slate-500">
                    {' '}
                    · input {o.namaPengguna}
                    {diKasir && ` · di kasir ${o.namaKasirProses ?? ''}`}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatRupiah(o.total)}</span>
              </div>
              <p className="truncate text-xs text-slate-600">
                {o.ringkasan.map((r) => `${r.namaBarang} ${formatDesimal(r.qty)}`).join(' · ')}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {bolehLepas && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={lepas.isPending}
                    onClick={() =>
                      jalankan(
                        lepas.mutateAsync(o.id),
                        `Antrean ${o.noAntrean} kembali ke antrean.`,
                      )
                    }
                  >
                    <Undo2 /> Ke antrean
                  </Button>
                )}
                {bolehSimpan && (
                  <Button size="sm" variant="outline" onClick={() => setSimpan(o)}>
                    <CalendarClock /> Simpan nanti…
                  </Button>
                )}
                {bolehDraf && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={keDraf.isPending}
                    onClick={() =>
                      jalankan(
                        keDraf.mutateAsync(o.id),
                        `Antrean ${o.noAntrean} jadi draf; stok dilepas.`,
                      )
                    }
                  >
                    <FilePen /> Ke draf
                  </Button>
                )}
                {bolehBatal && (
                  <Button size="sm" variant="outline" onClick={() => setBatal(o)}>
                    <X /> Batalkan…
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {simpan && (
        <DialogSimpanOrder
          order={{
            nomor: simpan.nomor,
            namaPelanggan: simpan.namaPelanggan,
            namaPembeli: simpan.namaPembeli,
            noHp: simpan.noHpPembeli,
          }}
          siapkan={() => Promise.resolve(simpan.id)}
          onTersimpan={() => setSimpan(null)}
          onTutup={() => setSimpan(null)}
        />
      )}
      {batal && <DialogBatal d={batal} onTutup={() => setBatal(null)} />}
    </div>
  );
}

/** Tautan kecil ke daftar order disimpan (K-122), untuk layar kasir: pembeli yang datang mengambil pesanannya. */
export function TautanOrderDisimpan() {
  const daftar = useDaftarOrder({
    cari: '',
    status: 'DISIMPAN',
    jenis: null,
    milikSaya: false,
    halaman: 1,
    perHalaman: 100,
  });
  const data = daftar.data?.data ?? [];
  if (data.length === 0) return null;
  const lewat = data.filter((o) => o.lewatTanggalAmbil).length;
  return (
    <Link
      to="/order?status=DISIMPAN"
      className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800 hover:bg-violet-200"
      title="Order yang dipesan untuk diambil nanti. Saat pembelinya datang: buka, lalu Proses ke pembayaran."
    >
      <CalendarClock className="mr-1 inline size-3.5" />
      {data.length} disimpan{lewat > 0 && <span className="text-red-700"> ({lewat} lewat)</span>}
    </Link>
  );
}
