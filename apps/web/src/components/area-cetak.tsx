import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dokumen yang dicetak sendirian (struk, invoice, surat jalan, laporan): dirender ke `body`, tersembunyi
 * di layar, dan menjadi satu-satunya isi halaman saat `window.print()` (lihat styles/globals.css).
 * `ukuranKertas` mis. "80mm auto" (struk thermal) atau "A4". `css` menggantikan aturan `@page` bawaan
 * (mis. laporan dengan nomor halaman di kaki halaman).
 */
export function AreaCetak({
  children,
  ukuranKertas,
  css,
}: {
  children: ReactNode;
  ukuranKertas: string;
  css?: string;
}) {
  return createPortal(
    <div className="area-cetak">
      <style>
        {css ?? `@page { size: ${ukuranKertas}; margin: ${ukuranKertas === 'A4' ? '12mm' : '0'}; }`}
      </style>
      {children}
    </div>,
    document.body,
  );
}
