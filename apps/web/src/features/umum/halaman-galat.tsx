import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Waktu muat ulang otomatis terakhir (sessionStorage): bukan data bisnis, hanya pencegah muat ulang berulang. */
const KUNCI_MUAT_ULANG = 'tbsu:muat-ulang-otomatis';
const JEDA_MUAT_ULANG_MS = 60_000;

/**
 * Berkas halaman gagal diunduh. Tiap halaman diunduh saat pertama dibuka (routes.tsx); setelah server
 * diperbarui, tab yang sudah lama terbuka meminta nama berkas versi lama yang sudah tidak ada.
 */
function gagalUnduhHalaman(err: unknown): boolean {
  const pesan = err instanceof Error ? err.message : '';
  return /dynamically imported module|importing a module script failed/i.test(pesan);
}

/** Muat ulang otomatis paling sering sekali per menit, supaya tidak berputar bila masalahnya menetap. */
function bolehMuatUlangOtomatis(): boolean {
  try {
    const terakhir = Number(sessionStorage.getItem(KUNCI_MUAT_ULANG) ?? 0);
    if (Date.now() - terakhir < JEDA_MUAT_ULANG_MS) return false;
    sessionStorage.setItem(KUNCI_MUAT_ULANG, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function rincian(err: unknown): string {
  const teks = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return teks.slice(0, 300);
}

/**
 * Tampil saat sebuah halaman gagal dimuat atau gagal digambar (`errorElement` di routes.tsx), menggantikan
 * layar galat bawaan React Router yang berbahasa Inggris dan menampilkan jejak kode. Yang rusak hanya
 * tampilan; data yang sudah tersimpan di server tidak terpengaruh.
 */
export function HalamanGalat() {
  const err = useRouteError();
  const unduhan = gagalUnduhHalaman(err);
  const [serverMati, setServerMati] = useState(false);

  useEffect(() => {
    if (!unduhan) return;
    let batal = false;
    // Server menjawab = berkasnya memang sudah berganti versi: muat ulang. Tidak menjawab = server/jaringan.
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => {
        if (batal) return;
        if (!r.ok) setServerMati(true);
        else if (bolehMuatUlangOtomatis()) window.location.reload();
      })
      .catch(() => {
        if (!batal) setServerMati(true);
      });
    return () => {
      batal = true;
    };
  }, [unduhan]);

  const [judul, isi] = !unduhan
    ? [
        'Halaman ini mengalami kesalahan',
        'Data yang sudah tersimpan tidak terpengaruh. Muat ulang halaman; bila terulang, sampaikan keterangan di bawah ini ke admin.',
      ]
    : serverMati
      ? [
          'Server tidak bisa dihubungi',
          'Periksa apakah komputer server menyala dan jaringan toko tersambung, lalu muat ulang halaman.',
        ]
      : [
          'Aplikasi baru saja diperbarui',
          'Halaman perlu dimuat ulang untuk memakai versi terbaru.',
        ];

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-lg gap-3 p-6" role="alert">
        <div className="flex items-center gap-3">
          <TriangleAlert className="size-7 shrink-0 text-amber-500" />
          <h1 className="text-lg font-semibold text-slate-900">{judul}</h1>
        </div>
        <p className="text-sm text-slate-600">{isi}</p>
        {!unduhan && (
          <p className="rounded-md bg-slate-50 p-2 font-mono text-xs break-words text-slate-500">
            {rincian(err)}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Muat ulang</Button>
          <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
            Ke Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
