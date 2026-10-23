import type { BarisSuratJalan, Perjalanan, PerluDikirim } from '@sit/shared';
import { Check, ClipboardCheck, FilePlus2, Phone, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useDaftarPerjalanan, usePerluDikirim } from '@/api/armada';
import { pesanGalat } from '@/api/client';
import {
  useBatalSuratJalan,
  useDaftarSuratJalan,
  useDetailPenjualan,
  useMuatSuratJalan,
} from '@/api/penjualan';
import { BilahTombol } from '../pos/bilah-tombol';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DialogBerangkat } from './dialog-berangkat';
import { DialogHasil } from './dialog-hasil';
import { BadgeSuratJalan, DialogBuat } from './panel-surat-jalan';

/*
 * Pengiriman aktif (K-149, K-150): tiga kolom sesuai urutan kerja — perlu surat jalan → siap berangkat → di
 * jalan (catat hasil). Hot page: pas satu layar, tiap kolom bergulir sendiri; tidak ada dialog yang muncul sendiri.
 */

/** Lama di jalan, tampilan saja: "1 j 20 m". */
function lama(iso: string, kini: number): { teks: string; menit: number } {
  const menit = Math.max(0, Math.floor((kini - new Date(iso).getTime()) / 60_000));
  const j = Math.floor(menit / 60);
  return { teks: j > 0 ? `${j} j ${menit % 60} m` : `${menit} m`, menit };
}

function Kolom({
  judul,
  jumlah,
  bantu,
  children,
  aksi,
}: {
  judul: string;
  jumlah: number;
  bantu: string;
  children: React.ReactNode;
  aksi?: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-md border bg-slate-50">
      <header className="space-y-1 border-b bg-white px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold whitespace-nowrap text-slate-800">
            {judul} <span className="text-slate-400">({jumlah})</span>
          </h2>
          {aksi}
        </div>
        <p className="text-xs text-slate-500">{bantu}</p>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">{children}</div>
    </section>
  );
}

function Kosong({ teks }: { teks: string }) {
  return <p className="py-6 text-center text-xs text-slate-400">{teks}</p>;
}

/** Memuat detail invoice lalu membuka dialog buat surat jalan yang sama dengan di halaman invoice. */
function BuatDariPapan({ idPenjualan, onTutup }: { idPenjualan: number; onTutup: () => void }) {
  const d = useDetailPenjualan(idPenjualan);
  if (!d.data) return null;
  return <DialogBuat p={d.data} onTutup={onTutup} />;
}

