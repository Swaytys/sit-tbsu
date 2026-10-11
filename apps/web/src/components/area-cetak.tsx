import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** 1 mm dalam piksel CSS (96 dpi). */
const PX_PER_MM = 96 / 25.4;

/** Jumlah AreaCetak yang sedang terpasang; selama > 0, `<html>` berkelas `ada-area-cetak` (globals.css). */
let terpasang = 0;

function useTandaAreaCetak() {
  useLayoutEffect(() => {
    terpasang += 1;
    document.documentElement.classList.add('ada-area-cetak');
    return () => {
      terpasang -= 1;
      if (terpasang === 0) document.documentElement.classList.remove('ada-area-cetak');
    };
  }, []);
}

/**
 * Dokumen yang dicetak sendirian (struk, invoice, surat jalan, laporan, label): dirender ke `body`, tersembunyi
 * di layar, dan menjadi satu-satunya isi halaman saat `window.print()` (lihat styles/globals.css).
 *
 * `ukuranKertas`: "A4", atau "<lebar>mm auto" untuk kertas gulungan thermal (struk, label). CSS tidak mengenal
 * tinggi "auto" pada `@page size` (browser lalu memakai A4), jadi tinggi gulungan diukur dari isi dokumen dan
 * ukuran kertas ditulis lengkap, mis. `58mm 143mm`. `margin` dipakai sebagai padding dokumen gulungan.
 * `css` menggantikan aturan `@page` bawaan kertas lembaran (mis. laporan dengan nomor halaman).
 */
export function AreaCetak({
  children,
  ukuranKertas,
  css,
  margin,
}: {
  children: ReactNode;
  ukuranKertas: string;
  css?: string;
  margin?: string;
}) {
  const lebarGulungan = /^(\d+(?:\.\d+)?)mm auto$/.exec(ukuranKertas)?.[1];
  const isi = useRef<HTMLDivElement>(null);
  const [tinggiMm, setTinggiMm] = useState<number | null>(null);
  useTandaAreaCetak();

  // Diukur sebelum browser menggambar, sehingga ukuran kertas sudah benar saat window.print() dipanggil.
  useLayoutEffect(() => {
    if (lebarGulungan === undefined || !isi.current) return;
    setTinggiMm(Math.ceil(isi.current.getBoundingClientRect().height / PX_PER_MM) + 1);
  }, [lebarGulungan, children]);

  if (lebarGulungan !== undefined) {
    return createPortal(
      <div className="area-cetak area-cetak-gulungan">
        <style>{`@page { size: ${lebarGulungan}mm ${tinggiMm ?? 200}mm; margin: 0; }`}</style>
        <div ref={isi} style={{ width: `${lebarGulungan}mm`, padding: margin ?? 0 }}>
          {children}
        </div>
      </div>,
      document.body,
    );
  }
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
