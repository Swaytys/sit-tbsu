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
  type Pelanggan,
  type TiketAntrean,
} from '@sit/shared';
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react';
import { Printer, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { ambilData, api, GalatApi, pesanGalat } from '@/api/client';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { useTampilanToko } from '@/api/pengaturan';
import {
  catatCetakUlang,
  useBuatSuratJalan,
  useCheckout,
  useMintaKodeLimit,
  useLepasOrder,
  usePapanAntrean,
  usePratinjauOrder,
  useProsesOrder,
  useShiftSaya,
  useSiaranAntrean,
} from '@/api/penjualan';
import { AreaCetak } from '@/components/area-cetak';
import { InfoTierBelanja } from '@/components/info-tier-belanja';
import { DialogKodeAtasan } from '@/components/dialog-kode-atasan';
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
import { useDaftarRekening } from '@/api/rekening';
import { cetakLangsungAktif } from '@/lib/printer-thermal';
import { cetakStrukLangsung } from '@/lib/struk-escpos';
import { cn } from '@/lib/utils';
import { useCegahKeluar } from '@/lib/use-cegah-keluar';
import { DialogPelanggan } from '../pelanggan/dialog-pelanggan';
import { BilahTombol, type Tombol } from './bilah-tombol';
import { DialogBukaShift } from '../shift/dialog-buka-shift';
import { CariBarangPos, type PilihanBarang } from './cari-barang-pos';
import { DialogPilihanOrder, TautanOrderDisimpan } from '../order/pilihan-order';
import { PanelDetailBarang } from './panel-detail-barang';
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
  { kunci: 'F9', label: 'Mulai dari awal' },
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
    { kunci: 'P', label: 'Lepas promo' },
    { kunci: 'M', label: 'Menu baris' },
    { kunci: 'Del', label: 'Hapus' },
    { kunci: 'Ctrl+Z', label: 'Urungkan' },
  ],
  bayar: [
    { kunci: 'Angka', label: 'Uang/nominal' },
    { kunci: 'Enter', label: 'Bayar' },
    { kunci: 'T/B/E', label: 'Tunai/Transfer/EDC' },
    { kunci: 'C', label: 'Campuran' },
    { kunci: 'L/U/N', label: 'Lunas/DP/Bayar nanti (pelanggan)' },
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
  // K-111: rekening/EDC/QRIS toko untuk pembayaran non-tunai (dipilih, tidak diketik).
  const rekening = useDaftarRekening();
  const proses = useProsesOrder();
  const lepas = useLepasOrder();
  const checkout = useCheckout();
  const buatSj = useBuatSuratJalan();
  const tr = useTransaksiPos(tierDefault);

  const [zona, setZona] = useState<Zona>(pengantaran || idOrderAwal ? 'antrean' : 'cari');
  /** K-114: barang yang disorot di hasil cari; rinciannya menutupi area antrean. */
  const [sorotBarang, setSorotBarang] = useState<PilihanBarang | null>(null);
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
    setStrukTercetak(true);
    // K-103: langsung ke printer thermal komputer ini (tanpa jendela cetak) bila dinyalakan.
    if (toko && cetakLangsungAktif()) {
      void cetakStrukLangsung(p, toko, { cetakUlang: ulang }).catch((err: unknown) =>
        toast.error(
          `Struk tidak tercetak: ${err instanceof Error ? err.message : 'printer bermasalah.'}`,
          {
            duration: 10000,
            action: { label: 'Jendela cetak', onClick: () => setCetak({ jenis: 'struk', p }) },
          },
        ),
      );
      return;
    }
    setCetak({ jenis: 'struk', p });
  }
  const [cetak, setCetak] = useState<Cetakan>(null);
  const [kunciPanel, setKunciPanel] = useState(0);
  const [dialogShift, setDialogShift] = useState(false);
  const [slotBayar, setSlotBayar] = useState<HTMLDivElement | null>(null);
  const [sedangProses, setSedangProses] = useState(false);
  const [pelangganBaru, setPelangganBaru] = useState(false);
  /** K-106: F9 / tombol "Mulai dari awal" selalu bertanya dulu, supaya tidak terpencet tanpa sengaja. */
  const [tanyaUlang, setTanyaUlang] = useState(false);
  // PT6: checkout ditolak karena limit kredit; pemegang izin atur kredit boleh melanjutkan.
  const [limit, setLimit] = useState<{ data: DataCheckout; pesan: string } | null>(null);
  // K-102: pengguna tanpa izin itu meminta kode sekali pakai yang dikirim ke atasan.
  const [limitAtasan, setLimitAtasan] = useState<{
    data: DataCheckout;
    pesan: string;
    idPelanggan: number;
    tagihanBaru: number;
  } | null>(null);
  const mintaKodeLimit = useMintaKodeLimit();

  const order = tr.t.order;
  const adaTransaksi = order !== null || tr.t.baris.length > 0;
  // Keranjang jual langsung (atau perubahan isi order) hanya ada di layar ini: pindah halaman minta konfirmasi.
  const { dialog: dialogKeluar } = useCegahKeluar(
    tr.t.baris.length > 0 && (order === null || tr.t.diubah),
  );
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

  // Dibuka dari halaman Order (…?order=ID): langsung proses order itu. Order DISIMPAN (K-122) tidak ada di
  // papan antrean, jadi datanya diambil sendiri.
  const bukaOrderAwal = useEffectEvent(async (id: number) => {
    const t = tiket.find((x) => x.id === id);
    if (t) {
      await prosesTiket(t);
      return;
    }
    try {
      const d = await ambilData(await api.order[':id'].$get({ param: { id: String(id) } }));
      if (d.status === 'DISIMPAN') await prosesTiket({ ...d, alamatKirim: d.alamatKirim });
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  });
  const awalTerproses = useRef<number | null>(null);
  useEffect(() => {
    if (idOrderAwal && awalTerproses.current !== idOrderAwal && papan.isSuccess) {
      awalTerproses.current = idOrderAwal;
      void bukaOrderAwal(idOrderAwal);
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

  /** Layar kembali kosong setelah order dilepas, disimpan, atau dikembalikan ke draf (K-122). */
  function selesaiDenganOrder() {
    tr.kosongkan();
    mulaiBaru();
    setZona('antrean');
    if (idOrderAwal)
      void navigasi(pengantaran ? '/penjualan-pengantaran' : '/penjualan-langsung', {
        replace: true,
      });
  }

  async function keAntrean() {
    if (!order) return;
    await lepas.mutateAsync(order.id);
    toast(`Antrean ${order.noAntrean} dikembalikan ke antrean.`);
  }

  async function batal() {
    if (order) {
      try {
        await keAntrean();
      } catch (err) {
        toast.error(pesanGalat(err));
      }
      selesaiDenganOrder();
    } else if (tr.t.baris.length > 0) {
      tr.kosongkan(true);
      mulaiBaru();
      setZona('cari');
    }
  }

  function mintaMulaiDariAwal() {
    if (!adaTransaksi) {
      toast.info('Layar sudah kosong; belum ada yang perlu diulang.');
      return;
    }
    setTanyaUlang(true);
  }

  /** K-104: pengantaran tanpa order boleh, asal pelanggannya sudah dipilih (barang diantar ke siapa). */
  function butuhPelangganAntar(): boolean {
    if (!pengantaran || tr.t.pelanggan) return false;
    toast.error('Pilih pelanggan dulu (F4), atau pilih order dari antrean (F3).');
    setZona('pelanggan');
    return true;
  }

  function pilihPelanggan(p: Pelanggan | null) {
    if (pengantaran && !p) {
      toast.error('Pengantaran wajib pelanggan terdata.');
      return;
    }
    if (pengantaran && p && !p.noHp?.trim()) {
      toast.error(
        `${p.namaPelanggan} belum punya No. HP. Lengkapi di Data Pelanggan sebelum pengantaran.`,
      );
      return;
    }
    tr.aturPelanggan(p, pengantaran);
    setZona(tr.t.baris.length > 0 ? 'bayar' : 'cari');
  }

  function tambahBarang(b: BarisBarang, qty: string, idSatuanJual?: number | null) {
    if (butuhPelangganAntar()) return;
    setHasil(null);
    setIndeksBaris(tr.tambah(b, qty, idSatuanJual));
  }

  function bayar(pembayaran: DataPembayaran[]) {
    if (butuhPelangganAntar()) return;
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
        setLimitAtasan(null);
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
          const rinci = err.detail as { tagihanBaru?: unknown } | null;
          const idPelanggan = tr.t.pelanggan?.id;
          if (!bolehLanjut && idPelanggan && typeof rinci?.tagihanBaru === 'number') {
            // Kode untuk tagihan yang lebih kecil: dialog tetap terbuka dengan angka terbaru.
            if (data.kodeLimit) toast.error(pesan);
            setLimitAtasan({
              data: { ...data, kodeLimit: null },
              pesan,
              idPelanggan,
              tagihanBaru: rinci.tagihanBaru,
            });
            return;
          }
          toast.error(pesan);
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
      F9: () => mintaMulaiDariAwal(),
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
  // K-143: saat order antrean terbuka, F9 = tunda (kembalikan ke antrean) atau batalkan (pilihan A/S/D).
  const tombol = [
    ...TOMBOL_UMUM.map((t) =>
      t.kunci === 'F9' && order ? { ...t, label: 'Tunda / kembalikan order' } : t,
    ),
    ...TOMBOL_ZONA[zona],
  ];
  // K-130: dialog buka shift tidak muncul sendiri; pita kuning di atas memberi tahu dan menyediakan tombolnya.
  const tampilDialogShift = dialogShift;

  return (
    <div className="flex h-full min-h-[400px] flex-col gap-2">
      {tanpaShift && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
          <span className="min-w-0 flex-1">
            Shift toko belum dibuka: pembayaran tunai belum bisa diterima (non-tunai dan order tetap
            bisa).
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-amber-400 bg-white px-2.5 py-0.5 text-xs font-semibold shadow-sm hover:bg-amber-100"
            onClick={() => setDialogShift(true)}
          >
            Buka shift
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Kiri: papan antrean; saat memilih barang, rinciannya menutupi area ini (K-114). */}
        <section className="relative flex w-1/2 min-w-0 flex-col gap-1.5">
          {sorotBarang && (
            <PanelDetailBarang
              b={sorotBarang.b}
              o={sorotBarang.o}
              qty={sorotBarang.qty}
              onTutup={() => setSorotBarang(null)}
            />
          )}
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-700">
              Antrean {pengantaran ? 'pengantaran' : 'langsung'}{' '}
              <kbd className="font-mono text-xs text-slate-400">F3</kbd>
            </span>
            <span className="text-xs text-slate-500">
              {tiket.length} order · urut yang paling lama menunggu <TautanOrderDisimpan />
            </span>
          </div>
          <PapanAntrean
            id={ID.antrean}
            tiket={tiket}
            indeks={indeksAman}
            onIndeks={setIndeksTiket}
            onProses={(t) => void prosesTiket(t)}
            onKeluar={() => setZona(pengantaran && order ? 'bayar' : 'cari')}
            onFokus={() => setZona('antrean')}
            aktif={zona === 'antrean'}
            idTransaksi={order?.id ?? null}
            idSaya={saya.id}
            kolom={2}
            pengantaran={pengantaran}
          />
        </section>

        {/* Kanan: transaksi aktif */}
        <div className="flex min-h-0 w-1/2 min-w-0 flex-col gap-2">
          <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            <div className="rounded-md border bg-white px-3 py-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {order ? (
                    <>
                      Antrean <span className="text-lg font-black">{order.noAntrean}</span>{' '}
                      <span className="font-mono text-xs text-slate-500">{order.nomor}</span>
                    </>
                  ) : pengantaran ? (
                    'Pengantaran baru tanpa order'
                  ) : (
                    'Jual langsung tanpa order'
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {order?.diskonTransaksi ? (
                    <span className="text-xs text-slate-500">
                      diskon {formatRupiah(order.diskonTransaksi)}
                    </span>
                  ) : null}
                  {adaTransaksi && (
                    <button
                      type="button"
                      onClick={mintaMulaiDariAwal}
                      title={
                        order
                          ? 'Order antrean: kembalikan ke antrean, simpan, atau batalkan (F9). Akan ditanya dulu.'
                          : 'Kosongkan layar ini dan mulai dari awal (F9). Akan ditanya dulu.'
                      }
                      className="flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <RotateCcw className="size-3" />{' '}
                      {order ? 'Tunda / kembalikan order' : 'Mulai dari awal'}
                      <kbd className="font-mono opacity-60">F9</kbd>
                    </button>
                  )}
                </span>
              </div>
              {zona === 'pelanggan' ? (
                <div className="mt-1" id={ID.pelanggan}>
                  <CariPelangganPos
                    id="pos-cari-pelanggan"
                    wajib={pengantaran}
                    onPilih={pilihPelanggan}
                    onTambahBaru={() => setPelangganBaru(true)}
                    onEsc={() => setZona(tr.t.baris.length > 0 ? 'bayar' : 'cari')}
                  />
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setZona('pelanggan')}
                    title="Pilih atau ganti pelanggan (F4)"
                    className={cn(
                      'rounded border border-dashed px-2 py-0.5 text-left hover:border-blue-500 hover:bg-blue-50',
                      pengantaran && !tr.t.pelanggan
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-300',
                    )}
                  >
                    <span className="text-slate-500">
                      Pelanggan <kbd className="font-mono text-xs">F4</kbd>:
                    </span>{' '}
                    <span className="font-medium">
                      {tr.t.pelanggan?.nama ??
                        (pengantaran ? 'klik untuk memilih pelanggan' : 'Pembeli umum')}
                    </span>
                  </button>
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
              {pengantaran && (order !== null || tr.t.pelanggan !== null) && (
                <div className="mt-1.5 grid grid-cols-6 gap-1.5 text-xs">
                  <input
                    value={tr.t.kirim.alamat}
                    onChange={(e) => tr.aturKirim({ alamat: e.target.value })}
                    maxLength={255}
                    placeholder="Alamat kirim (wajib)"
                    aria-label="Alamat kirim"
                    className={cn(
                      'col-span-3 h-7 rounded border px-2',
                      !tr.t.kirim.alamat.trim() && 'border-amber-400 bg-amber-50',
                    )}
                  />
                  <input
                    value={tampilRibuan(tr.t.kirim.ongkir ? String(tr.t.kirim.ongkir) : '')}
                    onChange={(e) =>
                      tr.aturKirim({ ongkir: Number(digitSaja(e.target.value) || '0') })
                    }
                    inputMode="numeric"
                    placeholder="Ongkir"
                    aria-label="Ongkos kirim"
                    className="h-7 rounded border px-2 text-right"
                  />
                  <input
                    value={tr.t.kirim.catatan}
                    onChange={(e) => tr.aturKirim({ catatan: e.target.value })}
                    maxLength={255}
                    placeholder="Catatan kirim"
                    aria-label="Catatan kirim"
                    className="col-span-2 h-7 rounded border px-2"
                  />
                </div>
              )}
              {order?.catatan && (
                <div
                  className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900"
                  data-testid="catatan-order"
                >
                  <b>Catatan order:</b> {order.catatan}
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
              onSorot={setSorotBarang}
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
                  invoice ·{' '}
                  <kbd className="rounded bg-slate-800 px-1.5 font-mono text-white">S</kbd> buat
                  surat jalan semua barang &amp; cetak ·{' '}
                  <kbd className="rounded bg-slate-800 px-1.5 font-mono text-white">Enter</kbd>{' '}
                  lanjut
                </div>
              </div>
            )}

            <InfoTierBelanja
              info={pratinjau.data?.tierBelanja}
              idTierDasar={tierDefault}
              namaTier={(id) => tierAktif.find((t) => t.id === id)?.nama ?? 'tier lain'}
            />
            <div className="flex items-baseline justify-between rounded-md bg-slate-900 px-3 py-2 text-white">
              <span className="text-xs tracking-widest text-slate-300 uppercase">
                Total
                {tr.t.baris.length > 0 && !pratinjau.segar ? ' (menghitung…)' : ''}
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

            <PanelBayarPos
              key={kunciPanel}
              id={ID.bayar}
              aktif={zona === 'bayar'}
              total={adaTransaksi ? totalTampil : 0}
              mode={pengantaran ? 'pengantaran' : 'langsung'}
              bolehKurang={pengantaran || tr.t.pelanggan !== null}
              rekening={rekening.data ?? []}
              memproses={checkout.isPending}
              nonaktif={!adaTransaksi || tr.t.baris.length === 0}
              ditinggal={ditinggal}
              onDitinggal={setDitinggal}
              onBayarSaatTerima={setBayarSaatTerima}
              jatuhTempo={jatuhTempo}
              onJatuhTempo={setJatuhTempo}
              labelBayar={pengantaran ? 'Buat invoice' : 'Bayar & cetak'}
              onBayar={bayar}
              onFokus={() => setZona('bayar')}
              onEsc={() => setZona('cari')}
              slotTombol={slotBayar}
            />
          </section>
          {/* Tombol bayar di luar area gulir: selalu terlihat dan tidak menutupi isian di atasnya. */}
          <div ref={setSlotBayar} className="shrink-0" />
        </div>
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
      {limitAtasan && (
        <DialogKodeAtasan
          judul="Limit kredit terlampaui"
          ringkasan={
            <>
              <p>{limitAtasan.pesan}</p>
              <p className="mt-1 text-slate-500">
                Minta kode ke atasan, atau batalkan lalu terima pembayaran lebih dulu.
              </p>
            </>
          }
          mintaKode={() =>
            mintaKodeLimit.mutateAsync({
              idPelanggan: limitAtasan.idPelanggan,
              tagihanBaru: limitAtasan.tagihanBaru,
            })
          }
          kunci={`limit:${limitAtasan.idPelanggan}:${limitAtasan.tagihanBaru}`}
          memproses={checkout.isPending}
          onTutup={() => setLimitAtasan(null)}
          onSetujui={(kodeLimit) => void kirimCheckout({ ...limitAtasan.data, kodeLimit })}
        />
      )}
      {pelangganBaru && (
        <DialogPelanggan
          pelanggan={null}
          onTutup={() => setPelangganBaru(false)}
          onTersimpan={pilihPelanggan}
        />
      )}
      {tampilDialogShift && (
        <DialogBukaShift
          onTutup={() => {
            setDialogShift(false);
            setKunciPanel((k) => k + 1);
          }}
        />
      )}
      {dialogKeluar}
      {order && tanyaUlang && (
        <DialogPilihanOrder
          order={order}
          onKeAntrean={keAntrean}
          onSelesai={() => {
            setTanyaUlang(false);
            selesaiDenganOrder();
          }}
          onTutup={() => setTanyaUlang(false)}
        />
      )}
      <DialogKonfirmasi
        terbuka={tanyaUlang && !order}
        onTutup={() => setTanyaUlang(false)}
        judul="Mulai dari awal?"
        pesan={
          order ? null : (
            <>
              <p>
                Daftar barang, pelanggan{pengantaran ? ', alamat kirim,' : ''} dan isian pembayaran
                di layar ini dikosongkan, seperti layar yang baru dibuka.
              </p>
              <p className="mt-1">
                Belum ada yang tersimpan, jadi tidak ada penjualan yang terhapus. Bila berubah
                pikiran, tekan Ctrl+Z untuk mengembalikan daftar barangnya.
              </p>
            </>
          )
        }
        labelKonfirmasi="Ya, mulai dari awal"
        bahaya
        onKonfirmasi={batal}
      />
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
