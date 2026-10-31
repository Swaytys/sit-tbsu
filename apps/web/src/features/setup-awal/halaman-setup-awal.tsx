import {
  LABEL_LANGKAH_SETUP,
  LABEL_PERAN,
  skemaDataUsaha,
  skemaOperasionalAwal,
  skemaOwnerAwal,
  type InputDataUsaha,
  type InputOperasionalAwal,
  type InputOwnerAwal,
  type LangkahSetupLanjut,
} from '@sit/shared';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock3,
  Loader2,
  PartyPopper,
  SkipForward,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useSaya, useSetupAwal, useStatusPenyiapan } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { usePengaturan } from '@/api/pengaturan';
import { useDaftarPengguna } from '@/api/pengguna';
import { useSelesaiSetupAwal, useSetupAwalStatus, useUbahDataUsaha } from '@/api/penyiapan';
import { LayarMemuat } from '@/components/penjaga-rute';
import { Button } from '@/components/ui/button';
import { TampilKodePemulihan } from '@/features/auth/kartu-kode-pemulihan';
import { FormProfil } from '@/features/pengaturan/form-profil';
import { KartuLogo } from '@/features/pengaturan/kartu-logo';
import { TabCadangan } from '@/features/pengaturan/tab-cadangan';
import { TabPembayaran } from '@/features/pengaturan/tab-pembayaran';
import { TabPersetujuan } from '@/features/pengaturan/tab-persetujuan';
import { DialogTambahPengguna } from '@/features/pengguna/dialog-form-pengguna';
import { HalamanPenyiapan } from '@/features/penyiapan/halaman-penyiapan';
import { bolehAkses } from '@/lib/menu';
import { cn } from '@/lib/utils';
import { FormOperasional, FormOwner, FormUsaha } from './form-langkah';
import { galatDari, type Galat } from './galat';

/*
 * K-205: setup awal pemakaian pertama, seperti aplikasi umum: form langkah demi langkah. Empat langkah pertama
 * (sambutan, data usaha, cara berjualan, akun Owner) dikirim sekaligus ke API; sesudah itu pengguna sudah masuk dan
 * langkah lanjutan memakai layar Pengaturan yang sama (boleh dilewati, diingatkan di Dashboard). Selesai → tur.
 * Owner bisa mengulang dari Pengaturan › Tur & panduan (data usaha tampil terisi, akun tidak dibuat lagi).
 */

const SLOGAN_APLIKASI = 'Toko rapi, stok terkendali, untung terlihat.';

type IdLangkah =
  | 'SELAMAT_DATANG'
  | 'USAHA'
  | 'OPERASIONAL'
  | 'OWNER'
  | 'PEMULIHAN'
  | LangkahSetupLanjut
  | 'SELESAI';

const JUDUL: Record<IdLangkah, { judul: string; ket: string }> = {
  SELAMAT_DATANG: {
    judul: 'Selamat datang',
    ket: 'Kenali BonsaiUrip dan siapkan yang dibutuhkan.',
  },
  USAHA: { judul: 'Data usaha', ket: 'Nama, jenis, dan alamat usaha Anda.' },
  OPERASIONAL: { judul: 'Cara berjualan', ket: 'Cara toko melayani pembeli dan jam buka.' },
  OWNER: { judul: 'Akun Owner', ket: 'Akun pemilik untuk masuk ke aplikasi.' },
  PEMULIHAN: { judul: 'Kode pemulihan', ket: 'Jalan masuk bila password terlupa.' },
  TAMPILAN: { judul: LABEL_LANGKAH_SETUP.TAMPILAN, ket: 'Logo usaha dan isi struk kasir.' },
  PEMBAYARAN: {
    judul: LABEL_LANGKAH_SETUP.PEMBAYARAN,
    ket: 'Rekening bank, EDC, dan QRIS penerima uang.',
  },
  EMAIL: { judul: LABEL_LANGKAH_SETUP.EMAIL, ket: 'Pengirim kode lupa password dan persetujuan.' },
  CADANGAN: { judul: LABEL_LANGKAH_SETUP.CADANGAN, ket: 'Salinan data otomatis setiap hari.' },
  KARYAWAN: { judul: LABEL_LANGKAH_SETUP.KARYAWAN, ket: 'Akun kasir, staf penjualan, admin.' },
  DATA_AWAL: {
    judul: LABEL_LANGKAH_SETUP.DATA_AWAL,
    ket: 'Barang, stok awal, pelanggan, pemasok.',
  },
  SELESAI: { judul: 'Selesai', ket: 'Ringkasan dan mulai tur aplikasi.' },
};

