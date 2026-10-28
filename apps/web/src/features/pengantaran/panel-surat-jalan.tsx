import {
  LABEL_ALASAN_KEMBALI,
  LABEL_ALASAN_RUSAK,
  skemaSuratJalan,
  type BarisSuratJalan,
  type DetailPenjualan,
  type StatusSuratJalan,
} from '@sit/shared';
import { CalendarPlus, Check, ClipboardCheck, Printer, Truck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useDaftarPerjalanan } from '@/api/armada';
import { pesanGalat } from '@/api/client';
import { useBatalSuratJalan, useBuatSuratJalan, useMuatSuratJalan } from '@/api/penjualan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DialogRitBaru } from '../pengiriman/dialog-rit';
import { DialogHasil } from './dialog-hasil';

const LABEL_SJ: Record<StatusSuratJalan, string> = {
  DIPROSES: 'Surat jalan dibuat',
  DIMUAT: 'Barang dimuat',
  DIKIRIM: 'Di jalan',
  SELESAI: 'Hasil dicatat',
  BATAL: 'Batal',
};
const URUTAN: StatusSuratJalan[] = ['DIPROSES', 'DIMUAT', 'DIKIRIM', 'SELESAI'];

/** Ringkasan hasil pengantaran per barang (K-149): hanya yang tidak diterima disebut. */
export function RingkasHasil({ sj }: { sj: BarisSuratJalan }) {
  const h = sj.hasil;
  if (!h) return null;
  const nama = new Map(sj.baris.map((b) => [b.idPenjualanDetail, b]));
  const catatan = h.baris.flatMap((r) => {
    const b = nama.get(r.idPenjualanDetail);
    const satuan = b?.kodeSatuan ?? '';
    const teks: string[] = [];
    if (/[1-9]/.test(r.qtyKembali))
      teks.push(`kembali, dikirim ulang ${formatDesimal(r.qtyKembali)} ${satuan}`);
    if (/[1-9]/.test(r.qtyDitolak))
      teks.push(
        `dikembalikan ${formatDesimal(r.qtyDitolak)} ${satuan}${
          r.alasanKembali
            ? ` (${LABEL_ALASAN_KEMBALI[r.alasanKembali].split(' (')[0]!.toLowerCase()})`
            : ''
        }`,
      );
    if (/[1-9]/.test(r.qtyRusak))
      teks.push(
        `rusak ${formatDesimal(r.qtyRusak)} ${satuan}${
          r.alasanRusak ? ` (${LABEL_ALASAN_RUSAK[r.alasanRusak].toLowerCase()})` : ''
        }`,
      );
    return teks.length ? [`${b?.namaBarang ?? '?'}: ${teks.join(', ')}`] : [];
  });
  return (
    <div
      className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700"
      data-testid="ringkas-hasil"
    >
      <div>
        {catatan.length === 0 ? (
          <span className="font-semibold text-emerald-700">Semua diterima</span>
        ) : (
          catatan.join(' · ')
        )}
        {h.namaPenerima && ` · diterima ${h.namaPenerima}`}
        {h.penangananRusak &&
          ` · rusak: ${h.penangananRusak === 'KIRIM_PENGGANTI' ? 'dikirim pengganti' : 'tagihan dikurangi'}`}
      </div>
      <div className="text-slate-500">
        Dicatat {h.namaPengguna}, {formatWaktu(h.waktu)}
        {[h.returUang, h.returRusak, h.returTukar].map(
          (r) =>
            r && (
              <span key={r.id}>
                {' · '}
                <Link to="/retur" className="text-blue-700 hover:underline">
                  {r.nomor}
                </Link>{' '}
                {r.status === 'MENUNGGU' ? (
                  <b className="text-amber-700">menunggu atasan</b>
                ) : (
                  r.status.toLowerCase()
                )}
              </span>
            ),
        )}
      </div>
    </div>
  );
}

export function BadgeSuratJalan({ status }: { status: StatusSuratJalan }) {
  const warna: Record<StatusSuratJalan, string> = {
    DIPROSES: 'border-slate-200 bg-slate-100 text-slate-700',
    DIMUAT: 'border-amber-200 bg-amber-50 text-amber-700',
    DIKIRIM: 'border-blue-200 bg-blue-50 text-blue-700',
    SELESAI: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    BATAL: 'border-red-200 bg-red-50 text-red-600',
  };
  return (
    <Badge variant="outline" className={warna[status]}>
      {LABEL_SJ[status]}
    </Badge>
  );
}

const kelasPilih =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200';

const jamRit = (iso: string | null) => (iso ? formatWaktu(iso).slice(11) : '—');

/**
 * K-174: buat surat jalan (semua atau sebagian barang) langsung di dalam rit rencana. Rit menentukan sopir dan
 * kendaraan yang tertulis di surat jalan; bila belum ada rit yang cocok, buat rit baru dari dialog ini. Surat jalan
 * dicetak saat rit berangkat (atau dari tombol Cetak).
 */
