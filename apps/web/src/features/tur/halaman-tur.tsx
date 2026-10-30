import { CheckCircle2, Circle, Compass, RotateCcw, SkipForward, Wand2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { usePengguna, useStatusTur, useUlangTur } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { bolehAkses } from '@/lib/menu';
import { useTur } from './konteks-tur';

/** K-206: daftar tur sesuai peran, status, tombol mulai/ulang; Owner juga bisa mengulang setup awal (K-205). */
export function HalamanTur() {
  const pengguna = usePengguna();
  const { mulai, turYangBoleh } = useTur();
  const status = useStatusTur().data;
  const ulang = useUlangTur();
  const owner = bolehAkses(pengguna, 'sistem.pengaturan.kelola');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tur & panduan</h1>
        <p className="text-sm text-slate-500">
          Tur menyorot bagian layar dan menjelaskan cara memakainya. Pilih tur lalu ikuti; Esc untuk
          berhenti kapan saja.
        </p>
      </div>

      {owner && (
        <Card className="flex flex-row flex-wrap items-center gap-4 p-5">
          <Wand2 className="size-6 text-blue-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800">Ulangi setup awal</p>
            <p className="text-sm text-slate-600">
              Mulai lagi dari langkah pertama: data usaha, cara berjualan, logo & struk, rekening,
              email, cadangan, karyawan, data awal. Isian yang tersimpan tampil kembali; transaksi
              tidak tersentuh.
            </p>
          </div>
          <Button asChild>
            <Link to="/mulai">Ulangi setup awal</Link>
          </Button>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            <Compass className="size-4 text-blue-600" /> Tur fitur
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={ulang.isPending}
            onClick={() =>
              void ulang
                .mutateAsync('SEMUA')
                .then(() => toast.success('Semua tur ditawarkan lagi saat halamannya dibuka.'))
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            <RotateCcw /> Tawarkan semua tur lagi
          </Button>
        </div>
        <ul className="divide-y">
          {turYangBoleh.map((t) => {
            const selesai = status?.selesai.includes(t.kode) ?? false;
            const lewat = status?.dilewati.includes(t.kode) ?? false;
            return (
              <li key={t.kode} className="flex items-center gap-3 px-5 py-3">
                {selesai ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : lewat ? (
                  <SkipForward className="size-5 text-amber-500" />
                ) : (
                  <Circle className="size-5 text-slate-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{t.judul}</p>
                  <p className="text-xs text-slate-500">
                    {t.ringkas} · {t.langkah.length} langkah
                    {selesai ? ' · selesai' : lewat ? ' · dilewati' : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={selesai ? 'outline' : 'default'}
                  onClick={() => mulai(t.kode)}
                >
                  {selesai ? 'Ulangi' : 'Mulai'}
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5 text-sm text-slate-700">
        <p className="mb-1 font-semibold text-slate-800">Panduan tertulis</p>
        <p>
          Di komputer tempat BonsaiUrip terpasang: menu Start › BonsaiUrip ›{' '}
          <b>Panduan mulai pakai</b> (ringkas, langkah demi langkah). Tombol <b>?</b> di tiap
          halaman menjelaskan istilah dan aturan halaman itu.
        </p>
      </Card>
    </div>
  );
}
