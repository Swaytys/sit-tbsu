import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Mencegah isian form hilang tanpa sengaja: selama `kotor` (ada perubahan belum disimpan), pindah halaman
 * di dalam aplikasi meminta konfirmasi, dan menutup/memuat ulang tab memunculkan peringatan browser.
 * Panggil `lewati()` tepat sebelum pindah halaman setelah berhasil menyimpan. Pasang `dialog` di JSX.
 */
export function useCegahKeluar(kotor: boolean) {
  const lewatiRef = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      kotor && !lewatiRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!kotor) return;
    const tahan = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [kotor]);

  const lewati = useCallback(() => {
    lewatiRef.current = true;
  }, []);

  const dialog = (
    <AlertDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(buka) => !buka && blocker.state === 'blocked' && blocker.reset()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tinggalkan halaman ini?</AlertDialogTitle>
          <AlertDialogDescription>
            Ada isian yang belum disimpan. Bila Anda pindah halaman, isian itu hilang.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Tetap di sini</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={() => blocker.state === 'blocked' && blocker.proceed()}
          >
            Tinggalkan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { lewati, dialog };
}
