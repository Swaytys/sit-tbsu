import { CheckCircle2, Copy, Loader2, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useAksesPerangkat, usePeriksaAkses } from '@/api/data';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KartuLan } from './kartu-lan';

/*
 * K-217: Pengaturan › Akses HP/tablet. HP dan tablet membuka BonsaiUrip lewat alamat Tailscale HTTPS laptop ini
 * (di dalam toko lewat WiFi maupun dari luar). Halaman ini menampilkan status, alamat + kode QR, dan langkah
 * pemasangan satu kali.
 */

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-slate-400" />
      )}
      <span className={ok ? 'text-slate-800' : 'text-slate-500'}>{children}</span>
    </li>
  );
}

export function KodeQr({ alamat }: { alamat: string }) {
  const [gambar, setGambar] = useState<string | null>(null);
  useEffect(() => {
    let aktif = true;
    void QRCode.toDataURL(alamat, { margin: 1, width: 220 }).then((url) => {
      if (aktif) setGambar(url);
    });
    return () => {
      aktif = false;
    };
  }, [alamat]);
  return gambar ? (
    <img src={gambar} alt={`Kode QR ${alamat}`} className="size-44 rounded border bg-white p-1" />
  ) : (
    <Skeleton className="size-44" />
  );
}

export function TabAkses() {
  const akses = useAksesPerangkat();
  const periksa = usePeriksaAkses();
  const s = akses.data;
  const jalankan = (nyalakan: boolean) =>
    void periksa
      .mutateAsync(nyalakan)
      .then((h) => (h.serveAktif ? toast.success(h.pesan) : toast.info(h.pesan)))
      .catch((err: unknown) => toast.error(pesanGalat(err)));

  return (
    <div className="space-y-4">
      <KartuLan />
      <Card className="gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Smartphone className="size-5 text-blue-600" />
          <h2 className="flex-1 font-semibold text-slate-800">
            Cara 2 · Tailscale (di toko dan dari luar toko; berbayar untuk usaha)
          </h2>
          <Button
            size="sm"
            variant="outline"
            disabled={periksa.isPending}
            onClick={() => jalankan(false)}
          >
            <RefreshCw /> Periksa lagi
          </Button>
          <Button
            size="sm"
            disabled={periksa.isPending || !s?.tersambung}
            onClick={() => jalankan(true)}
          >
            {periksa.isPending ? <Loader2 className="animate-spin" /> : null} Aktifkan
          </Button>
        </div>
        {!s ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="flex flex-wrap gap-6">
            <ul className="min-w-64 flex-1 space-y-1 text-sm">
              <Status ok={s.tailscaleTerpasang}>Tailscale terpasang di laptop ini</Status>
              <Status ok={s.tersambung}>Tailscale menyala dan sudah masuk (login)</Status>
              <Status ok={s.httpsAktif}>Sertifikat HTTPS Tailscale aktif</Status>
              <Status ok={s.serveAktif}>BonsaiUrip dibagikan ke HP/tablet (tailscale serve)</Status>
              <li className="pt-2 text-slate-700">{s.pesan}</li>
              {s.alamat && (
                <li className="pt-2">
                  <span className="text-xs text-slate-500">Alamat untuk HP/tablet</span>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-slate-100 px-2 py-1 text-sm">{s.alamat}</code>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Salin alamat"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(s.alamat ?? '')
                          .then(() => toast.success('Alamat disalin.'))
                      }
                    >
                      <Copy />
                    </Button>
                  </div>
                </li>
              )}
            </ul>
            {s.alamat && s.serveAktif && (
              <div className="text-center text-xs text-slate-500">
                <KodeQr alamat={s.alamat} />
                Pindai dengan kamera HP
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="gap-3 p-5 text-sm text-slate-700">
        <p className="text-xs text-slate-500">
          Langkah Tailscale (cara 2). Paket gratis Tailscale hanya untuk pemakaian non-usaha; untuk
          toko pakai paket Standard. Di dalam toko cukup memakai cara 1.
        </p>
        <h3 className="font-semibold text-slate-800">
          A. Sekali saja di laptop toko (Owner, ± 10 menit)
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Buka <b>tailscale.com/download</b> di laptop ini, unduh Tailscale untuk Windows, lalu
            pasang (Windows meminta izin Administrator: pilih <b>Ya</b>).
          </li>
          <li>
            Ikon Tailscale muncul di pojok kanan bawah. Klik, pilih <b>Log in</b>, masuk dengan akun
            Google/Microsoft milik toko. Akun yang sama dipakai di setiap HP/tablet.
          </li>
          <li>
            Di peramban buka <b>login.tailscale.com</b>, menu <b>DNS</b>: pastikan <b>MagicDNS</b>{' '}
            aktif, lalu di bagian <b>HTTPS Certificates</b> klik <b>Enable HTTPS</b>.
          </li>
          <li>
            Kembali ke halaman ini: <b>Periksa lagi</b>, lalu <b>Aktifkan</b>. Keempat tanda menjadi
            hijau; alamat https://…ts.net dan kode QR tampil. Setelah itu BonsaiUrip mengaktifkannya
            sendiri setiap kali menyala.
          </li>
          <li>
            Laptop harus menyala (dan BonsaiUrip berjalan) agar HP/tablet bisa memakai aplikasi.
          </li>
        </ol>
        <h3 className="pt-2 font-semibold text-slate-800">
          B. Di setiap HP/tablet (± 5 menit per perangkat)
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Pasang aplikasi <b>Tailscale</b> dari Play Store / App Store, buka, masuk dengan{' '}
            <b>akun toko yang sama</b> seperti di laptop, izinkan VPN bila ditanya.
          </li>
          <li>
            Pindai kode QR di atas dengan kamera (atau ketik alamatnya): terbuka di Chrome (Android)
            atau Safari (iPhone/iPad).
          </li>
          <li>
            Pasang sebagai aplikasi. <b>Android</b>: Chrome › menu ⋮ ›{' '}
            <b>Tambahkan ke layar utama</b> / <b>Instal aplikasi</b>. <b>iPhone/iPad</b>: Safari ›
            tombol Bagikan › <b>Tambahkan ke Layar Utama</b>. Ikon BonsaiUrip muncul seperti
            aplikasi biasa.
          </li>
          <li>Masuk dengan akun pengguna masing-masing. Jangan memakai akun orang lain.</li>
          <li>
            Tailscale di HP cukup dibiarkan menyala. Di WiFi toko, HP tersambung langsung ke laptop;
            di luar toko, lewat internet terenkripsi.
          </li>
        </ol>
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          Keamanan: hanya perangkat yang masuk ke akun Tailscale toko yang bisa membuka alamat ini.
          Bila HP hilang atau karyawan keluar: hapus perangkatnya di login.tailscale.com › Machines,
          dan nonaktifkan akun BonsaiUrip-nya.
        </p>
      </Card>
    </div>
  );
}
