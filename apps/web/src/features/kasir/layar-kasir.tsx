import {
  formatRupiah,
  skemaCheckout,
  subtotalRupiah,
  POLA_QTY,
  type BarisBarang,
  type DataPembayaran,
  type DetailOrder,
  type DetailPenjualan,
  type InputCheckout,
  type Pelanggan,
  type StatusPengambilan,
} from '@sit/shared';
import { AlertTriangle, Minus, Plus, ScanLine, Trash2, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { useTampilanToko } from '@/api/pengaturan';
import {
  useBukaShift,
  useCheckout,
  useDetailOrder,
  useLepasOrder,
  useShiftSaya,
} from '@/api/penjualan';
import { AreaCetak } from '@/components/area-cetak';
import { DialogKonfirmasi } from '@/components/dialog-konfirmasi';
import { InputRupiah } from '@/components/input-rupiah';
import { PilihBarang } from '@/components/pilih-barang';
import { PeringatanPiutang } from '@/components/peringatan-piutang';
import { PilihPelanggan } from '@/components/pilih-pelanggan';
import { Struk } from '@/components/struk';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PanelPembayaran } from './panel-pembayaran';

const ID_CARI = 'cari-barang-kasir';
const BAWAAN = 'BAWAAN';

type BarisKeranjang = {
  idBarang: number;
  kode: string;
  nama: string;
  satuan: string;
  stokTersedia: string;
  hargaTier: { idTingkatHarga: number; hargaJual: number }[];
  qty: string;
  idTingkatHarga: number | null;
  diskon: number;
};

function qtyValid(q: string): boolean {
  return POLA_QTY.test(q) && /[1-9]/.test(q);
}

/** Tambah/kurangi qty bulat dengan aman (qty desimal tidak diubah oleh tombol). */
function geserQty(q: string, d: number): string {
  if (!/^\d+$/.test(q)) return q;
  return String(Math.max(1, Number(q) + d));
}

