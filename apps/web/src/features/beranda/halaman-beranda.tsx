import { LABEL_PERAN } from '@sit/shared';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router';
import { usePengguna } from '@/api/auth';
import { usePeringatanStok } from '@/api/persediaan';
import { BadgeStatusStok } from '@/components/status-badge';
import { Card } from '@/components/ui/card';
import { formatDesimal } from '@/lib/format';
import { menuUntuk } from '@/lib/menu';

/** Kartu "Peringatan stok" dashboard (docs/05 ST3): jumlah KRITIS + HABIS dan barang teratas. */
function KartuPeringatanStok({ bolehBuka }: { bolehBuka: boolean }) {
  const data = usePeringatanStok(true).data;
  if (!data) return null;
  const jumlah = data.habis + data.kritis;
  return (
    <Card className="gap-3 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Peringatan stok</h2>
          <p className="text-xs text-slate-500">
            {data.habis} habis · {data.kritis} kritis · {data.perluRestock} perlu restock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={jumlah > 0 ? 'size-5 text-orange-600' : 'size-5 text-slate-300'}
          />
          <span
            className="text-2xl font-semibold tabular-nums"
            data-testid="jumlah-peringatan-stok"
          >
            {jumlah}
          </span>
        </div>
      </div>
      {data.barang.length > 0 && (
        <ul className="divide-y text-sm">
          {data.barang.map((b) => (
            <li key={b.idBarang} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 truncate">{b.namaBarang}</span>
              <span className="text-xs text-slate-500 tabular-nums">
                {formatDesimal(b.stokFisik)} / min {formatDesimal(b.stokMinimum)} {b.kodeSatuan}
              </span>
              <BadgeStatusStok status={b.statusStok} />
            </li>
          ))}
        </ul>
      )}
      {bolehBuka && jumlah > 0 && (
        <Link
          to="/persediaan?tab=posisi"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Lihat posisi stok
        </Link>
      )}
    </Card>
  );
}

/** Beranda sementara. Dashboard per peran (kartu, grafik, aksi cepat) dibangun di Fase 7. */
export function HalamanBeranda() {
  const pengguna = usePengguna();
  const halaman = menuUntuk(pengguna).flatMap((e) => (e.jenis === 'grup' ? e.item : [e]));

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Selamat datang, {pengguna.namaPengguna}
        </h1>
        <p className="text-sm text-slate-500">
          Anda masuk sebagai <span className="font-medium">{LABEL_PERAN[pengguna.peran]}</span>.
          Dashboard lengkap dibangun pada Fase 7.
        </p>
      </div>
      {pengguna.izin.includes('dashboard.dasar') && (
        <KartuPeringatanStok bolehBuka={pengguna.izin.includes('persediaan.stok.lihat')} />
      )}
      <Card className="gap-3 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Halaman yang bisa Anda buka</h2>
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {halaman
            .filter((h) => h.path !== '/dashboard')
            .map((h) => (
              <li key={h.path}>
                <Link
                  to={h.path}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                >
                  <h.ikon className="size-4 text-slate-400" />
                  {h.label}
                </Link>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
