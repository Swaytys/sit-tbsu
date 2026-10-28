import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { SaranAlasan } from '@/components/saran-alasan';
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

/**
 * Dialog konfirmasi dengan alasan wajib (min. 3 huruf) dan saran alasan sesuai konteks (K-180). Enter = kirim.
 * `onKirim` menjalankan aksinya; dialog tertutup bila berhasil, galat tampil sebagai toast.
 */
export function DialogAlasan({
  judul,
  ket,
  label,
  saran,
  tombol = 'Ya, batalkan',
  onTutup,
  onKirim,
}: {
  judul: string;
  ket: string;
  label: string;
  saran: readonly string[];
  tombol?: string;
  onTutup: () => void;
  onKirim: (alasan: string) => Promise<unknown>;
}) {
  const [alasan, setAlasan] = useState('');
  const [proses, setProses] = useState(false);
  function kirim() {
    if (alasan.trim().length < 3) {
      toast.error('Alasan wajib diisi (min. 3 huruf).');
      return;
    }
    setProses(true);
    onKirim(alasan.trim())
      .then(onTutup)
      .catch((err: unknown) => toast.error(pesanGalat(err)))
      .finally(() => setProses(false));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>{ket}</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={alasan}
          maxLength={255}
          onChange={(e) => setAlasan(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && kirim()}
          placeholder="Alasan"
          aria-label={label}
        />
        <SaranAlasan saran={saran} onPilih={setAlasan} />
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button variant="destructive" disabled={proses} onClick={kirim}>
            {tombol}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
