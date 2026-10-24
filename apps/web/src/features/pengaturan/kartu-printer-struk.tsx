import {
  KEPEKATAN_STRUK,
  LABEL_KEPEKATAN_STRUK,
  lebarKarakterStruk,
  lebarTitikStruk,
  type KepekatanStruk,
} from '@sit/shared';
import { Printer } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useTampilanToko } from '@/api/pengaturan';
import { KotakHasil, Langkah } from '@/components/langkah';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  bacaPengaturanPrinter,
  dukungCetakLangsung,
  namaPort,
  peringatanPort,
  PILIHAN_BAUD,
  pilihPrinter,
  simpanPengaturanPrinter,
  type PengaturanPrinter,
} from '@/lib/printer-thermal';
import { logoStruk } from '@/lib/logo-struk';
import { cetakUjiLangsung } from '@/lib/struk-escpos';

const IKUT_TOKO = 'IKUT_TOKO';
const PILIHAN_LEBAR = [
  [32, 'Kertas 57/58 mm (32 karakter per baris)'],
  [48, 'Kertas 80 mm (48 karakter per baris)'],
  [30, '30 karakter (kertas 58 mm, bila baris angka uji turun)'],
  [42, '42 karakter (kertas 80 mm, bila baris angka uji turun)'],
] as const;

/** Jawaban pengguna atas "apa yang keluar dari printer?" setelah uji cetak terkirim. */
type HasilUji = 'KOSONG' | 'ACAK' | 'LEBAR' | 'PUDAR';

function Saklar({
  label,
  ket,
  nilai,
  onUbah,
  nonaktif,
}: {
  label: string;
  ket: string;
  nilai: boolean;
  onUbah: (v: boolean) => void;
  nonaktif?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{ket}</p>
      </div>
      <Switch checked={nilai} onCheckedChange={onUbah} disabled={nonaktif} aria-label={label} />
    </div>
  );
}

function Lipatan({
  judul,
  terbuka,
  children,
}: {
  judul: string;
  terbuka?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="rounded-md border bg-slate-50 p-3 text-sm" open={terbuka}>
      <summary className="cursor-pointer font-medium">{judul}</summary>
      <div className="mt-2 space-y-2 text-slate-700">{children}</div>
    </details>
  );
}

/** Saran menurut apa yang keluar dari printer saat uji cetak. */
const SARAN: Record<HasilUji, { judul: string; butir: string[] }> = {
  KOSONG: {
    judul: 'Tidak keluar apa-apa: hampir selalu karena yang dipilih di Langkah 2 bukan printernya.',
    butir: [
      'Pastikan lampu printer menyala, kertas terpasang, dan tutup kertas rapat.',
      'Kembali ke Langkah 2, tekan "Pilih printer…" lagi, dan pilih baris LAIN dari yang tadi. Yang sudah pasti bukan printer: EM7455 (modem laptop) dan "Bluetooth Peripheral Device".',
      'Ulangi Uji cetak. Salah pilih tidak merusak apa pun; coba satu per satu sampai kertas keluar.',
      'Semua baris sudah dicoba dan tetap tidak keluar? Matikan printer, nyalakan lagi, dekatkan ke komputer, lalu ulangi dari Langkah 2. Bila tetap gagal, hapus printer dari Bluetooth Windows dan pasangkan ulang (Langkah 1).',
    ],
  },
  ACAK: {
    judul: 'Keluar huruf acak: printernya benar, tetapi kecepatan port tidak cocok.',
    butir: [
      'Buka "Pengaturan lanjutan" di bawah, ubah Kecepatan port (baud) ke 115200, lalu Uji cetak lagi.',
      'Masih acak? Coba 19200, 38400, dan 57600 satu per satu.',
      'Tetap acak pada semua kecepatan: printer itu tidak memakai bahasa ESC/POS. Matikan cetak langsung dan pakai jendela cetak peramban.',
    ],
  },
  LEBAR: {
    judul: 'Baris angka turun ke baris berikutnya, atau ada ruang kosong lebar di kanan.',
    butir: [
      'Baris angka turun/terpotong: di Langkah 3 pilih jumlah karakter yang lebih kecil (kertas 58 mm: 32, lalu 30).',
      'Ada ruang kosong di kanan: pilih yang lebih besar (kertas 80 mm: 48).',
      'Uji cetak lagi sampai baris angka 1234567890… pas satu baris penuh.',
    ],
  },
  PUDAR: {
    judul: 'Tercetak tetapi pudar atau putus-putus.',
    butir: [
      'Buka "Pengaturan lanjutan" di bawah, ubah Kepekatan cetak ke Tebal, lalu Uji cetak lagi. Masih pudar? Pilih Paling tebal dan uji lagi.',
      'Isi daya printer sampai penuh: printer baterai mencetak pudar saat baterai lemah.',
      'Ganti gulungan kertas thermal (kertas lama/lembap cetaknya abu-abu) dan pastikan sisi yang mengilap menghadap kepala cetak.',
      'Bersihkan kepala cetak dengan kapas beralkohol saat printer mati dan dingin.',
    ],
  },
};