const LANJUT: LangkahSetupLanjut[] = [
  'TAMPILAN',
  'PEMBAYARAN',
  'EMAIL',
  'CADANGAN',
  'KARYAWAN',
  'DATA_AWAL',
];

const USAHA_KOSONG: InputDataUsaha = {
  jenisUsaha: 'BAHAN_BANGUNAN',
  jenisUsahaLain: '',
  namaToko: '',
  namaBadanUsaha: '',
  sloganToko: '',
  alamatToko: '',
  kotaToko: '',
  telpToko: '',
  emailToko: '',
};
const OPERASIONAL_KOSONG: InputOperasionalAwal = {
  layanan: ['LANGSUNG', 'ORDER', 'ANTAR'],
  shiftJamBuka: '',
  shiftJamTutup: '',
};
const OWNER_KOSONG: InputOwnerAwal = {
  namaPengguna: '',
  username: '',
  email: '',
  noHp: '',
  password: '',
  konfirmasi: '',
};

const URUTAN_BARU: IdLangkah[] = [
  'SELAMAT_DATANG',
  'USAHA',
  'OPERASIONAL',
  'OWNER',
  'PEMULIHAN',
  ...LANJUT,
  'SELESAI',
];
const URUTAN_ULANG: IdLangkah[] = ['SELAMAT_DATANG', 'USAHA', 'OPERASIONAL', ...LANJUT, 'SELESAI'];

type Awal = {
  aktif: IdLangkah;
  terjauh: number;
  usaha: InputDataUsaha;
  operasional: InputOperasionalAwal;
  dilewati: LangkahSetupLanjut[];
};

export function HalamanSetupAwal() {
  const saya = useSaya();
  const status = useStatusPenyiapan();
  const [params] = useSearchParams();
  const boleh = saya.data ? bolehAkses(saya.data, 'sistem.pengaturan.kelola') : false;
  const setupStatus = useSetupAwalStatus(boleh);
  // Setelah akun Owner dibuat, pengguna sudah masuk; wizard tetap di mode "baru" agar kode pemulihan dan langkah
  // berikutnya tidak hilang karena halaman beralih ke mode mengulang.
  const [baruBerjalan, setBaruBerjalan] = useState(false);
  const wizardBaru = (
    <WizardSetup
      mode="baru"
      onAkunDibuat={() => setBaruBerjalan(true)}
      awal={{
        aktif: 'SELAMAT_DATANG',
        terjauh: 0,
        usaha: USAHA_KOSONG,
        operasional: OPERASIONAL_KOSONG,
        dilewati: [],
      }}
    />
  );
  if (baruBerjalan) return wizardBaru;
  if (saya.isPending || status.isPending) return <LayarMemuat />;
  if (saya.data) {
    if (!boleh) return <Navigate to="/dashboard" replace />;
    const s = setupStatus.data;
    if (!s) return <LayarMemuat />;
    // Mengulang / melanjutkan: data usaha tersimpan diisikan; setup yang belum selesai mulai di langkah lanjutan.
    const diminta = params.get('langkah') as IdLangkah | null;
    const aktif: IdLangkah =
      diminta && URUTAN_ULANG.includes(diminta)
        ? diminta
        : s.selesai
          ? 'SELAMAT_DATANG'
          : 'TAMPILAN';
    return (
      <WizardSetup
        mode="ulang"
        awal={{
          aktif,
          terjauh: s.selesai ? URUTAN_ULANG.length - 1 : URUTAN_ULANG.indexOf(aktif),
          usaha: s.usaha,
          operasional: s.operasional,
          dilewati: s.dilewati,
        }}
      />
    );
  }
  if (status.data?.perluAkunPertama) return wizardBaru;
  return <Navigate to="/login" replace />;
}

