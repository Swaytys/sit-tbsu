import {
  LABEL_CARA_PERSETUJUAN,
  LABEL_STATUS_PERSETUJUAN,
  type CaraPersetujuan,
  type DataSetujui,
  type MetodeRefund,
  type StatusPersetujuan,
} from '@sit/shared';
import { useState, type ReactNode } from 'react';
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
  DIBATALKAN: 'border-slate-200 bg-slate-50 text-slate-500',
};

const KETERANGAN: Record<StatusPersetujuan, string> = {
  MENUNGGU: 'Belum diputuskan Admin/Owner; stok dan uang belum berubah.',
  DISETUJUI: 'Sudah berlaku: stok dan uang sudah berubah, tidak bisa dibatalkan.',
  DITOLAK: 'Ditolak Admin/Owner; tidak ada yang berubah.',
  DIBATALKAN: 'Ditarik pengajunya sebelum diputuskan; tidak ada yang berubah.',
};

export function BadgePersetujuan({ status }: { status: StatusPersetujuan }) {
  return (
    <Badge variant="outline" className={WARNA[status]} title={KETERANGAN[status]}>
      {LABEL_STATUS_PERSETUJUAN[status]}
    </Badge>
  );
}

/** Kolom status di tabel retur/void: status, siapa yang memutuskan dan dengan cara apa, alasan. */
export function SelStatusKoreksi({
  status,
  namaPenyetuju,
  caraPersetujuan,
  alasanPenolakan,
  catatan,
}: {
  status: StatusPersetujuan;
  namaPenyetuju: string | null;
  caraPersetujuan: CaraPersetujuan | null;
  alasanPenolakan: string | null;
  catatan?: string | null;
}) {
  return (
    <div>
      <BadgePersetujuan status={status} />
      {namaPenyetuju && (
        <div className="text-xs text-slate-500">
          {namaPenyetuju}
          {caraPersetujuan && ` (${LABEL_CARA_PERSETUJUAN[caraPersetujuan]})`}
        </div>
      )}
      {alasanPenolakan && (
        <div className={cn('text-xs', status === 'DITOLAK' ? 'text-red-600' : 'text-slate-500')}>
          {alasanPenolakan}
        </div>
      )}
      {catatan && <div className="text-xs text-slate-500">{catatan}</div>}
    </div>
  );
}

/**
 * Isian refund saat menyetujui (T6/V5): tunai keluar dari laci shift pengguna yang login di perangkat itu,
 * transfer butuh rekening. Server yang menentukan apakah ada uang yang perlu dikembalikan.
 */
export function IsianRefund({
  nilai,
  onUbah,
  labelTunai = 'Tunai (laci shift saya)',
}: {
  nilai: DataSetujui;
  onUbah: (v: DataSetujui) => void;
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

/** Dialog setujui/tolak untuk tab Persetujuan, dari akun Admin/Owner sendiri (docs/04 §6). */
export function DialogPutuskan({
  judul,
  ringkasan,
  memproses,
  onSetujui,
  onTolak,
  onTutup,
}: {
  judul: string;
  ringkasan: ReactNode;
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

/** K-099: menarik pengajuan yang masih menunggu (salah input); wajib alasan. */
export function DialogBatalPengajuan({
  judul,
  memproses,
  onBatal,
  onTutup,
}: {
  judul: string;
  memproses: boolean;
  onBatal: (alasan: string) => void;
  onTutup: () => void;
}) {
  const [alasan, setAlasan] = useState('');
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>
            Pengajuan yang belum diputuskan bisa dibatalkan, lalu diajukan lagi dengan isi yang
            benar. Pembatalan tercatat di log. Yang sudah disetujui tidak bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="alasan-batal-pengajuan">Alasan pembatalan</Label>
          <Input
            id="alasan-batal-pengajuan"
            autoFocus
            value={alasan}
            maxLength={255}
            placeholder="mis. salah qty"
            onChange={(e) => setAlasan(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button
            variant="destructive"
            disabled={memproses || alasan.trim().length < 3}
            onClick={() => onBatal(alasan.trim())}
          >
            Batalkan pengajuan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