export function DialogBuat({
  p,
  onTutup,
  onBerhasil,
  idRitAwal,
}: {
  p: DetailPenjualan;
  onTutup: () => void;
  onBerhasil?: () => void;
  idRitAwal?: number;
}) {
  const buat = useBuatSuratJalan();
  const rencana = useDaftarPerjalanan({ status: 'DIRENCANAKAN' });
  const daftarRit = rencana.data?.data ?? [];
  const [idRit, setIdRit] = useState(idRitAwal ? String(idRitAwal) : '');
  const [ritBaru, setRitBaru] = useState(false);
  const pilihRit = useRef<HTMLSelectElement>(null);
  // Dibuka dari menu kartu: fokus menu baru lepas setelah dialog terpasang, jadi fokus awal dipasang ulang.
  useEffect(() => {
    if (idRitAwal) return;
    const t = window.setTimeout(() => pilihRit.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [idRitAwal]);
  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(p.baris.map((b) => [b.id, b.qtyBelumDikirim.replace(/\.?0+$/, '') || '0'])),
  );
  const [penerima, setPenerima] = useState(p.namaPelanggan ?? '');
  const [noHp, setNoHp] = useState(p.noHpPelanggan ?? '');
  const [alamat, setAlamat] = useState(p.alamatKirim ?? '');

  function simpan() {
    if (buat.isPending) return;
    const data = skemaSuratJalan.safeParse({
      idPerjalanan: Number(idRit) || undefined,
      alamatKirim: alamat,
      namaPenerima: penerima,
      noHpPenerima: noHp,
      baris: p.baris
        .filter((b) => /[1-9]/.test(qty[b.id] ?? ''))
        .map((b) => ({ idPenjualanDetail: b.id, qtyKirim: qty[b.id] })),
    });
    if (!data.success) {
      toast.error(data.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    buat
      .mutateAsync({ id: p.id, json: data.data })
      .then((sj) => {
        toast.success(`Surat jalan ${sj.nomor} masuk rit ${sj.nomorPerjalanan ?? ''}.`);
        onBerhasil?.();
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <>
      <Dialog open={!ritBaru} onOpenChange={(b) => !b && onTutup()}>
        <DialogContent
          className="sm:max-w-2xl"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              simpan();
            } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
              e.preventDefault();
              setRitBaru(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Kirim {p.nomor} dengan rit</DialogTitle>
            <DialogDescription>
              Pilih rit (kendaraan + sopir), lalu qty yang dikirim kali ini (boleh sebagian). Surat
              jalan dicetak saat rit berangkat.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-end gap-2 text-sm">
            <label className="grid flex-1 gap-1">
              <span className="font-medium">Rit</span>
              <select
                ref={pilihRit}
                autoFocus={!idRitAwal}
                className={kelasPilih}
                value={idRit}
                onChange={(e) => setIdRit(e.target.value)}
                aria-label="Rit pengiriman"
              >
                <option value="">
                  {daftarRit.length === 0 ? '— belum ada rit rencana —' : '— pilih rit —'}
                </option>
                {daftarRit.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nomor} · {r.plat} · {r.namaSopir} · jam {jamRit(r.jadwalBerangkat)} ·{' '}
                    {r.suratJalan.length} surat jalan
                  </option>
                ))}
              </select>
            </label>
            <Button variant="outline" onClick={() => setRitBaru(true)}>
              <CalendarPlus /> Rit baru{' '}
              <kbd className="ml-1 font-mono text-xs opacity-70">Alt+N</kbd>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Input
              value={penerima}
              onChange={(e) => setPenerima(e.target.value)}
              placeholder="Nama penerima"
              aria-label="Nama penerima"
            />
            <Input
              value={noHp}
              onChange={(e) => setNoHp(e.target.value)}
              placeholder="No. HP penerima"
              aria-label="No. HP penerima"
            />
            <Input
              className="col-span-2"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Alamat kirim"
              aria-label="Alamat kirim"
            />
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left">Barang</th>
                <th className="py-1 text-right">Belum dikirim</th>
                <th className="w-32 py-1 text-right">Qty kirim</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.baris.map((b) => (
                <tr key={b.id}>
                  <td className="py-1.5">{b.namaBarang}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatDesimal(b.qtyBelumDikirim)} {b.kodeSatuan}
                  </td>
                  <td className="py-1.5">
                    <Input
                      className="h-8 text-right"
                      inputMode="decimal"
                      value={qty[b.id] ?? ''}
                      onChange={(e) =>
                        setQty((q) => ({ ...q, [b.id]: e.target.value.replace(',', '.') }))
                      }
                      aria-label={`Qty kirim ${b.namaBarang}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <DialogFooter>
            <Button variant="outline" onClick={onTutup}>
              Batal
            </Button>
            <Button disabled={buat.isPending} onClick={simpan}>
              <Truck /> {buat.isPending ? 'Menyimpan…' : 'Masukkan ke rit (Enter)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ritBaru && (
        <DialogRitBaru onTutup={() => setRitBaru(false)} onDibuat={(r) => setIdRit(String(r.id))} />
      )}
    </>
  );
}

export function KartuSuratJalan({
  sj,
  onCetak,
}: {
  sj: BarisSuratJalan;
  onCetak?: (sj: BarisSuratJalan) => void;
}) {
  const muat = useMuatSuratJalan();
  const batal = useBatalSuratJalan();
  const [dialog, setDialog] = useState<'hasil' | null>(null);
  const langkah = sj.status === 'BATAL' ? -1 : URUTAN.indexOf(sj.status);
  const waktu: Record<string, string | null> = {
    DIPROSES: sj.tanggal,
    DIMUAT: sj.waktuDimuat,
    DIKIRIM: sj.waktuDikirim,
    SELESAI: sj.waktuSelesai,
  };
  const siap = sj.status === 'DIPROSES' || sj.status === 'DIMUAT';

  return (
    <Card className="gap-3 p-4" data-testid={`sj-${sj.nomor}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold">{sj.nomor}</span>
            <BadgeSuratJalan status={sj.status} />
            {sj.nomorPerjalanan && (
              <span className="font-mono text-xs text-slate-500">{sj.nomorPerjalanan}</span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {sj.sopir
              ? `Sopir ${sj.sopir}`
              : 'Belum masuk rit (data lama): masukkan dari Pengiriman'}
            {sj.kendaraan && ` · ${sj.kendaraan}`} · {sj.alamatKirim}
          </div>
          {siap && sj.idPerjalanan !== null && (
            <div className="text-xs text-slate-500">
              Berangkat bersama ritnya dari{' '}
              <Link to="/pengiriman" className="text-blue-700 hover:underline">
                Logistik › Pengiriman
              </Link>
            </div>
          )}
          {sj.alasanBatal && <div className="text-xs text-red-600">Batal: {sj.alasanBatal}</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {onCetak && (
            <Button size="sm" variant="outline" onClick={() => onCetak(sj)}>
              <Printer /> Cetak
            </Button>
          )}
          {siap && (
            <Button
              size="sm"
              variant="outline"
              disabled={batal.isPending}
              onClick={() => {
                const alasan = window.prompt(`Alasan membatalkan ${sj.nomor}?`)?.trim();
                if (!alasan || alasan.length < 3) return;
                void batal
                  .mutateAsync({ id: sj.id, alasan })
                  .then(() => toast.success(`${sj.nomor} dibatalkan.`))
                  .catch((err: unknown) => toast.error(pesanGalat(err)));
              }}
            >
              <X /> Batalkan
            </Button>
          )}
          {sj.status === 'DIPROSES' && (
            <Button
              size="sm"
              variant="outline"
              disabled={muat.isPending}
              onClick={() =>
                void muat
                  .mutateAsync(sj.id)
                  .then(() => toast.success(`${sj.nomor}: barang dimuat.`))
                  .catch((err: unknown) => toast.error(pesanGalat(err)))
              }
            >
              <Check /> Selesai dimuat
            </Button>
          )}
          {sj.status === 'DIKIRIM' && (
            <Button size="sm" onClick={() => setDialog('hasil')}>
              <ClipboardCheck /> Catat hasil
            </Button>
          )}
        </div>
      </div>
      {sj.status !== 'BATAL' && (
        <ol className="grid grid-cols-4 gap-2 text-xs">
          {URUTAN.map((s, i) => (
            <li
              key={s}
              className={cn(
                'rounded-md border-t-4 px-2 pt-1',
                i <= langkah ? 'border-blue-600 text-slate-800' : 'border-slate-200 text-slate-400',
              )}
            >
              <div className="font-medium">{LABEL_SJ[s]}</div>
              <div>{i <= langkah && waktu[s] ? formatWaktu(waktu[s]) : '—'}</div>
            </li>
          ))}
        </ol>
      )}
      <div className="text-sm text-slate-600">
        {sj.baris
          .map((b) => `${b.namaBarang} ${formatDesimal(b.qtyKirim)} ${b.kodeSatuan}`)
          .join(' · ')}
      </div>
      <RingkasHasil sj={sj} />
      {dialog === 'hasil' && <DialogHasil sj={sj} onTutup={() => setDialog(null)} />}
    </Card>
  );
}

/** Surat jalan sebuah invoice pengantaran (docs/05 §7) beserta aksinya. */
export function PanelSuratJalan({
  p,
  bolehKelola,
  onCetak,
}: {
  p: DetailPenjualan;
  bolehKelola: boolean;
  onCetak: (sj: BarisSuratJalan) => void;
}) {
  const [buat, setBuat] = useState(false);
  const masihAda = p.baris.some((b) => /[1-9]/.test(b.qtyBelumDikirim));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Surat jalan</h2>
        {bolehKelola && masihAda && p.statusTransaksi !== 'VOID' && (
          <Button size="sm" onClick={() => setBuat(true)}>
            <Truck /> Kirim dengan rit…
          </Button>
        )}
      </div>
      {p.suratJalan.length === 0 && (
        <p className="text-sm text-slate-500">Belum ada surat jalan.</p>
      )}
      {p.suratJalan.map((sj) => (
        <KartuSuratJalan key={sj.id} sj={sj} onCetak={onCetak} />
      ))}
      {buat && <DialogBuat p={p} onTutup={() => setBuat(false)} />}
    </div>
  );
}
