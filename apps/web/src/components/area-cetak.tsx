import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dokumen yang dicetak sendirian (struk, invoice, surat jalan): dirender ke `body`, tersembunyi di layar,
 * dan menjadi satu-satunya isi halaman saat `window.print()` (lihat styles/globals.css).
 * `ukuranKertas` mis. "80mm auto" (struk thermal) atau "A4".
 */
export function AreaCetak({
  children,
  ukuranKertas,
}: {
  children: ReactNode;
  ukuranKertas: string;
}) {
  return createPortal(
    <div className="area-cetak">
      <style>{`@page { size: ${ukuranKertas}; margin: ${ukuranKertas === 'A4' ? '12mm' : '0'}; }`}</style>
      {children}
    </div>,
    document.body,
  );
}
