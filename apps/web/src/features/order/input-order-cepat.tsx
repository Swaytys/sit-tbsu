import {
  bandingQty,
  kaliQty,
  kunciBaris,
  kurangQty,
  formatRupiah,
  skemaOrder,
  tambahQty,
  type BarisBarang,
  type DetailOrder,
  type InputOrder,
  type JenisPenjualan,
  type Pelanggan,
  type StatusOrder,
} from '@sit/shared';
import { CalendarClock, RotateCcw } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { ambilData, ambilIsi, api, pesanGalat } from '@/api/client';
import { useDaftarTingkatHarga } from '@/api/mitra';
import {
  useBatalOrder,
  useDaftarOrder,
  useKirimOrder,
  usePratinjauOrder,
  useSimpanOrder,
  useSiaranAntrean,
} from '@/api/penjualan';
import { DialogKonfirmasi } from '@/components/dialog-konfirmasi';
import { PeringatanPiutang } from '@/components/peringatan-piutang';
import { formatDesimal, formatTanggal } from '@/lib/format';
import { InfoTierBelanja } from '@/components/info-tier-belanja';
import { cn } from '@/lib/utils';
import { DialogPelanggan } from '../pelanggan/dialog-pelanggan';
import { BilahTombol, type Tombol } from '../pos/bilah-tombol';
import { CariBarangPos, type PilihanBarang } from '../pos/cari-barang-pos';
import { CariPelangganPos } from '../pos/cari-pelanggan-pos';
import { KeranjangPos } from '../pos/keranjang-pos';
import {
  digitSaja,
  keBarisOrder,
  opsiDariBarang,
  qtyDasarBaris,
  rapikanQty,
  satuanAwal,
  tampilRibuan,
} from '../pos/model';
import { PanelDetailBarang } from '../pos/panel-detail-barang';
import { useTransaksiPos } from '../pos/use-transaksi-pos';
import { DialogSimpanOrder } from './dialog-simpan-order';
import { useCekDrafLain } from './peringatan-draf-lain';

type Zona = 'cari' | 'keranjang' | 'pelanggan' | 'kirim';

const ID: Record<Zona, string> = {
  cari: 'order-cari',
  keranjang: 'order-keranjang',
  pelanggan: 'order-pelanggan',
  kirim: 'order-kirim',
};

const LABEL_STATUS: Record<StatusOrder, string> = {
  DRAFT: 'Draf',
  MENUNGGU: 'Menunggu kasir',
  DIPROSES: 'Di kasir',
  DISIMPAN: 'Disimpan',
  SELESAI: 'Selesai',
  BATAL: 'Batal',
};

/** K-122 butir 3: preferensi tampilan per peramban (bukan data bisnis). */
const KUNCI_BUKA_DRAF = 'order.bukaDrafOtomatis';

function bacaBukaDrafOtomatis(): boolean {
  try {
    return localStorage.getItem(KUNCI_BUKA_DRAF) !== 'false';
  } catch {
    return true;
  }
}

function tulisBukaDrafOtomatis(nyala: boolean) {
  try {
    localStorage.setItem(KUNCI_BUKA_DRAF, nyala ? 'true' : 'false');
  } catch {
    // Penyimpanan peramban tidak tersedia: preferensi hanya berlaku sampai halaman ditutup.
  }
}

const TOMBOL: Record<Zona, Tombol[]> = {
  cari: [
    { kunci: 'Enter', label: 'Tambah barang' },
    { kunci: '3*nama', label: 'Qty 3' },
    { kunci: 'Enter (kosong)', label: 'Siap kirim' },
    { kunci: '↓', label: 'Ke daftar' },
  ],
  keranjang: [
    { kunci: '+ −', label: 'Qty ±1' },
    { kunci: 'Angka', label: 'Ubah qty' },
    { kunci: 'S', label: 'Ganti satuan' },
    { kunci: 'M', label: 'Menu baris' },
    { kunci: 'Del', label: 'Hapus' },
    { kunci: 'Ctrl+Z', label: 'Urungkan' },
  ],
  pelanggan: [
    { kunci: 'Enter', label: 'Pilih (kosong = umum)' },
    { kunci: 'Esc', label: 'Batal' },
  ],
  kirim: [
    { kunci: 'Enter', label: 'Kirim ke antrean' },
    { kunci: 'Esc', label: 'Kembali' },
  ],
};

const TERANG_STATUS: Partial<Record<StatusOrder, string>> = {
  SELESAI: 'bg-emerald-100 text-emerald-700',
  BATAL: 'bg-red-50 text-red-600',
  DIPROSES: 'bg-blue-100 text-blue-700',
  DISIMPAN: 'bg-violet-100 text-violet-700',
};

