import { formatRupiah, type BarisBarang, type OpsiSatuanBaris } from '@sit/shared';
import { ImageOff, List, Search } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { useDaftarBarang } from '@/api/barang';
import { ambilIsi, api, pesanGalat } from '@/api/client';
import { useDaftarKategori } from '@/api/referensi';
import { formatDesimal } from '@/lib/format';
import { kemasanSegelBarang, teksLapisanSegel } from '@/lib/segel';
import { useTunda } from '@/lib/use-tunda';
import { LencanaKeterjualan } from '@/components/lencana-keterjualan';
import { cn } from '@/lib/utils';
import { opsiDariBarang, satuanAwal, uraikanCari } from './model';

const JUMLAH_HASIL = 8;
/** Jumlah barang yang tampil saat menjelajah daftar tanpa mengetik (K-108). */
const JUMLAH_JELAJAH = 30;

/** Satu pilihan di hasil cari: barang dalam satu satuan (satuan dasar atau kemasan, K-094). */
export type PilihanBarang = { b: BarisBarang; o: OpsiSatuanBaris; qty: string };
type Pilihan = { b: BarisBarang; o: OpsiSatuanBaris };

/**
 * Hasil cari dipecah per satuan: setiap kemasan aktif (dus, roll, …) tampil sebagai pilihan sendiri, satuan
 * yang dipindai/bawaan lebih dulu, sehingga kasir memilih satuan cukup dengan panah dan Enter.
 */
function pilihanDari(daftar: BarisBarang[]): Pilihan[] {
  return daftar.flatMap((b) => {
    const awal = satuanAwal(b);
    const opsi = opsiDariBarang(b);
    return [
      ...opsi.filter((o) => o.idSatuanJual === awal),
      ...opsi.filter((o) => o.idSatuanJual !== awal),
    ].map((o) => ({ b, o }));
  });
}

/** Pilih hasil terbaik: kode/barcode persis sama lebih dulu, selain itu hasil pertama. */
function terbaik(daftar: BarisBarang[], kata: string): BarisBarang | undefined {
  const k = kata.toLowerCase();
  return (
    daftar.find((b) => b.kode.toLowerCase() === k || b.barcode?.toLowerCase() === k) ?? daftar[0]
  );
}

/** Foto kecil barang; kotak kosong bila barang belum punya foto. Dimuat malas agar daftar tidak tersendat. */
function FotoBarang({ src, ukuran }: { src: string | null; ukuran: 'kecil' | 'sedang' }) {
  const kelas = ukuran === 'kecil' ? 'size-8' : 'size-14';
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(kelas, 'shrink-0 rounded border bg-white object-cover')}
    />
  ) : (
    <span
      className={cn(
        kelas,
        'flex shrink-0 items-center justify-center rounded border bg-slate-50 text-slate-300',
      )}
      aria-hidden
    >
      <ImageOff className="size-4" />
    </span>
  );
}

/**
 * Kotak cari barang layar POS (K-073). "3*semen" atau "semen*3" = qty 3; F1 menyisipkan "*". Enter langsung
 * menambah hasil yang disorot; bila hasil belum tiba (mengetik cepat / scanner barcode), Enter menunggu
 * jawaban server lalu memakai kecocokan terbaik — tidak ada ketikan yang hilang. Enter pada kotak kosong =
 * lanjut ke pembayaran. Barang berkemasan tampil sekali per satuan ("Semen · sak", "Semen · dus isi 10").
 *
 * K-108: kata cari boleh berupa nama, kode, barcode, merk, kategori, atau atribut ("pipa 3 inch putih");
 * semua kata harus cocok. Ada saring kategori, dan daftar barang bisa dijelajahi tanpa mengetik (tombol
 * "Daftar" atau Alt+↓). Hasil menampilkan foto kecil barang.
 */
