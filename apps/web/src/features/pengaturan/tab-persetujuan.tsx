import {
  skemaPengaturanSaluran,
  type HasilUjiSaluran,
  type KontakSaya,
  type PengaturanSaluran,
  type SaluranPesan,
} from '@sit/shared';
import { Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import {
  useKontakSaya,
  usePengaturanSaluran,
  useUbahPengaturanSaluran,
  useUjiSaluran,
} from '@/api/saluran';
import { KotakHasil, Langkah } from '@/components/langkah';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { HubungkanTelegramSaya, IsianEmailSaya } from '../auth/kartu-kontak-persetujuan';

const LABEL_SALURAN = { TELEGRAM: 'Telegram', EMAIL: 'Email' } as const;

/** Hasil uji kirim satu saluran. */
function HasilUji({ h }: { h: HasilUjiSaluran | null }) {
  if (!h) return null;
  return (
    <KotakHasil berhasil={h.berhasil}>
      <p>
        <b>{h.berhasil ? 'Berhasil. ' : 'Belum berhasil. '}</b>
        {h.pesan}
      </p>
    </KotakHasil>
  );
}

/**
 * Pengaturan › Persetujuan (K-102, K-105): saluran untuk mengirim kode persetujuan sekali pakai ke
 * Admin/Owner. Tiap saluran disiapkan dalam tiga langkah berurutan (akun toko, kontak Anda, uji kirim);
 * uji kirim selalu pengiriman sungguhan dan menyebut apa yang kurang. Token bot dan sandi email hanya bisa
 * diisi/diganti; nilainya tidak pernah ditampilkan kembali.
 */
export function TabPersetujuan() {
  const toko = usePengaturanSaluran();
  const saya = useKontakSaya();
  if (!toko.data || !saya.data) return <Skeleton className="h-72 w-full" />;
  return <Isi key={JSON.stringify(toko.data.email)} p={toko.data} k={saya.data} />;
}

function Isi({ p, k }: { p: PengaturanSaluran; k: KontakSaya }) {
  const saya = usePengguna();
  const simpan = useUbahPengaturanSaluran();
  const uji = useUjiSaluran();
  const [token, setToken] = useState('');
  const [host, setHost] = useState(p.email.host || 'smtp.gmail.com');
  const [port, setPort] = useState(String(p.email.port));
  const [smtpPengguna, setSmtpPengguna] = useState(p.email.pengguna);
  const [sandi, setSandi] = useState('');
  const [pengirim, setPengirim] = useState(p.email.pengirim);
  const [hasil, setHasil] = useState<Record<SaluranPesan, HasilUjiSaluran | null>>({
    TELEGRAM: null,
    EMAIL: null,
  });

  // Tiap tombol simpan hanya menyentuh salurannya sendiri: isian email yang belum disimpan tidak ikut
  // tersimpan saat token bot disimpan, dan sebaliknya.
  function kirim(bagian: SaluranPesan, hapusTelegram = false) {
    const email = bagian === 'EMAIL';
    const isi = skemaPengaturanSaluran.safeParse({
      telegramToken: email ? undefined : token || undefined,
      hapusTelegram,
      smtpHost: email ? host : p.email.host,
      smtpPort: email ? port || '465' : p.email.port,
      smtpPengguna: email ? smtpPengguna : p.email.pengguna,
      smtpSandi: email ? sandi || undefined : undefined,
      emailPengirim: email ? pengirim : p.email.pengirim,
    });
    if (!isi.success) {
      toast.error(isi.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    simpan
      .mutateAsync(isi.data)
      .then(() => {
        if (email) setSandi('');
        else setToken('');
        toast.success(
          email
            ? 'Akun email pengirim disimpan. Lanjut ke Langkah 2.'
            : hapusTelegram
              ? 'Token bot dihapus.'
              : 'Token bot disimpan. Lanjut ke Langkah 2.',
        );
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  function ujiKirim(saluran: SaluranPesan) {
    setHasil((h) => ({ ...h, [saluran]: null }));
    uji
      .mutateAsync(saluran)
      .then((h) => setHasil((x) => ({ ...x, [saluran]: h })))
      .catch((err: unknown) =>
        setHasil((x) => ({
          ...x,
          [saluran]: { saluran, berhasil: false, pesan: pesanGalat(err) },
        })),
      );
  }

  const emailBerubah =
    sandi !== '' ||
    host !== p.email.host ||
    port !== String(p.email.port) ||
    smtpPengguna !== p.email.pengguna ||
    pengirim !== p.email.pengirim;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 text-sm text-slate-600">
          <p>
            Retur, void, dan penjualan yang melewati limit kredit oleh Kasir butuh persetujuan Admin
            atau Owner. Kasir menekan <b>Kirim kode ke atasan</b>; sistem mengirim kode sekali pakai
            beserta rinciannya ke atasan; atasan yang setuju menyebutkan kodenya ke kasir.
          </p>
          <p>
            Siapkan <b>salah satu atau kedua</b> saluran di bawah. Tiap saluran punya tiga langkah;
            kerjakan berurutan sampai ketiganya bercentang hijau. Komputer server harus tersambung
            internet. Anda sedang login sebagai <b>{saya.namaPengguna}</b>: Langkah 2 dan 3 berlaku
            untuk akun ini.
          </p>
        </div>
        <Penjelasan judul="Cara kerja kode persetujuan">
          <ButirPenjelasan>
            <li>
              <b>Yang terjadi saat kasir meminta persetujuan:</b> sistem membuat kode 6 angka yang
              berbeda untuk tiap Admin/Owner, lalu mengirimkannya lewat Telegram dan/atau email
              beserta nama kasir dan rincian permintaan (nomor dokumen, barang, nilai, alasan).
              Atasan yang setuju menyebutkan kodenya (telepon, pesan, atau langsung); kasir
              mengetiknya; persetujuan tercatat atas nama pemilik kode.
            </li>
            <li>
              <b>Kenapa ada Langkah 2 (kontak Anda):</b> kode dikirim ke <i>orang</i>, bukan ke
              toko. Sistem perlu tahu Telegram dan email tiap Admin/Owner. Untuk Telegram ada aturan
              dari Telegram sendiri: bot tidak boleh mengirim pesan kepada orang yang belum pernah
              menekan <b>Start</b> pada bot itu. Jadi mengisi token saja belum cukup; tiap atasan
              harus menghubungkan Telegram-nya sekali.
            </li>
            <li>
              <b>Atasan lain</b> (Admin/Owner selain Anda) login dengan akunnya sendiri, klik
              namanya di kanan atas, pilih <b>Akun saya</b>, lalu mengerjakan hal yang sama:
              Hubungkan Telegram saya dan/atau isi email. Daftar di bagian bawah halaman ini
              menunjukkan siapa yang sudah siap.
            </li>
            <li>
              <b>Sifat kode:</b> berlaku 10 menit, sekali pakai, hanya untuk permintaan yang
              tertulis di pesannya dan hanya untuk kasir yang memintanya; hangus setelah 5 kali
              salah ketik.
            </li>
            <li>
              <b>Bila internet mati:</b> retur/void tetap bisa diajukan dan disetujui atasan dari
              akunnya sendiri (tab Menunggu persetujuan); penjualan yang melewati limit kredit harus
              dibayar dulu.
            </li>
            <li>
              <b>Token bot dan sandi aplikasi</b> tersimpan di server dan tidak pernah ditampilkan
              lagi. Bila lupa, buat yang baru dan isi ulang.
            </li>
          </ButirPenjelasan>
        </Penjelasan>
      </div>

      {/* ---------------- Telegram ---------------- */}
      <Card className="gap-4 p-5" data-testid="saluran-telegram">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Send className="size-4 text-blue-600" /> Telegram
          </h2>
          {p.telegram.terpasang ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Bot aktif{p.telegram.bot ? ` · ${p.telegram.bot}` : ' · tidak bisa dihubungi'}
            </Badge>
          ) : (
            <Badge variant="outline">Belum diatur</Badge>
          )}
        </div>

        <Langkah no={1} judul="Buat bot toko dan isi tokennya" selesai={p.telegram.terpasang}>
          <details
            className="rounded-md border bg-slate-50 p-3 text-sm"
            open={!p.telegram.terpasang}
          >
            <summary className="cursor-pointer font-medium">
              Cara membuat bot dan mendapatkan tokennya (gratis, ±3 menit)
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
              <li>
                Buka aplikasi <b>Telegram</b> (HP atau komputer). Di kolom pencarian ketik{' '}
                <b>BotFather</b> dan pilih akun bercentang biru bernama BotFather.
              </li>
              <li>
                Tekan <b>Start</b>, lalu kirim pesan: <code>/newbot</code>
              </li>
              <li>
                BotFather menanyakan <b>nama</b> bot. Ketik nama bebas, mis.{' '}
                <i>Persetujuan Sumber Urip</i>.
              </li>
              <li>
                BotFather menanyakan <b>username</b> bot. Harus tanpa spasi dan diakhiri{' '}
                <code>bot</code>, mis. <i>sumberurip_setuju_bot</i>. Bila ditolak karena sudah
                dipakai orang lain, coba nama lain.
              </li>
              <li>
                BotFather membalas dengan <b>token</b>: deretan angka, titik dua, lalu huruf acak
                (mis. <code>1234567890:AAHk…</code>). Salin seluruhnya, dari angka pertama sampai
                huruf terakhir.
              </li>
              <li>
                Tempel di kolom di bawah, tekan <b>Simpan token</b>. Lencana di kanan atas kartu ini
                berubah menjadi <i>Bot aktif · @nama_bot</i>.
              </li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              Token = kunci bot. Siapa pun yang memegangnya bisa mengirim pesan atas nama bot, jadi
              jangan dibagikan. Bila bocor: di BotFather kirim <code>/revoke</code>, pilih botnya,
              lalu isi token barunya di sini.
            </p>
          </details>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="token-bot">
                {p.telegram.terpasang
                  ? 'Ganti token bot (kosongkan bila tidak diganti)'
                  : 'Token bot'}
              </Label>
              <Input
                id="token-bot"
                type="password"
                autoComplete="new-password"
                value={token}
                maxLength={100}
                placeholder={p.telegram.terpasang ? 'Tersimpan' : 'mis. 1234567890:AAHk…'}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <Button
              disabled={simpan.isPending || token.trim() === ''}
              onClick={() => kirim('TELEGRAM')}
            >
              Simpan token
            </Button>
          </div>
          {p.telegram.terpasang && (
            <button
              type="button"
              onClick={() => kirim('TELEGRAM', true)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Hapus token (matikan Telegram)
            </button>
          )}
        </Langkah>

        <Langkah
          no={2}
          judul={`Hubungkan Telegram ${saya.namaPengguna} ke bot`}
          selesai={k.telegramTerhubung}
        >
          <p className="text-sm text-slate-600">
            Token saja belum cukup: Telegram hanya mengizinkan bot mengirim pesan kepada orang yang
            sudah menekan <b>Start</b> pada bot itu. Langkah ini mencatat Telegram mana yang milik
            akun Anda.
          </p>
          <HubungkanTelegramSaya k={k} />
        </Langkah>

        <Langkah
          no={3}
          judul="Kirim pesan uji ke Telegram Anda"
          selesai={hasil.TELEGRAM?.berhasil === true}
        >
          <Button variant="outline" disabled={uji.isPending} onClick={() => ujiKirim('TELEGRAM')}>
            <Send /> Kirim pesan uji Telegram
          </Button>
          <HasilUji h={hasil.TELEGRAM} />
        </Langkah>
      </Card>

      {/* ---------------- Email ---------------- */}
      <Card className="gap-4 p-5" data-testid="saluran-email">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Mail className="size-4 text-blue-600" /> Email
          </h2>
          {p.email.terpasang ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Akun pengirim tersimpan
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              Belum lengkap: {p.email.kurang.join(', ')} kosong
            </Badge>
          )}
        </div>

        <Langkah no={1} judul="Isi akun email pengirim (Gmail toko)" selesai={p.email.terpasang}>
          <details className="rounded-md border bg-slate-50 p-3 text-sm" open={!p.email.terpasang}>
            <summary className="cursor-pointer font-medium">
              Cara membuat &quot;Sandi aplikasi&quot; Gmail (wajib; password Gmail biasa ditolak
              Google)
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
              <li>
                Siapkan satu akun Gmail untuk toko (akun ini yang <i>mengirim</i> kode). Login ke
                akun itu di peramban.
              </li>
              <li>
                Buka{' '}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-700 underline"
                >
                  myaccount.google.com/security
                </a>
                . Di bagian <i>Cara Anda login ke Google</i>, lihat <b>Verifikasi 2 Langkah</b>.
                Bila tertulis nonaktif: klik, tekan <b>Aktifkan</b>, lalu ikuti petunjuknya (Google
                meminta nomor HP dan mengirim kode SMS). Sandi aplikasi tidak tersedia sebelum ini
                aktif.
              </li>
              <li>
                Buka{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-700 underline"
                >
                  myaccount.google.com/apppasswords
                </a>{' '}
                (atau ketik <i>Sandi aplikasi</i> di kotak pencarian halaman Akun Google). Google
                bisa meminta password Gmail Anda sekali lagi.
              </li>
              <li>
                Di kolom <b>Nama aplikasi</b> ketik <i>BonsaiUrip</i>, lalu tekan <b>Buat</b>.
              </li>
              <li>
                Muncul kotak berisi <b>16 huruf</b> dalam empat kelompok (mis.{' '}
                <code>abcd efgh ijkl mnop</code>). Salin sekarang: sandi ini hanya tampil sekali.
              </li>
              <li>
                Isi kolom di bawah: Server <code>smtp.gmail.com</code>, Port <code>465</code>, Nama
                pengguna = alamat Gmail lengkap, Sandi aplikasi = 16 huruf tadi (dengan atau tanpa
                spasi). Tekan <b>Simpan akun email</b>.
              </li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              Halaman Sandi aplikasi menulis &quot;setelan tidak tersedia untuk akun Anda&quot;?
              Verifikasi 2 Langkah belum aktif, atau akun itu dikelola kantor/sekolah (pakai akun
              Gmail pribadi). Sandi aplikasi bisa dicabut kapan saja dari halaman yang sama.
            </p>
          </details>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="space-y-1">
              <Label htmlFor="smtp-host">Server</Label>
              <Input
                id="smtp-host"
                value={host}
                maxLength={100}
                placeholder="smtp.gmail.com"
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                inputMode="numeric"
                value={port}
                placeholder="465"
                onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="smtp-pengguna">Nama pengguna (alamat Gmail pengirim)</Label>
              <Input
                id="smtp-pengguna"
                value={smtpPengguna}
                maxLength={120}
                autoComplete="off"
                placeholder="toko@gmail.com"
                onChange={(e) => setSmtpPengguna(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-sandi">Sandi aplikasi (16 huruf)</Label>
              <Input
                id="smtp-sandi"
                type="password"
                autoComplete="new-password"
                value={sandi}
                maxLength={200}
                placeholder={
                  p.email.sandiTerisi ? 'Tersimpan (isi untuk mengganti)' : 'abcd efgh ijkl mnop'
                }
                onChange={(e) => setSandi(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="email-pengirim">Nama pengirim (opsional)</Label>
              <Input
                id="email-pengirim"
                value={pengirim}
                maxLength={150}
                placeholder="BonsaiUrip <toko@gmail.com>"
                onChange={(e) => setPengirim(e.target.value)}
              />
            </div>
            <Button disabled={simpan.isPending || !emailBerubah} onClick={() => kirim('EMAIL')}>
              Simpan akun email
            </Button>
          </div>
        </Langkah>

        <Langkah
          no={2}
          judul={`Isi alamat email ${saya.namaPengguna} (penerima kode)`}
          selesai={k.email !== null}
        >
          {/* Dibuat ulang saat email tersimpan berubah, supaya isian mengikuti data terbaru. */}
          <IsianEmailSaya key={k.email ?? ''} k={k} />
        </Langkah>

        <Langkah
          no={3}
          judul="Kirim email uji ke alamat Anda"
          selesai={hasil.EMAIL?.berhasil === true}
        >
          <Button variant="outline" disabled={uji.isPending} onClick={() => ujiKirim('EMAIL')}>
            <Mail /> Kirim email uji
          </Button>
          <HasilUji h={hasil.EMAIL} />
        </Langkah>
      </Card>

      <Card className="gap-2 p-5">
        <h2 className="font-semibold">Admin/Owner yang sudah bisa menerima kode</h2>
        <p className="text-sm text-slate-600">
          Kasir hanya bisa meminta kode bila sedikitnya satu orang di daftar ini punya saluran
          aktif. Atasan yang belum tampil perlu login dengan akunnya sendiri, klik namanya di kanan
          atas, pilih <b>Akun saya</b>, lalu menghubungkan Telegram atau mengisi email.
        </p>
        {p.penerima.length === 0 ? (
          <p className="text-sm font-medium text-amber-700">Belum ada.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {p.penerima.map((x) => (
              <li key={x.nama} className="flex items-center gap-2">
                <span className="font-medium">{x.nama}</span>
                {x.saluran.length === 0 ? (
                  <span className="text-xs text-amber-700">
                    kontaknya sudah diisi, tetapi salurannya belum diatur (Langkah 1)
                  </span>
                ) : (
                  x.saluran.map((s) => (
                    <Badge key={s} variant="outline">
                      {LABEL_SALURAN[s]}
                    </Badge>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
