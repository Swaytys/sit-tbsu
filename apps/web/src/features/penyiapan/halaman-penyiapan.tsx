import type {
  HasilContoh,
  JenisContoh,
  LangkahPenyiapan,
  StatusLangkahPenyiapan,
} from '@sit/shared';
import { CheckCircle2, Circle, ExternalLink, FlaskConical, PowerOff } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import {
  useIsiContoh,
  useNonaktifkanContoh,
  usePanduanPenyiapan,
  useSembunyikanPanduan,
  useTandaiProfil,
} from '@/api/penyiapan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { bacaPengaturanPrinter } from '@/lib/printer-thermal';
import { cn } from '@/lib/utils';
import { TEKS_LANGKAH } from './teks-penyiapan';

const CONTOH_PER_LANGKAH: Partial<Record<LangkahPenyiapan, JenisContoh>> = {
  BARANG: 'BARANG',
  PELANGGAN: 'PELANGGAN',
  PEMASOK: 'PEMASOK',
  ARMADA: 'ARMADA',
};

/** Printer struk diatur per komputer: siap bila cetak langsung sudah teruji di komputer ini. */
function printerSiap(): boolean {
  const p = bacaPengaturanPrinter();
  return p.langsung && p.teruji;
}

function laporHasil(h: HasilContoh, kata: string) {
  const jumlah = kata === 'dibuat' ? h.dibuat : h.dinonaktifkan;
  if (h.gagal.length === 0) toast.success(`${jumlah} contoh ${kata}.`);
  else
    toast.warning(`${jumlah} contoh ${kata}; ${h.gagal.length} gagal: ${h.gagal.join('; ')}`, {
      duration: 15_000,
    });
}

function KartuLangkah({
  nomor,
  s,
  contohAktif,
}: {
  nomor: number;
  s: StatusLangkahPenyiapan;
  contohAktif: number;
}) {
  const t = TEKS_LANGKAH[s.langkah];
  const isi = useIsiContoh();
  const tandai = useTandaiProfil();
  const jenisContoh = CONTOH_PER_LANGKAH[s.langkah];
  const selesai = s.langkah === 'PRINTER' ? printerSiap() : s.selesai;
  return (
    <Card
      className={cn('gap-3 p-4', selesai && 'border-emerald-300 bg-emerald-50/40')}
      data-testid={`langkah-${s.langkah}`}
    >
      <div className="flex items-start gap-3">
        {selesai ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        ) : (
          <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900">
              {nomor}. {t.judul}
            </h2>
            {t.opsional && (
              <Badge variant="outline" className="text-slate-500">
                bila perlu
              </Badge>
            )}
            <Badge
              variant="outline"
              className={selesai ? 'border-emerald-300 text-emerald-700' : 'text-slate-500'}
            >
              {selesai ? 'Selesai' : 'Belum'}
              {s.jumlah !== null && ` · ${s.jumlah} data`}
            </Badge>
            {contohAktif > 0 && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                {contohAktif} contoh aktif
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600">{t.guna}</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
            {t.langkah.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {t.tautan.map((a) => (
              <Button key={a.ke} asChild size="sm" variant="outline">
                <Link to={a.ke}>
                  <ExternalLink /> {a.label}
                </Link>
              </Button>
            ))}
            {jenisContoh && contohAktif === 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={isi.isPending}
                onClick={() =>
                  void isi
                    .mutateAsync(jenisContoh)
                    .then((h) => laporHasil(h, 'dibuat'))
                    .catch((err: unknown) => toast.error(pesanGalat(err)))
                }
              >
                <FlaskConical /> {isi.isPending ? 'Membuat…' : t.labelContoh}
              </Button>
            )}
            {s.langkah === 'PROFIL' && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={s.selesai}
                  disabled={tandai.isPending}
                  onChange={(e) =>
                    void tandai
                      .mutateAsync(e.target.checked)
                      .catch((err: unknown) => toast.error(pesanGalat(err)))
                  }
                />
                Sudah saya periksa dan benar
              </label>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * K-168: panduan penyiapan pertama (Owner/Admin). Urutan langkah mengikuti kebutuhan transaksi pertama; status
 * dibaca dari data. Contoh data membantu mencoba aplikasi dan bisa dinonaktifkan sekali klik.
 */
export function HalamanPenyiapan() {
  const panduan = usePanduanPenyiapan();
  const nonaktif = useNonaktifkanContoh();
  const sembunyi = useSembunyikanPanduan();
  const [yakin, setYakin] = useState(false);
  const p = panduan.data;
  if (!p) return <div className="p-6 text-sm text-slate-500">Memuat panduan…</div>;
  const contohAktif = (l: LangkahPenyiapan) => {
    const j = CONTOH_PER_LANGKAH[l];
    return j ? p.contoh[j] : 0;
  };
  const totalContoh = Object.values(p.contoh).reduce((a, b) => a + b, 0);
  const selesai = p.langkah.filter((s) => (s.langkah === 'PRINTER' ? printerSiap() : s.selesai));

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Panduan penyiapan</h1>
          <p className="text-sm text-slate-500">
            Isi berurutan sebelum toko memakai aplikasi. {selesai.length} dari {p.langkah.length}{' '}
            langkah selesai. Status berubah sendiri setelah datanya diisi.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={!p.disembunyikan}
            onChange={(e) =>
              void sembunyi
                .mutateAsync(!e.target.checked)
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          />
          Tampilkan pengingat di Dashboard
        </label>
      </div>

      <Card className="gap-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">Contoh data (untuk mencoba)</div>
        <p>
          Tombol <b>Isi contoh</b> di langkah Barang, Pelanggan, Pemasok, dan Kendaraan & sopir
          membuat data bernama wajar (mis. <i>Semen Gresik 40 kg</i>, <i>Toko Bangunan Makmur</i>)
          bertanda "Data contoh". Contoh tidak dihitung sebagai data asli dan barang contoh tidak
          punya stok. Setelah selesai mencoba, nonaktifkan semuanya dengan tombol di bawah;
          transaksi yang sempat dibuat dengan contoh tetap tersimpan di laporan.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span>{totalContoh} contoh aktif.</span>
          {totalContoh > 0 &&
            (yakin ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={nonaktif.isPending}
                  onClick={() =>
                    void nonaktif
                      .mutateAsync()
                      .then((h) => {
                        laporHasil(h, 'dinonaktifkan');
                        setYakin(false);
                      })
                      .catch((err: unknown) => toast.error(pesanGalat(err)))
                  }
                >
                  <PowerOff /> Ya, nonaktifkan {totalContoh} contoh
                </Button>
                <Button size="sm" variant="outline" onClick={() => setYakin(false)}>
                  Batal
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setYakin(true)}>
                <PowerOff /> Nonaktifkan semua contoh
              </Button>
            ))}
        </div>
      </Card>

      {p.langkah.map((s, i) => (
        <KartuLangkah key={s.langkah} nomor={i + 1} s={s} contohAktif={contohAktif(s.langkah)} />
      ))}
    </div>
  );
}