function KartuPerlu({ p, onBuat }: { p: PerluDikirim; onBuat: () => void }) {
  return (
    <div className="rounded-md border bg-white p-2.5 text-sm" data-testid={`perlu-${p.nomor}`}>
      <div className="flex items-center gap-2">
        <Link to={`/penjualan/${p.idPenjualan}`} className="font-mono font-semibold text-blue-700">
          {p.nomor}
        </Link>
        {p.kirimUlang && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
            Kirim ulang
          </Badge>
        )}
        {p.bayarSaatTerima && (
          <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-800">
            Bayar di tempat
          </Badge>
        )}
      </div>
      <div className="truncate font-medium">{p.namaPelanggan ?? '—'}</div>
      <div className="truncate text-xs text-slate-500">{p.alamatKirim ?? '—'}</div>
      <div className="mt-1 text-xs text-slate-700">
        {p.baris
          .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyBelumDikirim)} ${b.kodeSatuan}`)
          .join(' · ')}
      </div>
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={onBuat}>
        <FilePlus2 /> Buat surat jalan
      </Button>
    </div>
  );
}

function KartuSiap({
  sj,
  dipilih,
  onPilih,
}: {
  sj: BarisSuratJalan;
  dipilih: boolean;
  onPilih: (v: boolean) => void;
}) {
  const muat = useMuatSuratJalan();
  const batal = useBatalSuratJalan();
  return (
    <label
      className={cn(
        'block cursor-pointer rounded-md border bg-white p-2.5 text-sm',
        dipilih && 'border-blue-500 ring-2 ring-blue-200',
      )}
      data-testid={`siap-${sj.nomor}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={dipilih}
          onChange={(e) => onPilih(e.target.checked)}
          aria-label={`Pilih ${sj.nomor}`}
        />
        <span className="font-mono font-semibold">{sj.nomor}</span>
        <BadgeSuratJalan status={sj.status} />
      </div>
      <div className="truncate font-medium">{sj.namaPelanggan ?? '—'}</div>
      <div className="truncate text-xs text-slate-500">{sj.alamatKirim}</div>
      <div className="mt-1 text-xs text-slate-700">
        {sj.baris
          .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyKirim)} ${b.kodeSatuan}`)
          .join(' · ')}
      </div>
      <div className="mt-2 flex gap-1.5">
        {sj.status === 'DIPROSES' && (
          <Button
            size="sm"
            variant="outline"
            disabled={muat.isPending}
            onClick={(e) => {
              e.preventDefault();
              void muat
                .mutateAsync(sj.id)
                .then(() => toast.success(`${sj.nomor}: barang dimuat.`))
                .catch((err: unknown) => toast.error(pesanGalat(err)));
            }}
          >
            <Check /> Dimuat
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-red-700"
          disabled={batal.isPending}
          onClick={(e) => {
            e.preventDefault();
            const alasan = window.prompt(`Alasan membatalkan ${sj.nomor}?`)?.trim();
            if (!alasan || alasan.length < 3) return;
            void batal
              .mutateAsync({ id: sj.id, alasan })
              .then(() =>
                toast.success(`${sj.nomor} dibatalkan; barangnya kembali ke "Perlu surat jalan".`),
              )
              .catch((err: unknown) => toast.error(pesanGalat(err)));
          }}
        >
          <X /> Batalkan
        </Button>
      </div>
    </label>
  );
}

function KartuJalan({
  p,
  sjAktif,
  kini,
  onHasil,
}: {
  p: Perjalanan | { nomor: null; suratJalan: BarisSuratJalan[] };
  sjAktif: Map<number, BarisSuratJalan>;
  kini: number;
  onHasil: (sj: BarisSuratJalan) => void;
}) {
  const jalan = p.nomor !== null ? lama(p.waktuBerangkat, kini) : null;
  // Lewat 6 jam atau sudah ganti hari: tanda agar hasilnya segera dicatat (kendaraan masih terkunci).
  const lamaSekali =
    p.nomor !== null &&
    (jalan!.menit > 360 ||
      formatWaktu(p.waktuBerangkat).slice(0, 10) !==
        formatWaktu(new Date(kini).toISOString()).slice(0, 10));
  return (
    <div
      className={cn('rounded-md border bg-white p-2.5 text-sm', lamaSekali && 'border-amber-400')}
      data-testid={p.nomor ? `jalan-${p.nomor}` : 'jalan-lama'}
    >
      {p.nomor !== null ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-semibold">{p.nomor}</span>
            <span
              className={cn(
                'text-xs',
                lamaSekali ? 'font-semibold text-amber-700' : 'text-slate-500',
              )}
            >
              berangkat {formatWaktu(p.waktuBerangkat).slice(11)} · {jalan!.teks}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Truck className="size-4 text-slate-500" /> {p.plat}{' '}
            <span className="font-normal text-slate-500">{p.jenisKendaraan}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            {p.namaSopir}
            {p.noHpSopir && (
              <a
                href={`tel:${p.noHpSopir}`}
                className="inline-flex items-center gap-0.5 text-blue-700"
              >
                <Phone className="size-3" /> {p.noHpSopir}
              </a>
            )}
          </div>
          {lamaSekali && (
            <p className="mt-1 text-xs text-amber-800">
              Sudah lama di jalan. Bila sopir sudah kembali, catat hasilnya agar kendaraan & sopir
              bebas.
            </p>
          )}
        </>
      ) : (
        <div className="text-xs font-semibold text-slate-500">Tanpa perjalanan (data lama)</div>
      )}
      <ul className="mt-2 space-y-1.5">
        {p.suratJalan.map((s) => {
          const sj = sjAktif.get(s.id);
          if (!sj) {
            return (
              <li key={s.id} className="text-xs text-slate-500">
                {s.nomor} · {s.namaPelanggan ?? '—'} · hasil dicatat
              </li>
            );
          }
          return (
            <li key={s.id} className="rounded border bg-slate-50 p-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs">
                    <span className="font-mono font-semibold">{sj.nomor}</span> ·{' '}
                    {sj.namaPelanggan ?? '—'}
                  </div>
                  <div className="truncate text-xs text-slate-500">{sj.alamatKirim}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onHasil(sj)}
                  aria-label={`Catat hasil ${sj.nomor}`}
                >
                  <ClipboardCheck /> Catat hasil
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PapanPengiriman() {
  const perlu = usePerluDikirim();
  const aktif = useDaftarSuratJalan({ status: 'AKTIF', cari: '' });
  const jalan = useDaftarPerjalanan({ status: 'JALAN' });
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<
    | { jenis: 'buat'; id: number }
    | { jenis: 'berangkat' }
    | { jenis: 'hasil'; sj: BarisSuratJalan }
    | null
  >(null);
  const [kini, setKini] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setKini(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const semua = aktif.data?.data ?? [];
  const siap = semua.filter((s) => s.status === 'DIPROSES' || s.status === 'DIMUAT');
  const sjAktif = new Map(semua.filter((s) => s.status === 'DIKIRIM').map((s) => [s.id, s]));
  const trip = jalan.data?.data ?? [];
  const tanpaTrip = [...sjAktif.values()].filter((s) => s.idPerjalanan === null);
  const terpilih = siap.filter((s) => pilih.has(s.id));

  function berangkat() {
    if (terpilih.length === 0) {
      toast.info('Centang dulu surat jalan yang akan berangkat.');
      return;
    }
    setDialog({ jenis: 'berangkat' });
  }

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if (dialog || e.ctrlKey || e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        ((t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'checkbox') ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT')
      )
        return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        berangkat();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setPilih(new Set(siap.map((s) => s.id)));
      }
    }
    window.addEventListener('keydown', tombol);
    return () => window.removeEventListener('keydown', tombol);
  });

  return (
    <div className="flex h-full min-h-[400px] flex-col gap-2">
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
        <Kolom
          judul="Perlu surat jalan"
          jumlah={perlu.data?.length ?? 0}
          bantu="Barang invoice yang belum dikirim"
        >
          {(perlu.data ?? []).length === 0 && (
            <Kosong teks={perlu.isLoading ? 'Memuat…' : 'Semua barang sudah punya surat jalan.'} />
          )}
          {(perlu.data ?? []).map((p) => (
            <KartuPerlu
              key={p.idPenjualan}
              p={p}
              onBuat={() => setDialog({ jenis: 'buat', id: p.idPenjualan })}
            />
          ))}
        </Kolom>
        <Kolom
          judul="Siap berangkat"
          jumlah={siap.length}
          bantu="Centang yang dibawa satu kendaraan, lalu Berangkat (B)"
          aksi={
            <Button
              size="sm"
              className="h-7 shrink-0 px-2"
              disabled={terpilih.length === 0}
              onClick={berangkat}
            >
              <Truck /> Berangkat{terpilih.length > 0 ? ` (${terpilih.length})` : ''}
              <kbd className="ml-1 font-mono text-xs opacity-70">B</kbd>
            </Button>
          }
        >
          {siap.length === 0 && (
            <Kosong
              teks={aktif.isLoading ? 'Memuat…' : 'Tidak ada surat jalan yang menunggu berangkat.'}
            />
          )}
          {siap.map((sj) => (
            <KartuSiap
              key={sj.id}
              sj={sj}
              dipilih={pilih.has(sj.id)}
              onPilih={(v) =>
                setPilih((p) => {
                  const baru = new Set(p);
                  if (v) baru.add(sj.id);
                  else baru.delete(sj.id);
                  return baru;
                })
              }
            />
          ))}
        </Kolom>
        <Kolom
          judul="Di jalan"
          jumlah={trip.length + (tanpaTrip.length > 0 ? 1 : 0)}
          bantu="Sopir kembali: catat hasil"
        >
          {trip.length === 0 && tanpaTrip.length === 0 && (
            <Kosong teks={jalan.isLoading ? 'Memuat…' : 'Tidak ada kendaraan di jalan.'} />
          )}
          {trip.map((p) => (
            <KartuJalan
              key={p.id}
              p={p}
              sjAktif={sjAktif}
              kini={kini}
              onHasil={(sj) => setDialog({ jenis: 'hasil', sj })}
            />
          ))}
          {tanpaTrip.length > 0 && (
            <KartuJalan
              p={{ nomor: null, suratJalan: tanpaTrip }}
              sjAktif={sjAktif}
              kini={kini}
              onHasil={(sj) => setDialog({ jenis: 'hasil', sj })}
            />
          )}
        </Kolom>
      </div>
      <BilahTombol
        daftar={[
          { kunci: 'A', label: 'Centang semua siap berangkat' },
          { kunci: 'B', label: 'Berangkat (yang dicentang)' },
        ]}
      />
      {dialog?.jenis === 'buat' && (
        <BuatDariPapan idPenjualan={dialog.id} onTutup={() => setDialog(null)} />
      )}
      {dialog?.jenis === 'berangkat' && (
        <DialogBerangkat
          suratJalan={terpilih}
          onTutup={() => setDialog(null)}
          onSelesai={() => setPilih(new Set())}
        />
      )}
      {dialog?.jenis === 'hasil' && <DialogHasil sj={dialog.sj} onTutup={() => setDialog(null)} />}
    </div>
  );
}
