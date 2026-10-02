import { useSyncExternalStore } from 'react';

const LANGKAH_MS = 30_000;

function berlangganan(beritahu: () => void): () => void {
  const id = setInterval(beritahu, LANGKAH_MS);
  return () => clearInterval(id);
}

/** Waktu sekarang dibulatkan per 30 detik: cukup untuk "menunggu N menit" tanpa render berlebih. */
export function useSekarang(): number {
  return useSyncExternalStore(berlangganan, () => Math.floor(Date.now() / LANGKAH_MS) * LANGKAH_MS);
}
