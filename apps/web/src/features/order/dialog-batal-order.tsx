import type { BarisDaftarOrder } from '@sit/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useBatalOrder } from '@/api/penjualan';
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

/** Batalkan order dengan alasan (R5); reservasi stok dilepas. */
export function DialogBatal({
  d,
  onTutup,
}: {
  d: Pick<BarisDaftarOrder, 'id' | 'nomor'>;
  onTutup: () => void;
}) {
  const batal = useBatalOrder();
  const [alasan, setAlasan] = useState('');
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan order {d.nomor}?</DialogTitle>
          <DialogDescription>
            Barang yang ditahan order ini dilepas kembali ke stok tersedia. Order yang dibatalkan
            tidak bisa dipakai lagi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="alasan-batal" className="text-sm font-medium">
            Alasan batal
          </label>
          <Input
            id="alasan-batal"
            value={alasan}
            maxLength={255}
            onChange={(e) => setAlasan(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Kembali
          </Button>
          <Button
            variant="destructive"
            disabled={alasan.trim().length < 3 || batal.isPending}
            onClick={() =>
              void batal
                .mutateAsync({ id: d.id, alasan: alasan.trim() })
                .then(() => {
                  toast.success(`Order ${d.nomor} dibatalkan.`);
                  onTutup();
                })
                .catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            Batalkan order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
