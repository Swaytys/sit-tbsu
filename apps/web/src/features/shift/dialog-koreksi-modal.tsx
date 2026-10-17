import { formatRupiah, type ShiftAktif } from '@sit/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { mintaKodeKoreksiModal, useKoreksiModal } from '@/api/penjualan';
import { DialogKodeAtasan } from '@/components/dialog-kode-atasan';
import { InputRupiah } from '@/components/input-rupiah';
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

/**
 * Koreksi modal awal (K-121 butir 3). Modal awal tidak diubah; selisihnya dicatat sebagai kas "Koreksi modal"
 * beralasan. Sebelum ada transaksi tunai kasir boleh mengoreksi sendiri; sesudahnya butuh kode Admin/Owner.
 */
export function DialogKoreksiModal({
  shift,
  atasan,
  onTutup,
}: {
  shift: ShiftAktif;
  atasan: boolean;
  onTutup: () => void;
}) {
  const koreksi = useKoreksiModal();
  const sekarang = shift.modalAwal + shift.koreksiModal;
  const [benar, setBenar] = useState<number | null>(null);
  const [alasan, setAlasan] = useState('');
  const [mintaKode, setMintaKode] = useState(false);
  const butuhKode = shift.adaTransaksiTunai && !atasan;
  const sah = benar !== null && benar !== sekarang && alasan.trim().length >= 3;

  function simpan(kode?: { idPermintaan: number; kode: string }) {
    if (benar === null) return;
    koreksi
      .mutateAsync({ id: shift.id, json: { modalBenar: benar, alasan: alasan.trim(), kode } })
      .then(() => {
        toast.success(`Modal dikoreksi: ${formatRupiah(sekarang)} → ${formatRupiah(benar)}.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  if (mintaKode && benar !== null) {
    return (
      <DialogKodeAtasan
        judul="Persetujuan koreksi modal"
        ringkasan={
          <p>
            Koreksi modal shift {shift.nomor}: {formatRupiah(sekarang)} → {formatRupiah(benar)}.
            Alasan: {alasan.trim()}
          </p>
        }
        mintaKode={() =>
          mintaKodeKoreksiModal(shift.id, { modalBenar: benar, alasan: alasan.trim() })
        }
        onSetujui={(k) => simpan(k)}
        memproses={koreksi.isPending}
        onTutup={() => setMintaKode(false)}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Koreksi modal awal</DialogTitle>
          <DialogDescription>
            Modal sekarang {formatRupiah(sekarang)}. Angka lama tidak dihapus; koreksi dicatat
            dengan alasan dan terlihat atasan.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!sah) return;
            if (butuhKode) setMintaKode(true);
            else simpan();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="modal-benar">Modal awal yang benar</Label>
            <InputRupiah id="modal-benar" value={benar} onChange={setBenar} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alasan-koreksi">Alasan</Label>
            <Input
              id="alasan-koreksi"
              value={alasan}
              maxLength={255}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="mis. salah ketik, kurang satu nol"
            />
          </div>
          <p className="text-xs text-slate-500">
            {butuhKode
              ? 'Sudah ada transaksi tunai di shift ini, jadi koreksi butuh kode dari Admin/Owner (dikirim ke Telegram/email mereka).'
              : 'Belum ada transaksi tunai: Anda boleh mengoreksi sendiri. Koreksi tetap tercatat di log.'}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup}>
              Batal
            </Button>
            <Button type="submit" disabled={!sah || koreksi.isPending}>
              {butuhKode ? 'Minta persetujuan…' : 'Simpan koreksi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