/**
 * Printer struk komputer ini (K-103, K-105): cetak langsung ke printer thermal tanpa jendela cetak. Berlaku
 * per komputer (disimpan di peramban), karena printer tersambung ke komputer kasir, bukan ke server.
 * Disusun sebagai lima langkah berurutan; langkah uji menanyakan apa yang keluar dari printer dan memberi
 * saran sesuai jawabannya, karena peramban tidak bisa mengetahui apakah kertas benar-benar keluar.
 */
export function KartuPrinterStruk() {
  const toko = useTampilanToko().data;
  const dukung = dukungCetakLangsung();
  const [p, setP] = useState<PengaturanPrinter>(bacaPengaturanPrinter);
  const [sibuk, setSibuk] = useState(false);
  /** Uji cetak terakhir: terkirim (menunggu jawaban pengguna) atau gagal dikirim (pesan). */
  const [uji, setUji] = useState<{ terkirim: true } | { terkirim: false; pesan: string } | null>(
    null,
  );
  const [hasil, setHasil] = useState<HasilUji | null>(null);
  const [galatPilih, setGalatPilih] = useState('');

  function ubah(ubahan: Partial<PengaturanPrinter>) {
    // Dibaca ulang dari penyimpanan: `pilihPrinter` menulis ke sana tanpa lewat state kartu ini.
    const baru = { ...bacaPengaturanPrinter(), ...ubahan };
    setP(baru);
    simpanPengaturanPrinter(baru);
  }

  function pilih() {
    setGalatPilih('');
    setUji(null);
    setHasil(null);
    void pilihPrinter()
      .then(() => setP(bacaPengaturanPrinter()))
      .catch((err: unknown) =>
        setGalatPilih(err instanceof Error ? err.message : 'Printer tidak bisa dipilih.'),
      );
  }

  function ujiCetak() {
    if (!toko) return;
    setSibuk(true);
    setUji(null);
    setHasil(null);
    void cetakUjiLangsung(toko)
      .then(() => setUji({ terkirim: true }))
      .catch((err: unknown) =>
        setUji({
          terkirim: false,
          pesan: err instanceof Error ? err.message : 'Printer tidak bisa dipakai.',
        }),
      )
      .finally(() => setSibuk(false));
  }

  const lebarToko = toko ? lebarKarakterStruk(toko.lebarStrukMm) : 32;
  const lebarKini = p.lebarKarakter ?? lebarToko;

  // K-124: pratinjau logo persis seperti yang dikirim ke printer (hitam-putih).
  const urlLogo = toko?.strukTampilkanLogo ? toko.logo : null;
  const [logo, setLogo] = useState<{ url: string; gambar: string | null } | null>(null);
  useEffect(() => {
    if (!urlLogo) return;
    let batal = false;
    const kunci = `${urlLogo}|${lebarKini}`;
    logoStruk(urlLogo, lebarTitikStruk(lebarKini))
      .then((l) => !batal && setLogo({ url: kunci, gambar: l.pratinjau }))
      .catch(() => !batal && setLogo({ url: kunci, gambar: null }));
    return () => {
      batal = true;
    };
  }, [urlLogo, lebarKini]);
  const pratinjauLogo = logo?.url === `${urlLogo}|${lebarKini}` ? logo : null;
  const peringatan = peringatanPort(p.info);
  const terpilih = p.info !== null && peringatan === null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2.5 border-b bg-slate-50 px-6 py-4">
        <Printer className="size-4 text-blue-600" />
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Printer struk komputer ini</h2>
          <p className="text-xs text-slate-500">
            Berlaku untuk komputer dan peramban yang sedang dipakai. Tiap komputer kasir diatur
            sendiri, sekali saja: setelan tersimpan di peramban dan tetap berlaku setelah aplikasi
            atau komputer dimatikan.
          </p>
        </div>
      </div>
      <div className="space-y-5 p-6">
        <div className="space-y-1 text-sm text-slate-600">
          <p>
            <b>Cetak langsung</b> = begitu penjualan selesai, struk keluar dari printer thermal
            tanpa jendela cetak, tanpa memilih printer, tanpa mengatur kertas. Struk dikirim sebagai
            teks memakai huruf bawaan printer, sehingga hasilnya tegak (potret), tajam, dan rapi
            dalam kolom.
          </p>
          <p>
            Kerjakan lima langkah di bawah berurutan sampai semuanya bercentang hijau. Butuh ±5
            menit, printer menyala, dan kertas terpasang.
          </p>
        </div>

        {!dukung && (
          <KotakHasil berhasil={false}>
            <p>
              <b>Peramban ini tidak bisa mencetak langsung ke printer.</b> Tutup peramban ini, buka
              aplikasi dengan <b>Google Chrome</b> atau <b>Microsoft Edge</b> di komputer kasir,
              lalu kembali ke halaman ini. Di peramban lain (Firefox, Safari) dan di HP/tablet,
              struk tetap bisa dicetak, tetapi lewat jendela cetak.
            </p>
          </KotakHasil>
        )}

        <Langkah
          no={1}
          judul="Nyalakan printer dan sambungkan ke Windows (sekali saja)"
          selesai={p.info !== null}
        >
          <Lipatan
            judul="Printer Bluetooth (merek apa pun): pasangkan, lalu buat port COM keluar"
            terbuka={p.info === null}
          >
            <p>
              Berlaku untuk printer struk thermal 58/80 mm yang memakai perintah ESC/POS (hampir
              semua printer struk: RPP02, POS-58, Xprinter, Panda, Epson TM, dan sejenisnya).
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Pasang gulungan kertas thermal, tutup penutupnya, lalu nyalakan printer (tahan
                tombol daya sampai lampunya menyala).
              </li>
              <li>
                Di komputer: klik <b>Start</b> › <b>Setelan</b> (Settings) ›{' '}
                <b>Bluetooth &amp; perangkat</b>. Pastikan sakelar <b>Bluetooth</b> <b>Aktif</b>.
              </li>
              <li>
                Bila printer belum ada di daftar: klik <b>Tambahkan perangkat</b> › <b>Bluetooth</b>
                , tunggu nama printer muncul, klik. Bila diminta PIN, ketik <code>0000</code>; bila
                ditolak, <code>1234</code>.
              </li>
              <li>
                Tulisan <i>Driver is unavailable</i> / <i>Driver tidak tersedia</i> di bawah nama
                printer itu <b>wajar dan boleh diabaikan</b>: cetak langsung tidak memakai driver.
              </li>
              <li>
                <b>Buat port COM keluar</b> (langkah yang paling sering terlewat): di halaman{' '}
                <b>Bluetooth &amp; perangkat</b> › <b>Perangkat</b>, gulir ke bawah, klik{' '}
                <b>Setelan Bluetooth lainnya</b> (More Bluetooth settings) › tab <b>Port COM</b>.
                Bila sudah ada baris berarah <b>Keluar</b> (Outgoing) yang memuat nama printer,
                lewati langkah ini. Bila belum: klik <b>Tambah…</b> › pilih <b>Keluar</b> (Outgoing)
                › pada <b>Perangkat yang akan memakai port COM</b> pilih printer Anda › <b>OK</b> ›{' '}
                <b>OK</b>. Catat nomornya (mis. COM5).
              </li>
            </ol>
            <p className="text-xs text-slate-500">
              Printer tidak perlu &quot;tersambung terus&quot;: lampunya boleh berkedip. Setiap kali
              struk dicetak, aplikasi membuka port itu, printer tersambung sendiri dalam 1–5 detik,
              lalu terputus lagi. Pilihan port diingat peramban, jadi Langkah 2 cukup sekali.
              Printer kabel USB: colokkan dan nyalakan; bila di <i>Device Manager</i> ›{' '}
              <i>Ports (COM &amp; LPT)</i> tidak muncul port untuknya, pasang driver{' '}
              <i>USB virtual COM</i> dari pembuat printer, atau pakai jendela cetak. Printer yang
              hanya Bluetooth Low Energy (tidak bisa dibuatkan port COM di langkah 5) tidak bisa
              dipakai untuk cetak langsung.
            </p>
          </Lipatan>
        </Langkah>

        <Langkah no={2} judul="Pilih printer di peramban" selesai={terpilih}>
          <p className="text-sm text-slate-600">
            Tekan tombol di bawah. Peramban menampilkan jendela kecil berisi daftar port. Daftar itu
            memuat <b>semua</b> perangkat serial di komputer, bukan hanya printer, jadi pilih dengan
            petunjuk berikut. Klik satu baris, lalu tekan <b>Hubungkan</b> (Connect).
          </p>
          <Lipatan judul="Baris mana yang harus dipilih?" terbuka={!terpilih}>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Pilih</b> baris bernama <i>Standard Serial over Bluetooth link (COM…)</i> dengan
                nomor COM dari Langkah 1, atau baris bernama <i>SPP slave</i>, <i>Spp1</i>,{' '}
                <i>SerialPort</i>, atau nama printernya. Itu sambungan serial printer Bluetooth.
              </li>
              <li>
                <b>Jangan pilih</b> <i>EM7455</i> atau nama lain yang berbau modem/WWAN: itu modem
                seluler bawaan laptop. Aplikasi akan memperingatkan bila ini yang terpilih.
              </li>
              <li>
                <b>Jangan pilih</b> <i>Bluetooth Peripheral Device</i>: itu port &quot;masuk&quot;
                yang dibuat Windows; tidak bisa dipakai mencetak.
              </li>
              <li>
                Ada dua baris yang mungkin (mis. <i>SPP slave</i> dan <i>Spp1</i>)? Pilih salah
                satu, lanjut ke Langkah 4 (Uji cetak). Bila kertas tidak keluar, kembali ke sini dan
                pilih yang satunya.
              </li>
            </ul>
            <p>
              <b>Cara pasti mengetahui barisnya:</b> buka <b>Setelan</b> Windows ›{' '}
              <b>Bluetooth &amp; perangkat</b> › <b>Perangkat</b> › gulir ke bawah, klik{' '}
              <b>Setelan Bluetooth lainnya</b> (More Bluetooth settings) › tab <b>Port COM</b>. Cari
              baris yang arahnya <b>Keluar</b> (Outgoing) dan namanya memuat nama printer, mis.{' '}
              <code>RPP02 &apos;SPP slave&apos;</code>. Teks di dalam tanda kutip itulah nama baris
              yang dipilih di daftar peramban.
            </p>
            <p className="text-xs text-slate-500">
              Daftarnya kosong atau printer tidak ada? Printer belum dipasangkan atau Bluetooth
              komputer mati: ulangi Langkah 1, lalu tekan tombol di bawah lagi.
            </p>
          </Lipatan>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="min-w-48 flex-1">
              <p className="text-sm font-medium">Terpilih sekarang</p>
              <p className="text-muted-foreground text-sm" data-testid="printer-terpilih">
                {namaPort(p.info)}
              </p>
            </div>
            <Button variant={p.info ? 'outline' : 'default'} disabled={!dukung} onClick={pilih}>
              {p.info ? 'Pilih printer lain…' : 'Pilih printer…'}
            </Button>
          </div>
          {peringatan && (
            <KotakHasil berhasil={false}>
              <p>
                <b>Salah pilih.</b> {peringatan}
              </p>
            </KotakHasil>
          )}
          {galatPilih && (
            <KotakHasil berhasil={false}>
              <p>{galatPilih}</p>
            </KotakHasil>
          )}
          {terpilih && (
            <p className="text-xs text-slate-500">
              Peramban tidak memberi tahu nama atau nomor COM port yang dipilih, jadi kepastiannya
              didapat dari Uji cetak di Langkah 4.
            </p>
          )}
        </Langkah>

        <Langkah
          no={3}
          judul="Tentukan lebar kertas printer ini"
          selesai={p.lebarKarakter !== null}
        >
          <div className="max-w-md space-y-1">
            <Label htmlFor="lebar-karakter">Lebar kertas / karakter per baris</Label>
            <Select
              value={p.lebarKarakter === null ? IKUT_TOKO : String(p.lebarKarakter)}
              onValueChange={(v) => {
                setHasil(null);
                ubah({ lebarKarakter: v === IKUT_TOKO ? null : Number(v) });
              }}
            >
              <SelectTrigger id="lebar-karakter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={IKUT_TOKO}>
                  Belum dipilih (ikut pengaturan toko: {toko?.lebarStrukMm ?? 58} mm = {lebarToko}{' '}
                  karakter)
                </SelectItem>
                {PILIHAN_LEBAR.map(([n, label]) => (
                  <SelectItem key={n} value={String(n)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-slate-500">
            Ukur lebar gulungan kertas dengan penggaris. Printer kecil genggam (EPPOS RPP02 dan
            sejenisnya) memakai kertas <b>58 mm</b>: pilih 32 karakter. Printer meja besar biasanya
            80 mm: pilih 48. Pilihan ini hanya untuk komputer ini; &quot;Lebar kertas struk&quot; di
            kartu Struk penjualan di atas dipakai saat mencetak lewat jendela cetak, samakan juga.
          </p>
        </Langkah>

        <Langkah no={4} judul="Uji cetak" selesai={p.teruji}>
          <p className="text-sm text-slate-600">
            Tekan tombol di bawah, lalu lihat printer. Sambungan Bluetooth dibuat saat mencetak,
            jadi cetakan pertama bisa menunggu 3–10 detik.
          </p>
          <Button disabled={!dukung || !toko || sibuk || p.info === null} onClick={ujiCetak}>
            <Printer /> {sibuk ? 'Mengirim ke printer…' : 'Uji cetak'}
          </Button>
          {p.info === null && dukung && (
            <p className="text-xs text-amber-700">Pilih printer dulu di Langkah 2.</p>
          )}
          {uji?.terkirim === false && (
            <KotakHasil berhasil={false}>
              <p>
                <b>Uji cetak tidak terkirim.</b> {uji.pesan}
              </p>
              <p>
                Bila printer sudah menyala dan dekat tetapi tetap begini, kemungkinan yang dipilih
                di Langkah 2 bukan printernya: tekan &quot;Pilih printer lain…&quot; dan pilih baris
                lain.
              </p>
            </KotakHasil>
          )}
          {uji?.terkirim === true && (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-slate-800">
                Data uji sudah dikirim. Apa yang keluar dari printer?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setUji(null);
                    setHasil(null);
                    ubah({ teruji: true, langsung: true });
                    toast.success('Printer siap. Cetak langsung dinyalakan.');
                  }}
                >
                  Tercetak dan terbaca jelas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setHasil('KOSONG');
                    // Belum terbukti port ini printernya.
                    ubah({ teruji: false });
                  }}
                >
                  Tidak keluar apa-apa
                </Button>
                <Button size="sm" variant="outline" onClick={() => setHasil('ACAK')}>
                  Keluar huruf acak
                </Button>
                <Button size="sm" variant="outline" onClick={() => setHasil('LEBAR')}>
                  Baris angka turun / ada ruang kosong
                </Button>
                <Button size="sm" variant="outline" onClick={() => setHasil('PUDAR')}>
                  Tercetak tetapi pudar
                </Button>
              </div>
            </div>
          )}
          {hasil && (
            <KotakHasil berhasil={false}>
              <p className="font-medium">{SARAN[hasil].judul}</p>
              <ol className="list-decimal space-y-1 pl-5">
                {SARAN[hasil].butir.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ol>
            </KotakHasil>
          )}
          {p.teruji && uji === null && hasil === null && (
            <KotakHasil berhasil>
              <p>
                Uji cetak sudah dipastikan keluar dari printer ini ({lebarKini} karakter per baris).
              </p>
            </KotakHasil>
          )}
        </Langkah>

        <Langkah no={5} judul="Nyalakan cetak langsung" selesai={p.langsung && dukung}>
          <Saklar
            label="Cetak struk langsung ke printer thermal"
            ket="Nyala = struk keluar seketika tanpa jendela cetak. Mati = struk dicetak lewat jendela cetak peramban."
            nilai={p.langsung && dukung}
            nonaktif={!dukung}
            onUbah={(v) => ubah({ langsung: v })}
          />
          <p className="text-xs text-slate-500">
            Kapan struk dicetak (langsung setelah bayar, ditanya dulu, atau tidak dicetak) diatur di{' '}
            <b>Cetak struk setelah bayar</b> pada kartu Struk penjualan di atas. Agar keluar sendiri
            tanpa ditanya, pilih <b>Langsung cetak</b> di sana lalu tekan Simpan. Bila suatu saat
            printer mati atau di luar jangkauan, penjualan tetap tersimpan; kasir diberi tahu dan
            bisa mencetak ulang dari layar hasil atau lewat jendela cetak.
          </p>
        </Langkah>

        <div className="space-y-2 rounded-lg border p-3" data-testid="logo-struk">
          <p className="text-sm font-medium">Logo di struk</p>
          {!toko?.logo ? (
            <p className="text-sm text-slate-600">
              Belum ada logo toko. Unggah di Pengaturan › <b>Profil toko</b> › Logo, lalu nyalakan{' '}
              <b>Kop struk memakai logo toko</b> di kartu Struk penjualan di atas.
            </p>
          ) : !urlLogo ? (
            <p className="text-sm text-slate-600">
              Logo tidak dicetak. Untuk mencetaknya, nyalakan <b>Kop struk memakai logo toko</b> di
              kartu Struk penjualan di atas lalu tekan Simpan.
            </p>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex min-h-16 w-48 shrink-0 items-center justify-center rounded border bg-white p-2">
                {pratinjauLogo?.gambar ? (
                  <img
                    src={pratinjauLogo.gambar}
                    alt="Pratinjau logo struk"
                    className="max-h-24 [image-rendering:pixelated]"
                  />
                ) : (
                  <span className="text-xs text-slate-500">
                    {pratinjauLogo ? 'Logo gagal dimuat' : 'Menyiapkan…'}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600">
                Beginilah logo tercetak: hitam-putih, warna dan abu-abu menjadi pola titik. Logo
                berwarna gelap di atas latar putih hasilnya paling jelas. Logo dicetak di atas
                setiap struk dan di uji cetak; cetak sedikit lebih lama.
              </p>
            </div>
          )}
        </div>

        <Lipatan judul="Pengaturan lanjutan (kepekatan, pemotong, laci kas, kecepatan port)">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 rounded-lg border p-3">
              <Label htmlFor="kepekatan-printer">Kepekatan cetak</Label>
              <Select
                value={p.kepekatan}
                onValueChange={(v) => ubah({ kepekatan: v as KepekatanStruk })}
              >
                <SelectTrigger id="kepekatan-printer" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEPEKATAN_STRUK.map((k) => (
                    <SelectItem key={k} value={k}>
                      {LABEL_KEPEKATAN_STRUK[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Normal = apa adanya. Tebal = tiap titik dicetak dua kali dan semua huruf tebal.
                Paling tebal = Tebal ditambah pemanasan kepala cetak lebih lama (dikenali banyak
                printer murah; printer lain mengabaikannya). Makin tebal makin lambat dan boros
                baterai. Bila tetap pudar: isi baterai, ganti kertas, bersihkan kepala cetak.
              </p>
            </div>
            <Saklar
              label="Potong kertas otomatis"
              ket="Printer tanpa pemotong (termasuk RPP02) mengabaikannya; sobek di gerigi."
              nilai={p.potong}
              onUbah={(v) => ubah({ potong: v })}
            />
            <Saklar
              label="Buka laci kas"
              ket="Laci uang elektronik yang dicolokkan ke printer struk (kabel RJ11 di belakang printer) terbuka sendiri saat struk penjualan tunai dicetak. Printer genggam seperti RPP02 tidak punya colokan laci: biarkan mati."
              nilai={p.bukaLaci}
              onUbah={(v) => ubah({ bukaLaci: v })}
            />
            <div className="space-y-1 rounded-lg border p-3">
              <Label htmlFor="baud-printer">Kecepatan port (baud)</Label>
              <Select value={String(p.baud)} onValueChange={(v) => ubah({ baud: Number(v) })}>
                <SelectTrigger id="baud-printer" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILIHAN_BAUD.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Biarkan 9600 untuk printer Bluetooth (tidak berpengaruh). Hanya diubah untuk printer
                kabel bila uji cetak keluar huruf acak.
              </p>
            </div>
          </div>
        </Lipatan>

        <Lipatan judul="Bila bermasalah di kemudian hari">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>&quot;Struk tidak tercetak: printer tidak menjawab&quot;</b>: printer mati, baterai
              habis, atau terlalu jauh. Nyalakan/dekatkan, lalu tekan Cetak ulang di layar hasil
              penjualan.
            </li>
            <li>
              <b>&quot;Port printer tidak bisa dibuka&quot;</b>: port sedang dipakai program lain.
              Tutup aplikasi printer bawaan dan batalkan antrean cetak Windows untuk printer itu,
              matikan lalu nyalakan printer, coba lagi.
            </li>
            <li>
              <b>Kemarin bisa, hari ini tidak keluar apa-apa</b>: nyalakan printer lebih dulu, lalu
              ulangi Langkah 2 (Pilih printer lain…) dan Langkah 4. Ini juga perlu setelah printer
              dihapus dan dipasangkan ulang di Windows, atau setelah data peramban dibersihkan.
            </li>
            <li>
              <b>Struk berhenti di tengah</b>: baterai printer lemah; isi daya.
            </li>
            <li>
              <b>Memakai jendela cetak (cetak langsung dimatikan)</b>: di jendela cetak pilih Tujuan
              = printer struk (mis. POS58 Printer), Margin = Tidak ada, Skala = 100, dan hilangkan
              centang &quot;Header dan footer&quot;. Bila hasilnya menyamping, buka Preferensi
              pencetakan printer itu di Windows dan pilih ukuran kertas 58 mm dengan orientasi
              Potret.
            </li>
            <li>
              Panduan lengkap ada di berkas <code>docs/panduan/printer-struk.md</code>.
            </li>
          </ul>
        </Lipatan>
      </div>
    </Card>
  );
}
