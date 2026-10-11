import { skemaPengaturanSaluran, type PengaturanSaluran } from '@sit/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { usePengaturanSaluran, useUbahPengaturanSaluran, useUjiSaluran } from '@/api/saluran';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const LABEL_SALURAN = { TELEGRAM: 'Telegram', EMAIL: 'Email' } as const;

/**
 * Pengaturan › Persetujuan (K-102): saluran untuk mengirim kode persetujuan sekali pakai ke Admin/Owner.
 * Token bot dan sandi email hanya bisa diisi/diganti; nilainya tidak pernah ditampilkan kembali.
 */
export function TabPersetujuan() {
  const data = usePengaturanSaluran();
  if (!data.data) return <Skeleton className="h-72 w-full" />;
  return <Isi key={JSON.stringify(data.data.email)} p={data.data} />;
}

function Isi({ p }: { p: PengaturanSaluran }) {
  const simpan = useUbahPengaturanSaluran();
  const uji = useUjiSaluran();
  const [token, setToken] = useState('');
  const [host, setHost] = useState(p.email.host);
  const [port, setPort] = useState(String(p.email.port));
  const [pengguna, setPengguna] = useState(p.email.pengguna);
  const [sandi, setSandi] = useState('');
  const [pengirim, setPengirim] = useState(p.email.pengirim);

  function kirim(hapusTelegram = false) {
    const isi = skemaPengaturanSaluran.safeParse({
      telegramToken: token || undefined,
      hapusTelegram,
      smtpHost: host,
      smtpPort: port || '465',
      smtpPengguna: pengguna,
      smtpSandi: sandi || undefined,
      emailPengirim: pengirim,
    });
    if (!isi.success) {
      toast.error(isi.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    simpan
      .mutateAsync(isi.data)
      .then(() => {
        setToken('');
        setSandi('');
        toast.success('Pengaturan persetujuan disimpan.');
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-600">
          Retur, void, dan penjualan yang melewati limit kredit oleh Kasir butuh persetujuan Admin
          atau Owner. Kasir menekan <b>Kirim kode</b>; sistem mengirim kode sekali pakai beserta
          rinciannya ke atasan lewat saluran di bawah; atasan yang setuju menyebutkan kodenya. Butuh
          internet di komputer server.
        </p>
        <Penjelasan judul="Cara menyiapkan saluran kode">
          <ButirPenjelasan>
            <li>
              <b>Telegram</b> (gratis): di Telegram, cari <b>@BotFather</b>, kirim{' '}
              <code>/newbot</code>, beri nama (mis. &quot;Persetujuan Toko&quot;), lalu salin{' '}
              <b>token</b> yang diberikan ke kolom Token bot. Setelah itu tiap Admin/Owner membuka{' '}
              <b>Akun saya</b> dan menekan <b>Hubungkan Telegram</b>.
            </li>
            <li>
              <b>Email</b>: paling mudah akun Gmail toko. Server <code>smtp.gmail.com</code>, port{' '}
              <code>465</code>, nama pengguna = alamat Gmail, sandi = <b>sandi aplikasi</b> (dibuat
              di Akun Google › Keamanan › Verifikasi 2 langkah › Sandi aplikasi), bukan password
              Gmail biasa. Tiap Admin/Owner mengisi email-nya di <b>Akun saya</b>.
            </li>
            <li>
              Kode berlaku 10 menit, sekali pakai, hanya untuk permintaan yang tertulis di pesannya,
              dan hangus setelah 5 kali salah ketik. Tiap atasan menerima kode yang berbeda,
              sehingga tercatat siapa yang menyetujui.
            </li>
            <li>
              Bila internet mati: retur/void tetap bisa diajukan dan disetujui atasan dari akunnya
              sendiri; penjualan yang melewati limit kredit harus dibayar dulu.
            </li>
          </ButirPenjelasan>
        </Penjelasan>
      </div>

      <Card className="gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Telegram</h2>
          {p.telegram.terpasang ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Aktif{p.telegram.bot ? ` · ${p.telegram.bot}` : ' · bot tidak bisa dihubungi'}
            </Badge>
          ) : (
            <Badge variant="outline">Belum diatur</Badge>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="token-bot">Token bot</Label>
          <Input
            id="token-bot"
            type="password"
            autoComplete="new-password"
            value={token}
            maxLength={100}
            placeholder={
              p.telegram.terpasang ? 'Tersimpan (isi untuk mengganti)' : 'mis. 123456:ABC-DEF…'
            }
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        {p.telegram.terpasang && (
          <button
            type="button"
            onClick={() => kirim(true)}
            className="self-start text-xs font-medium text-red-600 hover:underline"
          >
            Hapus token (matikan Telegram)
          </button>
        )}
      </Card>

      <Card className="gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Email (SMTP)</h2>
          <Badge
            variant="outline"
            className={
              p.email.terpasang ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : undefined
            }
          >
            {p.email.terpasang ? 'Aktif' : 'Belum diatur'}
          </Badge>
        </div>
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
            <Label htmlFor="smtp-pengguna">Nama pengguna</Label>
            <Input
              id="smtp-pengguna"
              value={pengguna}
              maxLength={120}
              autoComplete="off"
              placeholder="toko@gmail.com"
              onChange={(e) => setPengguna(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="smtp-sandi">Sandi aplikasi</Label>
            <Input
              id="smtp-sandi"
              type="password"
              autoComplete="new-password"
              value={sandi}
              maxLength={200}
              placeholder={p.email.sandiTerisi ? 'Tersimpan (isi untuk mengganti)' : ''}
              onChange={(e) => setSandi(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="email-pengirim">Nama pengirim (opsional)</Label>
          <Input
            id="email-pengirim"
            value={pengirim}
            maxLength={150}
            placeholder="BonsaiUrip <toko@gmail.com>"
            onChange={(e) => setPengirim(e.target.value)}
          />
        </div>
      </Card>

      <div className="flex gap-2">
        <Button disabled={simpan.isPending} onClick={() => kirim()}>
          {simpan.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button
          variant="outline"
          disabled={uji.isPending}
          onClick={() =>
            void uji
              .mutateAsync()
              .then((h) =>
                h.terkirim.length > 0
                  ? toast.success(
                      `Pesan uji terkirim lewat ${h.terkirim.map((s) => LABEL_SALURAN[s]).join(' dan ')}.` +
                        (h.galat.length > 0 ? ` ${h.galat.join(' ')}` : ''),
                    )
                  : toast.error(`Pesan uji tidak terkirim. ${h.galat.join(' ')}`),
              )
              .catch((err: unknown) => toast.error(pesanGalat(err)))
          }
        >
          {uji.isPending ? 'Mengirim…' : 'Kirim pesan uji ke saya'}
        </Button>
      </div>

      <Card className="gap-2 p-4">
        <h2 className="font-semibold">Admin/Owner yang bisa menerima kode</h2>
        {p.penerima.length === 0 ? (
          <p className="text-sm text-amber-700">
            Belum ada. Tiap Admin/Owner membuka{' '}
            <Link to="/akun/password" className="font-medium underline">
              Akun saya
            </Link>{' '}
            untuk menghubungkan Telegram atau mengisi email.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {p.penerima.map((x) => (
              <li key={x.nama} className="flex items-center gap-2">
                <span className="font-medium">{x.nama}</span>
                {x.saluran.length === 0 ? (
                  <span className="text-xs text-amber-700">
                    kontaknya ada, tetapi salurannya belum diatur toko
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
