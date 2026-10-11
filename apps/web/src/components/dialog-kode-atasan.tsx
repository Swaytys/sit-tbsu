import type { DataKodePersetujuan, InfoKodePersetujuan } from '@sit/shared';
import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { pesanGalat } from '@/api/client';
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
import { formatWaktu } from '@/lib/format';

const LABEL_SALURAN = { TELEGRAM: 'Telegram', EMAIL: 'email' } as const;

/**
 * Persetujuan atasan dengan kode sekali pakai (docs/04 §6, K-102). Dipakai retur, void, dan melampaui limit
 * kredit. Pengaju menekan "Kirim kode": sistem mengirim kode 6 angka ke Telegram/email tiap Admin/Owner
 * beserta rincian yang diminta. Atasan yang setuju menyebutkan kodenya (telepon/WhatsApp/langsung); pengaju
 * mengetiknya di sini. Tidak ada password atasan yang diketik di komputer kasir.
 *
 * `children` = isian tambahan di atas kolom kode (mis. pilihan refund).
 */
export function DialogKodeAtasan({
  judul,
  ringkasan,
  children,
  mintaKode,
  onSetujui,
  memproses,
  labelTutup = 'Batal',
  onTutup,
}: {
  judul: string;
  ringkasan: ReactNode;
  children?: ReactNode;
  mintaKode: () => Promise<InfoKodePersetujuan>;
  onSetujui: (kode: DataKodePersetujuan) => void;
  memproses: boolean;
  labelTutup?: string;
  onTutup: () => void;
}) {
  const [info, setInfo] = useState<InfoKodePersetujuan | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState('');
  const [kode, setKode] = useState('');

  function kirimKode() {
    if (mengirim) return;
    setMengirim(true);
    setGalat('');
    mintaKode()
      .then((i) => {
        setInfo(i);
        setKode('');
      })
      .catch((err: unknown) => setGalat(pesanGalat(err)))
      .finally(() => setMengirim(false));
  }

  const lengkap = /^\d{6}$/.test(kode);
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-blue-600" /> {judul}
          </DialogTitle>
          <DialogDescription>
            Butuh persetujuan Admin atau Owner. Sistem mengirim kode sekali pakai ke Telegram atau
            email atasan beserta rincian di bawah. Atasan yang setuju menyebutkan kodenya kepada
            Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-slate-50 p-2 text-sm">{ringkasan}</div>
        {children}

        {info === null ? (
          <Button autoFocus disabled={mengirim} onClick={kirimKode}>
            {mengirim ? 'Mengirim kode…' : 'Kirim kode ke atasan'}
          </Button>
        ) : (
          <form
            className="space-y-2"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              if (lengkap && !memproses) onSetujui({ idPermintaan: info.idPermintaan, kode });
            }}
          >
            <p className="text-sm text-slate-600" data-testid="penerima-kode">
              Kode dikirim ke{' '}
              <b>
                {info.penerima
                  .map((p) => `${p.nama} (${p.saluran.map((s) => LABEL_SALURAN[s]).join(' + ')})`)
                  .join(', ')}
              </b>
              . Berlaku sampai pukul {formatWaktu(info.kadaluarsa).slice(11)}, sekali pakai.
            </p>
            {info.simulasi && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                Mode pengembangan: ada saluran yang belum diatur di Pengaturan › Persetujuan, jadi
                kode untuk saluran itu <b>tidak benar-benar dikirim</b> (hanya tercatat di log
                server). Di komputer toko, saluran yang belum diatur tidak dipakai sama sekali.
              </p>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="kode-atasan">Kode dari atasan (6 angka)</Label>
                <Input
                  id="kode-atasan"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={kode}
                  maxLength={6}
                  onChange={(e) => setKode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-11 text-center font-mono text-2xl tracking-[0.4em]"
                />
              </div>
              <Button type="submit" className="h-11" disabled={!lengkap || memproses}>
                {memproses ? 'Memeriksa…' : 'Setujui dengan kode'}
              </Button>
            </div>
            <button
              type="button"
              disabled={mengirim}
              onClick={kirimKode}
              className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
            >
              {mengirim ? 'Mengirim…' : 'Kirim kode baru (kode lama tidak berlaku lagi)'}
            </button>
          </form>
        )}
        {galat && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {galat}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onTutup}>
            {labelTutup}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
