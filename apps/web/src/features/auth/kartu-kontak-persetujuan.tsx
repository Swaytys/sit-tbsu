import type { TautanTelegram } from '@sit/shared';
import { CheckCircle2, Mail, Send } from 'lucide-react';
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

/**
 * Kontak pengguna untuk menerima kode persetujuan sekali pakai (K-102). Ditampilkan untuk Admin/Owner di
 * halaman Akun saya. Telegram dihubungkan pemilik akun sendiri: buka tautan bot toko, tekan Start, lalu
 * "Periksa"; dengan begitu chat orang lain tidak bisa ditempelkan ke akun ini.
 */
export function KartuKontakPersetujuan() {
  const kontak = useKontakSaya();
  if (!kontak.data) return <Skeleton className="h-56 w-full" />;
  // Dibuat ulang saat email tersimpan berubah, supaya isian mengikuti data terbaru.
  return <Isi key={kontak.data.email ?? ''} k={kontak.data} />;
}

function Isi({ k }: { k: NonNullable<ReturnType<typeof useKontakSaya>['data']> }) {
  const simpan = useUbahKontakSaya();
  const buatTautan = useTautanTelegram();
  const periksa = usePeriksaTelegram();
  const putus = usePutusTelegram();
  const [email, setEmail] = useState(k.email ?? '');
  const [tautan, setTautan] = useState<TautanTelegram | null>(null);
  const galat = (err: unknown) => toast.error(pesanGalat(err));

  return (
    <Card className="gap-4 p-6">
      <div>
        <h2 className="font-semibold text-slate-900">Penerima kode persetujuan</h2>
        <p className="text-sm text-slate-500">
          Saat kasir meminta persetujuan (retur, void, melewati limit kredit), sistem mengirim kode
          sekali pakai beserta rinciannya ke kontak di bawah. Sebutkan kode itu ke kasir hanya bila
          Anda setuju. Password Anda tidak pernah diminta di komputer kasir.
        </p>
      </div>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          simpan
            .mutateAsync({ email: email.trim() || null })
            .then(() => toast.success('Email penerima kode disimpan.'))
            .catch(galat);
        }}
      >
        <Label htmlFor="email-kode" className="flex items-center gap-1.5">
          <Mail className="size-4 text-slate-500" /> Email
        </Label>
        <div className="flex gap-2">
          <Input
            id="email-kode"
            type="email"
            value={email}
            maxLength={120}
            placeholder="nama@contoh.com"
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
        {!k.emailTersedia && (
          <p className="text-xs text-amber-700">
            Toko belum mengatur akun email pengirim (Pengaturan › Persetujuan), jadi email belum
            dipakai.
          </p>
        )}
      </form>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Send className="size-4 text-slate-500" /> Telegram
        </Label>
        {k.telegramTerhubung ? (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-emerald-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="size-4" /> Terhubung dengan bot toko
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={putus.isPending}
              onClick={() =>
                void putus
                  .mutateAsync(undefined)
                  .then(() => toast.success('Telegram diputus.'))
                  .catch(galat)
              }
            >
              Putuskan
            </Button>
          </div>
        ) : !k.telegramTersedia ? (
          <p className="text-xs text-amber-700">
            Bot Telegram toko belum diatur (Pengaturan › Persetujuan).
          </p>
        ) : tautan === null ? (
          <Button
            variant="outline"
            disabled={buatTautan.isPending}
            onClick={() => void buatTautan.mutateAsync().then(setTautan).catch(galat)}
          >
            Hubungkan Telegram
          </Button>
        ) : (
          <ol className="list-decimal space-y-1.5 rounded-md border bg-slate-50 p-3 pl-7 text-sm">
            <li>
              Buka{' '}
              <a
                href={tautan.tautan}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 underline"
              >
                bot {tautan.bot}
              </a>{' '}
              di Telegram (HP atau komputer Anda), lalu tekan <b>Start</b>.
            </li>
            <li>
              Bila tombol Start tidak muncul, kirim pesan ini ke bot:{' '}
              <code className="rounded bg-white px-1 font-mono">{tautan.perintah}</code>
            </li>
            <li>
              Kembali ke sini dan tekan{' '}
              <Button
                size="sm"
                disabled={periksa.isPending}
                onClick={() =>
                  void periksa
                    .mutateAsync(undefined)
                    .then(() => {
                      setTautan(null);
                      toast.success('Telegram terhubung. Cek pesan sambutan di Telegram Anda.');
                    })
                    .catch(galat)
                }
              >
                {periksa.isPending ? 'Memeriksa…' : 'Periksa'}
              </Button>
            </li>
          </ol>
        )}
      </div>
    </Card>
  );
}
