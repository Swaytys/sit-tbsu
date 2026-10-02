import type { DataSetujui, MetodeRefund, StatusPersetujuan } from '@sit/shared';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const WARNA: Record<StatusPersetujuan, string> = {
  MENUNGGU: 'border-amber-200 bg-amber-50 text-amber-700',
  DISETUJUI: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DITOLAK: 'border-red-200 bg-red-50 text-red-600',
};
const LABEL: Record<StatusPersetujuan, string> = {
  MENUNGGU: 'Menunggu',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
};

export function BadgePersetujuan({ status }: { status: StatusPersetujuan }) {
  return (
    <Badge variant="outline" className={WARNA[status]}>
      {LABEL[status]}
    </Badge>
  );
}

/**
 * Isian refund saat menyetujui (T6/V5): tunai keluar dari laci shift penyetuju, transfer butuh rekening.
 * Server yang menentukan apakah ada uang yang perlu dikembalikan.
 */
export function IsianRefund({
  nilai,
  onUbah,
  labelTunai = 'Tunai (laci shift saya)',
}: {
  nilai: DataSetujui;
  onUbah: (v: DataSetujui) => void;
  /** Refund tunai selalu keluar dari laci shift penyetuju. */
  labelTunai?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>Bila ada uang yang dikembalikan ke pembeli</Label>
      <div className="grid grid-cols-2 gap-2">
        {(['TUNAI', 'TRANSFER'] as MetodeRefund[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onUbah({ ...nilai, metodeRefund: m })}
            className={cn(
              'rounded-md border-2 py-1.5 text-sm font-semibold',
              nilai.metodeRefund === m
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200',
            )}
          >
            {m === 'TUNAI' ? labelTunai : 'Transfer'}
          </button>
        ))}
      </div>
      {nilai.metodeRefund === 'TRANSFER' && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Rekening pembeli"
            aria-label="Rekening refund"
            value={nilai.rekeningRefund ?? ''}
            maxLength={60}
            onChange={(e) => onUbah({ ...nilai, rekeningRefund: e.target.value })}
          />
          <Input
            placeholder="No. referensi (opsional)"
            aria-label="Referensi refund"
            value={nilai.referensiRefund ?? ''}
            maxLength={60}
            onChange={(e) => onUbah({ ...nilai, referensiRefund: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

/** Dialog setujui/tolak untuk tab Persetujuan (docs/04 §6). */
export function DialogPutuskan({
  judul,
  ringkasan,
  memproses,
  onSetujui,
  onTolak,
  onTutup,
}: {
  judul: string;
  ringkasan: React.ReactNode;
  memproses: boolean;
  onSetujui: (v: DataSetujui) => void;
  onTolak: (alasan: string) => void;
  onTutup: () => void;
}) {
  const [refund, setRefund] = useState<DataSetujui>({ metodeRefund: null });
  const [tolak, setTolak] = useState(false);
  const [alasan, setAlasan] = useState('');
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>
            Keputusan dicatat atas nama Anda dan tidak bisa diubah.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">{ringkasan}</div>
        {tolak ? (
          <div className="space-y-1">
            <Label htmlFor="alasan-tolak">Alasan penolakan</Label>
            <Input
              id="alasan-tolak"
              autoFocus
              value={alasan}
              maxLength={255}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>
        ) : (
          <IsianRefund nilai={refund} onUbah={setRefund} />
        )}
        <DialogFooter>
          {tolak ? (
            <>
              <Button variant="outline" onClick={() => setTolak(false)}>
                Kembali
              </Button>
              <Button
                variant="destructive"
                disabled={memproses || alasan.trim().length < 3}
                onClick={() => onTolak(alasan.trim())}
              >
                Tolak
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setTolak(true)}>
                Tolak…
              </Button>
              <Button disabled={memproses} onClick={() => onSetujui(refund)}>
                Setujui
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