function DialogBukaShift({ onTutup }: { onTutup: () => void }) {
  const buka = useBukaShift();
  const [modal, setModal] = useState<number | null>(0);
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Buka shift kasir</DialogTitle>
          <DialogDescription>
            Isi uang modal di laci kasir saat ini. Semua pembayaran tunai tercatat ke shift ini.
          </DialogDescription>
        </DialogHeader>
        <InputRupiah value={modal} onChange={setModal} aria-label="Modal awal" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button
            disabled={buka.isPending}
            onClick={() =>
              void buka
                .mutateAsync(modal ?? 0)
                .then((s) => {
                  toast.success(`Shift ${s.nomor} dibuka.`);
                  onTutup();
                })
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            Buka shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogStruk({ p, onSelesai }: { p: DetailPenjualan; onSelesai: () => void }) {
  const toko = useTampilanToko().data;
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <Dialog open onOpenChange={(b) => !b && onSelesai()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transaksi {p.nomor} berhasil</DialogTitle>
          <DialogDescription>
            {p.statusPembayaran === 'LUNAS'
              ? 'Lunas.'
              : `Sisa tagihan ${formatRupiah(p.sisaTagihan)} menjadi piutang.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] justify-center overflow-auto rounded-md bg-slate-100 p-3">
          {toko && <Struk p={p} toko={toko} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            Cetak ulang
          </Button>
          <Button onClick={onSelesai} autoFocus>
            Transaksi baru
          </Button>
        </DialogFooter>
        {toko && (
          <AreaCetak ukuranKertas={`${toko.lebarStrukMm}mm auto`}>
            <Struk p={p} toko={toko} />
          </AreaCetak>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Layar kasir penjualan langsung (mockup): keranjang atau order dari antrean (`idOrder`), panel pembayaran.
 * Keyboard: F2 cari barang, Enter bayar (di panel pembayaran), F9 batalkan transaksi.
 */
export function LayarKasir({ idOrder }: { idOrder: number | null }) {
  const navigasi = useNavigate();
  const saya = usePengguna();
  const bolehShift = saya.izin.includes('kas.shift.kelola_sendiri');
  const bolehTier = saya.izin.includes('penjualan.tier.ubah');
  const bolehDiskon = saya.izin.includes('penjualan.diskon');
  const shift = useShiftSaya(bolehShift);
  const order = useDetailOrder(idOrder);
  const lepas = useLepasOrder();
  const checkout = useCheckout();
  const tierAktif = (useDaftarTingkatHarga().data ?? []).filter((t) => t.statusAktif === 'AKTIF');
  const tierDefault = tierAktif.find((t) => t.isDefault)?.id ?? null;

  const [keranjang, setKeranjang] = useState<BarisKeranjang[]>([]);
  const [pelanggan, setPelanggan] = useState<{
    id: number;
    nama: string;
    idTier: number | null;
  } | null>(null);
  const [namaPembeli, setNamaPembeli] = useState('');
  const [pengambilan, setPengambilan] = useState<StatusPengambilan>('DIAMBIL');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [perbarui, setPerbarui] = useState<number[]>([]);
  const [hasil, setHasil] = useState<DetailPenjualan | null>(null);
  const [dialogShift, setDialogShift] = useState(false);
  const [konfirmasiBatal, setKonfirmasiBatal] = useState(false);
  const [kunciPanel, setKunciPanel] = useState(0);

  const o: DetailOrder | undefined = order.data;
  const modeOrder = idOrder !== null;
  const tierBawaan = pelanggan?.idTier ?? tierDefault;

  function hargaKeranjang(b: BarisKeranjang): number | null {
    const id = b.idTingkatHarga ?? tierBawaan;
    return b.hargaTier.find((h) => h.idTingkatHarga === id)?.hargaJual ?? null;
  }

  function hargaOrderKini(b: DetailOrder['baris'][number]): number | null {
    if (b.hargaManual || b.idTingkatHarga === null) return null;
    return b.hargaTier.find((h) => h.idTingkatHarga === b.idTingkatHarga)?.hargaJual ?? null;
  }

  const totalKeranjang = keranjang.reduce((t, b) => {
    const h = hargaKeranjang(b);
    return (
      t + (h !== null && qtyValid(b.qty) ? Math.max(0, subtotalRupiah(b.qty, h) - b.diskon) : 0)
    );
  }, 0);
  const totalOrder = o
    ? o.total +
      o.baris.reduce((t, b) => {
        const kini = hargaOrderKini(b);
        if (!perbarui.includes(b.idBarang) || kini === null) return t;
        return t + (subtotalRupiah(b.qty, kini) - b.diskonBaris) - b.subtotal;
      }, 0)
    : 0;
  const total = modeOrder ? totalOrder : totalKeranjang;
  const adaPelanggan = modeOrder ? o?.idPelanggan != null : pelanggan !== null;
  const kosong = modeOrder ? !o : keranjang.length === 0;

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById(ID_CARI)?.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setKonfirmasiBatal(true);
      }
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  }, []);

  function tambah(b: BarisBarang) {
    setKeranjang((k) => {
      const ada = k.find((x) => x.idBarang === b.id);
      if (ada) return k.map((x) => (x === ada ? { ...x, qty: geserQty(x.qty, 1) } : x));
      return [
        ...k,
        {
          idBarang: b.id,
          kode: b.kode,
          nama: b.namaBarang,
          satuan: b.kodeSatuan,
          stokTersedia: b.stokTersedia,
          hargaTier: b.harga.map((h) => ({
            idTingkatHarga: h.idTingkatHarga,
            hargaJual: h.hargaJual,
          })),
          qty: '1',
          idTingkatHarga: null,
          diskon: 0,
        },
      ];
    });
  }

  function ubahBaris(idBarang: number, ubah: Partial<BarisKeranjang>) {
    setKeranjang((k) => k.map((x) => (x.idBarang === idBarang ? { ...x, ...ubah } : x)));
  }

  function hapusBaris(b: BarisKeranjang) {
    setKeranjang((k) => k.filter((x) => x.idBarang !== b.idBarang));
    toast(`${b.nama} dihapus dari keranjang.`, {
      duration: 8000,
      action: {
        label: 'Urungkan',
        onClick: () =>
          setKeranjang((k) => (k.some((x) => x.idBarang === b.idBarang) ? k : [...k, b])),
      },
    });
  }

  function reset() {
    setKeranjang([]);
    setPelanggan(null);
    setNamaPembeli('');
    setPengambilan('DIAMBIL');
    setJatuhTempo('');
    setPerbarui([]);
    setKunciPanel((k) => k + 1);
  }

  async function batalTransaksi() {
    if (modeOrder && o) {
      if (o.status === 'DIPROSES' && o.idKasirProses === saya.id) {
        await lepas.mutateAsync(o.id);
        toast.info(`Order ${o.nomor} dikembalikan ke antrean.`);
      }
      void navigasi('/order');
      return;
    }
    reset();
  }

  function bayar(pembayaran: DataPembayaran[]) {
    const input: InputCheckout = {
      pembayaran,
      statusPengambilan: pengambilan,
      tanggalJatuhTempo: jatuhTempo || null,
      ...(modeOrder
        ? { idOrder, perbaruiHarga: perbarui }
        : {
            order: {
              jenisPenjualan: 'LANGSUNG',
              idPelanggan: pelanggan?.id ?? null,
              namaPembeli: pelanggan ? null : namaPembeli,
              baris: keranjang.map((b) => ({
                idBarang: b.idBarang,
                qty: b.qty,
                idTingkatHarga: b.idTingkatHarga,
                diskonBaris: b.diskon,
              })),
            },
          }),
    };
    const data = skemaCheckout.safeParse(input);
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    checkout
      .mutateAsync(data.data)
      .then((p) => {
        setHasil(p);
        reset();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  // Order MENUNGGU dikunci otomatis saat checkout; yang dipegang kasir lain atau sudah final tidak bisa.
  const halangan =
    modeOrder && o
      ? o.status === 'DIPROSES' && o.idKasirProses !== saya.id
        ? `Order ${o.nomor} sedang diproses ${o.namaKasirProses ?? 'kasir lain'}.`
        : o.status !== 'MENUNGGU' && o.status !== 'DIPROSES'
          ? `Order ${o.nomor} sudah ${o.status === 'SELESAI' ? 'selesai' : 'dibatalkan'}.`
          : null
      : null;

  return (
    <div className="flex h-full flex-col gap-3">
      {bolehShift && shift.isSuccess && shift.data === null && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <AlertTriangle className="size-4" />
          <span className="flex-1">
            Shift belum dibuka. Pembayaran tunai hanya bisa diterima setelah shift dibuka.
          </span>
          <Button size="sm" onClick={() => setDialogShift(true)}>
            Buka shift
          </Button>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-white p-2">
          <ScanLine className="ml-1 size-5 text-slate-400" />
          <div className="flex-1">
            {modeOrder ? (
              <div className="px-2 text-sm text-slate-600">
                Order <span className="font-mono font-semibold">{o?.nomor}</span> dari antrean ·{' '}
                {o && (
                  <Link to={`/order/${o.id}/ubah`} className="text-blue-700 hover:underline">
                    ubah isi order
                  </Link>
                )}
              </div>
            ) : (
              <PilihBarang
                onPilih={tambah}
                idInput={ID_CARI}
                placeholder="Scan barcode atau ketik nama/kode barang… (F2)"
              />
            )}
          </div>
          <kbd className="rounded border bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">
            F2
          </kbd>
        </div>
        <div className="w-80 rounded-xl border bg-white p-2">
          {modeOrder ? (
            <div className="flex h-9 items-center gap-2 px-2 text-sm">
              <User className="size-4 text-slate-400" />
              <span className="font-medium">
                {o?.namaPelanggan ?? o?.namaPembeli ?? 'Pembeli umum'}
              </span>
            </div>
          ) : (
            <PilihPelanggan
              terpilih={pelanggan}
              onPilih={(p: Pelanggan | null) =>
                setPelanggan(
                  p ? { id: p.id, nama: p.namaPelanggan, idTier: p.idTingkatHarga } : null,
                )
              }
              label="Pelanggan"
            />
          )}
        </div>
      </div>

      <PeringatanPiutang
        idPelanggan={modeOrder ? (o?.idPelanggan ?? null) : (pelanggan?.id ?? null)}
      />

      <div className="flex min-h-[520px] flex-1 gap-3">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-white">
          <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 uppercase">
            <div className="col-span-5">Barang</div>
            <div className="col-span-2 text-right">Harga</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Subtotal</div>
            <div className="col-span-1" />
          </div>
          <div
            className="flex-1 space-y-1.5 overflow-y-auto bg-slate-50/50 p-2"
            aria-label="Keranjang"
          >
            {halangan && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {halangan}
              </div>
            )}
            {modeOrder &&
              o?.baris.map((b, i) => {
                const kini = hargaOrderKini(b);
                const beda = kini !== null && kini !== b.hargaSatuan;
                return (
                  <div
                    key={b.id}
                    className="grid grid-cols-12 items-center gap-2 rounded-lg border bg-white p-2.5"
                  >
                    <div className="col-span-5">
                      <div className="truncate text-sm font-bold">
                        {i + 1}. {b.namaBarang}
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.hargaManual ? 'Harga manual' : b.namaTier}
                        {b.diskonBaris > 0 && ` · diskon ${formatRupiah(b.diskonBaris)}`}
                      </div>
                      {beda && (
                        <label className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                          <input
                            type="checkbox"
                            checked={perbarui.includes(b.idBarang)}
                            onChange={(e) =>
                              setPerbarui((p) =>
                                e.target.checked
                                  ? [...p, b.idBarang]
                                  : p.filter((x) => x !== b.idBarang),
                              )
                            }
                          />
                          Perbarui ke harga sekarang {formatRupiah(kini)}
                        </label>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-sm tabular-nums">
                      {formatRupiah(b.hargaSatuan)}
                    </div>
                    <div className="col-span-2 text-center font-bold">
                      {formatDesimal(b.qty)} {b.kodeSatuan}
                    </div>
                    <div className="col-span-2 text-right font-bold tabular-nums">
                      {formatRupiah(b.subtotal)}
                    </div>
                  </div>
                );
              })}
            {!modeOrder && keranjang.length === 0 && (
              <p className="py-16 text-center text-sm text-slate-400">
                Keranjang kosong. Tekan F2 lalu ketik nama/kode barang.
              </p>
            )}
            {!modeOrder &&
              keranjang.map((b, i) => {
                const h = hargaKeranjang(b);
                const sub =
                  h !== null && qtyValid(b.qty)
                    ? Math.max(0, subtotalRupiah(b.qty, h) - b.diskon)
                    : 0;
                return (
                  <div
                    key={b.idBarang}
                    className="group grid grid-cols-12 items-center gap-2 rounded-lg border bg-white p-2.5 hover:border-blue-300"
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="truncate text-sm font-bold" title={b.nama}>
                        {i + 1}. {b.nama}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>
                          stok {formatDesimal(b.stokTersedia)} {b.satuan}
                        </span>
                        {bolehTier && (
                          <Select
                            value={b.idTingkatHarga === null ? BAWAAN : String(b.idTingkatHarga)}
                            onValueChange={(v) =>
                              ubahBaris(b.idBarang, {
                                idTingkatHarga: v === BAWAAN ? null : Number(v),
                              })
                            }
                          >
                            <SelectTrigger
                              size="sm"
                              className="h-6 w-28 text-xs"
                              aria-label={`Tier ${b.nama}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={BAWAAN}>
                                {tierAktif.find((t) => t.id === tierBawaan)?.nama ?? 'Bawaan'}
                              </SelectItem>
                              {tierAktif
                                .filter((t) => t.id !== tierBawaan)
                                .map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.nama}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                        {bolehDiskon && (
                          <div className="w-28">
                            <InputRupiah
                              value={b.diskon}
                              onChange={(v) => ubahBaris(b.idBarang, { diskon: v ?? 0 })}
                              className="h-6 text-xs"
                              aria-label={`Diskon ${b.nama}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-right text-sm tabular-nums">
                      {h === null ? '—' : formatRupiah(h)}
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
                        onClick={() => ubahBaris(b.idBarang, { qty: geserQty(b.qty, -1) })}
                        aria-label={`Kurangi ${b.nama}`}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <Input
                        value={b.qty}
                        onChange={(e) =>
                          ubahBaris(b.idBarang, { qty: e.target.value.replace(',', '.') })
                        }
                        className={cn(
                          'h-8 w-14 text-center font-bold',
                          !qtyValid(b.qty) && 'border-red-400',
                        )}
                        inputMode="decimal"
                        aria-label={`Qty ${b.nama}`}
                      />
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => ubahBaris(b.idBarang, { qty: geserQty(b.qty, 1) })}
                        aria-label={`Tambah ${b.nama}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <div className="col-span-2 text-right font-bold tabular-nums">
                      {formatRupiah(sub)}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        onClick={() => hapusBaris(b)}
                        aria-label={`Hapus ${b.nama}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t bg-slate-50 p-3 text-sm">
            <span className="rounded-md border bg-white px-2 py-1">
              {modeOrder ? (o?.baris.length ?? 0) : keranjang.length} macam barang
            </span>
            {!modeOrder && !pelanggan && (
              <Input
                value={namaPembeli}
                onChange={(e) => setNamaPembeli(e.target.value)}
                placeholder="Nama pembeli (opsional)"
                className="h-8 w-52 bg-white"
                maxLength={100}
                aria-label="Nama pembeli"
              />
            )}
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={pengambilan === 'BELUM_DIAMBIL'}
                onChange={(e) => setPengambilan(e.target.checked ? 'BELUM_DIAMBIL' : 'DIAMBIL')}
              />
              Barang ditinggal di toko (belum diambil)
            </label>
            <span className="flex-1" />
            <button
              type="button"
              className="flex items-center gap-1 font-bold text-red-600 hover:underline"
              onClick={() => setKonfirmasiBatal(true)}
            >
              <X className="size-4" /> Batalkan transaksi (F9)
            </button>
          </div>
        </div>

        <div className="flex w-[380px] shrink-0 flex-col gap-3">
          <div className="flex flex-col items-end rounded-xl bg-slate-900 p-5 text-white">
            <p className="mb-1 text-xs tracking-widest text-slate-300 uppercase">
              Total pembayaran
            </p>
            <h2
              className="text-4xl font-black text-emerald-400 tabular-nums"
              data-testid="total-kasir"
            >
              {formatRupiah(total)}
            </h2>
            {!modeOrder && (
              <p className="text-xs text-slate-400">perkiraan; nilai final dari server</p>
            )}
          </div>
          <div className="flex flex-1 flex-col rounded-xl border bg-white p-4">
            {adaPelanggan && (
              <label className="mb-3 flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-600">Jatuh tempo bila belum lunas</span>
                <Input
                  type="date"
                  value={jatuhTempo}
                  onChange={(e) => setJatuhTempo(e.target.value)}
                  className="h-8 w-40"
                  aria-label="Tanggal jatuh tempo"
                />
              </label>
            )}
            <PanelPembayaran
              key={kunciPanel}
              total={total}
              bolehKurang={adaPelanggan}
              memproses={checkout.isPending}
              nonaktif={kosong || halangan !== null}
              onBayar={bayar}
            />
          </div>
        </div>
      </div>

      {dialogShift && <DialogBukaShift onTutup={() => setDialogShift(false)} />}
      {hasil && (
        <DialogStruk
          p={hasil}
          onSelesai={() => {
            setHasil(null);
            if (modeOrder) void navigasi('/penjualan-langsung', { replace: true });
            setTimeout(() => document.getElementById(ID_CARI)?.focus(), 50);
          }}
        />
      )}
      <DialogKonfirmasi
        terbuka={konfirmasiBatal}
        onTutup={() => setKonfirmasiBatal(false)}
        judul="Batalkan transaksi ini?"
        pesan={
          modeOrder
            ? 'Order dikembalikan ke antrean dan bisa diproses lagi nanti.'
            : 'Keranjang dikosongkan.'
        }
        labelKonfirmasi="Ya, batalkan"
        bahaya
        onKonfirmasi={batalTransaksi}
      />
    </div>
  );
}
