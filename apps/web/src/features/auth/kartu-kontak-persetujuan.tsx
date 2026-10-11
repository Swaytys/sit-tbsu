import type { KontakSaya, TautanTelegram } from '@sit/shared';
import { CheckCircle2, Copy, Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import {
  useKontakSaya,
  usePeriksaTelegram,
  usePutusTelegram,
  useTautanTelegram,
  useUbahKontakSaya,
} from '@/api/saluran';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const galat = (err: unknown) => toast.error(pesanGalat(err));

/** Alamat email tempat pengguna ini menerima kode persetujuan. */
export function IsianEmailSaya({ k }: { k: KontakSaya }) {
  const simpan = useUbahKontakSaya();
  const [email, setEmail] = useState(k.email ?? '');
  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        simpan
          .mutateAsync({ email: email.trim() || null })
          .then(() =>
            toast.success(
              email.trim() ? 'Alamat email Anda disimpan.' : 'Alamat email dikosongkan.',
            ),
          )
          .catch(galat);
      }}
    >
      <Label htmlFor="email-kode">Alamat email Anda (tempat kode diterima)</Label>
      <div className="flex gap-2">
        <Input
          id="email-kode"
          type="email"
          value={email}
          maxLength={120}
          placeholder="nama@gmail.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={simpan.isPending || email.trim() === (k.email ?? '')}
        >
          Simpan
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Pakai alamat yang Anda buka di HP, supaya kode cepat terbaca. Boleh sama dengan alamat
        pengirim toko.
      </p>
    </form>
  );
}

/**
 * Menghubungkan Telegram pengguna yang sedang login dengan bot toko. Telegram melarang bot mengirim pesan
 * kepada orang yang belum pernah menekan Start pada bot itu, jadi langkah ini wajib dikerjakan sekali oleh
 * tiap Admin/Owner dengan akunnya sendiri. Kode tautan hanya tampil untuk pemilik akun yang login, sehingga
 * Telegram orang lain tidak bisa ditempelkan ke akun ini.
 */
export function HubungkanTelegramSaya({ k }: { k: KontakSaya }) {
  const buatTautan = useTautanTelegram();
  const periksa = usePeriksaTelegram();
  const putus = usePutusTelegram();
  const [tautan, setTautan] = useState<TautanTelegram | null>(null);

  if (k.telegramTerhubung) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-emerald-50 px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5 text-emerald-800">
          <CheckCircle2 className="size-4" /> Telegram Anda sudah terhubung dengan bot toko.
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={putus.isPending}
          onClick={() =>
            void putus
              .mutateAsync(undefined)
              .then(() => toast.success('Telegram diputus dari akun Anda.'))
              .catch(galat)
          }
        >
          Putuskan
        </Button>
      </div>
    );
  }
  if (!k.telegramTersedia) {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
        Bot Telegram toko belum diatur. Owner/Admin mengisinya dulu di Pengaturan › Persetujuan
        (Telegram, Langkah 1).
      </p>
    );
  }
  if (tautan === null) {
    return (
      <div className="space-y-1.5">
        <Button
          variant="outline"
          disabled={buatTautan.isPending}
          onClick={() => void buatTautan.mutateAsync().then(setTautan).catch(galat)}
        >
          <Send /> {buatTautan.isPending ? 'Menyiapkan…' : 'Hubungkan Telegram saya'}
        </Button>
        <p className="text-xs text-slate-500">
          Butuh ±1 menit dan aplikasi Telegram di HP atau komputer Anda.
        </p>
      </div>
    );
  }
  const kode = tautan.perintah.replace('/start ', '');
  return (
    <div className="space-y-2 rounded-md border bg-slate-50 p-3 text-sm">
      <p className="font-medium">Ikuti empat langkah ini (kode berlaku 10 menit):</p>
      <ol className="list-[lower-alpha] space-y-2 pl-5">
        <li>
          Buka bot toko di Telegram: klik{' '}
          <a
            href={tautan.tautan}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-blue-700 underline"
          >
            buka {tautan.bot}
          </a>
          . Bila Telegram Anda ada di HP, buka Telegram di HP lalu ketik <b>{tautan.bot}</b> di
          kolom pencarian dan pilih bot itu.
        </li>
        <li>
          Di layar percakapan bot, tekan tombol <b>Start</b> / <b>Mulai</b> di bagian bawah. Lalu
          kirim kode ini sebagai pesan biasa ke bot (ketik atau tempel, lalu kirim):
          <span className="mt-1 flex items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-base font-bold tracking-widest">
              {kode}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(kode)
                  .then(() => toast.success('Kode disalin.'))
                  .catch(() => toast.error('Tidak bisa menyalin; ketik kodenya manual.'))
              }
            >
              <Copy /> Salin kode
            </Button>
          </span>
        </li>
        <li>Tunggu sekitar 5 detik sampai pesan Anda terkirim (centang muncul di Telegram).</li>
        <li>
          Kembali ke halaman ini dan tekan{' '}
          <Button
            size="sm"
            disabled={periksa.isPending}
            onClick={() =>
              void periksa
                .mutateAsync(undefined)
                .then(() => {
                  setTautan(null);
                  toast.success(
                    'Telegram terhubung. Bot mengirim pesan sambutan ke Telegram Anda.',
                  );
                })
                .catch(galat)
            }
          >
            {periksa.isPending ? 'Memeriksa…' : 'Periksa'}
          </Button>
        </li>
      </ol>
      <p className="text-xs text-slate-500">
        Gagal? Pastikan kode dikirim ke bot yang benar ({tautan.bot}) dari akun Telegram Anda
        sendiri, lalu tekan Periksa lagi. Kode kadaluarsa: tekan{' '}
        <button
          type="button"
          className="font-medium text-blue-700 underline"
          onClick={() => void buatTautan.mutateAsync().then(setTautan).catch(galat)}
        >
          buat kode baru
        </button>
        .
      </p>
    </div>
  );
}

/**
 * Kontak pengguna untuk menerima kode persetujuan sekali pakai (K-102), di halaman Akun saya. Ditampilkan
 * untuk Admin/Owner.
 */
export function KartuKontakPersetujuan() {
  const kontak = useKontakSaya();
  if (!kontak.data) return <Skeleton className="h-56 w-full" />;
  const k = kontak.data;
  return (
    <Card className="gap-4 p-6">
      <div>
        <h2 className="font-semibold text-slate-900">Penerima kode persetujuan</h2>
        <p className="text-sm text-slate-500">
          Saat kasir meminta persetujuan (retur, void, melewati limit kredit), sistem mengirim kode
          sekali pakai beserta rinciannya ke Telegram dan/atau email Anda. Sebutkan kode itu ke
          kasir hanya bila Anda setuju. Password Anda tidak pernah diminta di komputer kasir.
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Send className="size-4 text-slate-500" /> Telegram
        </p>
        <HubungkanTelegramSaya k={k} />
      </div>
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Mail className="size-4 text-slate-500" /> Email
        </p>
        {/* Dibuat ulang saat email tersimpan berubah, supaya isian mengikuti data terbaru. */}
        <IsianEmailSaya key={k.email ?? ''} k={k} />
        {!k.emailTersedia && (
          <p className="text-xs text-amber-700">
            Toko belum mengatur akun email pengirim (Pengaturan › Persetujuan › Email), jadi email
            belum dipakai.
          </p>
        )}
      </div>
    </Card>
  );
}