/**
 * Daftar order milik sendiri (hari ini), diperbarui otomatis lewat siaran antrean. Draf bisa diklik untuk
 * dilanjutkan.
 */
function OrderSaya({
  onLanjutDraf,
  bukaDrafOtomatis,
  onBukaDrafOtomatis,
}: {
  onLanjutDraf: (id: number) => void;
  bukaDrafOtomatis: boolean;
  onBukaDrafOtomatis: (nyala: boolean) => void;
}) {
  const daftar = useDaftarOrder({
    cari: '',
    status: null,
    jenis: null,
    milikSaya: true,
    halaman: 1,
    perHalaman: 15,
  });
  const data = daftar.data?.data ?? [];
  return (
    <section className="flex h-full flex-col gap-1.5" aria-label="Order saya">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Order saya</h2>
        <label
          className="flex items-center gap-1 text-xs text-slate-600"
          title="Nyala: draf terakhir Anda dibuka lagi saat halaman ini dibuka. Mati: form selalu kosong; draf dibuka dengan mengkliknya di daftar ini."
        >
          <input
            type="checkbox"
            checked={bukaDrafOtomatis}
            onChange={(e) => onBukaDrafOtomatis(e.target.checked)}
          />
          Buka draf otomatis
        </label>
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {data.length === 0 && <li className="text-sm text-slate-400">Belum ada order.</li>}
        {data.map((o) => (
          <li
            key={o.id}
            className={cn(
              'rounded-md border bg-white p-2 text-sm',
              o.status === 'DRAFT' && 'cursor-pointer border-amber-300 hover:bg-amber-50',
            )}
            title={o.status === 'DRAFT' ? 'Klik untuk melanjutkan draf ini' : undefined}
            onClick={o.status === 'DRAFT' ? () => onLanjutDraf(o.id) : undefined}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg leading-none font-black tabular-nums">{o.noAntrean}</span>
              <span
                className={cn(
                  'rounded px-1.5 text-xs font-semibold',
                  TERANG_STATUS[o.status] ?? 'bg-amber-100 text-amber-700',
                )}
              >
                {LABEL_STATUS[o.status]}
                {o.status === 'DISIMPAN' && ` · ambil ${formatTanggal(o.tanggalAmbil).slice(0, 5)}`}
              </span>
            </div>
            <div className="truncate text-xs text-slate-600">
              {o.ringkasan.map((r) => `${r.namaBarang} ${formatDesimal(r.qty)}`).join(' · ')}
            </div>
            <div className="text-right text-xs font-semibold tabular-nums">
              {formatRupiah(o.total)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Input order cepat (K-073): untuk Staf di lantai toko. Tanpa isian wajib selain barang & qty; seluruhnya
 * dengan keyboard. Setelah dikirim, nomor antrean tampil besar untuk disebutkan ke pembeli, lalu form langsung
 * kosong untuk pembeli berikutnya.
 */
export function InputOrderCepat() {
  const saya = usePengguna();
  useSiaranAntrean();
  const tierAktif = (useDaftarTingkatHarga().data ?? []).filter((t) => t.statusAktif === 'AKTIF');
  const tierDefault = tierAktif.find((t) => t.isDefault)?.id ?? null;
  const simpan = useSimpanOrder();
  const kirimOrder = useKirimOrder();
  const batalOrder = useBatalOrder();
  const tr = useTransaksiPos(tierDefault);
  /** Draf yang sedang diisi (disimpan otomatis saat halaman ditinggalkan, K-095). */
  const idDraf = tr.t.order?.status === 'DRAFT' ? tr.t.order.id : null;
  /** Order di antrean/disimpan yang sedang diubah (dibuka lewat tombol Ubah di Daftar order). */
  const ubahOrder = tr.t.order && tr.t.order.status !== 'DRAFT' ? tr.t.order : null;
  const [url, setUrl] = useSearchParams();
  const [zona, setZona] = useState<Zona>('cari');
  const [indeksBaris, setIndeksBaris] = useState(0);
  const [jenis, setJenis] = useState<JenisPenjualan>('LANGSUNG');
  const [alamat, setAlamat] = useState('');
  const [ongkir, setOngkir] = useState('');
  const [catatanKirim, setCatatanKirim] = useState('');
  /** Catatan pembuat order untuk kasir (tampil di tiket antrean dan layar kasir, K-099). */
  const [catatan, setCatatan] = useState('');
  const [terakhir, setTerakhir] = useState<{ no: number; isi: string } | null>(null);
  const [pelangganBaru, setPelangganBaru] = useState(false);
  const [tanyaUlang, setTanyaUlang] = useState(false);
  const [dialogSimpan, setDialogSimpan] = useState(false);
  const [sorotBarang, setSorotBarang] = useState<PilihanBarang | null>(null);
  const [bukaDrafOtomatis, setBukaDrafOtomatis] = useState(bacaBukaDrafOtomatis);
  /** No. HP pelanggan terpilih, untuk mengisi awal dialog simpan (K-122). */
  const [hpPelanggan, setHpPelanggan] = useState<string | null>(null);
  const cekDraf = useCekDrafLain(ID.cari);
  /** Fungsi dengan isian terbaru, untuk pilihan yang datang setelah pemeriksaan draf selesai. */
  const aksiKini = useRef<{
    kurangi: (idBarang: number, idSatuanJual: number | null, qty: string) => void;
    bukaDrafLain: (id: number) => Promise<void>;
  } | null>(null);
  const antar = jenis === 'PENGANTARAN';

  useEffect(() => {
    if (zona !== 'pelanggan') document.getElementById(ID[zona])?.focus();
  }, [zona]);

  /**
   * K-122 butir 4: barang langsung ditambahkan; draf lain yang memuat barang yang sama diperiksa di belakang.
   * Pilihan pengguna dijalankan dengan isian terbaru (lewat `aksiKini`), bukan isian saat barang ditambahkan.
   */
  function tambah(b: BarisBarang, qty: string, idSatuanJual?: number | null) {
    const satuan = idSatuanJual !== undefined ? idSatuanJual : satuanAwal(b);
    const faktor = opsiDariBarang(b).find((o) => o.idSatuanJual === satuan)?.faktor ?? '1';
    const sudah = tr.t.baris
      .filter((x) => x.idBarang === b.id)
      .reduce((n, x) => tambahQty(n, qtyDasarBaris(x) ?? '0'), '0');
    setIndeksBaris(tr.tambah(b, qty, idSatuanJual));
    void cekDraf.periksa(b, tambahQty(sudah, kaliQty(qty, faktor)), idDraf).then((h) => {
      if (h.aksi === 'HAPUS') aksiKini.current?.kurangi(b.id, satuan, qty);
      else if (h.aksi === 'BUKA') void aksiKini.current?.bukaDrafLain(h.id);
    });
  }

  /** Membatalkan penambahan `qty` barang pada baris satuannya (pilihan "Hapus lagi"). */
  function kurangi(idBarang: number, idSatuanJual: number | null, qty: string) {
    const i = tr.t.baris.findIndex(
      (x) => x.idBarang === idBarang && x.idSatuanJual === idSatuanJual,
    );
    const baris = tr.t.baris[i];
    if (!baris) return;
    const sisa = kurangQty(baris.qty, qty);
    if (bandingQty(sisa, '0') <= 0) {
      tr.hapus(i);
      setIndeksBaris(Math.max(0, i - 1));
    } else {
      tr.ubah(i, { qty: rapikanQty(sisa) });
    }
  }

  function pilihPelanggan(p: Pelanggan | null) {
    tr.aturPelanggan(p);
    setHpPelanggan(p?.noHp ?? null);
    if (p?.alamat && !alamat) setAlamat(p.alamat);
    setZona('cari');
  }

  function isianOrder(): InputOrder {
    return {
      jenisPenjualan: jenis,
      idPelanggan: tr.t.pelanggan?.id ?? null,
      namaPembeli: tr.t.pelanggan ? null : tr.t.namaPembeli.trim() || null,
      alamatKirim: antar ? alamat : null,
      catatanKirim: antar ? catatanKirim : null,
      catatan: catatan.trim() || null,
      ongkir: antar ? Number(ongkir || '0') : 0,
      baris: tr.t.baris.map(keBarisOrder),
    };
  }

  function muatDraf(d: DetailOrder) {
    tr.muatOrder(d);
    setJenis(d.jenisPenjualan);
    setAlamat(d.alamatKirim ?? '');
    setOngkir(d.ongkir ? String(d.ongkir) : '');
    setCatatanKirim(d.catatanKirim ?? '');
    setCatatan(d.catatan ?? '');
    setIndeksBaris(0);
    setZona('cari');
  }

  async function lanjutDraf(id: number, diam = false) {
    if (id === idDraf) return;
    if (tr.t.baris.length > 0) {
      if (!diam) toast.info('Kirim order yang sedang diisi, atau mulai dari awal (F9), dulu.');
      return;
    }
    const d = await ambilData(await api.order[':id'].$get({ param: { id: String(id) } }));
    if (d.status !== 'DRAFT') return;
    muatDraf(d);
    toast.info(`Draf order ${d.nomor} dilanjutkan.`);
  }

  /** Isian sekarang disimpan sebagai draf (bila ada), lalu draf lain milik sendiri dibuka (K-122 butir 4). */
  async function bukaDrafLain(id: number) {
    try {
      if (tr.t.baris.length > 0 && (idDraf === null || tr.t.diubah)) {
        const data = skemaOrder.safeParse(isianOrder());
        if (data.success) {
          const o = await simpan.mutateAsync(
            idDraf === null
              ? { json: data.data, kirim: false }
              : { id: idDraf, json: data.data, kirim: false },
          );
          toast.info(`Isian sebelumnya disimpan sebagai draf ${o.nomor}.`);
        }
      }
      const d = await ambilData(await api.order[':id'].$get({ param: { id: String(id) } }));
      if (d.status !== 'DRAFT') {
        toast.error(`Order ${d.nomor} sudah bukan draf.`);
        return;
      }
      tr.kosongkan(false);
      muatDraf(d);
      toast.info(`Draf order ${d.nomor} dibuka. Lanjutkan transaksi pembeli itu.`);
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  useEffect(() => {
    aksiKini.current = { kurangi, bukaDrafLain };
  });

  // K-095: draf terakhir milik sendiri dibuka lagi saat halaman dibuka, agar isian tidak hilang
  // (K-122 butir 3: bisa dimatikan lewat "Buka draf otomatis").
  const bukaDrafTerakhir = useEffectEvent(async () => {
    // Dibuka dari tombol Ubah di Daftar order (…?ubah=ID): order itu yang dimuat, bukan draf terakhir.
    const idUbah = Number(url.get('ubah')) || null;
    if (idUbah !== null) {
      setUrl({}, { replace: true });
      const d = await ambilData(await api.order[':id'].$get({ param: { id: String(idUbah) } }));
      if (d.status === 'DRAFT') {
        muatDraf(d);
        toast.info(`Draf order ${d.nomor} dibuka.`);
      } else if (d.status === 'MENUNGGU' || d.status === 'DISIMPAN') {
        muatDraf(d);
        toast.info(`Mengubah order ${d.nomor}. Simpan perubahan dengan F8.`);
      } else {
        toast.error(`Order ${d.nomor} sudah tidak bisa diubah di sini.`);
      }
      return;
    }
    if (!bacaBukaDrafOtomatis()) return;
    const r = await ambilIsi(
      await api.order.$get({
        query: { status: 'DRAFT', milikSaya: 'true', halaman: '1', perHalaman: '1' },
      }),
    );
    const d = r.data[0];
    if (d) await lanjutDraf(d.id, true);
  });

  /**
   * K-095: isian yang belum dikirim disimpan sebagai draf (tidak menahan stok) saat halaman ditinggalkan:
   * pindah menu, muat ulang, atau tab ditutup (`keepalive` agar permintaan tetap terkirim).
   */
  const simpanDraf = useEffectEvent(() => {
    // Order antrean/disimpan yang sedang diubah tidak disimpan diam-diam; perubahan harus disimpan dengan F8.
    if (ubahOrder || !tr.t.diubah || tr.t.baris.length === 0) return;
    const data = skemaOrder.safeParse(isianOrder());
    if (!data.success) return;
    void fetch(idDraf === null ? '/api/order?kirim=false' : `/api/order/${idDraf}`, {
      method: idDraf === null ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data.data),
      credentials: 'same-origin',
      keepalive: true,
    })
      .then((r) => {
        if (r.ok) toast.info('Order yang belum dikirim disimpan sebagai draf (Order Penjualan).');
      })
      .catch(() => undefined);
  });

  useEffect(() => {
    // Dimuat setelah tampilan pertama; isian draf diterapkan saat jawaban API tiba.
    const t = setTimeout(() => void bukaDrafTerakhir().catch(() => undefined), 0);
    const keluar = () => simpanDraf();
    window.addEventListener('pagehide', keluar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', keluar);
      simpanDraf();
    };
  }, []);

  // PR5: harga, promo, dan total dari API; angka lokal hanya cadangan selama menunggu.
  const pratinjau = usePratinjauOrder(
    tr.t.baris.length > 0
      ? { idOrder: idDraf ?? ubahOrder?.id ?? null, order: isianOrder() }
      : null,
  );
  const pratinjauBaris = new Map(
    (pratinjau.data?.baris ?? []).map((b) => [kunciBaris(b.idBarang, b.idSatuanJual), b]),
  );
  const total =
    pratinjau.segar && pratinjau.data
      ? pratinjau.data.total
      : tr.total + (antar ? Number(ongkir || '0') : 0);

  function kirim() {
    if (simpan.isPending) return;
    const data = skemaOrder.safeParse(isianOrder());
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      setZona(data.error.issues[0]?.path[0] === 'idPelanggan' ? 'pelanggan' : 'cari');
      return;
    }
    if (ubahOrder) {
      simpan
        .mutateAsync({ id: ubahOrder.id, json: data.data, kirim: false })
        .then((o) => {
          toast.success(`Perubahan order ${o.nomor} disimpan.`);
          bersihkanForm();
        })
        .catch((err: unknown) => toast.error(pesanGalat(err)));
      return;
    }
    const kirimDraf = idDraf;
    (kirimDraf === null
      ? simpan.mutateAsync({ json: data.data, kirim: true })
      : simpan
          .mutateAsync({ id: kirimDraf, json: data.data, kirim: false })
          .then(() => kirimOrder.mutateAsync(kirimDraf))
    )
      .then((o) => {
        setTerakhir({
          no: o.noAntrean,
          isi: o.ringkasan.map((r) => `${r.namaBarang} ${formatDesimal(r.qty)}`).join(', '),
        });
        toast.success(`Antrean ${o.noAntrean} masuk ke kasir.`);
        tr.kosongkan();
        setAlamat('');
        setOngkir('');
        setCatatanKirim('');
        setCatatan('');
        setIndeksBaris(0);
        setZona('cari');
        document.getElementById(ID.cari)?.focus();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  const adaIsian =
    tr.t.baris.length > 0 ||
    tr.t.pelanggan !== null ||
    tr.t.namaPembeli.trim() !== '' ||
    alamat !== '' ||
    ongkir !== '' ||
    catatanKirim !== '' ||
    catatan !== '';

  /** K-106: F9 / tombol "Mulai dari awal" selalu bertanya dulu, supaya tidak terpencet tanpa sengaja. */
  function mintaMulaiDariAwal() {
    if (!adaIsian) {
      toast.info('Form sudah kosong; belum ada yang perlu diulang.');
      return;
    }
    setTanyaUlang(true);
  }

  /** Form kosong lagi tanpa menyentuh order apa pun. */
  function bersihkanForm() {
    tr.kosongkan(false);
    setJenis('LANGSUNG');
    setAlamat('');
    setOngkir('');
    setCatatanKirim('');
    setCatatan('');
    setIndeksBaris(0);
    setZona('cari');
    document.getElementById(ID.cari)?.focus();
  }

  /**
   * Mengosongkan seluruh isian order di layar ini; draf yang sedang diisi dibuang (dibatalkan). Order antrean/
   * disimpan yang sedang diubah TIDAK dibatalkan: perubahannya saja yang dibuang.
   */
  async function mulaiDariAwal() {
    if (ubahOrder) {
      bersihkanForm();
      toast.info(`Perubahan dibuang; order ${ubahOrder.nomor} tetap seperti semula.`);
      return;
    }
    if (idDraf !== null) {
      // Draf yang dikosongkan dibatalkan agar tidak dibuka lagi.
      try {
        await batalOrder.mutateAsync({ id: idDraf, alasan: 'Draf dikosongkan sebelum dikirim' });
        toast.info('Draf dibuang.');
      } catch (err) {
        toast.error(pesanGalat(err));
        throw err;
      }
      tr.kosongkan(false);
    } else {
      tr.kosongkan(true);
    }
    setJenis('LANGSUNG');
    setAlamat('');
    setOngkir('');
    setCatatanKirim('');
    setCatatan('');
    setIndeksBaris(0);
    setZona('cari');
  }

  /** K-122: simpan untuk diambil nanti. Isian disimpan dulu sebagai draf, lalu draf itu disimpan (tahan stok). */
  function mintaSimpanNanti() {
    if (ubahOrder?.status === 'DISIMPAN') {
      toast.info('Order ini sudah disimpan untuk nanti. Simpan perubahannya dengan F8.');
      return;
    }
    if (tr.t.baris.length === 0) {
      toast.info('Tambahkan barang dulu.');
      return;
    }
    const data = skemaOrder.safeParse(isianOrder());
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      setZona(data.error.issues[0]?.path[0] === 'idPelanggan' ? 'pelanggan' : 'cari');
      return;
    }
    setDialogSimpan(true);
  }

  async function siapkanDraf(): Promise<number> {
    const data = skemaOrder.parse(isianOrder());
    if (ubahOrder) {
      if (tr.t.diubah) await simpan.mutateAsync({ id: ubahOrder.id, json: data, kirim: false });
      return ubahOrder.id;
    }
    if (idDraf !== null && !tr.t.diubah) return idDraf;
    const o = await simpan.mutateAsync(
      idDraf === null ? { json: data, kirim: false } : { id: idDraf, json: data, kirim: false },
    );
    return o.id;
  }

  /** Isian sekarang disimpan sebagai draf (tidak menahan stok), lalu form kosong untuk pembeli berikutnya. */
  function orderBaru() {
    if (simpan.isPending || tr.t.baris.length === 0) return;
    const selesai = (pesan: string) => {
      toast.success(pesan);
      tr.kosongkan();
      setAlamat('');
      setOngkir('');
      setCatatanKirim('');
      setCatatan('');
      setIndeksBaris(0);
      setZona('cari');
      document.getElementById(ID.cari)?.focus();
    };
    // Draf yang dibuka dan belum diubah tidak perlu disimpan lagi.
    if (idDraf !== null && !tr.t.diubah) {
      selesai(`Draf ${tr.t.order?.nomor ?? ''} tetap tersimpan di "Order saya".`);
      return;
    }
    const data = skemaOrder.safeParse(isianOrder());
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      setZona(data.error.issues[0]?.path[0] === 'idPelanggan' ? 'pelanggan' : 'cari');
      return;
    }
    simpan
      .mutateAsync(
        idDraf === null
          ? { json: data.data, kirim: false }
          : { id: idDraf, json: data.data, kirim: false },
      )
      .then((o) => selesai(`Draf ${o.nomor} disimpan di "Order saya". Silakan buat order baru.`))
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  const tombolGlobal = useEffectEvent((e: globalThis.KeyboardEvent) => {
    if (e.key === 'F2') {
      e.preventDefault();
      setZona('cari');
    } else if (e.key === 'F4') {
      e.preventDefault();
      setZona('pelanggan');
    } else if (e.key === 'F3') {
      e.preventDefault();
      setJenis((j) => (j === 'LANGSUNG' ? 'PENGANTARAN' : 'LANGSUNG'));
    } else if (e.key === 'F8' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      kirim();
    } else if (e.key === 'F9') {
      e.preventDefault();
      mintaMulaiDariAwal();
    } else if (e.key === 'F7') {
      e.preventDefault();
      mintaSimpanNanti();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && tr.adaCadangan) {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.value) return;
      e.preventDefault();
      tr.urungkan();
    }
  });
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => tombolGlobal(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const tombol: Tombol[] = [
    { kunci: 'F2', label: 'Cari barang' },
    { kunci: 'F1', label: 'Qty (*)' },
    { kunci: 'F4', label: 'Pelanggan' },
    { kunci: 'F3', label: antar ? 'Ubah ke langsung' : 'Ubah ke pengantaran' },
    { kunci: 'F8', label: ubahOrder ? 'Simpan perubahan' : 'Kirim ke antrean' },
    { kunci: 'F7', label: 'Simpan untuk nanti' },
    { kunci: 'F9', label: ubahOrder ? 'Buang perubahan' : 'Mulai dari awal' },
    { kunci: 'F10', label: 'Daftar order' },
    ...TOMBOL[zona],
  ];

  return (
    <div className="flex h-full min-h-[400px] flex-col gap-2">
      <div className="flex min-h-0 flex-1 gap-3">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {ubahOrder && (
            <div
              className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900"
              data-testid="mode-ubah"
            >
              <span className="font-semibold whitespace-nowrap">Mengubah {ubahOrder.nomor}</span>
              <span className="truncate text-amber-800">F8 simpan · F9 buang perubahan</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
            <span
              className={cn(
                'rounded px-2 py-0.5 text-xs font-bold',
                antar ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700',
              )}
              data-testid="jenis-order"
            >
              <kbd className="mr-1 font-mono opacity-60">F3</kbd>
              {antar ? 'PENGANTARAN' : 'LANGSUNG'}
            </span>
            {zona === 'pelanggan' ? (
              <div className="min-w-64 flex-1" id={ID.pelanggan}>
                <CariPelangganPos
                  id="order-cari-pelanggan"
                  wajib={antar}
                  onPilih={pilihPelanggan}
                  onTambahBaru={() => setPelangganBaru(true)}
                  onEsc={() => setZona('cari')}
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setZona('pelanggan')}
                  title="Pilih atau ganti pelanggan (F4)"
                  className="rounded border border-dashed border-slate-300 px-2 py-0.5 text-left hover:border-blue-500 hover:bg-blue-50"
                >
                  <span className="text-slate-500">
                    <kbd className="font-mono text-xs">F4</kbd> Pelanggan:
                  </span>{' '}
                  <span className="font-medium">
                    {tr.t.pelanggan?.nama ?? (antar ? 'pilih pelanggan' : 'Pembeli umum')}
                  </span>
                </button>
                {!tr.t.pelanggan && !antar && (
                  <input
                    value={tr.t.namaPembeli}
                    onChange={(e) => tr.aturNamaPembeli(e.target.value)}
                    maxLength={100}
                    placeholder="ciri/nama pembeli (opsional)"
                    aria-label="Nama pembeli"
                    className="h-7 min-w-0 flex-1 rounded border px-2 text-xs"
                  />
                )}
              </>
            )}
            {antar && (
              <div className="grid w-full grid-cols-6 gap-2">
                <input
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  maxLength={255}
                  placeholder="Alamat kirim (wajib)"
                  aria-label="Alamat kirim"
                  className="col-span-3 h-8 rounded border px-2"
                />
                <input
                  value={tampilRibuan(ongkir)}
                  onChange={(e) => setOngkir(digitSaja(e.target.value))}
                  inputMode="numeric"
                  placeholder="Ongkir"
                  aria-label="Ongkos kirim"
                  className="h-8 rounded border px-2 text-right"
                />
                <input
                  value={catatanKirim}
                  onChange={(e) => setCatatanKirim(e.target.value)}
                  maxLength={255}
                  placeholder="Catatan kirim"
                  aria-label="Catatan kirim"
                  className="col-span-2 h-8 rounded border px-2"
                />
              </div>
            )}
            <input
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              maxLength={255}
              placeholder="Catatan untuk kasir (opsional), mis. pembeli menunggu di depan"
              aria-label="Catatan untuk kasir"
              className="h-8 w-full rounded border px-2"
            />
            <div className="w-full">
              <PeringatanPiutang idPelanggan={tr.t.pelanggan?.id ?? null} />
            </div>
          </div>

          <CariBarangPos
            id={ID.cari}
            aktif={zona === 'cari'}
            tierBawaan={tr.tierBawaan}
            onTambah={tambah}
            onKosongEnter={() => tr.t.baris.length > 0 && setZona('kirim')}
            onTurun={() => tr.t.baris.length > 0 && setZona('keranjang')}
            onEsc={() => undefined}
            onFokus={() => setZona('cari')}
            onSorot={setSorotBarang}
          />

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
            onLanjut={() => setZona('kirim')}
            onFokus={() => setZona('keranjang')}
            bolehLepasPromo={saya.izin.includes('penjualan.checkout')}
            pratinjau={pratinjauBaris}
          />

          <InfoTierBelanja
            info={pratinjau.data?.tierBelanja}
            idTierDasar={tierDefault}
            namaTier={(id) => tierAktif.find((t) => t.id === id)?.nama ?? 'tier lain'}
          />
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="flex min-w-60 flex-1 items-baseline justify-between rounded-md bg-slate-900 px-3 py-2 text-white">
              <span className="text-xs tracking-widest text-slate-300 uppercase">
                Total{tr.t.baris.length > 0 && !pratinjau.segar ? ' (menghitung…)' : ''}
                {pratinjau.segar && pratinjau.data && pratinjau.data.totalDiskonPromo > 0 && (
                  <span className="ml-2 tracking-normal text-emerald-300 normal-case">
                    hemat promo {formatRupiah(pratinjau.data.totalDiskonPromo)}
                  </span>
                )}
              </span>
              <span
                className="text-2xl font-black text-emerald-400 tabular-nums"
                data-testid="total-order"
              >
                {formatRupiah(total)}
              </span>
            </div>
            {adaIsian && (
              <button
                type="button"
                onClick={mintaMulaiDariAwal}
                title={
                  ubahOrder
                    ? 'Buang perubahan; order tetap seperti semula (F9). Akan ditanya dulu.'
                    : 'Kosongkan seluruh isian order ini dan mulai dari awal (F9). Akan ditanya dulu.'
                }
                className="flex h-12 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
              >
                <RotateCcw className="size-4" /> {ubahOrder ? 'Buang perubahan' : 'Mulai dari awal'}
                <kbd className="font-mono text-xs opacity-60">F9</kbd>
              </button>
            )}
            {tr.t.baris.length > 0 && (
              <button
                type="button"
                onClick={mintaSimpanNanti}
                title="Pembeli pesan sekarang, diambil/dibayar nanti: stok ditahan, wajib nama, No. HP, dan tanggal ambil (F7)"
                className="flex h-12 items-center gap-1.5 rounded-md border border-violet-300 bg-white px-3 text-sm font-semibold text-violet-800 hover:bg-violet-50"
              >
                <CalendarClock className="size-4" /> Simpan untuk nanti
                <kbd className="font-mono text-xs opacity-60">F7</kbd>
              </button>
            )}
            {tr.t.baris.length > 0 && !ubahOrder && (
              <button
                type="button"
                onClick={orderBaru}
                disabled={simpan.isPending}
                title="Simpan isian ini sebagai draf, lalu mulai order baru"
                className="h-12 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Simpan draf & order baru
              </button>
            )}
            <button
              id={ID.kirim}
              type="button"
              onClick={kirim}
              onFocus={() => setZona('kirim')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setZona('cari');
                }
              }}
              disabled={simpan.isPending || tr.t.baris.length === 0}
              className={cn(
                'h-12 rounded-md bg-blue-600 px-5 font-bold text-white outline-none disabled:opacity-50',
                zona === 'kirim' && 'ring-4 ring-blue-300',
              )}
            >
              {simpan.isPending
                ? 'Menyimpan…'
                : ubahOrder
                  ? 'Simpan perubahan (F8)'
                  : zona === 'kirim'
                    ? 'Enter: kirim ke antrean'
                    : 'Kirim ke antrean (F8)'}
            </button>
          </div>
          {terakhir && (
            <div
              className="flex items-center gap-3 rounded-md border-2 border-emerald-400 bg-emerald-50 px-3 py-2"
              data-testid="order-terakhir"
            >
              <span className="text-xs text-emerald-800 uppercase">Nomor antrean terakhir</span>
              <span className="text-3xl font-black text-emerald-700 tabular-nums">
                {terakhir.no}
              </span>
              <span className="truncate text-sm text-emerald-800">{terakhir.isi}</span>
            </div>
          )}
        </section>
        {/* Kanan: Order saya; saat memilih barang, rinciannya menutupi area ini (K-122 butir 5, K-114). */}
        <aside className="relative w-96 shrink-0">
          {sorotBarang && (
            <PanelDetailBarang
              b={sorotBarang.b}
              o={sorotBarang.o}
              qty={sorotBarang.qty}
              menutupi="daftar Order saya"
            />
          )}
          <OrderSaya
            onLanjutDraf={(id) =>
              void lanjutDraf(id).catch((err: unknown) => toast.error(pesanGalat(err)))
            }
            bukaDrafOtomatis={bukaDrafOtomatis}
            onBukaDrafOtomatis={(v) => {
              setBukaDrafOtomatis(v);
              tulisBukaDrafOtomatis(v);
              toast.info(
                v
                  ? 'Draf terakhir akan dibuka otomatis saat halaman ini dibuka.'
                  : 'Form akan selalu kosong saat dibuka; buka draf dengan mengkliknya di Order saya.',
              );
            }}
          />
        </aside>
      </div>
      <BilahTombol daftar={tombol} />
      <DialogKonfirmasi
        terbuka={tanyaUlang}
        onTutup={() => setTanyaUlang(false)}
        judul={ubahOrder ? 'Buang perubahan?' : 'Mulai dari awal?'}
        pesan={
          <>
            <p>
              Barang, pelanggan, alamat kirim, ongkir, dan catatan pada order yang sedang diisi ini
              dikosongkan, seperti form yang baru dibuka.
            </p>
            <p className="mt-1">
              {ubahOrder
                ? `Perubahan pada order ${ubahOrder.nomor} dibuang; order itu tetap seperti semula.`
                : idDraf !== null
                  ? 'Order ini masih berupa draf (belum masuk antrean kasir), jadi drafnya ikut dibuang. Order lain yang sudah dikirim ke antrean tidak terpengaruh.'
                  : 'Order ini belum dikirim ke antrean, jadi tidak ada order yang terhapus. Bila berubah pikiran, tekan Ctrl+Z untuk mengembalikan daftar barangnya.'}
            </p>
          </>
        }
        labelKonfirmasi={ubahOrder ? 'Ya, buang perubahan' : 'Ya, mulai dari awal'}
        bahaya
        onKonfirmasi={mulaiDariAwal}
      />
      {cekDraf.dialog}
      {dialogSimpan && (
        <DialogSimpanOrder
          order={{
            namaPelanggan: tr.t.pelanggan?.nama ?? null,
            namaPembeli: tr.t.pelanggan ? null : tr.t.namaPembeli.trim() || null,
            noHp: tr.t.pelanggan ? hpPelanggan : null,
          }}
          siapkan={siapkanDraf}
          fokusSesudah={ID.cari}
          onTersimpan={(o) => {
            setDialogSimpan(false);
            setTerakhir(null);
            tr.kosongkan(false);
            setJenis('LANGSUNG');
            setAlamat('');
            setOngkir('');
            setCatatanKirim('');
            setCatatan('');
            setIndeksBaris(0);
            setZona('cari');
            toast.info(
              `Order ${o.nomor} ada di Order › Disimpan; form kosong untuk pembeli berikutnya.`,
            );
          }}
          onTutup={() => setDialogSimpan(false)}
        />
      )}
      {pelangganBaru && (
        <DialogPelanggan
          pelanggan={null}
          onTutup={() => setPelangganBaru(false)}
          onTersimpan={pilihPelanggan}
        />
      )}
    </div>
  );
}
