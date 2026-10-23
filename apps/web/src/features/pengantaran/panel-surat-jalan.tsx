import {
  skemaSuratJalan,
  type BarisSuratJalan,
  type DetailPenjualan,
  type StatusSuratJalan,
} from '@sit/shared';
import { Check, ClipboardCheck, Printer, Truck, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
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
import { DialogBerangkat } from './dialog-berangkat';
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
      teks.push(`kembali utuh ${formatDesimal(r.qtyKembali)} ${satuan}`);
    if (/[1-9]/.test(r.qtyRusak)) teks.push(`rusak ${formatDesimal(r.qtyRusak)} ${satuan}`);
    if (/[1-9]/.test(r.qtyDitolak)) teks.push(`ditolak ${formatDesimal(r.qtyDitolak)} ${satuan}`);
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
        {[h.returUang, h.returTukar].map(
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

export function DialogBuat({ p, onTutup }: { p: DetailPenjualan; onTutup: () => void }) {
  const buat = useBuatSuratJalan();
  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(p.baris.map((b) => [b.id, b.qtyBelumDikirim.replace(/\.?0+$/, '') || '0'])),
  );
  const [penerima, setPenerima] = useState(p.namaPelanggan ?? '');
  const [noHp, setNoHp] = useState(p.noHpPelanggan ?? '');
  const [alamat, setAlamat] = useState(p.alamatKirim ?? '');

  function simpan() {
    const data = skemaSuratJalan.safeParse({
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
        toast.success(`Surat jalan ${sj.nomor} dibuat.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat surat jalan</DialogTitle>
          <DialogDescription>
            Isi qty yang dikirim kali ini (boleh sebagian). Qty tidak boleh melebihi yang belum
            dikirim.
          </DialogDescription>
        </DialogHeader>
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
            Buat surat jalan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [dialog, setDialog] = useState<'berangkat' | 'hasil' | null>(null);
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
            {sj.sopir ? `Sopir ${sj.sopir}` : 'Kendaraan & sopir dipilih saat berangkat'}
            {sj.kendaraan && ` · ${sj.kendaraan}`} · {sj.alamatKirim}
          </div>
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
          {siap && (
            <Button size="sm" onClick={() => setDialog('berangkat')}>
              <Truck /> Berangkat kirim
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
      {dialog === 'berangkat' && (
        <DialogBerangkat suratJalan={[sj]} onTutup={() => setDialog(null)} />
      )}
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
            <Truck /> Buat surat jalan
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
