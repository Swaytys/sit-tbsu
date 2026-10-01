import {
  skemaSuratJalan,
  type BarisSuratJalan,
  type DetailPenjualan,
  type StatusSuratJalan,
} from '@sit/shared';
import { Check, Printer, Truck, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBatalSuratJalan, useBuatSuratJalan, useStatusSuratJalan } from '@/api/penjualan';
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

const LABEL_SJ: Record<StatusSuratJalan, string> = {
  DIPROSES: 'Surat jalan dicetak',
  DIMUAT: 'Barang dimuat',
  DIKIRIM: 'Sedang dikirim',
  SELESAI: 'Diterima',
  BATAL: 'Batal',
};
const URUTAN: StatusSuratJalan[] = ['DIPROSES', 'DIMUAT', 'DIKIRIM', 'SELESAI'];
const BERIKUT = { DIPROSES: 'DIMUAT', DIMUAT: 'DIKIRIM', DIKIRIM: 'SELESAI' } as const;
const LABEL_AKSI = {
  DIMUAT: 'Selesai dimuat',
  DIKIRIM: 'Berangkat kirim',
  SELESAI: 'Sudah diterima',
};

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

function DialogBuat({ p, onTutup }: { p: DetailPenjualan; onTutup: () => void }) {
  const buat = useBuatSuratJalan();
  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(p.baris.map((b) => [b.id, b.qtyBelumDikirim.replace(/\.?0+$/, '') || '0'])),
  );
  const [penerima, setPenerima] = useState(p.namaPelanggan ?? '');
  const [noHp, setNoHp] = useState(p.noHpPelanggan ?? '');
  const [alamat, setAlamat] = useState(p.alamatKirim ?? '');
  const [sopir, setSopir] = useState('');
  const [kendaraan, setKendaraan] = useState('');

  function simpan() {
    const data = skemaSuratJalan.safeParse({
      alamatKirim: alamat,
      namaPenerima: penerima,
      noHpPenerima: noHp,
      sopir,
      kendaraan,
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
          <Input
            value={sopir}
            onChange={(e) => setSopir(e.target.value)}
            placeholder="Sopir (boleh diisi nanti)"
            aria-label="Sopir"
          />
          <Input
            value={kendaraan}
            onChange={(e) => setKendaraan(e.target.value)}
            placeholder="Kendaraan / no. polisi"
            aria-label="Kendaraan"
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

function DialogBerangkat({ sj, onTutup }: { sj: BarisSuratJalan; onTutup: () => void }) {
  const status = useStatusSuratJalan();
  const [sopir, setSopir] = useState(sj.sopir ?? '');
  const [kendaraan, setKendaraan] = useState(sj.kendaraan ?? '');
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Berangkat kirim {sj.nomor}</DialogTitle>
          <DialogDescription>Nama sopir wajib diisi sebelum barang berangkat.</DialogDescription>
        </DialogHeader>
        <Input
          value={sopir}
          onChange={(e) => setSopir(e.target.value)}
          placeholder="Nama sopir"
          aria-label="Nama sopir"
          autoFocus
        />
        <Input
          value={kendaraan}
          onChange={(e) => setKendaraan(e.target.value)}
          placeholder="Kendaraan"
          aria-label="Kendaraan"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button
            disabled={!sopir.trim() || status.isPending}
            onClick={() =>
              void status
                .mutateAsync({
                  id: sj.id,
                  status: 'DIKIRIM',
                  sopir: sopir.trim(),
                  kendaraan: kendaraan.trim() || null,
                })
                .then(() => {
                  toast.success(`${sj.nomor} berangkat.`);
                  onTutup();
                })
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            Berangkat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KartuSuratJalan({
  sj,
  onCetak,
}: {
  sj: BarisSuratJalan;
  onCetak: (sj: BarisSuratJalan) => void;
}) {
  const status = useStatusSuratJalan();
  const batal = useBatalSuratJalan();
  const [berangkat, setBerangkat] = useState(false);
  const langkah = sj.status === 'BATAL' ? -1 : URUTAN.indexOf(sj.status);
  const berikut = sj.status in BERIKUT ? BERIKUT[sj.status as keyof typeof BERIKUT] : null;
  const waktu: Record<string, string | null> = {
    DIPROSES: sj.tanggal,
    DIMUAT: sj.waktuDimuat,
    DIKIRIM: sj.waktuDikirim,
    SELESAI: sj.waktuSelesai,
  };

  function maju() {
    if (!berikut) return;
    if (berikut === 'DIKIRIM') {
      setBerangkat(true);
      return;
    }
    void status
      .mutateAsync({ id: sj.id, status: berikut })
      .then(() => toast.success(`${sj.nomor}: ${LABEL_SJ[berikut].toLowerCase()}.`))
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Card className="gap-3 p-4" data-testid={`sj-${sj.nomor}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold">{sj.nomor}</span>
            <BadgeSuratJalan status={sj.status} />
          </div>
          <div className="text-xs text-slate-500">
            {sj.sopir ? `Sopir ${sj.sopir}` : 'Sopir belum diisi'}
            {sj.kendaraan && ` · ${sj.kendaraan}`} · {sj.alamatKirim}
          </div>
          {sj.alasanBatal && <div className="text-xs text-red-600">Batal: {sj.alasanBatal}</div>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onCetak(sj)}>
            <Printer /> Cetak
          </Button>
          {(sj.status === 'DIPROSES' || sj.status === 'DIMUAT') && (
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
          {berikut && (
            <Button size="sm" disabled={status.isPending} onClick={maju}>
              {berikut === 'DIKIRIM' ? <Truck /> : <Check />} {LABEL_AKSI[berikut]}
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
      {berangkat && <DialogBerangkat sj={sj} onTutup={() => setBerangkat(false)} />}
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
