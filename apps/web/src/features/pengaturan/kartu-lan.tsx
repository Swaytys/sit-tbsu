import { Check, Loader2, Power, Wifi, X } from 'lucide-react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useAturLan, usePutuskanPerangkat, useStatusLan } from '@/api/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWaktu } from '@/lib/format';
import { KodeQr } from './tab-akses';

/**
 * K-229: mode LAN toko. HP/tablet di WiFi toko membuka BonsaiUrip lewat HTTPS dengan sertifikat toko; setiap
 * perangkat baru disetujui di sini dengan mencocokkan kode 6 angka yang tampil di perangkat itu.
 */
export function KartuLan() {
  const lan = useStatusLan();
  const atur = useAturLan();
  const putus = usePutuskanPerangkat();
  const s = lan.data;
  const ubah = (aktif: boolean) =>
    void atur
      .mutateAsync(aktif)
      .then((h) =>
        h.galat
          ? toast.error(`Mode LAN belum bisa menyala: ${h.galat}`)
          : toast.success(aktif ? 'Mode LAN toko menyala.' : 'Mode LAN toko dimatikan.'),
      )
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  const keputusan = (id: number, k: 'setujui' | 'tolak' | 'cabut') =>
    void putus
      .mutateAsync({ id, keputusan: k })
      .then(() =>
        toast.success(
          k === 'setujui'
            ? 'Perangkat disetujui.'
            : k === 'tolak'
              ? 'Perangkat ditolak.'
              : 'Akses perangkat dicabut.',
        ),
      )
      .catch((err: unknown) => toast.error(pesanGalat(err)));

  if (!s) return <Skeleton className="h-40" />;
  const menunggu = s.perangkat.filter((p) => p.status === 'MENUNGGU');
  const disetujui = s.perangkat.filter((p) => p.status === 'DISETUJUI');
  return (
    <Card className="gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Wifi className="size-5 text-blue-600" />
        <h2 className="flex-1 font-semibold text-slate-800">
          Cara 1 · Mode LAN toko (gratis, HP/tablet di WiFi toko)
        </h2>
        {s.menyala ? (
          <Badge className="bg-emerald-600">Menyala</Badge>
        ) : (
          <Badge variant="outline">Mati</Badge>
        )}
        <Button
          size="sm"
          variant={s.aktif ? 'outline' : 'default'}
          disabled={atur.isPending}
          onClick={() => ubah(!s.aktif)}
        >
          {atur.isPending ? <Loader2 className="animate-spin" /> : <Power />}{' '}
          {s.aktif ? 'Matikan' : 'Nyalakan mode LAN'}
        </Button>
      </div>
      {s.galat && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{s.galat}</p>}
      {s.menyala && (
        <div className="flex flex-wrap gap-6">
          <div className="min-w-64 flex-1 space-y-2 text-sm text-slate-700">
            <p>
              <b>Langkah di setiap HP/tablet</b> (sekali, ± 3 menit). HP harus tersambung ke WiFi
              toko yang sama dengan laptop ini.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Pindai kode QR ini dengan kamera HP. Halaman <i>Pasang BonsaiUrip</i> terbuka
                (alamat: <code className="text-xs">{s.alamatSiap[0] ?? '—'}</code>).
              </li>
              <li>
                Tekan <b>Unduh sertifikat toko</b>. Cocokkan <b>sidik jari</b> di HP dengan sidik
                jari di bawah ini; harus sama persis.
              </li>
              <li>
                Pasang sertifikatnya mengikuti petunjuk di halaman itu (Android: Sertifikat CA;
                iPhone/iPad: Instal profil lalu Percayai).
              </li>
              <li>
                Buka alamat aplikasi <code className="text-xs">{s.alamat[0] ?? '—'}</code>, lalu{' '}
                <i>Tambahkan ke layar utama</i>.
              </li>
              <li>
                HP menampilkan <b>kode 6 angka</b>. Cocokkan dengan daftar{' '}
                <i>Menunggu persetujuan</i> di bawah, lalu <b>Setujui</b>. Sesudah itu masuk dengan
                akun karyawan masing-masing.
              </li>
            </ol>
            <div className="rounded-md bg-slate-50 p-2 text-xs">
              <div className="text-slate-500">Sidik jari sertifikat toko</div>
              <code className="break-all">{s.sidikJari}</code>
            </div>
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              Keamanan: lalu lintas terenkripsi (HTTPS); orang yang tahu password WiFi tetap tidak
              bisa membuka aplikasi tanpa persetujuan perangkat dan akun. Pakai WiFi berpassword
              kuat dan WiFi tamu terpisah untuk pembeli. Bila Windows menanyakan izin jaringan untuk
              BonsaiUrip/Node.js, pilih <b>Izinkan</b> untuk jaringan pribadi.
            </p>
          </div>
          {s.alamatSiap[0] && (
            <div className="text-center text-xs text-slate-500">
              <KodeQr alamat={s.alamatSiap[0]} />
              Pindai dengan kamera HP
            </div>
          )}
        </div>
      )}
      {s.menyala && (
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-800">
            Menunggu persetujuan{menunggu.length > 0 ? ` (${menunggu.length})` : ''}
          </h3>
          {menunggu.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada perangkat baru.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {menunggu.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="rounded bg-slate-900 px-2 py-1 font-mono text-lg tracking-widest text-white">
                    {p.kode}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {p.nama} · {p.ipTerakhir ?? '—'} · {formatWaktu(p.dibuatPada)}
                  </span>
                  <Button
                    size="sm"
                    disabled={putus.isPending}
                    onClick={() => keputusan(p.id, 'setujui')}
                  >
                    <Check /> Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={putus.isPending}
                    onClick={() => keputusan(p.id, 'tolak')}
                  >
                    <X /> Tolak
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="pt-2 font-semibold text-slate-800">
            Perangkat disetujui ({disetujui.length})
          </h3>
          {disetujui.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {disetujui.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {p.nama} · kode {p.kode} · terakhir dipakai{' '}
                    {p.terakhirDilihat ? formatWaktu(p.terakhirDilihat) : '—'}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={putus.isPending}
                    onClick={() => keputusan(p.id, 'cabut')}
                  >
                    Cabut akses
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            HP hilang atau karyawan keluar: <b>Cabut akses</b> perangkatnya di sini dan nonaktifkan
            akun BonsaiUrip-nya.
          </p>
        </div>
      )}
    </Card>
  );
}