function WizardSetup({
  mode,
  awal,
  onAkunDibuat,
}: {
  mode: 'baru' | 'ulang';
  awal: Awal;
  onAkunDibuat?: () => void;
}) {
  const navigate = useNavigate();
  const saya = useSaya().data;
  const setup = useSetupAwal();
  const ubahUsaha = useUbahDataUsaha();
  const selesai = useSelesaiSetupAwal();

  const urutan = mode === 'baru' ? URUTAN_BARU : URUTAN_ULANG;
  const [aktif, setAktif] = useState<IdLangkah>(awal.aktif);
  const [terjauh, setTerjauh] = useState(awal.terjauh);
  const [dilewati, setDilewati] = useState<LangkahSetupLanjut[]>(awal.dilewati);
  const [usaha, setUsaha] = useState<InputDataUsaha>(awal.usaha);
  const [operasional, setOperasional] = useState<InputOperasionalAwal>(awal.operasional);
  const [owner, setOwner] = useState<InputOwnerAwal>(OWNER_KOSONG);
  const [galat, setGalat] = useState<Galat>({});
  const [kode, setKode] = useState<{ kode: string; username: string } | null>(null);

  const indeks = urutan.indexOf(aktif);
  const bisaLewati = (LANJUT as IdLangkah[]).includes(aktif);
  const sibuk = setup.isPending || ubahUsaha.isPending || selesai.isPending;

  function pindah(ke: IdLangkah) {
    setGalat({});
    setAktif(ke);
    setTerjauh((t) => Math.max(t, urutan.indexOf(ke)));
    window.scrollTo({ top: 0 });
  }

  function validasi<T>(
    skema: {
      safeParse: (v: unknown) => {
        success: boolean;
        error?: { issues: { path: PropertyKey[]; message: string }[] };
        data?: T;
      };
    },
    nilai: unknown,
  ): T | null {
    const v = skema.safeParse(nilai);
    if (!v.success) {
      setGalat(galatDari(v.error?.issues ?? []));
      toast.error('Periksa isian yang bertanda merah.');
      return null;
    }
    return v.data ?? null;
  }

  async function lanjut() {
    if (sibuk) return;
    const berikut = urutan[indeks + 1];
    if (aktif === 'USAHA' && !validasi(skemaDataUsaha, usaha)) return;
    if (aktif === 'OPERASIONAL') {
      if (!validasi(skemaOperasionalAwal, operasional)) return;
      if (mode === 'ulang') {
        try {
          await ubahUsaha.mutateAsync({ usaha, operasional });
          toast.success('Data usaha disimpan.');
        } catch (err) {
          toast.error(pesanGalat(err));
          return;
        }
      }
    }
    if (aktif === 'OWNER') {
      if (!validasi(skemaOwnerAwal, owner)) return;
      try {
        onAkunDibuat?.();
        const h = await setup.mutateAsync({ usaha, operasional, owner });
        setKode({ kode: h.kodePemulihan, username: h.pengguna.username });
      } catch (err) {
        toast.error(pesanGalat(err));
        return;
      }
    }
    if (bisaLewati) setDilewati((d) => d.filter((l) => l !== aktif));
    if (aktif === 'SELESAI') {
      try {
        await selesai.mutateAsync(dilewati);
        void navigate('/dashboard?tur=PENGENALAN', { replace: true });
      } catch (err) {
        toast.error(pesanGalat(err));
      }
      return;
    }
    if (berikut) pindah(berikut);
  }

  function lewati() {
    if (!bisaLewati || sibuk) return;
    setDilewati((d) =>
      d.includes(aktif as LangkahSetupLanjut) ? d : [...d, aktif as LangkahSetupLanjut],
    );
    const berikut = urutan[indeks + 1];
    if (berikut) pindah(berikut);
  }

  function kembali() {
    // Akun Owner sudah dibuat: tidak bisa kembali ke langkah sebelum kode pemulihan.
    const sebelum = urutan[indeks - 1];
    if (!sebelum || aktif === 'PEMULIHAN' || (mode === 'baru' && sebelum === 'PEMULIHAN')) return;
    pindah(sebelum);
  }

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        void lanjut();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        kembali();
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lewati();
      }
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  });

  const sudahMasuk = mode === 'ulang' || kode !== null;
  const bisaKembali =
    indeks > 0 && aktif !== 'PEMULIHAN' && !(mode === 'baru' && urutan[indeks - 1] === 'PEMULIHAN');

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col bg-slate-900 p-6 text-white lg:flex">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10 rounded-lg" />
          <div>
            <p className="text-lg leading-tight font-bold">BonsaiUrip</p>
            <p className="text-xs text-slate-400">Setup awal</p>
          </div>
        </div>
        <ol className="grid gap-1" aria-label="Langkah setup awal">
          {urutan.map((id, i) => {
            const lewat =
              (LANJUT as IdLangkah[]).includes(id) && dilewati.includes(id as LangkahSetupLanjut);
            const bisaKlik =
              i <= terjauh &&
              !(mode === 'baru' && !kode && i > urutan.indexOf('OWNER')) &&
              !(mode === 'baru' && kode && i < urutan.indexOf('PEMULIHAN'));
            const Ikon =
              id === aktif
                ? CircleDot
                : lewat
                  ? Clock3
                  : i < terjauh || i < indeks
                    ? CheckCircle2
                    : Circle;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={!bisaKlik || id === aktif}
                  onClick={() => pindah(id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-sm',
                    id === aktif ? 'bg-blue-600 text-white' : 'text-slate-300',
                    bisaKlik && id !== aktif && 'hover:bg-slate-800',
                    !bisaKlik && 'opacity-50',
                  )}
                >
                  <Ikon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      lewat && id !== aktif && 'text-amber-400',
                    )}
                  />
                  <span>
                    <span className="block">
                      {i + 1}. {JUDUL[id].judul}
                    </span>
                    {lewat && id !== aktif && (
                      <span className="block text-xs text-amber-300">diatur nanti</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-auto text-xs text-slate-400 italic">{SLOGAN_APLIKASI}</p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <form
          noValidate
          className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-6 lg:p-10"
          onSubmit={(e) => {
            e.preventDefault();
            if (aktif !== 'PEMULIHAN') void lanjut();
          }}
        >
          <p className="text-xs font-semibold tracking-wider text-blue-700 uppercase">
            Langkah {indeks + 1} dari {urutan.length}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{JUDUL[aktif].judul}</h1>
          <p className="mb-6 text-sm text-slate-500">{JUDUL[aktif].ket}</p>

          <div className="flex-1">
            <IsiLangkah
              aktif={aktif}
              mode={mode}
              usaha={usaha}
              setUsaha={(k, v) => {
                setUsaha((s) => ({ ...s, [k]: v }));
                setGalat((g) => ({ ...g, [k]: undefined }));
              }}
              operasional={operasional}
              setOperasional={(k, v) => {
                setOperasional((s) => ({ ...s, [k]: v }));
                setGalat((g) => ({ ...g, [k]: undefined }));
              }}
              owner={owner}
              setOwner={(k, v) => {
                setOwner((s) => ({ ...s, [k]: v }));
                setGalat((g) => ({ ...g, [k]: undefined }));
              }}
              galat={galat}
              kode={kode}
              onKodeDisimpan={() => pindah('TAMPILAN')}
              dilewati={dilewati}
              urutan={urutan}
              namaSaya={saya?.namaPengguna ?? owner.namaPengguna}
            />
          </div>

          {aktif !== 'PEMULIHAN' && (
            <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-2 border-t bg-slate-100/95 py-4 backdrop-blur">
              {bisaKembali && (
                <Button type="button" variant="outline" onClick={kembali} disabled={sibuk}>
                  <ArrowLeft /> Kembali <kbd className="ml-1 text-xs text-slate-400">Alt+←</kbd>
                </Button>
              )}
              <span className="flex-1" />
              {bisaLewati && (
                <Button type="button" variant="ghost" onClick={lewati} disabled={sibuk}>
                  <SkipForward /> Lewati, atur nanti{' '}
                  <kbd className="ml-1 text-xs text-slate-400">Alt+L</kbd>
                </Button>
              )}
              <Button
                key={aktif}
                type="submit"
                disabled={sibuk}
                // Langkah tanpa isian (sambutan, ringkasan, layar pengaturan): fokus di tombol agar Enter = lanjut.
                autoFocus={!['USAHA', 'OPERASIONAL', 'OWNER'].includes(aktif)}
              >
                {sibuk ? (
                  <Loader2 className="animate-spin" />
                ) : aktif === 'SELESAI' ? (
                  <PartyPopper />
                ) : (
                  <ArrowRight />
                )}
                {aktif === 'OWNER'
                  ? 'Buat akun dan masuk'
                  : aktif === 'SELESAI'
                    ? 'Selesai, mulai tur'
                    : aktif === 'SELAMAT_DATANG'
                      ? 'Mulai'
                      : bisaLewati
                        ? 'Sudah, lanjut'
                        : 'Lanjut'}
                <kbd className="ml-1 text-xs opacity-70">Enter</kbd>
              </Button>
            </div>
          )}
          {sudahMasuk && aktif !== 'SELESAI' && aktif !== 'PEMULIHAN' && (
            <p className="text-xs text-slate-500">
              Isian di langkah ini tersimpan saat Anda menekan tombol Simpan di dalam kotaknya.
              Semua bisa diubah lagi kapan saja di menu Pengaturan.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}

type Ubah<T> = (k: keyof T, v: T[keyof T]) => void;

function IsiLangkah(p: {
  aktif: IdLangkah;
  mode: 'baru' | 'ulang';
  usaha: InputDataUsaha;
  setUsaha: Ubah<InputDataUsaha>;
  operasional: InputOperasionalAwal;
  setOperasional: Ubah<InputOperasionalAwal>;
  owner: InputOwnerAwal;
  setOwner: Ubah<InputOwnerAwal>;
  galat: Galat;
  kode: { kode: string; username: string } | null;
  onKodeDisimpan: () => void;
  dilewati: LangkahSetupLanjut[];
  urutan: IdLangkah[];
  namaSaya: string;
}) {
  switch (p.aktif) {
    case 'SELAMAT_DATANG':
      return <SelamatDatang mode={p.mode} />;
    case 'USAHA':
      return <FormUsaha isi={p.usaha} ubah={p.setUsaha} galat={p.galat} />;
    case 'OPERASIONAL':
      return <FormOperasional isi={p.operasional} ubah={p.setOperasional} galat={p.galat} />;
    case 'OWNER':
      return <FormOwner isi={p.owner} ubah={p.setOwner} galat={p.galat} />;
    case 'PEMULIHAN':
      return p.kode ? (
        <div className="max-w-lg">
          <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
            Akun Owner sudah dibuat dan Anda sudah masuk. Simpan kode di bawah sebelum lanjut.
          </p>
          <TampilKodePemulihan
            kode={p.kode.kode}
            username={p.kode.username}
            labelLanjut="Lanjut ke langkah berikutnya"
            onLanjut={p.onKodeDisimpan}
          />
        </div>
      ) : null;
    case 'TAMPILAN':
      return <LangkahTampilan />;
    case 'PEMBAYARAN':
      return (
        <Bungkus ket="Daftarkan rekening bank, mesin EDC, dan QRIS yang dipakai menerima uang. Kasir memilih salah satunya saat pembeli membayar non-tunai, sehingga uang masuk bisa dicocokkan. Toko yang hanya menerima tunai boleh melewati langkah ini.">
          <TabPembayaran />
        </Bungkus>
      );
    case 'EMAIL':
      return (
        <Bungkus ket="Email toko (pengirim) dipakai untuk mengirim kode lupa password ke email pengguna, dan kode persetujuan atasan. Perlu internet. Ikuti petunjuk di kotak di bawah (contoh memakai Gmail dengan sandi aplikasi), lalu tekan Kirim uji.">
          <TabPersetujuan />
        </Bungkus>
      );
    case 'CADANGAN':
      return (
        <Bungkus ket="Cadangan menyalin seluruh data ke folder lain (flashdisk, hardisk eksternal, atau drive D:) setiap hari, terenkripsi dengan sandi. Bila laptop rusak atau hilang, data bisa dipulihkan dari cadangan. Sangat disarankan.">
          <TabCadangan />
        </Bungkus>
      );
    case 'KARYAWAN':
      return <LangkahKaryawan />;
    case 'DATA_AWAL':
      return (
        <Bungkus ket="Isi data yang dipakai sehari-hari: barang dan harganya, stok awal, pelanggan, pemasok, kendaraan & sopir, dan printer struk. Tiap baris punya tombol ke layar yang tepat (tombol kembali ke setup ada di Dashboard). Mau mencoba dulu? Pakai Isi contoh, lalu nonaktifkan setelah selesai mencoba.">
          <HalamanPenyiapan />
        </Bungkus>
      );
    case 'SELESAI':
      return <Ringkasan dilewati={p.dilewati} urutan={p.urutan} nama={p.namaSaya} />;
  }
}

function Bungkus({ ket, children }: { ket: string; children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <p className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        {ket}
      </p>
      {children}
    </div>
  );
}

function SelamatDatang({ mode }: { mode: 'baru' | 'ulang' }) {
  const fitur = [
    ['Penjualan', 'Kasir cepat dengan keyboard, order dari staf, pengantaran dengan surat jalan.'],
    ['Persediaan', 'Stok bertambah dan berkurang otomatis; peringatan stok kritis; saran pesan.'],
    ['Uang', 'Shift kasir, cocokkan uang laci, piutang pelanggan, hutang pemasok.'],
    ['Laporan', 'Penjualan, laba, stok, kas; siap cetak dan ekspor Excel.'],
  ];
  return (
    <div className="grid gap-6">
      <div className="rounded-xl bg-slate-900 p-6 text-white">
        <p className="text-2xl font-bold">BonsaiUrip</p>
        <p className="text-slate-300">{SLOGAN_APLIKASI}</p>
      </div>
      {mode === 'ulang' ? (
        <p className="text-sm text-slate-700">
          Anda mengulang setup awal. Isian yang sudah tersimpan tampil kembali; ubah yang perlu,
          lalu lanjutkan. Data transaksi tidak tersentuh.
        </p>
      ) : (
        <p className="text-sm text-slate-700">
          Sebelum dipakai, BonsaiUrip perlu mengenal usaha Anda. Setup ini ± 10–15 menit. Langkah
          1–4 wajib; langkah berikutnya boleh dilewati dan diatur nanti.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {fitur.map(([j, k]) => (
          <div key={j} className="rounded-lg border bg-white p-4">
            <p className="font-semibold text-slate-800">{j}</p>
            <p className="text-sm text-slate-600">{k}</p>
          </div>
        ))}
      </div>
      {mode === 'baru' && (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
          <p className="mb-2 font-semibold">Siapkan dulu:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nama, alamat, dan telepon usaha.</li>
            <li>Username dan password untuk akun pemilik (Owner); email bila ada.</li>
            <li>Kertas dan pulpen untuk mencatat kode pemulihan dan sandi cadangan.</li>
            <li>Bila ada: logo usaha (gambar), nomor rekening/QRIS, flashdisk untuk cadangan.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function LangkahTampilan() {
  const pengaturan = usePengaturan();
  return (
    <Bungkus ket="Logo tampil di struk (bila dinyalakan), invoice, dan laporan. Atur juga lebar kertas struk printer kasir dan kalimat penutup struk. Tekan Simpan di tiap kotak.">
      <KartuLogo />
      {pengaturan.data ? (
        <FormProfil pengaturan={pengaturan.data} bagian="struk" />
      ) : (
        <Loader2 className="size-5 animate-spin text-slate-400" />
      )}
    </Bungkus>
  );
}

function LangkahKaryawan() {
  const [tambah, setTambah] = useState(false);
  const daftar = useDaftarPengguna({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 50 });
  return (
    <Bungkus ket="Tiap karyawan sebaiknya punya akun sendiri, supaya setiap transaksi tercatat atas nama yang mengerjakan. Kasir: penjualan dan shift. Staf penjualan: membuat order. Admin: data barang, stok, pembelian, laporan. Password awal karyawan wajib diganti saat ia pertama masuk.">
      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Akun yang sudah ada</p>
          <Button type="button" size="sm" onClick={() => setTambah(true)}>
            <UserPlus /> Tambah akun karyawan
          </Button>
        </div>
        <ul className="divide-y text-sm">
          {(daftar.data?.data ?? []).map((u) => (
            <li key={u.id} className="flex items-center justify-between px-4 py-2">
              <span>
                {u.namaPengguna} <span className="text-slate-400">({u.username})</span>
              </span>
              <span className="text-slate-500">{LABEL_PERAN[u.peran]}</span>
            </li>
          ))}
        </ul>
      </div>
      <DialogTambahPengguna terbuka={tambah} onTutup={() => setTambah(false)} />
    </Bungkus>
  );
}

function Ringkasan({
  dilewati,
  urutan,
  nama,
}: {
  dilewati: LangkahSetupLanjut[];
  urutan: IdLangkah[];
  nama: string;
}) {
  return (
    <div className="grid gap-5">
      <div className="rounded-xl bg-emerald-600 p-6 text-white">
        <p className="text-xl font-semibold">Setup awal hampir selesai{nama ? `, ${nama}` : ''}!</p>
        <p className="text-emerald-50">
          Tekan Selesai untuk masuk ke aplikasi. Tur singkat akan menunjukkan bagian-bagian layar
          dan cara memakai tiap fitur; tur bisa dilewati dan diulang dari Pengaturan › Tur &
          panduan.
        </p>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {urutan
          .filter((id) => (LANJUT as IdLangkah[]).includes(id))
          .map((id) => {
            const lewat = dilewati.includes(id as LangkahSetupLanjut);
            return (
              <li key={id} className="flex items-center gap-2">
                {lewat ? (
                  <Clock3 className="size-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                )}
                <span className={lewat ? 'text-amber-800' : 'text-slate-700'}>
                  {JUDUL[id].judul}
                  {lewat && ' — diatur nanti (diingatkan di Dashboard)'}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
