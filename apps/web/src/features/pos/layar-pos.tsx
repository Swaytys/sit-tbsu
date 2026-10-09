import {
  kunciBaris,
  formatRupiah,
  skemaCheckout,
  skemaSuratJalan,
  type BarisBarang,
  type BarisSuratJalan,
  type DataCheckout,
  type DataPembayaran,
  type DetailPenjualan,
  type InputCheckout,
  type JenisPenjualan,
  type TiketAntrean,
} from '@sit/shared';
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react';
import { Printer } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { ambilData, api, GalatApi, pesanGalat } from '@/api/client';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { useTampilanToko } from '@/api/pengaturan';
import {
  catatCetakUlang,
  useBukaShift,
  useBuatSuratJalan,
  useCheckout,
  useLepasOrder,
  usePapanAntrean,
  usePratinjauOrder,
  useProsesOrder,
  useShiftSaya,
  useSiaranAntrean,
} from '@/api/penjualan';
import { AreaCetak } from '@/components/area-cetak';
import { DialogKonfirmasi } from '@/components/dialog-konfirmasi';
import { InvoiceA4, SuratJalanA4 } from '@/components/dokumen-a4';
import { PeringatanPiutang } from '@/components/peringatan-piutang';
import { Struk } from '@/components/struk';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BilahTombol, type Tombol } from './bilah-tombol';
import { CariBarangPos } from './cari-barang-pos';
import { CariPelangganPos } from './cari-pelanggan-pos';
import { KeranjangPos } from './keranjang-pos';
import { digitSaja, tampilRibuan } from './model';
import { PanelBayarPos } from './panel-bayar-pos';
import { PapanAntrean } from './papan-antrean';
import { useTransaksiPos } from './use-transaksi-pos';

type Zona = 'antrean' | 'cari' | 'keranjang' | 'bayar' | 'pelanggan' | 'hasil';

const ID: Record<Zona, string> = {
  antrean: 'pos-antrean',
  cari: 'pos-cari',
  keranjang: 'pos-keranjang',
  bayar: 'pos-bayar',
  pelanggan: 'pos-pelanggan',
  hasil: 'pos-hasil',
};

type Cetakan =
  { jenis: 'struk' | 'invoice'; p: DetailPenjualan } | { jenis: 'sj'; sj: BarisSuratJalan } | null;

const TOMBOL_UMUM: Tombol[] = [
  { kunci: 'F2', label: 'Cari barang' },
  { kunci: 'F1', label: 'Qty (*)' },
  { kunci: 'F3', label: 'Antrean' },
  { kunci: 'F4', label: 'Pelanggan' },
  { kunci: 'F8', label: 'Bayar' },
  { kunci: 'F9', label: 'Batal' },
];

const TOMBOL_ZONA: Record<Zona, Tombol[]> = {
  antrean: [
    { kunci: '←↑→↓', label: 'Pilih order' },
    { kunci: 'Angka+Enter', label: 'Panggil nomor' },
    { kunci: 'Enter', label: 'Proses' },
  ],
  cari: [
    { kunci: 'Enter', label: 'Tambah (kosong = bayar)' },
    { kunci: '3*nama', label: 'Qty 3' },
    { kunci: '↓', label: 'Ke daftar barang' },
  ],
  keranjang: [
    { kunci: '+ −', label: 'Qty ±1' },
    { kunci: 'Angka', label: 'Ubah qty' },
    { kunci: '%', label: 'Diskon' },
    { kunci: 'S', label: 'Ganti satuan' },
    { kunci: 'T', label: 'Tier' },
    { kunci: 'P', label: 'Lepas promo' },
    { kunci: 'Del', label: 'Hapus' },
    { kunci: 'Ctrl+Z', label: 'Urungkan' },
  ],
  bayar: [
    { kunci: 'Angka', label: 'Uang/nominal' },
    { kunci: 'Enter', label: 'Bayar' },
    { kunci: 'T/B/E', label: 'Tunai/Transfer/EDC' },
    { kunci: 'C', label: 'Campuran' },
  ],
  pelanggan: [
    { kunci: 'Enter', label: 'Pilih (kosong = umum)' },
    { kunci: 'Esc', label: 'Batal' },
  ],
  hasil: [
    { kunci: 'P', label: 'Cetak invoice' },
    { kunci: 'S', label: 'Surat jalan & cetak' },
    { kunci: 'Enter', label: 'Lanjut' },
  ],
};

