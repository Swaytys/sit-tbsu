import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type Props = {
  terbuka: boolean;
  onTutup: () => void;
  judul: string;
  pesan: ReactNode;
  labelKonfirmasi: string;
  bahaya?: boolean;
  /** Dijalankan saat dikonfirmasi; dialog tertutup bila berhasil, tetap terbuka bila gagal. */
  onKonfirmasi: () => Promise<void>;
};

/** Dialog "yakin?" untuk aksi penting (nonaktifkan, cabut sesi, dsb.). Tombol nonaktif saat memproses. */
export function DialogKonfirmasi({
  terbuka,
  onTutup,
  judul,
  pesan,
  labelKonfirmasi,
  bahaya = false,
  onKonfirmasi,
}: Props) {
  const [memproses, setMemproses] = useState(false);

  async function konfirmasi() {
    setMemproses(true);
    try {
      await onKonfirmasi();
      onTutup();
    } catch {
      // Pesan galat sudah ditampilkan pemanggil (toast).
    } finally {
      setMemproses(false);
    }
  }

  return (
    <AlertDialog open={terbuka} onOpenChange={(buka) => !buka && !memproses && onTutup()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{judul}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{pesan}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={memproses}>Batal</AlertDialogCancel>
          <Button
            variant={bahaya ? 'destructive' : 'default'}
            disabled={memproses}
            onClick={() => void konfirmasi()}
          >
            {memproses ? 'Memproses…' : labelKonfirmasi}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