export function CariBarangPos({
  id,
  aktif,
  onTambah,
  onKosongEnter,
  onTurun,
  onEsc,
  onFokus,
  tierBawaan,
  onSorot,
  placeholder = 'Nama, kode, merk, kategori, atribut, atau scan barcode… (semen*3 = qty 3)',
}: {
  id: string;
  aktif: boolean;
  /** Tier untuk harga yang ditampilkan di hasil cari. */
  tierBawaan: number | null;
  /** `idSatuanJual` diisi bila kasir memilih satuan tertentu di hasil cari (`null` = satuan dasar). */
  onTambah: (b: BarisBarang, qty: string, idSatuanJual?: number | null) => void;
  onKosongEnter: () => void;
  onTurun: () => void;
  onEsc: () => void;
  onFokus: () => void;
  /**
   * K-114: barang yang sedang disorot (panah atau kursor), `null` bila daftar tertutup. Bila diisi, rincian
   * barang ditampilkan pemanggil (layar kasir: menutupi area antrean) dan baris info di bawah daftar disembunyikan.
   */
  onSorot?: (p: PilihanBarang | null) => void;
  placeholder?: string;
}) {
  const [teks, setTeks] = useState('');
  const [sorot, setSorot] = useState(0);
  const [idKategori, setIdKategori] = useState<number | null>(null);
  /** Daftar barang dibuka tanpa kata cari (tombol "Daftar" atau Alt+↓). */
  const [jelajah, setJelajah] = useState(false);
  /** Saat menjelajah, Enter baru menambah barang setelah sorotan dipindah dengan panah atau kursor. */
  const [sorotDipilih, setSorotDipilih] = useState(false);
  const kotak = useRef<HTMLInputElement>(null);
  const kategori = useDaftarKategori('AKTIF').data ?? [];

  // F1 di mana pun: fokus ke kotak cari dan sisipkan "*" (qty) di posisi kursor.
  useEffect(() => {
    function f1(e: globalThis.KeyboardEvent) {
      if (e.key !== 'F1') return;
      e.preventDefault();
      const el = kotak.current;
      if (!el) return;
      const fokus = document.activeElement === el;
      el.focus();
      setTeks((t) => {
        const awal = fokus ? (el.selectionStart ?? t.length) : t.length;
        const akhir = fokus ? (el.selectionEnd ?? t.length) : t.length;
        const baru = `${t.slice(0, awal)}*${t.slice(akhir)}`;
        requestAnimationFrame(() => el.setSelectionRange(awal + 1, awal + 1));
        return baru;
      });
    }
    window.addEventListener('keydown', f1);
    return () => window.removeEventListener('keydown', f1);
  }, []);
  const [mencari, setMencari] = useState(false);
  const { qty, kata } = uraikanCari(teks);
  const kataTunda = useTunda(kata, 100);
  const menjelajah = kata === '' && (jelajah || idKategori !== null);
  const daftar = useDaftarBarang({
    cari: kataTunda,
    idKategori,
    status: 'AKTIF',
    perluTinjau: false,
    halaman: 1,
    perHalaman: menjelajah ? JUMLAH_JELAJAH : JUMLAH_HASIL,
  });
  const segar =
    (kata !== '' || menjelajah) &&
    kataTunda === kata &&
    !daftar.isPlaceholderData &&
    !daftar.isFetching;
  const hasil = segar ? pilihanDari(daftar.data?.data ?? []) : [];
  const terbuka = aktif && (kata !== '' || menjelajah);

  // Hasil yang disorot dengan panah tetap terlihat walau daftar perlu digulir.
  useEffect(() => {
    document.getElementById(`${id}-hasil-${sorot}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, sorot]);

  function tambah(b: BarisBarang | undefined, idSatuanJual?: number | null) {
    if (!b) {
      toast.error(`Barang "${kata}" tidak ditemukan.`);
      return;
    }
    onTambah(b, qty, idSatuanJual);
    setTeks('');
    setSorot(0);
    setSorotDipilih(false);
  }

  function tutupJelajah() {
    setJelajah(false);
    setIdKategori(null);
    setSorot(0);
    setSorotDipilih(false);
  }

  async function enter() {
    if (!kata) {
      // Menjelajah: Enter menambah barang yang sengaja disorot; tanpa itu, Enter tetap = lanjut bayar.
      const p = menjelajah && sorotDipilih ? hasil[sorot] : undefined;
      if (p) tambah(p.b, p.o.idSatuanJual);
      else onKosongEnter();
      return;
    }
    if (segar) {
      const p = hasil[sorot];
      if (p) tambah(p.b, p.o.idSatuanJual);
      else tambah(terbaik(daftar.data?.data ?? [], kata));
      return;
    }
    setMencari(true);
    try {
      const r = await ambilIsi(
        await api.barang.$get({
          query: {
            cari: kata,
            idKategori: idKategori === null ? undefined : String(idKategori),
            status: 'AKTIF',
            halaman: '1',
            perHalaman: String(JUMLAH_HASIL),
          },
        }),
      );
      tambah(terbaik(r.data, kata));
    } catch (err) {
      toast.error(pesanGalat(err));
    } finally {
      setMencari(false);
    }
  }

  function tombol(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.altKey && !terbuka) {
        setJelajah(true);
      } else if (hasil.length > 0) {
        setSorot((s) => (sorotDipilih || kata !== '' ? Math.min(s + 1, hasil.length - 1) : s));
        setSorotDipilih(true);
      } else if (!teks) onTurun();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSorot((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void enter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (teks) setTeks('');
      else if (menjelajah) tutupJelajah();
      else onEsc();
    }
  }

  const total = daftar.data?.meta.total ?? 0;
  const disorotSekarang = terbuka && (kata !== '' || sorotDipilih) ? hasil[sorot] : undefined;
  const kunciSorot = disorotSekarang
    ? `${disorotSekarang.b.id}:${disorotSekarang.o.idSatuanJual ?? 0}:${qty}`
    : '';
  const sorotTerakhir = useRef('');
  // Memberi tahu pemanggil hanya saat barang/satuan/qty yang disorot berganti, bukan setiap render.
  useEffect(() => {
    if (sorotTerakhir.current === kunciSorot) return;
    sorotTerakhir.current = kunciSorot;
    onSorot?.(disorotSekarang ? { ...disorotSekarang, qty } : null);
  });
  useEffect(() => () => onSorot?.(null), [onSorot]);

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id={id}
            ref={kotak}
            value={teks}
            onChange={(e) => {
              setTeks(e.target.value);
              setSorot(0);
              setSorotDipilih(false);
            }}
            onKeyDown={tombol}
            onFocus={onFokus}
            placeholder={placeholder}
            aria-label="Cari barang"
            autoComplete="off"
            className={cn(
              'h-10 w-full rounded-md border bg-white pr-3 pl-8 text-sm outline-none',
              aktif ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300',
            )}
          />
          {qty !== '1' && kata && (
            <span className="absolute top-1/2 right-2 -translate-y-1/2 rounded bg-blue-600 px-1.5 text-xs font-bold text-white">
              qty {formatDesimal(qty)}
            </span>
          )}
        </div>
        <select
          value={idKategori ?? ''}
          onChange={(e) => {
            setIdKategori(e.target.value ? Number(e.target.value) : null);
            setSorot(0);
            setSorotDipilih(false);
            kotak.current?.focus();
          }}
          tabIndex={-1}
          aria-label="Saring kategori barang"
          title="Hanya tampilkan barang dari satu kategori"
          className={cn(
            'h-10 max-w-40 rounded-md border bg-white px-2 text-sm outline-none',
            idKategori !== null ? 'border-blue-500 font-medium text-blue-700' : 'border-slate-300',
          )}
        >
          <option value="">Semua kategori</option>
          {kategori.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama}
            </option>
          ))}
        </select>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (menjelajah) tutupJelajah();
            else setJelajah(true);
            kotak.current?.focus();
          }}
          aria-pressed={menjelajah}
          title="Lihat daftar barang tanpa mengetik (Alt+↓ dari kotak cari)"
          className={cn(
            'flex h-10 items-center gap-1 rounded-md border px-2.5 text-sm',
            menjelajah
              ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          <List className="size-4" /> Daftar
        </button>
      </div>
      {terbuka && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
          {menjelajah && (
            <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <span>
                {segar
                  ? `Menampilkan ${Math.min(JUMLAH_JELAJAH, total)} dari ${total} barang${
                      idKategori !== null ? ' di kategori ini' : ''
                    }, urut nama. Ketik untuk mempersempit; klik, atau panah lalu Enter, untuk menambah.`
                  : 'Memuat daftar barang…'}
              </span>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={tutupJelajah}
                className="font-medium text-blue-700 hover:underline"
              >
                Tutup (Esc)
              </button>
            </div>
          )}
          <ul
            role="listbox"
            aria-label="Hasil cari barang"
            className="max-h-[50vh] overflow-x-hidden overflow-y-auto"
          >
            {hasil.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">
                {segar && !mencari ? 'Tidak ada barang yang cocok.' : 'Mencari…'}
              </li>
            )}
            {hasil.map(({ b, o }, i) => {
              const h = o.hargaTier.find((x) => x.idTingkatHarga === tierBawaan) ?? o.hargaTier[0];
              const disorot = i === sorot && (kata !== '' || sorotDipilih);
              return (
                <li
                  key={`${b.id}:${o.idSatuanJual ?? 0}`}
                  id={`${id}-hasil-${i}`}
                  role="option"
                  aria-selected={disorot}
                  onMouseEnter={() => {
                    setSorot(i);
                    setSorotDipilih(true);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    tambah(b, o.idSatuanJual);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                    disorot && 'bg-blue-50',
                  )}
                >
                  <FotoBarang src={b.gambar} ukuran="kecil" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1.5">
                      <span className="line-clamp-2 min-w-0 flex-1 font-medium break-words">
                        {b.namaBarang}
                      </span>
                      <LencanaKeterjualan k={b.keterjualan} />
                      <span
                        className={cn(
                          'shrink-0 rounded px-1 text-xs',
                          o.idSatuanJual === null
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-blue-50 font-medium text-blue-700',
                        )}
                      >
                        {o.kodeSatuan}
                        {o.idSatuanJual !== null &&
                          ` isi ${formatDesimal(o.faktor)} ${b.kodeSatuan}`}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                      {/* Atribut ringkas: pembeda barang yang namanya mirip. */}
                      {b.ringkasAtribut.length > 0 && (
                        <span className="min-w-0 truncate">
                          {b.ringkasAtribut.map((a) => a.nilai).join(' · ')}
                        </span>
                      )}
                      <span className="ml-auto tabular-nums">
                        {h && h.hargaJual > 0
                          ? `${formatRupiah(h.hargaJual)}/${o.kodeSatuan}`
                          : 'harga belum ada'}{' '}
                        · stok {/* K-123: stok cepat terbaca: tebal, merah, minimal 14 px. */}
                        <b className="text-sm text-red-600">{formatDesimal(b.stokTersedia)}</b>
                        {kemasanSegelBarang(b) && (
                          <span>
                            {' '}
                            ({teksLapisanSegel(b.stokFisik, b.stokSegel, kemasanSegelBarang(b))})
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {/* Info lengkap barang yang disorot (panah atau kursor): foto, kode, kategori, merk, atribut. */}
          {!onSorot && hasil[sorot] && (kata !== '' || sorotDipilih) && (
            <InfoBarang b={hasil[sorot].b} />
          )}
        </div>
      )}
    </div>
  );
}

function InfoBarang({ b }: { b: BarisBarang }) {
  const bagian = [
    b.kode,
    b.barcode ? `barcode ${b.barcode}` : null,
    b.namaKategori,
    b.namaMerk,
    ...b.ringkasAtribut.map((a) => `${a.nama}: ${a.nilai}`),
    b.kepemilikan === 'KONSINYASI' ? `titipan ${b.namaPemasokKonsinyasi ?? ''}` : null,
  ].filter(Boolean);
  return (
    <div
      className="flex items-center gap-3 border-t bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
      aria-live="polite"
    >
      {b.gambar && <FotoBarang src={b.gambar} ukuran="sedang" />}
      <span>{bagian.join(' · ')}</span>
    </div>
  );
}