function DialogBukaShift({ onTutup }: { onTutup: () => void }) {
  const buka = useBukaShift();
  const [modal, setModal] = useState('');
  function kirim() {
    buka
      .mutateAsync(Number(modal || '0'))
      .then((s) => {
        toast.success(`Shift ${s.nomor} dibuka.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-label="Buka shift kasir"
    >
      <div className="w-80 space-y-3 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="font-semibold">Buka shift kasir</h2>
        <p className="text-sm text-slate-500">
          Uang modal di laci saat ini. Enter simpan, Esc batal.
        </p>
        <input
          autoFocus
          aria-label="Modal awal"
          inputMode="numeric"
          value={tampilRibuan(modal)}
          onChange={(e) => setModal(digitSaja(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              kirim();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onTutup();
            }
          }}
          placeholder="Rp 0"
          className="h-11 w-full rounded-md border px-3 text-right text-xl font-bold"
        />
      </div>
    </div>
  );
}

/**
 * Layar POS keyboard-first (K-073) untuk penjualan langsung dan pengantaran: papan antrean FIFO (kiri) dan
 * transaksi aktif (kanan). Seluruh alur bisa dijalankan tanpa mouse; tombol yang berlaku selalu tampil di
 * bawah layar.
 */
export function LayarPos({
  jenis,
  idOrderAwal,
}: {
  jenis: JenisPenjualan;
  idOrderAwal: number | null;
}) {
  const navigasi = useNavigate();
  const saya = usePengguna();
  const pengantaran = jenis === 'PENGANTARAN';
  const bolehShift = saya.izin.includes('kas.shift.kelola_sendiri');
  useSiaranAntrean();
  const papan = usePapanAntrean(jenis);
  const tiket = papan.data ?? [];
  const tierAktif = (useDaftarTingkatHarga().data ?? []).filter((t) => t.statusAktif === 'AKTIF');
  const tierDefault = tierAktif.find((t) => t.isDefault)?.id ?? null;
  const toko = useTampilanToko().data;
  const shift = useShiftSaya(bolehShift);
  const proses = useProsesOrder();
  const lepas = useLepasOrder();
  const checkout = useCheckout();
  const buatSj = useBuatSuratJalan();
  const tr = useTransaksiPos(tierDefault);

  const [zona, setZona] = useState<Zona>(pengantaran || idOrderAwal ? 'antrean' : 'cari');
  const [indeksTiket, setIndeksTiket] = useState(0);
  const [indeksBaris, setIndeksBaris] = useState(0);
  const [ditinggal, setDitinggal] = useState(false);
  const [bayarSaatTerima, setBayarSaatTerima] = useState(false);
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [hasil, setHasil] = useState<DetailPenjualan | null>(null);
  /** K-095: penjualan yang menunggu jawaban "cetak struk?" (mode TANYA). */
  const [tanyaStruk, setTanyaStruk] = useState<DetailPenjualan | null>(null);
  const [strukTercetak, setStrukTercetak] = useState(false);

  /** Cetak struk; cetakan kedua dan seterusnya dicatat sebagai cetak ulang (log). */
  function cetakStruk(p: DetailPenjualan, ulang: boolean) {
    if (ulang) void catatCetakUlang(p.id).catch(() => undefined);
    setCetak({ jenis: 'struk', p });
    setStrukTercetak(true);
  }
  const [cetak, setCetak] = useState<Cetakan>(null);
  const [kunciPanel, setKunciPanel] = useState(0);
  const [dialogShift, setDialogShift] = useState(false);
  const [shiftDitunda, setShiftDitunda] = useState(false);
  const [sedangProses, setSedangProses] = useState(false);
  // PT6: checkout ditolak karena limit kredit; pemegang izin atur kredit boleh melanjutkan.
  const [limit, setLimit] = useState<{ data: DataCheckout; pesan: string } | null>(null);

  const order = tr.t.order;
  const adaTransaksi = order !== null || tr.t.baris.length > 0;
  // PR5: harga, promo, dan total dari API setiap isi berubah; angka lokal hanya cadangan sementara.
  const pratinjau = usePratinjauOrder(
    tr.t.baris.length > 0 ? { idOrder: order?.id ?? null, order: tr.isianOrder(jenis) } : null,
  );
  const pratinjauBaris = new Map(
    (pratinjau.data?.baris ?? []).map((b) => [kunciBaris(b.idBarang, b.idSatuanJual), b]),
  );
  const totalTampil = pratinjau.segar && pratinjau.data ? pratinjau.data.total : tr.total;
  const indeksAman = Math.min(indeksTiket, Math.max(0, tiket.length - 1));
  const tanpaShift = bolehShift && shift.isSuccess && shift.data === null;

  // Fokus mengikuti zona (juga setelah panel bayar dibuat ulang untuk transaksi baru).
  useEffect(() => {
    if (zona !== 'pelanggan') document.getElementById(ID[zona])?.focus();
  }, [zona, kunciPanel]);

  // Cetak dokumen lalu kosongkan area cetak.
  useEffect(() => {
    if (!cetak) return;
    const t = setTimeout(() => {
      window.print();
      setCetak(null);
    }, 50);
    return () => clearTimeout(t);
  }, [cetak]);

  function mulaiBaru() {
    setIndeksBaris(0);
    setDitinggal(false);
    setBayarSaatTerima(false);
    setJatuhTempo('');
    setKunciPanel((k) => k + 1);
  }

  async function prosesTiket(t: TiketAntrean) {
    if (sedangProses) return;
    if (order?.id === t.id) {
      setZona('bayar');
      return;
    }
    if (t.status === 'DIPROSES' && t.idKasirProses !== saya.id) {
      toast.error(`Antrean ${t.noAntrean} sedang dipegang ${t.namaKasirProses ?? 'kasir lain'}.`);
      return;
    }
    if (!order && tr.t.baris.length > 0) {
      toast.error('Selesaikan atau batalkan (F9) transaksi yang sedang berjalan dulu.');
      return;
    }
    setSedangProses(true);
    try {
      // Order lain yang sedang dibuka (belum diubah) dikembalikan ke antrean.
      if (order) {
        if (tr.t.diubah) {
          toast.error('Order aktif sudah diubah. Bayar atau batalkan (F9) dulu.');
          return;
        }
        await lepas.mutateAsync(order.id);
      }
      const d = await proses.mutateAsync(t.id);
      tr.muatOrder(d);
      setHasil(null);
      mulaiBaru();
      setZona('bayar');
    } catch (err) {
      toast.error(pesanGalat(err));
    } finally {
      setSedangProses(false);
    }
  }

  // Dibuka dari halaman Order (…?order=ID): langsung proses order itu.
  const bukaOrderAwal = useEffectEvent((id: number) => {
    const t = tiket.find((x) => x.id === id);
    if (t) void prosesTiket(t);
  });
  const awalTerproses = useRef<number | null>(null);
  useEffect(() => {
    if (idOrderAwal && awalTerproses.current !== idOrderAwal && papan.isSuccess) {
      awalTerproses.current = idOrderAwal;
      bukaOrderAwal(idOrderAwal);
    }
  }, [idOrderAwal, papan.isSuccess]);

  // Pindah halaman saat order masih dipegang: kembalikan ke antrean agar tidak terkunci 30 menit (R8).
  const idOrderAktif = order?.id ?? null;
  const lepasSaatKeluar = useEffectEvent(() => {
    if (idOrderAktif) {
      void api.order[':id'].lepas
        .$post({ param: { id: String(idOrderAktif) } })
        .then(ambilData)
        .catch(() => undefined); // gagal = dilepas otomatis oleh job R8
    }
  });
  useEffect(() => () => lepasSaatKeluar(), []);

  async function batal() {
    if (order) {
      try {
        await lepas.mutateAsync(order.id);
        toast(`Antrean ${order.noAntrean} dikembalikan ke antrean.`);
      } catch (err) {
        toast.error(pesanGalat(err));
      }
      tr.kosongkan();
      mulaiBaru();
      setZona('antrean');
      if (idOrderAwal)
        void navigasi(pengantaran ? '/penjualan-pengantaran' : '/penjualan-langsung', {
          replace: true,
        });
    } else if (tr.t.baris.length > 0) {
      tr.kosongkan(true);
      mulaiBaru();
      setZona('cari');
    }
  }

  function tambahBarang(b: BarisBarang, qty: string, idSatuanJual?: number | null) {
    if (pengantaran && !order) {
      toast.error('Pilih order pengantaran dari antrean dulu (F3).');
      return;
    }
    setHasil(null);
    setIndeksBaris(tr.tambah(b, qty, idSatuanJual));
  }

  function bayar(pembayaran: DataPembayaran[]) {
    if (pengantaran && !order) {
      toast.error('Pilih order pengantaran dari antrean dulu (F3).');
      return;
    }
    if (tr.t.baris.length === 0) {
      toast.error('Belum ada barang.');
      return;
    }
    const dasar: InputCheckout = {
      pembayaran,
      statusPengambilan: !pengantaran && ditinggal ? 'BELUM_DIAMBIL' : 'DIAMBIL',
      tanggalJatuhTempo: jatuhTempo || null,
      bayarSaatTerima: pengantaran && bayarSaatTerima,
    };
    const input: InputCheckout = order
      ? { ...dasar, idOrder: order.id, order: tr.t.diubah ? tr.isianOrder(jenis) : null }
      : { ...dasar, order: tr.isianOrder(jenis) };
    const data = skemaCheckout.safeParse(input);
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    void kirimCheckout(data.data);
  }

  async function kirimCheckout(data: DataCheckout) {
    return checkout
      .mutateAsync(data)
      .then((p) => {
        setHasil(p);
        // K-074/K-095: struk penjualan langsung mengikuti Pengaturan (langsung cetak, tanya dulu, atau tidak);
        // invoice pengantaran hanya bila diminta (P).
        setStrukTercetak(false);
        if (!pengantaran) {
          const mode = toko?.strukCetak ?? 'OTOMATIS';
          if (mode === 'OTOMATIS') cetakStruk(p, false);
          else if (mode === 'TANYA') setTanyaStruk(p);
        }
        tr.kosongkan();
        mulaiBaru();
        setZona(pengantaran ? 'hasil' : tiket.length > 1 ? 'antrean' : 'cari');
        if (idOrderAwal)
          void navigasi(pengantaran ? '/penjualan-pengantaran' : '/penjualan-langsung', {
            replace: true,
          });
      })
      .catch((err: unknown) => {
        const pesan = pesanGalat(err);
        if (err instanceof GalatApi && err.kode === 'LIMIT_TERLAMPAUI') {
          const bolehLanjut =
            typeof err.detail === 'object' &&
            err.detail !== null &&
            'bolehLanjut' in err.detail &&
            err.detail.bolehLanjut === true;
          if (bolehLanjut && !data.setujuLimit) {
            setLimit({ data, pesan });
            return;
          }
          toast.error(`${pesan} Minta Admin/Owner menyetujui, atau terima pembayaran lebih dulu.`);
          return;
        }
        toast.error(pesan);
        if (pesan.includes('Buka shift')) setDialogShift(true);
      });
  }

  function suratJalanSemua() {
    if (!hasil || buatSj.isPending) return;
    const data = skemaSuratJalan.safeParse({
      baris: hasil.baris
        .filter((b) => /[1-9]/.test(b.qtyBelumDikirim))
        .map((b) => ({ idPenjualanDetail: b.id, qtyKirim: b.qtyBelumDikirim })),
    });
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Tidak ada barang untuk dikirim.');
      return;
    }
    buatSj
      .mutateAsync({ id: hasil.id, json: data.data })
      .then((sj) => {
        toast.success(`Surat jalan ${sj.nomor} dibuat.`);
        setCetak({ jenis: 'sj', sj });
        setHasil(null);
        setZona('antrean');
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  // Tombol fungsi berlaku di mana pun fokus berada.
  const tombolGlobal = useEffectEvent((e: globalThis.KeyboardEvent) => {
    const aksi: Record<string, () => void> = {
      F2: () => setZona('cari'),
      F3: () => setZona('antrean'),
      F4: () => setZona('pelanggan'),
      F8: () => setZona('bayar'),
      F9: () => void batal(),
    };
    const f = aksi[e.key];
    if (f) {
      e.preventDefault();
      f();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && tr.adaCadangan) {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.value) return; // urungkan ketikan biasa
      e.preventDefault();
      tr.urungkan();
    }
  });
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => tombolGlobal(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const kembalianTerakhir = hasil?.pembayaran.reduce((t, b) => t + b.kembalian, 0) ?? 0;
  const tombol = [...TOMBOL_UMUM, ...TOMBOL_ZONA[zona]];
  // Shift dibuka sekali sehari: dialog muncul sendiri saat layar dibuka tanpa shift (Esc = nanti).
  const tampilDialogShift = dialogShift || (tanpaShift && !shiftDitunda);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] flex-col gap-2">
      {tanpaShift && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
          Shift belum dibuka — tunai belum bisa diterima.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setDialogShift(true)}
          >
            Buka shift
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Kiri: papan antrean */}
        <section className="flex w-[55%] min-w-0 flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-700">
              Antrean {pengantaran ? 'pengantaran' : 'langsung'}{' '}
              <kbd className="font-mono text-xs text-slate-400">F3</kbd>
            </span>
            <span className="text-xs text-slate-500">
              {tiket.length} order · urut yang paling lama menunggu
            </span>
          </div>
          <PapanAntrean
            id={ID.antrean}
            tiket={tiket}
            indeks={indeksAman}
            onIndeks={setIndeksTiket}
            onProses={(t) => void prosesTiket(t)}
            onKeluar={() => setZona(pengantaran ? 'bayar' : 'cari')}
            onFokus={() => setZona('antrean')}
            aktif={zona === 'antrean'}
            idTransaksi={order?.id ?? null}
            idSaya={saya.id}
            kolom={2}
            pengantaran={pengantaran}
          />
        </section>

        {/* Kanan: transaksi aktif */}
        <section className="flex min-h-0 w-[45%] min-w-0 flex-col gap-2 overflow-y-auto pr-1">
          <div className="rounded-md border bg-white px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">
                {order ? (
                  <>
                    Antrean <span className="text-lg font-black">{order.noAntrean}</span>{' '}
                    <span className="font-mono text-xs text-slate-500">{order.nomor}</span>
                  </>
                ) : pengantaran ? (
                  'Pilih order pengantaran (F3)'
                ) : (
                  'Jual langsung tanpa order'
                )}
              </span>
              {order?.diskonTransaksi ? (
                <span className="text-xs text-slate-500">
                  diskon {formatRupiah(order.diskonTransaksi)}
                </span>
              ) : null}
            </div>
            {zona === 'pelanggan' ? (
              <div className="mt-1" id={ID.pelanggan}>
                <CariPelangganPos
                  id="pos-cari-pelanggan"
                  onPilih={(p) => {
                    if (pengantaran && !p) {
                      toast.error('Pengantaran wajib pelanggan.');
                      return;
                    }
                    tr.aturPelanggan(p);
                    setZona('bayar');
                  }}
                  onEsc={() => setZona('bayar')}
                />
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="text-slate-500">
                  Pelanggan <kbd className="font-mono text-xs">F4</kbd>:
                </span>
                <span className="font-medium">{tr.t.pelanggan?.nama ?? 'Pembeli umum'}</span>
                {!tr.t.pelanggan && !pengantaran && (
                  <input
                    value={tr.t.namaPembeli}
                    onChange={(e) => tr.aturNamaPembeli(e.target.value)}
                    maxLength={100}
                    placeholder="ciri/nama (opsional)"
                    aria-label="Nama pembeli"
                    className="h-7 min-w-0 flex-1 rounded border px-2 text-xs"
                  />
                )}
              </div>
            )}
            {pengantaran && order && (
              <div className="mt-0.5 truncate text-xs text-slate-500">
                Kirim ke {order.alamatKirim}
                {order.ongkir > 0 && ` · ongkir ${formatRupiah(order.ongkir)}`}
              </div>
            )}
            <PeringatanPiutang idPelanggan={tr.t.pelanggan?.id ?? null} />
          </div>

          <CariBarangPos
            id={ID.cari}
            aktif={zona === 'cari'}
            tierBawaan={tr.tierBawaan}
            onTambah={tambahBarang}
            onKosongEnter={() => setZona('bayar')}
            onTurun={() => tr.t.baris.length > 0 && setZona('keranjang')}
            onEsc={() => setZona('antrean')}
            onFokus={() => setZona('cari')}
          />

          {!adaTransaksi && hasil && !pengantaran ? (
            <div
              className="flex flex-1 flex-col items-center justify-center rounded-md border-2 border-emerald-400 bg-emerald-50 p-4 text-center"
              data-testid="hasil-transaksi"
            >
              <div className="text-sm text-emerald-800">
                {hasil.nomor} ·{' '}
                {hasil.statusPembayaran === 'LUNAS'
                  ? 'LUNAS'
                  : `sisa ${formatRupiah(hasil.sisaTagihan)}`}
              </div>
              <div className="text-xs tracking-widest text-emerald-700 uppercase">Kembalian</div>
              <div className="text-5xl font-black text-emerald-700 tabular-nums">
                {formatRupiah(kembalianTerakhir)}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => cetakStruk(hasil, strukTercetak)}
              >
                <Printer /> {strukTercetak ? 'Cetak struk lagi' : 'Cetak struk'}
              </Button>
            </div>
          ) : (
            <KeranjangPos
              id={ID.keranjang}
              baris={tr.t.baris}
              tierBawaan={tr.tierBawaan}
              namaTier={(id) => tierAktif.find((t) => t.id === id)?.nama ?? 'tier lain'}
              urutanTier={tierAktif.map((t) => t.id)}
              indeks={Math.min(indeksBaris, Math.max(0, tr.t.baris.length - 1))}
              onIndeks={setIndeksBaris}
              aktif={zona === 'keranjang'}
              onUbah={tr.ubah}
              onHapus={(i) => {
                tr.hapus(i);
                setIndeksBaris(Math.max(0, i - 1));
              }}
              onKeluar={() => setZona('cari')}
              onLanjut={() => setZona('bayar')}
              onFokus={() => setZona('keranjang')}
              bolehTier={saya.izin.includes('penjualan.tier.ubah')}
              bolehDiskon={saya.izin.includes('penjualan.diskon')}
              bolehLepasPromo={saya.izin.includes('penjualan.checkout')}
              pratinjau={pratinjauBaris}
            />
          )}

          {pengantaran && hasil && (
            <div
              id={ID.hasil}
              tabIndex={0}
              onFocus={() => setZona('hasil')}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 's' || e.key === 'S') {
                  e.preventDefault();
                  suratJalanSemua();
                } else if (e.key === 'p' || e.key === 'P') {
                  e.preventDefault();
                  setCetak({ jenis: 'invoice', p: hasil });
                } else if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  setHasil(null);
                  setZona('antrean');
                }
              }}
              className={cn(
                'rounded-md border-2 border-emerald-400 bg-emerald-50 p-3 text-sm outline-none',
                zona === 'hasil' && 'ring-2 ring-blue-500',
              )}
              data-testid="hasil-transaksi"
            >
              <div className="font-semibold text-emerald-800">
                Invoice {hasil.nomor} dibuat (
                {hasil.statusPembayaran === 'LUNAS'
                  ? 'lunas'
                  : `sisa ${formatRupiah(hasil.sisaTagihan)}`}
                ).
              </div>
              <div className="mt-1 text-slate-700">
                <kbd className="rounded bg-slate-800 px-1.5 font-mono text-white">P</kbd> cetak
                invoice · <kbd className="rounded bg-slate-800 px-1.5 font-mono text-white">S</kbd>{' '}
                buat surat jalan semua barang &amp; cetak ·{' '}
                <kbd className="rounded bg-slate-800 px-1.5 font-mono text-white">Enter</kbd> lanjut
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between rounded-md bg-slate-900 px-3 py-2 text-white">
            <span className="text-xs tracking-widest text-slate-300 uppercase">
              Total
              {pratinjau.segar ? '' : ' (menghitung…)'}
              {pratinjau.segar && pratinjau.data && pratinjau.data.totalDiskonPromo > 0 && (
                <span className="ml-2 tracking-normal text-emerald-300 normal-case">
                  hemat promo {formatRupiah(pratinjau.data.totalDiskonPromo)}
                </span>
              )}
            </span>
            <span
              className="text-3xl font-black text-emerald-400 tabular-nums"
              data-testid="total-pos"
            >
              {formatRupiah(adaTransaksi ? totalTampil : 0)}
            </span>
          </div>

          {tr.t.pelanggan && (
            <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
              Jatuh tempo bila belum lunas (kosong = sesuai term pelanggan)
              <input
                type="date"
                value={jatuhTempo}
                onChange={(e) => setJatuhTempo(e.target.value)}
                aria-label="Tanggal jatuh tempo"
                className="h-7 rounded border px-1"
              />
            </label>
          )}

          <PanelBayarPos
            key={kunciPanel}
            id={ID.bayar}
            aktif={zona === 'bayar'}
            total={adaTransaksi ? totalTampil : 0}
            mode={pengantaran ? 'pengantaran' : 'langsung'}
            bolehKurang={pengantaran || tr.t.pelanggan !== null}
            rekeningTransfer={toko?.rekeningTransfer ?? ''}
            rekeningEdc={toko?.rekeningEdc ?? ''}
            memproses={checkout.isPending}
            nonaktif={!adaTransaksi || tr.t.baris.length === 0}
            ditinggal={ditinggal}
            onDitinggal={setDitinggal}
            bayarSaatTerima={bayarSaatTerima}
            onBayarSaatTerima={setBayarSaatTerima}
            labelBayar={pengantaran ? 'Buat invoice' : 'Bayar & cetak'}
            onBayar={bayar}
            onFokus={() => setZona('bayar')}
            onEsc={() => setZona('cari')}
          />
        </section>
      </div>
      <BilahTombol daftar={tombol} />

      <AlertDialog open={tanyaStruk !== null} onOpenChange={(buka) => !buka && setTanyaStruk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cetak struk?</AlertDialogTitle>
            <AlertDialogDescription>
              {tanyaStruk?.nomor} · {formatRupiah(tanyaStruk?.totalNeto ?? 0)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tidak (Esc)</AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={() => {
                if (tanyaStruk) cetakStruk(tanyaStruk, false);
                setTanyaStruk(null);
              }}
            >
              Cetak (Enter)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DialogKonfirmasi
        terbuka={limit !== null}
        onTutup={() => setLimit(null)}
        judul="Limit kredit terlampaui"
        pesan={
          <>
            <p>{limit?.pesan}</p>
            <p className="mt-2">
              Lanjutkan penjualan tidak lunas ini? Persetujuan Anda dicatat di log aktivitas.
            </p>
          </>
        }
        labelKonfirmasi="Setujui & lanjutkan"
        onKonfirmasi={async () => {
          if (limit) await kirimCheckout({ ...limit.data, setujuLimit: true });
        }}
      />
      {tampilDialogShift && (
        <DialogBukaShift
          onTutup={() => {
            setDialogShift(false);
            setShiftDitunda(true);
            setKunciPanel((k) => k + 1);
          }}
        />
      )}
      {toko && cetak?.jenis === 'struk' && (
        <AreaCetak ukuranKertas={`${toko.lebarStrukMm}mm auto`}>
          <Struk p={cetak.p} toko={toko} />
        </AreaCetak>
      )}
      {toko && cetak?.jenis === 'invoice' && (
        <AreaCetak ukuranKertas="A4">
          <InvoiceA4 p={cetak.p} toko={toko} />
        </AreaCetak>
      )}
      {toko && cetak?.jenis === 'sj' && (
        <AreaCetak ukuranKertas="A4">
          <SuratJalanA4 sj={cetak.sj} toko={toko} />
        </AreaCetak>
      )}
    </div>
  );
}
